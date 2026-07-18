import type { Category, Site } from '../types/site'
import { getCelestialScale } from './UniverseEngine'
import { CATEGORY_DEFINITIONS } from '../data/categories'

export const CATEGORY_ANCHORS = {
  ...Object.fromEntries(CATEGORY_DEFINITIONS.map((item) => [item.name, item.anchor])),
  Unclassified: [5.8, 4.6, -4.2] as [number, number, number],
} as Record<Category, [number, number, number]>

function hash(value: string) {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return Math.abs(result)
}

export function layoutSites(sites: Site[]): Site[] {
  const nodes = sites.map((site) => {
    const seed = hash(site.id)
    const anchor = CATEGORY_ANCHORS[site.category]
    const azimuth = (seed % 360) * (Math.PI / 180)
    const vertical = (((seed >>> 8) % 1000) / 999) * 2 - 1
    const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical))
    const radius = 0.7 + ((seed >>> 18) % 1000) / 620
    return {
      ...site,
      position: [
        anchor[0] + Math.cos(azimuth) * horizontal * radius,
        anchor[1] + vertical * radius,
        anchor[2] + Math.sin(azimuth) * horizontal * radius,
      ] as [number, number, number],
    }
  })

  for (let iteration = 0; iteration < 28; iteration += 1) {
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const a = nodes[left]
        const b = nodes[right]
        if (a.category !== b.category) continue
        const dx = b.position[0] - a.position[0]
        const dy = b.position[1] - a.position[1]
        const dz = b.position[2] - a.position[2]
        const distance = Math.max(0.01, Math.hypot(dx, dy, dz))
        const minimum = getCelestialScale(a.visitCount) + getCelestialScale(b.visitCount) + 0.72
        if (distance >= minimum) continue
        const push = (minimum - distance) * 0.28
        const nx = dx / distance
        const ny = dy / distance
        const nz = dz / distance
        a.position[0] -= nx * push
        a.position[1] -= ny * push
        a.position[2] -= nz * push
        b.position[0] += nx * push
        b.position[1] += ny * push
        b.position[2] += nz * push
      }
    }

    for (const node of nodes) {
      const anchor = CATEGORY_ANCHORS[node.category]
      node.position[0] += (anchor[0] - node.position[0]) * 0.025
      node.position[1] += (anchor[1] - node.position[1]) * 0.025
      node.position[2] += (anchor[2] - node.position[2]) * 0.025
    }
  }

  return nodes
}
