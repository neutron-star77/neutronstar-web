import { useEffect, useState } from "react";
import { usePosts } from "../../lib/api/hooks";
import { useRealtimeRefresh } from "../../lib/realtime";
import { API_BASE_URL } from "../../lib/api/client";
import type { PostSummary } from "../../lib/api/types";

function imgUrl(path: string, w = 240) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}/img${path.startsWith("/") ? "" : "/"}${path}?w=${w}`;
}

const SIZE = 9;

export default function PostList() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = usePosts({ page, size: SIZE });
  const [items, setItems] = useState<PostSummary[]>([]);

  // P4 实时：后台发文 → BFF 广播 posts 频道 → 本列表自动重拉
  useRealtimeRefresh(["posts"]);

  useEffect(() => {
    if (!data) return;
    setItems((prev) => (page === 1 ? data : [...prev, ...data]));
  }, [data, page]);

  const hasMore = data ? data.length === SIZE : false;

  return (
    <div>
      {isLoading && page === 1 && <p className="text-sm text-on-surface-variant">加载中…</p>}
      {error && <p className="text-sm text-on-surface-variant">加载失败，请刷新</p>}
      {!isLoading && items.length === 0 && (
        <p className="text-sm text-on-surface-variant">还没有文章。</p>
      )}

      <div className="space-y-3">
        {items.map((p, i) => (
          <a
            key={p.id}
            href={`/posts/${encodeURIComponent(p.slug)}`}
            className="post-card fade-up group flex gap-4 rounded-m3 bg-surface-container p-4 transition-transform hover:-translate-y-1 hover:bg-surface-container-high"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            {p.cover && (
              <img
                src={imgUrl(p.cover, 240)}
                alt={p.title}
                loading="lazy"
                className="post-card__cover h-20 w-28 shrink-0 rounded-m3 object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                {p.category || "ARTICLE"}
              </p>
              <h3 className="text-lg font-semibold text-on-surface">{p.title}</h3>
              {p.description && (
                <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
                  {p.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                <span>{p.published_at.slice(0, 10)}</span>
                {p.category && <span>· {p.category}</span>}
                <span>· {p.views} views</span>
                {p.tags?.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-secondary-container px-2 py-0.5 text-on-surface"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </a>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={isLoading}
          className="mt-6 rounded-full bg-secondary-container px-5 py-2 text-sm font-medium text-on-surface transition-opacity disabled:opacity-50"
        >
          {isLoading ? "加载中…" : "加载更多"}
        </button>
      )}
    </div>
  );
}
