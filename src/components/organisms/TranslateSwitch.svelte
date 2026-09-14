<script lang="ts">
/**
 * 顶栏整页翻译切换（2026-09-15 升级：两态 → Twilight 式多语言下拉面板）。
 *
 * 底层 = translate.js v4.x（xnx3/translate，MIT），vendor 于 /public/translate.js，
 * 与 Twilight 的 src/plugins/translate.js 同源同款（客户端机翻，无需 API key）。
 *
 * 交互（对齐 Twilight translator.svelte + 本站显示设置面板的 hover 动线）：
 *   桌面（≥1024px）：悬停图标立即展开语言面板；鼠标移出图标+面板区域
 *   260ms 后收回——鼠标停留在菜单上则保持展开。
 *   移动端：点击图标开合面板。
 *   面板列出 14 种语言（国旗 emoji + 名称 + 当前勾选），点击即整页机翻，
 *   选择「简体中文（源语言）」调用 translate.reset() 干净还原，不刷新页面。
 *   localStorage（selected-language）记忆选择，刷新/回访自动恢复。
 *   swup 换页后的新内容由 listener.start() 自动跟进翻译。
 *
 * 语言清单与 translate 服务代码见 src/i18n/languageConfig.ts（单一数据源）。
 */
import Icon from "@iconify/svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { onMount } from "svelte";
import "@/utils/register-local-icons";
import {
	getStoredLanguage,
	getTranslateLanguageOptions,
	LANG_STORAGE_KEY,
	SOURCE_TRANSLATE_LANG,
	setStoredLanguage,
} from "@i18n/languageConfig";

type TranslateGlobal = {
	language: {
		setLocal: (lang: string) => void;
		setDefaultTo: (lang: string) => void;
	};
	selectLanguageTag: { show: boolean };
	listener: { start: () => void };
	changeLanguage: (lang: string) => void;
	reset: () => void;
	ignore: { class: { data: string[] }; tag: string[] };
};

const languages = getTranslateLanguageOptions();
let isOpen = $state(false);
let currentLanguage = $state(SOURCE_TRANSLATE_LANG);
let busy = $state(false);
let hoverCloseTimer: number | null = null;

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
		// 桌面：hover 已负责展开，点击仅作开合切换（与 Twilight 一致）
		isOpen = !isOpen;
		if (isOpen) openPanel();
	} else {
		isOpen = !isOpen;
	}
}

async function ensureLib(): Promise<TranslateGlobal> {
	const w = window as unknown as { translate?: TranslateGlobal };
	if (w.translate) return w.translate;
	await new Promise<void>((resolve, reject) => {
		const s = document.createElement("script");
		s.src = "/translate.js";
		s.onload = () => resolve();
		s.onerror = () => reject(new Error("translate.js load failed"));
		document.head.appendChild(s);
	});
	if (!w.translate) throw new Error("translate.js unavailable");
	return w.translate;
}

/** 应用一次翻译（幂等：重复选择同一语言仅重翻，不重复 push ignore 配置） */
async function applyTranslation(code: string) {
	const t = await ensureLib();
	t.selectLanguageTag.show = false; // 不出现内置下拉，走顶栏按钮
	t.language.setLocal(SOURCE_TRANSLATE_LANG);
	if (!t.ignore.class.data.includes("notranslate")) {
		t.ignore.class.data.push("notranslate"); // 代码块/公式等由 class 豁免
	}
	if (!t.ignore.tag.includes("pre")) t.ignore.tag.push("pre");
	if (!t.ignore.tag.includes("code")) t.ignore.tag.push("code");
	t.listener.start(); // swup 换页后自动翻译新渲染内容
	t.changeLanguage(code);
}

async function changeLanguage(code: string) {
	if (busy) return;
	busy = true;
	setStoredLanguage(code);
	currentLanguage = code;
	isOpen = false;
	try {
		if (code === SOURCE_TRANSLATE_LANG) {
			// 切回源语言：translate.reset() 干净还原（不刷新页面）
			const w = window as unknown as { translate?: TranslateGlobal };
			if (w.translate) w.translate.reset();
		} else {
			await applyTranslation(code);
		}
	} catch {
		// 加载/翻译失败静默复位，不影响页面
	} finally {
		busy = false;
	}
}

onMount(() => {
	// 恢复记忆语言：非源语言时静默加载并执行整页翻译（对齐 Twilight initTranslateService）
	currentLanguage = getStoredLanguage();
	if (currentLanguage !== SOURCE_TRANSLATE_LANG) {
		void applyTranslation(currentLanguage).catch(() => {});
	}
});
</script>

<div
	class="relative z-50 flex items-center"
	onmouseenter={onContainerEnter}
	onmouseleave={onContainerLeave}
>
	<button
		type="button"
		class="m3-icon-button m3-icon-button--standard m3-icon-button--round m3-state-layer shrink-0 {currentLanguage !==
		SOURCE_TRANSLATE_LANG
			? 'text-[var(--primary)]'
			: ''}"
		aria-label={i18n(I18nKey.translatePage)}
		title={i18n(I18nKey.translatePage)}
		aria-expanded={isOpen}
		onclick={onButtonClick}
	>
		<Icon icon="material-symbols:translate" class="text-[1.25rem]"></Icon>
	</button>

	<div
		class={["float-panel absolute top-full right-0 pt-2 w-64 max-w-[calc(100vw-2rem)] transition-all", !isOpen ? "float-panel-closed" : ""].join(" ")}
	>
		<div class="p-2">
			<div class="px-3 py-2 text-sm font-medium text-[var(--primary)]">
				{i18n(I18nKey.selectLanguage)}
			</div>
			<div class="max-h-72 overflow-y-auto overscroll-contain">
				{#each languages as lang (lang.code)}
					<button
						type="button"
						class={[
							"flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
							currentLanguage === lang.code
								? "bg-[var(--secondary-container)] text-[var(--on-secondary-container)]"
								: "text-[var(--on-surface)] hover:bg-[color-mix(in_oklab,var(--on-surface)_8%,transparent)]",
						].join(" ")}
						class:selected={currentLanguage === lang.code}
						onclick={() => changeLanguage(lang.code)}
					>
						<span class="text-lg leading-none" aria-hidden="true">{lang.icon}</span>
						<span class="grow">{lang.name}</span>
						{#if currentLanguage === lang.code}
							<Icon icon="material-symbols:check-rounded" class="text-[1.125rem]"></Icon>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	</div>
</div>
