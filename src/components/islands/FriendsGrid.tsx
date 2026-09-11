import { useEffect, useState } from "react";
import { apiGet } from "../../lib/api/client";

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

  useEffect(() => {
    apiGet<FriendLink[]>("/api/friend-links")
      .then(setFriends)
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="text-sm text-on-surface-variant">友链暂时无法加载。</p>;
  if (!friends.length) return <p className="text-sm text-on-surface-variant">暂时还没有友链。</p>;

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {friends.map((friend, index) => (
        <a
          key={friend.id}
          href={friend.url}
          target="_blank"
          rel="noreferrer"
          className="group rounded-m3 bg-surface-container p-5 shadow-elevation-1 transition hover:-translate-y-2 hover:rotate-0 hover:shadow-elevation-2"
          style={{ transform: `rotate(${[-1.5, 1, -0.75, 0.75][index % 4]}deg)` }}
        >
          <div className="flex items-center gap-3">
            {friend.avatar ? (
              <img src={friend.avatar} alt="" width="48" height="48" loading="lazy" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-container font-semibold text-on-primary-container">
                {friend.name.slice(0, 1)}
              </span>
            )}
            <strong className="text-on-surface">{friend.name}</strong>
          </div>
          <p className="mt-5 text-sm text-on-surface-variant">{friend.description}</p>
          <span className="mt-4 block text-xs text-primary opacity-0 transition group-hover:opacity-100">
            访问站点 →
          </span>
        </a>
      ))}
    </div>
  );
}
