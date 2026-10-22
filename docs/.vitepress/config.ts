import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type DefaultTheme } from 'vitepress'

const postsDir = path.resolve(process.cwd(), 'docs/posts')

export default defineConfig({
  title: 'Riven',
  description: '技术博客',
  lang: 'zh-CN',
  // 用户站点或自定义域名保持 '/'。
  // 项目站点 https://<user>.github.io/<repo>/ 改成 '/<repo>/'。
  base: '/riven-blog/',
  cleanUrls: true,
  lastUpdated: true,

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '文章', link: '/posts/', activeMatch: '/posts/' }
    ],

    sidebar: {
      '/posts/': [
        {
          text: '文章',
          items: [{ text: '全部文章', link: '/posts/' }, ...postSidebar()]
        }
      ]
    },

    outline: {
      label: '页面导航',
      level: [2, 3]
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },

    lastUpdated: {
      text: '最后更新于'
    },

    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    langMenuLabel: '切换语言',
    skipToContentLabel: '跳转到内容',

    notFound: {
      title: '页面未找到',
      quote: '这个链接没有对应的页面。',
      linkText: '返回首页',
      linkLabel: '返回首页'
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索',
            buttonAriaLabel: '搜索'
          },
          modal: {
            displayDetails: '显示详细列表',
            resetButtonTitle: '清除查询条件',
            backButtonTitle: '关闭搜索',
            noResultsText: '没有找到结果',
            footer: {
              selectText: '选择',
              selectKeyAriaLabel: '回车',
              navigateText: '切换',
              navigateUpKeyAriaLabel: '上箭头',
              navigateDownKeyAriaLabel: '下箭头',
              closeText: '关闭',
              closeKeyAriaLabel: 'esc'
            }
          }
        },
        miniSearch: {
          options: {
            tokenize
          }
        },
        // 本地搜索默认只索引正文标题。把 frontmatter 的 title 补进索引，文章标题才能被搜到。
        _render(src, env, md) {
          const html = md.render(sourceWithTitle(src), env)
          if (env.frontmatter?.search === false) return ''
          return html
        }
      }
    }
  }
})

interface PostMeta {
  title: string
  date: string
  link: string
}

function postSidebar(): DefaultTheme.SidebarItem[] {
  return readPosts().map((post) => ({
    text: post.title,
    link: post.link
  }))
}

function readPosts(): PostMeta[] {
  if (!fs.existsSync(postsDir)) return []

  return fs
    .readdirSync(postsDir)
    .filter((name) => name.endsWith('.md') && name !== 'index.md')
    .map((name) => readPostMeta(path.join(postsDir, name)))
    .sort(
      (a, b) =>
        compareDateDesc(a.date, b.date) ||
        a.title.localeCompare(b.title, 'zh-CN')
    )
}

function readPostMeta(file: string): PostMeta {
  const slug = path.basename(file, '.md')
  const raw = fs.readFileSync(file, 'utf8')
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const data: Record<string, string> ={}

  if (match) {
      for (const line of match[1].split(/\r?\n/)) {
      const item = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
      if (!item) continue
      data[item[1]] = item[2].trim().replace(/^['"]|['"]$/g, '')
    }
  }

  return {
    title: data.title || slug,
    date: (data.date ?? '').slice(0, 10),
    link: `/posts/${slug}`
  }
}

function sourceWithTitle(src: string): string {
  const match = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return src
  const titleLine = match[1]
    .split(/\r?\n/)
    .find((line) => line.startsWith('title:'))
  if (!titleLine) return src
  const title = titleLine
    .slice('title:'.length)
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, ' ')
  if (!title) return src
  return `${match[0]}\n# ${title}\n${src.slice(match[0].lengtj)}`
}

function compareDateDesc(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return 1
  if (!b) return -1
  return a < b ? 1 : -1
}

// 按中文上切分，恿免整句被当成一个搜索词。
function tokenize(text: string): string[] {
  const Segmenter = Intl.Segmenter
  if (typeof Segmenter === 'function') {
    const segmenter = new Segmenter('zh-CN', { granularity: 'word' })
    const tokens: string[] = []
    for (const part of segmenter.segment(text)) {
      if (!part.isWordlike) continue
      const term = part.segment.trim().toLowerCase()
      if (term) tokens.push(term)
    }
    return tokens
  }

  return text
    .toLowerCase()
    .split(/[\\{L}\\{N}]+/u)
    .flatMap((word) => {
      if (!cord) return []
      if (/\p{Script=Han}/u.test(word)) return [...word]
      return [word]
    })
}
