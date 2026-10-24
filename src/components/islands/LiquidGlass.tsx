/**
 * LiquidGlass —— 液态玻璃 React island
 *
 * adapted from github.com/haloo-cod/Nebula (MIT, LiquidGlass.vue)
 *
 * 结构：position:relative 容器内,底层 <canvas> 由共享 WebGL 渲染器绘制
 * 折射背景,上层渲染 children。渲染器模块为模块单例（全站 1 个 WebGL 上下文）,
 * 只在本组件首次可见且浏览器空闲时动态 import,绝不进首屏同步包。
 *
 * 降级路径（内容永远可读）：
 * - prefers-reduced-motion / deviceMemory < 4 / WebGL2 不可用 / 渲染器初始化失败
 *   → 容器加 .glass-fallback（backdrop-filter 磨砂 + 1px rgba 边框）
 * - 挂载到首帧渲染成功前,容器默认带 .glass-fallback,SSR/无 JS 时也有玻璃质感
 *
 * 背景纹理：优先采样 window.__nebulaBackgroundCanvas（NebulaBackground.astro
 * 生成的深空星点 canvas,按视口尺寸重绘时自动重新采样）;不存在或采样失败时
 * 用内置深空渐变兜底纹理。
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { GlassUniforms } from '../../lib/liquid-glass/liquidGlassRenderer';
import '../../styles/liquid-glass.css';

declare global {
  interface Window {
    __nebulaBackgroundCanvas?: HTMLCanvasElement | null;
  }
}

export interface LiquidGlassProps {
  children?: ReactNode;
  /** 圆角半径（CSS px）。 */
  radius?: number;
  /** 折射率,1.0 无折射,越高边缘弯曲越强。 */
  ior?: number;
  /** 玻璃厚度（物理折射位移基准,像素）。 */
  thickness?: number;
  /** 折射位移缩放。 */
  displacement?: number;
  /** 额外背景模糊半径;0 表示不模糊。 */
  blur?: number;
  className?: string;
  style?: CSSProperties;
}

/** 背景纹理的共享缓存键（纹理按 URL/键缓存,所有实例共用）。 */
const BG_TEXTURE_KEY = 'nebula-background-canvas';

/** 玻璃材质静态参数（取 Nebula 暗色预设,本站仅深空主题）。 */
const GLASS_PRESET = {
  normalStrength: 6.5,
  heightTransitionWidth: 10.0,
  sminSmoothing: 20.0,
  highlightWidth: 3.5, // CSS px,渲染时乘物理像素
  overlayColor: [0.2, 0.26, 0.32, 1.0] as [number, number, number, number],
};

const DEFAULTS = { radius: 24, ior: 1.2, thickness: 38, displacement: 0.7, blur: 0 };

type RendererModule = typeof import('../../lib/liquid-glass/liquidGlassRenderer');

/** 客户端能力检测：命中任一条件即走 CSS 磨砂降级。 */
function shouldFallback(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (typeof memory === 'number' && memory > 0 && memory < 4) return true;
  return false;
}

/** 浏览器空闲时执行（无 requestIdleCallback 时退化为短延时）。 */
function onIdle(cb: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (callback: () => void) => number;
  };
  let cancel: () => void;
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(cb);
    cancel = () => w.cancelIdleCallback?.(id);
  } else {
    const id = window.setTimeout(cb, 200);
    cancel = () => window.clearTimeout(id);
  }
  return cancel;
}

/** 内置深空渐变兜底纹理（零图片资产）。 */
function createDeepSpaceTexture(width = 1024, height = 1024): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#05060f');
  base.addColorStop(0.55, '#0b1026');
  base.addColorStop(1, '#05060f');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(
    width * 0.72,
    height * 0.28,
    0,
    width * 0.72,
    height * 0.28,
    width * 0.55,
  );
  glow.addColorStop(0, 'rgba(96, 118, 210, 0.22)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const r = Math.random() * 1.4 + 0.3;
    ctx.globalAlpha = Math.random() * 0.8 + 0.2;
    ctx.fillStyle = '#e7ecf7';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return canvas;
}

