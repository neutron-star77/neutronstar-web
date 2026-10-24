# 阶段 0：架构重构基线

- 检查日期：2026-10-22（Asia/Hong_Kong）
- 项目目录：`F:\AI\projects\Neutronstar\web`
- Git 分支：`main`
- 基线提交：`d0250f3`
- 基线提交时间：`2026-09-25T03:49:08+08:00`
- 线上配置：本阶段只读检查；没有修改 Cloudflare、DNS、BFF 或数据库配置。

## 工作树快照

阶段开始时工作树已有未提交/未跟踪内容。不能将这些内容当成本阶段修改，也不能用回滚覆盖它们：

- 已修改：`src/components/islands/BookmarkList.tsx`、`FriendsGrid.tsx`、`src/layouts/MainGridLayout.astro`、`src/pages/[...page].astro`、`albums.astro`、`archive.astro`、`moments.astro`、`src/styles/main.css`。
- 已未跟踪：`src/styles/plain-text-editorial.css`，以及 `AGENTS.md`、`CONTEXT.md`、`docs/adr/`、`docs/agents/`、`docs/architecture/`、`docs/deployment/`、`docs/superpowers/`、`.scratch/`。
- 分支状态：`main...origin/main [ahead 1]`。
- 本阶段新增/更新的文档：本文件与 `.scratch/combined-blog/ai-handoff.md`。

## 当前技术栈

| 部分 | 当前实现 |
|---|---|
| 前端/构建 | Astro `^7.3.2`、Vite、TypeScript `^5.9.3`、Node `>=22.13.0`、pnpm `11.22.0` |
| 页面渲染 | `output: "static"`，Cloudflare adapter `@astrojs/cloudflare ^14.3.1`；静态页面输出到 `dist/client`，同时生成 Cloudflare server entry |
| 交互组件 | React `^19.2.0` 和 Svelte `^5.57.0` islands；当前并未使用 Vue Islands |
| 内容与样式 | Astro Markdown/MDX、Tailwind CSS `^4.3.3`、Swup、Expressive Code、KaTeX、Mermaid |
| 搜索与媒体 | Pagefind；本地静态资源在 `public/`，文章、相册等动态数据由 API 提供 |
| 状态与数据库 | 浏览器通过 API 客户端访问后端；前端不直接访问 SQLite/Supabase。当前项目未见 Pinia/Vue。 |

ADR 0003 描述的是目标结合架构；它与当前实际组件框架（React/Svelte）及数据来源（后端 API）仍有差距。

## 构建与本地预览

| 命令 | 结果 |
|---|---|
| `pnpm exec astro build` | **通过，退出码 0**。Astro 报告 `Build complete`，约 40 秒；产物在 `dist/`，静态文件在 `dist/client/`。 |
| `pnpm exec astro preview --host 127.0.0.1 --port 4321` | **通过启动**。用于下面的本地 HTTP smoke test；测试后已停止。 |

项目 `package.json` 的标准脚本为 `pnpm build`，其命令是 `node scripts/subset-font.mjs && astro build`；另有 `postbuild` 搜索索引生成步骤。上述阶段基线使用的是用户指定的原生命令 `pnpm exec astro build`，因此**没有执行字体子集生成或 postbuild 搜索索引脚本**。`pnpm run build` 本阶段未执行。

构建有非致命警告：Svelte accessibility、deprecated slot、unused CSS selector 与部分 `$state` 初始值提示；`astro-icon` 还提示找不到 `src/icons/`。这些警告未阻止本次构建。

## 页面路由及状态

静态页通过本地 `astro preview` 请求；HTTP 200 表示该路由在当前构建中可访问。动态路由没有真实 slug 时不以任意测试 slug 的 404 冒充有效路由成功。

