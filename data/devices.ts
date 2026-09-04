// 设备数据配置文件

export interface DeviceDetail {
	label: string;
	value: string;
}

export interface Device {
	name: string;
	image: string;
	specs: string;
	description: string;
	link: string;
	details?: DeviceDetail[];
	// era: 现役 (current) / 前任 (legacy)，默认 current
	era?: "current" | "legacy";
}

// 设备类别类型，支持品牌和自定义类别
export type DeviceCategory = Record<string, Device[]> & {
	自定义?: Device[];
};

export const devicesData: DeviceCategory = {
	PC: [
		{
			name: "台式机",
			image: "",
			specs: "Windows 24H2",
			description: "主力台式机",
			link: "",
			details: [
				{ label: "CPU", value: "AMD Ryzen 7 9700X" },
				{ label: "主板", value: "MSI B850M 刀锋钛" },
				{ label: "内存", value: "Asgard 24GB DDR5 6000 CL36" },
				{ label: "硬盘", value: "致钛 TiPlus7100s 1TB" },
				{ label: "显卡", value: "万丽 RTX 5070 Ti 雪狐 16GB" },
				{ label: "散热", value: "九州风神 冰果360" },
				{ label: "电源", value: "九州风神 PQ1200P 1200W" },
				{ label: "机箱", value: "九州风神 CH270" },
				{ label: "显示器", value: "KTC H27T22S" },
			],
		},
		{
			name: "机械革命 极光Pro 2022",
			image: "/assets/devices/jiguangpro.png",
			specs: "Windows 11 24H2",
			description: "游戏本",
			link: "",
			details: [
				{ label: "CPU", value: "Intel i7-12450H (8核12线程)" },
				{ label: "内存", value: "16GB DDR5 4800" },
				{ label: "硬盘", value: "512GB SSD" },
				{ label: "显卡", value: "NVIDIA RTX 3060" },
				{ label: "屏幕", value: "15.6 英寸 2.5K 165Hz 100%sRGB" },
			],
		},
		{
			name: "华硕 FL5900U",
			image: "/assets/devices/fl5900u-asus-logo.svg",
			specs: "Arch Linux",
			description: "前任笔记本（顽石四代）",
			link: "",
			era: "legacy",
			details: [
				{ label: "CPU", value: "Intel i7-7500U" },
				{ label: "内存", value: "8GB DDR3L" },
				{ label: "硬盘", value: "1TB HDD" },
				{ label: "显卡", value: "NVIDIA GeForce 940M 2GB" },
				{ label: "屏幕", value: "15.6 英寸 1080P" },
			],
		},
	],
	"手机/平板": [
		{
			name: "红米 Turbo 4 Pro",
			image: "/assets/devices/turbo4pro.png",
			specs: "Android 15 / HyperOS 3",
			description: "主力手机",
			link: "",
			details: [
				{ label: "CPU", value: "骁龙 8s Gen 4" },
				{ label: "内存", value: "12GB" },
				{ label: "存储", value: "512GB" },
				{ label: "屏幕", value: "6.83 英寸 1.5K 直屏 (华星 M9 OLED)" },
				{ label: "电池", value: "7550mAh / 90W 快充" },
			],
		},
		{
			name: "联想小新Pad 2022",
			image: "/assets/devices/xiaoxinpad.jpg",
			specs: "Android 12",
			description: "平板",
			link: "",
			details: [
				{ label: "CPU", value: "骁龙 680" },
				{ label: "内存", value: "6GB" },
				{ label: "存储", value: "128GB" },
				{ label: "屏幕", value: "10.6 英寸 2000×1200 LCD" },
				{ label: "电池", value: "7700mAh / 20W 充电" },
			],
		},
		{
			name: "红米 2",
			image: "/assets/devices/xiaomi-logo.svg",
			specs: "armlinux",
			description: "老老老东西",
			link: "",
			era: "legacy",
			details: [
				{ label: "CPU", value: "骁龙 410" },
				{ label: "内存", value: "2GB" },
				{ label: "存储", value: "8GB" },
				{ label: "屏幕", value: "4.7 英寸 720P" },
				{ label: "电池", value: "2200mAh" },
			],
		},
		{
			name: "红米 7A",
			image: "/assets/devices/xiaomi-logo.svg",
			specs: "Android 9",
			description: "老老东西",
			link: "",
			era: "legacy",
			details: [
				{ label: "CPU", value: "骁龙 439" },
				{ label: "内存", value: "3GB" },
				{ label: "存储", value: "32GB" },
				{ label: "屏幕", value: "5.45 英寸 720P" },
				{ label: "电池", value: "4000mAh" },
			],
		},
		{
			name: "红米 Note 11",
			image: "/assets/devices/xiaomi-logo.svg",
			specs: "Android 11 / MIUI",
			description: "老东西",
			link: "",
			era: "legacy",
			details: [
				{ label: "CPU", value: "天玑 810" },
				{ label: "内存", value: "6GB" },
				{ label: "存储", value: "128GB" },
				{ label: "屏幕", value: "6.6 英寸 1080P 90Hz" },
				{ label: "电池", value: "5000mAh / 33W" },
			],
		},
	],
	"战斗鸡": [
		{
			name: "Switch 续航版",
			image: "",
			specs: "掌机 / Switch 系统",
			description: "现役掌机",
			link: "",
			details: [
				{ label: "处理器", value: "Tegra X1+" },
				{ label: "屏幕", value: "6.2 英寸 720P LCD" },
				{ label: "内存", value: "4GB" },
				{ label: "存储", value: "32GB+256GB" },
				{ label: "电池", value: "4310mAh" },
			],
		},
	],
};

