// @ts-check
import { existsSync, readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import cloudflare from "@astrojs/cloudflare";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import swup from "@swup/astro";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import expressiveCode from "astro-expressive-code";
import icon from "astro-icon";
import react from "@astrojs/react";
import { expressiveCodeConfig } from "./src/config/expressiveCodeConfig.ts";
import { resolvedFontOptions } from "./src/config/fontConfig.ts";
import { musicConfig, resolveMusicOptions } from "./src/config/musicConfig.ts";
import { sidebarConfig } from "./src/config/sidebarConfig.ts";
import { siteConfig } from "./src/config/siteConfig.ts";
import { resolveUmamiOptions, umamiConfig } from "./src/config/umamiConfig.ts";
import { pluginCustomCopyButton } from "./src/plugins/expressive-code/custom-copy-button.js";
import { pluginLanguageBadge } from "./src/plugins/expressive-code/language-badge.ts";
import { getLocalFontVariants } from "./src/utils/font-options.ts";
import { siteMarkdownProcessor } from "./src/utils/markdown-processor.mjs";
import { shironesSsrNodeShims } from "./src/integration/ssr-node-shims.ts";

// 渲染策略（Astro 7）：output "static" = 默认全部预渲染；
// 需要实时的页面在 frontmatter 写 `export const prerender = false`（等价于旧版 hybrid 语义）。
// 图片统一走中间层 /img/*，构建期不处理远程图 → imageService: passthrough

const musicWidgetEnabled =
	sidebarConfig.enable &&
	sidebarConfig.components.some(
		(widget) => widget.type === "music" && widget.enable,
	);
const musicFeatureEnabled =
	resolveMusicOptions(musicConfig) !== null && musicWidgetEnabled;

const resolvedUmamiOptions = resolveUmamiOptions(umamiConfig);
const umamiIntegration = resolvedUmamiOptions
	? (await import("oddmisc/astro")).oddmisc({
			umami: {
				shareUrl: resolvedUmamiOptions.shareUrl,
			},
		})
	: null;
const musicSidebarModuleId = "virtual:shirone-music-sidebar";
const resolvedMusicSidebarModuleId = `\0${musicSidebarModuleId}`;

const optionalMusicSidebarPlugin = {
	name: "shirone-optional-music-sidebar",
	enforce: "pre",
	resolveId(source) {
		return source === musicSidebarModuleId
			? resolvedMusicSidebarModuleId
			: null;
	},
	load(id) {
		if (id !== resolvedMusicSidebarModuleId) return null;
		return musicFeatureEnabled
			? 'export { default } from "/src/components/organisms/music/MusicSidebar.astro";'
			: "export default null;";
	},
	generateBundle(_options, bundle) {
		if (!musicFeatureEnabled) {
			for (const fileName of Object.keys(bundle)) {
				if (
					fileName.includes("MusicSidebarClient") ||
					fileName.startsWith("_astro/music.") ||
					fileName.includes("/music.")
				) {
					delete bundle[fileName];
				}
			}
		}
	},
};

const isBuildCommand = process.argv.includes("build");
const isDevCommand = process.argv.includes("dev");
const iconifyOfflineIconPath = fileURLToPath(
	new URL("./node_modules/@iconify/svelte/dist/OfflineIcon.svelte", import.meta.url),
);
const iconifyOfflineFunctionsPath = fileURLToPath(
	new URL("./node_modules/@iconify/svelte/dist/offline-functions.js", import.meta.url),
);

function resolveVariantSrc(file) {
	if (isBuildCommand && resolvedFontOptions.subsetting?.enable) {
		const ext = extname(file);
		const baseName = basename(file, ext);
		const subsetPath = `src/assets/fonts/.subset/${baseName}.subset.woff2`;
		if (existsSync(subsetPath)) {
			return `./${subsetPath}`;
		}
		throw new Error(
			`[font-system] Missing required subset font: ${subsetPath}. ` +
				"Font subsetting is enabled for production builds, but the subset file was not found. " +
				"Ensure 'pnpm.cmd fonts:subset' ran successfully before building.",
		);
	}
	return `./${file}`;
}

/**
 * P1 离线字体方案：不走 fontsource 远程 provider（构建期要从 cdn.jsdelivr.net
 * 下载字体文件，本机网络不稳定），改为解析本地安装的 @fontsource 包内 CSS，
 * 把每个 @font-face 块转成 local provider 的 variant（woff2 + unicode-range）。
 */
function fontsourceCssToLocalVariants(pkgCssPath, display) {
	const pkgRoot = pkgCssPath.split("/").slice(0, 2).join("/");
	const cssPath = fileURLToPath(
		new URL(`./node_modules/${pkgCssPath}`, import.meta.url),
	);
	const css = readFileSync(cssPath, "utf8");
	const variants = [];
	for (const block of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
		const src = block.match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1];
		const weight = block.match(/font-weight:\s*([^;]+);/)?.[1]?.trim();
		const style = block.match(/font-style:\s*([^;]+);/)?.[1]?.trim();
		const unicodeRange = block.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim();
		if (!src) continue;
		variants.push({
			src: [`./node_modules/${pkgRoot}/files/${src}`],
			weight,
			style,
			display,
			...(unicodeRange ? { unicodeRange: unicodeRange.split(",").map((r) => r.trim()) } : {}),
		});
	}
	if (variants.length === 0) {
		throw new Error(
			`[font-system] No @font-face woff2 found in node_modules/${pkgCssPath}`,
		);
	}
	return variants;
}

