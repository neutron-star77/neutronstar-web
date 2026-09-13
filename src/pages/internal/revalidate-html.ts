/**
 * 首页 HTML 边缘缓存失效端点（功能③ 的失效钩子）。
 *
 * 调用链：后台发布/修改内容 → 后端 `cache_invalidate.py` HMAC webhook →
 * BFF `/internal/revalidate`（清 BFF 聚合缓存 + SSE 广播）→ BFF **原样转发**
 * 本请求（raw body + x-signature，零重算）到这里 → 清掉首页 HTML 边缘缓存。
 *
 * 验证与 BFF 完全同构：REVALIDATE_SECRET + HMAC-SHA256 hex（x-signature 头）。
 * secret 通过 `wrangler secret put REVALIDATE_SECRET` 配置（与 BFF/NAS 同值）。
 *
 * 注意 Cache API 键必须与 middleware 里的 HOME_CACHE_KEY 一字不差。
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
  // 键与 middleware 的 homeCacheKey 一致：BFF 转发到的 host 即用户访问的 host
  const cacheKey = new Request(`https://${new URL(request.url).host}/`, { method: "GET" });
  const purged = await cache.delete(cacheKey);
  return Response.json({ ok: true, purged });
}
