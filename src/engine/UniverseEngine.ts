import type { CelestialStage, Site } from '../types/site'

export function getCelestialStage(visits: number): CelestialStage {
  if (visits >= 150) return '거대 행성'
  if (visits >= 100) return '큰 행성'
  if (visits >= 50) return '작은 행성'
  if (visits >= 20) return '밝은 별'
  if (visits >= 5) return '일반 별'
  return '작은 별'
}

export function getCelestialScale(visits: number) {
  if (visits >= 150) return 1.42
  if (visits >= 100) return 1.18
  if (visits >= 50) return 0.96
  if (visits >= 20) return 0.66
  if (visits >= 5) return 0.52
  return 0.36
}

export function getActivityBrightness(daysAgo: number) {
  if (daysAgo <= 30) return 1
  if (daysAgo <= 90) return 0.8
  if (daysAgo <= 180) return 0.6
  if (daysAgo <= 365) return 0.35
  return 0.15
}

export function registerVisit(site: Site): Site {
  return { ...site, visitCount: site.visitCount + 1, lastVisitedDaysAgo: 0 }
}
