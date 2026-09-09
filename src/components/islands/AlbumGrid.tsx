/**
 * AlbumGrid —— 相册列表，React island（albums.astro 中 client:visible 水合）。
 *
 * 视觉/交互对齐原版 Xinghongia/Kirameku 的 /photowall：
 *  - AlbumCard：封面 3 张堆叠 → 悬停扇形展开（STACK_ANGLES → FAN_ANGLES）→ 点击内联高度展开照片墙
 *  - 展开后内部是拍立得风格 PhotoCard（白边 + 胶带 + 确定性倾斜 tiltFromId），点图进 Lightbox
 *  - 展开卡片占满整行（sm:col-span-2 lg:col-span-3），照片墙才够宽
 *
 * 数据来源：静态数据 web/src/data/albums.ts（鬼刀图床 jsDelivr 链接，6 册共 234 张），
 * 不走 bff（后端 albums 为空）。要接真实后端：把 albums 换成 useAlbums() 取回的数据即可。
 *
 * 二次开发提示：
 *  - 扇形角度：STACK_ANGLES / FAN_ANGLES / FAN_Y（本文件顶部常量）
 *  - 拍立得倾斜：tiltFromId(id)（variants.ts），按 id 确定性派生，禁止随机
 *  - 展开动画时长/缓动：AlbumCard 内 AnimatePresence 的 transition
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { albums } from "../../data/albums";
import { spring, tiltFromId } from "../../lib/variants";
import Lightbox, { type LightboxPhoto } from "./Lightbox";

interface AlbumPhoto {
  id: string;
  url: string;
  caption?: string;
}

// 封面堆叠（收起）角度 / 悬停扇形角度 / 扇形纵向偏移。索引对应封面第 i 张（上/中/下）。
const STACK_ANGLES = [-4, 0, 3];
const FAN_ANGLES = [-12, 0, 12];
const FAN_Y = [-4, -10, -4];

// 拍立得照片卡片：白底 + 底部留白 + 胶带 + 确定性倾斜 + 悬停回正放大
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
  const rotation = tiltFromId(photo.id); // 由 id 派生 ±2.4° 内的固定倾斜角

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: rotation * 2 }}
      animate={{ opacity: 1, y: 0, rotate: rotation }}
      transition={{ duration: 0.6, delay: index * 0.04, ease: "easeOut" }}
      whileHover={{
        rotate: 0,
        scale: 1.03,
        zIndex: 10,
        transition: { type: "spring", stiffness: 300, damping: 20 },
      }}
      onClick={onClick}
      className="group relative mb-3 cursor-pointer break-inside-avoid"
      style={{ transformOrigin: "center center" }}
    >
      {/* 拍立得白框（深色模式变深灰）+ 图片淡入 + 骨架占位 */}
      <div className="relative rounded-sm bg-white p-2 pb-6 shadow-lg transition-shadow duration-300 group-hover:shadow-2xl dark:bg-slate-800 dark:shadow-black/30">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[1px]">
          <img
            src={photo.url}
            alt={photo.caption || "照片"}
            loading="lazy"
            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setLoaded(true)}
          />
          {!loaded && (
            <div className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-slate-700" />
          )}
        </div>
        {photo.caption && (
          <div className="absolute bottom-1.5 left-0 right-0 text-center">
            <span className="font-serif text-xs italic text-slate-400 dark:text-slate-500">
              {photo.caption}
            </span>
          </div>
        )}
      </div>
      {/* 左上角胶带装饰 */}
      <div
        className="absolute -top-2 left-3 h-4 w-10 rotate-[-6deg] rounded-sm bg-amber-200/60 dark:bg-amber-300/30"
        style={{ backdropFilter: "blur(2px)" }}
      />
    </motion.div>
  );
}

function AlbumCard({
  album,
  isExpanded,
  onToggle,
  onPhotoClick,
}: {
  album: (typeof albums)[number];
  isExpanded: boolean;
  onToggle: () => void;
  onPhotoClick: (photos: LightboxPhoto[], index: number) => void;
}) {
  // 取前 3 张做封面，reverse 让「最上面」是最后一张（视觉更自然）
  const covers = album.photos.slice(0, 3).reverse();
  // 灯箱用的全量照片（按 index 当 id，caption 透传）
  const lightboxPhotos: LightboxPhoto[] = album.photos.map((p) => ({
    id: String(p.index),
    url: p.url,
    caption: p.caption,
  }));

  return (
    <div
      className="cursor-pointer select-none overflow-hidden rounded-3xl"
      onClick={onToggle}
    >
      <div className="relative px-4 pb-3 pt-4">
        {/* 封面堆叠区：rest=堆叠态，hover=扇形态（悬停或展开时触发） */}
        <motion.div
          className="relative mx-auto h-36 max-w-[200px]"
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
              <div className="relative h-full w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10">
                <img
                  src={photo.url}
                  alt={album.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            </motion.div>
          ))}
          <div className="absolute -bottom-2 right-0 z-20 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-on-primary shadow-lg">
            {album.photos.length} 张
          </div>
        </motion.div>

        <div className="mt-4 text-center">
          <h3 className="text-lg font-bold text-on-surface">{album.title}</h3>
          {album.description && (
            <p className="mt-1 text-xs text-on-surface-variant">{album.description}</p>
          )}
        </div>
      </div>

      {/* 内联展开：高度 0→auto 的缓动过渡，内部渲染照片墙 */}
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
            <div className="px-4 pb-6">
              {/* 照片墙网格：2 列(移动)/3 列(>=sm)；每张是拍立得 PhotoCard */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {album.photos.map((photo, idx) => (
                  <PhotoCard
                    key={photo.url}
                    photo={{ id: String(photo.index), url: photo.url, caption: photo.caption }}
                    index={idx}
                    onClick={() => onPhotoClick(lightboxPhotos, idx)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AlbumGrid() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: LightboxPhoto[]; index: number } | null>(
    null
  );

  if (albums.length === 0) {
    return <p className="text-sm text-on-surface-variant">还没有相册。</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {albums.map((album) => {
        const isExpanded = expandedId === album.id;
        return (
          // 展开时占满整行，照片墙才够宽
          <div key={album.id} className={isExpanded ? "sm:col-span-2 lg:col-span-3" : ""}>
            <AlbumCard
              album={album}
              isExpanded={isExpanded}
              onToggle={() => setExpandedId((prev) => (prev === album.id ? null : album.id))}
              onPhotoClick={(photos, index) => setLightbox({ photos, index })}
            />
          </div>
        );
      })}

      <Lightbox
        photos={lightbox?.photos ?? []}
        index={lightbox?.index ?? 0}
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        onPrev={() =>
          setLightbox((lb) =>
            lb ? { ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length } : null
          )
        }
        onNext={() =>
          setLightbox((lb) =>
            lb ? { ...lb, index: (lb.index + 1) % lb.photos.length } : null
          )
        }
      />
    </div>
  );
}
