// 技能树数据文件
// ⚠️ 当前内容为草稿（2026-08-24），权威源 = Obsidian「博客改造-待办/2026-08-24-技能树内容.md」
// 用户定稿后以 Obsidian 文档为准同步本文件。
// 结构：主干（领域）→ 叶子（具体技能）；level 1~5 编码熟练度，
// 渲染时映射为主题色明度阶梯（近白=入门 → 近黑=娴熟）。

export interface SkillTreeNode {
	name: string;
	/** 一句备注（tooltip 显示） */
	note?: string;
	/** 熟练度 1~5：1=用过 / 2=会用 / 3=熟练 / 4=很熟 / 5=能教别人 */
	level?: number;
	children?: SkillTreeNode[];
}

export const LEVEL_LABELS = ["", "用过", "会用", "熟练", "很熟", "能教别人"];

export const skillTreeData: SkillTreeNode = {
	name: "bydbot 的技能树",
	children: [
		{
			name: "AI 工具链",
			note: "日常重度使用 AI 辅助工作流",
			children: [
				{ name: "Hermes Agent", level: 4, note: "深度使用，内部机制刨根问底" },
				{ name: "Claude Code / Codex / OpenCode", level: 3, note: "编码委派工作流" },
				{ name: "ComfyUI", level: 4, note: "Anima 抽卡工作流已 API 化" },
				{ name: "llama.cpp", level: 3, note: "本地视觉/文本模型部署" },
				{ name: "faster-whisper", level: 3, note: "视频/音频本地转写" },
				{ name: "Suno", level: 2, note: "AI 音乐生成" },
			],
		},
		{
			name: "博客与前端",
			note: "Mizuki 博客全站改造实践",
			children: [
				{ name: "HTML / CSS / JS", level: 2, note: "三大件基础" },
				{ name: "Astro", level: 3, note: "本博客全站改造" },
				{ name: "Svelte", level: 2, note: "睡眠图等组件开发" },
				{ name: "ECharts", level: 3, note: "可视化与主题色联动" },
			],
		},
		{
			name: "系统与运维",
			note: "Windows 深度排障与自动化",
			children: [
				{ name: "Windows 排障", level: 4, note: "事件日志取证、磁盘诊断" },
				{ name: "WSL2 / Linux 救援", level: 3, note: "挂载修复 Linux 磁盘" },
				{ name: "Git / GitHub Actions", level: 3, note: "CI 定时抓取 Bangumi" },
				{ name: "Cloudflare Pages", level: 3, note: "博客部署与自动化" },
			],
		},
		{
			name: "数据处理",
			note: "个人数据流水线",
			children: [
				{ name: "Python", level: 3, note: "流水线脚本" },
				{ name: "Node.js", level: 3, note: "爬虫与构建脚本" },
				{ name: "日记数据流水线", level: 4, note: "minote 2732 篇清洗归一化" },
			],
		},
	],
};
