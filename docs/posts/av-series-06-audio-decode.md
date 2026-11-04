---
title: 音视频系列 06：音频解码——Opus access unit 还原成 PCM WAV
date: "2026-11-04"
tags:
  - 音视频系列
  - 音频解码
  - Opus
  - AudioConverter
  - PCM
---

本文是「音视频学习工程」系列第 06 篇，对应学习仓票 [`05-audio-decode`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/05-audio-decode.md)（Status: done）。上一篇证明 Opus 包可以按 Transport Unit 在本机收发一致；本篇把**同一类包字节**解回与采集契约相同的 **PCM**，写出可播放的 `decode.wav`。

配套代码仓：[fireloli27/cpp-av-lab](https://github.com/fireloli27/cpp-av-lab)（默认分支 `master`）。下文命令均在该仓仓库根执行。

**本文覆盖：** 「解码」在管线里干什么；输入为何仍是 `encode.caf` 而不是 UDP 落盘；为何按包用 `AudioConverter`；时长窗口怎么卡；跑通步骤与护栏边界。

**本文不覆盖：** 再跑一遍 UDP；按 CAF priming 修齐到与原始 PCM 等长；jitter buffer / 丢包 / PLC；扬声器播放（下一篇）；第三方 libopus。

上一篇：[音频本地传输](/posts/av-series-05-audio-local-transport)。仓内权威还可对照：

- 短文：[`docs/learning/audio/decode.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/audio/decode.md)
- 课记：[`docs/learning/audio/decode.notes.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/audio/decode.notes.md)
- 决策：[`docs/adr/0004-learning-audio-decode-audioconverter.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0004-learning-audio-decode-audioconverter.md)
- 源码：[`experiments/audio/decode/`](https://github.com/fireloli27/cpp-av-lab/tree/master/experiments/audio/decode)

## 解码在管线里干什么

五段里本课是第四段：**采集 → 编码 → 本地传输/打包 → 解码 → 渲染**。

编码把 PCM 压成码流；解码把码流还原成 **PCM 样本**。Glossary 意义上：本课读的是压缩后的 Opus access unit，写回的是可播放样本，不是「再压一次」。

输入默认仍是 `out/audio/encode/encode.caf`。这些包字节就是上一课放进 Transport Unit 的**载荷**。环回一致性已由本地传输课证明；本课**不重跑 UDP**，也不把长度前缀外壳当输入。

jitter buffer 通常在接收之后、本阶段之前——**本课不实现、不验收**。

## 为何按包 AudioConverter，不用 ExtAudioFile

[ADR-0004](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0004-learning-audio-decode-audioconverter.md)：与编码课一样走系统 AudioToolbox、不引入 libopus。按包 `AudioConverter`，才能看见与 Transport Unit 载荷同形的 access unit，而不是把容器转码藏进一次整文件调用。不用 `ExtAudioFile`。

数据流（课记权威）：

```text
out/audio/encode/encode.caf（或 --input）
  → 校验 Opus + 48 kHz / mono + magic cookie
  → AudioFileReadPacketData 读出 access unit
  → AudioConverter（Opus → PCM）+ DecompressionMagicCookie
  → 输入回调每次喂 1 个 access unit
  → 时长窗口通过后写出 out/audio/decode/decode.wav
```

输出契约与采集一致：**48 kHz / mono / s16le** PCM WAV。不做重采样、不混音。格式不对直接失败。

## 时长窗口：故意不修 priming

课记用：

```text
source_frames = packet_count × frames_per_packet
要求：pcm_frames > 0
且 source_frames / 2 ≤ pcm_frames ≤ source_frames × 2
```

本课**不**按 CAF packet table 的 priming 把 `pcm_frames` 修到与原始采集等长。差一个编码延迟量级时，仍应落在窗口内；窗口外 exit ≠ 0，且不写新 WAV。也不与 `capture.wav` 做逐样本对比。

成功日志含 `packets`、`pcm_frames`（以及 `frames_per_packet`）。听感用 `afplay` 人工确认，不进 Catch2。

## 怎么跑通

前置：macOS；CMake ≥ 3.20；C++17；**cwd＝仓库根**；`AudioConverter` 须在非沙箱环境跑。本课不采麦、不打开扬声器播放 API。

```bash
cmake -S experiments -B experiments/build
cmake --build experiments/build --target learning_audio_decode
# 若尚无 encode.caf：
./experiments/build/audio/capture/learning_audio_capture --seconds 1
./experiments/build/audio/encode/learning_audio_encode
./experiments/build/audio/decode/learning_audio_decode
# 可选：./experiments/build/audio/decode/learning_audio_decode --input path/to/opus.caf
afplay out/audio/decode/decode.wav
```

成功时：exit 0；覆盖写出 `out/audio/decode/decode.wav`；`pcm_frames` 落在窗口内；`afplay` 能听出与上游 CAF 对应的内容。

失败时：stderr 简述且 exit ≠ 0。旧的 `decode.wav` **不能**当作本次成功证据。Catch2 用编码库从合成音调生成 Opus CAF 再解码，断言格式、非全零样本与时长窗口；不读真人 `encode.caf`。

## 踩坑边界（课记摘要）

- 沙箱里 Opus / `AudioConverter` 可能不可用；护栏与烟测放在非沙箱环境。
- 转换器若在 access unit 尚未喂完时就不再吐 PCM，同样失败——窗口下沿是一半，不能单靠窗口假装「包已解完」。
- 本票不做 `--output`、不做 UDP、不做丢包隐藏。

## 代码地图（对照用）

| 路径 | 一句话 |
| --- | --- |
| [`main.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/decode/main.cpp) | CLI、调用解码、打日志 |
| [`decode_wav.hpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/decode/decode_wav.hpp) | 契约常量 + `write_decode_wav` |
| [`decode_wav.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/decode/decode_wav.cpp) | 读包 + 按包转换 + 写 WAV |
| [`test_decode_wav.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/tests/test_decode_wav.cpp) | Catch2：合成 CAF → WAV |

可执行目标名：`learning_audio_decode`。不链接采集库。

## 读完应带走什么

1. **解码 = 码流 → PCM**；输入是 access unit 本身，不是 Transport Unit 外壳。
2. **不重跑 UDP**：环回一致性上一课已证；本课默认仍读 `encode.caf`。
3. **时长用窗口约束，不修 priming**；不与采集 WAV 逐样本对齐。
4. **产物** `out/audio/decode/decode.wav` 交给渲染课。

下一篇：[音频渲染](/posts/av-series-07-audio-render)（票 [`06-audio-render`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/06-audio-render.md)）：用 AudioQueue output 把 PCM 交给默认扬声器，并串起音频五段的贯通证据与缺口。
