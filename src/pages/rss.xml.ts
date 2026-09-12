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
	const title = identity.title ?? siteConfig.title;
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
	});
}
