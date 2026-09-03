---
title: 我的hermes开始弹窗，我花了一天找出真凶
published: 2026-08-09
updated: 2026-08-12
description: 给 Hermes 装上 Hindsight 本地记忆系统后，弹窗开始阴魂不散：一闪即灭、常驻黑窗、每分钟幽灵。追了一天，五类弹窗全部归案。
tags: [Hermes, Windows, 弹窗]
category: 排障
draft: false
---

> 给 Hermes 装了一个本地记忆系统 Hindsight。从装上的那一刻起，Hermes 和弹窗一见钟情了：
>
> - 有时"啪"一下，弹完就关
> - 有时一个黑窗一直挂着
> - 最诡异的是，有时**每分钟**弹一次，弹一下就关
>
> 追了一天，屋檐了，我先放一张龙图在这里。

![龙图](./dragon.png)

---

## 了解你的捍卫者

### 第一层：Hermes 进程内（控制面）

| 角色 | 是什么 | 类比 |
|---|---|---|
| Hermes.exe<a id="hermes"></a> | Electron 桌面壳，你看到的窗口 | 门面 |
| hermes_cli serve<a id="server"></a>（pythonw → python，:9119） | Hermes 后端服务进程，**所有插件的宿主** | 大管家 |
| hindsight 插件<a id="plugin"></a>（`hindsight_embed` 包，跑在 Hermes 进程里） | 集成层：读配置、写 env、检查 daemon 在不在、不在就拉起来、转发记忆请求 | 调度员 |
| hermes.env<a id="env"></a>（`~/.hindsight/profiles/hermes.env`） | 插件与 daemon 之间的配置传令簿 | 传令簿 |

### 第二层：独立进程（数据面）

| 角色 | 是什么 | 类比 |
|---|---|---|
| hindsight daemon<a id="daemon"></a>（pythonw 进程，:9177） | 记忆 API 服务：嵌入/重排（GPU）、LLM 抽取合并、空闲自动退出 | **仓库管理员** |
| pg0<a id="pg0"></a>（Rust 二进制 + Python 包装） | daemon 内部的 postgres 生命周期工具：检查、拉起、连接 | 管理员的开锁工具 |
| postgres<a id="postgres"></a>（postgres.exe，:5432） | 记忆仓库本体：图谱、实体、关系、向量全存这 | **仓库** |

### 第三层：daemon 内部依赖

| 角色 | 是什么 | 类比 |
|---|---|---|
| sentence_transformers + bge-m3<a id="embedder"></a>（GPU） | 中文语义嵌入 + 重排，daemon 进程内加载 | 仓库里的分拣机器人 |
| LLM<a id="llm"></a>（deepseek-v4-flash @ opencode.ai） | 记忆抽取/合并的写作秘书（走外网） | 外包秘书 |

### 调用链

```
hindsight_recall / retain（你触发的工具）
  → 插件（Hermes 进程内）
      ├─ 查 :9177 健康？ ── 不健康 → spawn daemon（pythonw）   ⚠️ 弹窗风险点①
      └─ 健康 → HTTP → daemon
          ├─ 嵌入/重排（GPU）
          ├─ LLM 抽取合并
          └─ pg0 检查 postgres → 复用 / cmd /C 冷启动          ⚠️ 弹窗风险点②
              └─ postgres :5432 存取记忆
```

**Hermes 永远不直接碰 postgres。** 工具 → 插件 → daemon → pg0 → postgres，五级链条。弹窗只出在两个"拉起动作"上。

---

## 序幕：苦果亲手种

部署本身踩了三个常规坑，各一句话：

| 坑 | 解 |
|---|---|
| 清华镜像给了 CPU 版 torch | 换官方源 cu130（RTX 5070 Ti / sm_120 必须 cu130+） |
| v2ray 拦截 HF 下载，1MB/s | `NO_PROXY=hf-mirror.com` + 镜像 → 20MB/s |
| 中断下载，HF 缓存损坏 | 清 hub 重下 6.5G |

部署完成，但有一件事被忽略了：**第一次启动时，屏幕角落弹过一个黑窗**。当时以为是一次性的，没在意。

---

## 第一幕：一闪即灭的"短命窗口"

