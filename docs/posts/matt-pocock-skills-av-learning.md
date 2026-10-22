---
title: 音视频系列 01：在项目里实践 Matt Pocock Skills——怎么记、怎么推进
date: "2026-10-22"
tags:
  - 音视频系列
  - Cursor
  - Matt Pocock Skills
  - 学习工程
---

这是「音视频学习工程」系列的开篇。后面几篇会按管线拆开写：harness、音频五段、视频五段、管线叙述、WebRTC 对照。本文只谈一件事——**在真实项目仓里，怎么用 [mattpocock/skills](https://github.com/mattpocock/skills) 把判断记下来，并按文件推进**。

目标管线是：采集 → 编码 → 本地传输 → 解码 → 渲染。正式产品仓可以后开；学习仓先把管线跑通，并把「为什么这样定」写进仓库。

核心不是让 AI 替你写完，而是：先对齐语言和边界 → 拆成可验收的小票 → 每票拍板后再实现 → 用 `retro` 改下一次的环境。

## 1. 项目里先定主线

Matt 的 skill 大致分两类：

- **User-invoked**：你手动 `/名字` 编排流程，例如 `setup-matt-pocock-skills`、`grill-with-docs`、`to-spec`、`to-tickets`、`implement`、`retro`、`teach`、`ask-matt`
- **Model-invoked**：装可复用纪律，Agent 也可能自己用，例如 `tdd`、`code-review`、`domain-modeling`、`grilling`

迷路时先 `/ask-matt`。学习工程固定这样跑：

```text
setup
  → grill-with-docs（愿景与术语）
  → to-spec + 产品假设册
  → to-tickets
  → 每张阶段票：grill → implement → retro
```

`grill` 时可以并行 `/teach`，但工程契约仍以短文 / 课记为准（见下文）。

## 2. 怎么记：先把仓分成几层

实践这套方法，**第一件事不是写代码，而是约定「什么写在哪」**。我用的分层如下：

| 资产 | 放哪 | 记什么 |
| --- | --- | --- |
| 术语表 | 根目录 `GLOSSARY.md` | 全仓共同语言，产品词只保留一份 |
| 架构决策 | `docs/adr/` | 难回头的选择与理由 |
| Agent 配置 | `docs/agents/` + `AGENTS.md` | issue 放哪、标签、文档布局、语言约定 |
| 规格 | `.scratch/<feature>/spec.md` | 本学习工程的毕业标准 |
| 产品假设 | `.scratch/<feature>/product-hypotheses.md` | 愿景当假设写；验证钩子；**未决不代定** |
| 工单 | `.scratch/<feature>/issues/` | 可交付单元 + blocking edges |
| 阶段短文 | `docs/learning/.../{stage}.md` | 怎么跑、怎么验收（阶段契约） |
| 课记 | `docs/learning/.../{stage}.notes.md` | 概念与代码地图 |
| 实验代码 | `experiments/...` | 为短文服务，不为「顺便做产品」膨胀 |
| 教学教室 | `teach/` | `/teach` 个人进修，和工程文档分开 |

三条记录原则：

1. **学习交付**和**产品愿景**分册写，别混在一篇里。
2. 未决事项写明「本轮不代为决定」，避免 Agent 替你拍板。
3. 阶段契约的 SSOT 是短文 / 课记；`teach/` 可以链过去，但不能反过来当契约。

装仓与语言约定（每个仓一次）：

```bash
npx skills@latest add mattpocock/skills -a cursor
```

勾选并跑 `/setup-matt-pocock-skills`。推荐：本地 markdown issue；单上下文 `GLOSSARY`；正文中文，术语 / API / 路径 / 命令保留英文。

## 3. 怎么推进：愿景对齐 → 拆票 → 小循环

### 3.1 愿景级 grill（开仓做一次）

对整条学习工程跑 `/grill-with-docs`：钉死产品词、五段硬范围、未决事项。同一上下文再 `/to-spec`，并另写 `product-hypotheses.md`。

Cursor 注意：`grill-with-docs` 依赖 `grilling` + `domain-modeling`。若问完一轮却不提 `GLOSSARY`，先检查子 skill 是否挂上。

### 3.2 拆票（把「记」变成可施工单元）

跑 `/to-tickets`。一张好票至少写清：

- What to build
- Blocked by（**只写技术依赖**）
- Acceptance
- Status

本系列票序大致是：`01` harness → 音频五段 → 视频五段 → 管线叙述 → WebRTC 对照。

拆票时额外钉死：

- blocking edges ≠「学习心情」
- 视频采集通常只依赖 harness，可与音频并行
- 故意串行要在票上写明

### 3.3 每张阶段票的小循环（日常心脏）

```text
本票 /grill-with-docs → 更新票面 + ADR → /implement → /retro
```

落地时按这几条执行：

| 规则 | 含义 |
| --- | --- |
| 愿景 `spec` 不够用 | 它不替你定本段 API；**每票再 grill** |
| `implement` 边界 | 只做 Acceptance；未决不代定 |
| 测试 | `tdd` / Catch2 只护无硬件契约 |
| 收官物 | 阶段短文 + 课记，代码挂在短文验收上 |
| `retro` | 改环境与流程，不改已经拍板的需求 |

明确禁止：未决未拍板就 `implement`；把 `ready-for-agent` 当成已经 grill 完。

建议节奏：`grill` / `to-spec` / `to-tickets` 尽量同窗；**每张 `implement` 新开对话**，避免上下文串味。

### 3.4 并行 `/teach`，但不抢契约

`teach/` 用来补概念；课可以链到课记。阶段「怎么跑、怎么算过」仍以 `docs/learning/` 下的短文 / 课记为准。

## 4. 工具升档：什么时候换更重的 skill

范围还能装进一次对话：继续 `grill` → `to-spec` → `to-tickets`。

| 情况 | 换什么 |
| --- | --- |
| 路线糊、要跨多会话 | `wayfinder` |
| 难 bug | `diagnosing-bugs` |
| 结构糊成泥球 | `improve-codebase-architecture` |
| 换仓交接 | `handoff` |
| 迷路 | `ask-matt` |

## 5. 检查清单（开仓 / 每票 / 系列毕业）

**开仓**

1. `add skills` → `setup`
2. `grill` → `to-spec` → `to-tickets`
3. 检查 blocking
4. 再 `git`，再开始第一张票的 `implement`

**每票**

1. `grill` → 钉 Acceptance
2. 新对话 `implement`
3. 人工按短文跑一遍
4. `retro`

**本系列毕业（后续文章会逐项写）**

- 音视五段都有短文 + 课记
- 能讲清 SDK / 两种信令 / SFU
- 有 WebRTC 对照
- 加分包可以后做，不挡毕业

## 6. 常见翻车与对策

| 症状 | 对策 |
| --- | --- |
| 人和 Agent 没对齐 | 回到 grill |
| 词乱、同一概念多名 | 补 `GLOSSARY` + ADR |
| 代码「能跑」但对不上验收 | 短文验收 + Catch2 + `tdd` |
| 实验堆成泥球 | 缩小实验；必要时 `improve-codebase-architecture` |

一句话：Skill 不替你拥有工程判断。它逼你把判断写成仓里的文件，然后按文件施工。

## 下一篇预告

下一篇从 `01` harness 票开始：怎么把「能重复跑实验」这件事 grill 清楚，并落到短文验收。若你也在用这套 skills，欢迎对照自己仓里的路径表，看「记」和「推进」有没有断点。

## 附录：Cursor 小提示

- 安装入口：[skills.sh](https://skills.sh)
- `/clear`、`/compact` 是 Claude Code 语境；Cursor 里用新对话代替「硬清空」
- 同窗做对齐与拆票；分窗做实现

## 带走四句

1. 先约定记什么、记在哪，再 `setup` 与愿景 `grill`
2. 每票固定：`grill` → `implement` → `retro`
3. 学习与产品假设分册；未决不代定
4. blocking 只写技术依赖；教学走 `teach`，契约走短文 / 课记
