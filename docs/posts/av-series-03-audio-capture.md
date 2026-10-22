---
title: 音视频系列 03：音频采集——麦克风到 PCM，再装进 WAV
date: "2026-10-22"
tags:
  - 音视频系列
  - 音频采集
  - PCM
  - WAV
  - Core Audio
---

本文是「音视频学习工程」系列第 03 篇，对应学习仓票 [`02-audio-capture`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/02-audio-capture.md)（Status: done）。从本篇起真正碰到音视频概念。

配套代码仓：[fireloli27/cpp-av-lab](https://github.com/fireloli27/cpp-av-lab)（默认分支 `master`）。下文命令均在该仓仓库根执行。

**本文覆盖：** 「采集」在管线里是哪一段；PCM 与 WAV 差在哪；采样率 / 声道 / 位深怎么读；本课契约（48 kHz / mono / s16le）与跑通步骤；为何用 AudioQueue；自动化护栏护什么、不护什么。

**本文不覆盖：** 编码（Opus 等）、回声消除（AEC）、设备列表 / GUI、跨平台抽象、正式 Client AV SDK。

上一篇：[Learning harness](/posts/av-series-02-learning-harness)。仓内权威还可对照：

- 短文（怎么跑）：[`docs/learning/audio/capture.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/audio/capture.md)
- 课记（契约 + 代码地图）：[`docs/learning/audio/capture.notes.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/audio/capture.notes.md)
- 决策：[`docs/adr/0001-learning-audio-capture-coreaudio.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0001-learning-audio-capture-coreaudio.md)
- 源码：[`experiments/audio/capture/`](https://github.com/fireloli27/cpp-av-lab/tree/master/experiments/audio/capture)

## 采集在管线里干什么

学习仓把整条链路拆成五段：**采集 → 编码 → 本地传输 → 解码 → 渲染**。

音频侧的「采集」只做一件事：从默认麦克风拿到**原始 PCM 样本**。本课不压缩、不发包、不播扬声器。

可以把它想成：麦克风是传感器；采集程序把连续声波切成一串数字；后续编码才把这串数字压小。若把 WAV 文件里的 PCM 误叫成「码流」，后面读 Opus / AAC 时会整段对不上——仓内 Glossary 也刻意把「码流」留给压缩后的数据。

AEC（回声消除）属于叙述上必会的旁路，通常落在采集后、编码前的发送侧处理带。**本阶段实验不实现、不验收**，只先记住位置。

## 三个数：采样率、声道、位深

拿到「一串数字」之前，先约定尺子：

| 概念 | 白话 | 本课取值 |
| --- | --- | --- |
| 采样率（sample rate） | 每秒切多少刀 | **48 000 Hz** |
| 声道（channels） | 几路同时录 | **mono（1）** |
| 位深 / 样本格式 | 每个样本几个 bit、怎么解释 | **s16le**：有符号 16-bit，小端 |

合起来：每秒裸 PCM 字节数 = `48000 × 1 × 2 = 96000 B/s`。录 3 秒大约 288 KB 量级的样本数据（不含 WAV 头）。

**s16le** 拆开读：`s` = signed（有符号），`16` = 16 bit，`le` = little-endian（低字节在前）。Apple Silicon / Intel Mac 的 native endian 就是小端，所以本机线性 PCM 按这个钉死即可。

为什么先钉 48 kHz？课记把它写成阶段契约，并与下游编码票对齐；本文不另做选型辩论。【待核实：若你本机默认输入设备原生不是 48 kHz，AudioQueue 是否在队列内完成设备→契约转换——仓内约定「转换留在 AudioQueue，本课无独立重采样模块」，以 `GetProperty(StreamDescription)` 复核为准。】

## PCM 是肉，WAV 是盒子

**PCM（Pulse Code Modulation）**：样本本身——一串 `int16`（本课）。没有「文件格式」的必然含义。

**WAV（RIFF/WAVE）**：一种容器。常见布局里，`fmt` 块写采样率 / 声道 / 位深，`data` 块装裸 PCM。用系统播放器双击能听，是因为播放器认得这个盒子，并按 `fmt` 把 `data` 还原成波形。

本课成功产物是：

`out/audio/capture/capture.wav`

里面装的仍是上面那份 48 kHz / mono / s16le PCM。写成 WAV，是为了**可观察**：人能听；下游编码票也能拿同一路径当默认可追溯输入。

概念练习还可对照仓内教室（非硬交付）：[`teach/lessons/0001-pcm-samples-wav-box.html`](https://github.com/fireloli27/cpp-av-lab/blob/master/teach/lessons/0001-pcm-samples-wav-box.html)。

## 为何用 AudioQueue，而不是先上 PortAudio

[ADR-0001](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0001-learning-audio-capture-coreaudio.md) 写得很直：学习宿主是 macOS；harness 约定实验默认不引入第三方媒体库；本阶段目标是可观察的 PCM/WAV，系统 **Core Audio / AudioQueue（AudioToolbox）** 足够。产品端 Android / iOS 绑定不在本学习票范围。

数据流（课记权威）：

```text
默认麦克风
  → AudioQueue 输入回调（后台线程）拼出 vector<int16_t>
  → 主线程 sleep(--seconds) 后 Stop/Dispose
  → write_capture_wav(".", pcm) 覆盖写出 out/audio/capture/capture.wav
```

打开队列时用 ASBD（AudioStreamBasicDescription）钉死契约；再用 `AudioQueueGetProperty(..., StreamDescription)` 复核 rate / ch / bits。真麦路径在 `main.cpp`；纯「PCM → WAV 头字段」在 `capture_wav.cpp`，由 Catch2 护栏覆盖——**不访问麦克风**。

## 怎么跑通

前置：macOS；CMake ≥ 3.20；C++17；**cwd＝仓库根**；系统设置 → 隐私与安全性 → 麦克风 → 允许你用的终端；有默认输入设备。

```bash
git clone https://github.com/fireloli27/cpp-av-lab.git
cd cpp-av-lab
cmake -S experiments -B experiments/build
cmake --build experiments/build --target learning_audio_capture
./experiments/build/audio/capture/learning_audio_capture
# 可选：./experiments/build/audio/capture/learning_audio_capture --seconds 5
```

`--seconds` 必须在 **(0, 60]**，默认 **3** 秒。

成功时：退出码 0；`out/audio/capture/capture.wav` 被写出或覆盖；用系统播放器能听到**刚录的内容**；终端日志里的采样率 / 声道 / 位深与课记一致。

失败时：stderr 简述且 exit ≠ 0。旧的 `capture.wav` **不能**当作本次成功证据。一键护栏 `./scripts/check-learning.sh` 仍只护可无硬件复现的契约（合成 PCM→WAV），不测真麦。

## 代码地图（对照用）

| 路径 | 一句话 |
| --- | --- |
| [`main.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/capture/main.cpp) | CLI、`AudioQueue` 录音、把 PCM 交给写盘 |
| [`capture_wav.hpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/capture/capture_wav.hpp) | 契约常量 + `write_capture_wav` |
| [`capture_wav.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/capture/capture_wav.cpp) | 无硬件：PCM → RIFF/WAVE |
| [`test_capture_wav.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/tests/test_capture_wav.cpp) | Catch2：合成 PCM 校验 WAV 头 |

可执行目标名：`learning_audio_capture`。

## 读完应带走什么

1. **采集 ≠ 编码**：采集交付的是原始 PCM；压缩码流是下一阶段的事。
2. **PCM ≠ WAV**：PCM 是样本；WAV 是常用来装 PCM 的盒子，方便听、方便下游对齐路径。
3. **先钉契约再调 API**：本课权威数字是 48 kHz / mono / s16le；短文管怎么跑，课记管格式与代码地图。
4. **主缝没变**：独立可执行入口 + 人工听 WAV；Catch2 只护无麦部分。

下一篇默认接 **03 音频·编码**（票面以仓内 `03-audio-encode` 为准）：读本课写出的 `capture.wav`，把 PCM 压成压缩码流。库选型见仓内 ADR-0002（Opus + `AudioConverter` → `encode.caf`）。