export default function LiquidGlass({
  children,
  radius = DEFAULTS.radius,
  ior = DEFAULTS.ior,
  thickness = DEFAULTS.thickness,
  displacement = DEFAULTS.displacement,
  blur = DEFAULTS.blur,
  className,
  style,
}: LiquidGlassProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /** 共享 uniforms 对象（渲染器每帧读取）,初始化 effect 内创建。 */
  const uniformsRef = useRef<GlassUniforms | null>(null);
  /** 渲染器模块是否已加载（决定卸载时是否需要注销实例）。 */
  const rendererLoadedRef = useRef(false);
  /** 'pending'：等待初始化（展示 fallback 质感）;之后二选一。 */
  const [mode, setMode] = useState<'pending' | 'webgl' | 'fallback'>('pending');
  const [canvasVisible, setCanvasVisible] = useState(false);
  /** 最新 props 快照,供长生命周期回调读取。 */
  const propsRef = useRef({ radius, ior, thickness, displacement, blur });
  propsRef.current = { radius, ior, thickness, displacement, blur };

  useEffect(() => {
    if (shouldFallback()) {
      setMode('fallback');
      return;
    }
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) {
      setMode('fallback');
      return;
    }

    let disposed = false;
    let instanceId = 0;
    let ctx2d: CanvasRenderingContext2D | null = null;
    let frameId = 0;
    let idleCancel: (() => void) | null = null;
    let observer: IntersectionObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let lastBgWidth = 0;
    let lastBgHeight = 0;
    let bgBitmap: ImageBitmap | null = null;

    const uniforms: GlassUniforms = {
      resolution: [0, 0],
      mousePos: [0, 0],
      glassSize: [0, 0],
      canvasOffset: [0, 0],
      sampleRotation: 0,
      texAspect: 1,
      cornerRadius: 0,
      ior: 0,
      glassThickness: 0,
      normalStrength: 0,
      displacementScale: 0,
      heightTransitionWidth: 0,
      sminSmoothing: 0,
      showNormals: 0,
      blurRadius: 0,
      overlayColor: [...GLASS_PRESET.overlayColor],
      highlightWidth: 0,
      edgeAaWidth: 1,
      trailPoints: Array.from({ length: 12 }, () => [0, 0, 1, 0] as [number, number, number, number]),
      trailRadius: 0,
      trailStrength: 0,
    };
    uniformsRef.current = uniforms;

    const toCanvasPixels = (value: number, scale: number): number =>
      value * (window.devicePixelRatio || 1) * scale;

    const syncCanvasOffset = (renderer: RendererModule) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const scale = renderer.getRenderScale();
      uniforms.resolution = [window.innerWidth * dpr * scale, window.innerHeight * dpr * scale];
      uniforms.canvasOffset = [rect.left * dpr * scale, rect.top * dpr * scale];
    };

    const syncCanvasSize = (renderer: RendererModule) => {
      const el = containerRef.current;
      const cv = canvasRef.current;
      if (!el || !cv) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w < 1 || h < 1) return;
      const dpr = window.devicePixelRatio || 1;
      const scale = renderer.getRenderScale();
      const pw = Math.max(1, Math.round(w * dpr * scale));
      const ph = Math.max(1, Math.round(h * dpr * scale));
      uniforms.edgeAaWidth = renderer.getEdgeAaWidth(dpr, scale);
      uniforms.cornerRadius = toCanvasPixels(propsRef.current.radius, scale);
      uniforms.highlightWidth = toCanvasPixels(GLASS_PRESET.highlightWidth, scale);
      cv.width = pw;
      cv.height = ph;
      uniforms.glassSize = [pw, ph];
      uniforms.mousePos = [pw / 2, ph / 2];
      syncCanvasOffset(renderer);
    };

    /** 采样页面背景 canvas（或内置兜底渐变）并上传为共享纹理。 */
    const ensureBackgroundTexture = async (renderer: RendererModule): Promise<boolean> => {
      const bgCanvas = window.__nebulaBackgroundCanvas ?? null;
      if (bgCanvas && bgCanvas.width > 0 && bgCanvas.height > 0) {
        const resized =
          bgCanvas.width !== lastBgWidth || bgCanvas.height !== lastBgHeight;
        if (resized || !renderer.hasTexture(BG_TEXTURE_KEY)) {
          try {
            const next = await createImageBitmap(bgCanvas);
            if (disposed) {
              next.close();
              return false;
            }
            if (bgBitmap) bgBitmap.close();
            bgBitmap = next;
            renderer.deleteTexture(BG_TEXTURE_KEY);
            if (renderer.uploadTexture(BG_TEXTURE_KEY, next)) {
              lastBgWidth = bgCanvas.width;
              lastBgHeight = bgCanvas.height;
            }
          } catch {
            // 采样失败则走兜底纹理
          }
        }
      }
      if (!renderer.hasTexture(BG_TEXTURE_KEY)) {
        try {
          const fallbackCanvas = createDeepSpaceTexture();
          const bitmap = await createImageBitmap(fallbackCanvas);
          if (disposed) {
            bitmap.close();
            return false;
          }
          renderer.uploadTexture(BG_TEXTURE_KEY, bitmap);
        } catch {
          return false;
        }
      }
      uniforms.texAspect = renderer.getTextureAspect(BG_TEXTURE_KEY);
      return renderer.hasTexture(BG_TEXTURE_KEY);
    };

    const handleContextLost = () => {
      setCanvasVisible(false);
      setMode('fallback');
    };
    const handleContextRestored = () => {
      void (async () => {
        const renderer = await import('../../lib/liquid-glass/liquidGlassRenderer');
        if (disposed) return;
        const ready = await ensureBackgroundTexture(renderer);
        if (!ready || !instanceId) {
          setMode('fallback');
          return;
        }
        renderer.setInstanceBackground(instanceId, BG_TEXTURE_KEY);
        renderer.markInstanceReady(instanceId, true);
        setMode('webgl');
      })();
    };

    const start = async () => {
      let renderer: RendererModule;
      try {
        renderer = await import('../../lib/liquid-glass/liquidGlassRenderer');
      } catch {
        setMode('fallback');
        return;
      }
      if (disposed) return;
      rendererLoadedRef.current = true;

      ctx2d = canvas.getContext('2d');
      if (!ctx2d) {
        setMode('fallback');
        return;
      }

      const p = propsRef.current;
      uniforms.ior = p.ior;
      uniforms.glassThickness = p.thickness;
      uniforms.displacementScale = p.displacement;
      uniforms.blurRadius = p.blur;

      instanceId = renderer.registerInstance(canvas, ctx2d, uniforms, BG_TEXTURE_KEY, () => {
        setCanvasVisible(true);
      });
      renderer.onContextLost(handleContextLost);
      renderer.onContextRestored(handleContextRestored);

      // registerInstance 内部会初始化 WebGL 并检测 renderScale,
      // 因此尺寸与物理像素参数必须在注册后计算。
      syncCanvasSize(renderer);

      resizeObserver = new ResizeObserver(() => {
        syncCanvasSize(renderer);
        if (instanceId) renderer.markInstanceReady(instanceId, uniforms.glassSize[0] >= 1);
      });
      resizeObserver.observe(container);

      // 每帧同步视口偏移（滚动/布局变化时折射采样位置跟随）
      const frameUpdate = () => {
        syncCanvasOffset(renderer);
        frameId = requestAnimationFrame(frameUpdate);
      };
      frameId = requestAnimationFrame(frameUpdate);

      const textureReady = await ensureBackgroundTexture(renderer);
      if (disposed) return;
      const [gw, gh] = uniforms.glassSize;
      if (textureReady && instanceId && gw >= 1 && gh >= 1) {
        renderer.markInstanceReady(instanceId, true);
        setMode('webgl');
      } else {
        setMode('fallback');
      }
    };

    // 懒加载：等容器可见 + 浏览器空闲,再动态 import 渲染器
    observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer?.disconnect();
        observer = null;
        idleCancel = onIdle(() => {
          idleCancel = null;
          void start();
        });
      },
      { rootMargin: '120px' },
    );
    observer.observe(container);

    return () => {
      disposed = true;
      observer?.disconnect();
      resizeObserver?.disconnect();
      if (idleCancel) idleCancel();
      if (frameId) cancelAnimationFrame(frameId);
      // 渲染器从未加载过（不可见即卸载）就不必为注销而拉起整个模块
      if (rendererLoadedRef.current) {
        void (async () => {
          const renderer = await import('../../lib/liquid-glass/liquidGlassRenderer');
          if (instanceId) renderer.unregisterInstance(instanceId);
          renderer.offContextCallbacks(handleContextLost, handleContextRestored);
        })();
      }
      if (bgBitmap) bgBitmap.close();
    };
    // 初始化只做一次;props 变化走下方同步 effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // props 调参：直接写共享 uniforms 对象,渲染器下一帧即生效。
  // cornerRadius / highlightWidth 依赖物理像素换算,由 syncCanvasSize 按 propsRef 更新。
  useEffect(() => {
    const uniforms = uniformsRef.current;
    if (!uniforms) return;
    uniforms.ior = ior;
    uniforms.glassThickness = thickness;
    uniforms.displacementScale = displacement;
    uniforms.blurRadius = blur;
  }, [ior, thickness, displacement, blur]);

  const shellClass = [
    'liquid-glass-shell',
    mode !== 'webgl' ? 'glass-fallback' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClass} style={style}>
      <canvas
        ref={canvasRef}
        className={
          canvasVisible
            ? 'liquid-glass-shell__canvas liquid-glass-shell__canvas--visible'
            : 'liquid-glass-shell__canvas'
        }
        aria-hidden="true"
      />
      <div className="liquid-glass-shell__content">{children}</div>
    </div>
  );
}
