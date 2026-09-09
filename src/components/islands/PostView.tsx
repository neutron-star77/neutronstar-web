import { usePost } from "../../lib/api/hooks";

export default function PostView({ slug }: { slug: string }) {
  const { data: post, isLoading, error } = usePost(slug);

  if (isLoading) return <p className="text-sm text-on-surface-variant">加载中…</p>;
  if (error || !post)
    return <p className="text-sm text-on-surface-variant">文章不存在或加载失败。</p>;

  return (
    <article className="prose-m3">
      <h1 className="text-2xl font-bold text-on-surface sm:text-3xl">{post.title}</h1>
      <div className="mt-2 text-xs text-on-surface-variant">
        {post.published_at.slice(0, 10)}
        {post.category && ` · ${post.category}`} · {post.views} views
      </div>
      {post.cover && (
        <img
          src={post.cover}
          alt={post.title}
          className="mt-4 w-full rounded-m3 object-cover"
          loading="lazy"
          decoding="async"
        />
      )}
      <div
        className="mt-6 text-sm leading-relaxed text-on-surface"
        // 后端返回 Markdown 原文；正式渲染在 T5/T8（MD → 高亮 + 批注）
        // 此处先以预格式化文本展示，保证内容可读
        style={{ whiteSpace: "pre-wrap" }}
      >
        {post.content}
      </div>
    </article>
  );
}
