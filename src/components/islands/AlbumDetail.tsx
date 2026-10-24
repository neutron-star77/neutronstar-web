/**
 * AlbumDetail —— 瑶影相册详情照片墙 island（albums/[slug].astro，client:load）。
 *
 * Nebula 复刻（参考 blog.starlitn.top 相册详情）：
 *  - 头部（返回按钮 + 相册名 + 描述）由 [slug].astro 静态输出（getStaticPaths 已有数据）
 *  - 本组件只负责照片墙：CSS columns 瀑布流（1→2→3 列自适应），
 *    图片圆角、逐张交错淡入；点击开灯箱（复用本地 Lightbox，行为与原 PhotoCard 一致）
 *
 * 数据链路不变：useSWR("/api/albums/{id}/photos")（原 AlbumGrid.useAlbumPhotos 同款）
 * + SSE 实时刷新；图床 thumbs/full 两级派生见 lib/fastimage。
 */

import { useState } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { useRealtimeRefresh } from "../../lib/realtime";
import { apiGet } from "../../lib/api/client";
import { deriveVariants } from "../../lib/fastimage";
import Lightbox, { type LightboxPhoto } from "./Lightbox";

interface AlbumPhoto {
  id: string;
  url: string;
  caption?: string;
}

export default function AlbumDetail({ albumId }: { albumId: number }) {
  const { data: photos, isLoading } = useSWR<AlbumPhoto[]>(
    ["album-photos", albumId],
    async ([, id]) => {
      const rows = await apiGet<{ id: number; url: string; caption: string }[]>(
        `/api/albums/${id}/photos`
      );
      return (rows ?? []).map((p) => ({
        id: String(p.id),
        url: p.url,
        caption: p.caption || undefined,
      }));
    },
    { revalidateOnFocus: false }
  );
  useRealtimeRefresh(["album-photos"]);

  const [lightbox, setLightbox] = useState<{ photos: LightboxPhoto[]; index: number } | null>(null);

  const lightboxPhotos: LightboxPhoto[] = (photos ?? []).map((p) => ({
    id: p.id,
    url: deriveVariants(p.url)?.full ?? p.url,
    caption: p.caption,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 md:py-28" role="status" aria-label="加载中">
        <div className="w-7 h-7 border-2 border-[var(--nebula-cyan)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!photos || photos.length === 0) {
    return (
      <p className="text-center py-16 text-sm text-[color:var(--nebula-ink-muted)] [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
        相册里还没有照片
      </p>
    );
  }

  return (
    <>
      {/* CSS columns 瀑布流：1 → 2 → 3 列自适应 */}
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
        {photos.map((photo, index) => {
          const variants = deriveVariants(photo.url);
          return (
            <motion.figure
              key={photo.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -40px 0px" }}
              transition={{ duration: 0.5, delay: (index % 6) * 0.07, ease: "easeOut" }}
              className="m-0 mb-4 break-inside-avoid group cursor-pointer"
              onClick={() => setLightbox({ photos: lightboxPhotos, index })}
            >
              <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.12)] shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
                <img
                  src={variants?.thumb ?? photo.url}
                  srcSet={variants ? `${variants.thumb} 800w, ${variants.full} 1600w, ${photo.url} 1920w` : undefined}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  alt={photo.caption || "相册照片"}
                  loading="lazy"
                  className="w-full h-auto block transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              </div>
              {photo.caption && (
                <figcaption className="mt-1.5 text-xs text-[color:var(--nebula-ink-muted)] [text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">
                  {photo.caption}
                </figcaption>
              )}
            </motion.figure>
          );
        })}
      </div>

      {lightbox && (
        <Lightbox
          photos={lightbox.photos}
          index={lightbox.index}
          open={true}
          onClose={() => setLightbox(null)}
          onPrev={() =>
            setLightbox((prev) =>
              prev
                ? { ...prev, index: (prev.index - 1 + prev.photos.length) % prev.photos.length }
                : prev
            )
          }
          onNext={() =>
            setLightbox((prev) =>
              prev ? { ...prev, index: (prev.index + 1) % prev.photos.length } : prev
            )
          }
        />
      )}
    </>
  );
}
