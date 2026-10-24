# Plain-text blog audit

## Completed

- Shared `MainGridLayout` no longer renders the decorative BannerStage.
- Shared editorial CSS sets the warm paper surface, narrow content measure, text navigation, hairline rules, and card reset.
- Homepage has text-only introduction, recent posts, and category navigation.
- Archive is a text list and no longer loads the river island.
- Friends and bookmarks use text rows rather than avatar/card grids.
- Article and album content media remain available inside their content surfaces.
- Numeric homepage paths fetch their requested archive page instead of reusing page one.
- Mobile navigation drawer remains available below the desktop breakpoint.

## Residual findings

- Existing Svelte components still emit pre-existing accessibility/deprecation warnings during build. They do not fail the build and are outside this visual refactor.
- Albums and moments retain their interactive islands because their media, likes, comments, and lightbox behavior are content features rather than decorative shell elements.
- The shared layout still contains legacy optional controls such as the navigation drawer and context menu; the editorial surface hides desktop decoration while preserving mobile access.

## Verification

- `pnpm exec astro build` passed.
- Production routes on `https://neutronstar.fun/` returned HTTP 200 for home, posts, archive, albums, album detail, moments, about, novel, friends, bookmark, and messages.
- Online HTML no longer contains `banner-stage` or `shirone-hero.webp` on those routes.

## 2026-10-24 正式上线与 Waline 回归

- CI「Deploy to Cloudflare Workers」修复 DNS 100117 冲突（删除 apex/www 指向旧 Pages 的 CNAME）后三连绿；`neutronstar.fun` 现由 Worker `neutronstar-web` 承载，旧 Pages 项目 `neutronstar-site` 已删除。
- Waline 评论区回归：WalineComments island 恢复 + editorial 皮肤，接入 /posts/<slug>、/messages、/albums/<slug>；服务端修复 PG_HOST（bridge IP 漂移，现指 neutronstar-v2-pg）；评论 API 实测 errno:0。
- 清除零引用旧组件 8 个、shirone-hero.webp、mermaid.css；补 robots.txt。
- 终验：14 路由全 200，旧版特征（banner-stage/shirone-hero/内网存档）清零。
