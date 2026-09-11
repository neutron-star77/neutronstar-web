/**
 * 站点统计取数（SideBar stats widget 消费）。
 * P2 数据换血：字数/时间直接来自后端统计字段（后台发文时计算），
 * 不再构建期跑 remark。模块级备忘化 + isolate 内存 TTL 由本层管理。
 */
import { apiGet } from "@/lib/server/api";
import {
	getCategoryList,
	getSortedPosts,
	getTagList,
} from "./content-utils";

export interface SiteStats {
	posts: number;
	moments: number;
	categories: number;
	tags: number;
	/** 全部文章字数之和（后端 word_count） */
	words: number;
	/** 运行天数：以最早一篇文章的发布日为起点（无文章则 0） */
	days: number;
	/** 最近更新：全站最新一篇的发布/更新日（ISO 字符串；无文章为 null） */
	lastActivity: string | null;
}

const DAY_MS = 86_400_000;

let cache: { expires: number; data: SiteStats } | null = null;

export async function getSiteStats(): Promise<SiteStats> {
	if (cache && cache.expires > Date.now()) return cache.data;

	const [posts, categories, tags, chatterCount] = await Promise.all([
		getSortedPosts(),
		getCategoryList(),
		getTagList(),
		apiGet<{ count: number }>("/api/chatters/count?status=published", 30_000),
	]);

	let words = 0;
	let earliest = Number.POSITIVE_INFINITY;
	let latestActivity = 0;
	for (const post of posts) {
		words += post.wordCount;
		const published = new Date(post.data.published).getTime();
		if (published < earliest) earliest = published;
		const updated = post.data.updated
			? new Date(post.data.updated).getTime()
			: 0;
		latestActivity = Math.max(latestActivity, published, updated);
	}

	const data: SiteStats = {
		posts: posts.length,
		moments: chatterCount?.count ?? 0,
		categories: categories.length,
		tags: tags.length,
		words,
		days: Number.isFinite(earliest)
			? Math.max(0, Math.floor((Date.now() - earliest) / DAY_MS))
			: 0,
		lastActivity:
			latestActivity > 0 ? new Date(latestActivity).toISOString() : null,
	};
	cache = { expires: Date.now() + 15_000, data };
	return data;
}