| 页面 | 源文件/实现 | 当前构建与 smoke 状态 |
|---|---|---|
| 首页 `/` | `src/pages/[...page].astro` 的根路径分支 | 生成；本地 **200** |
| 文章列表 `/posts/` | `src/pages/posts.astro` | 生成；本地 **200** |
| 文章详情 `/posts/:slug/` | `src/pages/posts/[slug].astro`，由构建期 API 文章列表生成路径 | 路由代码存在，但本次构建没有生成任何文章 slug 页面；本地 `/posts/example/` 为 **404**。没有真实 slug 可用于详情页 200 验收。**未通过详情页验收**。 |
| 归档 `/archive/` | `src/pages/archive.astro` | 生成；本地 **200** |
| 相册 `/albums/` | `src/pages/albums.astro`，React `AlbumGrid` island | 生成；本地 **200** |
| 相册详情 `/albums/:slug/` | `src/pages/albums/[slug].astro` | `getStaticPaths()` 明确返回空数组；本地 `/albums/example/` 为 **404**。当前详情路由未实现。 |
| 图书 `/novel/` | `src/pages/novel.astro` | 生成；本地 **200**。当前页面名为“小说”，属于现有占位/内容页。 |
| 说说 `/moments/` | `src/pages/moments.astro`，React `MomentsList` island | 生成；本地 **200** |
| 关于 `/about/` | `src/pages/about.astro` | 生成；本地 **200** |
| 友链 `/friends/` | `src/pages/friends.astro`，React `FriendsGrid` island | 生成；本地 **200** |
| 收藏夹 `/bookmark/` | `src/pages/bookmark.astro`，React `BookmarkList` island | 生成；本地 **200** |
| 杂谈 `/messages/` | `src/pages/messages.astro` | 生成；本地 **200** |

本次 smoke test 还确认首页、文章列表、相册及归档能返回 HTML。构建日志只列出根页和上述静态页面，没有文章 slug 子页面。`/posts/example/` 是无效示例 slug 测试，最终结论以“当前没有生成真实详情页”及源代码 `getStaticPaths()` 依赖 API 数据为准。

其他源代码端点：`/atom.xml`、`/rss.xml`、`/llms.txt`、`/llms-full.txt`、`/api/posts/:slug/chunk/:n`、`/auth/callback`、`/internal/revalidate-html`。本阶段未对这些端点做 HTTP smoke test。

## API 入口

- 浏览器 API 客户端：`src/lib/api/client.ts`。`PUBLIC_API_BASE` 为空时，浏览器 API 地址回退到 `https://bff.neutronstar.fun`。
- SSR/构建取数：`src/lib/server/api.ts`，同样使用 `PUBLIC_API_BASE` 或 `https://bff.neutronstar.fun`。
- 文章列表、文章详情、标签：`/api/posts`、`/api/posts/:slug`、`/api/tags`；归档还使用 `/bff/archive`。
- 交互与内容 API：`/api/albums`、`/api/albums/:id/photos`、`/api/chatters`、`/api/chatters/count`、`/api/likes/mine`、`/api/likes/toggle`、`/api/friend-links`、`/api/bookmarks`、`/api/messages`。
- 站点与媒体相关 API：`/api/site-config`、`/api/site-config/navigation`、`/api/site-config/music_widget`、`/api/bili-fav`、`/api/fonts/:id/file`。
- 认证 API：`/api/auth/github/login`、`/api/auth/github/me`、`/api/auth/github/callback`。
- 同源文章分块端点：`src/pages/api/posts/[slug]/chunk/[n].ts`，从 server API 代理取文章正文。

API 基址的只读连通性检查访问了 `https://bff.neutronstar.fun/api/posts?...`、`/api/albums`、`/api/health`，均因本机无法解析 `bff.neutronstar.fun` 而失败。SSR API helper 对失败返回空值，因此构建仍可完成，但会造成当前文章详情没有静态路径。

## 内容与媒体来源

