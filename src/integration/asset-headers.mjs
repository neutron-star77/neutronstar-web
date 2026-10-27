/**
 * pageLinkPreloadIntegration —— 构建收尾时给每个预渲染 HTML 页生成独立规则，
 * 写入 dist/client/_headers：Cache-Control（max-age=300 + SWR，让 hover/viewport
 * 预取的副本在浏览器里保持新鲜，swup 点按零网络）+ `Link: <...>; rel=preload;
 * as=style`（Cloudflare 对边缘缓存的资产响应自动转 103 Early Hints，CSS 下载与
 * HTML 传输并行，冷访问首屏省 1 个 RTT；浏览器也会按响应头 preload 并去重）。
 *
 * 为什么不能写进 public/_headers：CSS 文件名带内容哈希，每次构建都变，
 * 只能在 astro:build:done 时从产物 HTML 里提取后追加。
 *
 * ⚠ 每页一条独立规则，不用 /* 兜底：workerd/CF 对同路径多条规则的同名响应头是
 * 拼接而非覆盖（public/_headers 文件头有说明），互不重叠才能保证头干净。
 *
 * 规则共存：public/_headers（/_astro、pagefind 等目录规则）先被 Astro 拷进
 * dist/client，本集成只读改写（剥离旧生成段 → 追加新段）；@astrojs/cloudflare
 * 的 astro:build:done 因已有匹配 /_astro 的 Cache-Control 规则而跳过注入，
 * 所以无论两个钩子谁先执行，结果都一致。
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const MARKER_START = "# >>> 页面级 CSS 预加载（page-link-preload 集成自动生成，勿手改）>>>";
const MARKER_END = "# <<< 页面级 CSS 预加载 <<<";

/** dist 内相对路径 → 站点 URL（trailingSlash: always，目录页以 / 结尾） */
function htmlRelToUrl(relPosix) {
	if (relPosix === "index.html") return "/";
	if (relPosix.endsWith("/index.html")) return `/${relPosix.slice(0, -"index.html".length)}`;
	return `/${relPosix}`;
}

/** 从一份 HTML 里提取全部站内 stylesheet link 的 href（保序去重） */
function extractStylesheetHrefs(html) {
	const hrefs = [];
	for (const tag of html.match(/<link\b[^>]*>/g) ?? []) {
		if (!/rel=["']stylesheet["']/.test(tag)) continue;
		const href = tag.match(/href=["']([^"']+)["']/)?.[1];
		if (href && href.startsWith("/") && !href.startsWith("//") && !hrefs.includes(href)) {
			hrefs.push(href);
		}
	}
	return hrefs;
}

function walkHtmlFiles(dir, out) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) walkHtmlFiles(full, out);
		else if (entry.name.endsWith(".html")) out.push(full);
	}
}

export function pageLinkPreloadIntegration() {
	let clientDir = "";
	return {
		name: "neutronstar-page-link-preload",
		hooks: {
			"astro:config:done": ({ config }) => {
				clientDir = fileURLToPath(config.build.client);
			},
			"astro:build:done": ({ logger }) => {
				const rules = [];
				const files = [];
				walkHtmlFiles(clientDir, files);
				for (const file of files) {
					const relPosix = relative(clientDir, file).split("\\").join("/");
					const hrefs = extractStylesheetHrefs(readFileSync(file, "utf8"));
					if (hrefs.length > 0) {
						const link = hrefs.map((h) => `<${h}>; rel=preload; as=style`).join(", ");
						rules.push(
							`${htmlRelToUrl(relPosix)}\n  Cache-Control: public, max-age=300, stale-while-revalidate=86400\n  Link: ${link}`,
						);
					}
				}

				const headersPath = join(clientDir, "_headers");
				let existing = "";
				try {
					existing = readFileSync(headersPath, "utf8");
				} catch {
					existing = "";
				}
				const section = rules.length
					? `${MARKER_START}\n${rules.join("\n")}\n${MARKER_END}\n`
					: "";
				// 幂等：先剥掉上次生成段再追加，重复构建不累积
				const cleaned = existing
					.replace(new RegExp(`${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\n?`), "")
					.replace(/\n*$/, "\n");
				writeFileSync(headersPath, cleaned.replace(/\n*$/, "\n") + (cleaned && section ? "\n" : "") + section);
				logger.info(`_headers: 已为 ${rules.length}/${files.length} 个页面写入 CSS Link preload（Early Hints）`);
			},
		},
	};
}
