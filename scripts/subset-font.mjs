/**
 * 字体子集化脚本（适配 API 数据源）。
 *
 * 与上游 Shirone 的差异：文章内容来自后端 API 而非 src/content/，
 * 所以文本采集改为调用 BFF /api/posts 拉全量正文。
 *
 * 用法：node scripts/subset-font.mjs
 * 输出：src/assets/fonts/.subset/<basename>.subset.woff2
 *       （astro.config.mjs resolveVariantSrc 会按此路径查找）
 *
 * 当前处理的本地字体：
 *   - loli.woff2                  （CJK，~4.6MB）
 *   - ZenMaruGothic-Medium.woff2  （西文 body，~1.5MB）
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, readFile } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const API_BASE = process.env.PUBLIC_API_BASE ?? "https://bff.neutronstar.fun";

/** 需要子集化的本地字体（与 fontConfig.ts 中 source: "local" 的 variants 对应） */
const LOCAL_FONTS = [
	"src/assets/fonts/loli.woff2",
	"src/assets/fonts/ZenMaruGothic-Medium.woff2",
];

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
		const list = await fetch(`${API_BASE}/api/posts?status=published&page=1&size=500`).then((r) => r.json());
		const posts = Array.isArray(list) ? list : list?.items ?? [];
		console.log(`[subset] Got ${posts.length} posts`);
		for (const post of posts) {
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
		console.warn("[subset] Falling back to i18n + config only (less complete charset)");
	}

	// 4. 扫描 i18n（中文词典为主，全扫也不贵）
	const i18nDir = join(projectRoot, "src/i18n/languages");
	if (existsSync(i18nDir)) {
		for (const f of readdirSync(i18nDir)) {
			if (f.endsWith(".ts")) {
				const text = readFileSync(join(i18nDir, f), "utf8");
				for (const ch of text) if (ch.charCodeAt(0) > 31) charSet.add(ch);
			}
		}
	}

	// 5. 扫描 config（导航标题等）
	const configDir = join(projectRoot, "src/config");
	if (existsSync(configDir)) {
		for (const f of readdirSync(configDir)) {
			if (f.endsWith(".ts")) {
				const text = readFileSync(join(configDir, f), "utf8");
				for (const ch of text) if (ch.charCodeAt(0) > 31) charSet.add(ch);
			}
		}
	}

	// 6. 扫描 data/（追番、友链等静态数据）
	const dataDir = join(projectRoot, "src/data");
	if (existsSync(dataDir)) {
		for (const f of readdirSync(dataDir)) {
			if (/\.(ts|js|json)$/.test(f)) {
				const text = readFileSync(join(dataDir, f), "utf8");
				for (const ch of text) if (ch.charCodeAt(0) > 31) charSet.add(ch);
			}
		}
	}

	return Array.from(charSet).sort().join("");
}

async function main() {
	const text = await collectText();
	console.log(`[subset] Collected ${text.length} unique characters`);

	const subsetDir = join(projectRoot, "src/assets/fonts/.subset");
	mkdirSync(subsetDir, { recursive: true });
	writeFileSync(join(subsetDir, "charset.txt"), text, "utf8");

	for (const rel of LOCAL_FONTS) {
		const sourcePath = join(projectRoot, rel);
		if (!existsSync(sourcePath)) {
			console.warn(`[subset] Skip (not found): ${rel}`);
			continue;
		}
		const name = basename(sourcePath, extname(sourcePath));
		const outputPath = join(subsetDir, `${name}.subset.woff2`);

		const sourceFont = readFileSync(sourcePath);
		const originalKB = (sourceFont.length / 1024).toFixed(0);
		console.log(`[subset] ${name}: source ${originalKB} KB, subsetting...`);

		const subsetBuffer = await subsetFont(sourceFont, text, { targetFormat: "woff2" });
		writeFileSync(outputPath, subsetBuffer);
		const subsetKB = (subsetBuffer.length / 1024).toFixed(0);
		const reduction = ((1 - subsetBuffer.length / sourceFont.length) * 100).toFixed(1);
		console.log(`[subset] ${name}: ${originalKB} KB -> ${subsetKB} KB (-${reduction}%)`);
	}
	console.log("[subset] Done.");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
