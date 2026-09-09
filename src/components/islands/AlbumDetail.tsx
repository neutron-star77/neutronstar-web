import { useEffect, useState, useRef, useCallback } from "react";
import type { AlbumData } from "../../data/albums";

export default function AlbumDetail({ album }: { album: AlbumData }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = album.photos.length;
  const touchX = useRef(0);

  const close = useCallback(() => setActiveIndex(null), []);
  const prev = useCallback(
    () => setActiveIndex((i) => (i === null ? null : (i - 1 + total) % total)),
    [total]
  );
  const next = useCallback(
    () => setActiveIndex((i) => (i === null ? null : (i + 1) % total)),
    [total]
  );

  // 键盘导航：Esc 关闭，← / → 左右切换（循环）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeIndex === null) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, close, prev, next]);

  // 打开灯箱时锁定背景滚动
  useEffect(() => {
    document.body.style.overflow = activeIndex !== null ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeIndex]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (activeIndex === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) {
      if (dx > 0) prev();
      else next();
    }
  };

  const active = activeIndex === null ? null : album.photos[activeIndex];

  return (
    <>
      <p class="mb-4 text-sm text-on-surface-variant">
        共 {total} 张 · 点击放大，← / → 切换，Esc 关闭
      </p>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {album.photos.map((p, i) => (
          <button
            key={p.url}
            onClick={() => setActiveIndex(i)}
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
          onClick={close}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          role="dialog"
          aria-modal="true"
        >
          {/* 左箭头 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            class="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
            aria-label="上一张"
          >
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <img
            src={active.url}
            alt={`${album.title} ${active.index}`}
            class="lightbox-img max-h-[90vh] max-w-[90vw] rounded-m3 object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* 右箭头 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            class="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
            aria-label="下一张"
          >
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          {/* 页码 */}
          <div class="absolute bottom-4 left-0 right-0 text-center text-sm text-white/60">
            {activeIndex! + 1} / {total}
          </div>
        </div>
      )}
    </>
  );
}
