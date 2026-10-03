// 碎碎念数据
// 轻量短内容流：无标题、一两句话、想到就发，区别于日记与文章。
// 发一条碎碎念 = 在下方数组加一条对象，提交推送后自动触发线上重建。
//
// 数据源为过渡方案（本地数据文件）。未来接入小米便签等外部拉取时，
// 只需保持 MurmurItem 结构不变、重写 getMurmurList 的数据来源即可，页面无需改动。

// 预置 emoji 回应（种子计数）。api 模式（reactionConfig.mode）下全站计数
// 以 KV 为准，种子仅作为接口未就绪/不可用时的兜底显示
export interface MurmurReaction {
	emoji: string; // 原生 emoji 字符，同时也是未来图标集（Twemoji 等）的标识
	count: number; // 种子计数（仅 api 不可用时的兜底显示值）
}

// 引用/回复其它碎碎念的快照。存快照而不是裸 id：渲染气泡零查询，
// 原条目删除后引用卡仍可显示，只是点击跳转自然失效
export interface MurmurReplyRef {
	id: number; // 被引用条目 id（引用卡点击跳转用）
	content: string; // 内容快照
	date: string; // 时间快照（ISO 8601）
}

// 条目分类：note = 自己发的碎碎念（缺省）；share = 看到好玩的文字/图像分享出来。
// 展示层据此加徽章，页面筛选条据此过滤；服务端发布白名单须与此类型同步
// （functions/api/murmurs/index.ts 的 CATEGORIES）
export type MurmurCategory = "note" | "share";

export interface MurmurItem {
	id: number;
	content: string; // 正文，支持 \n 换行；API 长文条目此字段为前 500 字摘要（全文在 longUrl）
	date: string; // ISO 8601，如 2026-10-01T21:30:00+08:00
	images?: string[]; // 配图，路径相对于 /public，如 /images/murmurs/xxx.webp
	reactions?: MurmurReaction[]; // 预置回应；不写则该条只有 "+" 按钮
	replyTo?: MurmurReplyRef; // 引用/回复其它碎碎念
	source?: string; // 来源标识（预留：后续接入小米便签等外部源时用于标记）
	category?: MurmurCategory; // 缺省视为 note；share 条目带分享徽章
	longUrl?: string; // 长文全文地址（API 条目由 longKey 拼装；git 静态数据全文内联，不设此字段）
}

// 示例数据（可随时增删改，按 date 倒序展示）
const murmursData: MurmurItem[] = [
	{
		id: 5,
		content: "引用回复做好啦：点任意一条碎碎念右下角的小尾巴，就能像这样带着引用发言。",
		date: "2026-10-02T10:30:00+08:00",
		replyTo: {
			id: 3,
			content: "页面做成了聊天记录的样子，往下滑就像在翻和自己聊过的天。",
			date: "2026-10-01T21:00:00+08:00",
		},
	},
	{
		id: 4,
		content:
			"碎碎念功能上线啦 🎉 以后想到什么就随手记在这里，不用起标题，不用排版。",
		date: "2026-10-01T21:30:00+08:00",
		reactions: [
			{ emoji: "🎉", count: 3 },
			{ emoji: "👍", count: 2 },
			{ emoji: "❤️", count: 1 },
		],
	},
	{
		id: 3,
		content: "页面做成了聊天记录的样子，往下滑就像在翻和自己聊过的天。",
		date: "2026-10-01T21:00:00+08:00",
		reactions: [{ emoji: "👀", count: 1 }],
	},
	{
		id: 2,
		content:
			"支持多图：在 images 数组里放 /public 下的图片路径就行，点击可以放大。",
		date: "2026-09-30T22:10:00+08:00",
		images: ["/images/diary/sakura.jpg", "/images/diary/1.webp"],
	},
	{
		id: 1,
		content: "这是一条更早的碎碎念，用来演示按月份折叠分组的效果。",
		date: "2026-09-30T08:30:00+08:00",
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
export const groupMurmursByMonth = (
	items: MurmurItem[],
): MurmurMonthGroup[] => {
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
