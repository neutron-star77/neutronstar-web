/**
 * CommentsThread —— 评论线程（P5）。
 *
 * 两种数据源（后端已存在两套评论表，这里用适配器统一）：
 *  - kind="chatter"：说说专用表 → `GET /api/chatters/{id}/comments`、`POST /api/chatters/comments`
 *  - kind="post"   ：多态通用表 → `GET /api/comments?target_type=post&target_id=`、`POST /api/comments`
 *
 * 点赞统一走 `/api/likes/toggle`（真值在 likes 表，用户维度去重）：
 *  - 说说评论 → target_type="chatter_comment"
 *  - 文章评论 → target_type="comment"
 *
 * 登录：发评论/点赞/删除都要求 GitHub 登录（未登录时后端 401，这里直接给登录入口）。
 *
 * 二次开发提示：
 *  - 要给相册加评论：后端多态表已支持 `target_type="album"`，在这里加一个 adapter 分支即可。
 *  - 楼中楼目前只做两层（回复根评论），更深的回复会挂到同一条根下。
 */

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { API_BASE_URL, apiGet, apiPost, ApiError } from "../../lib/api/client";
import { getToken, loginUrl } from "../../lib/auth";
import { useRealtimeRefresh } from "../../lib/realtime";

type Kind = "chatter" | "post";

interface Author {
  id: number;
  login: string;
  avatar: string;
}

interface CommentNode {
  id: number;
  content: string;
  likes: number;
  status: string;
  created_at: string;
  parent_id: number | null;
  github_user: Author | null;
  replies?: CommentNode[];
}

interface Adapter {
  /** SWR 请求键（同时用于实时重校验的 key 前缀） */
  key: (targetId: number) => [string, Kind, number];
  listUrl: (targetId: number) => string;
  createUrl: string;
  createBody: (targetId: number, content: string, parentId: number | null) => Record<string, unknown>;
  deleteUrl: (commentId: number) => string;
  likeTarget: string;
}

