/**
 * 前端整页翻译的语言配置（单一数据源）。
 *
 * 2026-09-15：语言切换从「两态（中→EN）」升级为 Twilight 式多语言下拉面板，
 * 语言清单对齐 Twilight 的 LANGUAGE_CONFIG（14 种）。
 *
 * 注意区分两套翻译体系：
 * - 本站 UI 静态字符串词典 = src/i18n/languages/*.ts（en/es/id/ja/ko/th/tr/vi/zh_CN/zh_TW），
 *   由 i18n(I18nKey) 在构建期按 siteConfig.lang 解析，只影响界面文案；
 * - 整页机翻 = public/translate.js（xnx3/translate，MIT），把正文/标题等内容实时
 *   翻译到所选语言，语言代码为 translate.js v2 命名（"english"/"chinese_simplified"...）。
 * 本文件只服务后者（TranslateSwitch.svelte 的语言下拉清单）。
 *
 * 源语言 = 站点渲染语言（siteConfig.lang=zh_CN → chinese_simplified）。
 * 切换回源语言时调用 translate.reset() 干净还原，不刷新页面。
 */

export interface TranslateLanguageConfig {
	/** translate.js v2 语言代码（changeLanguage/translate.to 使用的值） */
	translateCode: string;
	/** 语言显示名称 */
	displayName: string;
	/** Intl.DateTimeFormat 使用的 locale */
	locale: string;
	/** 语言图标（国旗 emoji） */
	icon: string;
}

/** 支持的语言配置（单一数据源，顺序即下拉面板展示顺序） */
export const TRANSLATE_LANGUAGES: Record<string, TranslateLanguageConfig> = {
	zh_hans: {
		translateCode: "chinese_simplified",
		displayName: "简体中文",
		locale: "zh-Hans",
		icon: "🇨🇳",
	},
	zh_hant: {
		translateCode: "chinese_traditional",
		displayName: "繁體中文",
		locale: "zh-Hant",
		icon: "🇭🇰",
	},
	en: {
		translateCode: "english",
		displayName: "English",
		locale: "en-US",
		icon: "🇺🇸",
	},
	ja: {
		translateCode: "japanese",
		displayName: "日本語",
		locale: "ja-JP",
		icon: "🇯🇵",
	},
	ko: {
		translateCode: "korean",
		displayName: "한국어",
		locale: "ko-KR",
		icon: "🇰🇷",
	},
	ru: {
		translateCode: "russian",
		displayName: "Русский",
		locale: "ru-RU",
		icon: "🇷🇺",
	},
	de: {
		translateCode: "deutsch",
		displayName: "Deutsch",
		locale: "de-DE",
		icon: "🇩🇪",
	},
	fr: {
		translateCode: "french",
		displayName: "Français",
		locale: "fr-FR",
		icon: "🇫🇷",
	},
	es: {
		translateCode: "spanish",
		displayName: "Español",
		locale: "es-ES",
		icon: "🇪🇸",
	},
	tr: {
		translateCode: "turkish",
		displayName: "Türkçe",
		locale: "tr-TR",
		icon: "🇹🇷",
	},
	ar: {
		translateCode: "arabic",
		displayName: "العربية",
		locale: "ar-SA",
		icon: "🇸🇦",
	},
	th: {
		translateCode: "thai",
		displayName: "ไทย",
		locale: "th-TH",
		icon: "🇹🇭",
	},
	vi: {
		translateCode: "vietnamese",
		displayName: "Tiếng Việt",
		locale: "vi-VN",
		icon: "🇻🇳",
	},
	id: {
		translateCode: "indonesian",
		displayName: "Bahasa Indonesia",
		locale: "id-ID",
		icon: "🇮🇩",
	},
} as const;

/** 下拉面板展示列表（含 translateCode/名称/图标） */
export function getTranslateLanguageOptions() {
	return Object.values(TRANSLATE_LANGUAGES).map((lang) => ({
		code: lang.translateCode,
		name: lang.displayName,
		icon: lang.icon,
	}));
}

/** 站点渲染源语言对应的 translate.js 代码（站点 lang=zh_CN → 简体中文） */
export const SOURCE_TRANSLATE_LANG = "chinese_simplified";

/** 语言记忆存储键（与 Twilight 的 LANG_STORAGE_KEY 一致） */
export const LANG_STORAGE_KEY = "selected-language";

export function setStoredLanguage(lang: string): void {
	if (typeof localStorage !== "undefined") {
		localStorage.setItem(LANG_STORAGE_KEY, lang);
	}
}

export function getStoredLanguage(): string {
	if (typeof localStorage === "undefined") return SOURCE_TRANSLATE_LANG;
	return (
		localStorage.getItem(LANG_STORAGE_KEY) || SOURCE_TRANSLATE_LANG
	);
}
