import type { Category } from '../types/site'
import { CATEGORY_COLORS } from './categories'
import { OFFICIAL_SITES } from './officialSites'

export type CatalogSite = {
  id: string
  name: string
  domain: string
  description: string
  category: Category
  color: string
  faviconUrl?: string | null
}

export const catalogSites: CatalogSite[] = OFFICIAL_SITES.map((site) => ({
  ...site,
  id: site.domain,
  color: CATEGORY_COLORS[site.category],
  faviconUrl: `https://${site.domain}/favicon.ico`,
}))
