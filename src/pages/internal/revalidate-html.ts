/**
 * 静态 HTML 边缘缓存失效端点（首页 + 文章详情页）。
 *
 * 调用链：后台发布/修改内容 → 后端 `cache_invalidate.py` HMAC webhook →
 * BFF `/internal/revalidate`（清 BFF 聚合缓存 + SSE 广播）→ BFF **原样转发**
 * 本请求（raw body + x-signature，零重算）到这里 → 清掉对应页面 HTML 边缘缓存。
 *
 * body 形状：`{ tags: string[], urls: string[] }`。
 * - urls 里由后端 posts 写操作带上 `/posts/<slug>/`（或完整 URL）；
 * - 首页 `/` 无条件清理：文章增删改都会改变首页文章列表。
 *
 * 验证与 BFF 完全同构：REVALIDATE_SECRET + HMAC-SHA256 hex（x-signature 头）。
 * secret 通过 `wrangler secret put REVALIDATE_SECRET` 配置（与 BFF/NAS 同值）。
 *
 * 注意 Cache API 键必须与 middleware 里 htmlCacheKey 同 host、同规范化路径。
 */
export const prerender = false;

interface RevalidateEnv {
  REVALIDATE_SECRET?: string;
}

async function getEnv(): Promise<RevalidateEnv> {
  try {
    const mod = await import("cloudflare:workers");
    return (mod as { env?: RevalidateEnv }).env ?? {};
  } catch {
    // 非 workerd 环境（本地类型检查/纯 node）无此虚拟模块
    return {};
  }
}

async function verifyHmac(secret: string, body: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/** 规范化文章详情页路径为带尾斜杠；其他路径原样返回（不强制加斜杠）。 */
function normalisePathname(pathname: string): string {
  const m = /^(\/posts\/[^/]+)\/?$/.exec(pathname);
  return m ? `${m[1]}/` : pathname;
}

export async function POST({ request }: { request: Request }) {
  const env = await getEnv();
  const secret = env.REVALIDATE_SECRET;
  if (!secret) {
    return Response.json({ error: "revalidate not configured" }, { status: 500 });
  }

  const raw = await request.text();
  const sig = request.headers.get("x-signature") || "";
  if (!(await verifyHmac(secret, raw, sig))) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  const cache = (globalThis as { caches?: { default: Cache } }).caches?.default;
  if (!cache) {
    return Response.json({ error: "cache api unavailable" }, { status: 500 });
  }

  const host = new URL(request.url).host;
  const paths = new Set<string>(["/"]);

  // 解析 body.urls：兼容完整 URL 与本站路径。只保留 pathname，
  // 统一用本站 host 重写缓存键（Cache API 强制同源，跨源 delete 静默失败）。
  let payload: { urls?: unknown };
  try {
    payload = JSON.parse(raw) as { urls?: unknown };
  } catch {
    payload = {};
  }
  if (Array.isArray(payload.urls)) {
    for (const u of payload.urls) {
      if (typeof u !== "string") continue;
      let pathname: string;
      if (u.startsWith("/")) {
        pathname = u;
      } else {
        try {
          pathname = new URL(u).pathname;
        } catch {
          continue;
        }
      }
      if (pathname.startsWith("/posts/") || pathname === "/") {
        paths.add(normalisePathname(pathname));
      }
    }
  }

  let purged = 0;
  for (const path of paths) {
    const key = new Request(`https://${host}${path}`, { method: "GET" });
    if (await cache.delete(key)) purged += 1;
  }
  return Response.json({ ok: true, purged, paths: [...paths] });
}
