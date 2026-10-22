# Riven 的技术博客

这是用 [VitePress](https://vitepress.dev/) 搭的个人技术博客骨架，方便用中文写 Markdown 文章。

## 本地预览

需要 Node.js 22 或更新版本。

在项目根目录执行：

```bash
npm install
npm run dev
```

终端会打印本地地址，用浏览器打开即可。默认是 `http://localhost:5173`。

构建并在本地检查产物：

```bash
npm run build
npm run preview
```

构建输出在 `docs/.vitepress/dist`。

## 添加一篇文章

新增一篇文章只需一个 Markdown 文件。

1. 在 `docs/posts/` 下新建文件，例如 `docs/posts/my-note.md`。文件名决定路径：`/posts/my-note`。不要用 `index.md` 这个名字，那个文件是文章列表页。
2. 在文件开头写上 frontmatter，至少包含下面的 `YYYY-MM-DD`：

```md
---
title: 我的第二篇笔记
date: "2026-10-22"
tags:
  - 笔记
---

这里开始写正文。
```

3. 保存。本地预览会自动刷新。文章列表和侧边栏都会出现这篇，不用改别的文件。
4. 满意后提交并推送到 `main`。

`docs/posts/index.md` 是列表页，里面的 `<Posts />` 负责列出文章，不要删掉。示例文章是 `docs/posts/example.md`，可以改掉，也可以直接删掉。

## 部署到 GitHub Pages

仓库里的 `.github/workflows/deploy.yml` 会在推送到 `main` 时构建站点，并用 GitHub 官方的 Pages action 发布。

推送之前，先在 GitHub 仓库设置里做这一步，否则第一次发布会失败：

**Settings → Pages → Build and deployment → Source → GitHub Actions**

之后每次推到 `main`。Actions 跑完后，站点地址大致是：

- 用户站点：`https://<用户名>.github.io/`
- 项目站点：`https://<用户名>.github.io/<仓库名>/`

如果地址带仓库名（项目站点），打开 `docs/.vitepress/config.ts`，把 `base` 改成 `'/<仓库名>/'`，再推送一次。用户站点保持 `base: '/'`。

本仓库已设为项目站点，`base` 为 `'/riven-blog/'`。

## 绑定自己的域名

可以以后再做，大致步骤：

1. 把 `docs/.vitepress/config.ts` 里的 `base` 改回 `'/'`。如果仍是项目站点路径改 `base`，这步需要再改回来。
2. GitHub 仓库 **Settings → Pages → Custom domain** 填上域名，并勾选 **Enforce HTTPS**。
3. 在域名服务商添加 DNS。子域名一般是 CNAME，指向 `<用户名>.github.io`。根域名用四条 A 记录，以 [GitHub Pages 自定义域名文档](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site) 里的官方地址为准。

## Cloudflare Pages

也可以不走 GitHub Actions，把仓库接到 Cloudflare Pages：

- 构建命令：`npm run build`
- 输出目录：`docs/.vitepress/dist`
- Node.js 版本：22
- `base` 保持 `'/'`

自定义域名在 Cloudflare Pages 的项目设置里绑定即可。

## 评论

还没有接评论。以后如果要加，可以用 [Giscus](https://giscus.app/)（基于 GitHub Discussions）。自定义站点没有评论组件。
