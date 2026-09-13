<script lang="ts">
/**
 * 顶栏整页翻译按钮（对齐 Twilight 的顶栏语言切换动线）。
 *
 * 底层 = translate.js v3.x（管雷鸣/xnx3，MIT），vendor 于 /public/translate.js，
 * 与 Twilight 的 src/plugins/translate.js 同源同款（客户端机翻，无需 API key）。
 *
 * 交互：按钮两态循环
 *   中文 → 点击：动态加载库（仅一次）→ 配置 → 整页翻到 English；swup/swup
 *          换页后的新内容由 listener 自动跟进翻译
 *   英文 → 点击：location.reload() 干净回到原文（translate.js 切回本地语种
 *          需强制 translateLocal，reload 更干净且重置一切状态）
 */
import Icon from "@iconify/svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";

type TranslateGlobal = {
	language: {
		setLocal: (lang: string) => void;
		setDefaultTo: (lang: string) => void;
	};
	selectLanguageTag: { show: boolean };
	listener: { start: () => void };
	changeLanguage: (lang: string) => void;
	ignore: { class: { data: string[] }; tag: string[] };
};

let active = $state(false);
let busy = $state(false);

async function ensureLib(): Promise<TranslateGlobal> {
	const w = window as unknown as { translate?: TranslateGlobal };
	if (w.translate) return w.translate;
	await new Promise<void>((resolve, reject) => {
		const s = document.createElement("script");
		s.src = "/translate.js";
		s.onload = () => resolve();
		s.onerror = () => reject(new Error("translate.js load failed"));
		document.head.appendChild(s);
	});
	if (!w.translate) throw new Error("translate.js unavailable");
	return w.translate;
}

async function toggle() {
	if (busy) return;
	busy = true;
	try {
		const t = await ensureLib();
		if (!active) {
			t.selectLanguageTag.show = false; // 不出现内置下拉，走顶栏按钮
			t.language.setLocal("chinese_simplified");
			t.language.setDefaultTo("english");
			t.ignore.class.data.push("notranslate"); // 代码块/公式等由 class 豁免
			t.ignore.tag.push("pre");
			t.ignore.tag.push("code");
			t.listener.start(); // swup 换页后自动翻译新渲染内容
			t.changeLanguage("english");
			active = true;
		} else {
			active = false;
			location.reload();
		}
	} catch {
		// 加载失败静默复位，不影响页面
		active = false;
	} finally {
		busy = false;
	}
}
</script>

<button
	type="button"
	class="m3-icon-button m3-icon-button--standard m3-icon-button--round m3-state-layer shrink-0 {active
		? 'text-[var(--primary)]'
		: ''}"
	aria-label={i18n(I18nKey.translatePage)}
	title={i18n(I18nKey.translatePage)}
	onclick={toggle}
>
	<Icon icon="material-symbols:translate" class="text-[1.25rem]"></Icon>
</button>
