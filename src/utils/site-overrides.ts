/**
 * 站点覆盖层（P2 后台可配置化）：站名/描述/固定窗口图片/侧栏开关
 * 全部以后台 site_config KV 为准，前端配置文件只作默认值兜底。
 *
 * site_config keys（后台「站点配置」页维护）：
 *  - site_title      站点名（页签/Logo/Banner 大标题/og:site_name）
 *  - site_description 站点描述（副标题/og:description）
 *  - site_images     JSON：{ bannerDesktop: string[], bannerMobile: string[], avatar: string, logo: string }
 *  - sidebar_widgets JSON：{ profile: true, announcement: true, categories: true, tags: true, stats: true, calendar: true }
 *  - umami          JSON：{ enable: bool, websiteId: string, scriptUrl: string, shareUrl: string }
 *  - music_widget   JSON：{ enabled: bool, title: string, subtitle: string, url: string }（外链卡片）
 *  - home_card_ratio 字符串：首页文章卡「文字 | 图片」两栏占比，如 "3:2" 或 "0.6/0.4"，
 *    默认 "3:2"；非法值（非 数字[:/]数字、<=0）解析时静默回退默认。
 *
 * 后台修改方式：后台「站点配置」页（site_config KV）维护 key=home_card_ratio，
 * 经 /api/site-config 读写；BFF revalidate 清缓存后本模块 5s 短缓存过期即生效。
 */
import { apiGet } from "@/lib/server/api";

export interface SiteImages {
	bannerDesktop?: string[];
	bannerMobile?: string[];
	avatar?: string;
	logo?: string;
}

export interface UmamiOverride {
	enable: boolean;
	websiteId: string;
	scriptUrl: string;
	shareUrl: string;
}

/** 后台 music_widget：悬浮播放器（url 是收藏夹链接时解析出 fid）或外链卡片 */
export interface MusicWidgetOverride {
	enabled: boolean;
	title: string;
	subtitle: string;
	url: string;
	/** url 为 B 站收藏夹链接时解析出的 fid（media_id）；悬浮播放器据此启用 */
	fid: string | null;
}

export interface SiteOverrides {
	title: string | null;
	description: string | null;
	images: SiteImages;
	sidebar: Record<string, boolean> | null;
	umami: UmamiOverride | null;
	musicWidget: MusicWidgetOverride | null;
	/** 原始字符串（如 "3:2" / "0.6/0.4"）；后台未配置为 null。解析用 parseHomeCardRatio */
	homeCardRatio: string | null;
}

const EMPTY: SiteOverrides = {
	title: null,
	description: null,
	images: {},
	sidebar: null,
	umami: null,
	musicWidget: null,
	homeCardRatio: null,
};

/** 首页文章卡占比默认值：文字 3 : 图片 2 */
const DEFAULT_HOME_CARD_RATIO = { left: 3, right: 2 } as const;

export interface HomeCardRatio {
	/** 归一化文字（左）占比 0~1 */
	left: number;
	/** 归一化图片（右）占比 0~1 */
	right: number;
	/** 可直接用于 grid-template-columns 的值，如 "3fr 2fr" */
	columns: string;
}

/**
 * 解析后台 home_card_ratio（首页文章卡「文字 | 图片」占比）。
 * 接受 "3:2" 或 "0.6/0.4"（分隔符 : / 均可，允许小数与空白）；
 * 非法（格式不符 / 非有限正数）一律回退默认 "3:2"。
 */
export function parseHomeCardRatio(raw: unknown): HomeCardRatio {
	const fallback = (): HomeCardRatio => {
		const { left, right } = DEFAULT_HOME_CARD_RATIO;
		const sum = left + right;
		return { left: left / sum, right: right / sum, columns: `${left}fr ${right}fr` };
	};
	if (typeof raw !== "string") return fallback();
	const m = /^\s*(\d+(?:\.\d+)?)\s*[:\/]\s*(\d+(?:\.\d+)?)\s*$/.exec(raw);
	if (!m) return fallback();
	const left = Number(m[1]);
	const right = Number(m[2]);
	if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
		return fallback();
	}
	const sum = left + right;
	return {
		left: left / sum,
		right: right / sum,
		columns: `${left}fr ${right}fr`,
	};
}

// 模块级短缓存：压同一 isolate 内多次取数；BFF 侧 revalidate 秒级清缓存后，
// 这里 5s 即过期，后台保存后刷新基本即时可见（30s 太久，会吞掉失效钩子的实时性）。
let cache: { expires: number; data: SiteOverrides } | null = null;

function parseStringList(value: unknown): string[] | undefined {
	if (typeof value === "string" && value.trim()) {
		return [value.trim()];
	}
	if (Array.isArray(value)) {
		const list = value
			.map((v) => (typeof v === "string" ? v.trim() : ""))
			.filter(Boolean);
		return list.length > 0 ? list : undefined;
	}
	return undefined;
}

