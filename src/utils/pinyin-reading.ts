/**
 * 纯文字阅读版增强（2026-09-14，用户需求：《洛神赋》只留文字 + 每字注音）。
 *
 * 在 SSR 渲染链上对文章 HTML 做两步后处理（不动后端数据库内容）：
 *  1. 剥装饰：删掉文章 markdown 内嵌的 <style> 块与装饰元素
 *     （class 以 STRIP_CLASS_PREFIXES 开头，如《洛神赋》原作者写的 .lsf-stage 舞台/.lsf-petal 花瓣）；
 *  2. 注音：其余文本节点逐字转 <ruby>汉字<rt>拼音</rt></ruby>——
 *     pinyin-pro 按词组上下文消多音字（"朝霞"→zhāoxiá），非中文（标点/数字）原样保留。
 *
 * 触发由 articleConfig.pinyinReading.slugs 控制（posts/[slug].astro 调用），
 * pre/code/script 内文本不注音（代码语义优先）。
 */
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import { pinyin } from "pinyin-pro";
import type { Element, ElementContent, Root, RootContent } from "hast";

/** 装饰元素剥除规则：class 命中即整棵移除（.lsf-stage 舞台画；文末题注 .lsf-note 是文字，保留） */
const STRIP_CLASSES = new Set(["lsf-stage"]);
/** 这些元素内的文本不做注音 */
const SKIP_TAGS = new Set(["pre", "code", "script", "style", "kbd"]);

interface PinyinItem {
	origin: string;
	pinyin: string;
	isZh: boolean;
}

/** 文本 → （ruby 节点 | 纯文本）节点序列 */
function toRubyNodes(text: string): ElementContent[] {
	const items = pinyin(text, {
		type: "all",
		toneType: "symbol",
		nonZh: "consecutive",
	}) as PinyinItem[];
	return items.map((item) => {
		if (!item.isZh) return { type: "text", value: item.origin } as const;
		return {
			type: "element",
			tagName: "ruby",
			properties: {},
			children: [
				{ type: "text", value: item.origin },
				{
					type: "element",
					tagName: "rt",
					properties: {},
					children: [{ type: "text", value: item.pinyin }],
				},
			],
		} as const;
	});
}

const isDecorative = (node: Element): boolean => {
	const classes = node.properties?.className;
	if (!Array.isArray(classes)) return false;
	return classes.some((c) => typeof c === "string" && STRIP_CLASSES.has(c));
};

/** 原地遍历：insideSkip=处于 pre/code 等免注音元素内部；返回替换后的 children 数组 */
function transformChildren(
	children: Array<ElementContent | RootContent>,
	insideSkip = false,
): Array<ElementContent | RootContent> {
	const out: Array<ElementContent | RootContent> = [];
	for (const child of children) {
		if (child.type === "element") {
			const el = child as Element;
			const tag = el.tagName.toLowerCase();
			if (tag === "style" || isDecorative(el)) continue; // 剥装饰
			const skip = insideSkip || SKIP_TAGS.has(tag);
			el.children = transformChildren(el.children, skip); // 深入
			out.push(el);
		} else if (child.type === "text") {
			const value = (child as { value: string }).value;
			if (!insideSkip && /[\u4e00-\u9fff]/.test(value)) {
				out.push(...toRubyNodes(value));
			} else {
				out.push(child);
			}
		} else {
			out.push(child);
		}
	}
	return out;
}

/**
 * 文章 HTML → 纯文字阅读版 HTML（装饰剥除 + 逐字注音）。
 * 任一环节异常都回退原文（文章可读性永不因增强失败而受损）。
 */
export function enhancePinyinReading(html: string): string {
	try {
		const tree = fromHtml(html, { fragment: true }) as Root;
		tree.children = transformChildren(tree.children) as Root["children"];
		return toHtml(tree);
	} catch (e) {
		console.error("[pinyin-reading] enhance failed, fallback to raw:", e);
		return html;
	}
}
