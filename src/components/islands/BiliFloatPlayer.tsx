/**
 * B 站收藏夹悬浮播放器（NetEase 外挂播放器风格）。
 *
 * 挂在 Layout body（Swup 容器外），全站只有一个实例，页面切换时音乐不断。
 * client:only="react" —— 纯客户端组件：配置（music_widget）和播放列表都由
 * 浏览器现场拉取，后台改配置 ≤60s 全站生效，不存在构建期把配置烤死的问题；
 * 同时也天然避开「island SSR 返回 null 会截断响应流」的坑（见 6.1.14）。
 *
 * 数据链路：
 *   /api/site-config/music_widget  拿 enabled + url（解析出 fid）
 *   /api/bili-fav?media_id=<fid>   后端代理拉播放列表（B 站对浏览器直连/CF 出口
 *                                  均有风控，只能由 NAS 后端代拉，边缘缓存 600s）
 *
 * 连播机制（跨域 iframe 拿不到 ended 事件，双保险）：
 *   1. 监听 window.message，内容含 "ended" 即切下一首（B 站播放器有此事件）
 *   2. 按曲目时长 +3s 的兜底定时器自动切换
 *   已知限制：用户在 iframe 里暂停视频时兜底定时器仍会走，到点切歌。
 *
 * 交互：
 *   - 头部按住拖动；⚠️ 指针按下时必须放过 button/a——setPointerCapture 会把
 *     后续 click 重新定向到捕获元素，不放行的话头部里的最小化/关闭按钮永远点不到
 *   - 右下角手柄拖拽调整宽度（240–520，localStorage 记忆）
 *   - 最小化成小球（iframe 不卸载，音乐不断）；关闭存 sessionStorage
 *   - 所有封面图必须 referrerPolicy="no-referrer"：B 站图片 CDN 防盗链，
 *     带外站 Referer 直接 403（坑 6.3.19 同族），不带 Referer 才放行
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "../../lib/api/client";

interface MusicWidgetConfig {
	enabled?: boolean;
	title?: string;
	subtitle?: string;
	url?: string;
}

interface Track {
	bvid: string;
	title: string;
	cover: string;
	duration: number;
	author: string | null;
}

interface FavPayload {
	title?: string | null;
	mediaCount?: number;
	tracks?: Track[];
}

const LS_POS = "biliFloatPos";
const LS_WIDTH = "biliFloatWidth";
const SS_CLOSED = "biliFloatClosed";
const CARD_WIDTH_DEFAULT = 320;
const CARD_WIDTH_MIN = 240;
const CARD_WIDTH_MAX = 520;

/** 从收藏夹链接里解析 fid（media_id） */
function parseFid(url: string): string | null {
	const m = /[?&]fid=(\d+)/.exec(url || "");
	return m ? m[1] : null;
}

function formatDuration(sec: number): string {
	if (!Number.isFinite(sec) || sec <= 0) return "--:--";
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	const s = Math.floor(sec % 60);
	const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
	return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** fetch 没有内建超时；任何一步卡死都降级为错误态而不是永远转圈 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
	return Promise.race([
		p,
		new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
	]);
}

function readSavedPos(): { x: number; y: number } | null {
	try {
		const raw = localStorage.getItem(LS_POS);
		if (!raw) return null;
		const p = JSON.parse(raw) as { x: number; y: number };
		if (typeof p?.x === "number" && typeof p?.y === "number") return p;
	} catch {
		/* ignore */
	}
	return null;
}

function readSavedWidth(): number {
	try {
		const raw = Number(localStorage.getItem(LS_WIDTH));
		if (Number.isFinite(raw) && raw >= CARD_WIDTH_MIN && raw <= CARD_WIDTH_MAX) {
			return raw;
		}
	} catch {
		/* ignore */
	}
	return CARD_WIDTH_DEFAULT;
}