const ADAPTERS: Record<Kind, Adapter> = {
  chatter: {
    key: (id) => ["comments", "chatter", id],
    listUrl: (id) => `/api/chatters/${id}/comments`,
    createUrl: "/api/chatters/comments",
    createBody: (id, content, parentId) => ({
      chatter_id: id,
      parent_id: parentId,
      content,
    }),
    deleteUrl: (commentId) => `/api/chatters/comments/${commentId}`,
    likeTarget: "chatter_comment",
  },
  post: {
    key: (id) => ["comments", "post", id],
    listUrl: (id) => `/api/comments?target_type=post&target_id=${id}`,
    createUrl: "/api/comments",
    createBody: (id, content, parentId) => ({
      target_type: "post",
      target_id: id,
      parent_id: parentId,
      content,
    }),
    deleteUrl: (commentId) => `/api/comments/${commentId}`,
    likeTarget: "comment",
  },
};

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}天前`;
  return new Date(value).toLocaleDateString("zh-CN");
}

interface Props {
  kind: Kind;
  targetId: number;
  className?: string;
}

export default function CommentsThread({ kind, targetId, className = "" }: Props) {
  const adapter = ADAPTERS[kind];
  const [token, setTokenState] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<CommentNode | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setTokenState(getToken());
  }, []);

  const { data, isLoading, mutate } = useSWR<CommentNode[]>(
    adapter.key(targetId),
    () => apiGet<CommentNode[]>(adapter.listUrl(targetId)),
    { revalidateOnFocus: false },
  );

  // 实时：评论/说说/文章任一变更 → 重拉本线程
  useRealtimeRefresh(["comments", "chatters", "posts"], () => {
    void mutate();
  });

  // 回填"我的点赞态"
  useEffect(() => {
    if (!token) {
      setLikedIds(new Set());
      return;
    }
    let alive = true;
    apiGet<{ ids: number[] }>(`/api/likes/mine?target_type=${adapter.likeTarget}`)
      .then((res) => {
        if (alive) setLikedIds(new Set(res?.ids ?? []));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [token, adapter.likeTarget]);

  const total = useMemo(() => {
    const count = (nodes: CommentNode[]): number =>
      nodes.reduce((sum, n) => sum + 1 + count(n.replies ?? []), 0);
    return count(data ?? []);
  }, [data]);

  async function submit() {
    const text = content.trim();
    if (!text) return;
    if (!token) {
      setNotice("请先用 GitHub 登录");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      await apiPost(adapter.createUrl, adapter.createBody(targetId, text, replyTo?.id ?? null));
      setContent("");
      setReplyTo(null);
      await mutate();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setNotice("登录态已失效，请重新登录");
        setTokenState(null);
      } else {
        setNotice("发送失败，请稍后再试");
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleLike(node: CommentNode) {
    if (!token) {
      setNotice("点赞需要先登录 GitHub");
      return;
    }
    const wasLiked = likedIds.has(node.id);
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
    try {
      await apiPost("/api/likes/toggle", { target_type: adapter.likeTarget, target_id: node.id });
      await mutate();
    } catch {
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(node.id);
        else next.delete(node.id);
        return next;
      });
    }
  }

  async function remove(node: CommentNode) {
    try {
      const res = await fetch(`${API_BASE_URL}${adapter.deleteUrl(node.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
      });
      if (!res.ok) throw new Error(String(res.status));
      setNotice("");
      await mutate();
    } catch {
      setNotice("删除失败（只能删除自己的评论）");
    }
  }

  function renderNode(node: CommentNode, depth = 0) {
    const liked = likedIds.has(node.id);
    return (
      <li key={node.id} className={depth > 0 ? "mt-3 border-l border-outline/30 pl-3" : "mt-4"}>
        <div className="flex items-start gap-2">
          {node.github_user?.avatar ? (
            <img
              src={node.github_user.avatar}
              alt=""
              width="28"
              height="28"
              loading="lazy"
              className="mt-0.5 h-7 w-7 shrink-0 rounded-full"
            />
          ) : (
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-container-high text-xs">
              ?
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
              <strong className="text-on-surface">
                {node.github_user?.login ?? "匿名"}
              </strong>
              <time dateTime={node.created_at}>{relativeTime(node.created_at)}</time>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-on-surface">
              {node.content}
            </p>
            <div className="mt-1 flex items-center gap-4 text-xs">
              <button
                type="button"
                onClick={() => void toggleLike(node)}
                className={`transition-colors ${liked ? "text-pink-500" : "text-on-surface-variant hover:text-pink-500"}`}
              >
                ♡ {node.likes}
              </button>
              {depth === 0 && (
                <button
                  type="button"
                  onClick={() => setReplyTo(node)}
                  className="text-on-surface-variant hover:text-primary"
                >
                  回复
                </button>
              )}
              {token && (
                <button
                  type="button"
                  onClick={() => void remove(node)}
                  className="text-on-surface-variant hover:text-error"
                >
                  删除
                </button>
              )}
            </div>
          </div>
        </div>
        {node.replies && node.replies.length > 0 && (
          <ul>{node.replies.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    );
  }

  return (
    <section className={`mt-5 border-t border-outline/30 pt-4 ${className}`}>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
        评论 {total > 0 && <span className="text-on-surface-variant">({total})</span>}
      </h4>

      {isLoading && <p className="text-xs text-on-surface-variant">评论加载中…</p>}
      {!isLoading && total === 0 && (
        <p className="text-xs text-on-surface-variant">还没有评论，来抢沙发。</p>
      )}

      <ul>{data?.map((node) => renderNode(node))}</ul>

      <div className="mt-4">
        {token ? (
          <>
            {replyTo && (
              <p className="mb-1 text-xs text-on-surface-variant">
                回复 @{replyTo.github_user?.login ?? "匿名"}{" "}
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="underline hover:text-primary"
                >
                  取消
                </button>
              </p>
            )}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="说点什么…（GitHub 账号登录后发布）"
              className="w-full resize-y rounded-m3 bg-surface-container p-3 text-sm text-on-surface outline-none focus:bg-surface-container-high"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">
                {notice || `${content.length}/2000`}
              </span>
              <button
                type="button"
                disabled={busy || !content.trim()}
                onClick={() => void submit()}
                className="rounded-full bg-secondary-container px-4 py-1.5 text-xs font-medium text-on-surface transition-opacity disabled:opacity-50"
              >
                {busy ? "发送中…" : "发布"}
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-on-surface-variant">
            <a href={loginUrl()} className="underline hover:text-primary">
              用 GitHub 登录
            </a>
            后即可评论、回复与点赞。
            {notice && <span className="ml-2 text-error">{notice}</span>}
          </p>
        )}
      </div>
    </section>
  );
}
