/**
 * 导航菜单图标库（前后台共享同一份图标名清单）。
 *
 * - 前台：本文件中的图标名字面量会被 astro-icon 构建静态扫描收集并离线打包，
 *   因此后台导航编辑器只能从本清单里选图标（或手动输入已被扫描收录的名字），
 *   否则线上 SSR 渲染会得到空白 SVG。
 * - 后台：admin 用同一份清单渲染图标选择器（@iconify/vue 在线渲染）。
 *
 * 新增图标：先在这里加一条，再跑 `node scripts/icons/patch-material-symbols.mjs`
 * 把 material-symbols 子集同步进离线注册集合。
 */
export interface NavIconEntry {
	/** iconify 全名，如 material-symbols:home-outline-rounded */
	name: string;
	/** 中文说明，图标选择器里悬停/标签展示 */
	label: string;
	/** 分组（选择器 tab 用） */
	group: "常用" | "内容" | "媒体" | "社交" | "工具";
}

export const NAV_ICON_LIBRARY: NavIconEntry[] = [
	// —— 常用（站点导航高频项） ——
	{ name: "material-symbols:home-outline-rounded", label: "首页", group: "常用" },
	{ name: "material-symbols:article-outline-rounded", label: "文章", group: "常用" },
	{ name: "material-symbols:archive-outline-rounded", label: "归档", group: "常用" },
	{ name: "material-symbols:auto-awesome-outline-rounded", label: "说说/动态", group: "常用" },
	{ name: "material-symbols:photo-library-outline-rounded", label: "相册", group: "常用" },
	{ name: "material-symbols:handshake-outline-rounded", label: "友链", group: "常用" },
	{ name: "material-symbols:forum-outline-rounded", label: "杂谈/留言板", group: "常用" },
	{ name: "material-symbols:menu-book-outline-rounded", label: "小说/书籍", group: "常用" },
	{ name: "material-symbols:info-outline-rounded", label: "关于", group: "常用" },
	{ name: "material-symbols:apps", label: "更多/全部", group: "常用" },

	// —— 内容 ——
	{ name: "material-symbols:folder-outline-rounded", label: "分类", group: "内容" },
	{ name: "material-symbols:tag-rounded", label: "标签", group: "内容" },
	{ name: "material-symbols:timeline", label: "时间线", group: "内容" },
	{ name: "material-symbols:deployed-code", label: "项目/作品", group: "内容" },
	{ name: "material-symbols:explore-rounded", label: "发现/探索", group: "内容" },
	{ name: "material-symbols:edit-note-outline-rounded", label: "写作/笔记", group: "内容" },
	{ name: "material-symbols:bookmark-outline-rounded", label: "书签/收藏", group: "内容" },
	{ name: "material-symbols:star-outline-rounded", label: "收藏夹", group: "内容" },
	{ name: "material-symbols:library-books-outline-rounded", label: "文库", group: "内容" },
	{ name: "material-symbols:code-rounded", label: "代码", group: "内容" },

	// —— 媒体 ——
	{ name: "material-symbols:music-note", label: "音乐", group: "媒体" },
	{ name: "material-symbols:movie-outline-rounded", label: "影视", group: "媒体" },
	{ name: "material-symbols:photo-camera-outline-rounded", label: "摄影", group: "媒体" },
	{ name: "material-symbols:podcasts-rounded", label: "播客", group: "媒体" },
	{ name: "material-symbols:rss-feed-rounded", label: "RSS 订阅", group: "媒体" },
	{ name: "material-symbols:wallpaper", label: "壁纸", group: "媒体" },
	{ name: "material-symbols:grid-view-rounded", label: "网格视图", group: "媒体" },

	// —— 社交 ——
	{ name: "material-symbols:person-outline-rounded", label: "个人", group: "社交" },
	{ name: "material-symbols:groups-rounded", label: "社交/群组", group: "社交" },
	{ name: "material-symbols:mail-outline-rounded", label: "邮件", group: "社交" },
	{ name: "material-symbols:call", label: "联系/电话", group: "社交" },
	{ name: "material-symbols:language", label: "语言/翻译", group: "社交" },
	{ name: "material-symbols:link-rounded", label: "链接", group: "社交" },
	{ name: "material-symbols:open-in-new-rounded", label: "新窗口/外链", group: "社交" },
	{ name: "material-symbols:share", label: "分享", group: "社交" },
	{ name: "fa6-brands:github", label: "GitHub", group: "社交" },

	// —— 工具 ——
	{ name: "material-symbols:search-rounded", label: "搜索", group: "工具" },
	{ name: "material-symbols:settings-outline-rounded", label: "设置", group: "工具" },
	{ name: "material-symbols:palette-outline", label: "主题/配色", group: "工具" },
	{ name: "material-symbols:calendar-month-outline-rounded", label: "日历", group: "工具" },
	{ name: "material-symbols:map-outline-rounded", label: "地图/位置", group: "工具" },
	{ name: "material-symbols:cloud-outline", label: "云端", group: "工具" },
	{ name: "material-symbols:notifications-outline-rounded", label: "通知", group: "工具" },
	{ name: "material-symbols:favorite-outline-rounded", label: "喜欢", group: "工具" },
	{ name: "material-symbols:waving-hand-rounded", label: "问候/打招呼", group: "工具" },
	{ name: "material-symbols:keyboard-arrow-down-rounded", label: "下拉箭头", group: "工具" },
];
