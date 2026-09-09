import useSWR from "swr";
import { apiGet } from "./client";
import type { Post, PostSummary, Chatter, Album } from "./types";

/** 实时性策略：聚焦重校验 + 30s 去重。配合中间层 s-maxage/swr 实现「发布即见」。 */
const opts = {
  revalidateOnFocus: true,
  keepPreviousData: true,
  dedupingInterval: 30_000,
};

export function usePosts({ page = 1, size = 10 }: { page?: number; size?: number } = {}) {
  return useSWR<PostSummary[]>(
    ["posts", page, size],
    ([, p, s]) => apiGet<PostSummary[]>(`/api/posts?status=published&page=${p}&size=${s}`),
    opts,
  );
}

export function usePost(slug: string) {
  return useSWR<Post>(
    slug ? (["post", slug] as const) : null,
    ([, s]: [string, string]) => apiGet<Post>(`/api/posts/${encodeURIComponent(s)}`),
    opts,
  );
}

export function useChatters({ page = 1, size = 10 }: { page?: number; size?: number } = {}) {
  return useSWR<Chatter[]>(
    ["chatters", page, size],
    ([, p, s]) => apiGet<Chatter[]>(`/api/chatters?status=published&page=${p}&size=${s}`),
    opts,
  );
}

export function useAlbums() {
  return useSWR<Album[]>(["albums"], () => apiGet<Album[]>("/api/albums"), opts);
}
