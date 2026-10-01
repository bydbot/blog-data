// 碎碎念数据
// 轻量短内容流：无标题、一两句话、想到就发，区别于日记与文章。
// 发一条碎碎念 = 在下方数组加一条对象，提交推送后自动触发线上重建。
//
// 数据源为过渡方案（本地数据文件）。未来接入小米便签等外部拉取时，
// 只需保持 MurmurItem 结构不变、重写 getMurmurList 的数据来源即可，页面无需改动。

export interface MurmurItem {
	id: number;
	content: string; // 正文，支持 \n 换行
	date: string; // ISO 8601，如 2026-10-01T21:30:00+08:00
	mood?: string; // 心情（emoji 或短词）
	location?: string; // 位置
	tags?: string[]; // 标签
	images?: string[]; // 配图，路径相对于 /public，如 /images/murmurs/xxx.webp
	source?: string; // 来源标识（预留：后续接入小米便签等外部源时用于标记）
}

// 示例数据（可随时增删改，按 date 倒序展示）
const murmursData: MurmurItem[] = [
	{
		id: 4,
		content:
			"碎碎念功能上线啦 🎉 以后想到什么就随手记在这里，不用起标题，不用排版。",
		date: "2026-10-01T21:30:00+08:00",
		mood: "🎉",
		tags: ["开始"],
	},
	{
		id: 3,
		content: "页面做成了聊天记录的样子，往下滑就像在翻和自己聊过的天。",
		date: "2026-10-01T21:00:00+08:00",
		mood: "😊",
	},
	{
		id: 2,
		content:
			"支持多图：在 images 数组里放 /public 下的图片路径就行，点击可以放大。",
		date: "2026-09-30T22:10:00+08:00",
		tags: ["使用说明"],
		images: ["/images/diary/sakura.jpg", "/images/diary/1.webp"],
	},
	{
		id: 1,
		content: "这是一条更早的碎碎念，用来演示按月份折叠分组的效果。",
		date: "2026-09-30T08:30:00+08:00",
		mood: "🌙",
		location: "家里",
	},
];

// 获取碎碎念列表（按时间倒序），limit 可选截断
export const getMurmurList = (limit?: number): MurmurItem[] => {
	const sorted = [...murmursData].sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);
	return limit && limit > 0 ? sorted.slice(0, limit) : sorted;
};

export interface MurmurMonthGroup {
	year: number;
	month: number;
	items: MurmurItem[];
}

// 按年月折叠分组（入参需已倒序）
export const groupMurmursByMonth = (items: MurmurItem[]): MurmurMonthGroup[] => {
	const groups: MurmurMonthGroup[] = [];
	const map = new Map<string, MurmurMonthGroup>();
	for (const item of items) {
		const d = new Date(item.date);
		const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
		let group = map.get(key);
		if (!group) {
			group = { year: d.getFullYear(), month: d.getMonth() + 1, items: [] };
			map.set(key, group);
			groups.push(group);
		}
		group.items.push(item);
	}
	return groups;
};
