# 玄穹时序司：Astro + BFF + Vue Islands 实施路线

## 目标

在保留 Astro 静态首屏、Markdown/MDX + Git 内容管理和 Cloudflare Pages 部署优势的前提下，引入 Nebula 类博客的运行时能力：文章、相册、图书/EPUB、说说、评论、点赞、阅读进度、播放列表、媒体管理和可扩展页面模块。

目标不是把 Nebula 仓库整体复制进 Neutronstar，而是复刻其公开端的产品能力和液态玻璃视觉语言，并保留当前项目的内容与部署边界。

## 最终架构

```text
Git Markdown/MDX
        |
        v
Astro static pages -------------------- Cloudflare Pages
        |                                      |
        | page-scoped Vue islands              |
        v                                      v
Typed BFF /api/* -------------------- Cloudflare Worker
        |
        +--> Supabase: dynamic records
        +--> NAS API: private media/admin jobs
        +--> R2/NAS: public media delivery
```

### 边界

- Astro 负责静态内容、SEO、文章详情、归档、项目页和首屏 HTML。
- Vue 负责需要状态和连续交互的局部功能：评论、点赞、相册灯箱、EPUB 阅读器、音乐播放器、阅读进度和管理小工具。
- BFF 是浏览器唯一的动态 API 入口。前端不直接访问 Supabase、NAS 或管理数据库。
- Supabase 是动态数据在线主库。
- NAS 是媒体源和异步备份目标；不与 Supabase 组成双写主库。
- R2 是可选的公开媒体缓存层；大文件、原始文件和 EPUB 保留在 NAS。

## 阶段路线与验收

### 阶段 0：基线、冻结范围和回滚点

**工作**

- 固定当前可部署版本和 Cloudflare Pages 项目。
- 记录现有路由、内容集合、API 入口、媒体目录和环境变量。
- 保留现有页面作为回滚基线，不在本阶段改变用户行为。

**验收标准**

- `pnpm exec astro build` 通过。
- 首页、文章列表、文章详情、归档、相册、图书、说说、关于、友链、收藏夹均返回 200。
- 记录一条可复现的部署命令和当前生产预览 URL。
- 生成 `docs/architecture/baseline.md`，列出路由和依赖。

**交接产物**

- 基线 commit/分支。
- 路由清单。
- 环境变量清单，不包含真实密钥。
- 已知问题列表。

### 阶段 1：领域模型与 API 合同

**工作**

定义以下稳定资源和 ID 规则：

- `content-item`：文章、图书介绍、项目、相册说明。
- `album` / `album-photo`：相册和照片元数据。
- `book` / `book-file` / `reading-progress`：图书、EPUB 文件和阅读位置。
- `moment`：说说及其媒体。
- `comment`、`like`、`playlist-item`：动态记录。
- `media-asset`：图片、音频、视频、模型和 EPUB。

建立 BFF 版本化接口：

```text
GET  /api/v1/profile
GET  /api/v1/posts/:slug
GET  /api/v1/albums
GET  /api/v1/albums/:id/photos
GET  /api/v1/books
GET  /api/v1/books/:id
GET  /api/v1/moments
GET  /api/v1/comments?target_type=&target_id=
POST /api/v1/comments
POST /api/v1/likes/toggle
GET  /api/v1/reading-progress/:book_id
PUT  /api/v1/reading-progress/:book_id
GET  /api/v1/playlist
PUT  /api/v1/playlist
GET  /api/v1/media/:id/url
GET  /api/v1/health
```

**验收标准**

- 所有接口有 TypeScript 类型和 JSON 示例。
- 每个动态接口说明认证、缓存、错误码、分页和幂等性。
- 浏览器代码中没有 Supabase/NAS 直连。
- `GET /api/v1/health` 能区分 BFF、数据库和媒体存储状态。

**交接产物**

- `docs/api/v1-contract.md`。
- `src/lib/api/v1-types.ts`。
- 数据模型图和错误码表。
- 一组可导入 Bruno/Postman 的请求样例。

### 阶段 2：BFF 最小垂直切片

**工作**

- 在 Cloudflare Worker 或现有 API 边界中实现 profile、posts、comments、likes、health。
- 统一 CORS、缓存头、请求 ID、错误格式和限流入口。
- 先接现有内容/API，不迁移 Nebula 后端。

**验收标准**

- 首页和文章详情可以只通过 BFF 读取动态数据。
- 未授权请求无法写评论、点赞或阅读进度。
- 上游超时返回稳定错误 JSON，不泄漏数据库信息。
- 相同 GET 请求命中缓存时有可观测响应头。
- BFF 单元测试覆盖成功、401、404、429、上游 5xx。

**交接产物**

- BFF 部署地址和本地启动命令。
- API 环境变量模板。
- 请求/响应日志样例。
- 失败回滚步骤。

### 阶段 3：共享视觉壳与路由恢复

**工作**

