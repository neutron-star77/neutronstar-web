import type { WallpaperMode } from "@/types/config";
import type { SidebarPage } from "@/types/sidebarConfig";

export type BannerViewport = "desktop" | "mobile";
export type BannerContentLayout = "banner" | "compact";

export type BannerCopyMode = "home" | "context" | null;

export interface BannerStateInput {
	mode: WallpaperMode;
	page: SidebarPage | undefined;
	viewport: BannerViewport;
	imageCount: number;
	carouselEnabled: boolean;
	reducedMotion: boolean;
}

export interface BannerState {
	visible: boolean;
	assetGroup: BannerViewport | null;
	copyMode: BannerCopyMode;
	rotate: boolean;
	transparentTopAppBar: boolean;
	contentLayout: BannerContentLayout;
}

export function resolveBannerState(input: BannerStateInput): BannerState {
	const isHome = input.page === "home";
	const isFullscreen = input.mode === "fullscreen";
	// fullscreen：壁纸在所有页面、所有视口常驻（无图时由调用方回退图组，彻底无图则不可见）
	const visible =
		input.imageCount > 0 &&
		(isFullscreen ||
			(input.mode === "banner" &&
				(input.viewport === "desktop" || isHome)));

	// fullscreen 下非首页不显示 context 文案：壁纸退为纯背景，正文即内容
	const copyMode: BannerCopyMode = !visible
		? null
		: isHome
			? "home"
			: isFullscreen
				? null
				: "context";

	return {
		visible,
		assetGroup: visible ? input.viewport : null,
		copyMode,
		rotate:
			visible &&
			input.carouselEnabled &&
			input.imageCount > 1 &&
			!input.reducedMotion,
		transparentTopAppBar: visible,
		// fullscreen 下内容顶格（compact），横幅只属于 banner 模式
		contentLayout: visible && !isFullscreen ? "banner" : "compact",
	};
}
