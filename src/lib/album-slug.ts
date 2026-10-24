/**
 * 相册 slug（列表页链接 ↔ 详情页 getStaticPaths 必须同源）：
 * `{id}-{标题小写、非字母数字汉字段转-、去首尾-}`。
 * 从 albums/[slug].astro 抽出共用。
 */
import type { Album } from "./api/types";

export function albumSlug(album: Pick<Album, "id" | "title">) {
	return `${album.id}-${album.title
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
		.replace(/^-|-$/g, "")}`;
}
