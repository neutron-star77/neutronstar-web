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
