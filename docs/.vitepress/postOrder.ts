/** Reading order for the post list and sidebar. */

export interface ReadingOrderPost {
  title: string
  date: string
  /** Slug or URL. May contain `av-series-NN`. */
  slug: string
}

const SERIES_IN_SLUG = /av-series-(\d+)/
const SERIES_IN_TITLE = /音视频系列\s*(\d+)/

/** Series index from `av-series-NN` in the slug, else `音视频系列 NN` in the title. */
export function seriesNumber(post: ReadingOrderPost): number | null {
  const fromSlug = post.slug.match(SERIES_IN_SLUG)
  if (fromSlug) return Number(fromSlug[1])
  const fromTitle = post.title.match(SERIES_IN_TITLE)
  if (fromTitle) return Number(fromTitle[1])
  return null
}

/**
 * Series number ascending. Posts without a series number follow, oldest date
 * first, then title.
 */
export function compareReadingOrder(a: ReadingOrderPost, b: ReadingOrderPost): number {
  const bySeries = compareSeries(seriesNumber(a), seriesNumber(b))
  if (bySeries !== 0) return bySeries
  return compareDateAsc(a.date, b.date) || a.title.localeCompare(b.title, 'zh-CN')
}

function compareSeries(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a - b
}

function compareDateAsc(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return 1
  if (!b) return -1
  return a < b ? -1 : 1
}
