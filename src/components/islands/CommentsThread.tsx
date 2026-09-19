/**
 * CommentsThread —— 多态评论区 React island（Kirameku 玻璃风）。
 *
 * 一套 UI 适配三种评论对象：
 *   - post    文章评论：/api/comments（统一多态，target_type=post，点赞 target_type=comment）
 *   - chatter 说说评论：/api/chatters/comments（旧表适配器，target_type=chatter_comment）
 *   - album   相册评论：/api/comments（多态，target_type=album，点赞 target_type=comment）
 *
 * 后端返回结构（comment_service / chatter_service 一致）：
 *   { id, parent_id, content, likes, created_at,
 *     github_user: { id, login, avatar, bio } | null,
 *     replies: [...] }（仅两层，根评论带嵌套回复）
 *
 * 视觉 1:1 对齐 Xinghongia/Kirameku 的 components/posts/PostComments.tsx：
 *   玻璃卡、GitHub 登录卡、回复条、Ctrl+Enter 发送、回复折叠、点赞。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "motion/react";
import { apiGet, apiPost, apiDelete, ApiError } from "../../lib/api/client";
import { useGithubUser, loginUrl } from "../../lib/auth";
import { useRealtimeRefresh } from "../../lib/realtime";

type Kind = "chatter" | "post" | "album";

interface Props {
  kind: Kind;
  targetId: number;
  /** 嵌入说说展开卡时为 true：不渲染「评论」大标题、外层间距更紧凑 */
  embedded?: boolean;
  className?: string;
}

interface GitHubUserBrief {
  id: number;
  login: string;
  avatar: string;
  bio: string;
}

interface RawComment {
  id: number;
  parent_id?: number | null;
  content: string;
  likes?: number;
  created_at?: string;
  github_user?: GitHubUserBrief | null;
  replies?: RawComment[];
}

interface Comment {
  id: number;
  userId: number;
  userName: string;
  avatarUrl: string;
  bio: string;
  content: string;
  createdAt: string;
  likes: number;
  replies: Comment[];
  parentId: number | null;
}

interface Adapter {
  list: (targetId: number) => Promise<RawComment[]>;
  create: (targetId: number, content: string, parentId: number | null) => Promise<unknown>;
  remove: (commentId: number) => Promise<unknown>;
  /** 点赞的 target_type：统一评论表=comment，说说旧表=chatter_comment */
  likeTarget: string;
}

const ADAPTERS: Record<Kind, Adapter> = {
  post: {
    list: (id) => apiGet<RawComment[]>(`/api/comments?target_type=post&target_id=${id}&page=1&size=100`),
    create: (id, content, parentId) =>
      apiPost("/api/comments", { target_type: "post", target_id: id, parent_id: parentId, content }),
    remove: (commentId) => apiDelete(`/api/comments/${commentId}`),
    likeTarget: "comment",
  },
  album: {
    list: (id) => apiGet<RawComment[]>(`/api/comments?target_type=album&target_id=${id}&page=1&size=100`),
    create: (id, content, parentId) =>
      apiPost("/api/comments", { target_type: "album", target_id: id, parent_id: parentId, content }),
    remove: (commentId) => apiDelete(`/api/comments/${commentId}`),
    likeTarget: "comment",
  },
  chatter: {
    list: (id) => apiGet<RawComment[]>(`/api/chatters/${id}/comments`),
    create: (id, content, parentId) =>
      apiPost("/api/chatters/comments", { chatter_id: id, parent_id: parentId, content }),
    remove: (commentId) => apiDelete(`/api/chatters/comments/${commentId}`),
    likeTarget: "chatter_comment",
  },
};

function normalize(raw: RawComment): Comment {
  const replies = (raw.replies ?? []).map(normalize);
  const gh = raw.github_user ?? null;
  return {
    id: raw.id,
    userId: gh?.id ?? 0,
    userName: gh?.login ?? "匿名用户",
    avatarUrl: gh?.avatar ?? "",
    bio: gh?.bio ?? "",
    content: raw.content,
    createdAt: raw.created_at ?? "",
    likes: raw.likes ?? 0,
    replies,
    parentId: raw.parent_id ?? null,
  };
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

const GitHubMark = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const Icon = {
  MessageCircle: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  ),
  Heart: ({ className, filled }: { className?: string; filled?: boolean }) => (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  ),
  Reply: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  ),
  ChevronDown: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  ChevronUp: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  ),
  Trash: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
};

