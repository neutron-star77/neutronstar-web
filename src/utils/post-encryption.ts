/**
 * 文章加密判断（P6 文章加密未做时，所有文章 encrypted=false）。
 * 与上游 @utils/post-encryption 接口保持一致，供 feed / llms 过滤用。
 */
import type { PostData } from "./content-utils";

export function isEncryptedPost(data: PostData): boolean {
	return Boolean(data?.encrypted);
}
