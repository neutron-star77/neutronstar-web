/**
 * WalineComments —— Waline 评论 React island（Kirameku 玻璃风）。
 *
 * 统一挂载在文章 / 说说 / 相册 / 留言板四处，用唯一 `path` 区分评论线程：
 *   - 文章：/posts/<slug>
 *   - 说说：/moments/<id>
 *   - 相册：/albums/<id>
 *   - 留言板：/messages
 *
 * 服务端：NAS Docker 自建 Waline（https://comments.neutronstar.fun），
 * 允许匿名评论（昵称+邮箱，邮箱可留空），GitHub 登录为可选。
 *
 * 说明：
 *  - @waline/client/full 仅在客户端 useEffect 内动态 import，避免被打进
 *    Cloudflare Workers SSR 包（它依赖 document）。
 *  - 皮肤见 src/styles/waline.css（作用域 .kirameku-waline）。
 */

import { useEffect, useRef, useState } from "react";
import "@waline/client/style";
import "../../styles/waline.css";

// 未设置 PUBLIC_WALINE_SERVER 时回落到生产域名（Vite 会把未设的 PUBLIC_* 替换为空串）
const SERVER_URL =
  (import.meta.env.PUBLIC_WALINE_SERVER ?? "").trim() ||
  "https://comments.neutronstar.fun";

interface WalineInstanceLike {
  update?: (options?: Record<string, unknown>) => void;
  destroy?: () => void;
}

interface Props {
  /** 评论线程唯一标识（页面路径），如 /posts/luoshenfu */
  path: string;
  /** 非嵌入模式下显示的区块标题，默认「评论」 */
  title?: string;
  /** 嵌入说说/相册展开卡时为 true：不渲染外层玻璃卡与大标题，更紧凑 */
  embedded?: boolean;
  /** 每页条数，默认 10 */
  pageSize?: number;
  className?: string;
}

const MessageCircleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="kirameku-waline__title-icon"
  >
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </svg>
);

export default function WalineComments({
  path,
  title = "评论",
  embedded = false,
  pageSize = 10,
  className = "",
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let instance: WalineInstanceLike | null = null;
    let cancelled = false;

    (async () => {
      const { init } = await import("@waline/client/full");
      if (cancelled || !mountRef.current) return;
      instance = init({
        el: mountRef.current,
        serverURL: SERVER_URL,
        path,
        lang: "zh-CN",
        dark: "html.dark",
        comment: true,
        // 文章浏览量已由后端统计，避免 Waline 重复计数
        pageview: false,
        meta: ["nick", "mail", "link"],
        requiredMeta: [],
        login: "enable",
        pageSize,
        // 评论图片上传暂未接对象存储（R2），先关闭入口，避免上传失败
        imageUploader: false,
        search: false,
        // 用 gcore.jsdelivr（国内可达、带 CORS），避免 unpkg 被墙/协议头在 http 预览下变 http
        emoji: ["https://gcore.jsdelivr.net/npm/@waline/emojis@1.1.0/weibo"],
        locale: {
          placeholder: "写下你的评论…（支持 Markdown，Ctrl/⌘ + Enter 发送）",
          sofa: "还没有评论，来抢沙发吧～",
        },
      }) as WalineInstanceLike | null;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      instance?.destroy?.();
      instance = null;
    };
  }, [path, pageSize]);

  if (embedded) {
    return (
      <div className={`kirameku-waline is-embedded ${className}`.trim()}>
        <div ref={mountRef} />
        {!ready && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`kirameku-waline rounded-3xl bg-white/60 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-2xl px-4 sm:px-6 md:px-8 py-5 sm:py-7 ${className}`.trim()}
    >
      <h2 className="kirameku-waline__title">
        <MessageCircleIcon />
        {title}
      </h2>
      <div ref={mountRef} />
      {!ready && (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
