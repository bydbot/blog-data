#!/usr/bin/env node
/**
 * aggregate-bgm-timeline.mjs
 *
 * 读取 /home/sin/blog/bgm-timeline/data/timeline_*.json 中的 Bangumi 时间线原始记录，
 * 聚合成一个轻量索引文件：src/data/bgm-timeline.json
 *
 * 索引结构：
 *   {
 *     "byDate": {
 *       "2025-01-15": [
 *         { "sid": 363263, "nameCN": "Muv-Luv Alternative 第二季",
 *           "name": "マブラヴ オルタネイティヴ 第2期",
 *           "ep": 1, "time": 1767195214, "img": "https://lain.bgm.tv/r/100x100/pic/cover/l/c0/1c/363263_aP9c9.jpg" }
 *       ]
 *     },
 *     "stats": { "minYear": 2021, "maxYear": 2026, "totalDays": 1234, "totalEntries": 5505 }
 *   }
 *
 * 只保留 type=2（看番进度）的记录，过滤掉打分/收藏/吐槽等无关类型。
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// 数据仓库布局：crawl/scripts → crawl/data（时间线原始数据）、data/（生成产物）、api/（分页）
const SRC_DIR = join(__dirname, "..", "data");
const OUT_FILE = join(__dirname, "..", "..", "data", "bgm-timeline.json");
const OUT_FULL_FILE = join(__dirname, "..", "..", "data", "bgm-timeline-full.json");
const OUT_PAGE_DIR = join(__dirname, "..", "..", "data", "bgm-timeline");
const OUT_SUBJECTS = join(OUT_PAGE_DIR, "subjects.json");

// Astro 7.0.4 在 trailingSlash: "always" 下会给动态 endpoint 路径追加尾斜杠，
// 导致 [category]/[page].json 这类带固定后缀的路由 pattern 匹配失败（Missing parameter）。
// 因此分页 JSON 不再走 Astro 动态路由，直接镜像成 public/ 下的静态文件，前端 URL 不变。
const PUBLIC_PAGE_DIR = join(__dirname, "..", "..", "api", "bgm-timeline");

// 里程碑 collect 动作：完结态 + 进行态（决定是否富化完整字段）
const MILESTONE_ACTIONS = new Set([
	"看过", "玩过", "读过", "听过",
	"在看", "在读", "在玩", "在听",
]);

// 完整时间线顶部分页切片的每页条数
const PAGE_SIZE = 100;

/**
 * 从 subject.info 提取总话数，如 "14话 / 2026年4月2日 / ..." → 14
 */
function parseEpsFromInfo(info) {
	if (!info) return undefined;
	const m = String(info).match(/^(\d+)\s*话/);
	return m ? Number(m[1]) : undefined;
}

/**
 * 从一条原始记录里抽取最小条目（日历组件用）
 * 只关心 type=2（看过某话），progress.single 是单集进度
 */
function extractEntry(rec) {
	if (rec?.cat !== 4) return null;
	const m = rec.memo;
	if (!m?.progress?.single) return null;

	const { episode, subject } = m.progress.single;
	if (!subject) return null;

	const subjectId = subject.id;
	const images = subject.images || {};
	const img =
		images.grid ||
		images.small ||
		images.medium ||
		images.common ||
		images.large ||
		"";

	return {
		sid: subjectId,
		nameCN: subject.nameCN || "",
		name: subject.name || "",
		ep: episode?.sort ?? null,
		time: rec.createdAt,
		img,
	};
}

/**
 * 从一条原始记录里抽取完整条目（时间线页面用）
 * 根据 cat（一级分类）+ type（二级类型）正确映射事件
 *
 * cat=4: 进度管理 (progress)
 *   type=0: batch — 批量进度 (看到 X of Y 话)
 *   type=2: single — 单集进度 (看了第N话)
 *
 * cat=3: 条目收藏 (collect)
 *   type=1~14 映射到 想读/想看/想听/.../抛弃了
 */
