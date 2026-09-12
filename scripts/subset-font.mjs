/**
 * 字体子集化脚本（适配 API 数据源）。
 *
 * 与上游 Shirone 的差异：文章内容来自后端 API 而非 src/content/，
 * 所以文本采集改为调用 BFF /api/posts 拉全量正文。
 *
 * 用法：node scripts/subset-font.mjs
 * 输出：src/assets/fonts/Yozai-Medium.subset.woff2
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const API_BASE = process.env.PUBLIC_API_BASE ?? "https://bff.neutronstar.fun";

async function collectText() {
	const charSet = new Set();

	// 1. ASCII 可打印字符
	for (let code = 32; code <= 126; code++) charSet.add(String.fromCharCode(code));

	// 2. 常用中日文标点
	const commonSymbols = "，。！？；：、‘’“”【】《》（）—…·「」『』〔〕｛｝〜～￥$€£%^&*+-*/=<>#@~`|\\_　";
	for (const ch of commonSymbols) charSet.add(ch);

	// 3. 从 API 拉全量已发布文章（含正文）
	try {
		console.log(`[subset] Fetching posts from ${API_BASE}/api/posts...`);
		const list = await fetch(`${API_BASE}/api/posts?status=published&page=1&size=200`).then((r) => r.json());
		console.log(`[subset] Got ${list.length} posts`);
		for (const post of list) {
			const text = `${post.title ?? ""} ${post.description ?? ""} ${post.category ?? ""} ${(post.tags ?? []).join(" ")}`;
			for (const ch of text) if (ch.charCodeAt(0) > 31) charSet.add(ch);
			// 拉单篇正文
			try {
				const detail = await fetch(`${API_BASE}/api/posts/${encodeURIComponent(post.slug)}`).then((r) => r.json());
				if (detail?.content) {
					for (const ch of detail.content) if (ch.charCodeAt(0) > 31) charSet.add(ch);
				}
			} catch {
				// 单篇失败不阻塞
			}
		}
	} catch (e) {
		console.warn(`[subset] Failed to fetch posts: ${e.message}`);
	}

	// 4. 扫描 i18n（中文词典为主，全扫也不贵）
	const i18nDir = join(projectRoot, "src/i18n/languages");
	if (existsSync(i18nDir)) {
		const { readdir, readFile } = await import("node:fs/promises");
		const files = await readdir(i18nDir);
		for (const f of files) {
			if (f.endsWith(".ts")) {
				const text = await readFile(join(i18nDir, f), "utf8");
				for (const ch of text) if (ch.charCodeAt(0) > 31) charSet.add(ch);
			}
		}
	}

	// 5. 扫描 config（导航标题等）
	const configDir = join(projectRoot, "src/config");
	if (existsSync(configDir)) {
		const { readdir, readFile } = await import("node:fs/promises");
		const files = await readdir(configDir);
		for (const f of files) {
			if (f.endsWith(".ts")) {
				const text = await readFile(join(configDir, f), "utf8");
				for (const ch of text) if (ch.charCodeAt(0) > 31) charSet.add(ch);
			}
		}
	}

	return Array.from(charSet).sort().join("");
}

async function main() {
	const sourcePath = join(projectRoot, "src/assets/fonts/Yozai-Medium.ttf");
	if (!existsSync(sourcePath)) {
		console.error(`[subset] Source font not found: ${sourcePath}`);
		process.exit(1);
	}

	const text = await collectText();
	console.log(`[subset] Collected ${text.length} unique characters`);

	// 保存字符集备查
	const subsetDir = join(projectRoot, "src/assets/fonts/.subset");
	mkdirSync(subsetDir, { recursive: true });
	writeFileSync(join(subsetDir, "charset.txt"), text, "utf8");

	const sourceFont = readFileSync(sourcePath);
	const originalKB = (sourceFont.length / 1024).toFixed(0);
	console.log(`[subset] Source: ${originalKB} KB, subsetting...`);

	const subsetBuffer = await subsetFont(sourceFont, text, { targetFormat: "woff2" });
	const outputPath = join(projectRoot, "src/assets/fonts/Yozai-Medium.subset.woff2");
	writeFileSync(outputPath, subsetBuffer);
	const subsetKB = (subsetBuffer.length / 1024).toFixed(0);
	const reduction = ((1 - subsetBuffer.length / sourceFont.length) * 100).toFixed(1);

	console.log(`[subset] Output: ${subsetKB} KB (-${reduction}%)`);
	console.log(`[subset] Saved to: ${outputPath}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
