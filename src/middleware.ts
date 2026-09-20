/**
 * 静态 HTML 边缘缓存（功能③：TTFB ~1.6s → 边缘命中 <100ms）。
 *
 * 设计：
 * - 缓存两类 GET HTML（无 query）：首页 `/` 与文章详情页 `/posts/<slug>/`。
 *   其余页面（归档/分页/说说/相册…）按需再扩。
 * - Cloudflare Cache API 是 per-PoP 的：同一边缘节点内命中率高，跨节点自然回源。
 * - 给用户的响应一律 `Cache-Control: no-store`——浏览器行为与改造前完全一致
 *   （后台发文后用户刷新立刻见新内容），缓存只发生在边缘。
 * - 存入边缘的那份带 max-age 兜底：即使失效钩子异常，旧 HTML 最多活 TTL 秒。
 * - 失效联动：后台发布 → 后端 HMAC webhook（posts 写操作会带上文章页 URL）→
 *   BFF /internal/revalidate → BFF 原样转发到本站 /internal/revalidate-html
 *   清掉对应页面缓存（秒级生效）。
 * - `X-HTML-Cache` 响应头（HIT/MISS）用于线上验证。
 */
import { defineMiddleware } from "astro:middleware";

// 构建期由 astro.config.mjs 的 vite.define 注入（git short SHA 或时间戳回退）
declare const __BUILD_ID__: string;

const HOME_CACHE_TTL = 180;
// 文章页正文不常变，点赞/评论数由客户端 island 拉取不进 SSR HTML；
// 短 TTL 兜住失效钩子异常的最坏情况。60s→10s：文章页 HTML 不在 revalidate
// 精确清除范围（Cache API 不能枚举），改短 TTL 把"保存配置→文章页更新"
// 的窗口从 60s 压到 10s；配合 SSE 实时广播体验接近秒级。
const POST_CACHE_TTL = 10;

/** 文章详情页路径（兼容不带尾斜杠的请求，缓存键统一规范化为带尾斜杠） */
const POST_PATH_RE = /^\/posts\/([^/]+)\/?$/;

/**
 * 返回可缓存的规范化路径；不可缓存（带 query / 其他页面）返回 null。
 * 首页键就是 "/"；文章页统一成 "/posts/<slug>/"。
 */
function cacheablePath(url: URL): { key: string; ttl: number } | null {
	if (url.search) return null;
	if (url.pathname === "/") return { key: "/", ttl: HOME_CACHE_TTL };
	const m = POST_PATH_RE.exec(url.pathname);
	if (m) return { key: `/posts/${m[1]}/`, ttl: POST_CACHE_TTL };
	return null;
}

/**
 * 缓存键 = 当前请求 origin + 规范化路径。Cache API 强制同源（键的 URL 必须与
 * worker 收到的请求同源，跨源 put 会静默失败），所以不能用写死的正式域名——
 * 本地 preview（127.0.0.1:4321）与线上（neutronstar.fun）各自成键。
 */
function htmlCacheKey(request: Request, path: string): Request {
	return new Request(`https://${new URL(request.url).host}${path}`, {
		method: "GET",
	});
}

interface CloudflareLocals {
	cfContext?: { waitUntil?: (p: Promise<unknown>) => void };
}

export const onRequest = defineMiddleware(async (context, next) => {
	const { request } = context;
	if (request.method !== "GET") return next();
	const url = new URL(request.url);

	// workerd 才有 caches；本地 node 工具链（dev/类型检查）跳过
	const cache = (globalThis as { caches?: { default: Cache } }).caches?.default;
	const target = cache ? cacheablePath(url) : null;
	const cacheKey = target ? htmlCacheKey(request, target.key) : null;

	if (cacheKey && cache) {
		const hit = await cache.match(cacheKey);
		if (hit) {
			const headers = new Headers(hit.headers);
			headers.set("Cache-Control", "no-store");
			headers.set("X-HTML-Cache", "HIT");
			headers.set("X-Build-Id", __BUILD_ID__);
			return new Response(hit.body, { status: 200, headers });
		}
	}

	const res = await next();

	// 全站 SSR HTML 一律 no-store：SSR 响应没有 Last-Modified/ETag，浏览器
	// 启发式缓存会拿旧页面（用户看不到刚发布/刚改的内容）。边缘命中分支已在
	// 上面设置 no-store。静态资源（/_astro/*、pagefind 等）content-type 不是
	// html，不受影响。
	if ((res.headers.get("content-type") || "").includes("text/html")) {
		res.headers.set("Cache-Control", "no-store");
		res.headers.set("X-Build-Id", __BUILD_ID__);
	}

	if (!(cacheKey && cache && target) || res.status !== 200) return res;

	// 完整读入后分别构造缓存与响应。不要用 body.tee()：访客侧提前关闭会
	// 截断 tee 另一支，导致边缘缓存里是缺尾部的 HTML（实测丢 footer 段）。
	// 首页/文章页 HTML 量级（~150KB），全量缓冲的内存/时延代价可忽略。
	const html = await res.arrayBuffer();

	const cacheHeaders = new Headers(res.headers);
	cacheHeaders.set("Cache-Control", `public, max-age=${target.ttl}`);
	const clientHeaders = new Headers(res.headers);
	clientHeaders.set("Cache-Control", "no-store");
	clientHeaders.set("X-HTML-Cache", "MISS");
	clientHeaders.set("X-Build-Id", __BUILD_ID__);

	const store = cache
		.put(cacheKey, new Response(html.slice(0), { status: 200, headers: cacheHeaders }))
		.catch(() => {});
	// waitUntil 是 workerd ExecutionContext 的方法，必须绑定 this 调用
	// （Illegal invocation：解构后裸调用会丢 this）
	const cf = (context.locals as CloudflareLocals).cfContext;
	if (cf?.waitUntil) cf.waitUntil.call(cf, store);
	else await store;

	return new Response(html, { status: 200, headers: clientHeaders });
});
