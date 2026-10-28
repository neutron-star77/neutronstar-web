/**
 * 内容取数（P2 数据换血）：全部业务数据来自后端 API（经 BFF 缓存代理）。
 *
 * API 文章被适配成与原版 content collection entry 鸭子兼容的形状
 * （slug + data 字段集），PostPage/PostCard/Pagination/日历等组件零改动。
 * 排序/上下篇/permalink 等原版工具函数均按鸭子类型消费，直接复用。
 */
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { comparePublicationEntries } from "@utils/content-date";
import { initPostIdMap } from "@utils/permalink-utils";
import { getCategoryUrl, getPostUrl, url } from "@utils/url-utils";
import { apiGet, API_BASE_URL } from "@/lib/server/api";

/**
 * 内网直连模式：构建时 PUBLIC_API_BASE 指向 NAS v2-api（http://192.168.5.4:8200）。
 * 该后端的当前数据在 /api/v1/*（文本化内容源）；/api/* 旧端点只是回退代理，
 * 转发到 8100 旧库（中文 slug 的遗留数据）——直连时必须用 v1 端点并对齐字段。
 * 公网构建走 BFF（API_BASE_URL === bff 域名），/api/posts 由 BFF 内部做 v1 适配，勿动。
 */
const DIRECT_V2_MODE = API_BASE_URL !== "https://bff.neutronstar.fun";

/**
 * v2-api /api/v1 数据 → 旧 PostOut 形状。v1 缺 views/likes/word_count/font_*
 * （回退默认值）；description←excerpt；status←is_draft；content←plain_text
 * （正文以 content_html 为主，markdown 管道仅无 html 时兜底，plain_text 够用）。
 */
/** v2-api /api/v1 行的宽松形状（只列本函数用到的字段） */
interface V1PostRow {
	id: number;
	title: string;
	slug: string;
	excerpt?: string;
	seo_description?: string;
	cover?: { url?: string } | string;
	category?: string;
	tags?: string[];
	is_draft?: boolean;
	is_pinned?: boolean;
	content_html?: string;
	reading_time?: number;
	published_at?: string | null;
	updated_at?: string | null;
	plain_text?: string;
}

function v1PostToApiPost(p: ApiPost): ApiPost {
	const r = p as unknown as V1PostRow;
	// v1 的 cover 是对象 { url, ... }（旧 PostOut 是字符串），取 url 字段
	const coverObj = r.cover as unknown as { url?: string } | string | undefined;
	const coverUrl =
		typeof coverObj === "object" && coverObj !== null
			? coverObj.url || ""
			: typeof coverObj === "string"
				? coverObj
				: "";
	return {
		id: r.id,
		title: r.title,
		slug: r.slug,
		description: r.excerpt || r.seo_description || "",
		cover: coverUrl,
		category: r.category || "",
		tags: Array.isArray(r.tags) ? r.tags : [],
		status: r.is_draft ? "draft" : "published",
		is_pinned: Boolean(r.is_pinned),
		views: 0,
		likes: 0,
		word_count: 0,
		content_html: r.content_html || "",
		reading_time: r.reading_time || 0,
		font_id: null,
		font_name: "",
		font_family: "",
		published_at: r.published_at ?? null,
		created_at: r.published_at || r.updated_at || "",
		updated_at: r.updated_at || r.published_at || "",
		content: r.plain_text || "",
	};
}

/** 直连模式下按模式取端点并归一形状；BFF 模式保持原路径原形状 */
function normalizeApiPosts(list: ApiPost[] | null): ApiPost[] {
	const rows = list ?? [];
	return DIRECT_V2_MODE ? rows.map(v1PostToApiPost) : rows;
}

/** 后端 PostOut（裸数组返回） */
export interface ApiPost {
	id: number;
	title: string;
	slug: string;
	description: string;
	cover: string;
	category: string;
	tags: string[];
	status: string;
	is_pinned: boolean;
	views: number;
	likes: number;
	word_count: number;
	content_html: string;
	reading_time: number;
	font_id: number | null;
	font_name: string;
	font_family: string;
	published_at: string | null;
	created_at: string;
	updated_at: string;
	content?: string;
}

/** 与原版 CollectionEntry<"posts">["data"] 鸭子兼容的字段集 */
export interface PostData {
	title: string;
	published: Date;
	updated?: Date;
	pinned: boolean;
	draft: boolean;
	comment: boolean;
	description: string;
	image: string;
	tags: string[];
	category: string;
	lang: string;
	encrypted: boolean;
	passwordHint: string;
	hideHomeContent: boolean;
	prevUrl?: string;
	prevTitle?: string;
	prevSlug?: string;
	nextUrl?: string;
	nextTitle?: string;
	nextSlug?: string;
}

