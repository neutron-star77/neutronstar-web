# Nebula 主题布局规格笔记（源码提取，blog-frontend）

来源：`blog-frontend/src`（Vue3 SPA，MIT）。单位为源码实测值。所有页面均无传统侧栏，全宽居中容器 + 玻璃卡片。间距断点：桌面 ≥768px，平板 768–900px 调整列数，移动 <768px 单列。

## 0. 全局容器规格（各页容器宽度对照）

| 页面 | max-width | padding |
|---|---|---|
| 首页面板区 | 85% / 1100px | — |
| 博文列表 blog | min(100%, 78rem) | 7rem 1rem 4rem |
| 文章详情 post | 68rem | 6rem 1rem 3rem（桌面 8rem 顶） |
| 归档 archive | 96rem | 5rem 1rem 2rem |
| 友链 friends | 72rem | 7rem 1rem 5rem |
| 说说 moments | ~64rem（同档） | 类似 |
| 展览 gallery | min(100%, 76rem) | 7rem 1rem 5rem |
| 图片 images | ~76rem | 同档 |
| 图书 books | ~72rem | 同档 |
| 藏宝阁 treasure | ~76rem | 同档 |

内容层 z-index：10；导航 50；背景 0/1；回到顶部 100。

## 1. NavBar（`components/NavBar.vue`）

- **固定顶栏**，非滚动收缩：`position:fixed; top:-1px; height:64px; width:100%; padding:0 30px; z-index:50`，底部圆角 16px（下缘两角），玻璃由独立 `::before` 伪元素承载：`rgba(255,255,255,0.08)` + `backdrop-filter:blur(12px)` + 边框 `rgba(255,255,255,0.12)`。
- 三段结构（flex space-between）：
  - 左：Logo 文字（font-weight 800, 1.15rem，纯白+text-shadow）→ 语言下拉胶囊按钮（border 999px 圆角）→ 移动端主题圆钮。
  - 中：菜单项数组共 11 项：首页/博文/图书/归档/展览/说说/图片/友链/藏宝阁/自习室/关于。每项 icon+文字，`padding:8px 16px; border-radius:20px`，hover 白色 12% 背景；激活项下方 5px 蓝色发光圆点（`#60a5fa` + 三层 box-shadow 光晕）。
  - 右：登录/注册按钮（或用户名/后台）、**主题拉绳开关**（挂灯绳造型，可拖拽下拉 >22px 切换，连拉 3 次 toast 彩蛋、5 次弹出"深夜酒馆"确认卡）、设置齿轮按钮。
- 设置下拉面板（268px 宽，圆角 16，blur 24）：背景图片选择器、背景模糊开关+滑条(0–24px)、液态玻璃开关+滑条(0–12px)、下雨特效开关+轻/中/重三档。
- **移动端 <768px**：高度 56px；菜单隐藏→汉堡按钮（圆形，40px）+ 全屏下拉网格菜单（2 列，icon 上文字下）；Logo 绝对居中；主题拉绳隐藏，改为 nav-left 内圆钮。

## 2. PageBackground（`components/PageBackground.vue`）

- 层叠自下而上：① 固定背景层 `bg-layer`（img 用 background-size:cover 或 `<video>` muted/loop/autoplay/playsinline，object-fit:cover；可叠加用户设置 blur(px)，blur 时 scale(1+blur/240 上限 8%) 防露边）；② 黑色遮罩层 `overlay`，默认 `rgba(0,0,0,0.09)`；③ 内容插槽 z-10。整体 `position:fixed; inset:0; pointer-events:none`。无噪点层。背景可由用户在设置面板切换（预加载完成才切换防黑屏）。

## 3. 首页 index（`views/index/index.vue`）

