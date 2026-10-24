/**
 * AlbumGrid —— 瑶影相册列表 React island（albums.astro，client:visible）。
 *
 * Nebula 复刻（参考 blog.starlitn.top 瑶影页）：
 *  - 相册卡网格（1-3 列自适应）：每张卡 = 封面大图（圆角、hover 轻缩放 + 右下角
 *    「N 张」玻璃角标）+ 卡下相册名与日期（壁纸上直接排版，文字带投影）
 *  - 点击相册卡跳转详情页 /albums/{slug}（slug 与 [slug].astro getStaticPaths 同源）
 *  - 页头（kicker + 超大标题「瑶影」+ 副标题）由 albums.astro 静态输出，不在 island 内
 *
 * 数据链路不变：useSWR("/api/albums") + SSE 实时刷新；图床 thumbs 派生见 lib/fastimage。
 */

import useSWR from "swr";
import { motion } from "motion/react";
import { useRealtimeRefresh } from "../../lib/realtime";
import { apiGet } from "../../lib/api/client";
import { deriveVariants } from "../../lib/fastimage";
import { albumSlug } from "../../lib/album-slug";
import type { Album } from "../../lib/api/types";

const CameraIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

function formatAlbumDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export default function AlbumGrid() {
  const { data: albums, isLoading } = useSWR<Album[]>(
    ["albums"],
    async () => {
      const list = await apiGet<Album[]>("/api/albums");
      return (list ?? []).sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    },
    { revalidateOnFocus: false }
  );
  useRealtimeRefresh(["albums", "album-photos"]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 md:py-32" role="status" aria-label="加载中">
        <div className="w-7 h-7 border-2 border-[var(--nebula-cyan)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!albums || albums.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 md:py-32 text-[color:var(--nebula-ink-muted)]">
        <CameraIcon className="w-10 h-10 md:w-12 md:h-12 mb-4 opacity-40" />
        <p className="text-sm md:text-base [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">暂无相册</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
      {albums.map((album, index) => {
        const cover = deriveVariants(album.cover)?.thumb ?? album.cover;
        return (
          <motion.a
            key={album.id}
            href={`/albums/${albumSlug(album)}`}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -60px 0px" }}
            transition={{ duration: 0.5, delay: (index % 3) * 0.08, ease: "easeOut" }}
            className="group block no-underline"
            aria-label={`相册：${album.title}`}
          >
            {/* 封面大图：圆角 + hover 轻缩放 */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] border border-[rgba(255,255,255,0.12)] shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
              <img
                src={cover}
                alt={album.title}
                loading={index < 3 ? "eager" : "lazy"}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(5,6,15,0.35)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="absolute bottom-2.5 right-2.5 z-10 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-[color:var(--nebula-ink)] bg-[rgba(10,14,28,0.6)] border border-[rgba(255,255,255,0.14)] backdrop-blur-md">
                {album.photo_count} 张
              </span>
            </div>

            {/* 卡下相册名与日期：壁纸上直接排版，文字带投影 */}
            <div className="mt-3.5 px-0.5">
              <h2 className="m-0 text-base md:text-lg font-bold text-[color:var(--nebula-ink)] [text-shadow:0_1px_8px_rgba(0,0,0,0.6)] transition-colors duration-300 group-hover:text-[color:var(--nebula-cyan)]">
                {album.title}
              </h2>
              <p className="mt-1 text-xs text-[color:var(--nebula-ink-muted)] [text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">
                {formatAlbumDate(album.updated_at)}
              </p>
            </div>
          </motion.a>
        );
      })}
    </div>
  );
}
