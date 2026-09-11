import { useMessages } from "../../lib/api/hooks";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function MessagesList() {
  const { data, isLoading, error } = useMessages();

  if (isLoading) return <p className="text-sm text-on-surface-variant">加载中…</p>;
  if (error) return <p className="text-sm text-on-surface-variant">留言暂时无法加载。</p>;
  if (!data?.length) return <p className="text-sm text-on-surface-variant">还没有杂谈。</p>;

  return (
    <div className="space-y-4">
      {data.map((message, index) => (
        <article
          key={message.id}
          className="fade-up rounded-m3 bg-surface-container p-5 shadow-elevation-1"
          style={{ animationDelay: `${index * 45}ms` }}
        >
          <p className="whitespace-pre-wrap text-sm leading-7 text-on-surface">{message.content}</p>
          <div className="mt-4 flex items-center justify-between border-t border-outline/30 pt-3 text-xs text-on-surface-variant">
            <time dateTime={message.created_at}>{formatDate(message.created_at)}</time>
            <span>♡ {message.likes}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
