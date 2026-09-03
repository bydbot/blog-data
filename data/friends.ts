// 友情链接数据配置
// 用于管理友情链接页面的数据

export interface FriendItem {
	id: number;
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	tags: string[];
}

// 友情链接数据
export const friendsData: FriendItem[] = [
	{
		id: 1,
		title: "GitHub",
		imgurl: "https://avatars.githubusercontent.com/u/111557429?v=4&s=640",
		desc: "我的代码仓库",
		siteurl: "https://github.com/bydbot",
		tags: ["Code"],
	},
	{
		id: 2,
		title: "Bilibili",
		imgurl: "https://i0.hdslb.com/bfs/face/8a2d99ef4810d3402b680102f850af7b439d3233.jpg",
		desc: "我的B站主页",
		siteurl: "https://space.bilibili.com/21171027",
		tags: ["Video"],
	},
	{
		id: 3,
		title: "Bangumi",
		imgurl: "https://lain.bgm.tv/pic/user/l/000/58/82/588237.jpg?r=1630405573",
		desc: "我的番剧记录",
		siteurl: "https://bgm.tv/user/588237",
		tags: ["Anime"],
	},
	{
		id: 4,
		title: "Cloudflare",
		imgurl: "https://avatars.githubusercontent.com/u/314135?v=4&s=640",
		desc: "本站托管平台",
		siteurl: "https://cloudflare.com",
		tags: ["Hosting"],
	},
	{
		id: 5,
		title: "Hugging Face",
		imgurl: "https://avatars.githubusercontent.com/u/25720743?v=4&s=640",
		desc: "模型与数据集",
		siteurl: "https://huggingface.co",
		tags: ["AI"],
	},
];

// 获取所有友情链接数据
export function getFriendsList(): FriendItem[] {
	return friendsData;
}

// 获取随机排序的友情链接数据
export function getShuffledFriendsList(): FriendItem[] {
	const shuffled = [...friendsData];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}
