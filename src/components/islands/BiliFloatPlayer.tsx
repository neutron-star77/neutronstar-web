/**
 * B 站收藏夹悬浮音乐播放器（APlayer 风格重写，2026-09-14）。
 *
 * 挂在 Layout body（Swup 容器外），全站一个实例，页面切换音乐不断。
 * client:only="react"——配置与播放列表由浏览器现场拉取（后台改配置 ≤60s 生效），
 * 也天然避开「island SSR 返回 null 截断响应流」的坑（6.1.14）。
 *
 * 音频源（两级，对比 2026-09-13 方案的重大升级——**不再内嵌 B 站 iframe**）：
 *   1. 主源：GitHub 仓 neutron-star77/bilimusic 的 audio/{bvid}.mp3（gcore.jsdelivr
 *      CDN 直拉，秒开/可拖/零风控/不占 NAS 带宽）。上传规范见 docs/站点功能与使用说明.md
 *   2. 回退：/api/bili-audio?bvid=（NAS 后端 view→playurl→流转发，spi-buvid 版），
 *      GitHub 上还没有该曲的音频文件时临时使用；B 站风控窗口期会失败 → 跳曲并标记
 *
 * 连播：<audio> ended 事件天然驱动（旧 iframe 方案的 message/定时器双保险全部退役）。
 *
 * 交互（2026-09-14 用户要求）：
 *   - 最小化 = 封面悬浮球，**可拖动**，点击展开；**刷新/关闭后重置回默认右下角**
 *     （位置不再写 localStorage），卡片宽度固定 320 不再缩放
 *   - 展开卡片头部可拖动（同样是会话内有效）
 *   - 进度条/音量条直接驱动 <audio>，无跨域 iframe 手势问题（旧坑全数消失）
 *   - 所有封面图 referrerPolicy="no-referrer"（B 站图床防盗链，坑 6.3.19）
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "../../lib/api/client";

/** gcore.jsdelivr 在大陆可达性最好（坑 6.2.10），音频仓按 bvid 命名 */
const AUDIO_BASE =
	"https://gcore.jsdelivr.net/gh/neutron-star77/bilimusic@main/audio";
const LS_CLOSED = "bili-float-closed";
const CARD_W = 320;

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

