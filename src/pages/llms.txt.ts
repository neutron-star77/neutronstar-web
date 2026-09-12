import type { APIContext, APIRoute } from "astro";
import { getSortedPosts } from "@utils/content-utils";
import { isEncryptedPost } from "@utils/post-encryption";
import { generateLlmsTxt } from "@utils/llms-utils";
import { llmsConfig, profileConfig, siteConfig } from "@/config";
import { getSiteIdentity } from "@utils/site-overrides";

export const prerender = false;

export const GET: APIRoute = async (context: APIContext) => {
	if (!llmsConfig.enable) {
		return new Response("Not Found", { status: 404 });
	}

	const siteUrl = (context.site?.href ?? siteConfig.site).replace(/\/$/, "");
	const allPosts = await getSortedPosts();

	const publicPosts = allPosts.filter((post) => {
		if (isEncryptedPost(post.data)) return false;
		if (post.data.draft) return false;
		if (
			llmsConfig.excludeTags?.length &&
			post.data.tags?.some((t) => llmsConfig.excludeTags?.includes(t))
		) {
			return false;
		}
		if (
			llmsConfig.excludeCategories?.length &&
			post.data.category &&
			llmsConfig.excludeCategories.includes(post.data.category)
		) {
			return false;
		}
		return true;
	});

	const identity = await getSiteIdentity();
	const siteTitle = identity.title ?? siteConfig.title;
	const siteSummary =
		llmsConfig.siteSummary ||
		identity.description ||
		siteConfig.subtitle ||
		profileConfig.bio ||
		siteConfig.title;

	const content = generateLlmsTxt({
		posts: publicPosts,
		baseUrl: siteUrl,
		config: llmsConfig,
		siteTitle,
		siteSummary,
	});

	return new Response(content, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=86400",
		},
	});
};
