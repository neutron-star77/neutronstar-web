/**
 * 实时层（P4：SSE 方案 A）—— 浏览器侧订阅 BFF 的 `/sse/<channel>`。
 *
 * 数据流：
 *   后台发布 → 后端 `invalidate_cache(tags)` → BFF `/internal/revalidate`
 *   → ①按 tag 清边缘缓存 ②向对应频道的 Durable Object 投递事件
 *   → DO 扇出给所有在线页面 → 本模块通知各 island → 该 island 用**自己**的 SWR 实例重校验
 *   → 新内容以原有入场动画插入
 *
 * ⚠️ 两个必须踩住的坑（决定了这里的实现形态）：
 *
 * 1. **模块级变量在多 island 架构下不可靠**。Astro 的 island 会各自打包一份依赖
 *    （实测 `swr` 在产物里存在多份，例如 `use-swr-*.js` 两个不同 chunk），
 *    所以「模块级单例 EventSource」会在每个 island 里各建一条连接；
 *    同理「在 A 模块里 mutate」也动不了 B island 的 SWR 缓存。
 *    → 解决办法：**连接放在 `window` 上的全局 hub**（跨 chunk 唯一），
 *      而重校验交给各 island 自己的 `useRealtimeRefresh()` 里导入的 `mutate`。
 *
 * 2. **SSE 不是唯一数据源**。DO 挂了/浏览器不支持/断线时，页面照常靠 SWR
 *    （聚焦重校验 + BFF 的 s-maxage/swr）拿到最新数据，实时只是"更快"。
 *
 * 二次开发提示：
 *  - 新增频道：BFF 的 `TAG_CHANNELS` 登记 tag→channel，再在本文件
 *    `CHANNEL_KEY_PREFIXES` 里把频道映射到 SWR key 前缀。
 *  - 新数据区块要实时：在该 island 里 `useRealtimeRefresh(["<key前缀>"])` 即可；
 *    非 SWR 的数据源（手写 fetch）用第二个参数传入自己的重新拉取函数。
 */

import { useEffect, useRef } from "react";
import { mutate } from "swr";
import { API_BASE_URL } from "./api/client";

export interface RealtimeEvent {
  /** 频道名：posts / moments / albums / friends / messages / nav / home / all */
  channel: string;
  type: string;
  action?: string;
  id?: string | number | null;
  at: number;
}

/**
 * 频道 → SWR key 前缀。key 第一段即 hook 里的标识：
 * ["posts", page, size] / ["post", slug] / ["chatters", …] / ["albums"] /
 * ["album-photos", id] / ["messages", …]
 */
const CHANNEL_KEY_PREFIXES: Record<string, string[]> = {
  posts: ["posts", "post"],
  moments: ["chatters"],
  albums: ["albums", "album-photos"],
  friends: ["friend-links"],
  messages: ["messages"],
  nav: ["site-config"],
  comments: ["comments"],
  home: ["home", "posts", "chatters", "albums"],
  all: [
    "posts",
    "post",
    "chatters",
    "albums",
    "album-photos",
    "messages",
    "friend-links",
    "site-config",
    "comments",
    "home",
  ],
};

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
/** 站内跳转会让 island 卸载再挂载，留个宽限期避免连接跟着闪断 */
const CLOSE_GRACE_MS = 5_000;

type Handler = (event: RealtimeEvent) => void;

interface Hub {
  source: EventSource | null;
  /** 当前订阅的频道串（默认 all：BFF 每次广播都会带上它） */
  channels: string;
  refs: number;
  attempts: number;
  listeners: Set<Handler>;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  closeTimer: ReturnType<typeof setTimeout> | null;
}

const HUB_KEY = "__kiramekuRealtimeHub";

function getHub(): Hub | null {
  if (typeof window === "undefined") return null;
  const store = window as unknown as Record<string, unknown>;
  if (!store[HUB_KEY]) {
    store[HUB_KEY] = {
      source: null,
      channels: "all",
      refs: 0,
      attempts: 0,
      listeners: new Set<Handler>(),
      reconnectTimer: null,
      closeTimer: null,
    } satisfies Hub;
  }
  return store[HUB_KEY] as Hub;
}

function closeSource(hub: Hub) {
  if (hub.reconnectTimer) {
    clearTimeout(hub.reconnectTimer);
    hub.reconnectTimer = null;
  }
  if (hub.source) {
    hub.source.close();
    hub.source = null;
  }
}

function connect(hub: Hub) {
  if (typeof EventSource === "undefined") return;
  closeSource(hub);

  const es = new EventSource(`${API_BASE_URL}/sse/${hub.channels}`);
  hub.source = es;
  hub.attempts = 0;

  es.onopen = () => {
    hub.attempts = 0;
  };

  es.addEventListener("change", (ev) => {
    let event: RealtimeEvent;
    try {
      event = JSON.parse((ev as MessageEvent).data as string) as RealtimeEvent;
    } catch {
      return;
    }
    hub.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // 单个监听方抛错不影响其它监听方
      }
    });
  });

  es.onerror = () => {
    // CONNECTING：浏览器自己在重连；CLOSED 说明它放弃了（例如 BFF 未配 DO 返回 503），
    // 这时由我们接管，指数退避重连。
    if (es.readyState === EventSource.CLOSED) {
      closeSource(hub);
      const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** hub.attempts);
      hub.attempts += 1;
      hub.reconnectTimer = setTimeout(() => connect(hub), delay);
    }
  };
}

/**
 * 让该 island 接入实时：
 *  - 首次调用建立（复用）全局唯一的 SSE 连接，卸载时引用计数递减、归零后延迟断开；
 *  - 收到事件且频道命中 `prefixes` 时，用本 island 的 SWR 实例重校验对应 key，
 *    并可选调用 `onChange`（给非 SWR 的数据源用）。
 */
export function useRealtimeRefresh(prefixes: string[], onChange?: () => void) {
  const key = [...new Set(prefixes)].sort().join(",");
  // onChange 常是每次渲染新建的函数，用 ref 承接，避免反复退订/重订阅
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const hub = getHub();
    if (!hub) return;

    hub.refs += 1;
    if (hub.closeTimer) {
      clearTimeout(hub.closeTimer);
      hub.closeTimer = null;
    }
    if (!hub.source) connect(hub);

    const wanted = key.split(",").filter(Boolean);
    const listener: Handler = (event) => {
      const channelPrefixes = CHANNEL_KEY_PREFIXES[event.channel] ?? [];
      if (!wanted.some((prefix) => channelPrefixes.includes(prefix))) return;

      void mutate(
        (k) => Array.isArray(k) && k.length > 0 && wanted.includes(String(k[0])),
        undefined,
        { revalidate: true },
      );
      onChangeRef.current?.();
    };

    hub.listeners.add(listener);

    return () => {
      hub.listeners.delete(listener);
      hub.refs = Math.max(0, hub.refs - 1);
      if (hub.refs === 0) {
        hub.closeTimer = setTimeout(() => {
          if (hub.refs === 0) closeSource(hub);
        }, CLOSE_GRACE_MS);
      }
    };
  }, [key]);
}
