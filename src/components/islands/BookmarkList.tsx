import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../../lib/api/client";
import { useRealtimeRefresh } from "../../lib/realtime";
import type { BookmarkCategory } from "../../lib/api/types";

function favicon(site: { url: string; icon: string }) {
  if (site.icon && !site.icon.startsWith("http") && !site.icon.startsWith("https")) {
    return site.icon;
  }
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    new URL(site.url.startsWith("http") ? site.url : `https://${site.url}`).hostname,
  )}&sz=64`;
}

export default function BookmarkList() {
  const [categories, setCategories] = useState<BookmarkCategory[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    apiGet<BookmarkCategory[]>("/api/bookmarks")
      .then(setCategories)
      .catch(() => setError(true));
  }, []);

  useEffect(load, [load]);

  // P4 实时：后台增删收藏夹分类/站点 → 广播 bookmarks 频道 → 重拉
  useRealtimeRefresh(["bookmarks"], load);

  if (error) return <p className="text-sm text-on-surface-variant">收藏夹暂时无法加载。</p>;
  if (!categories.length) return <p className="text-sm text-on-surface-variant">暂时还没有收藏夹内容。</p>;

  const groups = categories.filter((c) => c.sites.length > 0);
  if (!groups.length) return <p className="text-sm text-on-surface-variant">收藏夹还没有站点。</p>;

  return (
    <div className="space-y-8">
      {groups.map((category, catIndex) => (
        <section
          key={category.id}
          className="fade-up"
          style={{ animationDelay: `${catIndex * 60}ms` }}
        >
          <header className="mb-4 flex items-baseline gap-3">
            <span className="text-inherit">{category.icon || "✦"}</span>
            <h2 className="text-lg font-bold text-on-surface">{category.name}</h2>
            {category.description && (
              <span className="text-xs text-on-surface-variant">{category.description}</span>
            )}
          </header>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {category.sites.map((site) => (
              <a
                key={site.id}
                href={site.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-center gap-3 rounded-m3 bg-surface-container p-4 shadow-elevation-1 transition hover:-translate-y-1 hover:shadow-elevation-2"
              >
                <img
                  src={favicon(site)}
                  alt=""
                  width="40"
                  height="40"
                  loading="lazy"
                  className="h-10 w-10 shrink-0 rounded-full bg-surface object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-on-surface">
                    {site.name}
                  </span>
                  {site.description && (
                    <span className="block truncate text-xs text-on-surface-variant">
                      {site.description}
                    </span>
                  )}
                </span>
                <span className="text-primary opacity-0 transition group-hover:opacity-100">↗</span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}