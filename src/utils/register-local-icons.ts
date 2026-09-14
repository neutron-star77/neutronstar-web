/**
 * 本地 Iconify 图标离线注册（共享模块）。
 *
 * @iconify/svelte 在本项目中被 alias 为 OfflineIcon（见 astro.config.mjs），
 * 渲染图标前必须先 addCollection 注册数据。上游只在 atoms/display/Icon.svelte
 * 里注册，而首页等页面并不水合该组件——导致顶栏壁纸/翻译等按钮图标空白、
 * 按钮宽度归零不可见。凡使用 @iconify/svelte 图标的水合组件都应
 * import "@/utils/register-local-icons"（副作用导入，模块顶层执行，幂等）。
 */
import { addCollection } from "@shirone/iconify-offline-functions";
import { localIconCollections } from "@/generated/local-icon-collections";

for (const collection of localIconCollections) addCollection(collection);
