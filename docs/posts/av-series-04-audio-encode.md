---
title: 音视频系列 04：音频编码——PCM 压成 Opus，装进 CAF
date: "2026-10-22"
tags:
  - 音视频系列
  - 音频编码
  - Opus
  - CAF
  - AudioConverter
---

本文是「音视频学习工程」系列第 04 篇，对应学习仓票 [`03-audio-encode`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/03-audio-encode.md)（Status: done）。

配套代码仓：[fireloli27/cpp-av-lab](https://github.com/fireloli27/cpp-av-lab)（默认分支 `master`）。下文命令均在该仓仓库根执行。

**本文覆盖：** 「编码」在管线里干什么；PCM 与压缩码流差在哪；为何选 Opus + `AudioConverter`；48 kHz / mono / s16le → 64 kbps Opus / CAF 的契约与跑通步骤；护栏护什么。

**本文不覆盖：** 采集（上一篇）、本地传输 / RTP、AEC、弱网自适应码率、第三方 libopus / FFmpeg。

上一篇：[音频采集](/posts/av-series-03-audio-capture)。仓内权威还可对照：

- 短文：[`docs/learning/audio/encode.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/audio/encode.md)
- 课记：[`docs/learning/audio/encode.notes.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/audio/encode.notes.md)
- 决策：[`docs/adr/0002-learning-audio-encode-opus-audioconverter.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0002-learning-audio-encode-opus-audioconverter.md)
- 源码：[`experiments/audio/encode/`](https://github.com/fireloli27/cpp-av-lab/tree/master/experiments/audio/encode)

## 编码在管线里干什么

五段里本课是第二段：**采集 → 编码 → 本地传输 → 解码 → 渲染**。

采集交出的是**原始 PCM 样本**（大、可精确还原波形）。编码把 PCM **压成压缩码流**：体积小很多，适合后面打包发送。解码才再变回可播放样本。

仓内 Glossary 把「码流」留给压缩后的数据。上一篇的 WAV 里装的是 PCM，**那不叫码流**。本课产物 CAF 里装的是 **Opus 码流**。

两句旁路先钉位置、本课不实现：

- **AEC**：通常在采集后、编码前。
- **弱网码率自适应**：依赖网络反馈去改编码码率；本课码率固定。

## 三个容易混的词

| 词 | 白话 | 本课例子 |
| --- | --- | --- |
| PCM | 未压缩样本 | 48 kHz / mono / s16le |
| 码流 | 压缩后的比特序列 | Opus packets |
| 容器 | 把码流（或 PCM）装进文件的盒子 | WAV 装 PCM；**CAF 装 Opus** |

WAV 与 CAF 都是容器。换容器不等于换编码：同一段 Opus 也可以装进别的盒子；本课选 CAF，是因为系统 `AudioFileWritePackets` 写起来顺，且可用 `afplay` 直接听。

**码率（bitrate）**：编码器大约每秒输出多少 bit。本课固定 **64 000 bps（64 kbps）**，无 `--bitrate`、无自适应。对比：裸 PCM 约 `96 000 B/s ≈ 768 kbps`；压到 64 kbps 大约小一个数量级（量级直觉即可，精确比取决于内容与头开销）。

**Opus**：面向实时语音/音乐的开源编解码器，WebRTC 语音侧常见。本课用它，是为贴近后续 RTC 对照，而不是先走 AAC 产品线。

## 为何用系统 AudioConverter，不引入 libopus

[ADR-0002](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0002-learning-audio-encode-opus-audioconverter.md)：学习宿主 macOS；harness 约定实验默认无第三方媒体库；系统 AudioToolbox 的 **`AudioConverter`** 已能把 PCM 转成 **`kAudioFormatOpus`**。引入 libopus 要改依赖政策，本票不取。

数据流（课记权威）：

```text
out/audio/capture/capture.wav（或 --input）
  → main 校验 RIFF/WAVE + 48 kHz / mono / s16le PCM
  → write_encode_caf(".", pcm, stats)
       AudioConverterNew(PCM → Opus) + EncodeBitRate 64 kbps
       AudioFileCreateWithURL(CAF)
       循环 FillComplexBuffer → AudioFileWritePackets
       AudioFileOptimize
  → 覆盖写出 out/audio/encode/encode.caf
```

输入必须已是采集契约；**不做重采样 / 混音**。格式不对直接失败。

分包跟系统 `AudioConverter` 默认。课记记录本机实测 `frames_per_packet=120`（2.5 ms @ 48 kHz）；以你机器运行日志为准，本文不另测。【待核实：不同 macOS / 芯片上默认 packet 帧数是否始终为 120。】

## 怎么跑通

前置：macOS；CMake ≥ 3.20；C++17；**cwd＝仓库根**。本可执行文件**不采麦**，无需麦克风权限；默认要先有采集产物。

```bash
git clone https://github.com/fireloli27/cpp-av-lab.git
cd cpp-av-lab
cmake -S experiments -B experiments/build
cmake --build experiments/build --target learning_audio_capture
cmake --build experiments/build --target learning_audio_encode
./experiments/build/audio/capture/learning_audio_capture --seconds 1
./experiments/build/audio/encode/learning_audio_encode
# 可选：./experiments/build/audio/encode/learning_audio_encode --input path/to/contract.wav
```

成功时：exit 0；写出或覆盖 `out/audio/encode/encode.caf`；`afplay out/audio/encode/encode.caf`（或系统播放器）能听出与输入 WAV 对应的内容；终端日志含采样契约摘要、`bitrate_bps`、约包数、`frames_per_packet`、输出字节与时长。

失败时：stderr 简述且 exit ≠ 0。旧的 `encode.caf` **不能**当作本次成功证据。`./scripts/check-learning.sh` 用合成 PCM 护 CAF/Opus 契约，不读真人 `capture.wav`。

## 代码地图（对照用）

| 路径 | 一句话 |
| --- | --- |
| [`main.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/encode/main.cpp) | CLI、`--input`、严格读 WAV、调用写 CAF |
| [`encode_caf.hpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/encode/encode_caf.hpp) | 契约常量 + `write_encode_caf` |
| [`encode_caf.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/encode/encode_caf.cpp) | AudioConverter + 写 Opus CAF |
| [`test_encode_caf.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/tests/test_encode_caf.cpp) | Catch2：合成 PCM → Opus CAF |

可执行目标名：`learning_audio_encode`。

本票明确不做：RTP、自定义分帧、`--output`、`--bitrate`、自适应码率。

## 读完应带走什么

1. **编码 = PCM → 压缩码流**；WAV 里的 PCM 不是码流。
2. **CAF 是盒子，Opus 是肉**；本课用 CAF 方便 `afplay` 验收。
3. **契约钉死**：输入与采集课一致（48 kHz / mono / s16le）；输出 64 kbps Opus @ `out/audio/encode/encode.caf`。
4. **主缝没变**：独立入口 + 人工听；Catch2 只护无硬件可复现部分。

下一篇默认接 **04 音频·本地传输/打包**（票面以仓内 `04-audio-local-transport` 为准）：吃本课的 `encode.caf`（或等价码流单元）。「打包」是否必须 RTP 在 spec 里仍未决。
