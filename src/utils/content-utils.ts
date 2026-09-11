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
import { apiGet } from "@/lib/server/api";

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
	reading_time: number;
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
	body?: string;
	/** API 文章的封面等资源全是远程 URL，无 filePath */
	filePath?: undefined;
	data: PostData;
	/** 后端统计字段（原版来自 remark frontmatter，这里直接透传） */
	wordCount: number;
	readingTime: number;
}

export function apiPostToEntry(p: ApiPost): PostEntry {
	const published = p.published_at
		? new Date(p.published_at)
		: new Date(p.created_at);
	const updatedDate = p.updated_at ? new Date(p.updated_at) : undefined;
	return {
		id: p.slug,
		slug: p.slug,
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
	};
}

async function fetchAllPublishedPosts(): Promise<PostEntry[]> {
	const list = await apiGet<ApiPost[]>("/api/posts?status=published&page=1&size=200");
	return (list ?? []).map(apiPostToEntry);
}

/** 全量已发布文章（置顶优先，时间倒序），并填好上下篇字段 */
export async function getSortedPosts(): Promise<PostEntry[]> {
	const entries = await fetchAllPublishedPosts();
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
	const post = await apiGet<ApiPost>(`/api/posts/${encodeURIComponent(slug)}`);
	if (!post) return null;
	const entry = apiPostToEntry(post);
	entry.body = post.content ?? "";
	entry.url = getPostUrl(entry);
	return entry;
}

/** 站点元信息（site_config 的站名/描述，Layout/Banner 覆盖默认值用） */
export interface SiteIdentity {
	title: string | null;
	description: string | null;
}

export async function getSiteIdentity(): Promise<SiteIdentity> {
	const cfg = await apiGet<Record<string, string>>("/api/site-config", 60_000);
	return {
		title: cfg?.site_title || null,
		description: cfg?.site_description || null,
	};
}
