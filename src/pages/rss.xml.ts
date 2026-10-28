import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getFeedPosts } from "@utils/feed";
import { siteConfig } from "@/config";
import { getSiteIdentity } from "@utils/site-overrides";

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
	const site = context.site ?? new URL(siteConfig.site);
	const posts = await getFeedPosts(site);
	const identity = await getSiteIdentity();
	const title = identity.title || siteConfig.title;
	const description = identity.description ?? siteConfig.subtitle ?? "No description";

	return rss({
		title,
		description,
		site: site.href,
		items: posts.map((post) => ({
			title: post.title,
			pubDate: post.pubDate,
			description: post.description,
			link: post.link,
			content: post.contentHtml,
		})),
		customData: `<language>${siteConfig.lang}</language>`,
	}).then((response) => {
		// XML 内容/日期/密文提示/content 字段保持不变，只加缓存指令。
		// 边缘真缓存由 middleware 的 Cache API 路径负责（TTL 120），
		// 这里是给中间层的声明（middleware 未启用的环境仍有短 SWR 兜底）。
		response.headers.set(
			"Cache-Control",
			"public, s-maxage=120, stale-while-revalidate=600",
		);
		return response;
	});
}
