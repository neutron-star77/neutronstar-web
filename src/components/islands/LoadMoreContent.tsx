/**
 * 长文分块加载：首屏 SSR 只渲染前 N 个 chunk，本 island 监听滚动到底部，
 * 自动 fetch 后续 chunk 的 HTML 片段并 append 到正文末尾。
 *
 * 解决：262KB+ 长文在 Worker 端全量渲染触发 1102。
 */
import { useEffect, useRef, useState, useCallback } from "react";

interface LoadMoreContentProps {
	slug: string;
	totalChunks: number;
}

export default function LoadMoreContent({ slug, totalChunks }: LoadMoreContentProps) {
	// nextChunk 从 1 开始（0 是首屏已渲染的）
	const [nextChunk, setNextChunk] = useState(1);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);
	const sentinelRef = useRef<HTMLDivElement>(null);
	// 正文容器：就近取最近的 <article> 元素
	const [articleEl, setArticleEl] = useState<HTMLElement | null>(null);

	useEffect(() => {
		// 找到包裹本 island 的 <article>
		const sentinel = sentinelRef.current;
		if (!sentinel) return;
		const article = sentinel.closest("article");
		setArticleEl(article);
	}, []);

	const loadChunk = useCallback(async (n: number) => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`/api/posts/${encodeURIComponent(slug)}/chunk/${n}`, {
				headers: { Accept: "text/html" },
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const html = await res.text();
			if (articleEl) {
				// 插入到 sentinel 之前
				const wrapper = document.createElement("div");
				wrapper.innerHTML = html;
				while (wrapper.firstChild) {
					sentinelRef.current?.before(wrapper.firstChild);
				}
			}
			const next = n + 1;
			setNextChunk(next);
			if (next >= totalChunks) setDone(true);
		} catch (e: any) {
			setError(e?.message ?? "加载失败");
		} finally {
			setLoading(false);
		}
	}, [slug, totalChunks, articleEl]);

	useEffect(() => {
		if (done || !sentinelRef.current || !articleEl) return;
		const observer = new IntersectionObserver(
			entries => {
				if (entries[0].isIntersecting && !loading && !done) {
					loadChunk(nextChunk);
				}
			},
			// 提前 800px 开始加载，用户感知不到等待
			{ rootMargin: "800px 0px" },
		);
		observer.observe(sentinelRef.current);
		return () => observer.disconnect();
	}, [nextChunk, loading, done, loadChunk, articleEl]);

	// 只有分块文章才渲染 sentinel 和加载状态
	if (totalChunks <= 1) return null;

	return (
		<div ref={sentinelRef} className="load-more-sentinel" style={{ padding: "1rem", textAlign: "center" }}>
			{loading && <p style={{ color: "var(--on-surface-variant)" }}>正在加载下一段…</p>}
			{error && (
				<div>
					<p style={{ color: "var(--error)" }}>加载失败：{error}</p>
					<button
						onClick={() => loadChunk(nextChunk)}
						style={{
							padding: "4px 16px",
							borderRadius: "6px",
							border: "1px solid var(--outline)",
							background: "transparent",
							color: "inherit",
							cursor: "pointer",
						}}
					>
						重试
					</button>
				</div>
			)}
			{done && (
				<p style={{ color: "var(--on-surface-variant)", fontSize: "0.85em" }}>
					— 全文完 —
				</p>
			)}
		</div>
	);
}
