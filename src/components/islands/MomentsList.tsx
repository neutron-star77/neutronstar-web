import { useChatters } from "../../lib/api/hooks";
import { API_BASE_URL } from "../../lib/api/client";
import type { Chatter } from "../../lib/api/types";

function imgUrl(path: string, w = 400) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}/img${path.startsWith("/") ? "" : "/"}${path}?w=${w}`;
}

export default function MomentsList() {
  const { data, isLoading, error } = useChatters({ page: 1, size: 20 });

  return (
    <div>
      {isLoading && <p className="text-sm text-on-surface-variant">加载中…</p>}
      {error && <p className="text-sm text-on-surface-variant">加载失败，请刷新</p>}
      {!isLoading && data?.length === 0 && (
        <p className="text-sm text-on-surface-variant">还没有动态。</p>
      )}

      <div className="space-y-3">
        {data?.map((c: Chatter, i) => (
          <article
            key={c.id}
            className="fade-up rounded-m3 bg-surface-container p-4"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface">
              {c.content}
            </p>
            {c.images?.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {c.images.map((src, i) => (
                  <img
                    key={i}
                    src={imgUrl(src, 400)}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full rounded-m3 object-cover"
                  />
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-on-surface-variant">
              {c.mood && <span>{c.mood}</span>}
              <span>{c.created_at.slice(0, 10)}</span>
              <span>· {c.likes} ♥</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
