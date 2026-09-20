/**
 * MomentsList —— 说说页 React island（moments.astro，client:load）。
 *
 * 1:1 对齐 Xinghongia/Kirameku 的 app/moments/page.tsx：
 *  - 按天分组；同日多条便利贴 absolute 堆叠（rotations 倾斜 + 奇偶 x 偏移）
 *  - 弹簧动画（stiffness 300 / damping 25），hover 回正上浮
 *  - 点击展开（遮罩 fixed inset-0 bg-black/20 backdrop-blur-sm z-40）
 *  - 「只看这条」进入 onlyView：此时才挂载评论区（Waline，path=/moments/<id>）
 *  - 图片网格（≤2 张两列，否则三列）+ 灯箱（复用本地 Lightbox）
 */

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "motion/react";
import { apiGet, apiPost, ApiError } from "../../lib/api/client";
import { useGithubUser, loginUrl } from "../../lib/auth";
import { useRealtimeRefresh } from "../../lib/realtime";
import { stackRotations } from "../../lib/variants";
import type { Chatter } from "../../lib/api/types";
import Lightbox, { type LightboxPhoto } from "./Lightbox";
import WalineComments from "./WalineComments";

/* ── 图标 ── */
const Icon = {
  MessageSquare: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Heart: ({ className, filled }: { className?: string; filled?: boolean }) => (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  ),
  ChevronLeft: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  Camera: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  ),
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 3) return `${days} 天前`;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MomentsList() {
  const { user } = useGithubUser();
  const isLogged = !!user;
  const { data: moments, isLoading, mutate } = useSWR<Chatter[]>(
    ["chatters"],
    () => apiGet<Chatter[]>("/api/chatters?status=published&page=1&size=50"),
    { revalidateOnFocus: false }
  );
  useRealtimeRefresh(["chatters", "comments"]);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [onlyViewId, setOnlyViewId] = useState<number | null>(null);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [lightbox, setLightbox] = useState<{ photos: LightboxPhoto[]; index: number } | null>(null);

  // 我的说说点赞
  const { data: mineData } = useSWR(
    isLogged ? ["likes-mine", "chatter"] : null,
    () => apiGet<{ ids: number[] }>("/api/likes/mine?target_type=chatter"),
    { revalidateOnFocus: false }
  );
  useEffect(() => {
    if (mineData?.ids) setLikedIds(new Set(mineData.ids));
  }, [mineData]);
  useEffect(() => {
    if (moments) {
      setLikeCounts((prev) => {
        const next = { ...prev };
        moments.forEach((m) => {
          if (next[m.id] === undefined) next[m.id] = m.likes;
        });
        return next;
      });
    }
  }, [moments]);

  const dayGroups = useMemo(() => {
    const map = new Map<string, Chatter[]>();
    for (const m of moments ?? []) {
      const key = (m.created_at || "").slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      date: key,
      label: formatDate(items[0].created_at),
      moments: items,
    }));
  }, [moments]);

  const visibleGroups = onlyViewId
    ? dayGroups
        .map((g) => ({ ...g, moments: g.moments.filter((m) => m.id === onlyViewId) }))
        .filter((g) => g.moments.length > 0)
    : dayGroups;

  async function toggleLike(id: number) {
    if (!isLogged) {
      window.location.href = loginUrl();
      return;
    }
    const liked = likedIds.has(id);
    // 乐观更新
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (liked) next.delete(id);
      else next.add(id);
      return next;
    });
    setLikeCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + (liked ? -1 : 1)) }));
    try {
      const res = await apiPost<{ likes: number }>("/api/likes/toggle", { target_type: "chatter", target_id: id });
      setLikeCounts((prev) => ({ ...prev, [id]: res.likes }));
      void mutate();
    } catch (err) {
      // 回滚
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (liked) next.add(id);
        else next.delete(id);
        return next;
      });
      if (err instanceof ApiError && err.status === 401) window.location.href = loginUrl();
    }
  }

  if (isLoading) {
    return (
      <div>
        <Header />
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-white/40 dark:bg-slate-800/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!moments || moments.length === 0) {
    return (
      <div>
        <Header />
        <div className="text-center py-20 text-slate-400">
          <Icon.MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p className="text-sm">暂无说说</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Header />

      {onlyViewId !== null && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          type="button"
          onClick={() => {
            setOnlyViewId(null);
            setExpandedId(null);
          }}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-500 transition-colors mb-6"
        >
          <Icon.ChevronLeft className="w-4 h-4" />
          返回全部
        </motion.button>
      )}

      {visibleGroups.map((group, groupIdx) => (
        <motion.div
          key={group.date}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: groupIdx * 0.1 }}
          className="mb-12 last:mb-0"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{group.label}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{group.moments.length} 条</span>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-300/70 dark:from-slate-700 to-transparent" />
          </div>

          <div
            className="relative"
            style={{ minHeight: group.moments.length > 1 ? 100 + (group.moments.length - 1) * 18 : "auto" }}
          >
            {group.moments.map((moment, i) => {
              const rot = stackRotations[i % stackRotations.length];
              const offsetX = i % 2 === 0 ? -4 : 4;
              const isExpanded = expandedId === moment.id;
              const isOnlyView = onlyViewId === moment.id;
              const hasImages = moment.images && moment.images.length > 0;
              const liked = likedIds.has(moment.id);

              return (
                <motion.div
                  key={moment.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    rotate: isExpanded || isOnlyView ? 0 : rot,
                    x: isExpanded || isOnlyView ? 0 : offsetX,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 25, delay: i * 0.05 }}
                  whileHover={!isExpanded && !isOnlyView ? { rotate: 0, x: 0, y: -4, scale: 1.01 } : undefined}
                  onClick={() => {
                    if (onlyViewId !== null) return;
                    setExpandedId(isExpanded ? null : moment.id);
                  }}
                  className={`${group.moments.length > 1 && !isOnlyView ? "absolute left-0 right-0" : "relative"} cursor-pointer`}
                  style={{
                    zIndex: isExpanded ? 50 : group.moments.length - i,
                    ...(group.moments.length > 1 && !isOnlyView ? { top: i * 18 } : {}),
                  }}
                >
                  <div className="rounded-2xl bg-white/50 dark:bg-slate-800/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg overflow-hidden transition-shadow duration-300 hover:shadow-xl">
                    {/* 折叠态 */}
                    {!isExpanded && !isOnlyView && (
                      <div className="px-4 py-3 md:px-5 md:py-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs text-slate-400">{relativeTime(moment.created_at)}</span>
                          {moment.mood && <span className="text-xs">{moment.mood}</span>}
                          {hasImages && <Icon.Camera className="w-3.5 h-3.5 text-slate-400" />}
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {moment.content}
                        </p>
                      </div>
                    )}

                    {/* 展开 / 只看这条 */}
                    {(isExpanded || isOnlyView) && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="p-4 md:p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                                N
                              </div>
                              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">说说</span>
                              <span className="text-xs text-slate-400">{relativeTime(moment.created_at)}</span>
                            </div>
                            {moment.mood && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100/80 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400">
                                {moment.mood}
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4 whitespace-pre-wrap">
                            {moment.content}
                          </p>

                          {hasImages && (
                            <div
                              className={`grid gap-2 mb-4 ${moment.images.length <= 2 ? "grid-cols-2" : "grid-cols-3"}`}
                            >
                              {moment.images.map((img, idx) => {
                                const photos: LightboxPhoto[] = moment.images.map((url, pi) => ({
                                  id: `${moment.id}-${pi}`,
                                  url,
                                }));
                                return (
                                  <div
                                    key={idx}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLightbox({ photos, index: idx });
                                    }}
                                    className="relative rounded-xl overflow-hidden cursor-pointer group aspect-square"
                                  >
                                    <img
                                      src={img}
                                      alt=""
                                      loading="lazy"
                                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-3 border-t border-slate-200/50 dark:border-white/5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void toggleLike(moment.id);
                              }}
                              className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? "text-pink-500" : "text-slate-400 hover:text-pink-500"}`}
                            >
                              <Icon.Heart className={`w-4 h-4 transition-all duration-300 ${liked ? "fill-pink-500 scale-110" : ""}`} />
                              <span>{likeCounts[moment.id] ?? moment.likes}</span>
                            </button>
                            {!isOnlyView && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOnlyViewId(moment.id);
                                }}
                                className="text-xs px-3 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-colors"
                              >
                                只看这条
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 评论区：仅在「只看这条」时挂载 */}
                        {isOnlyView && (
                          <div
                            className="border-t border-slate-200/50 dark:border-white/5 px-3 md:px-5 py-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <WalineComments path={`/moments/${moment.id}`} embedded />
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ))}

      {/* 展开遮罩 */}
      <AnimatePresence>
        {expandedId !== null && onlyViewId === null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpandedId(null)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {lightbox && (
        <Lightbox
          photos={lightbox.photos}
          index={lightbox.index}
          open={true}
          onClose={() => setLightbox(null)}
          onPrev={() =>
            setLightbox((prev) =>
              prev
                ? { ...prev, index: (prev.index - 1 + prev.photos.length) % prev.photos.length }
                : prev
            )
          }
          onNext={() =>
            setLightbox((prev) =>
              prev ? { ...prev, index: (prev.index + 1) % prev.photos.length } : prev
            )
          }
        />
      )}
    </div>
  );
}

function Header() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-8 md:mb-12"
    >
      <div className="flex items-center gap-3 mb-2">
        <Icon.MessageSquare className="w-6 h-6 md:w-7 md:h-7 text-sky-500" />
        <h1 className="text-xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">说说</h1>
      </div>
      <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 ml-7 md:ml-10">
        记录生活中的小确幸
      </p>
    </motion.div>
  );
}
