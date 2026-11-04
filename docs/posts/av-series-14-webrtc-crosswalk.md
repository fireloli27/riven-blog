---
title: 音视频系列 14：WebRTC 对照——学习五段在 libwebrtc 里叫什么
date: "2026-11-04"
tags:
  - 音视频系列
  - WebRTC
  - libwebrtc
  - 对照
  - RTP
---

本文是「音视频学习工程」系列第 14 篇，对应学习仓票 [`13-webrtc-crosswalk`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/13-webrtc-crosswalk.md)（Status: done）。本篇是**解释文**：把 Learning Pipeline Stages 与旁路，映射到 **libwebrtc** 客户端源码树上的对应概念。权威原文：[`docs/learning/webrtc-crosswalk.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/webrtc-crosswalk.md)。

**改这棵树、编过它、或提交补丁，都不是验收条件。** 学习仓不 vendoring libwebrtc。

**本文覆盖：** 材料基线；五段与旁路在栈里的落点；学习 Transport Unit 与 RTP 的差别；`pc/` 与 Call Signaling / SFU 的关系。

**本文不覆盖：** 编译或修改 libwebrtc 的步骤；把 VAU / 长度前缀 / 1200 分片说成 RTP；选定产品 WebRTC 版本；操作五段实验（见系列 03–12）。

上一篇：[管线旁路与职责边界](/posts/av-series-13-pipeline-boundaries)。

## 材料基线（学习对照用）

| 项 | 值 |
| --- | --- |
| 树 | [webrtc.googlesource.com/src](https://webrtc.googlesource.com/src/) |
| 分支 | `refs/heads/main` |
| 查阅日 | **2026-11-03** |
| 位置 | `refs/heads/main@{#49134}` |
| 该次提交 | Change-Id `I4fe360e90a4ed5c777ed3e05a82fb0b43e2b820d`（[webrtc-review 513200](https://webrtc-review.googlesource.com/c/src/+/513200)） |

`main` 会继续走；本篇不改写产品选哪一版（仓内 U4 / U9 仍开）。路径以该次查阅为准。

学习选型（Opus、H.264、长度前缀、UDP 分片、AppKit）是 macOS 教学替身。WebRTC 包格式是 **RTP**，不是本仓库的 Transport Unit。

## 五段对照（模块边界，不是文件格式）

| 学习阶段 | 本仓库在做什么 | libwebrtc 里对应什么 |
| --- | --- | --- |
| 采集（音） | AudioQueue PCM | `AudioDeviceModule`（`modules/audio_device/`） |
| 采集（视） | AVFoundation → NV12 + PTS | `modules/video_capture/` |
| 编码（音） | `AudioConverter` → Opus 64 kbps | `AudioEncoder` / `modules/audio_coding/` |
| 编码（视） | `VTCompressionSession` → H.264 2 Mbps | `VideoEncoder`；发送管线 `video/video_stream_encoder.cc` |
| 本地传输/打包 | 长度前缀或 1200 分片 UDP；**不是 RTP** | H.264 RTP：`rtp_format_h264.cc` 的 `RtpPacketizerH264`（FU-A / STAP-A）；连通在 `p2p/` |
| 解码（音） | 按 Opus AU → PCM；不读 UDP | `NetEq`：入包与出 PCM（jitter + 解码） |
| 解码（视） | `VTDecompressionSession`；参数集在 VAU 头 | `video_receive_stream2.cc` + `VideoDecoder`；先过视频 jitter buffer |
| 渲染（音） | AudioQueue output | 同一 `AudioDeviceModule` 播放方向（主钟） |
| 渲染（视） | AppKit 按 `relative_pts_ns` | `video/render/`；何时画要跟同步模块一起看 |

学习路径是五次独立进程、用 `out/` 文件接力；libwebrtc 是同时跑着的发送/接收管线。对照的是**边界**，不是把文件格式一一等价。


## 怎么读这张对照表

对照的是**模块边界**，不是文件格式一一等价：

- 学习路径是五次独立进程、用 `out/` 文件接力；libwebrtc 是一条同时跑着的发送/接收管线。
- 学习视频分片只对应「一个 access unit 可能变成多个 datagram」；头不是 FU-A，也没有 RTP sequence / timestamp / SSRC。
- 学习音频解码按 access unit 直接还原 PCM；WebRTC 侧接收包先进 `NetEq`，jitter buffer 与解码在那里是一件事。
- 学习视频渲染按自己的 `relative_pts_ns` 刷新；WebRTC 侧「什么时候该画」要和同步模块一起看，不是来一帧画一帧。

旁路落点以 [系列 13](/posts/av-series-13-pipeline-boundaries) 为准：固定 64 kbps / 2 Mbps、AudioQueue 的 3×960 帧、视频渲染 200 ms 夹断、本机 UDP 环回，都只是五段实验自己的机制，**不是** AEC / 弱网 / jitter / A/V 同步的实现。

## 旁路对照

位置叙述以[系列 13](/posts/av-series-13-pipeline-boundaries) / [`pipeline-boundaries.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/pipeline-boundaries.md) 为准。栈内落点摘要：

- **AEC**：`EchoCanceller3`（`modules/audio_processing/aec3/`）
- **弱网码率自适应**：`modules/congestion_controller/goog_cc/` → 进入 `video_stream_encoder.cc`；音频侧还有 audio network adaptor
- **jitter buffer**：音频 `NetEq`；视频 `video_stream_buffer_controller.cc` + `modules/video_coding/timing/`
- **A/V 同步**：`rtp_streams_synchronizer2.cc` / `stream_synchronization.cc`

学习实验里的固定码率、AudioQueue 缓冲、200 ms 夹断、本机环回，都**不是**这些旁路的实现。

## 信令与 SFU

`pc/` 做会话描述与 ICE 一类**媒体面**协商：可读作 Media Signaling 的一种客户端实现，**不要**读成 Host App 的邀请/振铃/挂断。Media Signaling 承载通道 **未决 #1** 仍开。

SFU 转发已打包媒体流；对应真实网络上「本地传输/打包」那一侧，而不是采集/解码/渲染。这份客户端树**不包含** SFU。

## 本篇不证明什么

- 不证明本仓库的 VAU、长度前缀或 1200 字节分片等于 RTP。
- 不证明产品必须采用 `main@{#49134}`，也不关闭仓内 U4 / U9。
- 不证明有人改过、编译过或跑通 libwebrtc——那不是毕业条件。
- 不证明 Media Signaling 必须走 SDP over 某条 WebSocket；承载通道未决 #1 仍开。

系列到此，学习仓毕业叙述与对照短文已可在博客侧对齐。加分包（实时流式、旁路动手、双端互通）仍按仓内约定后置，不挡「讲得清管线」。