- **布局骨架（自上而下）**：三阶段入场动画——① 打字机标题居中（纯白 2rem，无玻璃）偏上 50px；② 打完字后标题容器 0.8s 下滑至正中并渐显玻璃胶囊横条（85%/1100px 宽、高 60px、圆角 20、白 8%+blur12）；③ 850ms 后 navbar 与全部面板渐显。
- **hero 上区**（top:90px，max-height 至 50vh-130px）：左 60% 个人简介面板（头像/名字/签名/社交链接 HomeProfilePanel）+ 右 40% 数据看板 DataDashboard，双列 gap 20px。
- **下区**（top:50vh+40px）：CSS grid `columns: 40% 60%（各-8px）; rows: 350px 96px auto; gap:16px`。左列跨 3 行 = 图片轮播（高 900px）；右列自上而下：日历(350px) → 电子时钟(96px) → 博文轮播+说说轮播并排(gap 12px, 300px)。
- **卡片**：每面板外包 LiquidGlass（cornerRadius 16）或 PanelFallbackGlass。
- **交互**：打字机 + 卡片 850ms 延迟浮现；返回首页时通过 history.state 跳过动画直接显示。
- **移动端 <768px**：标题横条隐藏；所有面板改普通文档流单列（宽 92%）；图片轮播与电子时钟整体隐藏；双轮播改纵向堆叠（min-height 280px）。

## 4. 博文列表 blog（`views/blog/blog.vue`）

- **布局骨架**：页头（kicker 小字 0.72rem 大写宽字距 → 大标题 clamp(1.7–2.6rem) → 描述 → 分类筛选胶囊按钮排，flex wrap gap 0.5rem，active 蓝底 22%）→ 2 列卡片网格（`repeat(2, 1fr); gap:1rem`）→ 底部分页胶囊按钮排。
- **卡片构成**（post-card，min-height 14rem，padding 1.5rem 1.6rem，圆角 1.15rem）：置顶徽章（右上角胶囊）→ 日期（0.72rem 宽字距 muted）→ 标题 h2 1.3rem → 摘要 3 行截断 → 分类/标签胶囊行（margin-top:auto 推底；分类 12 色映射）→ 评论数徽章（右下角绝对定位）。
- **交互**：分类筛选（TransitionGroup 淡入缩放重排动画）、分页（每页 12）、hover 卡片边框变蓝+阴影加深。
- **移动端**：<900px 单列；<768px 顶部 padding 降为 6rem。

## 5. 文章详情 post（`views/post/post.vue`）

- **布局骨架**：单列 GlassPanel 包全部内容（无目录侧栏，无 TOC）。容器 68rem。内部顺序：返回按钮（胶囊，◀ 返回）→ 封面图（可选，aspect-ratio 16/8，圆角 1rem）→ 元信息（标题 clamp(1.8–2.8rem) 800 → 日期 → 分类+标签胶囊行）→ `.prose` Markdown 正文（1rem/1.8 行高）→ 评论区（AboutComments 复用）。
- **正文样式**：h2 带下边框分隔；行内 code 白 10% 底；pre 黑 40% 底+白 8% 边框圆角 0.75rem；blockquote 左 3px 边线；表格全宽带边框。
- **交互**：内容 rise 入场动画（0.55s 上移 40px）；返回按钮按来源跳 /blog 或 /archive。
- **移动端**：padding-top 收窄，其余同构。

## 6. 归档 archive（`views/archive/archive.vue`）

- **布局骨架**：非列表流——**横向滚动河流时间轴**。视口 `overflow-x:auto`（滚动条隐藏、可鼠标拖拽 grab），stage 绝对定位：SVG 河流曲线（三层发光描边 + 渐变主线 + 3 个沿路径流动粒子 animateMotion）贯穿水平中央，每篇文章一个节点（r6 白点+发光圈+虚线连接线上下交替伸出）。
- **卡片**：280×310px，间隔 40px，交替挂在河流上/下方；卡片 = 封面图（含日期角标）+ 标题 + 摘要 + 分类胶囊（ArchivePostCard），外包玻璃，圆角 1rem，hover 上移 3px+蓝色投影。
- **交互**：pointer 拖拽滚动（拖后抑制点击）、入场 rise 动画。
- **移动端**：同结构（横向滚动天然适配手机），仅 padding 收窄。

## 7. 友链 friends（`views/friends/friends.vue`）