- 当前 `src/content/` 目录不存在；没有发现 Git 管理的 Markdown/MDX 文章集合。
- 文章、分类/标签及详情正文通过构建期 API 拉取；`src/utils/content-utils.ts` 将 API 数据适配成旧文章 entry 结构。项目虽启用 Markdown/MDX 处理，但当前文章数据不是从 Git 内容目录加载。
- 站点介绍等页面内容在 `src/pages/` 与组件中维护。
- 本地媒体位于 `public/`：`assets/`、`images/albums/`、`images/moments/`、`logo/`、头像/图标等；扫描到 `public/assets` 与 `public/images` 共 68 个文件。
- 远程文章封面、相册照片、字体和播放列表等由 API 返回或通过 BFF URL 加载。当前具体 NAS/R2 源地址由外部 API/站点配置决定；本阶段未读取任何密钥或私有存储凭证。

## 环境变量与模板

代码中发现的环境变量名称：

- `PUBLIC_API_BASE`：构建期与运行期 API 基址；未配置时默认 `https://bff.neutronstar.fun`。
- `VITE_API_BASE_URL`：`scripts/build-search-index.mjs` 使用的兼容回退值。
- `import.meta.env.DEV`、`import.meta.env.PROD`：Vite/Astro 框架标记，不是需要配置的密钥。

仓库根目录没有 `.env`、`.env.example` 或 `.env.template`。本阶段只记录名称，没有记录真实密钥、令牌、账号凭证或值。

## Cloudflare 部署配置（只读）

- `docs/deployment/cloudflare-pages.md` 声称 Cloudflare Pages，项目根为本仓库、输出目录为 `dist/client`，线上 URL 为 `https://neutronstar.fun/`。
- Cloudflare 只读核对（2026-10-23）：已删除旧 Pages 项目 `neutronstar-web` 及其历史部署；当前账户只保留 `neutronstar-site`，项目域名为 `neutronstar-site.pages.dev` 与 `neutronstar.fun`。生产站点 `https://neutronstar.fun/` 验证返回 HTTP 200。
- `docs/deployment/one-click-pages.md` 声称部署命令是 `pnpm run deploy:pages`，并进一步调用 `pnpm run build:pages`、`wrangler pages deploy dist/client`；其中记载 Pages 项目名 `neutronstar-site`。
- 当前 `package.json` **没有** `deploy:pages` 或 `build:pages` 脚本；`scripts/` 下也没有部署脚本。因此上述文档命令在当前工作树不可复现。
- 仓库只有 `wrangler.deploy.json`：名称 `neutronstar-web`，入口 `dist/server/entry.mjs`，静态资产 `dist/client`，并声明 `neutronstar.fun` 与 `www.neutronstar.fun` 自定义域名。这是 Workers assets 形态的配置，与 Pages 文档描述的项目名/部署命令不一致。
- 本阶段没有执行代码部署；本次按用户授权删除了旧 Pages 项目 `neutronstar-web`，没有删除或修改 `neutronstar-site` 的生产部署。只读探测 `https://neutronstar.fun/` 的十个主页面均返回 HTTP 200（见下方 smoke test）。

## 当前已知问题

