// 测试台（/tests/）实验清单
// AI 生成的可运行网页实验。新增实验只需在 testsData 加一条。

export interface GeneratedBy {
	model: string; // 生成模型
	rounds: number; // 对话轮次
	steps: number; // 执行步数
	llmTime: string; // LLM 总耗时
	toolTime: string; // 工具调用总耗时
	firstTokenAvg: string; // 首 token 平均耗时
	tokPerSec: number; // 生成速度
	cacheHitPct: number; // 缓存命中率 %
	inputTokens: string; // 输入 token 总量
	outputTokens: string; // 输出 token 总量
	contextUsedPct: number; // 上下文已用 %
	contextUsedText: string; // 上下文用量文本，如 "~424K / 1M"
	contextSys: string; // 系统提示词占用量
	contextTools: string; // 工具占用量
	contextMsgs: string; // 对话消息占用量
	prompt: string; // 完整生成提示词
}

export interface TestItem {
	id: string;
	title: string;
	description: string;
	url: string; // 实验页面路径（public/ 下的静态页或站内路由）
	image?: string; // 预览图（建议 webp，手压小图）
	tags: string[];
	addedAt: string; // 上架日期 YYYY-MM-DD
	generatedBy?: GeneratedBy; // AI 生成统计（可选：非 AI 实验可省略）
}

export const testsData: TestItem[] = [
	{
		id: "gargantua",
		title: "GARGANTUA — 史瓦西黑洞光线追踪",
		description:
			"全屏实时积分史瓦西零测地线（u''+u=3u²）的黑洞光线追踪器：体积吸积盘、光子环、引力透镜、多普勒增亮与引力红移。无贴图无视频，每一帧都是 Fragment Shader 实时算出来的，支持拖动视角、参数调节与截图。",
		url: "/gargantua/",
		image: "/gargantua/preview.webp",
		tags: ["WebGL", "光线追踪", "物理模拟"],
		addedAt: "2026-08-15",
		generatedBy: {
			model: "DeepSeek V4 Flash Max",
			rounds: 1,
			steps: 189,
			llmTime: "62m43s",
			toolTime: "26m26s",
			firstTokenAvg: "3.4s",
			tokPerSec: 117,
			cacheHitPct: 100,
			inputTokens: "51.4M",
			outputTokens: "365K",
			contextUsedPct: 42,
			contextUsedText: "~424K / 1M",
			contextSys: "~1.7K",
			contextTools: "~7.2K",
			contextMsgs: "~303K",
			prompt: `你是一名资深 Three.js/WebGL/GLSL 图形工程师，请从零制作全屏交互网站「GARGANTUA — Schwarzschild Black Hole Raytracer」。使用原生 HTML/CSS/JavaScript、ES Modules 与本地 Three.js，实现无需构建、可由静态服务器运行的完整项目。主体必须由全屏 Fragment Shader 实时积分 Schwarzschild 零测地线，禁止用黑球、平面圆环、贴图、视频或截图伪造。实现事件视界、光子环、多次吸积盘穿越、程序化星空与银河、引力透镜、Doppler 增亮、引力红移和动态盘面湍流。加入 HDR Bloom、ACES、暗角、胶片颗粒和轻微色散，确保黑洞深黑、吸积盘高温明亮且临界结构清晰。提供电影镜头循环、OrbitControls、四个视角预设、HUD、21 项参数、0–9 调试视图、快捷键和可选氛围音乐。支持 Standard/High/Cinematic 质量档、移动端、Retina、状态持久化、WebGL 错误恢复及 URL 截图自动化接口。直接交付全部源码、vendor 与音频资源、启动命令及测试结果，保证无控制台错误、无黑屏并通过视觉与交互验收。（吸积盘要有体积，不能是二维的，类似体积云，你没有视觉能力）`,
		},
	},
];
