// 一次性：把 navIconLibrary 里新增的 material-symbols 图标合并进
// src/generated/local-icon-collections.ts 已有的 material-symbols 集合（幂等）。
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const target = join(root, "src", "generated", "local-icon-collections.ts");

// 需要补齐的图标（与 web/src/config/navIconLibrary.ts 对齐，去掉 material-symbols: 前缀）
const newIcons = [
	"apps","archive-outline-rounded","call","cloud-outline",
	"deployed-code","favorite-outline-rounded","groups-rounded",
	"info-outline-rounded","language","library-books-outline-rounded","mail-outline-rounded",
	"map-outline-rounded","menu-book-outline-rounded","movie-outline-rounded",
	"music-note","notifications-outline-rounded","person-outline-rounded",
	"photo-camera-outline-rounded","podcasts-rounded","rss-feed-rounded","settings-outline-rounded",
	"share","star-outline-rounded","timeline","waving-hand-rounded",
];

const iconsJson = JSON.parse(
	readFileSync(join(root, "node_modules", "@iconify-json", "material-symbols", "icons.json"), "utf8"),
);

let src = readFileSync(target, "utf8");
// 找到 material-symbols 集合对象（单行 JSON），解析后合并
const marker = '{"prefix":"material-symbols"';
const start = src.indexOf(marker);
if (start === -1) throw new Error("material-symbols collection not found");
// 该集合是数组里的一个元素，后面紧跟 ",\n" 或 "\n]"
const after = src.slice(start);
// 从 marker 开始做括号扫描，找到这个 JSON 对象的真正结束位置
let depth = 0, inStr = false, esc = false, end = -1;
for (let i = 0; i < after.length; i++) {
	const c = after[i];
	if (inStr) {
		if (esc) esc = false;
		else if (c === "\\") esc = true;
		else if (c === '"') inStr = false;
		continue;
	}
	if (c === '"') inStr = true;
	else if (c === "{" || c === "[") depth++;
	else if (c === "}" || c === "]") {
		depth--;
		if (depth === 0) { end = i + 1; break; }
	}
}
if (end === -1) throw new Error("collection end not found");
const collectionText = after.slice(0, end).replace(/,?$/, "");

const collection = JSON.parse(collectionText);
const before = Object.keys(collection.icons).length;
let added = 0;
const missing = [];
for (const name of newIcons) {
	if (collection.icons[name]) continue;
	if (iconsJson.icons?.[name]) {
		collection.icons[name] = iconsJson.icons[name];
		added++;
	} else {
		missing.push(name);
	}
}
const newCollectionText = JSON.stringify(collection);
src = src.slice(0, start) + newCollectionText + after.slice(end);
writeFileSync(target, src);
console.log(`icons before=${before}, added=${added}, after=${Object.keys(collection.icons).length}`);
if (missing.length) console.log("missing:", missing.join(", "));
