---
title: 修好了！修好了？如修！
published: 2026-08-16
description: 拆掉一块盘，系统开不了机；把引导文件"还原"回旧组合后反而彻底报废：vmlinuz 压缩载荷损坏、initramfs 遭内核放弃。换机修好后，一次 pacman -Syu 又让系统栽进 emergency mode。
tags: [arch, linux, 引导修复]
category: 排障
draft: false
---

> 一块盘拆走了，系统却开始"开不了机"。查到最后，真凶不是那块盘，也不是系统，而是一次看起来最像修复的操作。

---

## 你去哪儿啊？今天还回来吃饭吗？

老笔记本跑着 Arch Linux，btrfs，双盘。光驱位那块 1TB 机械盘拆走之后，开机卡住，费老半天劲手敲命令试图救回无果，把硬盘接到 Windows 上让大鲸鱼用 wsl 诊断：不是开不了机，是 systemd 在等一块已经不存在的盘，每次都等满几分钟才放弃，看起来就像死机。系统本身没毛病。

修法也直白：挂载项加 nofail、加超时，GRUB 去掉静默启动。顺手把 ESP 上的引导文件"**还原为旧组合**"。

---

## 杀人现场，凶手竟是我自己

盘拿去另一台电脑，启动直接失败。EFI stub 报错：内核解压失败，ZSTD 数据损坏。

ESP 上的 vmlinuz 和 initramfs，是刚才那次"还原"写的。文件大小和源文件一模一样，内容却是坏的——vmlinuz 的压缩载荷损坏；initramfs 更惨，主体是完好的 cpio，尾部跟着一段坏掉的 zstd 数据，内核解到尾部判了个 corrupt，把整个 initramfs 扔了，启动流程没跑起来就 panic：找不到根分区。

| 报错 | 凶手 |
| --- | --- |
| EFI stub: Decompression failed | vmlinuz 的 ZSTD 载荷损坏 |
| KERNEL PANIC unknown-block(0,0) | initramfs 尾部 zstd 损坏，整包被内核放弃 |

修 vmlinuz 简单：从 btrfs 里拷贝完好副本，备份损坏原件，MD5 校验，一次通过。修 initramfs 直接用系统自己的 mkinitcpio 构建 222MB 的全量 fallback initramfs——跳过 autodetect、所有驱动全带上，管它插在哪台机器上都能找到盘。

---

## Man！What can I say！

验证新 initramfs 时出了最大的幺蛾子。

mkinitcpio 41 的新格式是两段式：前面是未压缩的 early cpio（microcode、模块、固件，206MB），后面才是 zstd 压缩的主镜像（init、systemd、busybox，解压后 44MB）。用 cpio 工具列文件只能看到前半段，"没有 init，构建失败了"；扫描 zstd 魔数又把主帧起点排除在过滤范围之外，"没有有效帧"。两个验证方法都错了，结论却互相印证，差点把好好的文件当废品重建。

最后放宽扫描范围，定位到主帧真实偏移：帧有效，解压出 44MB，init、busybox、systemd 一个不少。第一次构建的产物从头到尾都是好的。

> 坏了的，自始至终只有那次"还原"写进去的两个文件。

---

## 尾声

1. 修复操作也是写操作，一样会写坏文件。做完任何"还原/拷贝/覆盖"，当场校验，别信"看起来成功了"。
2. 验证方法错了，结论会错得理直气壮。两把坏尺子量出同一个错误答案，比一把坏尺子更难发现。交叉验证前，先确认每把尺子量的是同一段东西。
3. 救援环境不用大，够用就行。3.6MB 的 Alpine 干完了所有活。

那块盘现在在另一台电脑上跑得好好的。拆掉一块盘，赔上两个引导文件，最后发现系统从头到尾没坏过——坏的是那次修复。

> 如无必要，勿增实体

---

## DLC：吼吼，还有二阶段，夸张哦

进系统 pacman -Syu 更新了一下，重启，没进桌面，落到 emergency mode。这回轻车熟路了，拆盘，挂载，大赢鲸秒了：

```
Failed to mount /efi
mount: /efi: 未知的文件系统类型"vfat"
modprobe "zram" failed
```

fstab 没问题，ESP 的 UUID 对得上，ESP 自己也好好的——"未知的文件系统类型"不是 ESP 坏了，是**跑着的那个内核认不出 vfat**。

**更新把旧内核的驱动删了个精光，把前朝老臣的 vfat 御用翻译都噶了，但启动菜单还死心眼地让旧内核去干活。旧内核手无寸铁，看见 vfat 格式直接懵圈。**

上次是"还原"把 ESP 写坏了，这次是更新压根没写它。启动读的是 ESP，更新写的是 /boot，两边从来不互通——一条路径，两种死法。

> 再听到 ESP 我就扎聋我自己的耳朵！