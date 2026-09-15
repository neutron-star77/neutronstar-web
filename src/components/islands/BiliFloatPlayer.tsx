/**
 * B 站收藏夹悬浮音乐播放器（Twilight 精简风格，2026-09-15 改造）。
 *
 * 挂在 Layout body（Swup 容器外），全站一个实例，页面切换音乐不断。
 * client:only="react"——配置与播放列表由浏览器现场拉取（后台改配置 ≤60s 生效），
 * 也天然避开「island SSR 返回 null 截断响应流」的坑（6.1.14）。
 *
 * 视觉（参考 https://github.com/Spr-Aachen/Twilight 的 musicPlayer）：
 *   - 折叠态 = 主色小圆球（56px，var(--primary) 底 + 白音符；播放中切声波条），
 *     点击一下即展开，无拖动、无封面、无光晕——保持精简单点即达
 *   - 展开态 = 固定右下角小卡片：封面圆图 + 标题/艺人 + 细进度条 + 时间 +
 *     控制行（循环/上首/播放/下首/列表）+ 底部音量 + 头部折叠/关闭
 *   - 去掉旧版封面大图 blur 光晕、背板高光描边、拖动交互等重装饰
 *
 * 音频源（issue #4 定稿 + 2026-09-15 大文件修复）：
 *   bilimusic 仓 audio/ 下按 bvid 命名，候选按序自动降级：
 *     1. `{bvid}/index.m3u8`  —— HLS 分片流（hls.js 播放；仅大文件存在：
 *        sync 脚本对 >18MB 音轨用 ffmpeg -c copy 无损切分，绕过 jsdelivr
 *        单文件 20MB 硬限制——超过会 403，见 6.3.20 补充）
 *     2. `{bvid}.m4a`         —— 常规主源（≤18MB）
 *     3. `{bvid}.mp3`         —— 手动上传兼容旧命名
 *   仍全部失败才标记坏曲跳过（B 站失效视频如 BV1TJ411K7nz 属此类）。
 *   gcore.jsdelivr CDN 直拉，秒开/可拖/零风控/不占 NAS 带宽；新文件 push 后
 *   即时回源（12h 缓存延迟仅影响同名文件更新）。
 *
 * 如何添加/修改歌曲：歌曲 = B 站收藏夹（media_id 由 /api/site-config/music_widget
 *   的 url 参数给出，当前 3631802308）。往收藏夹加/删视频 → 跑
 *   scripts/bilimusic-sync.ps1（每日 09:30 定时）自动下载/剔除并 push 音源仓。
 *
 * 连播：<audio> ended 事件天然驱动。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { apiGet } from "../../lib/api/client";

/** gcore.jsdelivr 在大陆可达性最好（坑 6.2.10），音频仓按 bvid 命名 */
const AUDIO_BASE =
	"https://gcore.jsdelivr.net/gh/neutron-star77/bilimusic@main/audio";
const LS_CLOSED = "bili-float-closed";
const CARD_W = 320;

/**
 * 音源候选（按序降级）：
 * - "hls"    = {bvid}/index.m3u8 分片流（hls.js；仅大文件有）
 * - ".m4a"   = 脚本无损主源
 * - ".mp3"   = 手动上传兼容
 */
const AUDIO_CANDIDATES = ["hls", ".m4a", ".mp3"] as const;

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

/** 精简暗玻璃卡（比旧版更轻：小 blur、无双高光描边） */
const GLASS: React.CSSProperties = {
	background: "rgba(17, 18, 26, 0.62)",
	backdropFilter: "blur(14px)",
	WebkitBackdropFilter: "blur(14px)",
	border: "1px solid rgba(255, 255, 255, 0.12)",
	boxShadow: "0 12px 32px rgba(0, 0, 0, 0.35)",
};

/** 线性图标（MDI 实心 path） */
const IcNote = () => (
	<svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
		<path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
	</svg>
);
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

