/**
 * B 站收藏夹悬浮音乐播放器（Dribbble Glassmorphism 视觉，2026-09-14 重设计）。
 *
 * 挂在 Layout body（Swup 容器外），全站一个实例，页面切换音乐不断。
 * client:only="react"——配置与播放列表由浏览器现场拉取（后台改配置 ≤60s 生效），
 * 也天然避开「island SSR 返回 null 截断响应流」的坑（6.1.14）。
 *
 * 视觉（issue #1，参考 Dribbble 21918633/25219286/27573863）：
 *   - 固定暗玻璃卡（不随主题翻转，浮在任何壁纸/背景上都成立）：
 *     半透明暗底 + backdrop-blur + 1px 高光描边（顶边亮、底边暗）+ 大圆角
 *   - 封面光晕：封面自体 blur 溢出层垫底（无 canvas 取色，纯 CSS 同图复用）
 *   - 进度/音量：细轨道圆头填充（.bili-range，组件内 <style> 注入，绕开
 *     lightningcss 对 backdrop-filter 的改写坑 6.1.22——不用 tailwind 的 blur 类）
 *   - 主播放按钮：白底圆形 + hover 放大 + 微光
 *
 * 音频源（issue #4 定稿）：bilimusic 仓 audio/{bvid}.m4a（yt-dlp 无损 copy 主源）
 *   → 加载失败回退 {bvid}.mp3（兼容手动上传的旧命名），仍失败才标记坏曲跳过。
 *   gcore.jsdelivr CDN 直拉，秒开/可拖/零风控/不占 NAS 带宽。
 *
 * 连播：<audio> ended 事件天然驱动。
 * 交互：最小化 = 封面悬浮球（可拖动、点击展开）；刷新/关闭后重置右下角默认位；
 *       展开卡片头部可拖动（会话内有效）；封面图 referrerPolicy="no-referrer"（防盗链）。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "../../lib/api/client";

/** gcore.jsdelivr 在大陆可达性最好（坑 6.2.10），音频仓按 bvid 命名 */
const AUDIO_BASE =
	"https://gcore.jsdelivr.net/gh/neutron-star77/bilimusic@main/audio";
const LS_CLOSED = "bili-float-closed";
const CARD_W = 320;

/** 音源扩展名候选：m4a=脚本无损主源；mp3=手动上传兼容。失败按序降级 */
const AUDIO_EXTS = [".m4a", ".mp3"];

interface Track {
	bvid: string;
	title: string;
	cover: string;
	duration: number;
	author?: string;
}

interface MusicWidgetConfig {
	enabled?: boolean;
	url?: string;
}

interface FavPayload {
	title?: string;
	mediaCount?: number;
	tracks?: Track[];
}

const fmt = (sec: number): string => {
	if (!Number.isFinite(sec) || sec < 0) return "0:00";
	const m = Math.floor(sec / 60);
	const s = Math.floor(sec % 60);
	return `${m}:${String(s).padStart(2, "0")}`;
};

/** 暗玻璃卡通用样式（inline 写死 backdrop-filter，绕开 lightningcss 改写坑） */
const GLASS: React.CSSProperties = {
	background: "rgba(17, 18, 26, 0.58)",
	backdropFilter: "blur(24px) saturate(1.4)",
	WebkitBackdropFilter: "blur(24px) saturate(1.4)",
	border: "1px solid rgba(255, 255, 255, 0.14)",
	borderTopColor: "rgba(255, 255, 255, 0.3)",
	boxShadow: "0 18px 50px rgba(0, 0, 0, 0.45)",
};

/* 线性控制图标（MDI 实心 path，白色系） */
const IcPlay = () => (
	<svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
		<path d="M8 5v14l11-7z" />
	</svg>
);
const IcPause = () => (
	<svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
		<path d="M6 5h4v14H6zM14 5h4v14h-4z" />
	</svg>
);
const IcPrev = () => (
	<svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
		<path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
	</svg>
);
const IcNext = () => (
	<svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
		<path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />
	</svg>
);