const configuredFonts =
	resolvedFontOptions.mode === "custom"
		? ["body", "cjk", "mono"].flatMap((role) => {
				const resolvedRole = resolvedFontOptions.roles[role];
				if (!resolvedRole.family) return [];

				const isCompositeSans = role === "body" || role === "cjk";
				// P1：全部角色关闭 optimizedFallbacks——该开关在构建期要联网抓取
				// fontsource CDN 的字体度量（capsize），离线/弱网构建直接失败。
				const fallbackOpts = {
					...(isCompositeSans ? { fallbacks: [] } : {}),
					optimizedFallbacks: false,
				};

				const localVariants = getLocalFontVariants(resolvedFontOptions, role);
				if (localVariants.length > 0) {
					return [
						{
							provider: fontProviders.local(),
							name: resolvedRole.family,
							cssVariable: resolvedRole.cssVariable,
							options: {
								variants: localVariants.map((variant) => ({
									src: [resolveVariantSrc(variant.file)],
									weight: variant.weight,
									style: variant.style,
									display: resolvedRole.display,
									...(variant.subset ? { subset: variant.subset } : {}),
									...(variant.unicodeRange
										? { unicodeRange: variant.unicodeRange }
										: {}),
								})),
							},
							...fallbackOpts,
						},
					];
				}

				const fontsourceVariants = resolvedRole.variants.filter(
					(v) => v.source === "fontsource",
				);
				if (fontsourceVariants.length > 0) {
					return [
						{
							provider: fontProviders.local(),
							name: resolvedRole.family,
							cssVariable: resolvedRole.cssVariable,
							options: {
								variants: fontsourceVariants.flatMap((v) =>
									fontsourceCssToLocalVariants(v.file, resolvedRole.display),
								),
							},
							...fallbackOpts,
						},
					];
				}

				return [];
			})
		: [];

