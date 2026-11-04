---
title: 音视频系列 12：视频渲染——按 PTS 把 NV12 交给 AppKit 窗口
date: "2026-11-04"
tags:
  - 音视频系列
  - 视频渲染
  - AppKit
  - PTS
  - 管线
---

本文是「音视频学习工程」系列第 12 篇，对应学习仓票 [`11-video-render`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/11-video-render.md)（Status: done）。上一篇写出解码目录；本篇用 **AppKit** 窗口按 **Presentation Timestamp** 相对间隔显示画面。到这里，视频五段都有独立入口。

配套代码仓：[fireloli27/cpp-av-lab](https://github.com/fireloli27/cpp-av-lab)（默认分支 `master`）。下文命令均在该仓仓库根执行。

**本文覆盖：** 视频渲染在终点干什么；`frames_presented` 含义；200 ms PTS 夹断不是 jitter buffer；跑通步骤；对照 [`video/pipeline.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/video/pipeline.md) 的贯通缺口。

**本文不覆盖：** 实现 A/V 同步 / jitter buffer / AEC；外部查看器打开 PNG；音画同进程对齐实验；旁路职责长文（见系列 13）。

上一篇：[视频解码](/posts/av-series-11-video-decode)。仓内权威还可对照：

- 短文：[`docs/learning/video/render.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/video/render.md)
- 课记：[`docs/learning/video/render.notes.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/video/render.notes.md)
- 贯通：[`docs/learning/video/pipeline.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/video/pipeline.md)
- 决策：[`docs/adr/0010-learning-video-render-appkit.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0010-learning-video-render-appkit.md)
- 源码：[`experiments/video/render/`](https://github.com/fireloli27/cpp-av-lab/tree/master/experiments/video/render)

## 渲染在管线里干什么

第五段：**可显示帧 → 画面**。默认读 `out/video/decode/`；也可 `--input` 指向同契约的 `out/video/capture/` 做短路预览。本课**不写** `out/` 新文件。

`frames_presented` 只证明成功 `setImage:` 的次数；窗口里能不能看见，靠人眼。【待核实：你是否在有图形会话的本机看过完整五段串跑窗口；`video/pipeline.md` 人工勾选与日期是否已填。】

## 旁路先钉位置（本课不实现）

1. **jitter buffer** 在接收后、解码前；不是这里的显示等待。
2. **A/V 同步**通常以音频设备时钟为主钟；本实验只放视频，只按自己的 `relative_pts_ns` 往前播。
3. **AEC 参考**取自音频渲染路径，不取自这个窗口。

超过 **200 ms** 的 PTS 间隔会夹到 200 ms，避免异常时间戳卡住窗口。它**不是** jitter buffer，包也没经过网络。

## 为何用 NSWindow + NSImageView

[ADR-0010](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0010-learning-video-render-appkit.md)：要看见「帧字节交给显示对象」这一步，而不是藏进播放器或 `AVSampleBufferDisplayLayer`。窗口内容区 960×540 point，源像素仍是 1280×720。

数据流：

```text
decode/ → load_frame_directory → 算 presentation_delays_ns
  → 每帧：等待 → Core Image 转 NSImage → NSImageView
  → 末帧再停 0.5 s → 打印 frames_loaded / frames_presented
```

成功判据：`frames_loaded == frames_presented`。

## 怎么跑通

前置：macOS；图形会话；已有解码目录；CMake ≥ 3.20；C++17；**cwd＝仓库根**。Catch2 **不**创建窗口。

```bash
cmake -S experiments -B experiments/build
cmake --build experiments/build --target learning_video_render
./experiments/build/video/render/learning_video_render
```

成功时：exit 0；窗口标题 `learning_video_render`；能看见有损解码画面。失败时：exit ≠ 0；中途闪过的窗口不算成功。

## 视频五段串起来时的缺口

仓内贯通：[video/pipeline.md](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/video/pipeline.md)。

```bash
B=./experiments/build/video
$B/capture/learning_video_capture --frames 30
$B/encode/learning_video_encode
$B/local-transport/learning_video_local_transport
$B/decode/learning_video_decode
$B/render/learning_video_render
```

缺口摘要：解码不吃 UDP；参数集不进环回；有损且固定 2 Mbps；离线文件接力而非实时；分片不是 RTP。「讲得清」≠「做过实时管线」。


## 踩坑与边界

- **无图形会话**：窗口出不来；这不是 Catch2 的失败条件——契约测试只测目录加载与 PTS 间隔。
- **200 ms 夹断 ≠ jitter buffer**：它只防异常时间戳卡住窗口；包没有经过网络。
- **只播视频**：没有音频主钟，就还没有 A/V 同步实验；别把「按 `relative_pts_ns` 播」说成音画已对齐。
- **不写 `out/`**：无 `--device`、无全屏、无屏幕共享；旧解码目录不被本程序修改。
- **失败语义**：exit ≠ 0 时不会打印成功行；中途闪过的窗口不算成功。
- **贯通缺口**以 [`pipeline.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/video/pipeline.md) 为准：解码不吃 UDP、参数集不进环回、离线文件接力、分片不是 RTP。

## 代码地图（对照用）

| 路径 | 一句话 |
| --- | --- |
| [`main.mm`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/video/render/main.mm) | 窗口、按间隔 `setImage:` |
| [`render_frames.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/video/render/render_frames.cpp) | 读目录、算 delay |
| [`test_video_render.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/tests/test_video_render.cpp) | Catch2：PTS 夹断 / 加载拒绝 |

可执行目标名：`learning_video_render`。

## 读完应带走什么

1. **渲染 = 帧 → 窗口**；`frames_presented` 只计成功 `setImage:`，人眼观感仍要你自己看。
2. **200 ms 夹断 ≠ jitter buffer**；本实验没有音频主钟，也就没有 A/V 同步验收。
3. **视频五段到此齐了**：采集 → 编码 → 本地传输 → 解码 → 渲染；缺口以 `pipeline.md` 为准。
4. **「讲得清管线」≠「做过实时管线」**：离线文件接力证明的是分段能接上，不是丢包与时钟漂移已对付。
5. **旁路与职责边界**见下一篇解释文，不再混进操作步骤。

下一篇：[管线旁路与职责边界](/posts/av-series-13-pipeline-boundaries)（解释文，无实验入口）。
