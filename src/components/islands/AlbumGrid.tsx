/**
 * AlbumGrid —— 照片墙 React island（albums.astro，client:visible）。
 *
 * 1:1 对齐 Xinghongia/Kirameku 的 app/photowall/page.tsx + components/photos/*：
 *  - AlbumCard：封面 3 张堆叠（STACK_ANGLES）→ 悬停/展开扇子（FAN_ANGLES/FAN_Y）
 *  - 点击内联展开（height 0→auto），展开卡占满整行（lg:col-span-3）
 *  - 拍立得 PhotoCard（白底 + 胶带 + id 确定性倾角），点外部收起
 *  - 灯箱复用本地 Lightbox（键盘/滑动/spring 缩放与参考一致）
 *
 * 数据：相册列表 useSWR("/api/albums")，照片墙懒加载 /api/albums/{id}/photos。
 * 图床：fastimage 两级派生（thumbs 列表 / full 灯箱），非图床 URL 原样返回。
 */

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "motion/react";
import { spring } from "../../lib/variants";
import { useRealtimeRefresh } from "../../lib/realtime";
import { apiGet } from "../../lib/api/client";
import type { Album } from "../../lib/api/types";
import Lightbox, { type LightboxPhoto } from "./Lightbox";

interface AlbumPhoto {
  id: string;
  url: string;
  caption?: string;
  orientation: "landscape" | "portrait";
}

/* fastimage 两级派生：母片 URL（…/2026/08/xxx.webp）按目录约定派生 thumbs/full */
const FASTIMAGE_RE = /^(https:\/\/(?:cdn|fastly|gcore)\.jsdelivr\.net\/gh\/neutron-star77\/fastimage@main\/2026\/08\/)(.+)$/;
const GCORE_BASE = "https://gcore.jsdelivr.net/gh/neutron-star77/fastimage@main/2026/08/";
function deriveVariants(url: string): { thumb: string; full: string } | null {
  const m = url.match(FASTIMAGE_RE);
  if (!m) return null;
  return { thumb: `${GCORE_BASE}thumbs/${m[2]}`, full: `${GCORE_BASE}full/${m[2]}` };
}

function useAlbumPhotos(albumId: number) {
  return useSWR<AlbumPhoto[]>(
    ["album-photos", albumId],
    async ([, id]) => {
      const rows = await apiGet<{ id: number; url: string; caption: string; orientation?: string }[]>(
        `/api/albums/${id}/photos`
      );
      return (rows ?? []).map((p) => ({
        id: String(p.id),
        url: p.url,
        caption: p.caption || undefined,
        orientation: p.orientation === "portrait" ? "portrait" : "landscape",
      }));
    },
    { revalidateOnFocus: false }
  );
}

/* 封面堆叠（收起）角度 / 悬停扇子角度 / 扇子纵向偏移，索引对应封面第 i 张（上中下） */
const STACK_ANGLES = [-4, 0, 3];
const FAN_ANGLES = [-12, 0, 12];
const FAN_Y = [-4, -10, -4];

function photoTilt(id: string): number {
  const seed = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return ((seed % 7) - 3) * 0.8;
}

const CameraIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

/* ── 拍立得照片卡 ── */
function PhotoCard({
  photo,
  index,
  onClick,
}: {
  photo: AlbumPhoto;
  index: number;
  onClick: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const rotation = photoTilt(photo.id);
  const isLandscape = photo.orientation === "landscape";
  const variants = deriveVariants(photo.url);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: rotation * 2 }}
      animate={{ opacity: 1, y: 0, rotate: rotation }}
      transition={{ duration: 0.6, delay: index * 0.06, ease: "easeOut" }}
      whileHover={{
        rotate: 0,
        scale: 1.03,
        zIndex: 10,
        transition: { type: "spring", stiffness: 300, damping: 20 },
      }}
      onClick={onClick}
      className="relative cursor-pointer group break-inside-avoid mb-3 md:mb-5"
      style={{ transformOrigin: "center center" }}
    >
      <div className="relative bg-white dark:bg-slate-800 p-2 pb-6 md:p-2.5 md:pb-8 rounded-sm shadow-lg dark:shadow-black/30 group-hover:shadow-2xl transition-shadow duration-300">
        <div className={`relative overflow-hidden rounded-[1px] ${isLandscape ? "aspect-[4/3]" : "aspect-[4/5]"}`}>
          <img
            src={variants?.thumb ?? photo.url}
            srcSet={variants ? `${variants.thumb} 800w, ${variants.full} 1600w, ${photo.url} 1920w` : undefined}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            alt={photo.caption || "照片"}
            loading="lazy"
            className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setLoaded(true)}
          />
          {!loaded && (
            <div className={`absolute inset-0 w-full bg-slate-200 dark:bg-slate-700 animate-pulse ${isLandscape ? "aspect-[4/3]" : "aspect-[3/4]"}`} />
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
        </div>
        {photo.caption && (
          <div className="absolute bottom-1.5 left-0 right-0 text-center">
            <span className="text-xs text-slate-400 dark:text-slate-500 font-serif italic tracking-wide">
              {photo.caption}
            </span>
          </div>
        )}
      </div>
      {/* 胶带装饰 */}
      <div
        className="absolute -top-2 left-2 md:left-3 w-8 h-3 md:w-10 md:h-4 bg-amber-200/60 dark:bg-amber-300/30 rounded-sm rotate-[-6deg] pointer-events-none"
        style={{ backdropFilter: "blur(2px)" }}
      />
    </motion.div>
  );
}

