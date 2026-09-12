/**
 * llms.txt / llms-full.txt 生成工具（移植自上游 Shirone，适配 API 数据源）。
 * 类型用 PostEntry 替代 CollectionEntry<"posts">。
 */
import { getPostUrl } from "./url-utils";
import type { PostEntry } from "./content-utils";
import type { LlmsConfig, LlmsCustomLink } from "@/types/llmsConfig";

const CODE_BLOCK_RE =
	/(?:^|\n)(?<marker>\s*(?:`{3,}|~{3,}))([\s\w-]*)\n[\s\S]*?\n\k<marker>(?:\n|$)/g;
const LLM_ONLY_RE = /<llm-only>([\s\S]*?)<\/llm-only>/gi;
const LLM_EXCLUDE_RE = /<llm-exclude>[\s\S]*?<\/llm-exclude>/gi;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const ENCRYPT_CONTAINER_RE =
	/(?:^|\n)\s*:{3,}\s*encrypt\b[\s\S]*?\n\s*:{3,}(?:\n|$)/gi;
const DIRECTIVE_CONTAINER_RE =
	/(?:^|\n)\s*:{3,}\s*([\w-]+)(?:\[(.*?)\])?(?:\{.*?\})?\s*\n([\s\S]*?)\n\s*:{3,}(?:\n|$)/g;

/** 清洗 Markdown 源码，去除 HTML 噪音与复杂交互容器，输出对 LLM 友好的纯净 Markdown */
export function cleanMarkdownForLLM(rawMarkdown: string): string {
	if (!rawMarkdown || typeof rawMarkdown !== "string") return "";

	const placeholders: Record<string, string> = {};
	let counter = 0;

	let content = rawMarkdown.replace(CODE_BLOCK_RE, (match) => {
		const key = `__LLMS_CODE_BLOCK_${counter++}__`;
		placeholders[key] = match;
		return `\n${key}\n`;
	});

	content = content.replace(ENCRYPT_CONTAINER_RE, "\n");
	content = content.replace(LLM_ONLY_RE, "$1");
	content = content.replace(LLM_EXCLUDE_RE, "");
	content = content.replace(HTML_COMMENT_RE, "");

	content = content.replace(
		DIRECTIVE_CONTAINER_RE,
		(_match, name, label, body) => {
			const type = String(name).toLowerCase();
			const cleanBody = body ? body.trim() : "";

			if (["note", "tip", "important", "warning", "caution"].includes(type)) {
				const header = label
					? `**[${label}]**\n`
					: `**[${type.toUpperCase()}]**\n`;
				const quoted = cleanBody
					.split("\n")
					.map((line: string) => `> ${line}`)
					.join("\n");
				return `\n> ${header}${quoted}\n`;
			}

			if (type === "details") {
				const header = label ? `### ${label}\n\n` : "";
				return `\n${header}${cleanBody}\n`;
			}

			if (
				["code-group", "tabs", "file-tree", "steps", "card", "field", "card-grid", "field-group"].includes(type)
			) {
				return `\n${cleanBody}\n`;
			}

			return `\n${cleanBody}\n`;
		},
	);

	for (const [key, code] of Object.entries(placeholders)) {
		content = content.replace(key, code.trim());
	}

	return content.replace(/\n{3,}/g, "\n\n").trim();
}

export function truncateDescription(desc: string, maxLen = 200): string {
	if (!desc) return "";
	const singleLine = desc.replace(/\s+/g, " ").trim();
	if (singleLine.length <= maxLen) return singleLine;
	return `${singleLine.slice(0, maxLen - 1)}…`;
}

export function toAbsoluteUrl(url: string, baseUrl: string): string {
	if (url.startsWith("http://") || url.startsWith("https://")) {
		return url;
	}
	const cleanBase = baseUrl.replace(/\/$/, "");
	const cleanPath = url.startsWith("/") ? url : `/${url}`;
	return `${cleanBase}${cleanPath}`;
}

export interface GenerateLlmsTxtOptions {
	posts: PostEntry[];
	baseUrl: string;
	config: LlmsConfig;
	siteTitle: string;
	siteSummary: string;
}

