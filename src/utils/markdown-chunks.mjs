/**
 * 长文分块与轻量 TOC 提取。
 *
 * 背景：262KB+ 的文章在 Worker 端跑全量 remark/rehype 插件链会触发 1102（CPU 超限）。
 * 策略：
 * - 按 h2（## ）把 markdown 切成 chunks；
 * - SSR 首屏只渲染累计 ~15KB 以内的前若干 chunk，保证 CPU 预算够用；
 * - TOC 用正则直接从 markdown 抓 h2-h4，slug 规则与 rehype-slug（github-slugger）一致；
 * - 后续 chunk 通过 /api/posts/<slug>/chunk/<n> 逐段拉取。
 */

/** 首屏累计 markdown 字符数阈值：超过此值的 chunk 走懒加载。 */
export const FIRST_SCREEN_CHAR_LIMIT = 15000;

/**
 * 按 ^## 把 markdown 切成 chunks。
 * 第一个 chunk 包含文档开头（# 一级标题 + 前言 + 第一个 ## 段）。
 * @param {string} markdown
 * @returns {string[]}
 */
export function splitMarkdownByH2(markdown) {
	const md = String(markdown || "");
	const parts = md.split(/^(?=##\s)/m);
	if (parts.length <= 1) {
		return md.trim() ? [md] : [];
	}
	parts[1] = parts[0] + parts[1];
	parts.shift();
	return parts.map(p => p.trim()).filter(Boolean);
}

/**
 * 首屏渲染哪几个 chunk：累计字符数不超过 FIRST_SCREEN_CHAR_LIMIT。
 * @param {string[]} chunks
 * @returns {number} 首屏渲染的 chunk 数量
 */
export function pickFirstScreenChunks(chunks) {
	let total = 0;
	for (let i = 0; i < chunks.length; i++) {
		total += chunks[i].length;
		if (total > FIRST_SCREEN_CHAR_LIMIT) return Math.max(1, i);
	}
	return chunks.length;
}

/**
 * 复刻 github-slugger 的 slug 规则（rehype-slug 同款）：
 * 小写 → 去掉非 \w\- 空格字符 → 空格变 -；重复标题追加 -1/-2 后缀。
 * @param {string} text
 * @param {Set<string>} used
 */
function slugify(text, used) {
	let base = text
		.toLowerCase()
		.replace(/[^\w\- ]+/g, "")
		.replace(/\s+/g, "-");
	if (!used.has(base)) {
		used.add(base);
		return base;
	}
	let i = 1;
	while (used.has(`${base}-${i}`)) i++;
	const slug = `${base}-${i}`;
	used.add(slug);
	return slug;
}

/**
 * 从 markdown 全文正则提取 h2-h4 大纲。
 * slug 规则与 rehype-slug 生成的 id 一致，保证 TOC 锚点跳转正确。
 * @param {string} markdown
 * @returns {Array<{depth:number, slug:string, text:string}>}
 */
export function extractOutline(markdown) {
	const md = String(markdown || "");
	const used = new Set();
	const headings = [];
	// 跳过 fenced code block 里的 # 行
	const lines = md.split("\n");
	let inCode = false;
	for (const line of lines) {
		if (/^```/.test(line.trim())) {
			inCode = !inCode;
			continue;
		}
		if (inCode) continue;
		const m = line.match(/^(#{2,4})\s+(.+?)\s*#*$/);
		if (!m) continue;
		const depth = m[1].length;
		const text = m[2].trim();
		// 去掉 markdown 行内语法（粗体/链接/代码）
		const clean = text
			.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
			.replace(/[*_`~]/g, "")
			.trim();
		if (!clean) continue;
		headings.push({ depth, slug: slugify(clean, used), text: clean });
	}
	return headings;
}
