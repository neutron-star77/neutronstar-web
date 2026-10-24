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

## 2026-10-24 再追加：壁纸打底（第二轮用户反馈）

用户确认玻璃是真实的了，但背景缺一张真正的壁纸。更换为 JWST「宇宙悬崖」
（Carina Nebula，NASA/STScI public domain，nebula-desktop.jpg 389KB）以 cover
绘入背景画布，LiquidGlass 直接折射壁纸；nebula.css 加暗色遮罩+底部渐晕保可读。
线上截图确认与 blog.starlitn.top 观感同型。web `04d75f4`。

## 2026-10-24 三轮：全站内页玻璃 + 正文字体提亮（用户反馈修正）

- MainGridLayout 内容列整体包 LiquidGlass（client:load）→ 文章/列表/归档/相册/
  说说/收藏/小说/留言/关于全部自动获得透明玻璃大面板，一改全站生效；
- 面板内旧卡片容器（card-base/kirameku-article）透明化，消除双重玻璃；
- overlayColor alpha 1.0 → 0.42（面板更透）；
- 正文可读性修复：壁纸上文字提亮 #f3f6fd + 投影（用户反馈正文字体太浅看得累）；
- 线上验证：文章详情/列表截图通过（web `89f4cd4`）。
- 已知：文章封面图等引用旧 :8100 后端 /uploads 的资源在 v2 后端 404（同 ApiError
  toast），随后端部署日解决。

## 2026-10-24 四轮：导航/首页卡片/内页玻璃/文字（用户标注图反馈）

- TopAppBar：滑动胶囊指示器（hover/激活跟随）、删除调色板、搜索重设计
  （放大镜展开玻璃搜索条 + Pagefind 下拉）、背景统一 nebula 透明令牌；
- 导航全局化：TopAppBar 从 MainGridLayout 上移至 Layout（含首页全站渲染）；
- 首页文章卡改「文字|图片」双容器（封面缺失渐变占位），左右占比经
  site_config key=home_card_ratio 后台可调（默认 3:2，移动端图上文下）；
- MainGridLayout 内容列包 LiquidGlass（全内页透明玻璃大面板），
  内层卡片透明化，overlayColor alpha 1.0→0.42，正文/meta 文字提亮+投影；
- BiliFloatPlayer：music_widget 404 静默关闭（ApiError toast 消失）；
- web `6b9ceb1`+`89f4cd4`+`11b4393`+`06485c3` CI 全绿，线上截图比对通过。

NAS 侧（主仓文档）：5 容器迁入自定义 docker 网络 neutronstar（容器名互连，
根治 IP 漂移）；backend/waline/v2-api 数据库地址全部改容器名；
v2-api 的 .env 在排障中被截断，已按 config.py 默认+容器凭据重建（ADMIN_TOKEN
已轮换，新值在 NAS /share/.../neutronstar-v2/.admin-token）；旧后端容器
恢复 8100 端口映射，内网后台恢复可达。教训（坑大全 6.7.3b/6.7.3c）：
①busybox sed -i 对 bind 单文件会截断；②容器重建不继承网络接入，需重新 connect。

## 2026-10-24 五轮：用户壁纸 + 导航拍平 + 首页极简化（用户标注图反馈）

- 背景换用户指定 wlop 壁纸（4K→2560w/82 质量，602KB）；
- 首页极简：删打字机/胶囊/资料面板/数据看板，只留全局导航 + 文章卡 + footer；
- 导航拍平：「更多」取消，时间线/项目/关于/GitHub 提升一级；
- 解除页面级大玻璃板：每条文章独立玻璃框（用户：不要共享背景框，要每条一个）；
- 搜索悬停展开（原来点击）；语言面板本就悬停开/离开收（260ms）合规；
- 封面加载失败露渐变兜底（旧后端 /uploads 404 过渡期）；
- web `5a1c835` CI 绿已上线，线上截图确认壁纸铺满+独立玻璃框+导航拍平。

## 2026-10-24 六轮：搜索挤开式展开 + 导航精简 + 单行卡片（用户标注图反馈）

- 搜索展开改「占位挤开式」：SearchBar 从绝对定位悬浮改为 in-flow 宽度动画
  （40→256px），展开时把左侧菜单推开，不再遮挡；
- 导航删除时间线/站点罗盘/项目三项（剩 7 项：主页/归档/友链/动态/相册/关于/GitHub）；
- 首页文章卡改单行排布（1fr）+ 间距/内边距放大；
- 排障发现并修复：BFF Worker 的 REVALIDATE_SECRET 丢失（secret list 为空，
  revalidate 500）→ wrangler secret put 补齐（BFF + web 两个 Worker）；
  根因：导航数据经 site_config/navigation 数据驱动（构建期从 BFF 拉取），
  BFF 边缘缓存里残留旧后端时代的 10 项导航，且 v2 后端无该端点 404 不覆盖缓存
  → 清缓存后回退静态 7 项配置生效；
- 文章详情页 301 静默消失根因修复：构建期 getPostBySlug 瞬时失败静默 301 →
  加 1.5s 重试（web 同日多笔提交）。

## 2026-10-25 七轮：内容替换 + 参考站对齐修正（用户标注图反馈）

- 全站文章替换：删旧 3 篇，发布 6 篇新文章（董小姐时间线/BT-7274/大远征/
  杨根思/关于博主/技术大停滞-整理版 96KB 长文），封面从 wlop 图床 234 张
  链接中随机取 6 张（jsDelivr webp）；发布走 v2 admin API（Bearer ADMIN_TOKEN），
  期间发现 ADMIN_TOKEN 曾为空（v2r3 事故残留）→ 已轮换真值并验证 401/200；
- GitHub 从导航删除 → 关于页重写（博主介绍 + GitHub 链接 + 文章版入口）；
- 文章卡玻璃对齐参考站：.kirameku-article 强制深色玻璃（rgba(10,14,28,0.42)
  + blur14 + 白 12% 边框 + 圆角 20），标题/正文/粗体全亮色 + 投影，
  [class*=text-slate-] 一并提亮（用户浏览器 light 主题残留也不再发白）；
- 语言切换面板 top-full right-0 → top-full left-0（向右展开，不再遮挡搜索）；
- 排障发现并修复：文章详情页整站 301 消失（构建期 getPostBySlug 瞬时失败
  静默 301）→ 加 1.5s 重试；
- web `11b4393`...`f8d08eb` 多笔 CI 绿；文章 API 内容变更经 v2 admin API（非 git）。
