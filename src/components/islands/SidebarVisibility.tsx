import { useEffect } from "react";
import { API_BASE_URL } from "../../lib/api/client";

const defaults = {
  author: true,
  explore: true,
  announcement: true,
  categories: true,
  tags: true,
  calendar: true,
};

/**
 * 侧边栏卡片可见性控制器。
 *
 * 侧栏主体仍由 Astro 静态输出，保证无 JS 时也有完整内容；
 * 本 island 只负责读取后台配置并给 data-sidebar-widget 节点设置 hidden。
 * 这样修改开关不需要重新构建 Pages，适合后台实时生效。
 */
export default function SidebarVisibility() {
  useEffect(() => {
    const apply = (value: unknown) => {
      const settings = { ...defaults, ...(value && typeof value === "object" ? value : {}) } as Record<
        string,
        boolean
      >;
      document.querySelectorAll<HTMLElement>("[data-sidebar-widget]").forEach((element) => {
        const key = element.dataset.sidebarWidget || "";
        element.hidden = settings[key] === false;
      });
    };

    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/site-config/sidebar_widgets`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : defaults))
      .then(apply)
      .catch(() => apply(defaults));

    return () => controller.abort();
  }, []);

  return null;
}