**本幕出场**：[插件](#plugin)（调度员）、[hermes.env](#env)（传令簿）、[daemon](#daemon)（管理员）——管理员刚上岗就猝死

现象：daemon 一启动就崩，控制台窗口弹出、又立刻关上。像一个人刚推开门，看见屋里没人，转身就走。

日志里躺着一条 `ValueError: Invalid LLM provider: . `——**provider 是空的**。

查配置：config.json 里只有 `HINDSIGHT_API_*` 长键，插件读的却是 `llm_provider` 短键。两边对不上，env 写出来就是空。传令簿上写着"无"，管理员自然不知道去哪报到。

补上短键，daemon 活了。第一个弹窗，卒。

> ez，常规操作，轻松拿下。

---

## 第二幕：甩不掉的"常驻黑窗"

**本幕出场**：[daemon](#daemon)（管理员）、[pg0](#pg0)（开锁工具）、[postgres](#postgres)（仓库）——仓库管理员手里那把开锁工具，闯了祸

调用链只有一条：Hermes 永远不直接碰 postgres，只找 daemon；daemon 用 pg0 管 postgres。

弹窗就出在 pg0 拉 postgres 这个环节：pg0 不是直接启动 postgres，而是套了一个壳——`cmd /C postgres.exe`。这个壳窗口**要一直挂到 postgres 退出才肯关**。所以：**窗口是壳的，不是数据库的。数据库活着，壳就永远挂着。**

试着关掉壳来解决——postgres 照跑。Windows 进程没有父子生死绑定，爹死了儿子照跑：**"产房关系"，不是"锁链关系"。**

解法是架构性的，绕开 pg0 的启动逻辑：pg0 动手前会先检查——postgres 还活着吗？活着就直接复用，压根不启动新实例，自然不弹窗。而 postgres 一旦被拉起就几乎不会死（daemon 空闲退出它也不死，成了孤儿常驻，postgres常驻资源占用很少，可接受），所以**绝大多数启动都静悄悄**；壳窗只剩一种情况：postgres 全死透后的冷启动，出现一次，关掉无害。

> 不就是个常驻的不吃资源的挂件吗，放着不管也无妨

---

## 第三幕：定时刷新的"野生窗口"

**本幕出场**：[postgres](#postgres)（仓库）——上幕的受害者，这幕要洗清冤屈；以及一个**新角色**：看门狗

没有时间为壳窗的离去感到高兴，随之而来的是打完就跑弹窗，**"两分钟弹了三次，每次弹一下就关。"**

配置没问题，daemon 日志安静。弹窗出现在启动 Hermes 正常使用中——这不是任何"冷启动"能解释的频率。只剩一条路：抓现场。

挂上新进程监视器，每 5 秒快照一次——

诶，**您猜怎么着**：

**01:31:02、01:32:02、01:33:02，每个整点，准时出现一对 `WindowsTerminal.exe` + `OpenConsole.exe`。** 和一个计划任务的执行时间，**一秒不差**。

而那个计划任务，是之前为了修壳窗**亲手注册的看门狗**：每分钟跑一次 `powershell -WindowStyle Hidden`，去杀 postgres 的壳窗。可默认终端是 Windows Terminal，**`-WindowStyle Hidden` 对它完全无效**。

于是：

> 造了一个每分钟弹一次的窗口，去治一个每分钟都不弹的窗口。

> 蓝色大鲸鱼真是神了，那我问你，蓝色大鲸鱼到底神不神，啊，那我问你

---

## 第四幕：明修栈道，暗度陈仓

**本幕出场**：[插件](#plugin)（调度员）——它拉管理员的方式有问题；[daemon](#daemon) 再次躺枪

以为结束了美美上床，醒来做到电脑前，不兑！我干净的桌面上怎么有一块黑框，byd又来？这次我直接把窗口标题 `venv\Scripts\pythonw.exe` 送给了大鲸鱼。

大鲸鱼认为不是 pythonw，然后读了它的 PE 头：

| 文件 | 大小 | PE 子系统 |
| --- | --- | --- |
| venv\Scripts\pythonw.exe（以为的 pythonw） | 44 KB | **Console（控制台）** |
| uv 托管的真 pythonw.exe | 88 KB | GUI |

666白衣渡江都来了——44KB 的"pythonw"，PE 头写着 Console。一个披着 pythonw 外衣的控制台程序，Popen 它，必然弹窗。而补丁恰好让它当了 daemon 启动器：等于**亲手把弹窗装回了系统**。

> 一个以"无窗"为卖点的程序，姓 Console，名 shim。

还没完。换成真 pythonw（GUI，物理无窗）之后，daemon 直接崩：`No module named 'pywintypes'`。真 pythonw 不在 venv 里，看不到 venv 的 site-packages；而纯 PYTHONPATH 不会处理 `.pth` 文件——pywin32 的 win32 路径就这么丢了。

补丁 v2 = 真 pythonw + 手动模拟 addsitedir，三层修正。这次，终于消停了。

---

## 第五幕：hermes的忧郁：永无止境的弹窗

**本幕出场**：[Hermes.exe](#hermes)（门面）——本幕真凶，穿着和第四幕**同一件马甲**

重启验证。弹窗**还在**，不是哥们，没完了是吧。

检查补丁是否生效：代码路径显示，v2 补丁加在了 `_find_api_command` 的**尾部 fallback**——但主路径 `_windows_gui_interpreter` 在更早的地方**先 return 了 venv 里的 pythonw.exe**（它盲目信任 scripts 目录里的"pythonw"）。补丁写了，却永远走不到。修错地方，等于没修。

v3 补丁：先读 PE 头验证子系统，Console 就跳过，从 pyvenv.cfg 的 `home` 定位真 GUI pythonw。

弹窗呢？**重启 Hermes 的瞬间，又弹了一次。**

这次抓到了完整的进程链：

```
Hermes.exe（桌面壳）
  └→ venv\Scripts\pythonw.exe -m hermes_cli.main serve   ← 同一个 44KB console shim
       └→ conhost.exe                                     ← 窗口
```

> 哈哈，敌在本能寺。

Hermes 启动后端时，用的也是同一个 shim。不修了：它在 Hermes 本体源码里，而每次启动 Hermes 都会自动拉取更新覆盖补丁，不值得为它开战。而且它只在启动瞬间闪一下，自动关闭，无害。

**至此，弹窗全部归案：**

| 弹窗 | 真凶 | 处置 |
| --- | --- | --- |
| 一闪即灭 | config 长短键不匹配 → daemon 秒崩 | 修复 |
| 常驻黑窗 | pg0 的 `cmd /C` 壳 | 架构规避（复用） |
| 每分钟幽灵 | 亲手注册的看门狗 | 删除 |
| 标题 pythonw.exe | uv 的 console shim | 补丁 v3 |
| 启动一闪 | Hermes 本体同款 shim | 接受 |

> 古有关羽过五关斩六将，今有大鲸鱼与弹窗斗智斗勇，到这儿是**五关五将**。第六将？hermes desktop 四舍五入也是弹窗，斩不得，供着了。

---

## 后日谈

这几天用下来感觉效果很舒服，毕竟 hermes server 一般我是让它常驻的，也不会主动给它关掉，也就是在开机重启这些情况下，它会弹出一个窗口，然后自动关掉，平时使用下来无感。好评，孩子很爱用。
