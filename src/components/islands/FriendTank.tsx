import { useEffect, useMemo, useRef } from "react";
import { useFriendLinks } from "../../lib/api/hooks";
import { useRealtimeRefresh } from "../../lib/realtime";

/**
 * 友链「鱼缸」island（Nebula 复刻 · layouts.md §7）：
 * - 玻璃容器样式由页面层（friends.astro 的 .friend-tank）提供，本组件只负责行为与结构；
 * - 72px 圆形头像做正弦 + 随机相位弹性漂浮（rAF 直接写 transform，不走 React 渲染）；
 * - hover 暂停漂浮 + scale(1.12) + 名字浮签；点击新窗口打开友链；
 * - prefers-reduced-motion → 不启动 rAF，头像按基点静态排布；
 * - 加载失败 / 为空 → 鱼缸内空态文案，不抛错。
 * 数据链路：useFriendLinks（SWR，key ["friend-links"]）+ SSE 实时刷新。
 */

interface Floater {
  id: number;
  /** 鱼缸内基点（百分比） */
  baseX: number;
  baseY: number;
  /** 漂移幅度（px）与频率、随机相位 */
  ampX: number;
  ampY: number;
  speedX: number;
  speedY: number;
  phaseX: number;
  phaseY: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** 按数量把头像均匀撒进鱼缸：每行 3–6 尾，行数自适应，基点带少量抖动 */
function computeFloaters(ids: number[]): Floater[] {
  const n = ids.length;
  if (!n) return [];
  const perRow = clamp(Math.round(Math.sqrt((n * 5) / 2)), 1, 6);
  const rows = Math.ceil(n / perRow);
  const jitter = (span: number) => (Math.random() - 0.5) * span;
  return ids.map((id, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const inRow = Math.min(perRow, n - row * perRow);
    return {
      id,
      baseX: clamp(((col + 0.5) / inRow) * 100 + jitter(8), 10, 90),
      baseY: clamp(((row + 0.5) / rows) * 100 + jitter(8), 22, 78),
      ampX: 10 + Math.random() * 22,
      ampY: 8 + Math.random() * 16,
      speedX: 0.35 + Math.random() * 0.5,
      speedY: 0.3 + Math.random() * 0.45,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
    };
  });
}

export default function FriendTank() {
  const { data, error, isLoading } = useFriendLinks();
  // SSE：后台增删友链 → friends 频道 → SWR 全局 mutate 重校验上面的 key
  useRealtimeRefresh(["friend-links"]);

  const friends = data ?? [];
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // 以 id 序列为依赖，避免 SWR 返回等价新数组时漂浮参数重抽导致跳位
  const idsKey = friends.map((f) => f.id).join(",");
  const floaters = useMemo(() => computeFloaters(idsKey ? idsKey.split(",").map(Number) : []), [idsKey]);
  const floaterMap = useMemo(() => new Map(floaters.map((f) => [f.id, f])), [floaters]);

  const itemRefs = useRef(new Map<number, HTMLAnchorElement>());
  const pausedRef = useRef(false);

  useEffect(() => {
    if (reduceMotion || floaters.length === 0) return;
    let raf = 0;
    let last = performance.now();
    let t = 0; // 漂浮时钟：暂停时不累加，恢复后无缝续走
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!pausedRef.current) {
        t += dt;
        for (const f of floaters) {
          const el = itemRefs.current.get(f.id);
          if (!el) continue;
          const dx = Math.sin(t * f.speedX + f.phaseX) * f.ampX;
          const dy = Math.cos(t * f.speedY + f.phaseY) * f.ampY;
          el.style.transform = `translate(calc(-50% + ${dx.toFixed(2)}px), calc(-50% + ${dy.toFixed(2)}px))`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [floaters, reduceMotion]);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };

  const emptyText = error
    ? "友链暂时无法加载，稍后再来看看吧。"
    : !isLoading && friends.length === 0
      ? "鱼缸里还空空的，欢迎交换友链～"
      : null;

  return (
    <>
      <div
        className="friend-tank"
        onPointerEnter={pause}
        onPointerLeave={resume}
        onFocusCapture={pause}
        onBlurCapture={resume}
      >
        {emptyText ? <p className="tank-empty">{emptyText}</p> : null}
        {friends.map((friend) => (
          <a
            key={friend.id}
            ref={(el) => {
              if (el) itemRefs.current.set(friend.id, el);
              else itemRefs.current.delete(friend.id);
            }}
            className="tank-fish"
            href={friend.url}
            target="_blank"
            rel="noreferrer noopener"
            style={{ left: `${floaterMap.get(friend.id)?.baseX ?? 50}%`, top: `${floaterMap.get(friend.id)?.baseY ?? 50}%` }}
            aria-label={`${friend.name}（新窗口打开）`}
          >
            <span className="tank-fish-avatar">
              <img src={friend.avatar} alt="" loading="lazy" />
            </span>
            <span className="tank-fish-tag">{friend.name}</span>
          </a>
        ))}
      </div>

      {friends.length > 0 && (
        <div className="friend-cards">
          {friends.map((friend) => (
            <a
              key={friend.id}
              className="friend-card"
              href={friend.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              <img className="friend-card-avatar" src={friend.avatar} alt="" loading="lazy" />
              <span className="friend-card-text">
                <strong className="friend-card-name">{friend.name}</strong>
                <span className="friend-card-bio">{friend.description}</span>
              </span>
              <span className="friend-card-arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
