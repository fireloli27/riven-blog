---
title: 音视频系列 09：视频编码——NV12 压成 H.264，装进学习容器 VAU
date: "2026-11-04"
tags:
  - 音视频系列
  - 视频编码
  - VideoToolbox
  - H.264
  - VAU
---

本文是「音视频学习工程」系列第 09 篇，对应学习仓票 [`08-video-encode`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/08-video-encode.md)（Status: done）。上一篇留下 tight NV12 与 PTS；本篇用 **VideoToolbox** 压成 **H.264** access unit，写入学习容器 `encode.vau`。

配套代码仓：[fireloli27/cpp-av-lab](https://github.com/fireloli27/cpp-av-lab)（默认分支 `master`）。下文命令均在该仓仓库根执行。

**本文覆盖：** 视频编码在管线里干什么；VAU 与 MP4 差在哪；为何 Baseline + 软件编码器 + 固定 2 Mbps；跑通步骤与一对一帧约束。

**本文不覆盖：** RTP / 自定义分片（下一篇）；弱网码率自适应实现；FFmpeg / x264；打开摄像头。

上一篇：[视频采集](/posts/av-series-08-video-capture)。仓内权威还可对照：

- 短文：[`docs/learning/video/encode.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/video/encode.md)
- 课记：[`docs/learning/video/encode.notes.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/video/encode.notes.md)
- 决策：[`docs/adr/0007-learning-video-encode-videotoolbox-h264.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0007-learning-video-encode-videotoolbox-h264.md)
- 源码：[`experiments/video/encode/`](https://github.com/fireloli27/cpp-av-lab/tree/master/experiments/video/encode)

## 编码在视频管线里干什么

本课是第二段：**Raw Video Frame → 压缩码流**。一个 Raw Video Frame 对应一个 access unit；丢帧即失败。弱网码率自适应会回头改编码目标——本课码率固定，**不实现、不验收**。

## VAU 是学习盒子，不是产品容器

| 词 | 白话 | 本课例子 |
| --- | --- | --- |
| Raw Video Frame | 未压缩帧 | 采集目录里的 `.nv12` |
| access unit | 一帧压好的压缩单元 | H.264 AVCC 载荷 |
| VAU | 学习容器 | `encode.vau`：参数集（SPS/PPS）+ 每帧载荷与 PTS |

不用 MP4/MOV：那些容器会把 access unit 藏进 sample table。VAU 用大端字段把 SPS/PPS 与每帧 AVCC + PTS 摊开，方便下一课只取**载荷**做 Transport Unit，也方便解码重建 format description。VAU **不是**产品容器选型。

## 为何用 VTCompressionSession H.264

[ADR-0007](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0007-learning-video-encode-videotoolbox-h264.md)：系统 API、无 FFmpeg；Baseline 且 `AllowFrameReordering = false`，避开 B 帧，看见「一帧进、一个 access unit 出」。请求**软件**编码器，便于 CI 与「无硬件编码器」环境。码率固定 **2 Mbps**；GOP 最长 30；第一帧强制 keyframe。产品是否必须 RTP 仍未决，本票不做 RTP。

数据流（课记权威）：

```text
out/video/capture/（或 --input）
  → 读 manifest + tight NV12（须 1280×720 / 420v / 1,382,400 字节）
  → VTCompressionSessionEncodeFrame
  → staging 写出 encode.vau + manifest.csv → 替换 out/video/encode/
```

交给编码器的 `CMTime` 是帧序号 / 30；写入 VAU 的 `pts_ns` 仍是采集 PTS。

## 怎么跑通

前置：macOS；已有采集目录（或不打开摄像头的等价输入）；CMake ≥ 3.20；C++17；**cwd＝仓库根**；`VTCompressionSession` 须非沙箱。【待核实：本机真人采集目录是否已跑通编码；Catch2 / Actions 护的是合成帧路径，不等于你本机摄像头全链路已验收。】

```bash
cmake -S experiments -B experiments/build
cmake --build experiments/build --target learning_video_encode
# 若尚无采集产物：
./experiments/build/video/capture/learning_video_capture --frames 5
./experiments/build/video/encode/learning_video_encode
```

成功时：exit 0；`out/video/encode/encode.vau` 与 `manifest.csv`；`frames_encoded == access_units`，`keyframes ≥ 1`；日志含 `codec`、`bitrate_bps` 等 token。

失败时：exit ≠ 0。旧 `out/video/encode/` ≠ 本次成功。输入不是 720p `420v` 就失败，不缩放。


## 踩坑与边界

- **一对一**：一帧进、一个 access unit 出；丢帧即失败，不偷偷补帧。
- **输入契约硬**：不是 1280×720 / `420v` / 正确字节数就失败，**不缩放**。
- **软件编码器**：请求软件路径，避免 CI「无硬件编码器」环境假绿或假红；本机有硬件也不把硬件当成验收前提。
- **无 B 帧**：`AllowFrameReordering = false`，否则「一帧进一个单元」被重排打乱。
- **固定 2 Mbps**：只说明「能压出码流」，不说明拥塞时会让路；弱网自适应是旁路，不在本课。
- **VAU ≠ MP4**：不要拿产品容器选型解读学习盒子；参数集写在文件头，方便下一课只取载荷。
- **沙箱**：`VTCompressionSession` 须非沙箱；旧 `out/video/encode/` ≠ 本次成功。

## 代码地图（对照用）

| 路径 | 一句话 |
| --- | --- |
| [`main.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/video/encode/main.cpp) | CLI、读目录、打日志 |
| [`encode_vt.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/video/encode/encode_vt.cpp) | VTCompressionSession → VAU |
| [`vau.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/video/encode/vau.cpp) | 大端 VAU 读写 |
| [`test_video_encode.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/tests/test_video_encode.cpp) | Catch2：合成帧编码 / VAU 往返 |

可执行目标名：`learning_video_encode`。

## 读完应带走什么

1. **编码 = Raw Video Frame → H.264 access unit**；一对一，丢帧即失败。
2. **VAU 摊开 SPS/PPS 与每帧载荷 + PTS**，方便下一课打包、再下一课建 format description；它不是产品容器。
3. **固定 2 Mbps / Baseline / 无 B 帧 / 软件编码器**是学习选型，不是产品码控策略。
4. **本课不做 RTP、不做弱网自适应**；产品打包是否必须 RTP 仍未决。
5. **交给编码器的时钟是序号/30**；文件里的呈现时间仍是采集 PTS——别把两者混成「已经做了 A/V 同步」。

下一篇：[视频本地传输](/posts/av-series-10-video-local-transport)：把每个 access unit 载荷拆成可重组的 UDP 分片环回。
