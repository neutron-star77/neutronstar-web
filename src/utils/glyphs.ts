/**
 * 共享字形库（kombai/selects 风格）——全站导航图标统一从这里取。
 *
 * 设计语言：24×24 视窗、1.7px 圆头描边、极简几何 + 一点星光点缀；
 * 呼吸感/弹性 hover/光晕由 .glyph-live（nebula.css）统一驱动，
 * 值为完整 <svg> 字符串，Astro 用 set:html、Svelte 用 {@html} 直接渲染。
 */
export const GLYPHS: Record<string, string> = {
	/** 星轸 · 四芒星（导航首页） */
	home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.8l1.7 7.5 7.5 1.7-7.5 1.7L12 21.2l-1.7-7.5L2.8 12l7.5-1.7z"/><circle cx="18.9" cy="5.1" r="1.05" fill="currentColor" stroke="none"/></svg>`,
	/** 归墟 · 层叠收纳（归档列表） */
	archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2l8.6 4.7L12 12.6 3.4 7.9z"/><path d="M3.4 12.3L12 17l8.6-4.7"/><path d="M3.4 16.4L12 21.1l8.6-4.7"/></svg>`,
	/** 星邻 · 双星互耀（友链） */
	friends: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8.6 4.2l1.35 5.05L14 10.6l-4.05 1.35L8.6 17l-1.35-5.05L3.2 10.6l4.05-1.35z"/><path d="M17.3 8.9l.85 3.2 3.15.85-3.15.85-.85 3.2-.85-3.2-3.15-.85 3.15-.85z"/></svg>`,
	/** 素笺 · 羽笔（说说/随笔） */
	moments: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19.8 4.2c-5.9.3-10.3 3.1-12.1 8.3l-1.5 4.2.9.9 4.2-1.5c5.2-1.8 8-6.2 8.3-12.1z"/><path d="M7.2 16.8l7.4-7.4"/><path d="M4.5 20.4c1.5-.5 2.6-1.5 3.2-2.8"/></svg>`,
	/** 瑶影 · 取景框（相册） */
	albums: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.4" y="5.6" width="17.2" height="13" rx="2.4"/><circle cx="8.8" cy="10" r="1.3"/><path d="M5.4 16.4l3.6-3.6 2.6 2.6 2.9-3.1 4 4.1"/></svg>`,
	/** 司志 · 合卷书（关于） */
	about: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.1C10.2 4.6 7.8 4.1 5.1 4.1c-.6 0-1.1.5-1.1 1.1v12.6c0 .6.5 1.1 1.1 1.1 2.7 0 5.1.5 6.9 2 1.8-1.5 4.2-2 6.9-2 .6 0 1.1-.5 1.1-1.1V5.2c0-.6-.5-1.1-1.1-1.1-2.7 0-5.1.5-6.9 2z"/><path d="M12 6.1v14.6"/></svg>`,
	/** 返回列表 · 左箭头回屋 */
	back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 4.5L3.8 10.2a3 3 0 0 0 0 4.2l5.7 5.7"/><path d="M4 12.3h12.5a4.5 4.5 0 0 1 0 9h-3"/></svg>`,
	/** 赞赏 · 礼盒 */
	gift: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.6" y="8.2" width="16.8" height="4" rx="1.2"/><path d="M5 12.2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M12 8.2v13"/><path d="M12 8.2c-3.4 0-5-1.4-5-3a2.1 2.1 0 0 1 4-.8c.6.9 1 2.2 1 3.8z"/><path d="M12 8.2c3.4 0 5-1.4 5-3a2.1 2.1 0 0 0-4-.8c-.6.9-1 2.2-1 3.8z"/></svg>`,
	/** RSS · 电波 */
	rss: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11a8 8 0 0 1 8 8"/><path d="M5 5a14 14 0 0 1 14 14"/><circle cx="6.2" cy="17.8" r="1.6" fill="currentColor" stroke="none"/></svg>`,
	/** 通用兜底 · 小四芒星 */
	spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.4 6.6L20 12l-6.6 1.4L12 20l-1.4-6.6L4 12l6.6-1.4z"/></svg>`,
	/** 搜索 */
	search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.4"/><path d="M15.8 15.8L20.6 20.6"/></svg>`,
	/** 语言/翻译 · 经纬球 */
	globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2"/><path d="M12 3.4c3.1 2.7 3.1 14.5 0 17.2"/><path d="M12 3.4c-3.1 2.7-3.1 14.5 0 17.2"/></svg>`,
	/** 日（深色模式下显示，点击回浅色） */
	sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.9"/><path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5L7 7M17 17l1.5 1.5M18.5 5.5L17 7M7 17l-1.5 1.5"/></svg>`,
	/** 月（浅色模式下显示，点击进深色） */
	moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 13.6A8.2 8.2 0 1 1 10.4 3.8a6.6 6.6 0 0 0 9.8 9.8z"/></svg>`,
	/** 抽屉菜单 · 双线 */
	menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.2 8.6h15.6"/><path d="M4.2 15.4h9.5"/></svg>`,
};

/** pageKey → 字形名（导航项选图标用，未知 key 兜底小星） */
export const PAGE_GLYPH: Record<string, string> = {
	home: "home",
	archive: "archive",
	friends: "friends",
	moments: "moments",
	albums: "albums",
	about: "about",
};

export function glyphForPage(key?: string): string {
	return (key && PAGE_GLYPH[key]) || "spark";
}

/** 导航项 → 字形：pageKey 优先，缺失时按 URL 前缀兜底（后台数据不带 pageKey 的场景）。 */
export function glyphForNav(link: { pageKey?: string; url?: string }): string {
	const hit = link.pageKey && PAGE_GLYPH[link.pageKey];
	if (hit) return hit;
	const u = link.url || "";
	if (u === "/" || u === "") return "home";
	if (u.startsWith("/archive")) return "archive";
	if (u.startsWith("/friends")) return "friends";
	if (u.startsWith("/moments")) return "moments";
	if (u.startsWith("/albums")) return "albums";
	if (u.startsWith("/about") || u.startsWith("/posts/guanyu")) return "about";
	return "spark";
}
