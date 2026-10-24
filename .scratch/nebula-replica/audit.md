# Nebula 主题复刻 · 验收记录（2026-10-24）

## 交付

- CI `feat(theme): Nebula 主题全面复刻` success（web `09f35c4`），已上线 neutronstar.fun。
- 复刻内容：深空星空背景（程序化 canvas）、全站玻璃卡（白8%/blur12/白12%边框/三层阴影）、
  LiquidGlass WebGL 渲染器移植（MIT, adapted from haloo-cod/Nebula）+ React island（懒加载/降级）、
  首页三段入场（打字机→胶囊→面板）、归档 SVG 发光河流拖拽时间轴、友链头像鱼缸、
  文章详情暗玻璃 + 返回胶囊、默认暗色主题。
- 数据链路零改动：文章/相册/说说/友链 API、Waline 评论、点赞、RSS/sitemap、LiveRefresh 不变。

## 验证

- `astro build` exit 0；本地 preview 截图（首页/文章/归档/友链）人工比对通过。
- 线上截图：首页/归档结构、玻璃质感、发光河流与本地一致；14 路由 200（见主仓验收清单）。
- 过程修复：CI 前的 dist 哈希错配（并发构建污染，全清重建解决）；
  `onload-animation` 初始 opacity:0 被 animation:none 后永久隐形（强制 opacity:1）；
  Tailwind dark: 需 html.dark（默认主题切 DARK_MODE）；`/bff/archive` 上游 404 静默回空
  （BFF 增补兼容适配器，本地分页）。

## 已知事项

- 线上有「ApiError Not Found」toast：音乐/统计 island 请求的个别端点在 v2 后端不存在
  （/api/bili-fav 等属旧 :8100 后端）——随「后端重构部署 NAS」一并解决。
- LiquidGlass 渲染器当前仅首页 hero 启用；覆盖到全部玻璃卡是后续优化。
- 归档河流/鱼缸在无头截图里封面图未加载（headless 网络限制），真实浏览器正常。

## 2026-10-24 追加：真实折射效果上线（用户反馈修正）

用户指出此前只是 CSS 磨砂回退、背景太暗无物可折。修正：

- NebulaBackground 重绘：紫/青/玫瑰云气 + 银河带 + 520 彩色星群（折射有物可折）；
- LiquidGlass 补齐 Nebula 涟漪协议：容器 pointerenter/move/leave 拖尾
  （最小间距 14px、寿命 1100ms、半径 66、强度 0.34）+ 背景纹理 1.2s 周期重采样；
- 修复三处静默失败：外壳 div 丢失 containerRef、requestIdleCallback 被星空
  rAF 循环饿死（加 timeout 1500）、渲染器缩放 ref 声明缺失；
- 首页胶囊/资料/看板/文章卡全部接入 LiquidGlass（client:load）。

线上验证（真实 Cloudflare 环境）：6/6 玻璃壳 WebGL 激活、canvas 可见、渲染器 chunk 加载、
背景画布就绪；截图确认面板内可见云气折射光晕。
排查工具：headless Edge 探针（水合状态/资源加载/console），其间定位
requestIdleCallback 饿死与 ref 丢失两个静默失败。
