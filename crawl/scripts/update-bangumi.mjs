import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const API_BASE = "https://api.bgm.tv";
const API_HEADERS = {
	// Bangumi 官方文档要求所有请求携带 User-Agent
	"User-Agent": "bydbot-blog-bgm-sync/1.0 (https://github.com; bangumi data sync)",
};
// 数据仓库布局：crawl/scripts → data/（生成产物入库）、crawl/state/（增量状态入库）
const OUTPUT_FILE = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"../../data/bangumi-data.json",
);
const STATE_FILE = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"../state/.bangumi-state.json",
);

async function loadJsonOrNull(filePath) {
	try {
		return JSON.parse(await fs.readFile(filePath, "utf-8"));
	} catch {
		return null;
	}
}

async function loadState() {
	const raw = await loadJsonOrNull(STATE_FILE);
	return raw && typeof raw === "object" ? raw : {};
}

async function saveState(state) {
	await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
	await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

function extractSubjectId(entry) {
	return entry?.link?.match(/subject\/(\d+)/)?.[1] || null;
}

// 模拟延迟防止 API 限制
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchSubjectDetail(subjectId) {
	try {
		const response = await fetch(`${API_BASE}/v0/subjects/${subjectId}`, {
			headers: API_HEADERS,
		});
		if (!response.ok) return null;
		return await response.json();
	} catch (error) {
		return null;
	}
}

function getStudioFromInfobox(infobox) {
	if (!Array.isArray(infobox)) return "Unknown";

	const targetKeys = ["动画制作", "制作", "製作", "开发"];

	for (const key of targetKeys) {
		const item = infobox.find((i) => i.key === key);
		if (item) {
			if (typeof item.value === "string") {
				return item.value;
			}
			if (Array.isArray(item.value)) {
				const validItem = item.value.find((v) => v.v);
				if (validItem) return validItem.v;
			}
		}
	}
	return "Unknown";
}

async function fetchCollection(userId, type) {
	let allData = [];
	let offset = 0;
	const limit = 50;
	let hasMore = true;

	console.log(`Fetching type: ${type}...`);

	while (hasMore) {
		const url = `${API_BASE}/v0/users/${userId}/collections?subject_type=2&type=${type}&limit=${limit}&offset=${offset}`;
		try {
			const response = await fetch(url, { headers: API_HEADERS });

			if (!response.ok) {
				if (response.status === 404) {
					console.log(
						`   User ${userId} does not exist or has no data of this type.`,
					);
					return [];
				}
				throw new Error(`API Error ${response.status}`);
			}

			const data = await response.json();

			if (data.data && data.data.length > 0) {
				allData = [...allData, ...data.data];
				process.stdout.write(
					`   Fetched ${allData.length} records...\r`,
				);
			}

			if (!data.data || data.data.length < limit) {
				hasMore = false;
			} else {
				offset += limit;
				await delay(300);
			}
		} catch (e) {
			console.error(`\nFetch failed (Type ${type}):`, e.message);
			// 抓取失败视为致命错误：向上抛出，避免用不完整数据覆盖旧文件
			throw new Error(
				`Failed to fetch collections type ${type}: ${e.message}`,
			);
		}
	}
	console.log("");
	return allData;
}

async function processData(items, status, { oldById, state, forceFull }) {
	const results = [];
	let count = 0;
	const total = items.length;
	const stats = {
		added: 0,
		changed: 0,
		reused: 0,
		keptOldOnError: 0,
		skipped: 0,
	};

	for (const item of items) {
		count++;
		process.stdout.write(
			`[${status}] Processing progress: ${count}/${total} (${item.subject_id})\r`,
		);

		const id = String(item.subject_id);
		const oldEntry = oldById.get(id);
		const cachedUpdatedAt = state[id];

		// 时间戳未变：直接复用旧数据，不查详情（增量核心）
		if (!forceFull && oldEntry && cachedUpdatedAt === item.updated_at) {
			results.push(oldEntry);
			stats.reused++;
			continue;
		}

		const subjectDetail = await fetchSubjectDetail(item.subject_id);
		await delay(150);

		if (!subjectDetail) {
			// 详情失败：有旧数据则保留旧数据（本轮跳过更新），全新条目跳过，下次再补
			if (oldEntry) {
				results.push(oldEntry);
				stats.keptOldOnError++;
			} else {
				stats.skipped++;
			}
			continue;
		}

		const year = item.subject?.date
			? item.subject.date.slice(0, 4)
			: "Unknown";

		const rating = item.rate
			? Number.parseFloat(item.rate.toFixed(1))
			: item.subject?.score
				? Number.parseFloat(item.subject.score.toFixed(1))
				: 0;

		const progress = item.ep_status || 0;
		const totalEpisodes = item.subject?.eps || progress;

		const studio = getStudioFromInfobox(subjectDetail.infobox);

		const description = (
			subjectDetail?.summary ||
			item.subject?.short_summary ||
			item.subject?.name_cn ||
			""
		).trimStart();

		results.push({
			title:
				item.subject?.name_cn || item.subject?.name || "Unknown Title",
			status: status,
			rating: rating,
			cover: item.subject?.images?.medium || "/assets/anime/default.webp",
			description: description,
			episodes: `${totalEpisodes} episodes`,
			year: year,
			genre: item.subject?.tags
				? item.subject.tags.slice(0, 3).map((tag) => tag.name)
				: ["Unknown"],
			studio: studio,
			link: item.subject?.id
				? `https://bgm.tv/subject/${item.subject.id}`
				: "#",
			progress: progress,
			totalEpisodes: totalEpisodes,
			startDate: item.subject?.date || "",
			endDate: item.subject?.date || "",
		});

		if (oldEntry) stats.changed++;
		else stats.added++;
		state[id] = item.updated_at; // 更新成功才记录时间戳
	}
	console.log(`\n✓ Completed ${status} list processing`);
	return { results, stats };
}

async function main() {
	console.log("Initializing Bangumi data update script...");

	// 用户 ID 从环境变量读取（数据仓库不再依赖博客 siteConfig.ts）
	const USER_ID = process.env.BGM_USER_ID || "588237";
	console.log(`Read User ID: ${USER_ID}`);

		// 增量基线：旧数据文件（条目）+ 时间戳状态
		const oldList = await loadJsonOrNull(OUTPUT_FILE);
		const oldById = new Map();
		if (Array.isArray(oldList)) {
			for (const entry of oldList) {
				const id = extractSubjectId(entry);
				if (id) oldById.set(id, entry);
			}
		}
		const state = await loadState();
		const forceFull = process.argv.includes("--full");
		if (forceFull) {
			console.log("--full 模式：忽略增量缓存，全部重新抓取详情");
		} else {
			console.log(
				`增量基线：旧条目 ${oldById.size} 条 / 已缓存时间戳 ${Object.keys(state).length} 条`,
			);
		}

		const collections = [
			{ type: 3, status: "watching" },
			{ type: 1, status: "planned" },
			{ type: 2, status: "completed" },
			{ type: 4, status: "onhold" },
			{ type: 5, status: "dropped" },
		];

		let finalAnimeList = [];
		const allItems = [];
		const stats = {
			added: 0,
			changed: 0,
			reused: 0,
			keptOldOnError: 0,
			skipped: 0,
			removed: 0,
		};

		try {
			for (const c of collections) {
				const rawData = await fetchCollection(USER_ID, c.type);
				if (rawData.length > 0) {
					const { results, stats: s } = await processData(rawData, c.status, {
						oldById,
						state,
						forceFull,
					});
					finalAnimeList = [...finalAnimeList, ...results];
					allItems.push(...rawData);
					for (const key of Object.keys(s)) stats[key] += s[key];
				}
			}
		} catch (err) {
			// 抓取失败：保留原有数据文件和状态，不覆盖；构建继续（用旧数据部署），下次再试
			console.error("\n✘ Fetch failed, keeping existing data file unchanged.");
			console.error("  Reason:", err.message);
			return;
		}

		// 删除检测：本轮列表里未出现的旧条目 = 已取消收藏/移除
		const freshIds = new Set(allItems.map((i) => String(i.subject_id)));
		stats.removed = [...oldById.keys()].filter((id) => !freshIds.has(id)).length;

		const dir = path.dirname(OUTPUT_FILE);
		try {
			await fs.access(dir);
		} catch {
			await fs.mkdir(dir, { recursive: true });
		}

		await fs.writeFile(OUTPUT_FILE, JSON.stringify(finalAnimeList, null, 2));
		await saveState(state);
		console.log(`\nUpdate complete! Data saved to: ${OUTPUT_FILE}`);
		console.log(`Total collected: ${finalAnimeList.length} anime series`);
		console.log(
			`增量统计 → 新增 ${stats.added} · 变更 ${stats.changed} · 复用 ${stats.reused} · 失败保留旧 ${stats.keptOldOnError} · 跳过 ${stats.skipped} · 移除 ${stats.removed}`,
		);
	}

main().catch((err) => {
	console.error("\n✘ Script execution error:");
	console.error(err);
	process.exit(1);
});