/* ── 相册卡 ── */
function AlbumCard({
  album,
  isExpanded,
  onToggle,
  onPhotoClick,
}: {
  album: Album;
  isExpanded: boolean;
  onToggle: () => void;
  onPhotoClick: (photos: LightboxPhoto[], index: number) => void;
}) {
  const { data: photos } = useAlbumPhotos(album.id);

  // 前 3 张做封面，reverse 让「最上面」是最后一张（视觉更自然）
  const covers = (
    photos && photos.length > 0
      ? photos.slice(0, 3).reverse()
      : [{ id: `cover-${album.id}`, url: album.cover, orientation: "landscape" as const }]
  ) as AlbumPhoto[];

  const lightboxPhotos: LightboxPhoto[] = (photos ?? []).map((p) => ({
    id: p.id,
    url: deriveVariants(p.url)?.full ?? p.url,
    caption: p.caption,
  }));
  const photoCount = photos?.length ?? album.photo_count;

  return (
    <div className="rounded-3xl overflow-hidden cursor-pointer select-none" onClick={onToggle}>
      <div className="relative px-4 pt-4 pb-3 md:px-6 md:pt-6 md:pb-4">
        <motion.div
          className="relative h-36 md:h-48 mx-auto max-w-[200px] md:max-w-[260px]"
          initial="rest"
          animate={isExpanded ? "hover" : "rest"}
          whileHover="hover"
        >
          {covers.map((photo, i) => (
            <motion.div
              key={photo.url}
              className="absolute inset-0"
              style={{ zIndex: i + 1 }}
              variants={{
                rest: {
                  rotate: STACK_ANGLES[i] ?? 0,
                  y: i * 12,
                  scale: 1 - i * 0.04,
                  zIndex: i + 1,
                },
                hover: {
                  rotate: FAN_ANGLES[i] ?? 0,
                  y: FAN_Y[i] ?? 0,
                  scale: i === 1 ? 1 : 0.95,
                },
              }}
              transition={spring.card}
            >
              <div className="relative w-full h-full rounded-xl overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/10">
                <img
                  src={deriveVariants(photo.url)?.thumb ?? photo.url}
                  alt={photo.caption || album.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
            </motion.div>
          ))}
          <div className="absolute -bottom-2 right-0 z-20 px-2 py-0.5 md:px-2.5 rounded-full bg-sky-500 text-white text-[10px] md:text-xs font-bold shadow-lg shadow-sky-500/30">
            {photoCount} 张
          </div>
        </motion.div>

        <div className="mt-4 md:mt-6 text-center">
          <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">{album.title}</h3>
          {album.description && (
            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">{album.description}</p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="overflow-hidden"
          >
            <div className="px-4 pb-6 md:px-6">
              <div className="p-4 md:p-6 rounded-2xl">
                {photos ? (
                  photos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-5">
                      {photos.map((photo, photoIndex) => (
                        <PhotoCard
                          key={photo.id}
                          photo={photo}
                          index={photoIndex}
                          onClick={() => onPhotoClick(lightboxPhotos, photoIndex)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-slate-400 py-8">相册里还没有照片</p>
                  )
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotos, setCurrentPhotos] = useState<LightboxPhoto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const expandedRef = useRef<HTMLDivElement>(null);

  // 点外部收起（灯箱打开时不处理）
  useEffect(() => {
    if (expandedId === null) return;
    const handler = (e: MouseEvent) => {
      if (lightboxOpen) return;
      if (expandedRef.current && !expandedRef.current.contains(e.target as Node)) {
        setExpandedId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expandedId, lightboxOpen]);

  const openLightbox = (photos: LightboxPhoto[], index: number) => {
    setCurrentPhotos(photos);
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* 页头 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 md:mb-10"
      >
        <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
          <CameraIcon className="w-5 h-5 md:w-7 md:h-7 text-sky-500" />
          <h1 className="text-xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">照片墙</h1>
        </div>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 ml-7 md:ml-10">
          用镜头记录生活的每一个瞬间
        </p>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 md:py-32">
          <div className="w-6 h-6 md:w-8 md:h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !albums || albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 md:py-32 text-slate-400">
          <CameraIcon className="w-10 h-10 md:w-12 md:h-12 mb-4 opacity-40" />
          <p className="text-sm md:text-base">暂无照片</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 select-none">
          {albums.map((album, albumIndex) => {
            const isExpanded = expandedId === album.id;
            const isHidden = expandedId !== null && !isExpanded;
            return (
              <AnimatePresence key={album.id}>
                {!isHidden && (
                  <motion.div
                    layout
                    initial={expandedId === null ? { opacity: 0, y: 30 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: expandedId === null ? albumIndex * 0.1 : 0 }}
                    className={isExpanded ? "sm:col-span-2 lg:col-span-3" : ""}
                  >
                    <div ref={isExpanded ? expandedRef : undefined}>
                      <AlbumCard
                        album={album}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedId((prev) => (prev === album.id ? null : album.id))}
                        onPhotoClick={openLightbox}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            );
          })}
        </div>
      )}

      <Lightbox
        photos={currentPhotos}
        index={currentIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onPrev={() => setCurrentIndex((i) => (i - 1 + currentPhotos.length) % currentPhotos.length)}
        onNext={() => setCurrentIndex((i) => (i + 1) % currentPhotos.length)}
      />
    </div>
  );
}
