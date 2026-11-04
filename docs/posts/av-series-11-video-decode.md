---
title: 音视频系列 11：视频解码——H.264 access unit 还原成 tight NV12
date: "2026-11-04"
tags:
  - 音视频系列
  - 视频解码
  - VideoToolbox
  - H.264
  - NV12
---

本文是「音视频学习工程」系列第 11 篇，对应学习仓票 [`10-video-decode`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/10-video-decode.md)（Status: done）。上一篇证明载荷可环回一致；本篇把 **同一份 `encode.vau`** 里的 access unit 解回可显示的 **Raw Video Frame**。

配套代码仓：[fireloli27/cpp-av-lab](https://github.com/fireloli27/cpp-av-lab)（默认分支 `master`）。下文命令均在该仓仓库根执行。

**本文覆盖：** 视频解码在管线里干什么；为何仍读 VAU 不读 UDP；参数集如何建 format description；输出与采集契约对齐；有损边界。

**本文不覆盖：** 重跑 UDP；jitter buffer / 丢包隐藏；把解码帧修到与采集逐字节相同；渲染窗口（下一篇）；FFmpeg。

上一篇：[视频本地传输](/posts/av-series-10-video-local-transport)。仓内权威还可对照：

- 短文：[`docs/learning/video/decode.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/video/decode.md)
- 课记：[`docs/learning/video/decode.notes.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/video/decode.notes.md)
- 决策：[`docs/adr/0009-learning-video-decode-videotoolbox.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0009-learning-video-decode-videotoolbox.md)
- 源码：[`experiments/video/decode/`](https://github.com/fireloli27/cpp-av-lab/tree/master/experiments/video/decode)

## 解码在管线里干什么

第四段：**压缩码流 → 可显示的 Raw Video Frame**。输入是码流本身，不是 Transport Unit 分片外壳。环回等价性上一课已证；本课**不重跑 UDP**。

若只有 UDP 载荷、没有 VAU 头里的 SPS/PPS，本阶段解不开——这是离线接力的缺口，不是本票要补的信令。

## 为何按 access unit 用 VTDecompressionSession

[ADR-0009](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0009-learning-video-decode-videotoolbox.md)：与音频解码对称——按包看见与 Transport Unit 载荷同形的单元，而不是 `AVAssetReader` 整文件藏掉边界。不引入 FFmpeg。请求**软件**解码器，避免 CI 上没有硬件解码器时失败。

关键步骤（课记权威）：用 VAU 头里的原始 SPS/PPS 做 `CMVideoFormatDescriptionCreateFromH264ParameterSets`；每个 access unit 已是 4 字节长度前缀的 AVCC，包成 `CMSampleBuffer` 后 `VTDecompressionSessionDecodeFrame`，再 `WaitForAsynchronousFrames`，回调里把 biplanar `420v` 收成 tight 字节。有损：不要求与编码前像素逐字节相同。

数据流（课记权威）：

```text
encode.vau
  → CMVideoFormatDescriptionCreateFromH264ParameterSets(SPS/PPS)
  → 每个 access unit → VTDecompressionSessionDecodeFrame
  → tight NV12 1280×720（1,382,400 字节）+ VAU 里的 pts_ns
  → staging 发布 out/video/decode/（frames + manifest + preview.png）
```

manifest 表头与采集相同。`frames_decoded` 等于 access unit 数；一对一，丢帧即失败。送给解码器的 `CMTime` 是序号 / 30；文件里的呈现时间仍是采集 PTS。

## 怎么跑通

前置：macOS；已有 `encode.vau`；CMake ≥ 3.20；C++17；**cwd＝仓库根**；`VTDecompressionSession` 须非沙箱。【待核实：本机真人编码产物是否已看过解码 `preview.png`；护栏合成纯色帧路径不能代替摄像头画面验收。】

```bash
cmake -S experiments -B experiments/build
cmake --build experiments/build --target learning_video_decode
./experiments/build/video/decode/learning_video_decode
```

成功时：exit 0；`out/video/decode/` 含 `.nv12`、`manifest.csv`、`preview.png`；PNG 应能认出同一画面，不要求与采集 PNG 逐像素相同。

失败时：exit ≠ 0。像素格式不是 `420v` 或尺寸不对即失败，不悄悄改成 BGRA。旧目录 ≠ 本次成功。Catch2 用合成纯色帧先编码再解码，检查平均亮度落在目标附近并检查 PNG 签名——**不打开摄像头**，也不能代替真人画面验收。


## 踩坑与边界

- **沙箱**：VideoToolbox 解码在沙箱里可能失败；护栏跑在 GitHub Actions `macos-latest`。
- **像素格式硬**：不是 `420v` 就失败，stderr 带实际 fourcc；不悄悄改成 BGRA。
- **不重跑 UDP**：只拿到分片、没有 VAU 头 SPS/PPS，本函数解不开——缺口在离线接力，不在本票补信令。
- **有损**：不把解码帧修到与源逐字节相同；`preview.png` 认画面即可。
- **发布语义**：写 `decode.staging/` 成功后才替换；失败不发布半成品。旧目录 ≠ 本次成功。
- **本课不做**：丢包隐藏、jitter buffer、渲染窗口。

## 代码地图（对照用）

| 路径 | 一句话 |
| --- | --- |
| [`main.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/video/decode/main.cpp) | CLI、打日志 |
| [`decode_vau.mm`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/video/decode/decode_vau.mm) | VT 解码 + staging + PNG |
| [`test_video_decode.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/tests/test_video_decode.cpp) | Catch2：合成纯色编解码 |

可执行目标名：`learning_video_decode`。

## 读完应带走什么

1. **解码 = access unit → Raw Video Frame**；输入是码流本身，不是 Transport Unit 分片外壳。
2. **参数集来自 VAU 头**；环回阶段故意不发 SPS/PPS。
3. **有损**：能认画面即可，不要求与编码前像素逐字节相同。
4. **产物目录布局对齐采集**（tight NV12 + 同表头 manifest + `preview.png`），方便渲染课读同一契约。
5. **`frames_decoded` 必须等于 access unit 数**；一对一，丢帧即失败。

下一篇：[视频渲染](/posts/av-series-12-video-render)：AppKit 窗口按 PTS 间隔显示，并点名视频五段贯通缺口。