export default function BiliFloatPlayer() {
	const [phase, setPhase] = useState<"boot" | "off" | "error" | "ready">("boot");
	const [errorMsg, setErrorMsg] = useState("");
	const [fallbackUrl, setFallbackUrl] = useState("");
	const [playlistTitle, setPlaylistTitle] = useState("B站收藏夹");
	const [tracks, setTracks] = useState<Track[]>([]);
	const [current, setCurrent] = useState(0);
	const [started, setStarted] = useState(false);
	const [minimized, setMinimized] = useState(false);
	const [listOpen, setListOpen] = useState(false);
	const [width, setWidth] = useState(() =>
		typeof localStorage === "undefined" ? CARD_WIDTH_DEFAULT : readSavedWidth()
	);
	const [pos, setPos] = useState<{ x: number; y: number } | null>(() =>
		typeof localStorage === "undefined" ? null : readSavedPos()
	);
	const [closed, setClosed] = useState(
		() => typeof sessionStorage !== "undefined" && sessionStorage.getItem(SS_CLOSED) === "1"
	);

	const cardRef = useRef<HTMLDivElement>(null);
	const dragState = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null);
	const resizeState = useRef<{ sx: number; sw: number } | null>(null);
	const lastAdvanceRef = useRef(0);

	/* 配置 + 播放列表：挂载后拉一次（BFF 边缘缓存 60s/600s，开销可忽略） */
	useEffect(() => {
		let cancelled = false;
		(async () => {
			let cfg: MusicWidgetConfig | null = null;
			try {
				cfg = await withTimeout(
					apiGet<MusicWidgetConfig>("/api/site-config/music_widget"),
					8000,
				);
			} catch {
				cfg = null;
			}
			const fid = cfg?.enabled && cfg.url ? parseFid(cfg.url) : null;
			if (cancelled) return;
			if (!fid) {
				setPhase("off"); // 未启用或链接不是收藏夹（此时侧栏显示外链卡片）
				return;
			}
			try {
				const data = await withTimeout(
					apiGet<FavPayload>(`/api/bili-fav?media_id=${fid}`),
					12000,
				);
				if (cancelled) return;
				const list = data?.tracks ?? [];
				if (list.length === 0) {
					setErrorMsg("收藏夹里暂无可播放的视频");
					setPhase("error");
					return;
				}
				setPlaylistTitle(data?.title || "B站收藏夹");
				setTracks(list);
				setPhase("ready");
			} catch {
				if (cancelled) return;
				setErrorMsg("播放列表加载失败");
				setFallbackUrl(cfg?.url || "");
				setPhase("error");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const track = tracks[current];

	/** 切下一首（2.5s 去抖：message 事件和兜底定时器可能先后到达） */
	const advance = useCallback(() => {
		const now = Date.now();
		if (now - lastAdvanceRef.current < 2500) return;
		lastAdvanceRef.current = now;
		setCurrent((i) => (tracks.length ? (i + 1) % tracks.length : 0));
	}, [tracks.length]);

	/* 连播保险 1：B 站播放器的 postMessage（内容含 "ended"） */
	useEffect(() => {
		if (phase !== "ready") return;
		const onMsg = (e: MessageEvent) => {
			let text: string;
			try {
				text = typeof e.data === "string" ? e.data : JSON.stringify(e.data ?? "");
			} catch {
				return;
			}
			if (text && text.includes("ended")) advance();
		};
		window.addEventListener("message", onMsg);
		return () => window.removeEventListener("message", onMsg);
	}, [phase, advance]);

	/* 连播保险 2：时长 + 3s 兜底定时器 */
	useEffect(() => {
		if (phase !== "ready" || !started || !track?.duration) return;
		const timer = setTimeout(advance, track.duration * 1000 + 3000);
		return () => clearTimeout(timer);
	}, [phase, started, track?.bvid, track?.duration, advance]);

	/* 拖动：头部按住拖动。必须放过 button/a——setPointerCapture 会把后续
	   click 重新定向到捕获元素，不放过的话头部里的按钮永远点不到 */
	const onHandleDown = (e: React.PointerEvent) => {
		if ((e.target as HTMLElement).closest("button, a")) return;
		if (!cardRef.current) return;
		const rect = cardRef.current.getBoundingClientRect();
		const p = pos ?? { x: rect.left, y: rect.top };
		setPos(p);
		dragState.current = { px: e.clientX, py: e.clientY, cx: p.x, cy: p.y };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	};
	const onHandleMove = (e: React.PointerEvent) => {
		const d = dragState.current;
		if (!d) return;
		const w = cardRef.current?.offsetWidth ?? width;
		const h = cardRef.current?.offsetHeight ?? 300;
		const nx = Math.min(Math.max(0, d.cx + e.clientX - d.px), Math.max(0, window.innerWidth - w));
		const ny = Math.min(Math.max(0, d.cy + e.clientY - d.py), Math.max(0, window.innerHeight - 48));
		setPos({ x: nx, y: ny });
	};
	const onHandleUp = () => {
		if (dragState.current && pos) {
			try {
				localStorage.setItem(LS_POS, JSON.stringify(pos));
			} catch {
				/* ignore */
			}
		}
		dragState.current = null;
	};

	/* 缩放：右下角手柄，横向拖拽调宽度 */
	const onResizeDown = (e: React.PointerEvent) => {
		resizeState.current = { sx: e.clientX, sw: width };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	};
	const onResizeMove = (e: React.PointerEvent) => {
		const r = resizeState.current;
		if (!r) return;
		const w = Math.min(CARD_WIDTH_MAX, Math.max(CARD_WIDTH_MIN, r.sw + e.clientX - r.sx));
		setWidth(w);
	};
	const onResizeUp = () => {
		resizeState.current = null;
		try {
			localStorage.setItem(LS_WIDTH, String(width));
		} catch {
			/* ignore */
		}
	};

	const playAt = (index: number) => {
		setCurrent((index + tracks.length) % Math.max(1, tracks.length));
		setStarted(true);
	};

	const close = () => {
		try {
			sessionStorage.setItem(SS_CLOSED, "1");
		} catch {
			/* ignore */
		}
		setClosed(true);
	};

	if (closed) return null;

	/* 加载中：小提示条（client:only 水合后先短暂出现，取数完成即被替换） */
	if (phase === "boot") {
		return (
			<div className="fixed bottom-24 right-4 z-[70] rounded-full bg-[var(--card-bg)] px-4 py-2 text-xs text-50 shadow-lg">
				♪ 音乐挂件加载中…
			</div>
		);
	}

	if (phase === "off") return null;

	/* 错误态：小条提示 + 可关（不打扰） */
	if (phase === "error") {
		return (
			<div
				ref={cardRef}
				className="fixed z-[70] w-64 rounded-xl bg-[var(--card-bg)] p-3 shadow-lg"
				style={pos ? { left: pos.x, top: pos.y } : { right: "1rem", bottom: "6rem" }}
			>
				<div className="flex items-center justify-between gap-2">
					<span className="min-w-0 flex-1 truncate text-xs text-75">
						{errorMsg}
						{fallbackUrl && (
							<>
								{" "}
								<a
									href={fallbackUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="text-[var(--primary)] underline underline-offset-2"
								>
									去 B 站听
								</a>
							</>
						)}
					</span>
					<button
						type="button"
						onClick={close}
						className="rounded-full px-1.5 text-xs text-50 hover:text-[var(--error)]"
						aria-label="关闭音乐挂件"
					>
						✕
					</button>
				</div>
			</div>
		);
	}

	/* 最小化小球：封面 + 标题，点击恢复；⠿ 手柄可拖 */
	if (minimized) {
		return (
			<div
				ref={cardRef}
				className="fixed z-[70] flex max-w-[16rem] items-center gap-2 rounded-full bg-[var(--card-bg)] py-1.5 pl-1.5 pr-3 shadow-lg"
				style={pos ? { left: pos.x, top: pos.y } : { right: "1rem", bottom: "6rem" }}
			>
				<button
					type="button"
					className="flex min-w-0 flex-1 items-center gap-2"
					onClick={() => setMinimized(false)}
					aria-label="展开播放器"
				>
					{track?.cover ? (
						<img
							src={track.cover}
							alt=""
							referrerPolicy="no-referrer"
							className="h-8 w-8 shrink-0 rounded-full object-cover"
						/>
					) : (
						<span className="h-8 w-8 shrink-0 rounded-full bg-[var(--btn-regular-bg)]" />
					)}
					<span className="truncate text-xs text-90">{track?.title || playlistTitle}</span>
				</button>
				<button
					type="button"
					onPointerDown={onHandleDown}
					onPointerMove={onHandleMove}
					onPointerUp={onHandleUp}
					className="h-6 w-6 shrink-0 cursor-move touch-none rounded-full text-center text-xs leading-6 text-50 hover:text-[var(--primary)]"
					aria-label="拖动"
					title="拖动"
				>
					⠿
				</button>
			</div>
		);
	}

	return (
		<div
			ref={cardRef}
			className="fixed z-[70] overflow-hidden rounded-xl bg-[var(--card-bg)] shadow-lg"
			style={{
				width: `${width}px`,
				...(pos ? { left: pos.x, top: pos.y } : { right: "1rem", bottom: "6rem" }),
			}}
		>
			{/* 头部：拖动手柄 + 标题 + 操作（onHandleDown 放过 button，点击才有效） */}
			<div
				onPointerDown={onHandleDown}
				onPointerMove={onHandleMove}
				onPointerUp={onHandleUp}
				className="flex cursor-move touch-none items-center gap-1.5 px-3 py-2"
			>
				<span className="min-w-0 flex-1 truncate text-xs font-medium text-90" title={playlistTitle}>
					♪ {playlistTitle}
				</span>
				<button
					type="button"
					onClick={() => setMinimized(true)}
					className="h-5 w-5 rounded text-xs leading-5 text-50 hover:text-[var(--primary)]"
					aria-label="最小化"
					title="最小化"
				>
					—
				</button>
				<button
					type="button"
					onClick={close}
					className="h-5 w-5 rounded text-xs leading-5 text-50 hover:text-[var(--error)]"
					aria-label="关闭"
					title="关闭（本标签页）"
				>
					✕
				</button>
			</div>

			{/* 播放器：B 站 iframe（自带播放/暂停/进度/音量/全屏），点播前不加载。
			    提示：拖进度条时鼠标一旦拖出 iframe 边界手势就断了——把窗口拖大些更好拖；
			    右下角 ⤡ 可把整个卡片拉到 520px 宽 */}
			{started && track ? (
				<iframe
					key={track.bvid}
					src={`https://player.bilibili.com/player.html?bvid=${track.bvid}&page=1&high_quality=1&danmaku=0&autoplay=1`}
					allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
					allowFullScreen
					frameBorder="0"
					loading="lazy"
					title={track.title}
					className="aspect-video w-full"
				/>
			) : (
				<button type="button" onClick={() => setStarted(true)} className="group block w-full">
					{track?.cover ? (
						<img
							src={track.cover}
							alt=""
							referrerPolicy="no-referrer"
							className="aspect-video w-full object-cover transition group-hover:opacity-90"
						/>
					) : (
						<div className="aspect-video w-full bg-[var(--btn-regular-bg)]" />
					)}
					<span className="pointer-events-none relative -mt-10 mb-3 ml-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white shadow-md transition group-hover:bg-black/70">
						<svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden="true">
							<path d="M8 5v14l11-7z" />
						</svg>
					</span>
				</button>
			)}

			{/* 曲目行 */}
			<div className="px-3 pt-2">
				<p className="truncate text-sm text-90" title={track?.title}>
					{track?.title || "—"}
				</p>
				<p className="mt-0.5 truncate text-xs text-50">
					{track?.author || ""}
					{track ? ` · ${formatDuration(track.duration)}` : ""}
				</p>
			</div>

			{/* 控制行 */}
			<div className="flex items-center gap-1 px-3 py-2">
				<button
					type="button"
					onClick={() => playAt(current - 1)}
					className="h-7 w-7 rounded-full text-center leading-7 text-75 hover:bg-[var(--btn-regular-bg)] hover:text-[var(--primary)]"
					aria-label="上一首"
					title="上一首"
				>
					<svg viewBox="0 0 24 24" className="inline h-4 w-4" fill="currentColor" aria-hidden="true">
						<path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
					</svg>
				</button>
				<button
					type="button"
					onClick={() => playAt(current + 1)}
					className="h-7 w-7 rounded-full text-center leading-7 text-75 hover:bg-[var(--btn-regular-bg)] hover:text-[var(--primary)]"
					aria-label="下一首"
					title="下一首"
				>
					<svg viewBox="0 0 24 24" className="inline h-4 w-4" fill="currentColor" aria-hidden="true">
						<path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />
					</svg>
				</button>
				<span className="flex-1 text-center text-xs text-50">
					{tracks.length ? current + 1 : 0} / {tracks.length}
				</span>
				<button
					type="button"
					onClick={() => setListOpen((v) => !v)}
					className="h-7 rounded-full px-2.5 text-xs text-75 hover:bg-[var(--btn-regular-bg)] hover:text-[var(--primary)]"
					aria-label="播放列表"
					title="播放列表"
				>
					☰ 列表
				</button>
			</div>

			{/* 播放列表抽屉（封面必须 no-referrer，否则被 B 站防盗链 403） */}
			{listOpen && (
				<ul className="max-h-56 overflow-y-auto border-t border-black/5 px-1.5 py-1.5 dark:border-white/10">
					{tracks.map((t, i) => (
						<li key={t.bvid + i}>
							<button
								type="button"
								onClick={() => playAt(i)}
								className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-[var(--btn-regular-bg)] ${
									i === current ? "text-[var(--primary)]" : "text-75"
								}`}
							>
								<span className="w-5 shrink-0 text-center text-[10px] opacity-70">{i + 1}</span>
								<img
									src={t.cover}
									alt=""
									loading="lazy"
									referrerPolicy="no-referrer"
									className="h-7 w-12 shrink-0 rounded object-cover"
								/>
								<span className="min-w-0 flex-1 truncate" title={t.title}>
									{t.title}
								</span>
								<span className="shrink-0 text-[10px] opacity-70">{formatDuration(t.duration)}</span>
							</button>
						</li>
					))}
				</ul>
			)}

			{/* 右下角缩放手柄：横向拖拽调宽度（240–520，localStorage 记忆） */}
			<div
				onPointerDown={onResizeDown}
				onPointerMove={onResizeMove}
				onPointerUp={onResizeUp}
				className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
				style={{
					background:
						"linear-gradient(135deg, transparent 0 50%, var(--btn-regular-bg) 50% 62%, transparent 62% 74%, var(--btn-regular-bg) 74% 86%, transparent 86%)",
				}}
				role="separator"
				aria-label="调整播放器宽度"
				title="拖拽调整宽度"
			/>
		</div>
	);
}
