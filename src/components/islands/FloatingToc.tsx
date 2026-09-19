/**
 * FloatingToc —— 文章右下悬浮目录（Kirameku 同款）。
 *
 * 圆形按钮弹出玻璃目录面板，scrollspy 高亮当前 h2/h3，点击平滑滚动。
 * 数据来自 SSR 解析出的 headings（rehype-slug 生成的 id 与 slug 一致）。
 * 桌面端侧栏 TOC 仍保留；本组件额外提供悬浮入口（与参考站一致）。
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export interface TocHeading {
  slug: string;
  text: string;
  depth: number;
}

export default function FloatingToc({ headings }: { headings: TocHeading[] }) {
  const [activeId, setActiveId] = useState("");
  const [showToc, setShowToc] = useState(false);
  const tocRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (headings.length === 0) return;
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        let current = "";
        for (let i = headings.length - 1; i >= 0; i--) {
          const el = document.getElementById(headings[i].slug);
          if (el && el.getBoundingClientRect().top <= 120) {
            current = headings[i].slug;
            break;
          }
        }
        // 滚到底部时高亮最后一个
        if (
          window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 4
        ) {
          current = headings[headings.length - 1]?.slug ?? current;
        }
        setActiveId(current);
      });
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [headings]);

  // 点外部关闭
  useEffect(() => {
    if (!showToc) return;
    const handler = (e: MouseEvent) => {
      if (
        tocRef.current &&
        !tocRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowToc(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showToc]);

  // 注意：React island 在 SSR 时不能返回 null（Astro 会报 Unable to render），
  // 无目录时渲染一个隐藏占位，水合后依旧无交互。
  if (headings.length === 0) return <div className="hidden" aria-hidden="true" />;

  const scrollTo = (slug: string) => {
    const el = document.getElementById(slug);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top, behavior: "smooth" });
    history.replaceState(history.state, "", `#${slug}`);
    setShowToc(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setShowToc((v) => !v)}
        title="目录"
        aria-label="目录"
        className="fixed right-4 bottom-20 md:right-6 md:bottom-24 z-[10002] w-10 h-10 md:w-11 md:h-11 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 shadow-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h10M4 18h14" />
        </svg>
      </button>

      <AnimatePresence>
        {showToc && (
          <motion.div
            ref={tocRef}
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed right-4 bottom-32 md:right-6 md:bottom-36 z-[10002] w-64 max-h-[60vh]"
          >
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200/50 dark:border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">目录</h3>
              </div>
              <div className="overflow-y-auto max-h-[50vh] p-2">
                {headings.map((h) => (
                  <button
                    type="button"
                    key={h.slug}
                    onClick={() => scrollTo(h.slug)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      h.depth === 2 ? "pl-3" : h.depth === 3 ? "pl-6" : "pl-9"
                    } ${
                      activeId === h.slug
                        ? "bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 font-medium"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {h.text}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
