import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../../lib/api/client";
import { useRealtimeRefresh } from "../../lib/realtime";

interface FriendLink {
  id: number;
  name: string;
  url: string;
  avatar: string;
  description: string;
}

export default function FriendsGrid() {
  const [friends, setFriends] = useState<FriendLink[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    apiGet<FriendLink[]>("/api/friend-links")
      .then(setFriends)
      .catch(() => setError(true));
  }, []);

  useEffect(load, [load]);

  // P4 实时：后台增删友链 → 广播 friends 频道 → 这里用非 SWR 数据源，走 onChange 回调重拉
  useRealtimeRefresh(["friend-links"], load);

  if (error) return <p className="text-sm text-on-surface-variant">友链暂时无法加载。</p>;
  if (!friends.length) return <p className="text-sm text-on-surface-variant">暂时还没有友链。</p>;

  return (
    <div className="editorial-data-list">
      {friends.map((friend, index) => (
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
