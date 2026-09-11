import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../lib/api/client";

interface MusicConfig {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  url?: string;
}

export default function MusicFloatingCard() {
  const [config, setConfig] = useState<MusicConfig | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/site-config/music_widget`, {
      headers: { Accept: "application/json" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (value && typeof value === "object") setConfig(value);
      })
      .catch(() => undefined);
  }, []);

  if (!config?.enabled || !open) return null;

  return (
    <aside className="fixed bottom-4 right-4 z-30 w-64 rounded-m3-lg bg-surface-container p-4 shadow-elevation-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <strong className="block text-sm text-on-surface">{config.title ?? "音乐"}</strong>
          <span className="mt-1 block text-xs text-on-surface-variant">
            {config.subtitle ?? "悬浮播放器"}
          </span>
        </div>
        <button
          type="button"
          className="rounded-full px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high"
          onClick={() => setOpen(false)}
          aria-label="关闭音乐卡片"
        >
          关闭
        </button>
      </div>
      {config.url && (
        <a
          className="mt-3 inline-block text-xs text-primary underline-offset-4 hover:underline"
          href={config.url}
          target="_blank"
          rel="noreferrer"
        >
          打开音乐
        </a>
      )}
    </aside>
  );
}