export interface PostEntry {
	id: string;
	slug: string;
	/** 后端主键（评论等多态关联要用数字 id，slug 只能做路由） */
	postId?: number;
	body?: string;
	contentHtml?: string;
	/** API 文章的封面等资源全是远程 URL，无 filePath */
	filePath?: undefined;
	data: PostData;
	/** 后端统计字段（原版来自 remark frontmatter，这里直接透传） */
	wordCount: number;
	readingTime: number;
	/** 后端统计字段（时光河流归档页等需要） */
	views: number;
	likes: number;
	/** 文章级字体（后台可选，未选为空 → 前端走站点默认字体，零影响） */
	font?: { id: number; name: string; family: string };
}

export function apiPostToEntry(p: ApiPost): PostEntry {
	const published = p.published_at
		? new Date(p.published_at)
		: new Date(p.created_at);
	const updatedDate = p.updated_at ? new Date(p.updated_at) : undefined;
	return {
		id: p.slug,
		slug: p.slug,
		postId: p.id,
		data: {
			title: p.title,
			published,
			updated: updatedDate,
			pinned: Boolean(p.is_pinned),
			draft: p.status !== "published",
			comment: true,
			description: p.description || "",
			image: p.cover || "",
			tags: Array.isArray(p.tags) ? p.tags : [],
			category: p.category || "",
			lang: "",
			encrypted: false,
			passwordHint: "",
			hideHomeContent: true,
		},
		wordCount: p.word_count || 0,
		readingTime: p.reading_time || 0,
		views: p.views || 0,
		likes: p.likes || 0,
		font: p.font_id
			? { id: p.font_id, name: p.font_name || "", family: p.font_family || "" }
			: undefined,
	};
}

/** v2 公开列表契约（内网 openapi.json 2026-10-29 核实）：参数为 page/page_size
 * （默认 20、上限 100，无 size/status），服务端仅返回已发布。逐页取全量，
 * 单页失败返回 null——交由调用方按既有重试与构建期硬失败守卫处理，
 * 不得把上游故障降级成空集合静默上线。 */
const V2_PAGE_SIZE = 100;

async function fetchV2PublishedPage(page: number) {
	const raw = await apiGet<{
		data?: ApiPost[];
		meta?: { total?: number; total_pages?: number };
	}>(`/api/v1/posts?page=${page}&page_size=${V2_PAGE_SIZE}`);
	const rows = raw?.data;
	if (!raw || !Array.isArray(rows)) return null;
	const totalPages = Math.min(50, Math.max(1, Number(raw.meta?.total_pages ?? 1) || 1));
	return { rows, totalPages };
}

async function fetchV2AllPublishedRaw(): Promise<ApiPost[] | null> {
	const first = await fetchV2PublishedPage(1);
	if (!first) return null;
	const all = [...first.rows];
	for (let p = 2; p <= first.totalPages; p += 1) {
		const next = await fetchV2PublishedPage(p);
		if (!next) return null;
		all.push(...next.rows);
	}
	return all;
}

async function fetchAllPublishedPosts(): Promise<PostEntry[]> {
	let list: ApiPost[] | null;
	if (DIRECT_V2_MODE) {
		list = await fetchV2AllPublishedRaw();
	} else {
		// BFF 模式：/api/posts 内部翻页取全量返回裸数组（客户端旧 size 参数已废弃）
		const raw = await apiGet<ApiPost[]>("/api/posts");
		list = Array.isArray(raw) ? raw : null;
	}
	return normalizeApiPosts(list ?? []).map(apiPostToEntry);
}

/** 全量已发布文章（置顶优先，时间倒序），并填好上下篇字段 */
export async function getSortedPosts(): Promise<PostEntry[]> {
	// BFF 冷启动实测可达 10~20s（v2/tunnel 冷）——3 次尝试、间隔 4s，最后认输触发守卫
	let entries: PostEntry[] = [];
	for (let attempt = 0; attempt < 3 && entries.length === 0; attempt += 1) {
		entries = await fetchAllPublishedPosts();
		if (entries.length === 0) await new Promise((r) => setTimeout(r, 4000));
	}
	const sorted = entries.sort(comparePublicationEntries);
	initPostIdMap(sorted as never);

	for (let i = 1; i < sorted.length; i++) {
		sorted[i].data.nextSlug = sorted[i - 1].id;
		sorted[i].data.nextTitle = sorted[i - 1].data.title;
		sorted[i].data.nextUrl = getPostUrl(sorted[i - 1]);
	}
	for (let i = 0; i < sorted.length - 1; i++) {
		sorted[i].data.prevSlug = sorted[i + 1].id;
		sorted[i].data.prevTitle = sorted[i + 1].data.title;
		sorted[i].data.prevUrl = getPostUrl(sorted[i + 1]);
	}

	return sorted;
}

export type PostForList = {
	slug: string;
	data: PostData;
	url?: string;
};

export async function getSortedPostsList(): Promise<PostForList[]> {
	const sortedFullPosts = await getSortedPosts();
	return sortedFullPosts.map((post) => ({
		slug: post.slug,
		data: post.data,
		url: getPostUrl(post),
	}));
}

