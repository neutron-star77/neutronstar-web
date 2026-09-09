import { useAlbums } from "../../lib/api/hooks";
import { API_BASE_URL } from "../../lib/api/client";
import type { Album } from "../../lib/api/types";

function imgUrl(path: string, w = 600) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}/img${path.startsWith("/") ? "" : "/"}${path}?w=${w}`;
}

export default function AlbumGrid() {
  const { data, isLoading, error } = useAlbums();

  return (
    <div>
      {isLoading && <p className="text-sm text-on-surface-variant">加载中…</p>}
      {error && <p className="text-sm text-on-surface-variant">加载失败，请刷新</p>}
      {!isLoading && data?.length === 0 && (
        <p className="text-sm text-on-surface-variant">还没有相册。</p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {data?.map((a: Album) => (
          <div
            key={a.id}
            className="group overflow-hidden rounded-m3 bg-surface-container transition-transform hover:-translate-y-0.5"
          >
            {a.cover ? (
              <img
                src={imgUrl(a.cover, 600)}
                alt={a.title}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="aspect-[4/3] w-full bg-surface-container-high" />
            )}
            <div className="p-3">
              <h3 className="font-medium text-on-surface">{a.title}</h3>
              {a.description && (
                <p className="mt-1 line-clamp-1 text-xs text-on-surface-variant">
                  {a.description}
                </p>
              )}
              <p className="mt-1 text-xs text-on-surface-variant">{a.photo_count} photos</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
