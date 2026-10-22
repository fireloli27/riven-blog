---
title: 音视频系列 01：在项目里用 Matt Pocock Skills 记录与推进
date: "2026-10-22"
tags:
  - 音视频系列
  - Cursor
  - Matt Pocock Skills
  - 学习工程
---

本文是「音视频学习工程」系列的开篇。目标只有一个：在真实学习仓里，用 [mattpocock/skills](https://github.com/mattpocock/skills) **把判断写进文件，再按文件施工**。

**本文覆盖：** 仓内记什么、记在哪；从 `setup` 到每张票的 `grill → implement → retro` 怎么跑。

**本文不覆盖：** 各 skill 的内部实现；采集 / 编码等具体音视频 API（后续文章按票写）；Cursor 安装排障。

目标管线（系列后续会拆开写）：采集 → 编码 → 本地传输 → 解码 → 渲染。学习仓先把管线跑通；正式产品仓可以后开。

## 先固定一条主线

Matt 的 skill 分两类：

- **User-invoked**：你手动 `/名字` 编排，例如 `setup-matt-pocock-skills`、`grill-with-docs`、`to-spec`、`to-tickets`、`implement`、`retro`、`teach`、`ask-matt`
- **Model-invoked**：装可复用纪律，Agent 也可能自己调用，例如 `tdd`、`code-review`、`domain-modeling`、`grilling`

不确定用哪个时，先打 `/ask-matt`。学习工程按这条线跑：

```text
setup
  → grill-with-docs（愿景与术语）
  → to-spec + 产品假设册
  → to-tickets
  → 每张阶段票：grill → implement → retro
```

`grill` 时可以并行 `/teach`。阶段「怎么跑、怎么算过」仍以短文 / 课记为准，见下一节。

## 先约定记什么、记在哪

动手写代码之前，先把路径钉死。本系列使用的分层：

| 资产 | 路径 | 用途 |
| --- | --- | --- |
| 术语表 | `GLOSSARY.md` | 全仓共同语言；产品词只保留一份 |
| 架构决策 | `docs/adr/` | 难回头的选择与理由 |
| Agent 配置 | `docs/agents/`、`AGENTS.md` | issue 位置、标签、文档布局、语言约定 |
| 规格 | `.scratch/<feature>/spec.md` | 学习工程毕业标准 |
| 产品假设 | `.scratch/<feature>/product-hypotheses.md` | 愿景当假设；验证钩子；未决不代定 |
| 工单 | `.scratch/<feature>/issues/` | 可交付单元与 blocking edges |
| 阶段短文 | `docs/learning/.../{stage}.md` | 怎么跑、怎么验收（阶段契约） |
| 课记 | `docs/learning/.../{stage}.notes.md` | 概念与代码地图 |
| 实验代码 | `experiments/...` | 只为短文验收服务 |
| 教学教室 | `teach/` | `/teach` 个人进修；与工程文档分开 |

记录时遵守三条：

1. 学习交付与产品愿景分册写。
2. 未决事项写明「本轮不代为决定」。
3. 阶段契约的唯一来源是短文 / 课记；`teach/` 可以链接过去，不能反过来当契约。

每个仓做一次安装与约定：

```bash
npx skills@latest add mattpocock/skills -a cursor
```

勾选并运行 `/setup-matt-pocock-skills`。推荐配置：本地 markdown issue；单上下文 `GLOSSARY`；正文中文；术语、API、路径、命令保留英文。

## 按主线推进

### 开仓：愿景级 grill

对整条学习工程运行 `/grill-with-docs`，钉死产品词、五段硬范围、未决事项。同一上下文再运行 `/to-spec`，并另写 `product-hypotheses.md`。

在 Cursor 里：`grill-with-docs` 依赖 `grilling` 与 `domain-modeling`。若一轮问完却不更新 `GLOSSARY`，先检查子 skill 是否已加载。

### 拆票：把「记」变成可施工单元

运行 `/to-tickets`。每张票至少写清：

1. What to build
2. Blocked by（只写技术依赖）
3. Acceptance
4. Status

本系列票序：`01` harness → 音频五段 → 视频五段 → 管线叙述 → WebRTC 对照。

拆票规则：

- blocking edges 只表示技术依赖，不表示学习顺序偏好。
- 视频采集通常只依赖 harness，可与音频并行。
- 若故意串行，在票上写明。

### 每张阶段票：小循环

```text
本票 /grill-with-docs → 更新票面与 ADR → /implement → /retro
```

| 规则 | 做法 |
| --- | --- |
| 愿景 `spec` | 不代替本段 API 决策；每票再 grill |
| `implement` | 只做 Acceptance；未决不代定 |
| 测试 | `tdd` / Catch2 只护无硬件契约 |
| 收官 | 产出阶段短文与课记；代码挂在短文验收上 |
| `retro` | 改环境与流程；不改已拍板的需求 |

未决未拍板时，不要运行 `implement`。不要把 `ready-for-agent` 当成已经 grill 完成。

建议：`grill`、`to-spec`、`to-tickets` 放在同一对话；每张 `implement` 新开对话。

### 并行 `/teach`

用 `teach/` 补概念；课可以链到课记。阶段验收仍以 `docs/learning/` 下的短文与课记为准。

## 何时换更重的 skill

范围还能装进一次对话时，继续 `grill` → `to-spec` → `to-tickets`。

| 情况 | 换用 |
| --- | --- |
| 路线不清、要跨多会话 | `wayfinder` |
| 难复现的 bug | `diagnosing-bugs` |
| 结构糊成泥球 | `improve-codebase-architecture` |
| 换仓交接 | `handoff` |
| 迷路 | `ask-matt` |

## 检查清单

**开仓**

1. 安装 skills，运行 `setup`
2. 运行 `grill` → `to-spec` → `to-tickets`
3. 检查 blocking edges
4. 提交一次 git，再开始第一张票的 `implement`

**每票**

1. 运行 `grill`，钉死 Acceptance
2. 新对话运行 `implement`
3. 按短文人工跑一遍
4. 运行 `retro`

**系列毕业（后续文章逐项写）**

- 音视五段都有短文与课记
- 能讲清 SDK、两种信令、SFU
- 有 WebRTC 对照
- 加分包可以后做，不挡毕业

## 常见问题

| 症状 | 对策 |
| --- | --- |
| 人与 Agent 未对齐 | 回到 grill |
| 同一概念多名 | 更新 `GLOSSARY` 与 ADR |
| 代码能跑但对不上验收 | 按短文验收；用 Catch2 与 `tdd` 护契约 |
| 实验堆成泥球 | 缩小实验范围；必要时用 `improve-codebase-architecture` |

Skill 不替你做工程判断。它要求你把判断写成仓内文件，再按文件推进。

## 下一篇

下一篇从 `01` harness 票写起：如何把「能重复跑实验」grill 清楚，并落到短文验收。

## 附录：Cursor

- 安装入口：[skills.sh](https://skills.sh)
- `/clear`、`/compact` 属于 Claude Code 语境；在 Cursor 里用新对话代替硬清空
- 对齐与拆票同窗；实现分窗