function extractFullEntry(rec) {
	const cat = rec?.cat;
	const et = rec?.type;
	const m = rec?.memo;
	if (!m) return null;

	let subject = null;
	let entry = null;

	if (cat === 4) {
		// 进度管理
		if (m.progress?.batch) {
			subject = m.progress.batch.subject;
			entry = {
				et: "progress_batch",
				epsUpdate: m.progress.batch.epsUpdate || null,
				epsTotal: m.progress.batch.epsTotal || null,
			};
		} else if (m.progress?.single) {
			subject = m.progress.single.subject;
			const ep = m.progress.single.episode;
			entry = {
				et: "progress_single",
				ep: ep?.sort ?? null,
				epName: ep?.nameCN || ep?.name || "",
			};
		}
	} else if (cat === 3) {
		// 条目收藏
		const collectTypes = {
			1: "想读", 2: "想看", 3: "想听", 4: "想玩",
			5: "读过", 6: "看过", 7: "听过", 8: "玩过",
			9: "在读", 10: "在看", 11: "在听", 12: "在玩",
			13: "搁置了", 14: "抛弃了",
		};
		const action = collectTypes[et];
		if (!action) return null;
		// 取消在时间线中展示「在看」条目（批量加在看不会逐条生成时间线事件，
		// 数据不完整易误导），保留「看过」等确定性收藏事件
		if (action === "在看") return null;
		const s = m.subject?.[0];
		if (!s) return null;
		subject = s.subject;
		entry = {
			et: "collect",
			action,
			rate: s.rate || 0,
			comment: s.comment || "",
		};
		// 里程碑 collect 富化完整字段（metaTags + 总话数），简约行不富化以控制体积
		if (MILESTONE_ACTIONS.has(action)) {
			entry.metaTags = (subject.metaTags || []).slice(0, 3);
			entry.subjectEpsTotal = parseEpsFromInfo(subject.info);
		}
	}

	if (!subject || !entry) return null;

	const images = subject.images || {};
	const img =
		images.grid ||
		images.small ||
		images.medium ||
		images.common ||
		images.large ||
		"";

	return {
		sid: subject.id,
		name: subject.name || "",
		nameCN: subject.nameCN || "",
		st: subject.type || 0, // subject type: 1=book, 2=anime, 4=game, 6=real
		img,
		time: rec.createdAt,
		...entry,
	};
}

/**
 * 条目瘦身：移除作品公共字段（name/nameCN/st/img/metaTags/subjectEpsTotal），
 * 只保留 sid 引用 + 事件字段。作品公共字段统一收进 subjects.json 按 sid 存一份。
 */
function slimEntry(e) {
	const o = { sid: e.sid, time: e.time, et: e.et };
	if (e.ep != null) o.ep = e.ep;
	if (e.epName) o.epName = e.epName;
	if (e.epsUpdate != null) o.epsUpdate = e.epsUpdate;
	if (e.epsTotal != null) o.epsTotal = e.epsTotal;
	if (e.action) o.action = e.action;
	if (e.rate != null) o.rate = e.rate;
	if (e.comment) o.comment = e.comment;
	return o;
}

/**
 * 从完整条目里收集唯一作品表。
 * 同 sid 取首次出现的名称/图片；metaTags/subjectEpsTotal 只要任一条目带就补全
 *（因为瘦身后的条目不再携带这些字段，必须完整立到作品表）。
 */
function buildSubjects(fullEntries) {
	const subjects = new Map();
	for (const e of fullEntries) {
		let s = subjects.get(e.sid);
		if (!s) {
			s = { sid: e.sid, name: e.name || "", nameCN: e.nameCN || "", st: e.st || 0, img: e.img || "" };
			subjects.set(e.sid, s);
		}
		if (e.metaTags) s.metaTags = e.metaTags;
		if (e.subjectEpsTotal != null) s.subjectEpsTotal = e.subjectEpsTotal;
	}
	return subjects;
}

