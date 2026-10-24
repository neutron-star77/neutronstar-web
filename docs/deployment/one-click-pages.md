# 一键部署到 Cloudflare Pages

## 第一次使用

在项目目录运行一次：

```powershell
pnpm dlx wrangler login
```

浏览器完成 Cloudflare 授权后关闭页面即可。这个登录状态保存在本机 Wrangler 配置中，不需要把 API Token 写进项目。

## 部署

在项目目录运行：

```powershell
pnpm run deploy:pages
```

脚本会依次执行：

1. 检查 Wrangler 登录状态。
2. 执行 `pnpm run build:pages`。
3. 检查 `dist/client/index.html`。
4. 执行 `wrangler pages deploy dist/client`。

当前绑定 `neutronstar.fun` 的 Pages 项目是 `neutronstar-site`。如果将来项目名称变化：

```powershell
pnpm run deploy:pages -- -ProjectName your-pages-project
```

只重新部署已经存在的构建产物：

```powershell
pnpm run deploy:pages -- -SkipBuild
```

## 重要边界

- 这个脚本只部署静态前端。
- Supabase Secret、R2 Secret Access Key 和 BFF 密钥不会进入静态产物。
- Pages 的动态 API 需要后续接 Pages Functions 或单独 BFF 域名。
