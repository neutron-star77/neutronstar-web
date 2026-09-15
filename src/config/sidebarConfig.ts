/**
 * 侧边栏布局配置（数据驱动编排）。
 *
 * 【核心概念】
 * 1. arrangement（侧栏编排模式）：
 *    - "single"（单栏）：所有 widget 放入主侧栏一列（页框 85rem）；
 *    - "dual"（双栏，Mizuki 布局）：column: "secondary" 的 widget 放入副侧栏（视口 ≥ 1280px 展开三列，页框 90rem），
 *      在 1024px~1279px 之间会自动优雅退化为单栏，无需手动适配。
 * 2. side（主栏物理位置）：
 *    - "left"（Mizuki 布局）：主侧栏在左侧，dual 模式下副栏自动落右侧；
 *    - "right"：主侧栏在右侧（内容列居左更聚焦，Twilight 式单右栏），
 *      dual 模式下副栏落左侧。
 * 3. widget 属性：
 *    - type：组件类型（"profile" | "music" | "announcement" | "categories" | "tags" | "stats" | "calendar" | "toc"）；
 *    - enable：是否启用该 widget；
 *    - slot："top"（固定在顶部）| "sticky"（页面滚动时吸顶跟随）；
 *    - column："primary"（主栏，默认）| "secondary"（副栏，仅在 arrangement: "dual" 时生效）；
 *    - pages：仅在指定页面展示（如 ["home", "post"]，省略时默认全页面展示）；
 *    - collapseAfter：折叠阈值（适用于 categories/tags，超出条数显示展开按钮）。
 *
 * 【当前编排（对齐 Mizuki 主题 1:1）】
 * 左栏（primary）：作者卡 → 公告(全页) → 标签 → [吸顶] 目录(文章页)。
 * 右栏（secondary，≥1280px 显示）：统计(全页) → 日历 → [吸顶] 分类 → 音乐。
 *
 * 类型定义见 src/types/sidebarConfig.ts。
 */
import type { SidebarConfig } from "@/types/sidebarConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

export const sidebarConfig: SidebarConfig = withUserConfig("sidebar", {
	enable: true,
	arrangement: "dual",
	side: "left",
	components: [
		// ── 左栏（primary）——Mizuki：作者卡 → 公告 → 标签 → [吸顶] 目录
		{ type: "profile", enable: true, slot: "top" },
		{ type: "announcement", enable: true, slot: "top" },
		{ type: "tags", enable: true, slot: "top", collapseAfter: 20 },
		{ type: "toc", enable: true, slot: "sticky", pages: ["post"] },
		// ── 右栏（secondary）——Mizuki：统计 → 日历 → [吸顶] 分类 → 音乐
		{ type: "stats", enable: true, slot: "top", column: "secondary" },
		{ type: "calendar", enable: true, slot: "top", column: "secondary" },
		{
			type: "categories",
			enable: true,
			slot: "sticky",
			column: "secondary",
			collapseAfter: 5,
		},
		{ type: "music", enable: true, slot: "sticky", column: "secondary" },
	],
});
