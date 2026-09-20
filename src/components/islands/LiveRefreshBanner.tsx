/**
 * 轻量实时刷新提示条（P4 延伸：SSR 页面无 island，收到 SSE 事件后自动刷新）。
 *
 * 用法：在 SSR 页面（首页/归档/文章详情）底部放 <LiveRefreshBanner client:load />。
 * 监听 posts/home/nav 频道：
 *  - posts / home：文章发布、首页数据变化
 *  - nav：后台站点配置保存（侧边栏开关/标题/描述等）
 * 收到 change 事件后顶部弹出提示，3 秒倒计时自动整页刷新（可"立即刷新/取消"）。
 * 已打开页面无需手动刷新即可拿到最新 SSR HTML（配合 A 的短 TTL 与 revalidate 秒清）。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeRefresh } from "../../lib/realtime";

/** 自动刷新倒计时（毫秒） */
const AUTO_REFRESH_MS = 3_000;
/** 倒计时刷新间隔 */
const TICK_MS = 100;

export default function LiveRefreshBanner() {
	const [visible, setVisible] = useState(false);
	const [left, setLeft] = useState(AUTO_REFRESH_MS);
	const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const stopCountdown = useCallback(() => {
		if (countdownRef.current) {
			clearInterval(countdownRef.current);
			countdownRef.current = null;
		}
	}, []);

	// 带时间戳破缓存，强制重新拉取 SSR HTML
	const refresh = useCallback(() => {
		const url = new URL(window.location.href);
		url.searchParams.set("_cb", String(Date.now()));
		window.location.href = url.toString();
	}, []);

	const onNewContent = useCallback(() => {
		stopCountdown();
		setLeft(AUTO_REFRESH_MS);
		setVisible(true);
	}, [stopCountdown]);

	// 监听 posts / home / nav（nav = 站点配置变化）
	useRealtimeRefresh(["posts", "home", "nav"], onNewContent);

	// 提示可见时启动自动刷新倒计时
	useEffect(() => {
		if (!visible) return;
		const start = Date.now();
		countdownRef.current = setInterval(() => {
			const remain = Math.max(0, AUTO_REFRESH_MS - (Date.now() - start));
			setLeft(remain);
			if (remain <= 0) {
				stopCountdown();
				setVisible(false);
				refresh();
			}
		}, TICK_MS);
		return stopCountdown;
	}, [visible, stopCountdown, refresh]);

	const handleRefresh = () => {
		stopCountdown();
		refresh();
	};
	const handleDismiss = () => {
		stopCountdown();
		setVisible(false);
	};

	// SSR 期（visible 恒为 false）必须返回占位元素而不是 null/undefined：
	// Astro 对服务端返回 null 的框架组件会抛「Unable to render」并中断整个
	// 响应流（线上 SSR 页因此被截断，见坑 6.1.7）
	if (!visible) return <div role="alert" hidden />;

	return (
		<div
			role="alert"
			className="fixed left-1/2 top-3 z-[9999] flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-4 py-2 text-sm text-on-primary shadow-elevation-2"
			style={{ animation: "liveRefreshIn 0.3s ease-out" }}
		>
			<style>{`@keyframes liveRefreshIn{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
			<span>有新内容，{Math.ceil(left / 1000)} 秒后自动刷新</span>
			<button
				onClick={handleRefresh}
				className="rounded-full bg-on-primary/15 px-3 py-1 text-xs font-medium hover:bg-on-primary/25"
			>
				立即刷新
			</button>
			<button
				onClick={handleDismiss}
				aria-label="取消自动刷新"
				className="rounded-full p-1 text-on-primary/70 hover:bg-on-primary/15"
			>
				✕
			</button>
		</div>
	);
}
