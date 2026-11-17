---
title: 音视频系列 16：WebRTC 怎么建连——SDP、ICE 与 DTLS-SRTP
date: "2026-11-17"
tags:
  - 音视频系列
  - WebRTC
  - SDP
  - ICE
  - DTLS-SRTP
---

本文是「音视频学习工程」系列第 16 篇。上一篇讲了 RTP 包长什么样；这一篇讲两个端点怎么从「互不认识」走到「可以互相发 RTP」。

**本文覆盖：** WebRTC 建连的四块拼图；SDP 里的 m-line、方向、codec、BUNDLE；transceiver 是什么；ICE 如何选路；DTLS-SRTP 如何加密；一次典型建连时序；SFU 视角下的客户端连接。

**本文不覆盖：** SDP 的完整语法；TURN 服务器部署；ICE 穿透的所有边界情况；具体 libwebrtc API 的调用细节。

上一篇：[从一帧到 RTP](/posts/av-series-15-rtp-and-media-packets)。

## WebRTC 不是「一个协议」

初次接触很容易把 WebRTC 当成一个叫 WebRTC 的协议。实际上它是一组协议和 API 的组合，至少包含四块：

| 拼图 | 解决的问题 | 关键词 |
| --- | --- | --- |
| SDP / JSEP | 双方谈什么格式、收发什么 | offer、answer、m-line、codec |
| ICE | 两端走哪条网络路径 | candidate、STUN、TURN、连通性检查 |
| DTLS-SRTP | 媒体怎么加密 | 握手、指纹、密钥、SRTP |
| RTP / RTCP | 媒体和反馈怎么传 | SSRC、seq、timestamp、NACK |

这四块各管一件事。SDP 谈成了，不代表网络通；ICE 通了，不代表密钥谈好；DTLS 好了，才开始真正发媒体。

## SDP：一份媒体菜单

SDP 是会话描述，不是媒体本身。它像一份菜单：我支持哪些编码、每个媒体段是发还是收、用哪个端口、怎么复用。

一段简化后的 SDP：

```text
v=0
o=- 4611731400430051336 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0 1

m=audio 9 UDP/TLS/RTP/SAVPF 111
a=mid:0
a=sendrecv
a=rtcp-mux
a=rtpmap:111 opus/48000/2

m=video 9 UDP/TLS/RTP/SAVPF 96
a=mid:1
a=sendrecv
a=rtcp-mux
a=rtpmap:96 VP8/90000
```

先认识六行：

- `m=audio ...` / `m=video ...`：一个媒体段，也就是常说的 **m-line**。
- `a=mid:0`：这个媒体段的稳定标识，后续协商和 RTP 头扩展都用它。
- `a=sendrecv`：这个媒体段既发又收；也可以是 `sendonly`、`recvonly`、`inactive`。
- `a=rtpmap:96 VP8/90000`：payload type 96 对应 VP8，时钟 90 kHz。
- `a=group:BUNDLE 0 1`：这些 m-line 复用同一条传输通道。
- `a=rtcp-mux`：RTP 和 RTCP 复用同一个端口。

真实 SDP 还会有 ICE 候选、DTLS 指纹、`a=fmtp` 参数、simulcast 的 `a=rid` 等。初学时不要试图一次读完，先抓住「每个 m-line 是一段媒体协商」。

### offer / answer

WebRTC 用 offer/answer 模型：

1. 一方生成 offer，描述自己想要的媒体段。
2. 另一方回 answer，接受、拒绝或调整。
3. 双方按最终结果建立传输。

谁先发 offer 不是协议强制，但产品里通常会约定：客户端先发，服务端回 answer；或者服务端先发，客户端回 answer。关键是同一时刻只处理一个未完成的协商，避免「glare」。

## m-line 与 transceiver

`m-line` 是 SDP 里的媒体段；`transceiver` 是 API 层的「收发器」，把一个 sender 和一个 receiver 绑在一个 `mid` 上。

可以把 transceiver 理解成一个「媒体槽位」：

- 方向可以是 `sendrecv`、`sendonly`、`recvonly`、`inactive`。
- 一个 `recvonly` 的槽位可以先建好，等以后有订阅时再绑定媒体，不必每次重新协商。
- 复用已有槽位通常不触发新的 offer/answer；新增槽位才需要改 m-line 结构。

