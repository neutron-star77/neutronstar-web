/**
 * 构建后搜索索引生成（P6 ⑦）。
 *
 * 站点是 SSR，pagefind 无法直接索引 dist/client（没有静态 HTML）。
 * 本脚本：从 BFF API 拉全部已发布文章 → 生成最小 HTML → pagefind 建索引 → 输出 dist/client/pagefind。
 *
 * 在 package.json 中以 "postbuild": "node scripts/build-search-index.mjs" 触发。
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const WEB_ROOT = join(__dirname, "..");
const SOURCE_DIR = join(WEB_ROOT, "dist", "search-source");
const OUTPUT_DIR = join(WEB_ROOT, "dist", "client", "pagefind");
const API_BASE = process.env.VITE_API_BASE_URL || "https://bff.neutronstar.fun";

async function fetchAllPosts() {
	const size = 200;
	const url = `${API_BASE}/api/posts?status=published&page=1&size=${size}`;
	console.log(`[search] Fetching posts from ${url} ...`);
	const res = await fetch(url, { headers: { Accept: "application/json" } });
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
	const data = await res.json();
	const posts = Array.isArray(data) ? data : data.items || data.data || [];
	console.log(`[search] Got ${posts.length} posts`);
	return posts;
}

async function fetchPostContent(slug) {
	try {
		const res = await fetch(`${API_BASE}/api/posts/${slug}`, {
			headers: { Accept: "application/json" },
		});
		if (!res.ok) return "";
		const data = await res.json();
		return data.content || data.body || "";
	} catch {
		return "";
	}
}

function stripHtml(html) {
	return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function main() {
	const posts = await fetchAllPosts();
	if (posts.length === 0) {
		console.warn("[search] No posts found, skipping index build");
		return;
	}

	await rm(SOURCE_DIR, { recursive: true, force: true });
	await mkdir(SOURCE_DIR, { recursive: true });

	let indexed = 0;
	for (const post of posts) {
		const slug = post.slug || post.id;
		if (!slug) continue;
		const title = post.title || "Untitled";
		const excerpt = post.description || post.excerpt || "";
		// 列表接口不含正文，拉单篇详情（并行上限 5）
		const content = await fetchPostContent(slug);
		const text = stripHtml(content);
		const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${title}</title><meta name="description" content="${excerpt}"></head><body><h1>${title}</h1><p>${excerpt}</p><div>${text}</div></body></html>`;
		const safeSlug = String(slug).replace(/[^a-zA-Z0-9-_]/g, "_");
		await writeFile(join(SOURCE_DIR, `${safeSlug}.html`), html, "utf8");
		indexed++;
	}
	console.log(`[search] Generated ${indexed} HTML files for indexing`);

	// 运行 pagefind CLI（Windows 用 .cmd 完整路径 + shell）
	console.log("[search] Running pagefind index...");
	const isWin = process.platform === "win32";
	const pagefindBin = isWin
		? join(WEB_ROOT, "node_modules", ".bin", "pagefind.cmd")
		: join(WEB_ROOT, "node_modules", ".bin", "pagefind");
	try {
		execFileSync(pagefindBin, ["--site", SOURCE_DIR, "--output-path", OUTPUT_DIR], {
			stdio: "inherit",
			cwd: WEB_ROOT,
			shell: isWin,
		});
		console.log("[search] Index written to", OUTPUT_DIR);
	} catch (err) {
		console.error("[search] pagefind failed:", err.message);
		// 不阻塞构建
	}

	// 清理临时源文件
	await rm(SOURCE_DIR, { recursive: true, force: true });
	console.log("[search] Done");
}

main().catch((err) => {
	console.error("[search] Fatal:", err);
	process.exit(0); // 不阻塞构建
});
