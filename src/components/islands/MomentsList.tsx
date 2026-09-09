import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useChatters } from "../../lib/api/hooks";
import { API_BASE_URL } from "../../lib/api/client";
import type { Chatter } from "../../lib/api/types";
import { spring, stackRotations } from "../../lib/variants";
import Lightbox, { type LightboxPhoto } from "./Lightbox";

function imgUrl(path: string, w = 400) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}/img${path.startsWith("/") ? "" : "/"}${path}?w=${w}`;
}

function formatDate(d: string) {
  const dt = new Date(d);
  return `${dt.getMonth() + 1}月${dt.getDate()}日`;
}

function relativeTime(d: string) {
  const now = new Date();
  const dt = new Date(d);
  const diff = now.getTime() - dt.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const days = Math.floor(h / 24);
  if (days < 3) return `${days}天前`;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export default function MomentsList() {
  const { data, isLoading, error } = useChatters({ page: 1, size: 30 });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [onlyViewId, setOnlyViewId] = useState<number | null>(null);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [lightbox, setLightbox] = useState<{ photos: LightboxPhoto[]; index: number } | null>(null);

  const moments: Chatter[] = data ?? [];

  const dayGroups = useMemo(() => {
    const map = new Map<string, Chatter[]>();
    for (const m of moments) {
      const key = m.created_at.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      date: key,
      label: formatDate(items[0].created_at),
      moments: items,
    }));
  }, [moments]);

  const visibleGroups =
    onlyViewId != null
      ? dayGroups
          .map((g) => ({
            ...g,
            moments: g.moments.filter((m) => m.id === onlyViewId),
          }))
          .filter((g) => g.moments.length > 0)
      : dayGroups;

  function toggleLike(id: number) {
    setLikedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="max-w-2xl">
      {isLoading && <p className="text-sm text-on-surface-variant">加载中…</p>}
      {error && <p className="text-sm text-on-surface-variant">加载失败，请刷新</p>}
      {!isLoading && moments.length === 0 && (
        <p className="text-sm text-on-surface-variant">还没有动态。</p>
      )}

      {onlyViewId != null && (
        <button
          type="button"
          onClick={() => setOnlyViewId(null)}
          className="mb-4 text-sm text-primary transition-colors hover:underline"
        >
          ← 返回全部
        </button>
      )}

      {visibleGroups.map((group, groupIdx) => (
        <motion.div
          key={group.date}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: groupIdx * 0.1 }}
          className="mb-10 last:mb-0"
        >
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm font-bold text-on-surface">{group.label}</span>
            <span className="text-xs text-on-surface-variant">
              {group.moments.length} 条
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-outline to-transparent" />
          </div>

          <div
            className="relative"
            style={{
              minHeight:
                group.moments.length > 1 ? 100 + (group.moments.length - 1) * 18 : "auto",
            }}
          >
            {group.moments.map((moment, i) => {
              const rot = stackRotations[i % stackRotations.length];
              const offsetX = i % 2 === 0 ? -4 : 4;
              const isExpanded = expandedId === moment.id;
              const isLiked = likedIds.has(moment.id);
              const hasImages = moment.images && moment.images.length > 0;
              const likeCount = moment.likes + (isLiked ? 1 : 0);

              const photos: LightboxPhoto[] = (moment.images ?? []).map((url, pi) => ({
                id: `${moment.id}-${pi}`,
                url: imgUrl(url, 1200),
                caption: "",
              }));

              return (
                <motion.div
                  key={moment.id}
                  layout
                  ref={(el) => {
                    if (isExpanded && el)
                      setTimeout(
                        () => el.scrollIntoView({ behavior: "smooth", block: "nearest" }),
                        100
                      );
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    rotate: isExpanded || onlyViewId != null ? 0 : rot,
                    x: isExpanded || onlyViewId != null ? 0 : offsetX,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                    delay: i * 0.05,
                  }}
                  whileHover={
                    !isExpanded && onlyViewId == null
                      ? { rotate: 0, x: 0, y: -4, scale: 1.01 }
                      : undefined
                  }
                  onClick={() => setExpandedId(isExpanded ? null : moment.id)}
                  className={`${
                    group.moments.length > 1 && onlyViewId == null
                      ? "absolute left-0 right-0"
                      : "relative"
                  } cursor-pointer`}
                  style={{
                    zIndex: isExpanded ? 50 : group.moments.length - i,
                    ...(group.moments.length > 1 && onlyViewId == null
                      ? { top: i * 18 }
                      : {}),
                  }}
                >
                  <div className="overflow-hidden rounded-m3 border border-outline/40 bg-surface-container shadow-lg backdrop-blur-xl transition-shadow duration-300 hover:shadow-xl">
                    {!isExpanded && onlyViewId == null && (
                      <div className="px-4 py-3">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-xs text-on-surface-variant">
                            {relativeTime(moment.created_at)}
                          </span>
                          {moment.mood && (
                            <span className="text-xs">{moment.mood}</span>
                          )}
                          {hasImages && (
                            <span className="text-xs text-on-surface-variant">📷</span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-sm leading-relaxed text-on-surface">
                          {moment.content}
                        </p>
                      </div>
                    )}

                    {(isExpanded || onlyViewId != null) && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="p-4">
                          <div className="mb-3 flex items-center gap-2">
                            <span className="text-sm font-semibold text-on-surface">
                              Starhiro
                            </span>
                            <span className="text-xs text-on-surface-variant">
                              {relativeTime(moment.created_at)}
                            </span>
                            {moment.mood && (
                              <span className="rounded-full bg-secondary-container px-2 py-0.5 text-xs text-on-surface">
                                {moment.mood}
                              </span>
                            )}
                          </div>

                          <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-on-surface">
                            {moment.content}
                          </p>

                          {hasImages && (
                            <div
                              className={`mb-4 grid gap-2 ${
                                moment.images.length <= 2
                                  ? "grid-cols-2"
                                  : "grid-cols-3"
                              }`}
                            >
                              {moment.images.map((img, idx) => (
                                <div
                                  key={idx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightbox({ photos, index: idx });
                                  }}
                                  className="group/img relative aspect-square cursor-pointer overflow-hidden rounded-xl"
                                >
                                  <img
                                    src={imgUrl(img, 600)}
                                    alt=""
                                    loading="lazy"
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between border-t border-outline/40 pt-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLike(moment.id);
                              }}
                              className={`flex items-center gap-1.5 text-xs transition-colors ${
                                isLiked
                                  ? "text-pink-500"
                                  : "text-on-surface-variant hover:text-pink-500"
                              }`}
                            >
                              <svg
                                className={`h-4 w-4 transition-all duration-300 ${
                                  isLiked ? "scale-110 fill-pink-500" : ""
                                }`}
                                viewBox="0 0 24 24"
                                fill={isLiked ? "currentColor" : "none"}
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
                              </svg>
                              <span>{likeCount}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOnlyViewId(onlyViewId === moment.id ? null : moment.id);
                              }}
                              className="rounded-full bg-primary-container px-3 py-1 text-xs text-on-primary-container transition-colors hover:bg-primary/20"
                            >
                              {onlyViewId === moment.id ? "返回全部" : "只看这条"}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ))}

      <AnimatePresence>
        {expandedId != null && onlyViewId == null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpandedId(null)}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <Lightbox
        photos={lightbox?.photos ?? []}
        index={lightbox?.index ?? 0}
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        onPrev={() =>
          setLightbox((lb) =>
            lb ? { ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length } : null
          )
        }
        onNext={() =>
          setLightbox((lb) =>
            lb ? { ...lb, index: (lb.index + 1) % lb.photos.length } : null
          )
        }
      />
    </div>
  );
}
