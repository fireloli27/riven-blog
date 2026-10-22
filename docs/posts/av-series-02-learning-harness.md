---
title: 音视频系列 02：Learning harness——怎么搭地基、怎么验收
date: "2026-10-22"
tags:
  - 音视频系列
  - Learning harness
  - CMake
  - Catch2
---

本文是「音视频学习工程」系列第 02 篇，对应学习仓票 [`01-learning-harness`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/01-learning-harness.md)（Status: done）。

配套代码仓：[fireloli27/cpp-av-lab](https://github.com/fireloli27/cpp-av-lab)（默认分支 `master`）。下文命令均在该仓仓库根执行。

**本文覆盖：** harness 要解决什么问题；目录与主缝约定；如何配置、编译、跑通占位实验；自动化护栏怎么用；本票明确不做的事。

**本文不覆盖：** 音频采集 / 编码等真实管线阶段（后续文章写）；Client AV SDK 或 SFU 产品实现；Cursor agent 沙箱排障细节以外的 IDE 配置。

上一篇：[在项目里用 Matt Pocock Skills 记录与推进](/posts/matt-pocock-skills-av-learning)。本篇落到第一张票：先把「能重复跑实验、能按短文验收」的地基钉死。

仓内权威说明还可对照：

- 总览：[docs/learning/harness/README.md](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/harness/README.md)
- 占位短文：[docs/learning/harness/placeholder.md](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/harness/placeholder.md)
- 占位源码：[experiments/harness/placeholder/](https://github.com/fireloli27/cpp-av-lab/tree/master/experiments/harness/placeholder)

## 这张票要解决什么

在写采集、编码之前，先证明三件事在同一仓库里成立：

1. `experiments/` 能用 CMake 配置并编译。
2. 存在**独立可执行入口**，人工可按短文从仓库根跑通。
3. 廉价、可观察的成功产物有契约，且可用 Catch2 自动化护住。

占位实验**不是** Learning Pipeline Stage 里的任一段。它只证明主缝约定可操作：不调媒体 API，不选采集 / 编解码库。

## 主缝：各自入口 + 短文验收

约定（grilling 2026-10-20，retro 后保留）：

- 每一 Learning Pipeline Stage（以及 harness 占位）提供**各自可执行入口**。
- 在 macOS 上按对应短文步骤手动跑通，以短文写明的可观察结果验收。
- **不做**统一 pipeline runner。
- 可无硬件复现的契约另由 Catch2 + CTest 护栏覆盖；需麦克风 / 摄像头等人工确认的判据仍以短文为准。

短文、课记、`teach/` 的分工：

| 层 | 路径 | 权威写什么 |
| --- | --- | --- |
| 短文 | `docs/learning/.../{stage}.md` | 怎么跑、怎么验收（主缝） |
| 课记 | 同目录 `{stage}.notes.md` | 本阶段契约与代码地图 |
| teach 教室 | [`teach/`](https://github.com/fireloli27/cpp-av-lab/tree/master/teach) | 个人进修；**不是** Learning 硬毕业交付 |

harness 占位不要求课记。后续管线阶段票 `/implement` 收官必写课记。

## 目录怎么摆

| 用途 | 路径（对照仓） |
| --- | --- |
| CMake 工程根 | [`experiments/`](https://github.com/fireloli27/cpp-av-lab/tree/master/experiments) |
| 构建目录 | `experiments/build/`（增量复用；迭代间不要删；已 gitignore） |
| FetchContent 缓存 | `experiments/.fetchcontent/`（Catch2；清 build 后可免重下） |
| 可观察产物 | 仓库根下 `out/`（运行时 **cwd＝仓库根**） |
| 短文模板 | [`docs/learning/_template.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/_template.md) |
| 课记模板 | [`docs/learning/_notes_template.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/_notes_template.md) |
| harness 总览 | [`docs/learning/harness/README.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/harness/README.md) |
| 占位短文 | [`docs/learning/harness/placeholder.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/harness/placeholder.md) |
| 占位代码 | [`experiments/harness/placeholder/`](https://github.com/fireloli27/cpp-av-lab/tree/master/experiments/harness/placeholder) |
| 自动化测试 | [`experiments/tests/`](https://github.com/fireloli27/cpp-av-lab/tree/master/experiments/tests) |
| 一键护栏 | [`scripts/check-learning.sh`](https://github.com/fireloli27/cpp-av-lab/blob/master/scripts/check-learning.sh) |

阶段目录（`02+` 再建；本票不预建空目录）：

- 实验：`experiments/{audio|video}/{capture,encode,local-transport,decode,render}/`
- 短文：`docs/learning/{audio|video}/` 同名 `.md`

明确不做：跨阶段 `experiments/common`（真出现第三次重复再另开票）；产品未决（信令承载、SFU 选型、部署等）。（仓内已有后续音频实验目录时，仍以各阶段短文为准，不改变 harness 占位「非管线段」的定位。）

短文模板固定七栏：目标、前置、选用库、运行步骤、可观察成功判据、失败时仍记录什么、与主缝关系。正文中文；路径、命令、目标名、GLOSSARY 术语与格式词保留英文。

## 跑通占位实验

前置：macOS；CMake ≥ 3.20；C++17 编译器（如 Apple Clang）；cwd 为仓库根；无需麦克风 / 摄像头；实验代码无第三方媒体库（系统框架允许）。

```bash
git clone https://github.com/fireloli27/cpp-av-lab.git
cd cpp-av-lab
cmake -S experiments -B experiments/build
cmake --build experiments/build
./experiments/build/harness/placeholder/learning_placeholder
```

可观察成功判据：

- 命令退出码为 0
- 仓库根出现 `out/harness/placeholder-ok.txt`
- 文件内容包含一行：`learning_placeholder: ok`

若失败：记下 CMake 配置 / 编译错误原文；若编译成功但未生成产物，记下实际 cwd、二进制路径与终端输出。

占位目标名为 `learning_placeholder`，源码在 [`experiments/harness/placeholder/`](https://github.com/fireloli27/cpp-av-lab/tree/master/experiments/harness/placeholder)。

## 自动化护栏

一键入口：

```bash
./scripts/check-learning.sh
```

等价于：configure + 并行 build + `ctest --test-dir experiments/build --output-on-failure`。该命令**不**访问麦克风 / 摄像头。

占位产物契约由 [`experiments/tests/test_placeholder_artifact.cpp`](https://github.com/fireloli27/cpp-av-lab/blob/master/experiments/tests/test_placeholder_artifact.cpp)（Catch2，FetchContent 拉取）覆盖。

本机可用 [`scripts/install-git-hooks.sh`](https://github.com/fireloli27/cpp-av-lab/blob/master/scripts/install-git-hooks.sh) 把 pre-commit 指到同一护栏；GitHub Actions 的 [`.github/workflows/learning.yml`](https://github.com/fireloli27/cpp-av-lab/blob/master/.github/workflows/learning.yml)（macOS）跑同一脚本。

根 [`.gitignore`](https://github.com/fireloli27/cpp-av-lab/blob/master/.gitignore) 忽略 `build/`、`experiments/build/`、`out/`、`.DS_Store`。

## Acceptance 对照（本票已完成）

票面 Acceptance 的核心条目可概括为：

1. `experiments/` 为 CMake 工程根，macOS 上可配置并编译。
2. 占位目标写出 `out/harness/placeholder-ok.txt`；不调媒体 API。
3. 短文模板与样例短文按七栏写实。
4. harness 总览写清 CMake、cwd、`out/`、主缝与护栏；不写排期、不拍板产品未决。
5. Catch2 + CTest 与 `scripts/check-learning.sh` 通过。

流程上：`/grill-me` 定布局与契约 → `/implement` 落盘 → `/retro` 补上 Catch2 与一键脚本，Status → `done`。

## 下一篇

下一篇写音频采集票：对照 [`02-audio-capture.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/.scratch/learning-project/issues/02-audio-capture.md) 与 [`docs/learning/audio/capture.md`](https://github.com/fireloli27/cpp-av-lab/blob/master/docs/learning/audio/capture.md)，在已有 harness 上验收「能采到可观察的音频」，并说明课记应钉死哪些契约。地基篇能单独读完；后续阶段都假设你已能跑通 `learning_placeholder` 与 `./scripts/check-learning.sh`。
