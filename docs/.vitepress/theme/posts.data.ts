import { createContentLoader } from 'vitepress'

export interface Post {
  title: string
  url: string
  date: string
  tags: string[]
}

declare const data: Post[]
export { data }

const INDEX_URLS = new Set(['/posts/', '/posts/index', '/posts/index.html'])

export default createContentLoader('posts/*.md', {
  transform(raw): Post[] {
    return raw
      .filter((page) => !INDEX_URLS.has(page.url))
      .map((page) => ({
        title: pageTitle(page.frontmatter.title, page.url),
        url: page.url,
        date: formatDate(page.frontmatter.date),
        tags: asTags(page.frontmatter.tags)
      }))
      .sort(
        (a, b) =>
          compareDateDesc(a.date, b.date) ||
          a.title.localeCompare(b.title, 'zh-CN')
      )
  }
})

function pageTitle(title: unknown, url: string): string {
  if (typeof title === 'string' && title.trim()) return title.trim()
  return url
}

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (tag): tag is string => typeof tag === 'string' && tag.trim().length > 0
  )
}

function formatDate(value: unknown): string {
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/)
    return match ? match[1] : value.trim()
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear()
    const month = String(value.getUTCMonth() + 1).padStart(2, '0')
    const day = String(value.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return ''
}

function compareDateDesc(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return 1
  if (!b) return -1
  return a < b ? 1 : -1
}
