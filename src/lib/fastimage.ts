/**
 * fastimage 两级派生（相册图床）：母片 URL（…/2026/08/xxx.webp）按目录约定
 * 派生 thumbs（列表）/ full（灯箱）两级变体；非图床 URL 原样返回（thumb=full=原 URL）。
 * 从 AlbumGrid.tsx 抽出共用：列表页封面 与 详情页瀑布流/灯箱都需要。
 */

const FASTIMAGE_RE = /^(https:\/\/(?:cdn|fastly|gcore)\.jsdelivr\.net\/gh\/neutron-star77\/fastimage@main\/2026\/08\/)(.+)$/;
const GCORE_BASE = "https://gcore.jsdelivr.net/gh/neutron-star77/fastimage@main/2026/08/";

export function deriveVariants(url: string): { thumb: string; full: string } | null {
  const m = url.match(FASTIMAGE_RE);
  if (!m) return null;
  return { thumb: `${GCORE_BASE}thumbs/${m[2]}`, full: `${GCORE_BASE}full/${m[2]}` };
}
