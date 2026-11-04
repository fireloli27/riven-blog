---
title: 音视频系列 08：视频采集——摄像头帧写成 tight NV12 与 PTS manifest
date: "2026-11-04"
tags:
  - 音视频系列
  - 视频采集
  - AVFoundation
  - NV12
  - PTS
---

本文是「音视频学习工程」系列第 08 篇，对应学习仓票 [`07-video-capture`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/07-video-capture.md)（Status: done）。音频五段在[上一篇渲染](/posts/av-series-07-audio-render)收束；本篇进入视频侧第一段：从默认摄像头取到未压缩的 **Raw Video Frame**。

配套代码仓：[fireloli27/cpp-av-lab](https://github.com/fireloli27/cpp-av-lab)（默认分支 `master`）。下文命令均在该仓仓库根执行。

**本文覆盖：** 视频采集在五段里干什么；tight NV12 `420v` 与 PTS manifest；为何选 AVFoundation；1280×720 / 默认 30 帧的契约与跑通步骤。

**本文不覆盖：** 视频编码 / 传输 / 解码 / 渲染；A/V 同步实现；设备列表、屏幕共享、实时预览窗口；第三方媒体库。

上一篇：[音频渲染](/posts/av-series-07-audio-render)。仓内权威还可对照：

- 短文：[`docs/learning/video/capture.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/video/capture.md)
- 课记：[`docs/learning/video/capture.notes.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/video/capture.notes.md)
- 决策：[`docs/adr/0006-learning-video-capture-avfoundation-nv12.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0006-learning-video-capture-avfoundation-nv12.md)
- 源码：[`experiments/video/capture/`](https://github.com/fireloli27/cpp-av-lab/tree/master/experiments/video/capture)

## 采集在视频管线里干什么

视频五段同样是：**采集 → 编码 → 本地传输/打包 → 解码 → 渲染**。本课只做采集：摄像头 → **Raw Video Frame**（未压缩）。不编码、不发包、不弹播放窗口。

A/V 同步通常在接收/播放一带对齐音画——**本课不实现、不验收**。

## 三个容易混的词

| 词 | 白话 | 本课例子 |
| --- | --- | --- |
| Raw Video Frame | 未压缩的一帧像素 | tight NV12 `420v`，1280×720，每帧 **1,382,400** 字节 |
| PTS | 呈现时间戳 | `CMSampleBufferGetPresentationTimeStamp` → `pts_ns` |
| 容器 / 码流 | 压缩后或装盒后的东西 | 本课都没有；下一课才压 H.264 |

**tight** 表示去掉 `CVPixelBuffer` 的 row stride padding：Y 平面 `width×height`，随后 interleaved CbCr。`row stride` 不能当 visible width 用。

## 为何用 AVFoundation + NV12

[ADR-0006](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0006-learning-video-capture-avfoundation-nv12.md)：系统框架、无第三方；NV12 比 BGRA 更接近后续编码器输入。硬件不支持 720p / `420v` 时**明确失败**，不自动降级。

数据流（课记权威）：

```text
默认摄像头
  → AVCaptureVideoDataOutput 回调：校验 420v + 1280×720，拷贝 tight NV12 + PTS
  → 凑满 --frames 或 15 s 超时
  → staging 写盘后替换 out/video/capture/
       frames/frame-000000.nv12 …
       manifest.csv
       preview.png（首帧派生证据）
```

`--frames` ∈ **[1, 90]**，默认 **30**。manifest 表头固定含 `pts_ns` / `relative_pts_ns`（相对首帧为零）。

踩坑摘要：macOS 上仅设 `AVCaptureSessionPreset1280x720` 不够——`startRunning` 常把 `activeFormat` 打回 1080p；须在 start 后再钉死 720p / 30 fps，再挂 delegate。

## 怎么跑通

前置：macOS；摄像头权限给终端；默认摄像头可用；CMake ≥ 3.20；C++17；**cwd＝仓库根**；真开摄像头须非沙箱。Catch2 **不**访问摄像头。

```bash
cmake -S experiments -B experiments/build
cmake --build experiments/build --target learning_video_capture
./experiments/build/video/capture/learning_video_capture
# 可选：./experiments/build/video/capture/learning_video_capture --frames 10
```

成功时：exit 0；`out/video/capture/` 含逐帧 `.nv12`、`manifest.csv`、`preview.png`；日志含 `frames_captured` 等 token。人工看 PNG 应能认出刚拍画面。【待核实：你本机是否已按短文完成真人摄像头烟测；票面记录 2026-11-03 FaceTime `--frames 5` 通过，完整默认 30 帧与 `pipeline.md` 勾选日期仍以你填写为准。】

失败时：exit ≠ 0。旧 `out/video/capture/` **不能**当作本次成功证据。


## 踩坑与边界

- **Preset 不够**：课记写明，仅设 `AVCaptureSessionPreset1280x720` 后 `startRunning` 常把 `activeFormat` 打回 1080p；须在 start 后再钉死 720p / 30 fps，再挂 `AVCaptureVideoDataOutputSampleBufferDelegate`。
- **stride ≠ width**：拷贝时必须按 plane 的 `bytesPerRow` 去 padding；直接按 `width` 读会错位。
- **权限与沙箱**：真开摄像头须给终端权限，且非沙箱；Catch2 合成帧路径不证明本机摄像头可用。
- **失败不降级**：硬件不支持 720p / `420v` 就失败，不自动换成 BGRA 或更低分辨率。
- **旧产物**：exit ≠ 0 时，目录里可能仍是上次成功；不能当本次证据。
- **本课不做**：编码、发包、窗口预览、设备枚举、屏幕共享。

## 代码地图（对照用）

| 路径 | 一句话 |
| --- | --- |
| [`main.mm`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/video/capture/main.mm) | CLI、权限、会话、回调拷贝 |
| [`nv12.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/video/capture/nv12.cpp) | tight 打包，去 stride padding |
| [`capture_publish.mm`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/video/capture/capture_publish.mm) | staging、manifest、PNG |
| [`test_video_capture.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/tests/test_video_capture.cpp) | Catch2：合成 NV12 契约 |

可执行目标名：`learning_video_capture`。

## 读完应带走什么

1. **视频采集 = 摄像头 → Raw Video Frame**，本课不压码流、不发包。
2. **契约钉死**：1280×720 / NV12 `420v` / tight **1,382,400** 字节 + 含 PTS 的 `manifest.csv`。
3. **PNG 是派生证据**，权威仍是 `.nv12` 与 CSV；人工肉眼认画面即可。
4. **失败不降级、不静默改格式**；旧产物目录 ≠ 本次成功。
5. **A/V 同步位置在接收/播放一带**——本课只留下可供对齐的 PTS，不在采集里做同步实验。

下一篇：[视频编码](/posts/av-series-09-video-encode)（票 [`08-video-encode`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/08-video-encode.md)）：把本课目录压成 H.264 access unit（`encode.vau`）。
