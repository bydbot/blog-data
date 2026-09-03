/**
 * 将 collections.json 转换为 Mizuki 的 bangumi-data.json 格式
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 数据仓库布局：crawl/scripts → ../data/collections.json（爬虫兜底源）、../../data/（产物）
const INPUT = path.join(__dirname, "../data/collections.json");
const OUTPUT = path.join(__dirname, "../../data/bangumi-data.json");

const TYPE_MAP = {
  1: "planned",    // 想看
  2: "completed",  // 看过
  3: "watching",   // 在看
  4: "onhold",     // 搁置
  5: "dropped",    // 抛弃
};

const collections = JSON.parse(fs.readFileSync(INPUT, "utf-8"));

const bangumiData = collections.map((c) => ({
  title: c.name_cn || c.name || "Unknown",
  status: TYPE_MAP[c.type] || "planned",
  rating: c.rate || 0,
  cover: c.img ? c.img.replace("/r/100/", "/r/400/") : "",
  description: c.comment || "",
  episodes: `${c.eps || 0} episodes`,
  year: "",
  genre: [],
  studio: "",
  link: `https://bgm.tv/subject/${c.sid}`,
  progress: c.ep_status || 0,
  totalEpisodes: c.eps || 0,
  startDate: "",
  endDate: "",
}));

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(bangumiData, null, 2));

console.log(`转换完成：${bangumiData.length} 条`);
console.log(`输出：${OUTPUT}`);

// 统计
const stats = { watching: 0, completed: 0, planned: 0, onhold: 0, dropped: 0 };
bangumiData.forEach((a) => stats[a.status]++);
console.log(stats);