- 建立 `EditorialShell`/`NebulaShell` 页面壳，统一顶部导航、背景层、玻璃面板、移动导航和错误页。
- 恢复真实页面链接：文章列表 -> 文章详情，图书 -> 图书详情，相册 -> 相册详情，说说 -> 单条/评论，搜索 -> 搜索结果。
- 删除仅用于视觉展示的假链接和无目标按钮。
- 桌面端使用液态玻璃增强层，移动端降级为 CSS 毛玻璃。

**验收标准**

- 每个导航项都能到达真实路由。
- 文章列表的每个标题都能打开对应文章详情。
- 浏览器刷新、直接访问深层 URL、返回/前进都正常。
- WebGL 不可用时页面仍可读，移动端不加载桌面液态玻璃重资源。
- 键盘焦点、`prefers-reduced-motion` 和低带宽模式可用。

**交接产物**

- 页面壳组件说明。
- 路由映射表。
- 桌面/移动截图和已知视觉差异。

### 阶段 4：内容页面对齐

**工作**

- 首页：站点简介、最新文章、内容分类、精选图书/相册入口。
- 文章：标题、作者、日期、目录、正文、评论、点赞、相关文章。
- 归档：按年份/分类分组，支持分页和搜索。
- 图书：书架、详情、EPUB 阅读器、下载权限和阅读进度。
- 相册：相册列表、照片网格、灯箱、EXIF/说明。
- 说说：时间线、评论、点赞、媒体。
- 项目/关于/友链/收藏夹：统一壳和可用链接。

**验收标准**

- 每个页面都有 loading、empty、error、success 四种状态。
- 任何内容链接不再指向空页面或错误的首页 fallback。
- 文章正文 Markdown/MDX 能继续使用图片、代码、表格、目录和附件。
- 图书没有文件时显示明确空状态，不显示假下载按钮。
- 相册和说说图片只在内容区域加载，未破坏首屏性能。

**交接产物**

- 页面矩阵：路由、数据源、状态、交互、性能预算。
- 每页截图。
- 页面级验收脚本。

### 阶段 5：媒体、缓存与性能

**工作**

- 图片使用响应式尺寸和懒加载。
- 音频、视频、EPUB、模型使用签名或受控媒体 URL。
- BFF 对公开 GET 做短缓存，对用户数据禁用公共缓存。
- Cloudflare Pages 静态资源使用 immutable cache。
- 首屏只加载必要字体和必要 JS；液态玻璃延迟加载。

**验收标准**

- 首页不依赖 API 才能显示主要内容。
- 移动端首屏 JS 不包含 EPUB、相册灯箱或管理模块。
- Lighthouse 移动端 Performance 目标 >= 85，Accessibility >= 90。
- 首页 LCP 目标 <= 2.5s（生产 CDN、冷缓存和热缓存分别记录）。
- 媒体失败显示可理解的占位和重试，不阻塞页面。

**交接产物**

- 性能报告。
- 资源加载瀑布图。
- 缓存策略表。
- 媒体备份/恢复演练记录。

### 阶段 6：数据持久化、备份和可观测性

**工作**

- Supabase 表、索引、RLS 和迁移脚本。
- NAS 媒体同步和数据库备份任务。
- outbox 或增量游标，保证备份可重试、可审计。
- BFF、数据库、媒体、备份健康状态。

**验收标准**

- 评论、点赞、阅读进度和播放列表重启后仍存在。
- 重复执行备份不会生成重复记录。
- Supabase 故障时公开静态内容仍可访问。
- NAS 恢复演练能还原一篇文章、一张相册和一个 EPUB 元数据记录。
- 失败任务有日志、告警和人工重试入口。

**交接产物**

- 数据库迁移说明。
- 备份恢复手册。
- 监控指标与告警阈值。

### 阶段 7：完整验收、审查和发布

**工作**

- 运行类型检查、构建、单元测试、端到端测试和链接检查。
- 对照页面矩阵逐页验收。
- 做 Standards/Spec 双轴审查。
- 生成 release notes 和回滚包。

**验收标准**

- 所有关键路由在桌面和移动视口通过。
- 所有关键点击链路可完成：文章、图书、相册、说说、评论、点赞、阅读进度。
- 无 404、无死链、无控制台致命错误。
- 部署后 smoke test 全部通过。
- 回滚到上一版本不超过一个发布动作。

**交接产物**

- 发布版本号和 URL。
- 测试报告。
- 已知限制。
- 运维和二次开发说明。

## 性能预算

| 指标 | 目标 |
|---|---:|
| 首页静态 HTML | 首屏无需等待 API |
| 移动端首屏 JS | 不加载阅读器、灯箱、后台代码 |
| LCP | 热缓存 <= 2.0s，冷缓存 <= 2.5s |
| CLS | <= 0.1 |
| 交互组件首次加载 | <= 150KB gzip，按页面拆分 |
| BFF GET P95 | <= 300ms（不含冷启动上游） |

## 禁止事项

- 不把 Supabase 密钥放到浏览器代码。
- 不让页面直接遍历 NAS 文件系统。
- 不把整套 Nebula 后端无审查复制进当前仓库。
- 不为每个页面复制一套导航和鉴权逻辑。
- 不用假链接掩盖尚未实现的页面。
- 不用全局 SPA runtime 替换所有静态文章页。
