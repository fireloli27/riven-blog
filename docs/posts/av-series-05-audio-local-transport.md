---
title: 音视频系列 05：音频本地传输——把 Opus 包打成 Transport Unit，本机环回收发
date: "2026-11-04"
tags:
  - 音视频系列
  - 本地传输
  - Transport Unit
  - UDP
  - Opus
---

本文是「音视频学习工程」系列第 05 篇，对应学习仓票 [`04-audio-local-transport`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/04-audio-local-transport.md)（Status: done）。上一篇把 PCM 压成 Opus 并装进 CAF；本篇吃那份 `encode.caf`，把里面的 **access unit** 打成可收发的 **Transport Unit**，在本机 UDP 环回上证明「发出去的载荷」与「收回来的载荷」一致。

配套代码仓：[fireloli27/cpp-av-lab](https://github.com/fireloli27/cpp-av-lab)（默认分支 `master`）。下文命令均在该仓仓库根执行。

**本文覆盖：** 「本地传输/打包」在五段里干什么；access unit 与 Transport Unit 差在哪；为何用长度前缀而不是先定产品 RTP；48 kHz Opus CAF → 环回比对的契约与跑通步骤；护栏护什么。

**本文不覆盖：** 解码与渲染（后续两篇）；ICE / TURN / SRTP；双进程互通；jitter buffer 实现；产品是否必须 RTP（仓内 spec 未决仍开）。

上一篇：[音频编码](/posts/av-series-04-audio-encode)。仓内权威还可对照：

- 短文：[`docs/learning/audio/local-transport.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/audio/local-transport.md)
- 课记：[`docs/learning/audio/local-transport.notes.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/audio/local-transport.notes.md)
- 决策：[`docs/adr/0003-learning-audio-local-transport-length-prefix-udp.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0003-learning-audio-local-transport-length-prefix-udp.md)
- 源码：[`experiments/audio/local-transport/`](https://github.com/fireloli27/cpp-av-lab/tree/master/experiments/audio/local-transport)

## 本段在管线里干什么

五段里本课是第三段：**采集 → 编码 → 本地传输/打包 → 解码 → 渲染**。

编码交出的是 **Opus access unit**（压缩后的包）。本课不把它解回 PCM，而是回答：这些包如何变成「能在链路上走一圈」的发送单元，以及本机自发自收之后载荷是否逐字节一致。

两句先钉位置、本课不实现：

- **jitter buffer**：通常在接收之后、解码之前，吸收网络到达抖动。
- **产品 RTP**：学习单元用长度前缀；**不等于**拍板「正式产品必须（或禁止）RTP」。对照与收口留给后续 WebRTC 短文与未决项。

## 两个容易混的词

| 词 | 白话 | 本课例子 |
| --- | --- | --- |
| access unit | 编解码器一次吐出的压缩包 | CAF 里读出的 Opus 包 |
| Transport Unit | 可发送/接收的环回单元 | `uint32` 大端 length + 上述载荷 |

编码课里的 `frames_per_packet` 描述的是**编码器分包大小**。本课的 Transport Unit 是「一个 access unit + 长度前缀」。不要把两套「包」混成同一个概念。

本课 **Transport Unit** 契约（课记权威）：

- `uint32` **大端** length + 载荷
- length = 载荷字节数（不含这 4 字节）
- **无** seq / timestamp / SSRC

环回：单进程 POSIX UDP、`127.0.0.1`，`bind` 临时端口后自发自收。不做双进程、ICE、TURN、SRTP。

## 为何先长度前缀，不先 DIY RTP

[ADR-0003](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/adr/0003-learning-audio-local-transport-length-prefix-udp.md)：在「打包是否必须 RTP」仍未决时，仍要练发送/接收单元直觉。长度前缀比最小 DIY RTP 更不易被读成「产品协议已经定了」。真实 RTP 映射放到 WebRTC 对照短文，不在本票重写环回协议。

数据流（课记权威）：

```text
out/audio/encode/encode.caf（或 --input）
  → AudioFileReadPacketData 读出 Opus access unit
  → pack_transport_unit（大端 length + 载荷）
  → UDP 环回：bind 127.0.0.1:0 → sendto 自己 → recvfrom → unpack 校验
  → 写出 out/audio/local-transport/loopback-ok.txt
```

成功条件：`units_sent == units_recv`，且逐包载荷字节一致。本票**不**解码、不写 PCM；也不把「UDP 收到的落盘序列」定为下一课硬输入。

## 怎么跑通

前置：macOS；CMake ≥ 3.20；C++17；**cwd＝仓库根**。本可执行文件不采麦、不播扬声器；默认要先有编码产物。

```bash
git clone https://github.com/fireloli27/cpp-av-lab.git
cd cpp-av-lab
cmake -S experiments -B experiments/build
cmake --build experiments/build --target learning_audio_local_transport
# 若尚无 encode.caf：
./experiments/build/audio/capture/learning_audio_capture --seconds 1
./experiments/build/audio/encode/learning_audio_encode
./experiments/build/audio/local-transport/learning_audio_local_transport
# 可选：./experiments/build/audio/local-transport/learning_audio_local_transport --input path/to/opus.caf
```

成功时：exit 0；覆盖写出 `out/audio/local-transport/loopback-ok.txt`；日志含 `units_sent` / `units_recv` / `payload_bytes_*` / `port`。产物固定四行（课记权威），含 `units=`、`payload_bytes=`、`port=`。

失败时：stderr 简述且 exit ≠ 0。旧的 `loopback-ok.txt` **不能**当作本次成功证据。`./scripts/check-learning.sh` 用合成载荷护组包/拆包与环回，不读真人 `encode.caf`。

## 代码地图（对照用）

| 路径 | 一句话 |
| --- | --- |
| [`main.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/local-transport/main.cpp) | CLI、读 CAF、环回、写产物 |
| [`transport_unit.hpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/local-transport/transport_unit.hpp) | `pack` / `unpack` |
| [`udp_loopback.hpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/local-transport/udp_loopback.hpp) | 单进程临时端口环回 |
| [`read_opus_caf.hpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/audio/local-transport/read_opus_caf.hpp) | AudioToolbox 读 Opus 包 |
| [`test_local_transport.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/tests/test_local_transport.cpp) | Catch2：组包/拆包 + UDP |

可执行目标名：`learning_audio_local_transport`。

## 读完应带走什么

1. **本段做打包与本机收发校验**，不解回 PCM。
2. **access unit ≠ Transport Unit**：前者是压缩包，后者是「长度前缀 + 载荷」。
3. **学习长度前缀 ≠ 产品必须 RTP**；未决项保持开放。
4. **成功证据**是单元数相等且载荷一致，外加 `loopback-ok.txt`。

下一篇：[音频解码](/posts/av-series-06-audio-decode)（票 [`05-audio-decode`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/05-audio-decode.md)）：直接读 `encode.caf` 里的 Opus access unit，按包还原 PCM。环回一致性已由本课证明，解码课不重跑 UDP。
