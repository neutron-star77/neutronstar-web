import { usePosts, useChatters } from "../../lib/api/hooks";
import { useRealtimeRefresh } from "../../lib/realtime";

/**
 * 首页数据区：React island（client:visible 按需水合）。
 * Hero 仍是 Astro 静态渲染（零 JS 首屏），这里只负责真实数据。
 */
export default function HomeFeed() {
  const { data: posts, isLoading, error } = usePosts({ page: 1, size: 4 });
  const { data: chatters } = useChatters({ page: 1, size: 1 });

  // P4 实时：新文章/新说说 → 首页数据区自动重拉
  useRealtimeRefresh(["posts", "chatters", "albums"]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Latest Posts
        </h2>
        {isLoading && <p className="text-sm text-on-surface-variant">加载中…</p>}
        {error && <p className="text-sm text-on-surface-variant">加载失败，请刷新</p>}
        <div className="space-y-2">
          {posts?.map((p) => (
            <a
              key={p.id}
              href={`/posts/${encodeURIComponent(p.slug)}`}
              className="block rounded-m3 bg-surface-container p-4 transition-transform hover:-translate-y-0.5 hover:bg-surface-container-high"
            >
              <h3 className="font-medium text-on-surface">{p.title}</h3>
              {p.description && (
                <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
                  {p.description}
                </p>
              )}
              <div className="mt-2 text-xs text-on-surface-variant">
                {p.published_at.slice(0, 10)}
                {p.category && ` · ${p.category}`} · {p.views} views
              </div>
            </a>
          ))}
        </div>
      </section>

      {chatters?.[0] && (
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Latest Moment
          </h2>
          <div className="rounded-m3 bg-surface-container p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface">
              {chatters[0].content}
            </p>
            {chatters[0].mood && (
              <p className="mt-2 text-xs text-on-surface-variant">{chatters[0].mood}</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
