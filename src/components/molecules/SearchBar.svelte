<script lang="ts">
/**
 * M3E SearchBar — 导航栏折叠式玻璃搜索条分子。
 * 折叠时为 40px 放大镜按钮，点击后从按钮位置丝滑展开为玻璃搜索条
 * （宽度过渡 + cubic-bezier 曲线），Esc / 点击外部收起，收起后焦点归还放大镜。
 * value / expanded 可双向绑定，展开折叠交互细节内聚在此，
 * Search 有机体只负责搜索与结果下拉面板。
 */
import Icon from "@iconify/svelte";

let {
	value = $bindable(""),
	expanded = $bindable(false),
	id = "search-input",
	name = "search",
	placeholder = "",
	onfocus = () => {},
	oncollapse = () => {},
}: {
	value?: string;
	expanded?: boolean;
	id?: string;
	name?: string;
	placeholder?: string;
	onfocus?: () => void;
	oncollapse?: () => void;
} = $props();

let shellEl: HTMLDivElement | undefined = $state();
let toggleEl: HTMLButtonElement | undefined = $state();
let blurTimer: ReturnType<typeof setTimeout>;

const expand = (focusInput = true): void => {
	if (expanded) return;
	clearTimeout(blurTimer);
	expanded = true;
	window.dispatchEvent(new CustomEvent("nb:search-expanded"));
	if (focusInput) {
		// 等输入框宽度过渡/可聚焦后接管焦点（键盘可达）
		setTimeout(() => {
			document.getElementById(id)?.focus();
		}, 0);
	}
};

const collapse = (): void => {
	if (!expanded) return;
	expanded = false;
	oncollapse();
};

// 放大镜 = 开关：折叠时展开、展开时收起（顺带清掉失焦折叠定时器）
const toggle = (): void => {
	clearTimeout(blurTimer);
	if (expanded) collapse();
	else expand(true);
};
// 保留：点击放大镜在展开后等价于聚焦输入框

// 失焦后延迟折叠，允许搜索结果点击先执行
const handleBlur = (): void => {
	clearTimeout(blurTimer);
	blurTimer = setTimeout(() => {
		if (expanded) collapse();
	}, 250);
};

const handleFocus = (): void => {
	clearTimeout(blurTimer);
	onfocus();
};

// Esc 随时收起（输入框/放大镜上均生效）
function handleKeydown(event: KeyboardEvent): void {
	if (event.key === "Escape") {
		event.preventDefault();
		event.stopPropagation();
		collapse();
	}
}

// 语言切换面板打开时收起搜索（互斥，避免动画互相遮挡）
$effect(() => {
	const onTranslate = () => { if (expanded) collapse(); };
	window.addEventListener("nb:translate-opened", onTranslate);
	return () => window.removeEventListener("nb:translate-opened", onTranslate);
});

// 点击外部收起（展开期间监听，含 results 面板以外的任意位置）
$effect(() => {
	if (!expanded) return;
	const onDocClick = (event: MouseEvent) => {
		if (shellEl && !shellEl.contains(event.target as Node)) {
			clearTimeout(blurTimer);
			expanded = false;
			oncollapse();
		}
	};
	document.addEventListener("click", onDocClick);
	return () => document.removeEventListener("click", onDocClick);
});
</script>

<div id="search-bar" class="hidden lg:flex relative h-10 shrink-0 items-center">
    <div
        bind:this={shellEl}
        onmouseenter={() => { clearTimeout(blurTimer); expand(false); }}
        onmouseleave={() => {
          // 悬停离开即收起；仅当用户已输入内容（正在搜索）才保持
          const input = document.getElementById(id);
          if (input && input.value) return;
          blurTimer = setTimeout(() => { if (expanded) collapse(); }, 180);
        }}
        class="top-app-bar__search-shell m3-state-layer relative flex items-center overflow-hidden rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] h-10
               {expanded
                   ? 'top-app-bar__search-shell--expanded top-app-bar__search-shell--glass w-64'
                   : 'w-10'}"
        role="search"
    >
        <button
            bind:this={toggleEl}
            type="button"
            aria-label="Search"
            aria-expanded={expanded}
            onkeydown={handleKeydown}
            onclick={toggle}
            class="flex h-10 w-10 shrink-0 items-center justify-center text-[var(--on-surface)] transition-colors"
        >
            <Icon icon="material-symbols:search" class="pointer-events-none shrink-0 text-[1.25rem]"></Icon>
        </button>
        <input
            {id}
            {name}
            {placeholder}
            bind:value
            tabindex={expanded ? 0 : -1}
            aria-hidden={!expanded}
            onfocus={handleFocus}
            onblur={handleBlur}
            onkeydown={handleKeydown}
            class="h-full min-w-0 bg-transparent outline-0 text-(--on-surface) caret-(--primary) transition-all duration-200
                   {expanded ? 'w-[12.5rem] pl-1 pr-3 opacity-100' : 'w-0 px-0 opacity-0'}"
        />
    </div>
</div>

<style>
	/* 展开态 = 导航栏内玻璃搜索条（--nebula-* 令牌优先，回退同值） */
	.top-app-bar__search-shell--glass {
		background: var(--nebula-glass-fill, rgba(255, 255, 255, 0.08));
		border: 1px solid var(--nebula-glass-border, rgba(255, 255, 255, 0.12));
		backdrop-filter: blur(var(--nebula-glass-blur, 12px)) saturate(1.3);
		-webkit-backdrop-filter: blur(var(--nebula-glass-blur, 12px)) saturate(1.3);
	}
</style>
