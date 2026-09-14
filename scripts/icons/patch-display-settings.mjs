// 恢复 DisplaySettings.svelte 的背景纹理段 + 图标注册导入（CRLF 文件，用 Node 处理）
import { readFileSync, writeFileSync } from "node:fs";

const f = "src/components/organisms/DisplaySettings.svelte";
let c = readFileSync(f, "utf8");
let n = 0;
const rep = (rawA, rawB) => {
	// 文件是 CRLF 行尾，模板字符串（LF）需转 CRLF 才能匹配/保持
	const a = rawA.replaceAll("\n", "\r\n");
	const b = rawB.replaceAll("\n", "\r\n");
	if (!c.includes(a)) throw new Error("NOT FOUND: " + a.slice(0, 60));
	c = c.replace(a, b);
	n++;
};

// A. setting-utils import 补纹理函数
rep(
	`import {
	getDefaultHue,
	getHue,
	getMotionPreference,
	getStoredWallpaperBlur,
	getStoredWallpaperMode,
	setHue,
	setMotionPreference,
	setWallpaperBlur,
	setWallpaperMode,
} from "@utils/setting-utils";`,
	`import {
	getDefaultHue,
	getDefaultTextureOpacity,
	getDefaultTexturePreset,
	getHue,
	getMotionPreference,
	getStoredTextureOpacity,
	getStoredTexturePreset,
	getStoredWallpaperBlur,
	getStoredWallpaperMode,
	setHue,
	setMotionPreference,
	setTextureOpacity,
	setTexturePreset,
	setWallpaperBlur,
	setWallpaperMode,
} from "@utils/setting-utils";`,
);

// B. 图标注册导入
rep(
	`import Icon from "@iconify/svelte";`,
	`import Icon from "@iconify/svelte";
import "@/utils/register-local-icons";`,
);

// C. TexturePreset 类型
rep(
	`import type { PostListMode } from "@/types/postListConfig";`,
	`import type { PostListMode } from "@/types/postListConfig";
import type { TexturePreset } from "@/types/textureConfig";`,
);

// D. 纹理 state 与选项（wallpaperBlur 之后）
rep(
	`// 全屏沉浸背景模糊度（px）：滑条仅在全屏沉浸模式下出现
let wallpaperBlur = $state(0);`,
	`// 全屏沉浸背景模糊度（px）：滑条仅在全屏沉浸模式下出现
let wallpaperBlur = $state(0);

// 背景纹理预设与浓度
const defaultTexturePreset = getDefaultTexturePreset();
const defaultTextureOpacity = getDefaultTextureOpacity();
let texturePreset = $state<TexturePreset>(getStoredTexturePreset());
let lastAppliedTexturePreset = texturePreset;
let textureOpacity = $state<number>(getStoredTextureOpacity());

const textureOptions: {
	value: TexturePreset;
	labelKey: I18nKey;
	icon: string;
}[] = [
	{
		value: "none",
		labelKey: I18nKey.texturePresetNone,
		icon: "material-symbols:block",
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
];`,
);

// E. confirmReset 补纹理
rep(
	`	postListMode = defaultLayoutMode;
	wallpaperMode = defaultWallpaperMode;
}`,
	`	postListMode = defaultLayoutMode;
	wallpaperMode = defaultWallpaperMode;
	texturePreset = defaultTexturePreset;
	textureOpacity = defaultTextureOpacity;
}`,
);

// F. isDirty 补纹理
rep(
	`		postListMode !== defaultLayoutMode ||
		wallpaperMode !== defaultWallpaperMode,
);`,
	`		postListMode !== defaultLayoutMode ||
		wallpaperMode !== defaultWallpaperMode ||
		texturePreset !== defaultTexturePreset ||
		textureOpacity !== defaultTextureOpacity,
);`,
);

// G. $effect 补纹理（postListMode effect 之前）
rep(
	`$effect(() => {
	if (postListMode === lastAppliedMode) return;`,
	`$effect(() => {
	if (texturePreset === lastAppliedTexturePreset) return;
	lastAppliedTexturePreset = texturePreset;
	setTexturePreset(texturePreset);
});
$effect(() => {
	setTextureOpacity(textureOpacity);
});
$effect(() => {
	if (postListMode === lastAppliedMode) return;`,
);

// H. 段二模板：恢复纹理段 + 条件加 texture
rep(
	`        <!-- 段二：界面布局（壁纸模式 + 列表布局）——背景纹理已提取为顶栏
             独立图标（TextureSwitch.svelte），面板不再重复提供 -->
        {#if displayConfig.wallpaperMode || displayConfig.layoutMode}`,
	`        <!-- 段二：界面布局（页面背景 + 列表布局 + 背景纹理） -->
        {#if displayConfig.wallpaperMode || displayConfig.layoutMode || displayConfig.texture}`,
);
rep(
	`                {#if displayConfig.layoutMode}`,
	`                {#if displayConfig.texture}
                    <div class="flex flex-col gap-2 pt-1">
                        <span class="text-sm font-bold text-[var(--on-surface-variant)] ml-1">{i18n(I18nKey.texturePreset)}</span>
                        <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label={i18n(I18nKey.texturePreset)}>
                            {#each textureOptions as opt (opt.value)}
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={texturePreset === opt.value}
                                    title={i18n(opt.labelKey)}
                                    aria-label={i18n(opt.labelKey)}
                                    class="m3-style-cell"
                                    class:selected={texturePreset === opt.value}
                                    onclick={() => (texturePreset = opt.value)}
                                >
                                    <Icon icon={opt.icon} class="text-lg" />
                                    <span class="m3-style-cell__name">{i18n(opt.labelKey)}</span>
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if displayConfig.layoutMode}`,
);

writeFileSync(f, c);
console.log("patched", n, "blocks");
