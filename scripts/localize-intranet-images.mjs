/**
 * localize-intranet-images —— 内网部署（520 虚拟机）专用 postbuild：
 * 把产物 HTML 里的外链图片下载进 dist/client/imgcache/<host>/<path> 并改写引用，
 * 让内网访问完全不依赖 jsdelivr / Cloudflare。
 *
 * 处理三类引用：
 *  1. https://cdn.jsdelivr.net/**      → 下载本地化（文章封面图床）
 *  2. https://bff.neutronstar.fun/**   → 下载本地化（BFF /img/* 图代理）
 *  3. https://neutronstar.fun/_astro/* → 仅改写为相对路径 /_astro/*（文件本就在产物里）
 *
 * 说明：
 *  - 字符串全量替换即可覆盖 astro-island props JSON（&quot; 转义）场景——URL 本体
 *    是连续 ASCII，不含 HTML 实体。
 *  - 幂等：imgcache 里已存在的文件跳过下载，可重复执行。
 *  - 运行时经 API 返回的图（相册照片列表等）不经过 HTML，仍为外链——内网可达
 *    jsdelivr 时可接受，未覆盖的会在控制台列出。
 *  - 任何一张下载失败都按失败退出（exit 1），避免上线后静默裂图。
 *
 * 用法：node scripts/localize-intranet-images.mjs [distDir]（默认 dist/client）
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = fileURLToPath(
	new URL(process.argv[2] ? `../${process.argv[2]}` : "../dist/client", import.meta.url),
);

const IMAGE_RE =
	/https:\/\/(cdn\.jsdelivr\.net|bff\.neutronstar\.fun)\/[^\s"'<>&()]*?\.(?:webp|png|jpe?g|gif|svg|avif)/g;
const SELF_ASTRO_RE = /https:\/\/neutronstar\.fun\/(_astro\/[^\s"'<>&()]*?\.(?:webp|png|jpe?g|gif|svg|avif))/g;

function walk(dir, out) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) walk(full, out);
		else if (entry.name.endsWith(".html")) out.push(full);
	}
	return out;
}

// jsdelivr 主站国内直连经常失败（实测本机 fetch 全挂）：依次尝试原始 URL →
// testingcf 镜像（CF 边缘，国内可达）→ fastly 镜像。存盘路径按原始 URL，
// HTML 改写目标不受镜像影响。
const JSDELIVR_MIRRORS = ["", "https://testingcf.jsdelivr.net", "https://gcore.jsdelivr.net", "https://fastly.jsdelivr.net"];

function candidateUrls(url) {
	if (!url.startsWith("https://cdn.jsdelivr.net/")) return [url];
	const path = url.slice("https://cdn.jsdelivr.net".length);
	return JSDELIVR_MIRRORS.map((m) => `${m}${path}`).filter((v, i, a) => a.indexOf(v) === i);
}

async function download(url, dest) {
	if (existsSync(dest) && statSync(dest).size > 0) return "cached";
	let lastErr;
	for (const candidate of candidateUrls(url)) {
		try {
			const res = await fetch(candidate, {
				headers: { "user-agent": "neutronstar-localize/1.0", accept: "image/*,*/*;q=0.8" },
				signal: AbortSignal.timeout(60_000),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const buf = Buffer.from(await res.arrayBuffer());
			mkdirSync(dirname(dest), { recursive: true });
			writeFileSync(dest, buf);
			return `${(buf.length / 1024).toFixed(0)}KB${candidate === url ? "" : " (镜像)"}`;
		} catch (err) {
			lastErr = err;
		}
	}
	throw lastErr;
}

const htmlFiles = walk(distDir, []);

// ① 收集全部需要本地化的 URL（全文匹配，含 props JSON 场景）
const urls = new Set();
for (const file of htmlFiles) {
	const html = readFileSync(file, "utf8");
	for (const m of html.matchAll(IMAGE_RE)) urls.add(m[0]);
}
console.log(`[localize] HTML 文件 ${htmlFiles.length} 个，外链图片 ${urls.size} 张`);

// ② 并发下载（上限 6）
let failed = 0;
const queue = [...urls];
const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
	for (;;) {
		const url = queue.shift();
		if (!url) return;
		const dest = join(distDir, "imgcache", new URL(url).host, new URL(url).pathname.slice(1));
		try {
			const info = await download(url, dest);
			console.log(`[localize] ${info.padEnd(8)} ${url}`);
		} catch (err) {
			failed += 1;
			console.error(`[localize] FAIL ${url} -> ${err.message}`);
		}
	}
});
await Promise.all(workers);
if (failed > 0) {
	console.error(`[localize] ${failed} 张下载失败，中止（不上线缺图产物）`);
	process.exit(1);
}

// ③ 改写引用
let replaced = 0;
for (const file of htmlFiles) {
	const html = readFileSync(file, "utf8");
	const next = html
		.replaceAll(SELF_ASTRO_RE, "/$1")
		.replaceAll(IMAGE_RE, (u) => `/imgcache/${new URL(u).host}${new URL(u).pathname}`);
	if (next !== html) {
		writeFileSync(file, next);
		replaced += 1;
	}
}
console.log(`[localize] 改写完成：${replaced}/${htmlFiles.length} 个 HTML；外链图已本地化 ${urls.size} 张`);
