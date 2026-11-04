---
title: 音视频系列 07：音频渲染——AudioQueue 把 PCM 交给扬声器
date: "2026-11-04"
tags:
  - 音视频系列
  - 音频渲染
  - AudioQueue
  - PCM
  - 管线
---

本文是「音视频学习工程」系列第 07 篇，对应学习仓票 [`06-audio-render`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/06-audio-render.md)（Status: done）。上一篇写出 `decode.wav`；本篇用 **AudioQueue output** 按设备时钟把 PCM **拉**进扬声器。到这里，音频五段都有独立入口可跑通。

配套代码仓：[fireloli27/cpp-av-lab](https://github.com/fireloli27/cpp-av-lab)（默认分支 `master`）。下文命令均在该仓仓库根执行。

**本文覆盖：** 「渲染」在管线终点干什么；pull 模型与输出缓冲；旁路（jitter / A/V 同步 / AEC 参考）各落在哪；跑通步骤；如何对照 [`audio/pipeline.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/audio/pipeline.md) 看贯通缺口。

**本文不覆盖：** 实现 jitter buffer、A/V 同步或 AEC；选输出设备 / 调音量；视频五段细节（只做软预告）；把离线文件接力说成实时通话。

上一篇：[音频解码](/posts/av-series-06-audio-decode)。仓内权威还可对照：

- 短文：[`docs/learning/audio/render.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/audio/render.md)
- 课记：[`docs/learning/audio/render.notes.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/audio/render.notes.md)
- 贯通：[`docs/learning/audio/pipeline.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/audio/pipeline.md)
- 决策：[`docs/adr/0005-learning-audio-render-audioqueue.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0005-learning-audio-render-audioqueue.md)
- 源码：[`experiments/audio/render/`](https://github.com/fireloli27/cpp-av-lab/tree/master/experiments/audio/render)

## 渲染在管线里干什么

五段里本课是最后一段：**采集 → 编码 → 本地传输/打包 → 解码 → 渲染**。

渲染把 **PCM 样本**交给扬声器。输出设备按自己的时钟消费样本；AudioQueue 在需要下一块时回调你，你从 PCM 里取一块填进去。这是 **pull 模型**：不是你决定「现在播」，而是设备来拉。

默认输入：`out/audio/decode/decode.wav`（48 kHz / mono / s16le）。同契约的 `capture.wav` 也可 `--input` 做「采集 → 渲染」短路试听。本课**不写** `out/` 文件产物。

## 旁路先钉位置（本课不实现）

课记要求能讲清三点，实验都不做：

1. **jitter buffer ≠ 输出缓冲**  
   jitter buffer 在接收后、解码前，对付网络到达抖动。本课的 3 个 AudioQueue buffer 在渲染端，对付回调调度抖动。
2. **A/V 同步**落在渲染一带，通常以音频播放时钟为主钟。
3. **AEC 参考信号**取自渲染路径上即将播出的远端 PCM（处理本身在发送侧）。

## 为何用 AudioQueue output

[ADR-0005](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0005-learning-audio-render-audioqueue.md)：与采集的 AudioQueue input 对称；C API 能直接看见 pull 与 buffer 排队。不用 `afplay`、不用 `AVAudioEngine`，也不直接上 AudioUnit。

缓冲契约（课记权威）：**3 × 960 帧（20 ms）**，约 60 ms 输出侧排队。块越多/越大越抗欠载，延迟也越高；本课取学习用的中间值，不做调参实验。

成功判据：排空后 exit 0，且 **`pcm_frames == frames_rendered`**。`frames_rendered` 只证明这些帧**交给了设备**；喇叭里有没有声，只能靠人耳。【待核实：你本机默认输出设备上是否已按短文完成一次真人听感验收；票面曾记录修竞态后偶发 `AudioQueueStart` 失败，需设备恢复后复测。】

## 怎么跑通

前置：macOS；可用的默认输出设备且未静音；CMake ≥ 3.20；C++17；**cwd＝仓库根**；真播放须非沙箱。`./scripts/check-learning.sh` **不**打开输出设备。

```bash
cmake -S experiments -B experiments/build
cmake --build experiments/build --target learning_audio_render
# 若尚无 decode.wav：先跑 encode → decode（见上一篇）
./experiments/build/audio/render/learning_audio_render
# 可选短路：./experiments/build/audio/render/learning_audio_render --input out/audio/capture/capture.wav
```

成功时：整段播完后 exit 0；日志含相等的 `pcm_frames` / `frames_rendered`（以及 `buffers`、`buffer_frames`）；人耳能听出与输入 WAV 对应的内容。

失败时：stderr 简述且 exit ≠ 0。exit 0 但没听见声音时，记下输出设备、音量、蓝牙耳机等，不要只看退出码。

## 代码地图（对照用）

| 路径 | 一句话 |
| --- | --- |
| [`main.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/render/main.cpp) | CLI、加载、播放、打日志 |
| [`render_pcm.hpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/render/render_pcm.hpp) | 读 WAV + `PcmCursor` |
| [`play_queue.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/render/play_queue.cpp) | AudioQueue 预填、回调、排空 |
| [`test_render_pcm.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/tests/test_render_pcm.cpp) | Catch2：加载/拒绝/游标（不开设备） |

可执行目标名：`learning_audio_render`。

## 五段串起来时，缺口要说清

仓内贯通说明：[audio/pipeline.md](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/audio/pipeline.md)。推荐一次串跑：

```bash
B=./experiments/build/audio
$B/capture/learning_audio_capture --seconds 3
$B/encode/learning_audio_encode
$B/local-transport/learning_audio_local_transport
$B/decode/learning_audio_decode
$B/render/learning_audio_render
```

该文点名的缺口（摘要，细节以仓为准）：

1. **解码不吃 UDP 接收端数据**：仍读 `encode.caf`；等价性靠本地传输逐包比对。
2. **CAF priming 时长偏差未修齐**：渲染照 `decode.wav` 原样播放。
3. **离线文件接力，不是实时流式**：没有边采边播，也没有真实网络抖动可练。

「讲得清管线」≠「做过实时管线」。【待核实：`pipeline.md` 人工验收勾选与验收日期是否已由你填写；仓内原始勾选目前仍为空。】

## 读完应带走什么

1. **渲染 = PCM → 扬声器**；设备 pull，你填 buffer。
2. **输出缓冲 ≠ jitter buffer**；旁路位置要分清。
3. **`frames_rendered` 只证明入队成功**；出声靠人耳。
4. **音频五段到此齐了**；贯通证据与缺口以 `pipeline.md` 为准。

下一篇：[视频采集](/posts/av-series-08-video-capture)（票 [`07-video-capture`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/07-video-capture.md)）：摄像头帧、NV12、PTS。学习仓里视频五段与旁路/WebRTC 对照短文已经落地，博客侧后续再按票拆写，本文不展开视频 API。
