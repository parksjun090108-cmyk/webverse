import assert from 'node:assert/strict'
import { getActivityBrightness, getCelestialScale, getCelestialStage, registerVisit } from './UniverseEngine'
import type { Site } from '../types/site'

const stages = [
  [0, '작은 별'], [4, '작은 별'], [5, '일반 별'], [19, '일반 별'],
  [20, '밝은 별'], [49, '밝은 별'], [50, '작은 행성'], [99, '작은 행성'],
  [100, '큰 행성'], [149, '큰 행성'], [150, '거대 행성'],
] as const
for (const [visits, expected] of stages) assert.equal(getCelestialStage(visits), expected)

assert.ok(getCelestialScale(4) < getCelestialScale(5))
assert.ok(getCelestialScale(99) < getCelestialScale(100))
assert.equal(getActivityBrightness(0), 1)
assert.equal(getActivityBrightness(30), 1)
assert.equal(getActivityBrightness(31), 0.8)
assert.equal(getActivityBrightness(91), 0.6)
assert.equal(getActivityBrightness(181), 0.35)
assert.equal(getActivityBrightness(366), 0.15)

const site: Site = {
  id: 'test', name: 'Test', domain: 'test.example', category: 'Development', visitCount: 0,
  favorite: false, lastVisitedDaysAgo: 400, position: [0, 0, 0], color: '#fff', status: 'APPROVED',
}
const visited = registerVisit(site)
assert.equal(visited.visitCount, 1)
assert.equal(visited.lastVisitedDaysAgo, 0)
assert.equal(site.visitCount, 0, 'registerVisit must not mutate the original site')

console.log('UniverseEngine boundary tests passed')
