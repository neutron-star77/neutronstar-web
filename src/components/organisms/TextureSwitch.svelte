<script lang="ts">
/**
 * 顶栏「页面背景纹理」切换按钮（2026-09-15 新增）。
 *
 * 需求背景：页面背景（纹理）原先藏在「显示设置」面板的界面布局段里，
 * 用户要求像壁纸模式一样把背景从面板里提取成顶栏独立图标（对齐 Twilight
 * 顶栏各即时切换按钮的动线），实现「一键切换不用开面板」。
 *
 * 交互（对齐 Twilight wallpaperSwitch + 本站显示设置面板的 hover 动线）：
 *   桌面（≥1024px）：悬停图标立即展开纹理选择面板；鼠标移出图标+面板区域
 *   260ms 后收回——鼠标停留在菜单上则保持展开。点击图标本体循环切换纹理。
 *   移动端：点击图标开合面板（无 hover）。
 *   图标随当前纹理变化；与显示设置面板的纹理选择共用 setting-utils 存取与
 *   texture:change 广播，两处实时同步。
 */
import Icon from "@iconify/svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { onMount } from "svelte";
import { TEXTURE_CHANGE_EVENT } from "@constants/constants";
import {
	getStoredTexturePreset,
	setTexturePreset,
} from "@utils/setting-utils";
import type { TexturePreset } from "@/types/textureConfig";

const TEXTURES: {
	value: TexturePreset;
	labelKey: I18nKey;
	icon: string;
}[] = [
	{
		value: "none",
		labelKey: I18nKey.texturePresetNone,
		icon: "material-symbols:block-rounded",
	},
	{
		value: "starlight",
		labelKey: I18nKey.texturePresetStarlight,
		icon: "material-symbols:auto-awesome-outline-rounded",
	},
	{
		value: "cyber-dots",
		labelKey: I18nKey.texturePresetCyberDots,
		icon: "material-symbols:grid-view-rounded",
	},
	{
		value: "topography",
		labelKey: I18nKey.texturePresetTopography,
		icon: "material-symbols:waves-rounded",
	},
	{
		value: "geometric",
		labelKey: I18nKey.texturePresetGeometric,
		icon: "material-symbols:category-outline-rounded",
	},
	{
		value: "sakura",
		labelKey: I18nKey.texturePresetSakura,
		icon: "material-symbols:local-florist-outline-rounded",
	},
];

/** 点击循环顺序（none 放末尾，避免误触进入纯色） */
const SEQ: TexturePreset[] = [
	"starlight",
	"cyber-dots",
	"topography",
	"geometric",
	"sakura",
	"none",
];

let preset = $state<TexturePreset>("starlight");
let isOpen = $state(false);
let hoverCloseTimer: number | null = null;

const currentIcon = $derived(
	TEXTURES.find((t) => t.value === preset)?.icon ?? TEXTURES[0].icon,
);

const label = $derived(
	`${i18n(I18nKey.texturePreset)}：${i18n(
		TEXTURES.find((t) => t.value === preset)?.labelKey ??
			I18nKey.texturePresetNone,
	)}`,
);

function openPanel() {
	if (hoverCloseTimer) window.clearTimeout(hoverCloseTimer);
	hoverCloseTimer = null;
	isOpen = true;
}

function scheduleClose() {
	if (hoverCloseTimer) window.clearTimeout(hoverCloseTimer);
	hoverCloseTimer = window.setTimeout(() => (isOpen = false), 260);
}

function onContainerEnter() {
	if (window.matchMedia("(min-width: 1024px)").matches) openPanel();
}

function onContainerLeave() {
	if (window.matchMedia("(min-width: 1024px)").matches) scheduleClose();
}

function onButtonClick() {
	if (window.matchMedia("(min-width: 1024px)").matches) {
		// 桌面：点击循环切换纹理（hover 面板负责选择）
		const next = SEQ[(SEQ.indexOf(preset) + 1) % SEQ.length];
		setTexturePreset(next);
		preset = next;
	} else {
		isOpen = !isOpen;
	}
}

function select(p: TexturePreset) {
	setTexturePreset(p);
	preset = p;
	isOpen = false;
}

onMount(() => {
	preset = getStoredTexturePreset();
	// 显示设置面板里的纹理选择也能改状态，跨组件同步
	const onTextureChange = (e: CustomEvent<{ preset?: TexturePreset }>) => {
		if (e.detail?.preset) preset = e.detail.preset;
	};
	window.addEventListener(TEXTURE_CHANGE_EVENT, onTextureChange);
	return () => {
		window.removeEventListener(TEXTURE_CHANGE_EVENT, onTextureChange);
	};
});
</script>

<div
	class="relative z-50 flex items-center"
	onmouseenter={onContainerEnter}
	onmouseleave={onContainerLeave}
>
	<button
		type="button"
		class="m3-icon-button m3-icon-button--standard m3-icon-button--round m3-state-layer shrink-0"
		aria-label={label}
		title={label}
		aria-expanded={isOpen}
		onclick={onButtonClick}
	>
		<Icon icon={currentIcon} class="text-[1.25rem]"></Icon>
	</button>

	<div
		class={["float-panel absolute top-full right-0 pt-2 w-56 max-w-[calc(100vw-2rem)] transition-all", !isOpen ? "float-panel-closed" : ""].join(" ")}
	>
		<div class="p-2">
			<div class="px-3 py-2 text-sm font-medium text-[var(--primary)]">
				{i18n(I18nKey.texturePreset)}
			</div>
			<div class="flex flex-col">
				{#each TEXTURES as tex (tex.value)}
					<button
						type="button"
						class={[
							"flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
							preset === tex.value
								? "bg-[var(--secondary-container)] text-[var(--on-secondary-container)]"
								: "text-[var(--on-surface)] hover:bg-[color-mix(in_oklab,var(--on-surface)_8%,transparent)]",
						].join(" ")}
						onclick={() => select(tex.value)}
					>
						<Icon icon={tex.icon} class="text-lg leading-none" />
						<span class="grow">{i18n(tex.labelKey)}</span>
						{#if preset === tex.value}
							<Icon icon="material-symbols:check-rounded" class="text-[1.125rem]"></Icon>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	</div>
</div>
