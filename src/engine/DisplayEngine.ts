import type { Category, Site } from '../types/site'
import { CATEGORY_ANCHORS } from './LayoutEngine'

export const MAX_VISIBLE_BODIES = 50

export type SiteCluster = {
  category: Category
  count: number
  color: string
  position: [number, number, number]
}

export function createUniverseView(sites: Site[], expandedCategory: Category | null) {
  if (expandedCategory) {
    return { visibleSites: sortByPriority(sites.filter((site) => site.category === expandedCategory)), clusters: [] as SiteCluster[] }
  }

  const sorted = sortByPriority(sites)
  const visibleSites = sorted.slice(0, MAX_VISIBLE_BODIES)
  const hiddenSites = sorted.slice(MAX_VISIBLE_BODIES)
  const grouped = new Map<Category, Site[]>()
  for (const site of hiddenSites) grouped.set(site.category, [...(grouped.get(site.category) ?? []), site])

  const clusters = [...grouped.entries()].map(([category, hidden], index): SiteCluster => {
    const anchor = CATEGORY_ANCHORS[category]
    const angle = index * 1.7 + 0.6
    return {
      category,
      count: hidden.length,
      color: hidden[0]?.color ?? '#8992aa',
      position: [anchor[0] + Math.cos(angle) * 1.7, anchor[1] + Math.sin(angle) * 1.7, anchor[2] + Math.sin(angle * 1.7) * 1.25],
    }
  })
  return { visibleSites, clusters }
}

function sortByPriority(sites: Site[]) {
  return [...sites].sort((a, b) =>
    Number(b.favorite) - Number(a.favorite) ||
    a.lastVisitedDaysAgo - b.lastVisitedDaysAgo ||
    b.visitCount - a.visitCount ||
    a.name.localeCompare(b.name),
  )
}
