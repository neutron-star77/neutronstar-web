/**
 * MomentsList —— 素笺页 React island（moments.astro，client:load）。
 *
 * Nebula 复刻（参考 blog.starlitn.top 素笺页）：
 *  - 按日期分组的单列时间线：日期分隔条居中（两侧细线夹「10月16日 · 1条」）
 *  - 每条说说一张独立圆角玻璃卡（24px 圆角 / 白 7% 底 / 白 12% 边框 / backdrop-blur），
 *    卡片直接浮在壁纸上，卡间距约 2rem，无大面板包裹
 *  - 卡内：头像+时间一行 → 正文（可多行）→ 图片网格 → 底部评论数/点赞数
 *  - 灯箱复用本地 Lightbox；点赞乐观更新 + 401 跳登录（行为不变）
 */

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { apiGet, apiPost, ApiError } from "../../lib/api/client";
import { useGithubUser, loginUrl } from "../../lib/auth";
import { useRealtimeRefresh } from "../../lib/realtime";
import type { Chatter } from "../../lib/api/types";
import Lightbox, { type LightboxPhoto } from "./Lightbox";

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

/* 单条说说玻璃卡（颜色一律走 nebula 令牌 / 白黑半透明） */
function MomentCard({
  moment,
  index,
  liked,
  likeCount,
  onLike,
  onImageClick,
}: {
  moment: Chatter;
  index: number;
  liked: boolean;
  likeCount: number;
  onLike: (id: number) => void;
  onImageClick: (photos: LightboxPhoto[], index: number) => void;
}) {
  const hasImages = moment.images && moment.images.length > 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: "easeOut" }}
      className="mb-8 last:mb-0 rounded-[24px] bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.12)] backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.35)] overflow-hidden transition-colors duration-300 hover:border-[rgba(255,255,255,0.2)]"
    >
      <div className="px-5 pt-5 pb-4 md:px-6">
        {/* 头像 + 时间一行 */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 flex-none rounded-full bg-gradient-to-br from-[var(--nebula-cyan)] to-[var(--nebula-violet)] flex items-center justify-center text-[#0b1026] text-xs font-bold shadow-[0_0_0_3px_rgba(125,211,252,0.10)]">
            N
          </div>
          <span className="text-sm font-semibold text-[color:var(--nebula-ink)]">素笺</span>
          <span className="text-xs text-[color:var(--nebula-ink-muted)]">
            {relativeTime(moment.created_at)}
          </span>
          {moment.mood && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.1)] text-[color:var(--nebula-ink-muted)]">
              {moment.mood}
            </span>
          )}
        </div>

        {/* 正文（可多行） */}
        <p className="text-sm leading-relaxed text-[color:var(--nebula-ink)] whitespace-pre-wrap [text-shadow:0_1px_7px_rgba(0,0,0,0.5)]">
          {moment.content}
        </p>

        {/* 图片网格（≤2 张两列，否则三列）+ 灯箱 */}
        {hasImages && (
          <div className={`grid gap-2 mt-4 ${moment.images.length <= 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {moment.images.map((img, idx) => {
              const photos: LightboxPhoto[] = moment.images.map((url, pi) => ({
                id: `${moment.id}-${pi}`,
                url,
              }));
              return (
                <div
                  key={idx}
                  onClick={() => onImageClick(photos, idx)}
                  className="relative rounded-xl overflow-hidden cursor-pointer group aspect-square border border-[rgba(255,255,255,0.1)]"
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

        {/* 底部：评论数 / 点赞数 */}
        <div className="flex items-center gap-5 pt-3 mt-4 border-t border-[rgba(255,255,255,0.08)]">
          <span className="flex items-center gap-1.5 text-xs text-[color:var(--nebula-ink-muted)]">
            <Icon.MessageSquare className="w-4 h-4" />
            {moment.comments_count}
          </span>
          <button
            type="button"
            onClick={() => onLike(moment.id)}
            aria-pressed={liked}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              liked ? "text-pink-400" : "text-[color:var(--nebula-ink-muted)] hover:text-pink-400"
            }`}
          >
            <Icon.Heart className={`w-4 h-4 transition-all duration-300 ${liked ? "fill-pink-400 scale-110" : ""}`} />
            <span>{likeCount}</span>
          </button>
        </div>
      </div>
    </motion.article>
  );
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
      <div className="max-w-2xl mx-auto">
        <Header />
        <div className="space-y-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-[24px] bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.12)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!moments || moments.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Header />
        <div className="text-center py-20 text-[color:var(--nebula-ink-muted)]">
          <Icon.MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p className="text-sm">暂无说说</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Header />

      {dayGroups.map((group, groupIdx) => (
        <section key={group.date} className="mb-12 last:mb-0">
          {/* 日期分隔条：居中，两侧细线夹「10月16日 · 1条」 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: groupIdx * 0.1 }}
            className="flex items-center gap-4 mb-8"
            aria-label={`${group.label}，共 ${group.moments.length} 条`}
          >
            <div className="flex-1 h-px bg-[rgba(255,255,255,0.14)]" />
            <span className="text-xs tracking-wide whitespace-nowrap text-[color:var(--nebula-ink-muted)] [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
              {group.label} · {group.moments.length}条
            </span>
            <div className="flex-1 h-px bg-[rgba(255,255,255,0.14)]" />
          </motion.div>

          {group.moments.map((moment, i) => (
            <MomentCard
              key={moment.id}
              moment={moment}
              index={i}
              liked={likedIds.has(moment.id)}
              likeCount={likeCounts[moment.id] ?? moment.likes}
              onLike={(id) => void toggleLike(id)}
              onImageClick={(photos, index) => setLightbox({ photos, index })}
            />
          ))}
        </section>
      ))}

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
      className="mb-10 md:mb-12"
    >
      <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-[color:var(--nebula-ink-muted)]">
        MOMENTS
      </p>
      <h1 className="text-2xl md:text-4xl font-extrabold text-[color:var(--nebula-ink)] [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]">
        素笺
      </h1>
      <p className="mt-2 text-sm md:text-base text-[color:var(--nebula-ink-muted)]">
        记录生活中的小确幸
      </p>
    </motion.div>
  );
}
