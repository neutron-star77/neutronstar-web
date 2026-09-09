/**
 * 统一动效变体 —— 供 React islands（motion）使用。
 *
 * 约定：
 * - 只动 transform / opacity，避免触发布局与重排（保 CLS）
 * - reduced-motion 由 motion 的 MotionConfig 统一降级，组件不各自判断
 * - 随机数（如卡片倾斜）必须由 id 确定性派生，禁止 Math.random()
 */
import type { Variants, Transition } from "motion/react";

export const spring: Record<"soft" | "snappy" | "card", Transition> = {
  soft: { type: "spring", stiffness: 120, damping: 20 },
  snappy: { type: "spring", stiffness: 300, damping: 25 },
  card: { type: "spring", stiffness: 300, damping: 25 },
};

/** 列表容器：子元素按顺序错开入场 */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

/** 通用上浮淡入 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

/** 卡片：轻微缩放 + 上浮 */
export const cardIn: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring.card },
};

/** 折叠容器（评论区、回复列表） */
export const collapse: Variants = {
  hidden: { height: 0, opacity: 0 },
  show: { height: "auto", opacity: 1, transition: { duration: 0.28, ease: "easeOut" } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
};

/**
 * 拍立得随机倾斜角（由 id 派生的确定性伪随机，±2.4°）
 * 与 Kirameku 的 PhotoCard 保持一致。
 */
export function tiltFromId(id: string, max = 2.4): number {
  const seed = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return (((seed % 7) - 3) / 3) * max;
}

/** 说说牌堆的固定倾斜序列（同日多条叠压时使用） */
export const stackRotations = [-2, 1.5, -1, 2, -1.5, 1, -0.5, 1.5];
