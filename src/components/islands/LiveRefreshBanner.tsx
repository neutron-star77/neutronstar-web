/**
 * 轻量实时刷新提示条（P4 延伸：SSR 页面无 island，收到 SSE 事件后提示用户刷新）。
 *
 * 用法：在 SSR 页面（首页/归档/文章详情）底部放 <LiveRefreshBanner client:load />。
 * 收到 posts/home 频道的 change 事件后，顶部弹出「有新内容，点击刷新」，点击即刷新。
 */
import { useCallback, useEffect, useState } from "react";
import { useRealtimeRefresh } from "../../lib/realtime";

export default function LiveRefreshBanner() {
	const [visible, setVisible] = useState(false);

	const onNewContent = useCallback(() => {
		setVisible(true);
	}, []);

	// 监听 posts / home 频道（文章发布、首页数据变化）
	useRealtimeRefresh(["posts", "home"], onNewContent);

	// 页面可见性变化时重置（切回标签页如果已经刷新过就不重复提示）
	useEffect(() => {
		const onVisible = () => {
			if (document.visibilityState === "visible") {
				// 不自动隐藏，等用户点击；但如果用户已经在别的标签页刷新过，URL 带时间戳就不提示
			}
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => document.removeEventListener("visibilitychange", onVisible);
	}, []);

	if (!visible) return null;

	const handleRefresh = () => {
		// 带时间戳破缓存，强制重新拉取 SSR HTML
		const url = new URL(window.location.href);
		url.searchParams.set("_cb", String(Date.now()));
		window.location.href = url.toString();
	};

	const handleDismiss = () => setVisible(false);

	return (
		<div
			role="alert"
			className="fixed left-1/2 top-3 z-[9999] flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-4 py-2 text-sm text-on-primary shadow-elevation-2"
			style={{ animation: "liveRefreshIn 0.3s ease-out" }}
		>
			<style>{`@keyframes liveRefreshIn{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
			<span>有新内容，点击刷新</span>
			<button
				onClick={handleRefresh}
				className="rounded-full bg-on-primary/15 px-3 py-1 text-xs font-medium hover:bg-on-primary/25"
			>
				刷新
			</button>
			<button
				onClick={handleDismiss}
				aria-label="忽略"
				className="rounded-full p-1 text-on-primary/70 hover:bg-on-primary/15"
			>
				✕
			</button>
		</div>
	);
}
