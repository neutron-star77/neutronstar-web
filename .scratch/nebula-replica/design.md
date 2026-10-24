# Nebula 主题全面复刻 · 设计文档（方案 B）

> 参考：blog.starlitn.top（演示站）+ github.com/haloo-cod/Nebula（MIT）。
> 原则（仓库约定）：只参考公开演示的视觉/交互；MIT 渲染器模块可适配移植（注明出处），页面代码自研。
> 架构：维持方案 B —— Astro 静态/SSR 混合 + React/Svelte islands 按需加载 + BFF + FastAPI/PostgreSQL。不改数据链路与路由。

## 一、路由映射（Nebula view → 本站路由）

| Nebula | 本站 | 复刻要点 |
|---|---|---|
| index | / | 星空背景 + 液态玻璃卡列表（标题站名 hero + 最新文章玻璃卡） |
| blog | /posts/ | 玻璃卡文章列表 + 分页 |
| post | /posts/[slug] | 玻璃文章容器 + 目录 + Waline 评论 + 点赞 |
| archive | /archive/ | 文本时间线 + 玻璃分组卡 |
| gallery/images | /albums/、/albums/[slug] | 玻璃相册卡 + 灯箱保留 |
| moments | /moments/ | 玻璃说说流 |
| friends | /friends/ | 玻璃友链卡 |
| treasure(收藏) | /bookmark/ | 玻璃站点卡分组 |
| books | /novel/、/novel/[slug] | 玻璃书架 + 阅读页 |
| about | /about/ | 玻璃简介卡 |
| —（留言） | /messages/ | Waline 玻璃容器 |

## 二、视觉系统（design tokens）

- 背景：程序化星空（canvas 星点 + 深空蓝黑渐变 `#05060f → #0b1026`），`PageBackground` 等效组件按路由 overlay（默认 0.09→暗页 0.25）。
- 玻璃面板：半透明填充 `rgba(13,17,32,.55)`，1px 边框 `rgba(255,255,255,.14)`，圆角 20px，背景由 LiquidGlass WebGL 渲染器折射（ior/thickness/displacement 参数取自 Nebula 默认值）。
- 强调色：cyan `#7dd3fc`（主）、violet `#a78bfa`（次）、gold `#f5d491`（元数据）。
- 字体：正文沿用现有字体栈（ZenMaruGothic+Loli 已有子集），标题 letter-spacing 收紧。
- 暗色为默认；`prefers-reduced-motion` / 低端设备 → 回退 CSS `backdrop-filter` 毛玻璃（无 WebGL）。

## 三、LiquidGlass 移植策略

- 源：`blog-frontend/src/components/liquid-glass/liquidGlassRenderer.ts`（1539 行，模块单例 WebGL OffscreenCanvas，MIT）。
- 移植为 `web/src/lib/liquid-glass/`（renderer + queue + metrics 原样适配 TS 配置），
  React island `src/components/islands/LiquidGlass.tsx` 懒加载（client:visible / requestIdleCallback），
  单一 WebGL 上下文全站共享；`PerfMonitor` 简化为自动降级（fps<30 或 prefers-reduced-motion → CSS 回退）。
- 玻璃卡统一走 `<GlassPanel>` 包装（canvas 置于内容之下，采样底层背景纹理）。

## 四、实施顺序

1. tokens + PageBackground（星空 canvas）+ 全局暗色基底
2. renderer 移植 + LiquidGlass/GlassPanel island
3. 导航壳（玻璃顶栏 + 移动抽屉保留）
4. 页面逐个复刻（上表），每页 build 验证
5. 部署 + 线上视觉验收（截图对照 blog.starlitn.top 布局结构）

## 五、验收

- 14 路由 200；文章/评论/点赞/RSS/sitemap 行为不变；首屏不加载 renderer（懒加载）
- 桌面/移动两档截图；reduced-motion 回退可读
