/**
 * 站点覆盖层（P2 后台可配置化）：站名/描述/固定窗口图片/侧栏开关
 * 全部以后台 site_config KV 为准，前端配置文件只作默认值兜底。
 *
 * site_config keys（后台「站点配置」页维护）：
 *  - site_title      站点名（页签/Logo/Banner 大标题/og:site_name）
 *  - site_description 站点描述（副标题/og:description）
 *  - site_images     JSON：{ bannerDesktop: string[], bannerMobile: string[], avatar: string, logo: string }
 *  - sidebar_widgets JSON：{ profile: true, announcement: true, categories: true, tags: true, stats: true, calendar: true }
 */
import { apiGet } from "@/lib/server/api";

export interface SiteImages {
	bannerDesktop?: string[];
	bannerMobile?: string[];
	avatar?: string;
	logo?: string;
}

export interface SiteOverrides {
	title: string | null;
	description: string | null;
	images: SiteImages;
	sidebar: Record<string, boolean> | null;
}

const EMPTY: SiteOverrides = {
	title: null,
	description: null,
	images: {},
	sidebar: null,
};

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

	const cfg = await apiGet<Record<string, unknown>>("/api/site-config", 60_000);
	if (!cfg) {
		cache = { expires: Date.now() + 15_000, data: EMPTY };
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

	const data: SiteOverrides = {
		title:
			typeof cfg.site_title === "string" && cfg.site_title.trim()
				? cfg.site_title.trim()
				: null,
		description:
			typeof cfg.site_description === "string" && cfg.site_description.trim()
				? cfg.site_description.trim()
				: null,
		images,
		sidebar,
	};
	cache = { expires: Date.now() + 30_000, data };
	return data;
}

/** 兼容旧调用点：只取站名/描述 */
export async function getSiteIdentity() {
	const o = await getSiteOverrides();
	return { title: o.title, description: o.description };
}
