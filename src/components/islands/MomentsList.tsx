/**
 * MomentsList —— 说说（动态）列表，React island（在 moments.astro 中以 client:visible 水合）。
 *
 * 视觉/交互对齐原版 Xinghongia/Kirameku（f:/AI/projects/Kirameku-ref）的 /moments 页：
 *  - 按「日期」分组展示（同一天的多条动态聚在一起）
 *  - 同一天多条时：绝对定位堆叠 + 确定性倾斜（stackRotations），模拟实体卡片随手摆的质感
 *  - 点击任意卡片：layout 弹簧展开（spring 300/25），显示全文 + 图片网格 + 点赞 + 「只看这条」
 *  - 悬停未展开卡片：回正角度并轻微上浮（whileHover）
 *
 * 数据来源：useChatters() → bff.neutronstar.fun（Hono Worker）→ 回源真实后端 kirameku-api。
 * 后端若没有 chatters 数据，页面显示「还没有动态」（动画只在有内容时可见）。
 *
 * 二次开发提示：
 *  - 倾斜角度/弹簧手感：改 web/src/lib/variants.ts 的 stackRotations / spring。
 *  - 点赞已落库（P5）：`POST /api/chatters/{id}/like|unlike`，乐观更新 + 失败回滚 +
 *    成功后 SWR mutate 重拉真实计数。要做"用户维度防刷/我的点赞态"需后端加 like 关联表。
 *  - 评论尚未接入：`/api/comments` 只支持 post 维度，说说/相册要多态关联（见 HANDOFF P5）。
 *  - 图片地址：imgUrl() 走 bff 的 /img 边缘优化（AVIF，w= 控制宽度）；直接给 http(s) 链接则原样返回。
 */

import { useEffect, useMemo, useState } from "react";
import { mutate } from "swr";
import { motion, AnimatePresence } from "motion/react";
import { useChatters } from "../../lib/api/hooks";
import { useRealtimeRefresh } from "../../lib/realtime";
import { API_BASE_URL, apiGet, apiPost } from "../../lib/api/client";
import { getToken, loginUrl } from "../../lib/auth";
import CommentsThread from "./CommentsThread";
import type { Chatter } from "../../lib/api/types";
import { spring, stackRotations } from "../../lib/variants";
import Lightbox, { type LightboxPhoto } from "./Lightbox";

