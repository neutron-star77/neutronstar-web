# 交给其他 AI 的执行手册

## 任务目标

在 `F:\AI\projects\Neutronstar\web` 中，把现有 Neutronstar 重构为 Astro 静态内容 + BFF + Vue Islands 的结合架构。视觉和交互参考 Nebula/Starlit Blog，但不要盲目复制其后端；保留当前 Markdown/MDX、Cloudflare Pages、Supabase 主库和 NAS 媒体边界。

## 执行顺序

严格按 `docs/architecture/combined-blog-roadmap.md` 的阶段 0 到 7 执行。每完成一个阶段，必须先运行该阶段验收命令和 smoke test，再把交接信息写回本文件的阶段记录。

## AI 开工前检查

1. 读取 `AGENTS.md`、`CONTEXT.md`、`docs/adr/*.md`、本路线文件。
2. 检查 `git status`，不覆盖其他 AI 未提交的修改。
3. 读取当前页面和 API，不凭空创建路由。
4. 确认要修改的阶段和验收标准。
5. 先写/更新 spec 或 ticket，再改代码。

## 每阶段交接格式

```markdown
### 阶段 N：名称

- 状态：未开始 / 进行中 / 已完成 / 阻塞
- 修改文件：
- 新增接口或路由：
- 已完成行为：
- 验收命令：
- 验收结果：
- 线上/本地 URL：
- 已知问题：
- 下一 AI 的第一步：
- 回滚方式：
```

## 接口实现约定

- 浏览器只调用 `/api/v1/*`。
- 所有响应使用 `{ data, error, meta }` 统一外壳；错误至少包含 `code`、`message`、`request_id`。
- GET 默认可缓存，写请求默认不可公共缓存。
- 分页参数统一为 `page`、`size`，服务端限制最大 `size`。
- 所有写接口要求幂等键或明确的重复提交行为。
- 认证、权限、媒体签名由 BFF 处理。

## 页面交互约定

- 文章标题必须是真实 `/posts/:slug/` 链接。
- 图书条目必须是真实详情或阅读路由。
- 相册条目必须是真实相册详情路由。
- 动态组件必须有 loading、empty、error 状态。
- 页面刷新和深链接必须可用。
- WebGL 失败时必须回退到 CSS/静态表现。

## 不可接受的完成标志

- 只改首页。
- 只改 CSS 但文章点击仍无路由。
- 组件显示内容但接口失败时没有错误状态。
- 线上页面能看但生产构建失败。
- 交接只写“已完成”，没有命令、URL、文件和已知问题。

## 阶段记录

### 阶段 0：基线、冻结范围和回滚点

- 状态：基线采集已完成；阶段验收未完全通过（文章详情路由、相册详情路由及 Cloudflare 部署入口仍有缺口）
- 修改文件：`docs/architecture/baseline.md`、`.scratch/combined-blog/ai-handoff.md`
- 新增接口或路由：无；本阶段没有修改业务代码。
- 已完成行为：记录当前技术栈、工作树、构建与本地预览结果、页面/API/内容/媒体/环境变量、Cloudflare 配置差异及回滚办法。
- 验收命令：`pnpm exec astro build`；`pnpm exec astro preview --host 127.0.0.1 --port 4321`；对首页和 9 个静态主页面逐一发起本地 HTTP 请求；只读检查 BFF API。
- 验收结果：构建退出码 0；本地 10 个静态页面及线上 `https://neutronstar.fun/` 的 10 个主页面均返回 HTTP 200。无真实文章 slug 可验证文章详情；相册详情 `getStaticPaths()` 返回空数组。BFF 域名在本机 DNS 解析失败；线上 `/api/posts`、`/bff/archive`、`/api/health` 虽返回 200，但响应是首页 HTML 而非 JSON。部署文档命令不在 package scripts 中，Wrangler 配置与 Pages 文档不一致。阶段 0 整体未完全通过。
- 线上/本地 URL：本地预览 `http://127.0.0.1:4321/`（已停止）；线上只读检查 `https://neutronstar.fun/`，主页面均 200；未执行部署。
- 已知问题：详见 `docs/architecture/baseline.md`“当前已知问题”。
- 下一 AI 的第一步：保持阶段冻结；先确认可用 BFF/文章 slug 和实际 Cloudflare Pages 或 Workers 部署目标，补齐阶段 0 的缺失验收，再进入阶段 1。
- 回滚方式：删除新建的 `docs/architecture/baseline.md`，并将本节恢复为阶段开始时的“未开始”记录；不要重置整个工作树或覆盖既有修改。线上未部署任何改动。

### 阶段 1：领域模型与 API 合同

