import type { TimelineItem } from "../components/features/timeline/types";

export const timelineData: TimelineItem[] = [
	{
		id: "tinkering-astro-blog",
		title: "bydblog",
		description: "开始折腾基于 Astro 的个人博客，选择了mizuki作为基底，一步步把站点变成自己的样子（持续进行中）。",
		type: "tinkering",
		startDate: "2026-07-03",
		skills: ["Astro", "前端", "个性化"],
		achievements: ["本地跑通并持续改造 Mizuki 主题"],
		links: [{name: "LyraVoid/Mizuki", url: "https://github.com/LyraVoid/Mizuki", type: "website"}],
		icon: "material-symbols:build"
	},
	{
		id: "tinkering-comfyui",
		title: "ComfyUI",
		description: "第一次玩 ComfyUI 就上头，使用“最新最潮”的anima base模型，整天怼节点工作流生成图片，和nsfw结下了不解之缘。（雾）",
		type: "tinkering",
		startDate: "2026-06-19",
		skills: ["ComfyUI", "AI 绘画", "工作流"],
		achievements: ["搭建本地 ComfyUI 并跑通工作流", "anima base出图"],
		links: [{name: "Anima - base-v1.0", url: "https://civitai.com/models/2458426/anima?modelVersionId=2945208", type: "website"}],
		icon: "material-symbols:build"
	},
	{
		id: "tinkering-arm-flash",
		title: "安卓刷机",
		description: "给吃灰的红米 2 刷入 PocketMarketOS，手痒尝试折腾 Arch for ARM，自己编译内核没成，又刷回原系统。",
		type: "tinkering",
		startDate: "2026-02-21",
		endDate: "2026-02-22",
		skills: ["刷机", "Fastboot", "内核编译"],
		achievements: ["红米 2 成功刷入 PocketMarketOS", "尝试编译 Arch for ARM 内核（失败后刷回）"],
		links: [{name: "PocketMarketOS", url: "https://postmarketos.org/", type: "website"}],
		icon: "material-symbols:build"
	},
	{
		id: "tinkering-arch",
		title: "Arch Linux",
		description: "走通安装与图形界面、配驱动、做桌面美化，之后一直把它当日常系统用。",
		type: "tinkering",
		startDate: "2026-01-18",
		endDate: "2026-01-18",
		skills: ["Arch Linux", "Linux"],
		achievements: ["成功安装 Arch 并进入图形界面", "配置显卡驱动与桌面美化", "后续持续使用 Arch 作为老笔电的系统"],
		links: [{name: "领路人 - 林长枫Shorin709", url: "https://space.bilibili.com/9202840", type: "website"}, {name: "Arch Linux", url: "https://archlinux.org/", type: "website"}],
		icon: "material-symbols:build"
	},
	{
		id: "tinkering-nas",
		title: "NAS",
		description: "心血来潮想把老笔电搞成 NAS，数天折腾：重装系统、排查网速瓶颈、jellyfin和komga安排！",
		type: "tinkering",
		startDate: "2024-06-30",
		endDate: "2024-07-14",
		skills: ["NAS", "网络", "重装系统"],
		icon: "material-symbols:build"
	},
	{
		id: "Bachelor's-degree-graduation",
		title: "本科",
		description: "~~爽玩战地1~~",
		type: "education",
		startDate: "2022-09-01",
		endDate: "2026-06-30",
		location: "常州",
		organization: "河海大学",
		position: " 智能科学与技术专业",
		skills: ["Python", "AI相关"],
		icon: "material-symbols:school",
		color: "#059669"
	},
	{
		id: "high-school-graduation",
		title: "高中",
		description: "~~爽打羽毛球~~",
		type: "education",
		startDate: "2019-09-01",
		endDate: "2022-06-30",
		location: "上海",
		organization: "吴淞中学",
		icon: "material-symbols:school",
		color: "#2563EB"
	},
	{
		id: "current-study",
		title: "研究生",
		description: "",
		type: "education",
		startDate: "2026-09-10",
		location: "上海",
		organization: "上海大学",
		icon: "material-symbols:school",
      	featured: true
	},
];
