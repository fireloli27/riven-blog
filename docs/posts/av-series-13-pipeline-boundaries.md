---
title: 音视频系列 13：管线旁路与职责边界——五段之外还要讲清什么
date: "2026-11-04"
tags:
  - 音视频系列
  - 管线
  - AEC
  - jitter buffer
  - SFU
---

本文是「音视频学习工程」系列第 13 篇，对应学习仓票 [`12-pipeline-narrative`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/12-pipeline-narrative.md)（Status: done）。音、视五段实验已经各自跑通；本篇是**解释文**：说明真实通话里还得有、但学习实验故意没做的旁路，以及 Client AV SDK / SFU / 两种信令的职责边界。

配套权威原文：[`docs/learning/pipeline-boundaries.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/pipeline-boundaries.md)。术语以仓内 [`GLOSSARY.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/GLOSSARY.md) 为准。

**本文覆盖：** AEC、弱网码率自适应、jitter buffer、A/V 同步各自落点；为何不能用学习实验的固定码率 / 环回 / 输出缓冲 / 200 ms 夹断冒充它们；Call Signaling vs Media Signaling；SDK 与 SFU 各管什么。

**本文不覆盖：** 动手调通上述旁路（加分包）；操作步骤或命令；WebRTC 源码路径对照（下一篇）；拍板 Media Signaling 承载或产品必须 RTP。

上一篇：[视频渲染](/posts/av-series-12-video-render)。已跑通的路径证据见 [音频贯通](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/audio/pipeline.md) 与 [视频贯通](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/video/pipeline.md)——它们证明的是**离线文件接力**。

## 四件旁路都不是五段之一

Learning Pipeline Stages 仍然只有五段。旁路要能**放进叙述**，缺了不影响 Learning Exit Criteria；动手是加分包。

### AEC

在**发送侧**：采集之后、编码之前。参考信号取自**音频渲染**即将播出的远端 PCM，用来从近端采集里减掉扬声器漏音。视频窗口不产生回声参考。学习仓音频路径编码前没有这一步。

### 弱网码率自适应

卡在**网络反馈和编码器之间**：根据丢包、延迟改码率 / 分辨率 / 帧率。触发来自传输之后的反馈，不是采集。学习实验音频 64 kbps、视频 2 Mbps 固定，没有反馈回路。

### jitter buffer

在**接收之后、解码之前**，吸收网络到达抖动。不要和这两件事混：

- 音频渲染 3×960 帧是**输出缓冲**（调度抖动）
- 视频渲染 200 ms PTS 夹断只防异常时间戳卡住窗口（包没经过网络）

本机 UDP 环回没有人为丢包，也没有 jitter buffer。

### A/V 同步

在**接收 / 播放**一带：音频设备时钟当主钟，视频按 PTS 提前、推迟或丢掉。学习仓音、视渲染是两次分开的进程，两条都跑通仍**没有**音画对齐实验。

## 谁负责哪一段

```text
Host App ── Call Signaling ──► 对端 Host App / 既有 IM
   └── Client AV SDK
         采集 →（AEC）→ 编码 → 打包/发送
         渲染 ←（A/V 同步）← 解码 ← jitter buffer ← 接收
                                    ↕ Media Signaling（承载未决）
                                  SFU：转发已编码的流
```

**Client AV SDK** 盖住客户端五段与旁路，以及和 SFU 之间的 Media Signaling。它不是面向用户的通话 App，也不自建 Call Signaling。学习实验是在 macOS 上把五段拆开跑通，不是该 SDK 的产品实现。

**SFU** 站在已编码媒体面上转发；基本不解码、不混画；不兼任 Call Signaling。学习工程没有 SFU 进程；环回只代替本机上的「编码之后、解码之前」。

## 两种信令不要搅在一起

**Call Signaling**：邀请、振铃、接听、挂断、进房离房。归 **Host App**，走既有 IM。

**Media Signaling**：SDK↔SFU 的媒体描述、传输候选、订阅与转发。承载通道（复用 IM、独立 WebSocket/HTTP、随媒体通道等）是 **spec 未决 #1**——本篇不选。

产品「打包」是否必须 RTP 是 **spec 未决 #5**：学习音频用长度前缀，学习视频拆 UDP 分片；两边都不收口产品协议。

## 本篇不证明什么

- 不证明四件旁路已调通。
- 不证明 RTP 必选，也不证明 Media Signaling 走哪条连接。
- 不证明 SFU 自研还是改造开源。

下一篇：[WebRTC 对照](/posts/av-series-14-webrtc-crosswalk)：把五段与旁路映射到 libwebrtc 客户端树里的对应概念。