function Avatar({ name, url, size = "w-9 h-9" }: { name: string; url: string; size?: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        onError={() => setFailed(true)}
        className={`${size} rounded-full object-cover ring-2 ring-white/50 dark:ring-white/10 shrink-0`}
      />
    );
  }
  return (
    <div className={`${size} rounded-full shrink-0 flex items-center justify-center bg-gradient-to-br from-sky-400 to-indigo-500 text-white font-bold text-sm`}>
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

function CommentCard({
  comment,
  depth,
  userNameMap,
  currentUserId,
  likedIds,
  likeCounts,
  onToggleLike,
  onReply,
  onDelete,
}: {
  comment: Comment;
  depth: number;
  userNameMap: Map<number, string>;
  currentUserId: number | null;
  likedIds: Set<number>;
  likeCounts: Record<number, number>;
  onToggleLike: (id: number) => void;
  onReply: (comment: Comment) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const liked = likedIds.has(comment.id);
  const likeCount = likeCounts[comment.id] ?? comment.likes;
  const canDelete = currentUserId !== null && currentUserId === comment.userId;
  const parentName = comment.parentId ? userNameMap.get(comment.parentId) : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl bg-white/50 dark:bg-slate-800/60 backdrop-blur-xl border border-white/30 dark:border-white/10 p-4 ${depth > 0 ? "bg-white/30 dark:bg-slate-800/40" : ""}`}
    >
      <div className="flex items-start gap-3">
        <Avatar name={comment.userName} url={comment.avatarUrl} size={depth > 0 ? "w-7 h-7" : "w-9 h-9"} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{comment.userName}</span>
            {comment.bio && <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[12rem]">{comment.bio}</span>}
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto shrink-0">{timeAgo(comment.createdAt)}</span>
          </div>

          <p className="text-slate-700 dark:text-slate-200 mt-1.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
            {depth > 0 && parentName && (
              <span className="text-sky-500 font-medium mr-1">回复 @{parentName}：</span>
            )}
            {comment.content}
          </p>

          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={() => onToggleLike(comment.id)}
              className={`flex items-center gap-1 text-xs transition-colors ${liked ? "text-pink-500" : "text-slate-500 dark:text-slate-400 hover:text-pink-500"}`}
            >
              <Icon.Heart className={`w-3.5 h-3.5 ${liked ? "fill-pink-500" : ""}`} />
              {likeCount > 0 ? likeCount : "赞"}
            </button>
            <button
              type="button"
              onClick={() => onReply(comment)}
              className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-sky-500 transition-colors"
            >
              <Icon.Reply className="w-3.5 h-3.5" />
              回复
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors ml-auto"
                title="删除评论"
              >
                <Icon.Trash className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {comment.replies.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-600 transition-colors"
              >
                {expanded ? <Icon.ChevronUp className="w-3.5 h-3.5" /> : <Icon.ChevronDown className="w-3.5 h-3.5" />}
                {comment.replies.length} 条回复
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-4 md:ml-8 mt-3 space-y-2">
                      {comment.replies.map((reply) => (
                        <CommentCard
                          key={reply.id}
                          comment={reply}
                          depth={depth + 1}
                          userNameMap={userNameMap}
                          currentUserId={currentUserId}
                          likedIds={likedIds}
                          likeCounts={likeCounts}
                          onToggleLike={onToggleLike}
                          onReply={onReply}
                          onDelete={onDelete}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function CommentsThread({ kind, targetId, embedded = false, className = "" }: Props) {
  const adapter = ADAPTERS[kind];
  const { user } = useGithubUser();
  const isLogged = !!user;
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const swrKey = ["comments", kind, targetId] as const;
  const { data: rawComments, isLoading, mutate } = useSWR(swrKey, () => adapter.list(targetId), {
    revalidateOnFocus: false,
  });
  useRealtimeRefresh(["comments"]);

  const comments = useMemo(() => (rawComments ?? []).map(normalize), [rawComments]);

  const userNameMap = useMemo(() => {
    const map = new Map<number, string>();
    const walk = (list: Comment[]) => {
      list.forEach((c) => {
        map.set(c.id, c.userName);
        if (c.replies.length) walk(c.replies);
      });
    };
    walk(comments);
    return map;
  }, [comments]);

  useEffect(() => {
    setLikeCounts((prev) => {
      const next = { ...prev };
      const walk = (list: Comment[]) => {
        list.forEach((c) => {
          if (next[c.id] === undefined) next[c.id] = c.likes;
          if (c.replies.length) walk(c.replies);
        });
      };
      walk(comments);
      return next;
    });
  }, [comments]);

  const { data: mineData } = useSWR(
    isLogged ? ["likes-mine", adapter.likeTarget] : null,
    () => apiGet<{ ids: number[] }>(`/api/likes/mine?target_type=${adapter.likeTarget}`),
    { revalidateOnFocus: false }
  );
  useEffect(() => {
    if (mineData?.ids) setLikedIds(new Set(mineData.ids));
  }, [mineData]);

  async function handleSubmit() {
    const text = content.trim();
    if (!text || submitting) return;
    if (!isLogged) {
      window.location.href = loginUrl();
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await adapter.create(targetId, text, replyTo?.id ?? null);
      setContent("");
      setReplyTo(null);
      await mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "发送失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleLike(commentId: number) {
    if (!isLogged) {
      window.location.href = loginUrl();
      return;
    }
    const wasLiked = likedIds.has(commentId);
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
    setLikeCounts((prev) => ({ ...prev, [commentId]: Math.max(0, (prev[commentId] ?? 0) + (wasLiked ? -1 : 1)) }));
    try {
      await apiPost("/api/likes/toggle", { target_type: adapter.likeTarget, target_id: commentId });
      await mutate();
    } catch (err) {
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(commentId);
        else next.delete(commentId);
        return next;
      });
      await mutate();
      if (err instanceof ApiError && err.status === 401) window.location.href = loginUrl();
    }
  }

  async function handleDelete(commentId: number) {
    if (!window.confirm("确定删除这条评论吗？")) return;
    try {
      await adapter.remove(commentId);
      await mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除失败");
    }
  }

  function handleReply(comment: Comment) {
    if (!isLogged) {
      window.location.href = loginUrl();
      return;
    }
    setReplyTo(comment);
    textareaRef.current?.focus();
  }

  return (
    <div className={className}>
      {!embedded && (
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Icon.MessageCircle className="w-5 h-5 text-sky-500" />
          评论
        </h2>
      )}

      {!isLogged && (
        <div className="rounded-2xl bg-white/50 dark:bg-slate-800/60 backdrop-blur-xl border border-white/30 dark:border-white/10 p-6 flex flex-col items-center gap-3 mb-6">
          <a href={loginUrl()} className="group flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
              <GitHubMark className="w-5 h-5" />
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-sky-500 transition-colors">
              使用 GitHub 登录后评论
            </span>
          </a>
        </div>
      )}

      {isLogged && user && (
        <div className="rounded-2xl bg-white/50 dark:bg-slate-800/60 backdrop-blur-xl border border-white/30 dark:border-white/10 p-4 mb-6">
          <div className="flex items-start gap-3">
            <Avatar name={user.login} url={user.avatar} />
            <div className="flex-1">
              <AnimatePresence>
                {replyTo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-sky-500/10 rounded-lg px-3 py-1.5"
                  >
                    <Icon.Reply className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">回复 @{replyTo.userName}：{replyTo.content.slice(0, 30)}</span>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                    >
                      ✕
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
                placeholder="写下你的评论…（Ctrl+Enter 发送）"
                rows={3}
                className="w-full rounded-xl bg-white/60 dark:bg-slate-900/50 border border-white/40 dark:border-white/10 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-400">{error && <span className="text-red-500">{error}</span>}</span>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !content.trim()}
                  className="bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded-full transition-colors"
                >
                  {submitting ? "发送中…" : "发送"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-10">还没有评论，来抢沙发吧～</p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              depth={0}
              userNameMap={userNameMap}
              currentUserId={isLogged && user ? user.id : null}
              likedIds={likedIds}
              likeCounts={likeCounts}
              onToggleLike={handleToggleLike}
              onReply={handleReply}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
