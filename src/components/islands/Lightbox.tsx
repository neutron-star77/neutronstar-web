/**
 * Lightbox —— 可复用灯箱（MomentsList / AlbumGrid 共用）。
 * 特性：spring 缩放进场 + 键盘(Esc 关 / ← 上一张 / → 下一张) + 移动端左右滑动 + 打开锁背景滚动。
 * 改动画手感：调内部图片 motion.div 的 transition（spring stiffness/damping）。
 */
import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

export interface LightboxPhoto {
  id: string;
  url: string;
  caption?: string;
}

interface LightboxProps {
  photos: LightboxPhoto[];
  index: number;
  open: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function Lightbox({
  photos,
  index,
  open,
  onClose,
  onPrev,
  onNext,
}: LightboxProps) {
  const photo = photos[index];

  // 键盘导航：打开时监听全局 keydown
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      }
    },
    [open, onClose, onPrev, onNext]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // 打开时禁止背景滚动，关闭/卸载恢复
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && photo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center touch-none"
          onClick={onClose}
          // 触摸：记录起点 x，松手时按横向位移 >40px 切上/下一张
          onTouchStart={(e) => {
            (e.currentTarget as HTMLElement).dataset.sx = String(
              e.touches[0].clientX
            );
          }}
          onTouchEnd={(e) => {
            const sx = Number(
              (e.currentTarget as HTMLElement).dataset.sx || 0
            );
            const dx = e.changedTouches[0].clientX - sx;
            if (Math.abs(dx) > 40) {
              if (dx > 0) onPrev();
              else onNext();
            }
          }}
        >
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="关闭"
          >
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
              className="absolute left-4 z-10 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
              aria-label="上一张"
            >
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}

          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              className="absolute right-4 z-10 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
              aria-label="下一张"
            >
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}

          {/* 图片本体：spring 缩放进场（手感调这里） */}
          <motion.div
            key={photo.id}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative z-10 max-w-[90vw] max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photo.url}
              alt={photo.caption || "照片"}
              className="max-h-[85vh] w-auto rounded-lg object-contain shadow-2xl"
            />
            {photo.caption && (
              <div className="absolute -bottom-10 left-0 right-0 text-center">
                <span className="text-sm font-serif italic text-white/70">
                  {photo.caption}
                </span>
              </div>
            )}
          </motion.div>

          {photos.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 z-10 text-center text-sm text-white/50">
              {index + 1} / {photos.length}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
