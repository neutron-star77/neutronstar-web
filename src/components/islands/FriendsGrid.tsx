import { useFriendLinks } from "../../lib/api/hooks";
import { useRealtimeRefresh } from "../../lib/realtime";

// 旧版友链列表 island（friends.astro 已改用 FriendTank；本文件暂留，待主控统一清理）。
// 拉取逻辑已提取到 lib/api/hooks.ts 的 useFriendLinks（SWR + SSE 实时），不再自带一套。
export default function FriendsGrid() {
  const { data, error, isLoading } = useFriendLinks();
  useRealtimeRefresh(["friend-links"]);

  const friends = data ?? [];

  if (error) return <p className="text-sm text-on-surface-variant">友链暂时无法加载。</p>;
  if (!isLoading && !friends.length) return <p className="text-sm text-on-surface-variant">暂时还没有友链。</p>;

  return (
    <div className="editorial-data-list">
      {friends.map((friend) => (
        <a
          key={friend.id}
          href={friend.url}
          target="_blank"
          rel="noreferrer"
          className="editorial-data-row"
        >
          <strong>{friend.name}</strong>
          <span>{friend.description}</span>
          <span aria-hidden="true">↗</span>
        </a>
      ))}
    </div>
  );
}
