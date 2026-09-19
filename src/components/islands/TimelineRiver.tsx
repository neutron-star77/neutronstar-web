/**
 * TimelineRiver —— 时光河流归档页 React island（archive.astro，client:load）。
 *
 * 1:1 对齐 Xinghongia/Kirameku 的 app/timeline/page.tsx：
 *  - 三条正弦叠加的 SVG 河流（描边动画 + 渐变 + 发光层 + 流动粒子）
 *  - 文章卡片上下交替分布，motion.div drag="x" 横向拖拽（移动端同样横向，仅常量更小）
 *  - 视口裁剪（只渲染屏幕 ±2 卡），rAF 节流；didDrag 防止拖拽末尾误跳转
 *  - 卡片点击跳转 /posts/{slug}
 *
 * 数据由 archive.astro SSR 全量下发（props.posts），客户端零请求。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";

export interface RiverPost {
  id: number;
  slug: string;
  title: string;
  description: string;
  cover: string;
  category: string;
  views: number;
  likes: number;
  published_at: string;
}

/* ── 分类配色 ── */
function catText(cat: string): string {
  const map: Record<string, string> = {
    技术: "text-cyan-600 dark:text-cyan-400",
    生活: "text-violet-600 dark:text-violet-400",
    学术: "text-amber-600 dark:text-amber-400",
    随笔: "text-pink-600 dark:text-pink-400",
    项目: "text-emerald-600 dark:text-emerald-400",
    教程: "text-blue-600 dark:text-blue-400",
  };
  return map[cat] || "text-slate-500 dark:text-slate-400";
}
function catBg(cat: string): string {
  const map: Record<string, string> = {
    技术: "bg-cyan-500/10",
    生活: "bg-violet-500/10",
    学术: "bg-amber-500/10",
    随笔: "bg-pink-500/10",
    项目: "bg-emerald-500/10",
    教程: "bg-blue-500/10",
  };
  return map[cat] || "bg-slate-500/10";
}
function catColor(cat: string): string {
  const map: Record<string, string> = {
    技术: "#22d3ee",
    生活: "#a78bfa",
    学术: "#fbbf24",
    随笔: "#f472b6",
    项目: "#34d399",
    教程: "#60a5fa",
  };
  return map[cat] || "#94a3b8";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* 河流路径：三条正弦叠加（0.5/0.3/0.2 振幅），步长控制采样点数 */
function buildRiverPath(
  totalWidth: number,
  riverY: number,
  amplitude: number,
  wavelength: number,
  offsetY = 0,
  stepSize: number,
): string {
  const parts: string[] = [];
  const steps = Math.max(1, Math.ceil(totalWidth / stepSize));
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * totalWidth;
    const y =
      riverY +
      amplitude * 0.5 * Math.sin((x / wavelength) * Math.PI * 2) +
      amplitude * 0.3 * Math.sin((x / (wavelength * 0.6)) * Math.PI * 2 + 1) +
      amplitude * 0.2 * Math.sin((x / (wavelength * 1.5)) * Math.PI * 2 + 2.5);
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${(y + offsetY).toFixed(1)}`);
  }
  return parts.join(" ");
}

const ClockIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const BookOpenIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);
const EyeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const HeartIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);

export default function TimelineRiver({ posts }: { posts: RiverPost[] }) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewWidth, setViewWidth] = useState(1200);
  const [visibleRangeKey, setVisibleRangeKey] = useState(0);
  const dragXRef = useRef(0);
  const didDrag = useRef(false);
  const rafRef = useRef(0);

  useEffect(() => {
    const check = () => {
      const vw = window.innerWidth;
      setViewWidth(vw);
      setIsMobile(vw < 768);
    };
    check();
    setMounted(true);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const sorted = useMemo(
    () =>
      [...posts].sort(
        (a, b) =>
          new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      ),
    [posts]
  );

  const CARD_W = isMobile ? 170 : 240;
  const CARD_H = isMobile ? 180 : 230;
  const CARD_GAP = isMobile ? 40 : 60;
  const RIVER_Y = isMobile ? 180 : 240;
  const SVG_TOP = -100;
  const AMPLITUDE = isMobile ? 50 : 80;
  const WAVELENGTH = isMobile ? 400 : 600;
  const PADDING = isMobile ? 300 : 600;

  const totalWidth = PADDING * 2 + sorted.length * (CARD_W + CARD_GAP) - CARD_GAP;
  const svgHeight = RIVER_Y + AMPLITUDE + CARD_H + 120 - SVG_TOP;

  const riverStepSize = isMobile ? 20 : 4;
  const riverPath = useMemo(
    () => buildRiverPath(totalWidth, RIVER_Y, AMPLITUDE, WAVELENGTH, 0, riverStepSize),
    [totalWidth, RIVER_Y, AMPLITUDE, WAVELENGTH, riverStepSize]
  );
  const riverPathBottom = useMemo(
    () => buildRiverPath(totalWidth, RIVER_Y, AMPLITUDE, WAVELENGTH, 12, riverStepSize),
    [totalWidth, RIVER_Y, AMPLITUDE, WAVELENGTH, riverStepSize]
  );

  const visibleRange = useMemo(() => {
    const dragX = dragXRef.current;
    const visibleLeft = -dragX - PADDING - (CARD_W + CARD_GAP) * 2;
    const visibleRight = -dragX + viewWidth + PADDING + (CARD_W + CARD_GAP) * 2;
    const startIdx = Math.max(0, Math.floor(visibleLeft / (CARD_W + CARD_GAP)));
    const endIdx = Math.min(sorted.length, Math.ceil(visibleRight / (CARD_W + CARD_GAP)) + 1);
    return { startIdx, endIdx };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRangeKey, viewWidth, isMobile, sorted.length, PADDING, CARD_W, CARD_GAP]);

  const scheduleUpdate = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      setVisibleRangeKey((k) => k + 1);
      rafRef.current = 0;
    });
  }, []);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const initialX = -(PADDING - (viewWidth - CARD_W) / 2);

  const header = (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-3 md:mb-4"
    >
      <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
        <ClockIcon className="w-5 h-5 md:w-7 md:h-7 text-sky-500" />
        <h1 className="text-xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">归档</h1>
      </div>
      <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 ml-7 md:ml-10">
        时光河流 · 共 {sorted.length} 篇文章
      </p>
    </motion.div>
  );

  if (!mounted) {
    return (
      <div>
        {header}
        <div className="flex items-center justify-center py-20 md:py-32">
          <div className="w-6 h-6 md:w-8 md:h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div>
        {header}
        <div className="flex flex-col items-center justify-center py-20 md:py-32 text-slate-400">
          <BookOpenIcon className="w-10 h-10 md:w-12 md:h-12 mb-4 opacity-40" />
          <p className="text-sm md:text-base">暂无文章</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}

      <div className="kirameku-river-scroll overflow-hidden pb-4 select-none">
        <motion.div
          drag="x"
          dragMomentum
          dragElastic={0.1}
          dragConstraints={{
            left: -(totalWidth - viewWidth),
            right: 0,
          }}
          initial={{ x: initialX }}
          onDrag={(_, info) => {
            dragXRef.current = info.offset.x;
            scheduleUpdate();
          }}
          onDragStart={() => {
            didDrag.current = true;
          }}
          onDragEnd={() => {
            setTimeout(() => {
              didDrag.current = false;
            }, 100);
          }}
          className="cursor-grab active:cursor-grabbing"
        >
          <svg
            width={totalWidth}
            height={svgHeight}
            viewBox={`0 ${SVG_TOP} ${totalWidth} ${svgHeight}`}
            className="block"
          >
            <defs>
              <linearGradient id="river-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
                <stop offset="5%" stopColor="#38bdf8" stopOpacity="0.5" />
                <stop offset="50%" stopColor="#818cf8" stopOpacity="0.6" />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="river-grad-dark" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
                <stop offset="5%" stopColor="#38bdf8" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#818cf8" stopOpacity="0.4" />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
              {!isMobile && (
                <>
                  <filter id="river-glow" x="-5%" y="-20%" width="110%" height="140%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
                  </filter>
                  <filter id="dot-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
                  </filter>
                </>
              )}
            </defs>

            <motion.path
              d={riverPath}
              fill="none"
              stroke="url(#river-grad)"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.8, ease: "easeInOut" }}
            />
            {!isMobile && (
              <motion.path
                d={riverPath}
                fill="none"
                stroke="url(#river-grad)"
                strokeWidth="20"
                filter="url(#river-glow)"
                opacity="0.3"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.8, ease: "easeInOut" }}
              />
            )}
            <motion.path
              d={riverPathBottom}
              fill="none"
              stroke="url(#river-grad-dark)"
              strokeWidth="1"
              opacity="0.15"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.8, ease: "easeInOut" }}
            />

            {!isMobile && (
              <>
                {[0, 0.3, 0.6].map((offset, i) => (
                  <circle
                    key={i}
                    r="3"
                    fill="#38bdf8"
                    opacity="0.7"
                    filter="url(#dot-glow)"
                  >
                    <animateMotion
                      dur={`${8 + i * 1.5}s`}
                      repeatCount="indefinite"
                      begin={`${offset * (8 + i * 1.5)}s`}
                    >
                      <mpath href="#river-flow-path" />
                    </animateMotion>
                  </circle>
                ))}
                <path id="river-flow-path" d={riverPath} fill="none" stroke="none" />
              </>
            )}

            {sorted.slice(visibleRange.startIdx, visibleRange.endIdx).map((post, ri) => {
              const i = visibleRange.startIdx + ri;
              const x = PADDING + i * (CARD_W + CARD_GAP);
              const cx = x + CARD_W / 2;
              const waveY =
                RIVER_Y +
                AMPLITUDE * 0.5 * Math.sin((cx / WAVELENGTH) * Math.PI * 2) +
                AMPLITUDE * 0.3 * Math.sin((cx / (WAVELENGTH * 0.6)) * Math.PI * 2 + 1) +
                AMPLITUDE * 0.2 * Math.sin((cx / (WAVELENGTH * 1.5)) * Math.PI * 2 + 2.5);

              const isAbove = i % 2 === 0;
              const cardY = isAbove
                ? waveY - (isMobile ? 30 : 50) - CARD_H
                : waveY + (isMobile ? 30 : 50);
              const lineStartY = isAbove ? cardY + CARD_H : cardY;
              const dateStr = formatDate(post.published_at);

              return (
                <g key={post.id} className="cursor-pointer">
                  <line
                    x1={cx}
                    y1={lineStartY}
                    x2={cx}
                    y2={waveY}
                    stroke={catColor(post.category)}
                    strokeWidth="1.5"
                    opacity="0.4"
                    strokeDasharray="4 3"
                  />
                  <circle cx={cx} cy={waveY} r="6" fill="#ffffff" />
                  <circle cx={cx} cy={waveY} r="10" fill="#ffffff" opacity="0.25" />
                  <text
                    x={cx}
                    y={waveY + (isAbove ? 22 : -12)}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize={isMobile ? "9" : "11"}
                    fontWeight="700"
                  >
                    {dateStr}
                  </text>

                  <foreignObject x={x} y={cardY} width={CARD_W} height={CARD_H} style={{ overflow: "visible" }}>
                    <a
                      href={`/posts/${post.slug}`}
                      onClick={(e) => {
                        if (didDrag.current) {
                          e.preventDefault();
                        }
                      }}
                      className={`block w-full h-full rounded-xl md:rounded-2xl overflow-hidden border border-white/40 dark:border-white/10 shadow-lg transition-all duration-300 group ${
                        isMobile ? "bg-white/80 dark:bg-slate-800/90" : "bg-white/60 dark:bg-slate-800/70 backdrop-blur-xl"
                      } hover:shadow-xl hover:-translate-y-0.5`}
                    >
                      {post.cover ? (
                        <div className="relative overflow-hidden" style={{ height: isMobile ? 70 : 100 }}>
                          <img
                            src={post.cover}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                          <div className="absolute bottom-1.5 left-2 md:bottom-2 md:left-3 flex items-center gap-1 text-white/80 text-[8px] md:text-[10px]">
                            <ClockIcon className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            {dateStr}
                          </div>
                        </div>
                      ) : (
                        <div
                          className="relative bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center"
                          style={{ height: isMobile ? 70 : 100 }}
                        >
                          <BookOpenIcon className="w-6 h-6 md:w-8 md:h-8 text-slate-300 dark:text-slate-600" />
                          <span className="absolute bottom-1.5 left-2 md:bottom-2 md:left-3 text-[8px] md:text-[10px] text-slate-400">
                            {dateStr}
                          </span>
                        </div>
                      )}
                      <div className="p-2 md:p-3">
                        <h3 className="text-[10px] md:text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2 mb-1 md:mb-1.5 group-hover:text-sky-500 transition-colors leading-snug">
                          {post.title}
                        </h3>
                        {post.description && (
                          <p className="text-[8px] md:text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-1.5 md:mb-2 leading-relaxed">
                            {post.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          {post.category ? (
                            <span className={`text-[7px] md:text-[9px] px-1 md:px-1.5 py-0.5 rounded-full font-medium ${catBg(post.category)} ${catText(post.category)}`}>
                              {post.category}
                            </span>
                          ) : (
                            <span />
                          )}
                          <div className="flex items-center gap-1.5 md:gap-2 text-slate-500 dark:text-slate-400 text-[8px] md:text-[10px]">
                            <span className="flex items-center gap-0.5">
                              <EyeIcon className="w-2.5 h-2.5 md:w-3 md:h-3" />
                              {post.views}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <HeartIcon className="w-2.5 h-2.5 md:w-3 md:h-3" />
                              {post.likes}
                            </span>
                          </div>
                        </div>
                      </div>
                    </a>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-[10px] md:text-xs text-slate-400 mt-3 md:mt-4"
      >
        左右滑动浏览时光河流 · 点击文章卡片跳转阅读
      </motion.p>
    </div>
  );
}