export async function getSiteOverrides(): Promise<SiteOverrides> {
	if (cache && cache.expires > Date.now()) return cache.data;

	const cfg = await apiGet<Record<string, unknown>>("/api/site-config", 15_000);
	if (!cfg) {
		cache = { expires: Date.now() + 5_000, data: EMPTY };
		return EMPTY;
	}

	let images: SiteImages = {};
	try {
		const raw = cfg.site_images;
		const parsed =
			typeof raw === "string" ? JSON.parse(raw) : (raw as SiteImages);
		if (parsed && typeof parsed === "object") {
			images = {
				bannerDesktop: parseStringList(parsed.bannerDesktop),
				bannerMobile: parseStringList(parsed.bannerMobile),
				avatar:
					typeof parsed.avatar === "string" && parsed.avatar.trim()
						? parsed.avatar.trim()
						: undefined,
				logo:
					typeof parsed.logo === "string" && parsed.logo.trim()
						? parsed.logo.trim()
						: undefined,
			};
		}
	} catch {
		// site_images 不是合法 JSON 时忽略，走默认
	}

	let sidebar: Record<string, boolean> | null = null;
	try {
		const raw = cfg.sidebar_widgets;
		const parsed =
			typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, boolean>);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			sidebar = Object.fromEntries(
				Object.entries(parsed)
					.filter(([, v]) => typeof v === "boolean")
					.map(([k, v]) => [k, v as boolean]),
			);
		}
	} catch {
		sidebar = null;
	}

	// Umami 统计配置（后台可配，覆盖静态 umamiConfig）
	let umami: UmamiOverride | null = null;
	try {
		const raw = cfg.umami;
		const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			umami = {
				enable: parsed.enable === true,
				websiteId: typeof parsed.websiteId === "string" ? parsed.websiteId.trim() : "",
				scriptUrl: typeof parsed.scriptUrl === "string" ? parsed.scriptUrl.trim() : "",
				shareUrl: typeof parsed.shareUrl === "string" ? parsed.shareUrl.trim() : "",
			};
		}
	} catch {
		umami = null;
	}

	// 音乐挂件（后台可配）：url 为 B 站收藏夹链接时解析 fid 给悬浮播放器；
	// 其余 url 仅作为外链卡片。url 仅接受 http(s)，防 javascript: 注入
	let musicWidget: MusicWidgetOverride | null = null;
	try {
		const raw = cfg.music_widget;
		const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			const url = typeof parsed.url === "string" ? parsed.url.trim() : "";
			musicWidget = {
				enabled: parsed.enabled === true || parsed.enable === true,
				title: typeof parsed.title === "string" ? parsed.title.trim() : "",
				subtitle: typeof parsed.subtitle === "string" ? parsed.subtitle.trim() : "",
				url: /^https?:\/\//i.test(url) ? url : "",
				fid: /^https?:\/\//i.test(url) ? (/[?&]fid=(\d+)/.exec(url)?.[1] ?? null) : null,
			};
		}
	} catch {
		musicWidget = null;
	}

	// 语义区分：后台未配置该 key（null）→ 调用方回退前端默认；
	// 后台显式置空（""）→ 站点标题/描述真为空，不再回退默认。
	const data: SiteOverrides = {
		title: typeof cfg.site_title === "string" ? cfg.site_title.trim() : null,
		description:
			typeof cfg.site_description === "string" ? cfg.site_description.trim() : null,
		images,
		sidebar,
		umami,
		musicWidget,
		// 占比字符串原样透传，非法值由 parseHomeCardRatio 回退默认
		homeCardRatio: typeof cfg.home_card_ratio === "string" ? cfg.home_card_ratio : null,
	};
	cache = { expires: Date.now() + 5_000, data };
	return data;
}

/** 兼容旧调用点：只取站名/描述 */
export async function getSiteIdentity() {
	const o = await getSiteOverrides();
	return { title: o.title, description: o.description };
}

/**
 * 取后台 Umami 配置；后台未配置时返回 null（调用方回退静态 umamiConfig）。
 * 返回结构与 ResolvedUmamiOptions 对齐。
 */
export async function getUmamiOverride() {
	const o = await getSiteOverrides();
	if (!o.umami || !o.umami.enable) return null;
	// shareUrl 是显示统计数字的必要项；采集脚本需要 websiteId + scriptUrl
	const shareUrl = o.umami.shareUrl;
	if (!shareUrl && !o.umami.websiteId) return null;
	return {
		shareUrl: shareUrl || undefined,
		websiteId: o.umami.websiteId || undefined,
		scriptUrl: o.umami.scriptUrl || undefined,
	};
}

/**
 * 取后台音乐挂件配置；未启用或 url 不是合法 http(s) 外链时返回 null
 * （侧栏据此隐藏 music widget，保持「禁用零残留」）。
 */
export async function getMusicWidgetOverride(): Promise<MusicWidgetOverride | null> {
	const o = await getSiteOverrides();
	if (!o.musicWidget || !o.musicWidget.enabled || !o.musicWidget.url) return null;
	return o.musicWidget;
}