- 状态：已完成（合同草案已建立；尚未接入运行时 BFF）
- 修改文件：`docs/api/v1-contract.md`、`docs/api/v1-examples.http`、`src/lib/api/v1-types.ts`、`.scratch/combined-blog/ai-handoff.md`
- 新增接口或路由：仅定义 `/api/v1/*` 合同，未新增线上路由或修改现有 `/api/*` 调用。
- 已完成行为：定义 content-item、album/photo、book/file/progress、moment、comment、like、playlist、media、profile、health 类型；统一 `{ data, error, meta }` 响应；记录分页、缓存、认证、错误码、幂等键和旧 API 迁移映射。
- 验收命令：`pnpm exec astro build`；`pnpm exec astro check`；`pnpm exec tsc --noEmit`；`git diff --check`。
- 验收结果：生产构建退出码 0；`git diff --check` 通过。`astro check` 因项目未安装 `@astrojs/check` 进入安装确认，未修改依赖；`tsc --noEmit` 因现有 `tsconfig.json` 的 `ignoreDeprecations` 值被当前 TypeScript 拒绝而失败。两项工具链问题均未由本阶段引入。
- 线上/本地 URL：无；本阶段没有部署，也没有新增运行时端点。
- 已知问题：API 合同仍需 BFF 实现团队评审；当前页面仍使用旧裸响应 `/api/*`，Vue Islands 和真实 `/api/v1/*` 尚未接入；图书、评论、阅读进度和媒体签名尚无现有后端实现可验证。
- 下一 AI 的第一步：读取 `docs/api/v1-contract.md` 和 `src/lib/api/v1-types.ts`，确认 BFF 运行环境及上游 API；Cloudflare 旧项目 `neutronstar-web` 已删除，当前生产 Pages 项目唯一保留为 `neutronstar-site`，然后进入阶段 2，实现 health/profile/posts/comments/likes 的最小垂直切片。
- 回滚方式：删除 `docs/api/v1-contract.md`、`docs/api/v1-examples.http`、`src/lib/api/v1-types.ts`，并将本节恢复为“未开始”；不需回滚业务运行时，因为本阶段没有接入调用。

### 阶段 2：BFF 最小垂直切片

- 状态：已完成（基础 BFF、v1 health、旧 posts/albums 兼容、NAS 数据库和 Tunnel）
- 修改文件：本阶段未修改前端仓库业务代码；部署了现有 `F:\AI\projects\Neutronstar\worker-bff`。
- 新增接口或路由：`https://bff.neutronstar.fun/health`、`/api/v1/*` 代理、`/bff/archive`；Cloudflare Tunnel `neutronstar-api.neutronstar.fun` 回源 NAS `192.168.5.4:8200`。
- 已完成行为：修复 NAS v2 API 数据库连接；`/api/v1/healthz` 与 `/api/v1/posts` 返回 200；BFF Worker 版本 `cd75c47d-d6dd-4e92-b4b1-1a483ce806df` 已上线。
- 验收命令：`pnpm run typecheck`（worker-bff）；`pnpm run deploy`（worker-bff）；访问 BFF health、v1 healthz、v1 posts；Cloudflare Tunnel 列表检查。
- 验收结果：BFF typecheck 通过，部署通过；`/health`、`/api/v1/health`、`/api/v1/posts`、旧 `/api/posts`、`/bff/archive` 返回 200。
- 线上/本地 URL：`https://bff.neutronstar.fun/health`、`https://bff.neutronstar.fun/api/v1/healthz`、`https://neutronstar-api.neutronstar.fun/api/v1/healthz`。
- 已知问题：Tunnel 的 NAS 启动脚本已修正为 `neutronstar/bin` 路径；comments、likes、reading progress、playlist、signed media v1 写接口尚未实现。
- 下一 AI 的第一步：进入阶段 3，修复真实路由/深链并建立统一页面壳；阶段 4 再补齐动态写接口。
- 回滚方式：`pnpm dlx wrangler rollback cd75c47d-d6dd-4e92-b4b1-1a483ce806f`（先确认当前版本）；恢复 Tunnel ingress 和 NAS `.env` 的 `.env.bak.dbfix-*` 备份即可回退数据库主机修改。

### 阶段 3：共享视觉壳与路由恢复

- 状态：进行中
- 修改文件：`src/pages/albums/[slug].astro`；前端部署到 `neutronstar-site`。
- 新增接口或路由：相册详情路径现在由 `/api/albums` 数据驱动生成，空数据时不生成假详情。
- 已完成行为：文章列表已生成真实 `/posts/:slug/` 页面；线上主页、文章列表、文章详情、相册等关键入口刷新和深链返回 200。
- 验收命令：`PUBLIC_API_BASE=https://bff.neutronstar.fun pnpm exec astro build`；`pnpm dlx wrangler pages deploy dist/client --project-name neutronstar-site`；线上 HTTP smoke test。
- 验收结果：构建退出码 0，生成 3 个文章详情页；生产主页面和文章详情返回 200。相册详情代码已改为真实数据驱动，但当前后端相册列表为空，因此没有真实相册详情可验收。
- 线上/本地 URL：`https://neutronstar.fun/`、`https://neutronstar.fun/posts/`、`https://neutronstar.fun/posts/neutron-observatory-architecture/`、`https://neutronstar.fun/albums/`。
- 已知问题：图书详情、说说单条详情、评论/点赞深链尚未建立；当前 `albums/example/` 返回的是现有 catch-all 页面，不代表相册详情已实现。
- 下一 AI 的第一步：补建图书详情和说说详情路由，随后清理 catch-all 对不存在深链的 fallback 行为。
- 回滚方式：Pages 回滚到部署 `b0f6ed75` 或前一已验证部署；删除 `albums/[slug].astro` 的本阶段改动即可恢复原空路径行为。

### 阶段 4：内容页面对齐

- 状态：未开始

### 阶段 5：媒体、缓存与性能

- 状态：未开始

### 阶段 6：数据持久化、备份和可观测性

- 状态：未开始

### 阶段 7：完整验收、审查和发布

- 状态：未开始
