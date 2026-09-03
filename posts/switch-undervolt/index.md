---
title: 超超你的
published: 2026-08-31
description: 给 Switch 续航版做降压超频调优的实测记录：内存 1600 定档、GPU 545mV 甜点，低负载 2.6~3.8W、高负载 4.4W 内的功耗真值表。
image: ./13sentinels-1.jpg
tags: [switch, 超频, 降压]
category: 折腾
draft: false
---

> 我看这 10 年前的 Tegra X1+ 也是老当益壮啊

## 故事从捡垃圾开始

从表姐那捡了台不用的 Switch（续航），但是种种原因下不好破解，手痒自掏 777 大洋买了台 n 手破解续航版。到手第一件事当然是~~看小机器身体发育正不正常啊~~

**Speedo 1678 / 1673 / 1696**——中规中矩，脱亚入欧失败。

在 B 站刷视频看到[Switch 降压超频怪物猎人崛起](https://www.bilibili.com/video/BV1MekoB1EQX)的 4W45fps 怪猎，功耗 4W 很想啊，参数：

| CPU | 1026.2MHz | 565 mV |
| --- | --------- | ------- |
| GPU | 691.2MHz  | 545 mV |
| 内存  | 2033.0MHz | 1150 mV |

---

## 照着抄都超不来

照着参数一顿抄，反复「调电压 → 重启 → 进游戏」折腾了很久，依旧**失敗した**：**电压确实压下去了，功耗却总高出 0.6W 左右**。

搞不懂，困扰半天，在评论区找到了答案：

> 视频是**终盘古塔场景 + OLED 屏（亮度不清楚）**；我这边是**最高亮度 + 崛起野图**。场景对不上，功耗自然对不上——**一定程度上不是参数的问题，是负载的问题。**

---

## 小小思维驰竟有两大体系 ？！强强！？

在搜教程时看到了 [NS 超频的自我修养 - 概述](https://www.bilibili.com/video/BV1HwQxBBEQr) 后，馋上了视频里**游戏中实时调电压**的操作。一查发现：两个整合包的插件体系完全不同，超频工具也不是一回事。

|  | 酸菜鱼整合包（当前用的） | WE1ZARD AIO |
| --- | --- | --- |
| 插件菜单 | Ultrahand | Tesla |
| 超频工具 | HOC（sys-clk 外壳） | HOC 引擎 + Aurora 控制台 |
| 游戏内调参 | 改完保存 → 重启生效 | 呼出菜单直接改，实时生效 |
| 电压监控 | 有 | 有（sys-clk 覆盖层） |

> 依旧折腾半天后发现原体系崩塌。

还能怎么办，换包呗。

---

## 三相之力

> 主要记录一下大参，一些小参参考[星野無上HOC配置助手](https://littonishir.github.io/Mariko-OC-Configurator/)

### 内存 · 大材小用

先动内存。目标频率 2400MHz，GPU 给足电压，单独测 DVB 偏移（SoC 电压补正，25mV/档）：**DVB -2 稳定，-3 出现画面错误** → 求稳，定 **-1**

接着调 GPU，却撞上一个奇怪现象：**降压等级拉满后，GPU 电压最低只能到 580mV，再低画面就出错。** 引出了这套系统的关键机制：

> **内存频率和 GPU 电压下限正相关。** 内存跑得越快，片内 EMC ↔ GPU 的高速互连压力越大，GPU 的电压底线被「水涨船高」——而 HOC 的 GPU 电压补偿**只对 1600MHz 以上**的内存生效，1600 及以下走原厂电压表，才有真正的降压空间。

于是实测游戏里的内存利用率——**利用率并不高**，连 1600MHz 都喂不饱。于是内存定档 1600（默认下的安全频率，垃圾体质都能放心超），可能 NS 这垃圾分辨率贴图不用上高清的吧，别给我内存哥冻感冒了。

### GPU · 直接超，受得了

GPU 不用太高——**768MHz（底座模式）就够用**。直接超！降压等级拉满（当前版本包最大为 4，高降压），但默认 768 给的电压偏保守，手动偏移也压不太动（卡在 590/580 附近，没深究），换成 614 倒是直接自动降压到我设的最低电压 545mV 了。最后测了一下 691，545mV 依旧测试稳定后固化到降压表了。

### CPU · 回去吧，你太垃圾了，某不超老幼

本来还准备调一调这个跟骁龙810有来有回的垃圾CPU的，但功耗测下来可以接受了：**内存 1600 / GPU 614 / CPU 上限 1224MHz + 变频**。降压后功耗压得低，性能也够，没有继续折腾。

---

## 不BB，我测！

统一条件：**亮度 80%**、都是游戏开头；开飞行模式还能再挤 0.1W。桌面默认功耗 **2.2W**。

:::note
720P60 是目标设置，实际受动态分辨率和场景压力影响，不代表全程稳帧。
:::

### 首先迎面走来的是我们的低负载方阵：

- **十三机兵防卫圈**：Switch 上原生就可以 720P60 帧流畅运行的低压力游戏使用默认配置功耗在 3.3W 左右

  ![十三机兵防卫圈 720P60](<./13sentinels-1.jpg>)

  ![十三机兵防卫圈 720P60](<./13sentinels-2.jpg>)

- **猎天使魔女**：Wii U 时代，超强优化，同样 NS 上原生 720P60 帧流畅运行，功耗在 3.8 瓦左右
- **大神：绝景版**：之前笔电上没玩完的经典游戏，NS 上 Joy-Con 体验很棒——笔神系统支持触屏作画和体感画笔，和掌机天然契合。720P30 3W 左右

  ![大神 720P30](<./okami-1.jpg>)

- **逆转裁判**：卡普空超高打击感的格斗游戏（雾），同样 720P60 2.7W
- B 站上无意中发现的神奇妙妙绅士小游戏 :[我居然在Switch上玩到了这款真·绅士游戏？](https://www.bilibili.com/video/BV12zgpznE9f) 720P60 测试下来只有 2.6W 左右

### 紧随其后的是高负载精英小分队

- **旷野之息**：初中就想玩，当年小垃圾笔电连 Wii U 模拟器都跑不满 20 帧，搁置到大学换了电脑一口气通关。开放世界最高的山，氛围和一体性在我心中甚至高于王泪。对了，林可儿可爱滴捏❤

  ![旷野之息 720P60](<./zelda-1.jpg>)

  ![旷野之息 720P60](<./zelda-2.jpg>)

- **怪物猎人崛起**：视频同款调教目标，盾斧小子来了。测下来表现一般：不限制帧率，默认 540p 下当前超频设置在 45 到 55 帧之间跳动，平均也就 45 帧左右，功耗 4.5W 左右，进野图绝大多数场景能 5W 以内。

  ![怪物猎人崛起 540P 不锁帧](<./rise-1.jpg>)

- **异度之刃 2**：公认的高负载，最想抽时间玩，又在幻想美美把玩吼姆拉了。用底座模式来实现 720P30，压力确实有点高，614MHz 下动态分辨率发力了，动不动给我锯齿感干出来了，GPU 稍微拉到 691MHz 后动态分辨率观感上了一档，锯齿感减轻，电压下探到 545mV。格尔蒙特港 ≈4.3W，后续推进再补数据。

  ![异度之刃 2 底座 720P30](<./xeno2-1.jpg>)

---

### 游戏功耗汇总

<style>
.power-bars{display:flex;flex-direction:column;gap:.55rem;margin:1rem 0}
.pb-row{display:flex;align-items:center;gap:.7rem}
.pb-name{flex:0 0 9.5em;font-size:.875rem;white-space:nowrap}
.pb-target{flex:0 0 8em;font-size:.75rem;color:var(--text-color-secondary);white-space:nowrap}
.pb-track{flex:1;height:.9rem;border-radius:9999px;background:var(--btn-regular-bg);overflow:hidden}
.pb-fill{height:100%;border-radius:9999px;background:linear-gradient(90deg,oklch(.74 .13 var(--hue)),oklch(.48 .15 var(--hue)));transition:filter .15s}
.pb-val{flex:0 0 5em;font-size:.8125rem;font-weight:600;color:var(--tw-prose-headings);text-align:right;white-space:nowrap}
.pb-row:hover .pb-fill{filter:brightness(1.2)}
</style>

<div class="power-bars">
  <div class="pb-row"><span class="pb-name">十三机兵防卫圈</span><span class="pb-target">720P60</span><div class="pb-track"><div class="pb-fill" style="width:66%"></div></div><span class="pb-val">≈3.3W</span></div>
  <div class="pb-row"><span class="pb-name">猎天使魔女</span><span class="pb-target">720P60</span><div class="pb-track"><div class="pb-fill" style="width:76%"></div></div><span class="pb-val">≈3.8W</span></div>
  <div class="pb-row"><span class="pb-name">妙妙绅士小游戏</span><span class="pb-target">720P60</span><div class="pb-track"><div class="pb-fill" style="width:52%"></div></div><span class="pb-val">≈2.6W</span></div>
  <div class="pb-row"><span class="pb-name">大神</span><span class="pb-target">720P30</span><div class="pb-track"><div class="pb-fill" style="width:60%"></div></div><span class="pb-val">≈3.0W</span></div>
  <div class="pb-row"><span class="pb-name">逆转裁判</span><span class="pb-target">720P60</span><div class="pb-track"><div class="pb-fill" style="width:54%"></div></div><span class="pb-val">≈2.7W</span></div>
  <div class="pb-row"><span class="pb-name">旷野之息</span><span class="pb-target">720P60</span><div class="pb-track"><div class="pb-fill" style="width:88%"></div></div><span class="pb-val">≈4.4W</span></div>
  <div class="pb-row"><span class="pb-name">怪物猎人崛起</span><span class="pb-target">540P45</span><div class="pb-track"><div class="pb-fill" style="width:90%"></div></div><span class="pb-val">≈4.5W</span></div>
  <div class="pb-row"><span class="pb-name">异度之刃 2</span><span class="pb-target">720P30</span><div class="pb-track"><div class="pb-fill" style="width:86%"></div></div><span class="pb-val">≈4.3W</span></div>
</div>

---

## 补充

调了下 CPU 降压，功耗还能扣 0.1W，老任你无敌了，保守派都要觉得原机参数保守了。

---

## 参考

- 调参教程：[NS 超频的自我修养 - 概述](https://www.bilibili.com/video/BV1HwQxBBEQr)
- 整合包：[WE1ZARD](https://we1zard.com/index.html)
- 参数参考：[星野無上 HOC 配置助手](https://littonishir.github.io/Mariko-OC-Configurator/)
- 降压超频参考：[Switch 降压超频怪物猎人崛起](https://www.bilibili.com/video/BV1MekoB1EQX)