export type Tag = {
	name: string;
	count: number;
};

/** 标签来自后端 /api/tags（维护 post_count 计数） */
export async function getTagList(): Promise<Tag[]> {
	const rows = await apiGet<{ name: string; post_count: number }[]>("/api/tags");
	return (rows ?? []).map((t) => ({ name: t.name, count: t.post_count || 0 }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

/** 分类从文章列表统计（后端 category 表允许为空，文章可无分类） */
export async function getCategoryList(): Promise<Category[]> {
	const posts = await fetchAllPublishedPosts();
	const count: { [key: string]: number } = {};
	for (const post of posts) {
		if (!post.data.category) {
			const ucKey = i18n(I18nKey.uncategorized);
			count[ucKey] = (count[ucKey] ?? 0) + 1;
			continue;
		}
		const categoryName = post.data.category.trim();
		if (!categoryName) continue;
		count[categoryName] = (count[categoryName] ?? 0) + 1;
	}

	const lst = Object.keys(count).sort((a, b) =>
		a.toLowerCase().localeCompare(b.toLowerCase()),
	);

	return lst.map((c) => ({
		name: c,
		count: count[c],
		url: getCategoryUrl(c),
	}));
}

/** 归档分页（SSR 首页/归档页消费）：posts + total 一次拿齐 */
export interface ArchivePage {
	posts: PostEntry[];
	total: number;
	page: number;
	size: number;
	lastPage: number;
}

export async function getArchivePage(
	page: number,
	size: number,
	filter: { tag?: string; category?: string } = {},
): Promise<ArchivePage> {
	// 一代内网版（PUBLIC_API_BASE 指向 NAS 直连）：/api/posts 返回全量数组，本地切片分页；
	// 公网 BFF 模式走 /bff/archive（边缘缓存 + 服务端分页，内网 FastAPI 无该端点）。
	const apiBase =
		(import.meta.env.PUBLIC_API_BASE ?? "").trim() ||
		"https://bff.neutronstar.fun";
	if (apiBase !== "https://bff.neutronstar.fun") {
		const list = (await fetchV2AllPublishedRaw()) ?? [];
		const all = normalizeApiPosts(list).map(apiPostToEntry);
		const total = all.length;
		const start = (page - 1) * size;
		const posts = all.slice(start, start + size);
		for (const p of posts) p.url = getPostUrl(p);
		return { posts, total, page, size, lastPage: Math.max(1, Math.ceil(total / size)) };
	}
	const params = new URLSearchParams({
		page: String(page),
		size: String(size),
	});
	if (filter.tag) params.set("tag", filter.tag);
	if (filter.category) params.set("category", filter.category);
	const data = await apiGet<{
		posts: ApiPost[];
		total: number;
		page: number;
		lastPage: number;
	}>(`/bff/archive?${params}`);
	const posts = (data?.posts ?? []).map(apiPostToEntry);
	for (const p of posts) p.url = getPostUrl(p);
	const total = data?.total ?? posts.length;
	return {
		posts,
		total,
		page: data?.page ?? page,
		size,
		lastPage: data?.lastPage ?? Math.max(1, Math.ceil(total / size)),
	};
}

/** 文章详情（含 markdown 原文） */
export async function getPostBySlug(slug: string): Promise<PostEntry | null> {
	const path = DIRECT_V2_MODE
		? `/api/v1/posts/${encodeURIComponent(slug)}`
		: `/api/posts/${encodeURIComponent(slug)}`;
	const post = await apiGet<ApiPost>(path);
	if (!post) return null;
	const entry = apiPostToEntry(DIRECT_V2_MODE ? v1PostToApiPost(post) : post);
	entry.body = post.content ?? "";
	entry.contentHtml = (post as { content_html?: string }).content_html ?? "";
	entry.url = getPostUrl(entry);
	return entry;
}

/**
 * 全量已发布文章 + 逐篇拉取正文（供 llms-full.txt / feed 全文输出用）。
 * 列表接口不返回 content，这里并行调用单篇详情接口；BFF 有缓存，重复调用快。
 */
export async function getSortedPostsWithContent(): Promise<PostEntry[]> {
	const posts = await getSortedPosts();
	await Promise.all(
		posts.map(async (p) => {
			if (p.body) return;
			try {
				const detail = await apiGet<ApiPost>(
					DIRECT_V2_MODE
						? `/api/v1/posts/${encodeURIComponent(p.slug)}`
						: `/api/posts/${encodeURIComponent(p.slug)}`,
				);
				const normalized = DIRECT_V2_MODE && detail ? v1PostToApiPost(detail) : detail;
				if (normalized?.content) p.body = normalized.content;
			} catch {
				// 单篇拉取失败不阻塞整体，该篇正文留空
			}
		}),
	);
	return posts;
}
