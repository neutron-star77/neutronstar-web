import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../../lib/api/client";
import { useRealtimeRefresh } from "../../lib/realtime";

export interface NavigationItem {
  id: string;
  label: string;
  href?: string;
  visible?: boolean;
  target?: "_self" | "_blank";
  children?: NavigationItem[];
}

export const defaultNavigation: NavigationItem[] = [
  { id: "home", label: "首页", href: "/" },
  { id: "posts", label: "文章", href: "/posts" },
  { id: "archive", label: "归档", href: "/archive" },
  { id: "moments", label: "说说", href: "/moments" },
  { id: "albums", label: "相册", href: "/albums" },
  { id: "friends", label: "友链", href: "/friends" },
  { id: "messages", label: "杂谈", href: "/messages" },
  { id: "novel", label: "小说", href: "/novel" },
  { id: "about", label: "关于", href: "/about" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

interface Props {
  className?: string;
}

export default function NavigationIsland({ className = "" }: Props) {
  const [items, setItems] = useState(defaultNavigation);
  const [pathname, setPathname] = useState("/");

  const loadNavigation = useCallback(() => {
    fetch(`${API_BASE_URL}/api/site-config/navigation`, {
      headers: { Accept: "application/json" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (Array.isArray(value)) setItems(value);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setPathname(window.location.pathname);
    loadNavigation();
  }, [loadNavigation]);

  // P4 实时：后台改导航/站点配置 → 广播 nav 频道 → 菜单即时刷新（无需刷新页面）
  useRealtimeRefresh(["site-config"], loadNavigation);

  return (
    <nav
      className={`flex flex-1 items-center gap-1 overflow-x-auto text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      aria-label="主导航"
    >
      {items
        .filter((item) => item.visible !== false && item.href)
        .map((item) => (
          <div key={item.id} className="group relative shrink-0">
            <a
              href={item.href}
              target={item.target}
              rel={item.target === "_blank" ? "noreferrer" : undefined}
              aria-current={isActive(pathname, item.href!) ? "page" : undefined}
              className={[
                "block rounded-full px-3 py-1.5 hover:bg-surface-container",
                isActive(pathname, item.href!)
                  ? "bg-secondary-container font-medium text-on-surface"
                  : "text-on-surface-variant",
              ].join(" ")}
            >
              {item.label}
            </a>
            {item.children?.some((child) => child.visible !== false) && (
              <div className="invisible absolute left-0 top-full z-50 min-w-36 rounded-m3 bg-surface-container p-2 opacity-0 shadow-elevation-2 transition group-hover:visible group-hover:opacity-100">
                {item.children
                  .filter((child) => child.visible !== false && child.href)
                  .map((child) => (
                    <a
                      key={child.id}
                      href={child.href}
                      target={child.target}
                      rel={child.target === "_blank" ? "noreferrer" : undefined}
                      className="block rounded-m3-sm px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high"
                    >
                      {child.label}
                    </a>
                  ))}
              </div>
            )}
          </div>
        ))}
    </nav>
  );
}