- **布局骨架**：页头 → **"鱼缸"**（LiquidGlass cornerRadius 24，高 55vh/最小 320px）→ 3 列友链卡片网格 → 交换友链说明大卡。
- **卡片**：鱼缸内为 72px 圆形头像弹性弹跳漂浮（useFloatingAvatars bounce 模式），hover 暂停+放大 1.12+名字浮签。列表卡片：左头像 + 名称/bio + 右箭头 icon，横向布局。交换卡：本站信息（头像+名+URL+bio）+ 申请要求 ul + 联系方式。
- **交互**：头像漂浮/暂停、卡片外链新窗口。
- **移动端**：网格降为 1 列（源码未见中间档），鱼缸高度不变。

## 8. 说说 moments（`views/moments/moments.vue`）

- **布局骨架**：页头（含"共 N 条"）→ 单列时间线：按天分组，先渲染日期分隔条（左右横线夹"X月X日 · N条"），组内每条说说一张**全宽单列**玻璃卡（LazyLiquidGlass cornerRadius 18）→ 底部无限滚动哨兵（IntersectionObserver，每页 10 条）。
- **卡片**（MomentCard）：头部相对时间+心情标签 → 正文（2 行截断）→ 底部指示条（📷 图数 / 💬 评论数 / ♥ 点赞按钮带 pop 动画）。
- **交互**：点击卡片打开全屏详情 overlay（MomentDetail）；URL hash `#moment-{id}` 支持深链定位+高亮；点赞乐观更新。
- **移动端**：结构不变（本就单列）。

## 9. 展览 gallery（`views/gallery/gallery.vue`）

- **布局骨架**：页头（kicker → 超大标题 clamp(2rem,5vw,4rem) → 描述 max-width 42rem）→ 2 列项目卡网格（gap 1rem），卡为 GlassProjectLink（玻璃项目 specimens，带编号 01/02…）。
- **移动端**：<900px 单列。

## 10. 图片 images（`views/images/images.vue`）

- **布局骨架**：两级视图。**相册概览**：返回首页链接 → 页头 → 3 列相册卡网格（`column-gap:2rem; row-gap:5rem`，AlbumCard 玻璃卡）。**相册详情**：头部（返回画廊按钮+日期 | 相册名+描述 | 右侧"共 N 瞬间"）→ CSS columns 瀑布流。
- **瀑布流**：`columns:1 →(≥640px)2 →(≥1024px)3`，column-gap 1.5rem，图片项圆角 1rem + 投影 + 逐张 50ms 交错 fade-in-up 入场。
- **交互**：点击图片开全屏灯箱（Teleport 到 body，左右箭头切换、caption 底部显示、点遮罩关闭）。
- **移动端**：<900px 相册网格单列。

## 11. 图书 books（`views/books/books.vue`）

- **布局骨架**：页头 → 搜索栏（圆角输入框+放大镜 icon）→ 排序按钮组（最新/最早/自定义）→ **4 列**书籍卡网格 → Element Plus el-pagination 分页（每页 16）。
- **卡片**：上半封面（无封面用首字占位色块）+ 下半书名/作者。响应式：<900px 3 列，<768px 2 列（gap 0.6rem）。
- **交互**：搜索防抖请求后端、排序切换、点卡片进 `/books/read/:slug` 阅读器（1722 行独立阅读页）。

## 12. 藏宝阁 treasure（`views/treasure/treasure.vue`）

- **布局骨架**：页头 → 分类筛选 tab 胶囊排 → **3 列**宝物卡网格（gap 1rem）→ 分页。与 blog 列表同构但 3 列。
- **卡片**（TreasureCardContent，padding 1.4rem 1.2rem）：大 emoji 图标（2rem）→ 标题+描述 → 底部标签胶囊行+可下载 ↓ 徽章。玻璃 cornerRadius 22、加厚。
- **交互**：分类筛选、下载链接走带进度条的下载（下载中显示百分比进度条 toast）、外链新窗口、空状态文案。

## 13. 深夜酒馆 midnight-tavern（`views/midnight-tavern/midnight-tavern.vue`）

