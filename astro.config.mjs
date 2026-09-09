// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// 渲染策略：默认全站预渲染（静态优先 = 最快首屏）；
// 需要实时的页面在 frontmatter 写 `export const prerender = false`。
// 图片统一走中间层 /img/*，构建期不处理远程图 → imageService: passthrough
export default defineConfig({
  output: "static",
  adapter: cloudflare({
    imageService: "passthrough",
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
  build: {
    inlineStylesheets: "auto",
  },
  compressHTML: true,
});