1. BFF 域名在本次环境的只读请求中无法解析，构建时文章数据不可用；文章列表可能为空，且文章详情没有生成真实 slug 页面。
2. 相册详情路由虽有文件，但 `getStaticPaths()` 返回空数组，当前不可访问。
3. Cloudflare Pages 文档、`package.json` 部署脚本和 `wrangler.deploy.json` Workers 配置互相不一致；当前没有已验证、可复现的部署命令。
4. 目标 ADR 的 Vue Islands、Git Markdown/MDX 内容与当前 React/Svelte islands、API 文章数据不一致。
5. 没有根目录环境变量模板；构建存在上述非致命 Svelte 和缺失 `src/icons/` 警告。
6. Git 工作树在阶段开始前已有多项未提交/未跟踪改动。当前 `d0250f3` 是基线提交，不包含这些改动；不存在可安全用于本阶段的全新干净回滚提交。
7. 线上只读请求 `/api/posts`、`/bff/archive` 和 `/api/health` 返回的是首页 HTML（`text/html`），不是预期 JSON；这说明当前域名未把这些 API 路径接到可验证的 BFF，或存在静态回退规则。不能把这些 200 当作 API 健康检查通过。
  8. `http://192.168.5.4:520/` 当前返回 HTTP 200；520 是 NAS 内网博客 Web 端口。Cloudflare Pages 自定义域对外仍使用 HTTPS 443，不能直接把 Pages 域名绑定为 520 端口；若要让公网域名回源 NAS 520，需要单独配置 Cloudflare Tunnel/Worker 路由。
  9. 2026-10-23 已修复 v2 API 的数据库连接：NAS `.env` 中错误的 `10.0.3.5:5432` 改为 PostgreSQL 容器地址 `10.0.3.3:5432`，生成了带时间戳的 `.env.bak.dbfix-*` 备份；`/api/v1/healthz` 已报告 `database: connected`，文章接口返回 200。
  10. Cloudflare Tunnel `neutronstar-api` 已恢复 healthy，`neutronstar-api.neutronstar.fun` DNS CNAME 指向该 Tunnel，Tunnel ingress 指向 `http://192.168.5.4:8200`。
  11. `neutronstar-bff` Worker 已部署，触发器为 `bff.neutronstar.fun`；`/health` 与 `/api/v1/healthz` 返回 200。当前旧前端仍请求 `/api/posts` 等旧路径，返回 404；阶段 2/4 需要完成旧 API 到 v1 合同的迁移。

## 回滚方式

- 本阶段不涉及业务代码、配置或线上发布，因此无需回滚业务行为；已部署版本未被本阶段改动。
- 仅回滚本阶段文档：删除新增的 `docs/architecture/baseline.md`，并将 `.scratch/combined-blog/ai-handoff.md` 中“阶段 0”小节恢复为阶段开始时的“未开始”记录。不要运行 `git reset`、`git checkout -- .` 或还原整个目录，以免覆盖阶段开始前的工作树改动。
- 本阶段未确认实际 Cloudflare Pages/Workers 目标，因此没有验证过云端一键回滚命令。若要回滚线上版本，应先在 Cloudflare 控制台确认实际服务/项目，再选择上一条成功部署；不要直接照抄当前不一致的部署文档命令。

## 验收结果

- 生产构建：通过。
- 10 个静态主页面：首页、文章列表、归档、相册、图书/小说、说说、关于、友链、收藏夹、杂谈：本地预览均 **200**。
- 文章详情：当前没有真实 slug 静态路由，**未通过**。
- 相册详情：路由未生成，**未通过**。
- Cloudflare 配置：检查完成，但真实目标及可复现部署命令未确认，**未通过**。
- 阶段 0 结论：**基线采集与文档已完成，阶段验收未完全通过**。本次遵守冻结范围，没有进入阶段 1。

## 只读线上 smoke test

请求目标 `https://neutronstar.fun/`、`/posts/`、`/archive/`、`/albums/`、`/novel/`、`/moments/`、`/about/`、`/friends/`、`/bookmark/`、`/messages/` 均返回 HTTP 200。对线上 `/posts/` HTML 未提取到真实 `/posts/:slug/` 详情链接。

对 `https://neutronstar.fun/api/posts?...`、`/bff/archive?...`、`/api/health` 的只读请求同样返回 HTTP 200，但响应头为 `text/html` 且正文是站点首页 HTML；因此线上 API smoke test **失败**，不能证明 BFF 或健康端点可用。

建议先确认可用 BFF 地址/文章 slug，并明确 Cloudflare Pages 与 Workers 中当前实际使用的目标及部署入口；再补充详情路由和重跑验收。阶段 0 达到完整验收后，再开始阶段 1（领域模型与 API 合同）。
