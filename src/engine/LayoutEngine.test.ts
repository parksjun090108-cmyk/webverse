import assert from 'node:assert/strict'
import { layoutSites } from './LayoutEngine'
import type { Site } from '../types/site'

const sites: Site[] = Array.from({ length: 24 }, (_, index) => ({
  id: `depth-test-${index}`, name: `Test ${index}`, domain: `test-${index}.example`,
  category: 'Development', visitCount: index, favorite: false, lastVisitedDaysAgo: index,
  position: [0, 0, 0], color: '#5c8cff', status: 'APPROVED',
}))

const positioned = layoutSites(sites)
const xs = positioned.map((site) => site.position[0])
const ys = positioned.map((site) => site.position[1])
const zs = positioned.map((site) => site.position[2])
assert.ok(Math.max(...xs) - Math.min(...xs) > 1.5, 'sites should spread horizontally')
assert.ok(Math.max(...ys) - Math.min(...ys) > 1.5, 'sites should spread vertically')
assert.ok(Math.max(...zs) - Math.min(...zs) > 1.5, 'sites should spread in depth')
assert.deepEqual(layoutSites(sites).map((site) => site.position), positioned.map((site) => site.position), 'layout must be deterministic')

console.log('LayoutEngine 3D spread tests passed')