- **简介**：隐藏彩蛋页（导航栏主题拉绳连拉 5 次触发确认弹窗进入）。独立暖色暗调皮肤：整页背景图（fixed cover，底色 #090806）+ 暗色 shade 罩 + "灯光"光晕层，脱离全站星空背景与玻璃体系；顶角有"离开酒馆"链接和登录/注册按钮。
- **核心布局**：居中文字区（kicker "Midnight Tavern" → 大标题"深夜酒馆" → 两行 lead 文案）→ "旧酒瓶"留言墙：`flex wrap` 居中排列的手绘瓶形卡（CSS 画的瓶颈/瓶身/高光 + 挂签纸条：作者：话题 + "拆开纸签/收好瓶塞"）。
- **交互**：点瓶子翻转开信（letter-overlay 信纸弹窗：来自谁/标题/正文）；右下"投下一只瓶子"浮动按钮开投稿抽屉（署名/标签/正文三字段）。

## 14. 自习室 study-room（`views/study-room/study-room.vue`）

- **简介**：专注工具页。中央一块大玻璃面板（max-width 42rem，cornerRadius 28 加厚）装番茄钟：模式（专注/休息）+ 巨大倒计时数字 + 开始/重置按钮 + 页头浮在面板左上方。
- **布局骨架**：页面纵向居中列：面板 → 下方 HistorySummary 历史摘要条。两侧各一个贴边抽屉触发按钮（箭头小钮）。
- **交互**：左抽屉=待办清单（可勾选/删除，选中 todo 直接作为倒计时源），右抽屉=今日日程（增删/勾选）；计时结束闪烁提醒；数据存 localStorage。

## 15. 辅助组件（一句话）

- **SiteTitle**：打字机效果站名组件，lg 档 2.25→4.5rem 三级响应，白色粗体+闪烁竖线光标。
- **BackToTop**：scrollY>300 才浮现的固定右下圆形按钮（50px，黑 50% 底+blur10，hover 上移）。
- **RainEffect**：全屏 canvas 雨滴+溅落粒子特效（上限 250 滴/80 溅花），三档强度，可感知玻璃面板区域，随主题变色。

## 16. 全局主题与卡片样式参数表

**主题组织**：根节点 `data-theme='dark'|'light'`（Pinia ui store 持久化到 localStorage），全部颜色走 CSS 变量；页面级再写 `[data-theme='light'] .xxx` 覆写。文字变量四档：`--text-primary/secondary/muted/faint`（暗：白 94%/55%/40%/30%；亮：黑同档）。

**玻璃变量**（`assets/base.css`）：

| 变量 | 暗 | 亮 |
|---|---|---|
| --glass-bg | rgba(255,255,255,0.08) | rgba(255,255,255,0.55) |
| --glass-bg-strong | 0.12 | 0.68 |
| --glass-border | 0.2 | 0.7 |
| --glass-highlight | 0.3 | 0.85 |
| --glass-blur | 12px | 14px |

**最常用卡片外壳 = PanelFallbackGlass**（LiquidGlass 关闭/降级时的通用玻璃卡，全站复用）：
- 圆角 16px；背景 `rgba(255,255,255,0.1)`；边框 1px `rgba(255,255,255,0.2)`；
- `backdrop-filter: blur(12px)`（放在独立 ::before 伪元素上防内容重绘）；
- 阴影三层：`inset 0 1px 0 rgba(255,255,255,0.24)`（顶部镜面高光线）+ `inset 0 0 20px rgba(255,255,255,0.06)`（内辉光）+ `0 8px 28px rgba(0,0,0,0.18)`（外投影）。
- static-blur 变体（首页）：::before inset -18px 复制页面背景图 blur(12px) 代替 backdrop-filter，移动端 <768px 改回真 backdrop-filter。
- GlassPanel（post 详情用的黑毛玻璃面板）：`--glass-bg + blur(--glass-blur) + 边框 --glass-border + 圆角 1rem + padding 1.5rem`。

**LiquidGlass（WebGL 级液态玻璃组件）常用参数**：cornerRadius 16–28（列表卡 18、大面板 24–28）、glass-thickness 36–48（厚面板）、highlight-width 3–3.5、ripple-trail 跟随光标波纹；blur 半径用户可调 0–12px。

**通用圆角/胶囊**：胶囊按钮/徽章一律 `border-radius:999px`；卡 1–1.15rem；大面板 16–20px；分类色板固定 12 色（cyan/violet/pink/emerald/blue/sky/indigo/purple/orange/teal/rose/amber，文字色+50% 同色边框）。