function main() {
	if (!existsSync(SRC_DIR)) {
		console.error(`[bgm-aggregate] 数据目录不存在: ${SRC_DIR}`);
		process.exit(1);
	}

	// 扫描 timeline_YYYY.json
	const files = readdirSync(SRC_DIR)
		.filter((f) => /^timeline_\d{4}\.json$/.test(f))
		.sort();

	if (files.length === 0) {
		console.error(`[bgm-aggregate] 未找到 timeline_*.json 文件`);
		process.exit(1);
	}

	const byDate = Object.create(null);
	const fullEntries = [];
	let totalEntries = 0;
	let minYear = Infinity;
	let maxYear = -Infinity;

	for (const f of files) {
		const path = join(SRC_DIR, f);
		console.log(`[bgm-aggregate] 读取 ${f}`);
		const raw = JSON.parse(readFileSync(path, "utf-8"));
		for (const rec of raw) {
			// 日历索引（仅 type=2）
			const entry = extractEntry(rec);
			if (entry) {
				// 按北京时间(UTC+8)归属日期，与时间线页面 dateKey() 的本地时区分组保持一致，
				// 避免凌晨 0-8 点的记录在日历(UTC)与时间线页(本地)之间错位一天。
				const d = new Date((entry.time + 8 * 3600) * 1000);
				const y = d.getUTCFullYear();
				const m = String(d.getUTCMonth() + 1).padStart(2, "0");
				const day = String(d.getUTCDate()).padStart(2, "0");
				const dateKey = `${y}-${m}-${day}`;

				if (!byDate[dateKey]) byDate[dateKey] = [];
				byDate[dateKey].push(entry);

				if (y < minYear) minYear = y;
				if (y > maxYear) maxYear = y;
				totalEntries++;
			}

			// 完整时间线（所有事件类型）
			const fullEntry = extractFullEntry(rec);
			if (fullEntry) {
				fullEntries.push(fullEntry);
			}
		}
	}

	// 每天按 time 升序
	for (const k of Object.keys(byDate)) {
		byDate[k].sort((a, b) => a.time - b.time);
	}

	const stats = {
		minYear: minYear === Infinity ? new Date().getFullYear() : minYear,
		maxYear: maxYear === -Infinity ? new Date().getFullYear() : maxYear,
		totalDays: Object.keys(byDate).length,
		totalEntries,
	};

	mkdirSync(dirname(OUT_FILE), { recursive: true });
	writeFileSync(
		OUT_FILE,
		JSON.stringify({ byDate, stats }, null, 0),
		"utf-8",
	);

	console.log(
		`[bgm-aggregate] 日历索引: ${totalEntries} 条 → ${Object.keys(byDate).length} 天，输出 ${OUT_FILE}`,
	);

	// 完整时间线：按时间降序（最新在前）
	fullEntries.sort((a, b) => b.time - a.time);

	const fullStats = {
		total: fullEntries.length,
		bySubjectType: {
			book: fullEntries.filter((e) => e.st === 1).length,
			anime: fullEntries.filter((e) => e.st === 2).length,
			music: fullEntries.filter((e) => e.st === 3).length,
			game: fullEntries.filter((e) => e.st === 4).length,
			real: fullEntries.filter((e) => e.st === 6).length,
		},
	};

	writeFileSync(
		OUT_FULL_FILE,
		JSON.stringify({ entries: fullEntries, stats: fullStats }, null, 0),
		"utf-8",
	);

	console.log(
		`[bgm-aggregate] 完整时间线: ${fullEntries.length} 条，输出 ${OUT_FULL_FILE}`,
	);

	// ─────────────────────────────────────────────────────────
	// 完整时间线：预切分页，按 全部/动画/游戏 各切一份，前端按需拉取单页
	// 数据结构优化：作品公共字段抽到 subjects.json 按 sid 存一份，
	// 分页条目只保留 sid 引用 + 事件字段，消除同作品多操作里的重复标题/封面。
	// ─────────────────────────────────────────────────────────
	const subjects = buildSubjects(fullEntries);
	const cats = {
		all: fullEntries.map(slimEntry),
		anime: fullEntries.filter((e) => e.st === 2).map(slimEntry),
		game: fullEntries.filter((e) => e.st === 4).map(slimEntry),
	};
	const manifest = { pageSize: PAGE_SIZE, categories: {} };

	for (const [cat, list] of Object.entries(cats)) {
		const pageCount = Math.ceil(list.length / PAGE_SIZE);
		const catDir = join(OUT_PAGE_DIR, cat);
		const pubCatDir = join(PUBLIC_PAGE_DIR, cat);
		mkdirSync(catDir, { recursive: true });
		mkdirSync(pubCatDir, { recursive: true });
		for (let p = 1; p <= pageCount; p++) {
			const chunk = list.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
			const pageJson = JSON.stringify(chunk, null, 0);
			writeFileSync(join(catDir, `page-${p}.json`), pageJson, "utf-8");
			writeFileSync(join(pubCatDir, `page-${p}.json`), pageJson, "utf-8");
		}
		manifest.categories[cat] = { pageCount, total: list.length };
		// 清理超出当前 pageCount 的残留旧分页文件（page 数会随数据增删变化），
		// 否则旧文件会继续被前端按 manifest 之外的路径读到，导致展示过期数据。
		for (const dir of [catDir, pubCatDir]) {
			for (const name of readdirSync(dir)) {
				const mm = /^page-(\d+)\.json$/.exec(name);
				if (mm && Number(mm[1]) > pageCount) {
					unlinkSync(join(dir, name));
				}
			}
		}
		console.log(
			`[bgm-aggregate] 分页 [${cat}]: ${list.length} 条 → ${pageCount} 页 @ ${OUT_PAGE_DIR}/${cat}`,
		);
	}

	// 作品表：按 sid 排序列出唯一一份
	const subjectsJson = JSON.stringify(
		[...subjects.values()].sort((a, b) => a.sid - b.sid),
		null,
		0,
	);
	writeFileSync(OUT_SUBJECTS, subjectsJson, "utf-8");
	console.log(
		`[bgm-aggregate] 作品表: ${subjects.size} 部 → ${OUT_SUBJECTS}`,
	);

	const manifestJson = JSON.stringify(manifest, null, 0);
	writeFileSync(
		join(OUT_PAGE_DIR, "page-manifest.json"),
		manifestJson,
		"utf-8",
	);
	console.log(`[bgm-aggregate] 分页 manifest 输出 ${join(OUT_PAGE_DIR, "page-manifest.json")}`);

	// 镜像到 public/（替代被移除的 Astro 动态 endpoint，前端请求路径不变）
	writeFileSync(join(PUBLIC_PAGE_DIR, "subjects.json"), subjectsJson, "utf-8");
	writeFileSync(join(PUBLIC_PAGE_DIR, "page-manifest.json"), manifestJson, "utf-8");
	console.log(`[bgm-aggregate] public 镜像输出 ${PUBLIC_PAGE_DIR}`);
}

main();