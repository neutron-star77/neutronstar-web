/**
 * 相册静态数据源。
 * 图片来自「鬼刀图床」(neutron-star77/fastimage)，经 jsDelivr 全球 CDN 分发，
 * 长边 1920 / webp q82，共 234 张（433.webp – 666.webp）。
 * 后端 albums 接口暂无数据，故相册走前端静态数据（不走 bff）。
 */

const CDN_BASE =
  "https://cdn.jsdelivr.net/gh/neutron-star77/fastimage@main/2026/08/";
const START = 433;
const END = 666; // 含端点，共 234 张

const ALL = Array.from(
  { length: END - START + 1 },
  (_, i) => `${CDN_BASE}${START + i}.webp`
);

const CN_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

export interface AlbumPhoto {
  url: string;
  index: number;
}

export interface AlbumData {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover: string;
  photos: AlbumPhoto[];
}

const PER_ALBUM = 39; // 234 / 6 = 39

export const albums: AlbumData[] = Array.from({ length: 6 }, (_, a) => {
  const slice = ALL.slice(a * PER_ALBUM, (a + 1) * PER_ALBUM);
  const from = START + a * PER_ALBUM;
  const to = START + (a + 1) * PER_ALBUM - 1;
  return {
    id: String(a + 1),
    slug: `guidao-${a + 1}`,
    title: `鬼刀图集 · 其${CN_NUM[a]}`,
    description: `鬼刀背景图 ${from}–${to}`,
    cover: slice[0],
    photos: slice.map((url, i) => ({ url, index: a * PER_ALBUM + i + 1 })),
  };
});

export function getAlbum(slug: string): AlbumData | undefined {
  return albums.find((x) => x.slug === slug);
}
