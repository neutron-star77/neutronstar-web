/**
 * SSR 服务端数据客户端（P2 数据换血）。
 *
 * 页面在 Cloudflare Workers（SSR）里直接回源 BFF；BFF 自带边缘缓存
 * （s-maxage=60 + tag 失效），这里再叠一层 isolate 内存短缓存，
 * 把一次渲染里的多次取数压成 1 次回源。
 */

const API_BASE = (import.meta.env.PUBLIC_API_BASE as string | undefined) ?? "https://bff.neutronstar.fun";

const MEM_TTL_MS = 15_000;

type CacheItem = { expires: number; data: unknown };

const memCache = new Map<string, CacheItem>();

export function apiUrl(path: string): string {
	return `${API_BASE}${path}`;
}

export async function apiGet<T>(path: string, ttlMs = MEM_TTL_MS): Promise<T | null> {
	const key = `${API_BASE}${path}`;
	const hit = memCache.get(key);
	if (hit && hit.expires > Date.now()) {
		return hit.data as T;
	}
	try {
		const res = await fetch(key, {
			headers: { accept: "application/json" },
			signal: AbortSignal.timeout(8_000),
		});
		if (!res.ok) return null;
		const data = (await res.json()) as T;
		memCache.set(key, { expires: Date.now() + ttlMs, data });
		return data;
	} catch {
		return null;
	}
}
