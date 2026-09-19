/**
 * 长文分块加载 API：返回某篇文章第 n 个 chunk 的渲染后 HTML 片段。
 *
 * 配合 [slug].astro 的分块渲染：首屏只渲染前 N 个 chunk（CPU 预算内），
 * 前端 island 滚动到底部时调本接口逐段加载。
 *
 * 路由：GET /api/posts/<slug>/chunk/<n>
 *   - n = 0..N-1，N 是 splitMarkdownByH2 切出的 chunk 总数
 *   - 返回 text/html 片段（不是完整页面）
 */
import type { APIRoute } from "astro";
import { apiGet } from "@/lib/server/api";
import { siteMarkdownProcessor } from "@utils/markdown-processor";
import { splitMarkdownByH2 } from "@utils/markdown-chunks.mjs";

export const prerender = false;

// 模块级单例 renderer（跟 [slug].astro 一致，避免每次重建插件链）
let rendererPromise: ReturnType<typeof siteMarkdownProcessor.createRenderer> | null = null;

export const GET: APIRoute = async ({ params }) => {
	const { slug, n } = params;
	if (!slug || n === undefined) {
		return new Response("missing params", { status: 400 });
	}
	const idx = Number(n);
	if (!Number.isInteger(idx) || idx < 0) {
		return new Response("invalid chunk index", { status: 400 });
	}

	const post = await apiGet<{ content?: string }>(`/api/posts/${encodeURIComponent(slug)}`);
	if (!post || !post.content) {
		return new Response("post not found", { status: 404 });
	}

	const chunks = splitMarkdownByH2(post.content);
	if (idx >= chunks.length) {
		return new Response("chunk out of range", { status: 404 });
	}

	rendererPromise ??= siteMarkdownProcessor.createRenderer({});
	const renderer = await rendererPromise;
	const { code } = await renderer.render(chunks[idx]);

	return new Response(code, {
		status: 200,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "public, max-age=300",
		},
	});
};