/** 细轨道滑条样式：填充比例经 --bili-fill 注入（进度/音量共用） */
const RANGE_CSS = `
.bili-range{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:9999px;outline:none;cursor:pointer;
  background:linear-gradient(to right,var(--bili-accent,#fff) 0%,var(--bili-accent,#fff) var(--bili-fill,0%),rgba(255,255,255,.22) var(--bili-fill,0%));}
.bili-range::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#fff;
  box-shadow:0 0 0 3px rgba(255,255,255,.18);transition:transform .15s;}
.bili-range::-webkit-slider-thumb:hover{transform:scale(1.3);}
.bili-range::-moz-range-thumb{width:12px;height:12px;border:none;border-radius:50%;background:#fff;}
`;

export default function BiliFloatPlayer() {
	const [phase, setPhase] = useState<"boot" | "off" | "error" | "ready">("boot");
	const [errorMsg, setErrorMsg] = useState("");
	const [playlistTitle, setPlaylistTitle] = useState("B站收藏夹");
	const [tracks, setTracks] = useState<Track[]>([]);
	const [badTracks, setBadTracks] = useState<Set<number>>(new Set());
	const [current, setCurrent] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [progress, setProgress] = useState({ cur: 0, dur: 0 });
	const [volume, setVolume] = useState(0.8);
	const [minimized, setMinimized] = useState(false);
	const [listOpen, setListOpen] = useState(false);
	const [closed, setClosed] = useState(
		() =>
			typeof sessionStorage !== "undefined" &&
			sessionStorage.getItem(LS_CLOSED) === "1",
	);
	const [loop, setLoop] = useState(true);

	const audioRef = useRef<HTMLAudioElement>(null);
	const cardRef = useRef<HTMLDivElement>(null);
	const ballRef = useRef<HTMLDivElement>(null);
	/** 每 bvid 当前音源候选下标（回退记忆：切走再切回不重复试错） */
	const extIdxRef = useRef<Map<string, number>>(new Map());
	const dragState = useRef<{
		px: number;
		py: number;
		cx: number;
		cy: number;
		moved: boolean;
	} | null>(null);

	const track: Track | undefined = tracks[current];

	const audioSrc = useCallback((bvid: string): string => {
		const ext = AUDIO_EXTS[extIdxRef.current.get(bvid) ?? 0];
		return `${AUDIO_BASE}/${bvid}${ext}`;
	}, []);

	/** 拉配置与播放列表（music_widget → fid → /api/bili-fav） */
	useEffect(() => {
		let alive = true;
		(async () => {
			try {
				const cfg = await apiGet<MusicWidgetConfig>(
					"/api/site-config/music_widget",
				);
				const url = (cfg.url || "").trim();
				if (!alive) return;
				if (!cfg.enabled || !/^https?:\/\//i.test(url)) {
					setPhase("off");
					return;
				}
				const fid = /[?&]fid=(\d+)/.exec(url)?.[1];
				if (!fid) {
					setPhase("off");
					return;
				}
				const fav = await apiGet<FavPayload>(`/api/bili-fav?media_id=${fid}`);
				if (!alive) return;
				const list = (fav.tracks || []).filter((t) => t?.bvid);
				if (list.length === 0) {
					setPhase("off");
					return;
				}
				setTracks(list);
				setPlaylistTitle(fav.title || "B站收藏夹");
				setPhase("ready");
			} catch (e) {
				if (!alive) return;
				setErrorMsg(String(e));
				setPhase("error");
			}
		})();
		return () => {
			alive = false;
		};
	}, []);

	/** 当前曲目变化 → 换源播放 */
	useEffect(() => {
		const a = audioRef.current;
		if (!a || phase !== "ready" || !track) return;
		const src = audioSrc(track.bvid);
		if (!a.src.endsWith(src)) a.src = src;
		if (playing) a.play().catch(() => {});
	}, [current, track, phase, playing, audioSrc]);

	/** 音量同步 */
	useEffect(() => {
		if (audioRef.current) audioRef.current.volume = volume;
	}, [volume]);

	const go = useCallback(
		(delta: number) => {
			setTracks((list) => {
				if (list.length === 0) return list;
				setCurrent((c) => {
					let n = (c + delta + list.length) % list.length;
					let guard = 0;
					while (badTracks.has(n) && guard < list.length) {
						n = (n + (delta >= 0 ? 1 : -1) + list.length) % list.length;
						guard += 1;
					}
					return n;
				});
				return list;
			});
			setPlaying(true);
		},
		[badTracks],
	);

	const next = useCallback(() => go(1), [go]);
	const prev = useCallback(() => go(-1), [go]);

	const togglePlay = useCallback(() => {
		const a = audioRef.current;
		if (!a || !track) return;
		if (a.paused) a.play().catch(() => {});
		else a.pause();
	}, [track]);

	/**
	 * 音频加载失败：先按候选序降级扩展名（m4a→mp3），候选耗尽才标记坏曲跳过。
	 * （issue #4：仓内主源为 m4a，mp3 兼容手动上传旧文件）
	 */
	const onAudioError = useCallback(() => {
		const a = audioRef.current;
		const t = tracks[current];
		if (!a || !t) return;
		const idx = extIdxRef.current.get(t.bvid) ?? 0;
		if (idx + 1 < AUDIO_EXTS.length) {
			extIdxRef.current.set(t.bvid, idx + 1);
			a.src = audioSrc(t.bvid);
			a.play().catch(() => {});
			return;
		}
		setBadTracks((prev) => new Set(prev).add(current));
		setPlaying(false);
		next();
	}, [current, next, tracks, audioSrc]);

	/** 拖动（球与卡片头部共用；会话内有效，刷新即回默认位） */
	const onDragStart = (e: React.PointerEvent, el: HTMLElement | null) => {
		if (!el) return;
		const rect = el.getBoundingClientRect();
		dragState.current = {
			px: e.clientX,
			py: e.clientY,
			cx: rect.left,
			cy: rect.top,
			moved: false,
		};
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	};
	const onDragMove = (e: React.PointerEvent, el: HTMLElement | null) => {
		const st = dragState.current;
		if (!st || !el) return;
		const dx = e.clientX - st.px;
		const dy = e.clientY - st.py;
		if (!st.moved && Math.hypot(dx, dy) < 6) return;
		st.moved = true;
		const w = el.offsetWidth;
		const h = el.offsetHeight;
		el.style.left = `${Math.min(Math.max(st.cx + dx, 8), window.innerWidth - w - 8)}px`;
		el.style.top = `${Math.min(Math.max(st.cy + dy, 8), window.innerHeight - h - 8)}px`;
		el.style.right = "auto";
		el.style.bottom = "auto";
	};

	/** 球：松手时未拖动 = 点击 → 展开 */
	const onBallPointerUp = () => {
		if (dragState.current && !dragState.current.moved) setMinimized(false);
		dragState.current = null;
	};

	/** 进度条拖动 */
	const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
		const a = audioRef.current;
		if (!a) return;
		a.currentTime = Number(e.target.value);
	};

	const close = () => {
		try {
			sessionStorage.setItem(LS_CLOSED, "1");
		} catch {
			/* ignore */
		}
		setClosed(true);
	};

	if (closed) return null;

	/* 加载中：玻璃小提示条（client:only 水合后先短暂出现，取数完成即被替换） */
	if (phase === "boot") {
		return (
			<div
				className="fixed bottom-24 right-4 z-[70] rounded-full px-4 py-2 text-xs text-white/80"
				style={GLASS}
			>
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
				className="fixed z-[70] w-64 rounded-2xl p-3"
				style={{ right: "1rem", bottom: "6rem", ...GLASS }}
			>
				<div className="flex items-center justify-between gap-2">
					<span className="min-w-0 flex-1 truncate text-xs text-white/70">
						{errorMsg}
					</span>
					<button
						type="button"
						onClick={close}
						className="rounded-full px-1.5 text-xs text-white/60 hover:text-white"
						aria-label="关闭音乐挂件"
					>
						✕
					</button>
				</div>
			</div>
		);
	}

	const containerPos: React.CSSProperties = minimized
		? {
				position: "fixed",
				right: "1.5rem",
				bottom: "6rem",
				left: "auto",
				top: "auto",
			}
		: {
				position: "fixed",
				right: "1.5rem",
				bottom: "1.5rem",
				left: "auto",
				top: "auto",
			};

	const dur = progress.dur || track?.duration || 0;
	const pct = dur > 0 ? Math.min(100, (progress.cur / dur) * 100) : 0;

	return (
		<div
			ref={cardRef}
			id="bili-float-player"
			className="z-40 overflow-hidden rounded-3xl"
			style={{ width: minimized ? 56 : CARD_W, ...containerPos, ...GLASS }}
			data-playing={String(playing)}
		>
			{/* 细轨道滑条样式（进度/音量共用；组件内注入不经构建管线） */}
			<style>{RANGE_CSS}</style>
			{minimized ? (
				/* ── 最小化：封面悬浮球（可拖动，点击展开） ── */
				<div
					ref={ballRef}
					className="relative h-14 w-14 cursor-pointer select-none"
					onPointerDown={(e) => onDragStart(e, ballRef.current)}
					onPointerMove={(e) => onDragMove(e, ballRef.current)}
					onPointerUp={onBallPointerUp}
					title="展开播放器"
				>
					{track?.cover ? (
						<img
							src={track.cover}
							alt=""
							referrerPolicy="no-referrer"
							className="h-14 w-14 rounded-full border border-white/40 object-cover shadow-[0_8px_24px_rgba(0,0,0,.5)]"
						/>
					) : (
						<div
							className="flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-white/10 text-lg text-white"
							style={{
								backdropFilter: "blur(12px)",
								WebkitBackdropFilter: "blur(12px)",
							}}
						>
							♪
						</div>
					)}
					{playing && (
						<span className="absolute inset-0 rounded-full border border-white/60 opacity-60 motion-safe:animate-ping" />
					)}
				</div>
			) : (
				<div>
					{/* 头部：按住拖动 + 最小化/关闭 */}
					<div
						className="flex cursor-grab items-center justify-between px-3 py-2 active:cursor-grabbing"
						onPointerDown={(e) => {
							if ((e.target as HTMLElement).closest("button")) return;
							onDragStart(e, cardRef.current);
						}}
						onPointerMove={(e) => onDragMove(e, cardRef.current)}
						onPointerUp={() => (dragState.current = null)}
					>
						<span className="truncate text-[0.7rem] font-medium uppercase tracking-wider text-white/60">
							♪ {playlistTitle}
						</span>
						<div className="flex items-center gap-1">
							<button
								type="button"
								className="rounded px-1.5 text-xs text-white/50 hover:text-white"
								title="最小化"
								onClick={() => setMinimized(true)}
							>
								—
							</button>
							<button
								type="button"
								className="rounded px-1.5 text-xs text-white/50 hover:text-white"
								title="关闭"
								onClick={close}
							>
								✕
							</button>
						</div>
					</div>

					{/* 封面 + 自体光晕（同图 blur 溢出层，Dribbble 封面突出范式） */}
					{track?.cover && (
						<div className="relative mx-3 mb-3">
							<img
								src={track.cover}
								alt=""
								aria-hidden
								referrerPolicy="no-referrer"
								className="pointer-events-none absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 scale-[1.35] rounded-3xl object-cover opacity-70 blur-2xl saturate-150"
							/>
							<img
								src={track.cover}
								alt={track.title}
								referrerPolicy="no-referrer"
								className="relative aspect-[16/9] w-full rounded-2xl border border-white/20 object-cover shadow-lg"
							/>
						</div>
					)}

					{/* 信息 + 进度 + 控制 */}
					<div className="px-4 pb-4">
						<div className="mb-0.5 truncate text-sm font-bold text-white">
							{track?.title || "…"}
						</div>
						<div className="mb-3 truncate text-xs text-white/55">
							{track?.author || ""}
						</div>

						<input
							type="range"
							min={0}
							max={dur}
							value={progress.cur}
							onChange={onSeek}
							className="bili-range mb-1"
							style={{
								"--bili-fill": `${pct}%`,
								"--bili-accent": "var(--primary)",
							}}
							aria-label="播放进度"
						/>
						<div className="mb-3 flex justify-between text-[0.7rem] tabular-nums text-white/50">
							<span>{fmt(progress.cur)}</span>
							<span>{fmt(dur)}</span>
						</div>

						<div className="flex items-center justify-center gap-5">
							<button
								type="button"
								className={`text-base transition-colors ${
									loop ? "text-[var(--primary)]" : "text-white/60 hover:text-white"
								}`}
								title="列表循环"
								onClick={() => setLoop((v) => !v)}
							>
								⟳
							</button>
							<button
								type="button"
								className="text-white/85 transition-colors hover:text-white"
								title="上一首"
								onClick={prev}
							>
								<IcPrev />
							</button>
							<button
								type="button"
								className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#15161c] shadow-[0_8px_28px_rgba(255,255,255,.28)] transition-transform hover:scale-105 active:scale-95"
								title={playing ? "暂停" : "播放"}
								onClick={togglePlay}
							>
								{playing ? <IcPause /> : <IcPlay />}
							</button>
							<button
								type="button"
								className="text-white/85 transition-colors hover:text-white"
								title="下一首"
								onClick={next}
							>
								<IcNext />
							</button>
							<button
								type="button"
								className={`text-base transition-colors ${
									listOpen
										? "text-[var(--primary)]"
										: "text-white/60 hover:text-white"
								}`}
								title="播放列表"
								onClick={() => setListOpen((v) => !v)}
							>
								☰
							</button>
						</div>

						<div className="mt-3 flex items-center gap-2">
							<span className="text-xs text-white/50">🔊</span>
							<input
								type="range"
								min={0}
								max={1}
								step={0.05}
								value={volume}
								onChange={(e) => setVolume(Number(e.target.value))}
								className="bili-range"
								style={{ "--bili-fill": `${volume * 100}%` }}
								aria-label="音量"
							/>
						</div>

						{listOpen && (
							<div className="mt-3 max-h-44 overflow-y-auto rounded-xl bg-white/5 p-1">
								{tracks.map((t, i) => (
									<button
										key={t.bvid + i}
										type="button"
										className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
											i === current
												? "bg-white/12 font-bold text-white"
												: "text-white/60 hover:bg-white/8 hover:text-white"
										} ${badTracks.has(i) ? "opacity-40" : ""}`}
										onClick={() => {
											setCurrent(i);
											setPlaying(true);
										}}
									>
										{t.cover ? (
											<img
												src={t.cover}
												alt=""
												referrerPolicy="no-referrer"
												className="h-7 w-10 shrink-0 rounded object-cover"
											/>
										) : (
											<span className="w-7 shrink-0 text-center opacity-60">♪</span>
										)}
										<span className="truncate">{t.title}</span>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			)}

			{/* 音频元素：换曲重建 src；主源失败降级扩展名（onAudioError） */}
			<audio
				ref={audioRef}
				hidden
				preload="none"
				src={track ? audioSrc(track.bvid) : undefined}
				onPlay={() => setPlaying(true)}
				onPause={() => setPlaying(false)}
				onTimeUpdate={(e) => {
					const a = e.currentTarget;
					setProgress({ cur: a.currentTime, dur: a.duration || 0 });
				}}
				onEnded={() => {
					if (loop) next();
					else setPlaying(false);
				}}
				onError={onAudioError}
			/>
		</div>
	);
}
