import { useEffect, useState } from "react";
import type { AlbumData } from "../../data/albums";

export default function AlbumDetail({ album }: { album: AlbumData }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <p className="mb-4 text-sm text-on-surface-variant">
        共 {album.photos.length} 张 · 点击放大，Esc 关闭
      </p>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {album.photos.map((p, i) => (
          <button
            key={p.url}
            onClick={() => setActive(p.url)}
            class="fade-up group overflow-hidden rounded-m3 bg-surface-container transition-transform hover:-translate-y-0.5"
            style={{ animationDelay: `${i * 22}ms` }}
          >
            <img
              src={p.url}
              alt={album.title}
              loading="lazy"
              class="aspect-[4/3] w-full object-cover"
            />
          </button>
        ))}
      </div>

      {active && (
        <div
          class="lightbox-backdrop fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-black/90 p-4"
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
        >
          <img
            src={active}
            alt=""
            class="lightbox-img max-h-[90vh] max-w-[90vw] rounded-m3 object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
