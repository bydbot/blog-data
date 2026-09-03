export type AIToolCategory =
	| "chat"
	| "coding"
	| "image"
	| "audio"
	| "video"
	| "writing"
	| "search"
	| "other";

export type AIToolFrequency =
	| "daily"
	| "weekly"
	| "occasional"
	| "experimental";

export type LocaleString = Partial<
	Record<"en" | "zh_CN" | "zh_TW" | "ja", string>
>;

export function getLocaleString(value: LocaleString, lang: string): string {
	return value[lang as keyof LocaleString] ?? value["en"] ?? "";
}

export interface AITool {
	id: string;
	name: string;
	description: LocaleString;
	icon: string;
	category: AIToolCategory;
	frequency: AIToolFrequency;
	url?: string;
	usage?: LocaleString;
	tags?: string[];
	color?: string;
}

// 本博客正在使用的 AI 工具
export const aiToolsData: AITool[] = [
	{
		id: "hermes",
		name: "Hermes Agent",
		description: {
			en: "My AI assistant, built by Nous Research.",
			zh_CN: "我的 AI 助手，由 Nous Research 打造。",
		},
		icon: "material-symbols:smart-toy",
		category: "chat",
		frequency: "daily",
		url: "https://hermes-agent.nousresearch.com",
		usage: {
			en: "Daily: everything",
			zh_CN: "每天：所有事情",
		},
		tags: ["Agent", "Assistant"],
		color: "#C97758",
	},
	{
		id: "claude-code",
		name: "Claude Code",
		description: {
			en: "Anthropic's CLI coding agent.",
			zh_CN: "Anthropic 的终端编程代理。",
		},
		icon: "simple-icons:anthropic",
		category: "coding",
		frequency: "weekly",
		url: "https://claude.com/claude-code",
		usage: {
			en: "Weekly: coding tasks",
			zh_CN: "每周：编程任务",
		},
		tags: ["Coding", "CLI"],
		color: "#D97757",
	},
	{
		id: "codex",
		name: "OpenAI Codex",
		description: {
			en: "OpenAI's CLI coding agent.",
			zh_CN: "OpenAI 的终端编程代理。",
		},
		icon: "simple-icons:openai",
		category: "coding",
		frequency: "occasional",
		url: "https://openai.com/codex",
		usage: {
			en: "Occasional: coding tasks",
			zh_CN: "偶尔：编程任务",
		},
		tags: ["Coding", "CLI"],
		color: "#10A37F",
	},
	{
		id: "opencode",
		name: "OpenCode",
		description: {
			en: "An open-source AI coding agent.",
			zh_CN: "开源 AI 编程代理。",
		},
		icon: "simple-icons:opencode",
		category: "coding",
		frequency: "occasional",
		url: "https://opencode.ai",
		usage: {
			en: "Occasional: coding tasks",
			zh_CN: "偶尔：编程任务",
		},
		tags: ["Coding", "CLI"],
		color: "#3B82F6",
	},
	{
		id: "comfyui",
		name: "ComfyUI",
		description: {
			en: "Node-based image generation workflow tool.",
			zh_CN: "节点式 AI 绘图工作流工具。",
		},
		icon: "material-symbols:image",
		category: "image",
		frequency: "occasional",
		url: "https://github.com/comfyanonymous/ComfyUI",
		usage: {
			en: "Occasional: image generation",
			zh_CN: "偶尔：AI 绘图",
		},
		tags: ["Image", "Local"],
		color: "#7B61FF",
	},
	{
		id: "llamacpp",
		name: "llama.cpp",
		description: {
			en: "Local LLM inference engine.",
			zh_CN: "本地大模型推理引擎。",
		},
		icon: "material-symbols:memory",
		category: "other",
		frequency: "weekly",
		url: "https://github.com/ggml-org/llama.cpp",
		usage: {
			en: "Weekly: local inference",
			zh_CN: "每周：本地推理",
		},
		tags: ["Local", "Inference"],
		color: "#10A37F",
	},
	{
		id: "faster-whisper",
		name: "faster-whisper",
		description: {
			en: "Fast local speech transcription.",
			zh_CN: "本地语音转写，速度飞快。",
		},
		icon: "material-symbols:graphic-eq",
		category: "audio",
		frequency: "weekly",
		url: "https://github.com/SYSTRAN/faster-whisper",
		usage: {
			en: "Weekly: video transcription",
			zh_CN: "每周：视频转写",
		},
		tags: ["Audio", "Local"],
		color: "#F59E0B",
	},
	{
		id: "suno",
		name: "Suno",
		description: {
			en: "AI music generation.",
			zh_CN: "AI 音乐生成。",
		},
		icon: "material-symbols:music-note",
		category: "audio",
		frequency: "experimental",
		url: "https://suno.com",
		usage: {
			en: "Experimental: music ideas",
			zh_CN: "实验性：音乐灵感",
		},
		tags: ["Music", "Audio"],
		color: "#A855F7",
	},
];