这也是很多 SFU 产品做「订阅槽位池」的原因：把 m-line 的数量和订阅关系解耦，减少重协商。

## ICE：找到一条能走的路

SDP 告诉对方「我支持什么」，ICE 负责「我们怎么连上」。ICE 的核心是候选地址和连通性检查：

| 候选类型 | 含义 | 典型场景 |
| --- | --- | --- |
| host | 本机网卡地址 | 同一局域网 |
| srflx | 经 STUN 发现的公网映射 | 家用 NAT |
| relay | 经 TURN 分配的中继地址 | 对称 NAT、严格防火墙 |

双方交换候选后，会互相发 STUN 连通性检查。哪条路径先通、质量可用，就被提名（nominated）为正式路径。ICE restart 则是网络变化后重新选路，媒体可以短暂中断，但 Session 不必重建。

常见误解：ICE 不是一台服务器；STUN 和 TURN 才是服务器。ICE 是一套「收集候选、配对、检查、提名」的算法。

## DTLS-SRTP：媒体怎么加密

ICE 打通后，双方在选定的路径上做 DTLS 握手。DTLS 握手会协商出密钥，随后媒体用 SRTP 加密。SDP 里的 `a=fingerprint:sha-256 ...` 用来校验握手证书，防止中间人。

三个层次不要混：

- **信令加密**：WebSocket 的 TLS，保护 SDP、订阅等控制消息。
- **DTLS**：在媒体路径上握手，建立密钥。
- **SRTP**：真正加密 RTP 包。

DTLS 不是应用层加密，也不等于「信令已经加密所以媒体也安全」。媒体路径是另一条连接，需要单独握手。

## 一次典型建连时序

```text
Client                     Signaling                     SFU
  |  Join -------------------> |                          |
  |  <------------- JoinAccepted（含 ICE servers）         |
  |                                                         |
  |  create PC / add transceivers                           |
  |  createOffer -----------------------------------------> |
  |                            |  relay offer -----------> |
  |                            |  <--------- answer ------ |
  |  <---------------------------------------- answer ----- |
  |                                                         |
  |  ICE connectivity checks <============================> |
  |  DTLS handshake <=====================================> |
  |  RTP / RTCP <=========================================> |
```

注意几个边界：

- SDP 的交换走信令，媒体的 RTP 走另一条路。
- ICE 候选可以边收集边发（Trickle ICE），不必等全部收集完。
- DTLS 握手在 ICE 选出的路径上做，通常和媒体复用同一组端口。
- 只有 DTLS 完成后，SRTP 媒体才真正开始。

## SFU 视角：每个参与者一条 PC

在 SFU 架构里，通常是「每个参与者与 SFU 建一条 PeerConnection」：

- 客户端发布 Track，就是在这条 PC 上增加发送方向的 m-line。
- 客户端订阅 Track，就是在这条 PC 上增加接收方向的 m-line，或复用已有槽位。
- SFU 作为 answerer，负责接受/拒绝这些媒体段，并把上行媒体转发给其他参与者。

这条 PC 同时承载上行和下行。BUNDLE 把多条 m-line 复用同一条传输，减少端口和 ICE 开销。客户端增加订阅时，可能需要一次重协商；复用槽位则不需要。

还要区分两种信令：

- **Call Signaling**：邀请、振铃、接听、挂断，归业务 App。
- **Media Signaling**：SDP、ICE、订阅、发布，归 Client SDK 与 SFU。

把两者混在一条消息里不是不可以，但设计时要明确边界，否则重连、鉴权、协议版本会互相牵连。

## 四个常见误解

- **SDP 不是媒体流。** 它只是描述；真正的包是 RTP。
- **ICE 不是服务器。** 它是选路算法；STUN/TURN 才是服务器。
- **DTLS 不是信令加密。** 它保护媒体路径的密钥协商。
- **`sendrecv` 不是「双方发同一条 Track」。** 它只描述这个 m-line 的方向，具体发什么由 Track 和订阅关系决定。

## 下一篇

连接建立后，SFU 收到的是已经打包好的 RTP。它为什么不直接把包原样转给每个订阅者？下一篇讲「包缝」：解析、组帧、重写、再打包，以及为什么透传不等于 memcpy。

下一篇：[SFU 为什么不能逐包转发](/posts/av-series-17-sfu-forwarding-seam)。
