import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../lib/api/client";
import { defaultNavigation, type NavigationItem } from "./NavigationIsland";

/**
 * 移动端导航抽屉。
 *
 * 与桌面导航使用同一份后台 navigation JSON，支持：
 * - 一级菜单与二级 children；
 * - 内部/外部链接；
 * - 遮罩关闭与 body 滚动锁定。
 */
export default function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NavigationItem[]>(defaultNavigation);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/site-config/navigation`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (Array.isArray(value)) setItems(value);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const visibleItems = items.filter((item) => item.visible !== false && item.href);

  return (
    <>
      <button
        type="button"
        className="grid size-9 shrink-0 place-items-center rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container md:hidden"
        aria-label="打开导航菜单"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] md:hidden" role="dialog" aria-modal="true" aria-label="站点导航">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            aria-label="关闭导航菜单"
            onClick={() => setOpen(false)}
          />
          <aside className="relative ml-auto flex h-full w-[min(22rem,88vw)] flex-col border-l border-white/15 bg-surface/95 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-start justify-between border-b border-outline-variant/40 pb-5">
              <div>
                <p className="text-xs font-bold tracking-[0.22em] text-primary">NEUTRONSTAR</p>
                <p className="mt-2 text-sm text-on-surface-variant">星舰导航 · Personal archive</p>
              </div>
              <button
                type="button"
                className="grid size-9 place-items-center rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container"
                aria-label="关闭导航菜单"
                onClick={() => setOpen(false)}
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>

            <nav className="mt-6 flex flex-col gap-2" aria-label="移动端主导航">
              {visibleItems.map((item, index) => (
                <div key={item.id}>
                  <a
                    href={item.href}
                    target={item.target}
                    rel={item.target === "_blank" ? "noreferrer" : undefined}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between rounded-2xl px-4 py-3 text-base text-on-surface transition hover:bg-secondary-container"
                    style={{ animationDelay: `${index * 35}ms` }}
                  >
                    <span>{item.label}</span>
                    <span className="text-primary">↗</span>
                  </a>
                  {item.children?.filter((child) => child.visible !== false && child.href).map((child) => (
                    <a
                      key={child.id}
                      href={child.href}
                      target={child.target}
                      rel={child.target === "_blank" ? "noreferrer" : undefined}
                      onClick={() => setOpen(false)}
                      className="ml-5 block rounded-xl px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container"
                    >
                      {child.label}
                    </a>
                  ))}
                </div>
              ))}
            </nav>

            <div className="mt-auto rounded-2xl bg-primary-container p-4 text-sm text-on-primary-container">
              <p className="font-semibold">探索星舰日志</p>
              <p className="mt-1 text-xs opacity-80">文章、影像和正在发生的日常。</p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
