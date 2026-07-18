import assert from 'node:assert/strict'
import { createUniverseView, MAX_VISIBLE_BODIES } from './DisplayEngine'
import type { Site } from '../types/site'

const sites: Site[] = Array.from({ length: 60 }, (_, index) => ({
  id: `site-${index}`, name: `Site ${index}`, domain: `site${index}.example.com`,
  category: 'Development', visitCount: index, favorite: index === 59,
  lastVisitedDaysAgo: 60 - index, position: [0, 0, 0], color: '#5c8cff', status: 'APPROVED',
}))

const defaultView = createUniverseView(sites, null)
assert.equal(defaultView.visibleSites.length, MAX_VISIBLE_BODIES)
assert.equal(defaultView.clusters.length, 1)
assert.equal(defaultView.clusters[0]?.count, 10)
assert.equal(defaultView.visibleSites[0]?.id, 'site-59')

const expanded = createUniverseView(sites, 'Development')
assert.equal(expanded.visibleSites.length, 60)
assert.equal(expanded.clusters.length, 0)

console.log('DisplayEngine tests passed')