/** 音源两级：GitHub 主源 → 后端 B 站代理回退 */
const sources = (bvid: string): string[] => [
	`${AUDIO_BASE}/${bvid}.mp3`,
	`/api/bili-audio?bvid=${bvid}`,
];

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
	const dragState = useRef<{
		px: number;
		py: number;
		cx: number;
		cy: number;
		moved: boolean;
	} | null>(null);

	const track: Track | undefined = tracks[current];

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
		const [main] = sources(track.bvid);
		if (!a.src.endsWith(main)) a.src = main;
		if (playing) a.play().catch(() => {});
	}, [current, track, phase, playing]);

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

	/** 音频加载失败：主源 → 回退源 → 标记坏曲跳下一首 */
	const onAudioError = useCallback(() => {
		const a = audioRef.current;
		if (!a || !track) return;
		const [, fallback] = sources(track.bvid);
		if (!a.src.endsWith(fallback)) {
			a.src = fallback;
			a.play().catch(() => {});
			return;
		}
		setBadTracks((prev) => new Set(prev).add(current));
		setPlaying(false);
		next();
	}, [track, current, next]);

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
				style={{ right: "1rem", bottom: "6rem" }}
			>
				<div className="flex items-center justify-between gap-2">
					<span className="min-w-0 flex-1 truncate text-xs text-75">
						{errorMsg}
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

	return (
		<div
			ref={cardRef}
			id="bili-float-player"
			className="float-panel z-40 overflow-hidden rounded-2xl shadow-2xl"
			style={{ width: minimized ? 56 : CARD_W, ...containerPos }}
			data-playing={String(playing)}
		>
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
							className="h-14 w-14 rounded-full border-2 border-[var(--primary)] object-cover shadow-lg"
						/>
					) : (
						<div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg">
							♪
						</div>
					)}
					{playing && (
						<span className="absolute inset-0 rounded-full border-2 border-[var(--primary)] opacity-60 motion-safe:animate-ping" />
					)}
				</div>
			) : (
				<div>
					{/* 头部：按住拖动 + 最小化/关闭 */}
					<div
						className="flex cursor-grab items-center justify-between bg-[var(--surface-container-high)] px-3 py-1.5 active:cursor-grabbing"
						onPointerDown={(e) => {
							if ((e.target as HTMLElement).closest("button")) return;
							onDragStart(e, cardRef.current);
						}}
						onPointerMove={(e) => onDragMove(e, cardRef.current)}
						onPointerUp={() => (dragState.current = null)}
					>
						<span className="truncate text-xs font-bold text-[var(--on-surface-variant)]">
							♪ {playlistTitle}
						</span>
						<div className="flex items-center gap-1">
							<button
								type="button"
								className="rounded px-1.5 text-xs text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
								title="最小化"
								onClick={() => setMinimized(true)}
							>
								—
							</button>
							<button
								type="button"
								className="rounded px-1.5 text-xs text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
								title="关闭"
								onClick={close}
							>
								✕
							</button>
						</div>
					</div>

					{/* 封面 */}
					{track?.cover && (
						<img
							src={track.cover}
							alt=""
							referrerPolicy="no-referrer"
							className="h-40 w-full object-cover"
						/>
					)}

					{/* 信息 + 进度 + 控制（APlayer 风格） */}
					<div className="bg-[var(--surface-container-low)] p-3">
						<div className="mb-1 truncate text-sm font-bold text-[var(--on-surface)]">
							{track?.title || "…"}
						</div>
						<div className="mb-2 truncate text-xs text-[var(--on-surface-variant)]">
							{track?.author || ""}
						</div>

						<input
							type="range"
							min={0}
							max={progress.dur || track?.duration || 0}
							value={progress.cur}
							onChange={onSeek}
							className="mb-1 w-full accent-[var(--primary)]"
							aria-label="播放进度"
						/>
						<div className="mb-2 flex justify-between text-[0.7rem] tabular-nums text-[var(--on-surface-variant)]">
							<span>{fmt(progress.cur)}</span>
							<span>{fmt(progress.dur || track?.duration || 0)}</span>
						</div>

						<div className="flex items-center justify-center gap-4">
							<button
								type="button"
								className={`text-lg ${loop ? "text-[var(--primary)]" : "text-[var(--on-surface-variant)]"}`}
								title="列表循环"
								onClick={() => setLoop((v) => !v)}
							>
								⟳
							</button>
							<button
								type="button"
								className="text-xl text-[var(--on-surface)]"
								title="上一首"
								onClick={prev}
							>
								⏮
							</button>
							<button
								type="button"
								className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-xl text-white shadow-md active:scale-95"
								title={playing ? "暂停" : "播放"}
								onClick={togglePlay}
							>
								{playing ? "⏸" : "▶"}
							</button>
							<button
								type="button"
								className="text-xl text-[var(--on-surface)]"
								title="下一首"
								onClick={next}
							>
								⏭
							</button>
							<button
								type="button"
								className={`text-lg ${listOpen ? "text-[var(--primary)]" : "text-[var(--on-surface-variant)]"}`}
								title="播放列表"
								onClick={() => setListOpen((v) => !v)}
							>
								☰
							</button>
						</div>

						<div className="mt-2 flex items-center gap-2">
							<span className="text-xs text-[var(--on-surface-variant)]">🔊</span>
							<input
								type="range"
								min={0}
								max={1}
								step={0.05}
								value={volume}
								onChange={(e) => setVolume(Number(e.target.value))}
								className="w-full accent-[var(--primary)]"
								aria-label="音量"
							/>
						</div>

						{listOpen && (
							<div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-[var(--surface-container)] p-1">
								{tracks.map((t, i) => (
									<button
										key={t.bvid + i}
										type="button"
										className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs ${
											i === current
												? "bg-[var(--primary)]/15 font-bold text-[var(--primary)]"
												: "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
										} ${badTracks.has(i) ? "opacity-40" : ""}`}
										onClick={() => {
											setCurrent(i);
											setPlaying(true);
										}}
									>
										<span className="w-5 shrink-0 text-right opacity-60">
											{i + 1}
										</span>
										<span className="truncate">{t.title}</span>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			)}

			{/* 音频元素：换曲重建 src；主源失败自动回退代理（onAudioError） */}
			<audio
				ref={audioRef}
				hidden
				preload="none"
				src={track ? sources(track.bvid)[0] : undefined}
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
