---
title: 音视频系列 10：视频本地传输——一个 access unit 拆成 UDP 分片环回
date: "2026-11-04"
tags:
  - 音视频系列
  - 本地传输
  - Transport Unit
  - UDP
  - H.264
---

本文是「音视频学习工程」系列第 10 篇，对应学习仓票 [`09-video-local-transport`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/09-video-local-transport.md)（Status: done）。上一篇写出 `encode.vau`；本篇把每个 H.264 access unit 的 **AVCC 载荷**打成 **Transport Unit**，在本机 UDP 环回上拆片、重组并逐字节比对。

配套代码仓：[fireloli27/cpp-av-lab](https://github.com/fireloli27/cpp-av-lab)（默认分支 `master`）。下文命令均在该仓仓库根执行。

**本文覆盖：** 视频打包与音频长度前缀差在哪；为何要分片；分片头字段；跑通与成功判据；为何这不是产品 RTP。

**本文不覆盖：** 解码与渲染；ICE / TURN / SRTP；丢包重传；把 SPS/PPS 放进环回；拍板产品必须 RTP（spec 未决 #5 仍开）。

上一篇：[视频编码](/posts/av-series-09-video-encode)。仓内权威还可对照：

- 短文：[`docs/learning/video/local-transport.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/video/local-transport.md)
- 课记：[`docs/learning/video/local-transport.notes.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/video/local-transport.notes.md)
- 决策：[`docs/adr/0008-learning-video-local-transport-fragmented-udp.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0008-learning-video-local-transport-fragmented-udp.md)
- 源码：[`experiments/video/local-transport/`](https://github.com/fireloli27/cpp-av-lab/tree/master/experiments/video/local-transport)

## 本段在管线里干什么

第三段：**压缩码流 → Transport Unit**。验证「打包 ≠ 编码」，以及「一个单元可以分成多个 datagram」。jitter buffer 在接收后、解码前——**本课不实现**。

参数集（SPS/PPS）**留在 VAU 文件头，不单独发送**。环回只走 access unit 载荷。

## 音频一包一发，视频常要拆片

音频课一个 access unit 通常装进一个 datagram（长度前缀即可）。一帧 H.264 往往更大，学习实验把单片载荷钉在 **1200** 字节，所以同一 Transport Unit 拆成多片。

| 字段（大端，每片都带） | 含义 |
| --- | --- |
| `uint32 au_length` | 整个 access unit 字节数 |
| `uint16 frag_index` / `frag_count` | 片序号与片数 |
| `uint32 au_index` | 本文件内单元序号，**只用于重组** |

头里**没有** RTP sequence / timestamp / SSRC。`au_index` 不是 RTP sequence number。学习分片只对应「一个 access unit 可能变成多个 datagram」；WebRTC 里才是 `RtpPacketizerH264` 的 FU-A。

[ADR-0008](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0008-learning-video-local-transport-fragmented-udp.md) 只锁定学习选型，**不**收口产品是否必须 RTP。

数据流：

```text
encode.vau → read_vau 取载荷（不发参数集）
  → split_access_unit → UDP 自发自收 → reassemble
  → 与原载荷逐字节比较 → loopback-ok.txt
```

## 怎么跑通

前置：macOS；已有 `encode.vau`；CMake ≥ 3.20；C++17；**cwd＝仓库根**；非沙箱更稳妥。无需摄像头。

```bash
cmake -S experiments -B experiments/build
cmake --build experiments/build --target learning_video_local_transport
./experiments/build/video/local-transport/learning_video_local_transport
```

成功时：exit 0；`out/video/local-transport/loopback-ok.txt`；`units_sent == units_recv`，载荷字节与分片数两侧相等。日志含 `fragments_*`、`frag_payload_max`、`port` 等。

失败时：exit ≠ 0。旧 artifact ≠ 本次成功。超时或少一片就失败，不做重传。

下一课解码**仍读 `encode.vau`**，不读 socket。本课的逐字节一致，就是「载荷可以原样交给解码器」的证据。


## 踩坑与边界

- **这不是 RTP**：对照短文里的 FU-A 才是 WebRTC 的 H.264 分片；本票头只有长度、片序号、片数和重组用的 `au_index`。
- **参数集不进环回**：解码器靠 VAU 文件头建 format description。若只拿到 UDP 载荷而没有文件头，解不开——离线接力缺口，不是本票信令。
- **不做丢包重传**：超时或少一片就失败；本机环回也没有人为丢包实验。
- **旧 artifact ≠ 本次成功**：exit ≠ 0 时不要读上次的 `loopback-ok.txt`。
- **没有这些开关**：无 `--port`、无双进程、无 ICE/TURN/SRTP、无 jitter buffer。
- **解码不吃 socket**：下一课仍读 `encode.vau`；本课只证明「载荷可以原样走一圈」。

## 代码地图（对照用）

| 路径 | 一句话 |
| --- | --- |
| [`main.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/video/local-transport/main.cpp) | CLI、环回、写 artifact |
| [`transport_unit.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/video/local-transport/transport_unit.cpp) | 拆片 / 重组 |
| [`udp_loopback.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/video/local-transport/udp_loopback.cpp) | `127.0.0.1` 临时端口 |
| [`test_video_local_transport.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/tests/test_video_local_transport.cpp) | Catch2：乱序重组 + 环回 |

可执行目标名：`learning_video_local_transport`。

## 读完应带走什么

1. **打包把已压好的 access unit 装进可环回单元**；它不是编码器内部的 NAL 切分，也不是产品 RTP。
2. **视频常要分片**（学习上限 1200 字节/片）；头字段只服务本机重组，没有 RTP sequence / timestamp / SSRC。
3. **分片 ≠ RTP**；spec 未决 #5 仍开——本 ADR 不收口产品必须或禁止 RTP。
4. **参数集不进环回**；解码仍靠 VAU 文件头。
5. **本课成功证据是两侧计数 + 逐字节一致**，不是「已经做过实时网络」。

下一篇：[视频解码](/posts/av-series-11-video-decode)：`VTDecompressionSession` 按 access unit 解回 tight NV12。