/** 生成 /llms.txt 目录索引 Markdown 文本 */
export function generateLlmsTxt(options: GenerateLlmsTxtOptions): string {
	const { posts, baseUrl, config, siteTitle, siteSummary } = options;
	const maxLen = config.descriptionMaxLength ?? 200;

	let output = `# ${siteTitle}\n\n`;
	if (siteSummary) {
		output += `> ${siteSummary.replace(/\s+/g, " ").trim()}\n\n`;
	}

	output += `This is the llms.txt file for ${siteTitle}. It provides a machine-readable directory of published articles and core pages for Large Language Models.\n\n`;

	const corePages: LlmsCustomLink[] = config.corePages ?? [];
	if (corePages.length > 0) {
		output += "## Core Pages\n";
		for (const page of corePages) {
			const fullUrl = toAbsoluteUrl(page.url, baseUrl);
			const desc = page.description
				? `: ${truncateDescription(page.description, maxLen)}`
				: "";
			output += `- [${page.title}](${fullUrl})${desc}\n`;
		}
		output += "\n";
	}

	if (config.customSections?.length) {
		for (const section of config.customSections) {
			if (!section.items?.length) continue;
			output += `## ${section.title}\n`;
			if (section.description) {
				output += `${section.description}\n\n`;
			}
			for (const item of section.items) {
				const fullUrl = toAbsoluteUrl(item.url, baseUrl);
				const desc = item.description
					? `: ${truncateDescription(item.description, maxLen)}`
					: "";
				output += `- [${item.title}](${fullUrl})${desc}\n`;
			}
			output += "\n";
		}
	}

	if (posts.length > 0) {
		output += "## Articles\n";
		for (const post of posts) {
			const postUrl = toAbsoluteUrl(getPostUrl(post), baseUrl);
			const rawDesc = post.data.description || "";
			const desc = rawDesc ? `: ${truncateDescription(rawDesc, maxLen)}` : "";
			output += `- [${post.data.title}](${postUrl})${desc}\n`;
		}
		output += "\n";
	}

	if (config.generateFull !== false) {
		output += "## Full Text Dump\n";
		const fullUrl = toAbsoluteUrl("/llms-full.txt", baseUrl);
		output += `- [Full Text Archive](${fullUrl}): Complete, concatenated Markdown content of all public articles for full-context ingestion.\n`;
	}

	return output.trim();
}

export interface GenerateLlmsFullTxtOptions {
	posts: PostEntry[];
	baseUrl: string;
	config: LlmsConfig;
	siteTitle: string;
}

/** 生成 /llms-full.txt 全量公开正文聚合纯文本 */
export function generateLlmsFullTxt(
	options: GenerateLlmsFullTxtOptions,
): string {
	const { posts, baseUrl, siteTitle } = options;
	const dateStr = new Intl.DateTimeFormat("en-CA").format(new Date());

	let output = `# ${siteTitle} - Full Content Archive\n\n`;
	output += `> Generated on ${dateStr}. Contains full text of all public articles for LLM ingestion.\n\n`;

	for (const post of posts) {
		const postUrl = toAbsoluteUrl(getPostUrl(post), baseUrl);
		const pubDate = post.data.published
			? new Intl.DateTimeFormat("en-CA").format(new Date(post.data.published))
			: "";

		output += "---\n\n";
		output += `## ${post.data.title}\n\n`;
		output += `- **URL**: ${postUrl}\n`;
		if (pubDate) output += `- **Published**: ${pubDate}\n`;
		if (post.data.category) output += `- **Category**: ${post.data.category}\n`;
		if (post.data.tags?.length)
			output += `- **Tags**: ${post.data.tags.join(", ")}\n`;
		if (post.data.description)
			output += `- **Description**: ${post.data.description}\n`;
		output += "\n";

		const cleanedBody = cleanMarkdownForLLM(post.body || "");
		if (cleanedBody) {
			output += `${cleanedBody}\n\n`;
		}
	}

	return output.trim();
}
