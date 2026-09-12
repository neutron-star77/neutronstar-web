import { buildAtomXml, getFeedPosts } from "@utils/feed";
import type { APIContext } from "astro";
import { profileConfig, siteConfig } from "@/config";
import { getSiteIdentity } from "@utils/site-overrides";

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
	const site = context.site ?? new URL(siteConfig.site);
	const posts = await getFeedPosts(site);
	const identity = await getSiteIdentity();
	const title = identity.title ?? siteConfig.title;
	const subtitle = identity.description ?? siteConfig.subtitle ?? "No description";

	const xml = buildAtomXml({
		title,
		subtitle,
		lang: siteConfig.lang,
		author: profileConfig.name,
		siteUrl: site.href,
		feedUrl: new URL("atom.xml", site).href,
		items: posts,
	});

	return new Response(xml, {
		headers: {
			"Content-Type": "application/atom+xml; charset=utf-8",
		},
	});
}