/** 折叠球上的三格声波条动画（播放中） */
const EQ_CSS = `
.bili-eq{display:flex;align-items:flex-end;gap:2.5px;height:14px}
.bili-eq span{width:3px;border-radius:9999px;background:currentColor;animation:bili-eq-b 1s ease-in-out infinite}
.bili-eq span:nth-child(1){animation-delay:-.4s}
.bili-eq span:nth-child(2){animation-delay:-.2s}
.bili-eq span:nth-child(3){animation-delay:0s}
@keyframes bili-eq-b{0%,100%{height:4px}50%{height:14px}}
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
	const hlsRef = useRef<Hls | null>(null);
	/** 每 bvid 当前音源候选下标（降级记忆：切走再切回不重复试错） */
	const extIdxRef = useRef<Map<string, number>>(new Map());
	/** 最新 onAudioError 引用（供 hls 致命错误回调逃生用，避免闭包陈旧） */
	const onAudioErrorRef = useRef<() => void>(() => {});
	/** 最新 handleEnded 引用（供 hls MEDIA_ENDED 回调用，避免闭包陈旧） */
	const handleEndedRef = useRef<() => void>(() => {});
	/**
	 * 上次触发切歌的时间戳。hls.js（MSE）路径下流结束时可能先后触发
	 * 原生 audio ended + hls MEDIA_ENDED 两个事件，不加防抖会一次跳两首。
	 */
	const lastEndedAtRef = useRef(0);

	const track: Track | undefined = tracks[current];

	const srcUrl = useCallback((bvid: string, cand: string): string => {
		return cand === "hls"
			? `${AUDIO_BASE}/${bvid}/index.m3u8`
			: `${AUDIO_BASE}/${bvid}${cand}`;
	}, []);

	const audioSrc = useCallback(
		(bvid: string): string => {
			const cand = AUDIO_CANDIDATES[extIdxRef.current.get(bvid) ?? 0];
			return srcUrl(bvid, cand);
		},
		[srcUrl],
	);

	/** 把候选音源挂到 <audio>：hls 走 hls.js（MSE），否则直接当 src */
	const applySource = useCallback(
		(a: HTMLAudioElement, bvid: string, idx: number) => {
			if (hlsRef.current) {
				hlsRef.current.destroy();
				hlsRef.current = null;
			}
			const cand = AUDIO_CANDIDATES[idx];
			const url = srcUrl(bvid, cand);
			if (cand === "hls") {
				if (Hls.isSupported()) {
					const hls = new Hls({ maxBufferLength: 60, maxMaxBufferLength: 180 });
					hlsRef.current = hls;
					hls.on(Hls.Events.ERROR, (_evt, data) => {
						// 致命错误（网络/4xx 等）→ 顺序降级到 m4a/mp3
						if (data.fatal) onAudioErrorRef.current();
					});
					/**
					 * hls.js（MSE）播完点播流的可靠结束信号。原生 <audio> ended
					 * 在前端缓冲较大/MSE 下可能不触发（hls.js#2788 等），
					 * 必须监听 hls 自己的 MEDIA_ENDED 才能稳定自动切下一首。
					 */
					hls.on(Hls.Events.MEDIA_ENDED, () => handleEndedRef.current());
					hls.loadSource(url);
					hls.attachMedia(a);
					return;
				}
				// Safari 等原生支持 HLS 的浏览器直挂 m3u8
				if (a.canPlayType("application/vnd.apple.mpegurl")) {
					a.src = url;
					return;
				}
				onAudioErrorRef.current(); // 无 HLS 能力 → 直接降级
				return;
			}
			a.src = url;
		},
		[srcUrl],
	);

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

	/** 当前曲目变化 → 换源播放（playing 只经 ref 读取，避免暂停/播放状态变化重建音源丢进度） */
	const playingRef = useRef(playing);
	useEffect(() => {
		playingRef.current = playing;
	});
	useEffect(() => {
		const a = audioRef.current;
		if (!a || phase !== "ready" || !track) return;
		applySource(a, track.bvid, extIdxRef.current.get(track.bvid) ?? 0);
		if (playingRef.current) a.play().catch(() => {});
	}, [current, track, phase, applySource]);

	/** 音量同步 */
	useEffect(() => {
		if (audioRef.current) audioRef.current.volume = volume;
	}, [volume]);

	const go = useCallback(
		(delta: number) => {
			const len = tracks.length;
			if (len === 0) return;
			// React 状态 updater 必须纯函数——setCurrent 单独调用，
			// 不能嵌在 setTracks 的 updater 里（副作用会被 React 丢弃，导致不切歌）
			setCurrent((c) => {
				let n = (c + delta + len) % len;
				let guard = 0;
				while (badTracks.has(n) && guard < len) {
					n = (n + (delta >= 0 ? 1 : -1) + len) % len;
					guard += 1;
				}
				return n;
			});
			setPlaying(true);
		},
		[badTracks, tracks.length],
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
	 * 音频加载失败：先按候选序降级（hls→m4a→mp3），候选耗尽才标记坏曲跳过。
	 * （2026-09-15：hls 分片 4xx/断流同样走这里；jsdelivr 对新文件即时回源，
	 *   同名更新才有 12h 缓存延迟）
	 */
	const onAudioError = useCallback(() => {
		const a = audioRef.current;
		const t = tracks[current];
		if (!a || !t) return;
		const idx = extIdxRef.current.get(t.bvid) ?? 0;
		if (idx + 1 < AUDIO_CANDIDATES.length) {
			extIdxRef.current.set(t.bvid, idx + 1);
			applySource(a, t.bvid, idx + 1);
			a.play().catch(() => {});
			return;
		}
		setBadTracks((prev) => new Set(prev).add(current));
		setPlaying(false);
		next();
	}, [current, next, tracks, applySource]);

	useEffect(() => {
		onAudioErrorRef.current = onAudioError;
	});

	/**
	 * 一首播完的统一处理（原生 <audio> ended 与 hls.js MEDIA_ENDED 共用）。
	 * 带 500ms 防抖：同一首的结束事件（原生+hls 双触发）只切一次歌。
	 */
	const handleEnded = useCallback(() => {
		const now = Date.now();
		if (now - lastEndedAtRef.current < 500) return;
		lastEndedAtRef.current = now;

		if (!loop) {
			setPlaying(false);
			return;
		}
		// 单曲列表：没有下一首可切，原地重播
		if (tracks.length <= 1) {
			const a = audioRef.current;
			if (a) {
				a.currentTime = 0;
				void a.play().catch(() => {});
			}
			return;
		}
		next();
	}, [loop, next, tracks.length]);

	useEffect(() => {
		handleEndedRef.current = handleEnded;
	});

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
				className="fixed bottom-6 right-4 z-[70] rounded-full px-4 py-2 text-xs text-white/80"
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

	const dur = progress.dur || track?.duration || 0;
	const pct = dur > 0 ? Math.min(100, (progress.cur / dur) * 100) : 0;

	return (
		<div
			id="bili-float-player"
			className="fixed z-[60]"
			style={{
				right: minimized ? "1.5rem" : "1.25rem",
				bottom: minimized ? "1.5rem" : "1.25rem",
			}}
		>
			<style>{RANGE_CSS}</style>
			<style>{EQ_CSS}</style>

			{minimized ? (
				/* ── 折叠态：主色小圆球，点击一下即展开（Twilight 风格） ── */
				<button
					type="button"
					onClick={() => setMinimized(false)}
					title="展开播放器"
					aria-label="展开播放器"
					className="flex h-14 w-14 items-center justify-center rounded-full text-[#10121a] shadow-[0_10px_28px_rgba(0,0,0,.4)] transition-transform hover:scale-105 active:scale-95"
					style={{
						background: "var(--primary)",
						color: "var(--primary-contrast, #10121a)",
					}}
				>
					{playing ? (
						<div className="bili-eq">
							<span />
							<span />
							<span />
						</div>
					) : (
						<IcNote />
					)}
				</button>
			) : (
				/* ── 展开态：精简卡片 ── */
				<div
					className="overflow-hidden rounded-2xl"
					style={{ width: CARD_W, ...GLASS }}
					data-playing={String(playing)}
				>
					{/* 头部：封面圆图 + 标题/艺人 + 折叠/关闭 */}
					<div className="flex items-center gap-3 px-3 pb-0 pt-3">
						{track?.cover ? (
							<img
								src={track.cover}
								alt=""
								referrerPolicy="no-referrer"
								className="h-12 w-12 shrink-0 rounded-full border border-white/20 object-cover"
							/>
						) : (
							<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white">
								<IcNote />
							</div>
						)}
						<div className="min-w-0 flex-1">
							<div className="truncate text-[0.85rem] font-semibold leading-tight text-white">
								{track?.title || "…"}
							</div>
							<div className="mt-0.5 truncate text-xs leading-tight text-white/50">
								{track?.author || playlistTitle}
							</div>
						</div>
						<button
							type="button"
							className="rounded p-1 text-base leading-none text-white/50 hover:text-white"
							title="最小化"
							aria-label="最小化"
							onClick={() => setMinimized(true)}
						>
							▾
						</button>
						<button
							type="button"
							className="rounded p-1 text-xs leading-none text-white/50 hover:text-white"
							title="关闭"
							aria-label="关闭"
							onClick={close}
						>
							✕
						</button>
					</div>

					{/* 进度条 + 时间 */}
					<div className="px-3 pt-2">
						<input
							type="range"
							min={0}
							max={dur}
							value={progress.cur}
							onChange={onSeek}
							className="bili-range"
							style={{
								"--bili-fill": `${pct}%`,
								"--bili-accent": "var(--primary)",
							}}
							aria-label="播放进度"
						/>
						<div className="mt-1 flex justify-between text-[0.68rem] tabular-nums text-white/45">
							<span>{fmt(progress.cur)}</span>
							<span>{fmt(dur)}</span>
						</div>
					</div>

					{/* 控制行：循环/上首/播放/下首/列表 */}
					<div className="flex items-center justify-center gap-4 px-3 pt-1.5">
						<button
							type="button"
							className={`text-base leading-none transition-colors ${
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
							className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#15161c] shadow-[0_6px_20px_rgba(255,255,255,.22)] transition-transform hover:scale-105 active:scale-95"
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
							className={`text-base leading-none transition-colors ${
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

					{/* 底部：音量 + 列表 */}
					<div className="px-3 pb-3 pt-2">
						<div className="flex items-center gap-2">
							<span className="text-xs leading-none text-white/50">🔊</span>
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
							<div className="mt-2 max-h-44 overflow-y-auto rounded-xl bg-white/8 p-1">
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

			{/* 音频元素：换曲重建源；主源失败按候选序降级（onAudioError） */}
			<audio
				ref={audioRef}
				hidden
				preload="none"
				onPlay={() => setPlaying(true)}
				onPause={() => setPlaying(false)}
				onTimeUpdate={(e) => {
					const a = e.currentTarget;
					setProgress({ cur: a.currentTime, dur: a.duration || 0 });
				}}
				onEnded={handleEnded}
				onError={onAudioError}
			/>
		</div>
	);
}