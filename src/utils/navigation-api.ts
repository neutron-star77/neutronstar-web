/**
 * 导航数据源（P6 ⑥）：从后台 `/api/site-config/navigation` 拉取导航，
 * 统一转换为 NavBarLink 形态，失败时回退静态 navBarConfig。
 *
 * - `fetchNavigation()`：纯 fetch + 转换，客户端/服务端通用
 * - `getNavigation()`：服务端专用，带 30s 内存缓存（SSR 热路径）
 */
import { API_BASE_URL } from "../lib/api/client";
import { LinkPresets, navBarConfig } from "../config/navBarConfig";
import type { NavBarLink } from "../types/navBarConfig";

export interface ApiNavItem {
	id: string;
	label: string;
	href?: string;
	visible?: boolean;
	target?: "_self" | "_blank";
	children?: ApiNavItem[];
}

/** API 导航项 → NavBarLink（按 href 匹配 LinkPresets 补 icon/pageKey） */
export function apiNavToLinks(items: ApiNavItem[]): NavBarLink[] {
	return items
		.filter((item) => item.visible !== false && item.href)
		.map((item) => {
			const normalizedHref = item.href?.replace(/\/+$/, "") || "";
			const preset = Object.values(LinkPresets).find(
				(p) => p.url && p.url.replace(/\/+$/, "") === normalizedHref,
			);
			return {
				name: item.label,
				url: item.href,
				icon: preset?.icon,
				pageKey: preset?.pageKey ?? item.id,
				external: item.target === "_blank",
				children: item.children ? apiNavToLinks(item.children) : undefined,
			};
		});
}

/** 从 API 拉取导航并转换；任何失败回退静态配置 */
export async function fetchNavigation(): Promise<NavBarLink[]> {
	try {
		const res = await fetch(`${API_BASE_URL}/api/site-config/navigation`, {
			headers: { Accept: "application/json" },
		});
		if (!res.ok) return navBarConfig.links;
		let data: unknown = await res.json();
		// 后端可能把 JSON 数组存成字符串再返回（双重编码）
		if (typeof data === "string") {
			try {
				data = JSON.parse(data);
			} catch {
				return navBarConfig.links;
			}
		}
		if (!Array.isArray(data) || data.length === 0) return navBarConfig.links;
		return apiNavToLinks(data as ApiNavItem[]);
	} catch {
		return navBarConfig.links;
	}
}

// 服务端 30s 内存缓存
let navCache: { items: NavBarLink[]; at: number } | null = null;
const NAV_CACHE_TTL = 30_000;

/** SSR 用：带内存缓存的导航获取 */
export async function getNavigation(): Promise<NavBarLink[]> {
	if (navCache && Date.now() - navCache.at < NAV_CACHE_TTL) {
		return navCache.items;
	}
	const items = await fetchNavigation();
	navCache = { items, at: Date.now() };
	return items;
}
