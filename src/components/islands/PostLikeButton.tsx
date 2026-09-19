/**
 * PostLikeButton —— 文章点赞按钮（Kirameku 同款心形）。
 *
 * 统一点赞接口：POST /api/likes/toggle {target_type:"post", target_id}；
 * 我的点赞：GET /api/likes/mine?target_type=post（BFF 对带凭据请求已绕缓存）。
 * 未登录点击跳 GitHub 登录。
 */

import { useEffect, useState } from "react";
import useSWR from "swr";
import { apiGet, apiPost, ApiError } from "../../lib/api/client";
import { useGithubUser, loginUrl } from "../../lib/auth";

export default function PostLikeButton({
  postId,
  initialLikes,
}: {
  postId: number;
  initialLikes: number;
}) {
  const { user } = useGithubUser();
  const isLogged = !!user;
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialLikes);

  const { data: mine } = useSWR(
    isLogged ? ["likes-mine", "post"] : null,
    () => apiGet<{ ids: number[] }>("/api/likes/mine?target_type=post"),
    { revalidateOnFocus: false }
  );
  useEffect(() => {
    if (mine?.ids) setLiked(mine.ids.includes(postId));
  }, [mine, postId]);

  async function toggle() {
    if (!isLogged) {
      window.location.href = loginUrl();
      return;
    }
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    try {
      const res = await apiPost<{ likes: number }>("/api/likes/toggle", {
        target_type: "post",
        target_id: postId,
      });
      setCount(res.likes);
    } catch (err) {
      setLiked(wasLiked);
      setCount((c) => c + (wasLiked ? 1 : -1));
      if (err instanceof ApiError && err.status === 401) window.location.href = loginUrl();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex items-center gap-1 sm:gap-1.5 transition-colors ${
        liked ? "text-pink-500" : "text-slate-500 dark:text-slate-400 hover:text-pink-500"
      }`}
      title="点赞"
    >
      <svg
        viewBox="0 0 24 24"
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-all duration-300 ${liked ? "fill-pink-500 scale-110" : ""}`}
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
      {count} 个点赞
    </button>
  );
}