/** 把后端返回的图片路径拼成可访问 URL：http(s) 直返；相对路径走 bff /img 边缘优化（w= 控制宽度）。 */
function imgUrl(path: string, w = 400) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}/img${path.startsWith("/") ? "" : "/"}${path}?w=${w}`;
}

/** 日期 → 「M月D日」分组标题。 */
function formatDate(d: string) {
  const dt = new Date(d);
  return `${dt.getMonth() + 1}月${dt.getDate()}日`;
}

/** 相对时间（刚刚 / N分钟前 / N小时前 / N天前 / 绝对时间）。 */
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
  // 真实数据：每页最多取 30 条动态（size 可调）。SWR 自动 30s 去重 + 聚焦重校验。
  const { data, isLoading, error } = useChatters({ page: 1, size: 30 });
  // P4 实时：后台发说说 → BFF 广播 moments 频道 → 本列表自动重拉（新卡片按原入场动画插入）
  useRealtimeRefresh(["chatters"]);
  // 当前「弹簧展开」的卡片 id（同一时刻只展开一张）
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // 「只看这条」隔离模式：非 null 时只渲染该条并回正所有角度
  const [onlyViewId, setOnlyViewId] = useState<number | null>(null);
  // 已点赞集合（乐观态，未落库）
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  // 灯箱状态：null = 关闭；否则 { photos, index }
  const [lightbox, setLightbox] = useState<{ photos: LightboxPhoto[]; index: number } | null>(null);

  const moments: Chatter[] = data ?? [];

  // 按 created_at 的「年月日」分组，得到 dayGroups：[{ date, label, moments[] }]
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

  // 隔离模式下只保留目标条（过滤掉其它分组里的无关项）
  const visibleGroups =
    onlyViewId != null
      ? dayGroups
          .map((g) => ({
            ...g,
            moments: g.moments.filter((m) => m.id === onlyViewId),
          }))
          .filter((g) => g.moments.length > 0)
      : dayGroups;

  // P5：点赞落库（登录 + 用户维度去重，真值在 likes 表；乐观更新 + 失败回滚）
  const [token, setTokenState] = useState<string | null>(null);
  const [likeNotice, setLikeNotice] = useState("");

  useEffect(() => {
    setTokenState(getToken());
  }, []);

  // 回填「我点过赞的说说」，避免刷新后点赞态丢失
  useEffect(() => {
    if (!token) {
      setLikedIds(new Set());
      return;
    }
    let alive = true;
    apiGet<{ ids: number[] }>("/api/likes/mine?target_type=chatter")
      .then((res) => {
        if (alive) setLikedIds(new Set(res?.ids ?? []));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [token]);

  async function toggleLike(id: number) {
    if (!token) {
      setLikeNotice("点赞需要先用 GitHub 登录");
      return;
    }
    setLikeNotice("");
    const wasLiked = likedIds.has(id);
    setLikedIds((prev) => {
      const n = new Set(prev);
      if (wasLiked) n.delete(id);
      else n.add(id);
      return n;
    });

    try {
      await apiPost("/api/likes/toggle", { target_type: "chatter", target_id: id });
      // 计数以服务端为准（同时把 BFF 缓存刷成最新值）
      void mutate((key) => Array.isArray(key) && String(key[0]) === "chatters");
    } catch {
      // 回滚乐观态
      setLikedIds((prev) => {
        const n = new Set(prev);
        if (wasLiked) n.add(id);
        else n.delete(id);
        return n;
      });
      setLikeNotice("点赞失败，请稍后再试");
    }
  }

  return (
    <div className="max-w-2xl">
      {isLoading && <p className="text-sm text-on-surface-variant">加载中…</p>}
      {error && <p className="text-sm text-on-surface-variant">加载失败，请刷新</p>}
      {likeNotice && (
        <p className="mb-3 text-xs text-on-surface-variant">
          {likeNotice}{" "}
          <a href={loginUrl()} className="underline hover:text-primary">
            去登录
          </a>
        </p>
      )}
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

          {/* 堆叠容器：同一天多条时给一个最小高度，避免绝对定位卡片溢出重叠错位 */}
          <div
            className="relative"
            style={{
              minHeight:
                group.moments.length > 1 ? 100 + (group.moments.length - 1) * 18 : "auto",
            }}
          >
            {group.moments.map((moment, i) => {
              // 倾斜角：从 variants.ts 的固定序列循环取（确定性，禁止 Math.random，保证 SSR/水合一致）
              const rot = stackRotations[i % stackRotations.length];
              // 水平错落：奇偶左右各偏 4px，增强手摆感
              const offsetX = i % 2 === 0 ? -4 : 4;
              const isExpanded = expandedId === moment.id;
              const isLiked = likedIds.has(moment.id);
              const hasImages = moment.images && moment.images.length > 0;
              // 点赞数直接读服务端计数（点击后会 mutate 重拉；心形颜色由 likedIds 即时反馈）
              const likeCount = moment.likes;

              // 该条动态的图片 → 灯箱数据结构（url 走 imgUrl 取大图 w=1200）
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
                    // 展开后平滑滚到可视区
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
                    // 展开或隔离模式：回正角度/位移；否则用堆叠倾斜角
                    rotate: isExpanded || onlyViewId != null ? 0 : rot,
                    x: isExpanded || onlyViewId != null ? 0 : offsetX,
                  }}
                  // 弹簧展开手感：stiffness/damping 可调（也可改用 variants.ts 的 spring.card）
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
                  // 多张堆叠：绝对定位铺满宽度；单张或隔离模式：相对定位正常流
                  className={`${
                    group.moments.length > 1 && onlyViewId == null
                      ? "absolute left-0 right-0"
                      : "relative"
                  } cursor-pointer`}
                  style={{
                    // 展开卡片置顶；其余按「越新越靠上」递减层叠
                    zIndex: isExpanded ? 50 : group.moments.length - i,
                    ...(group.moments.length > 1 && onlyViewId == null
                      ? { top: i * 18 }
                      : {}),
                  }}
                >
                  <div className="overflow-hidden rounded-m3 border border-outline/40 bg-surface-container shadow-lg backdrop-blur-xl transition-shadow duration-300 hover:shadow-xl">
                    {/* 收起态：相对时间 + 心情 + 📷 + 2 行截断正文 */}
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

                    {/* 展开态 / 隔离态：作者 + 全文 + 图片网格 + 点赞 + 只看这条 */}
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

                          {/* P5：评论区（说说维度；GitHub 登录后可发言/点赞/回复） */}
                          <CommentsThread kind="chatter" targetId={moment.id} />
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

      {/* 展开遮罩：点击空白处收起当前卡片 */}
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
