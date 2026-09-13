<script lang="ts">
/**
 * 顶栏壁纸模式快速切换按钮（功能①的补充入口）：
 * 点击在 横幅 → 全屏沉浸 → 纯色 间循环，图标随模式变化。
 * 与右下角「显示设置」面板里的三选等价（共用 setting-utils 的存取与
 * wallpaper-mode:change 广播），此处给「一键切换不用开面板」的动线。
 * 参考 Twilight 顶栏的即时切换交互（PR#36）。
 */
import Icon from "@iconify/svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getStoredWallpaperMode, setWallpaperMode } from "@utils/setting-utils";
import { onMount } from "svelte";
import type { WallpaperMode } from "@/types/config";

const SEQ: WallpaperMode[] = ["banner", "fullscreen", "none"];

const ICONS: Record<WallpaperMode, string> = {
	banner: "material-symbols:wallpaper",
	fullscreen: "material-symbols:fullscreen",
	none: "material-symbols:block",
};

let mode = $state<WallpaperMode>("banner");

onMount(() => {
	mode = getStoredWallpaperMode();
	// 面板里的三选也能改状态，跨组件同步
	window.addEventListener(
		"wallpaper-mode:change",
		(e: CustomEvent<{ mode: WallpaperMode }>) => {
			mode = e.detail.mode;
		},
	);
});

const label = $derived(
	`${i18n(I18nKey.wallpaperMode)}：${i18n(
		mode === "banner"
			? I18nKey.wallpaperModeBanner
			: mode === "fullscreen"
				? I18nKey.wallpaperModeFullscreen
				: I18nKey.wallpaperModeNone,
	)}`,
);

function cycle() {
	const next = SEQ[(SEQ.indexOf(mode) + 1) % SEQ.length];
	setWallpaperMode(next);
	mode = next;
}
</script>

<button
	type="button"
	class="m3-icon-button m3-icon-button--standard m3-icon-button--round m3-state-layer shrink-0"
	aria-label={label}
	title={label}
	onclick={cycle}
>
	<Icon icon={ICONS[mode]} class="text-[1.25rem]"></Icon>
</button>
