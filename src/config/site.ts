export interface NavItem {
  label: string;
  href: string;
}

export const site = {
  name: "NeutronStar",
  /** 首页 Hero 的大写字标 */
  wordmark: "NEUTRONSTAR",
  /** 站点副标题（Shirone 风格：一句英文/中文描述） */
  tagline: "A visual archive of technology, moments and passing days.",
  description: "星舰之上的技术与生活",
  author: {
    name: "Starhiro",
    bio: "在星舰上写代码、拍照片、记录日常。",
    avatar: "/avatar.svg",
  },
  nav: [
    { label: "文章", href: "/archive" },
    { label: "说说", href: "/moments" },
    { label: "相册", href: "/albums" },
    { label: "杂谈", href: "/messages" },
    { label: "关于", href: "/about" },
  ] satisfies NavItem[],
  social: [
    { label: "GitHub", href: "https://github.com/neutron-star77", icon: "github" },
    { label: "RSS", href: "/rss.xml", icon: "rss" },
  ],
  /** 建站时间，用于「已运行 N 天」 */
  since: "2026-05-07",
} as const;