// https://astro.build/config
export default defineConfig({
	site: siteConfig.site,
	base: siteConfig.base ?? "/",
	trailingSlash: "always",
	fonts: configuredFonts,
	adapter: cloudflare({
		// 构建期用 sharp 处理图片（出静态 /_astro URL，等价上游 static 站行为）；
		// 运行时 passthrough：SSR 页的远程图不处理，交给 BFF /img/*。
		// 纯 passthrough 会把图片处理推给 /_image 运行时端点——纯预渲染部署下该端点不存在（404）。
		imageService: { build: "compile", runtime: "passthrough" },
	}),
	integrations: [
		react(),
		...(umamiIntegration ? [umamiIntegration] : []),
		swup({
			theme: false,
			ignore: 'a[href="#"]',
			animationClass: "transition-swup-",
			containers: ["main", "#toc"],
			smoothScrolling: true,
			cache: true,
			preload: true,
			accessibility: true,
			updateHead: {
				awaitAssets: false,
				// Keep base styles across Swup visits, but let syntax-scoped styles
				// disappear when the destination page no longer declares them.
				persistTags:
					"link[rel=stylesheet]:not([data-swup-optional]), style:not([data-swup-optional])",
			},
			updateBodyClass: false,
			globalInstance: true,
			animateHistoryBrowsing: false,
			skipPopStateHandling: (event) => Boolean(event.state?.url?.includes("#")),
		}),
		icon({
			include: {
				"preprocess: vitePreprocess(),": ["*"],
				"fa6-brands": ["*"],
				"fa6-regular": ["*"],
				"fa6-solid": ["*"],
			},
		}),
		expressiveCode({
			themes: [
				expressiveCodeConfig.lightTheme ?? expressiveCodeConfig.theme,
				expressiveCodeConfig.darkTheme ?? expressiveCodeConfig.theme,
			],
			plugins: [
				pluginCollapsibleSections(),
				pluginLineNumbers(),
				pluginLanguageBadge(),
				pluginCustomCopyButton(),
			],
			defaultProps: {
				wrap: true,
				overridesByLang: {
					shellsession: {
						showLineNumbers: false,
					},
				},
			},
			styleOverrides: {
				codeBackground: "var(--codeblock-bg)",
				borderRadius: "0.75rem",
				borderColor: "none",
				codeFontSize: "0.875rem",
				codeFontFamily: "var(--m3e-font-mono-family)",
				codeLineHeight: "1.5rem",
				frames: {
					editorBackground: "var(--codeblock-bg)",
					terminalBackground: "var(--codeblock-bg)",
					terminalTitlebarBackground: "var(--codeblock-topbar-bg)",
					editorTabBarBackground: "var(--codeblock-topbar-bg)",
					editorActiveTabBackground: "none",
					editorActiveTabIndicatorBottomColor: "var(--primary)",
					editorActiveTabIndicatorTopColor: "none",
					editorTabBarBorderBottomColor: "var(--codeblock-topbar-bg)",
					terminalTitlebarBorderBottomColor: "none",
				},
				textMarkers: {
					delHue: 0,
					insHue: 180,
					markHue: 250,
				},
			},
			frames: {
				showCopyToClipboardButton: false,
			},
		}),
		svelte({
			compilerOptions: {
				// CSS-source hashing keeps SSR and client scope hashes stable after moves.
				cssHash: ({ css, hash }) => `svelte-${hash(css)}`,
				// Keep repeated Svelte compiler diagnostics out of the dev terminal;
				// check/build still surface the full warning set in CI.
				warningFilter: () => !isDevCommand,
			},
		}),
		sitemap(),
		mdx({
			syntaxHighlight: false,
			optimize: true,
		}),
	],
	markdown: {
		processor: siteMarkdownProcessor,
	},
	vite: {
		resolve: {
			alias: [
				{
					find: "@shirone/iconify-offline",
					replacement: iconifyOfflineIconPath,
				},
				{
					find: "@shirone/iconify-offline-functions",
					replacement: iconifyOfflineFunctionsPath,
				},
				{
					find: /^@iconify\/svelte$/,
					replacement: fileURLToPath(
						new URL(
							"./src/components/atoms/display/Icon.svelte",
							import.meta.url,
						),
					),
				},
			],
		},
		plugins: [optionalMusicSidebarPlugin, shironesSsrNodeShims(), tailwindcss()],
		optimizeDeps: {
			include: [
				"mermaid",
				"@panzoom/panzoom",
				"overlayscrollbars",
				"@fancyapps/ui",
			],
		},
		build: {
			minify: "esbuild",
			cssCodeSplit: true,
			cssMinify: "esbuild",
			chunkSizeWarningLimit: 1000,
			esbuild: isBuildCommand
				? {
						drop: ["debugger"],
						pure: ["console.log", "console.debug"],
					}
				: undefined,
			rollupOptions: {
				onwarn(warning, warn) {
					if (
						warning.message.includes("is dynamically imported by") &&
						warning.message.includes("but also statically imported by")
					) {
						return;
					}
					warn(warning);
				},
			},
		},
	},
});
