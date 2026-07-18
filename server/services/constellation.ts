import { prisma } from '../lib/prisma.js'

const SESSION_GAP_MS = 30 * 60 * 1000
const MIN_EDGE_COUNT = 3

type Visit = Awaited<ReturnType<typeof loadVisits>>[number]
type EdgePattern = { fromSiteId: string; toSiteId: string; count: number; visits: [Visit, Visit] }

function loadVisits(userId: string) {
  return prisma.history.findMany({
    where: { userId, action: 'VISIT', site: { status: 'APPROVED', categoryId: { not: null } } },
    include: { site: { include: { category: true } } }, orderBy: { createdAt: 'asc' },
  })
}

export async function analyzeConstellations(userId: string) {
  const visits = await loadVisits(userId)
  const sessions: Visit[][] = []
  for (const visit of visits) {
    const current = sessions.at(-1)
    const previous = current?.at(-1)
    if (!current || !previous || visit.createdAt.getTime() - previous.createdAt.getTime() > SESSION_GAP_MS) sessions.push([visit])
    else current.push(visit)
  }

  const edgePatterns = new Map<string, EdgePattern>()
  for (const session of sessions) {
    for (let index = 0; index < session.length - 1; index += 1) {
      const first = session[index]!
      const second = session[index + 1]!
      if (first.siteId === second.siteId) continue
      const fromSiteId = first.siteId < second.siteId ? first.siteId : second.siteId
      const toSiteId = first.siteId < second.siteId ? second.siteId : first.siteId
      const key = `${fromSiteId}|${toSiteId}`
      const existing = edgePatterns.get(key)
      edgePatterns.set(key, { fromSiteId, toSiteId, count: (existing?.count ?? 0) + 1, visits: [first, second] })
    }
  }

  const qualifiedEdges = [...edgePatterns.values()].filter((edge) => edge.count >= MIN_EDGE_COUNT)
  const adjacency = new Map<string, Set<string>>()
  for (const edge of qualifiedEdges) {
    adjacency.set(edge.fromSiteId, new Set([...(adjacency.get(edge.fromSiteId) ?? []), edge.toSiteId]))
    adjacency.set(edge.toSiteId, new Set([...(adjacency.get(edge.toSiteId) ?? []), edge.fromSiteId]))
  }

  const components: string[][] = []
  const visitedIds = new Set<string>()
  for (const start of adjacency.keys()) {
    if (visitedIds.has(start)) continue
    const stack = [start]
    const component: string[] = []
    while (stack.length) {
      const siteId = stack.pop()!
      if (visitedIds.has(siteId)) continue
      visitedIds.add(siteId); component.push(siteId)
      for (const neighbor of adjacency.get(siteId) ?? []) if (!visitedIds.has(neighbor)) stack.push(neighbor)
    }
    if (component.length >= 3) components.push(component.sort())
  }

  const activeKeys = components.map((siteIds) => siteIds.join('|'))
  await prisma.constellation.deleteMany({ where: { userId, ...(activeKeys.length ? { patternKey: { notIn: activeKeys } } : {}) } })

  for (const siteIds of components) {
    const siteSet = new Set(siteIds)
    const edges = qualifiedEdges.filter((edge) => siteSet.has(edge.fromSiteId) && siteSet.has(edge.toSiteId))
    const siteById = new Map<string, Visit['site']>()
    for (const edge of edges) for (const visit of edge.visits) siteById.set(visit.siteId, visit.site)
    const orderedSiteIds = [...siteIds].sort((a, b) => {
      const degreeA = edges.filter((edge) => edge.fromSiteId === a || edge.toSiteId === a).length
      const degreeB = edges.filter((edge) => edge.fromSiteId === b || edge.toSiteId === b).length
      return degreeB - degreeA || (siteById.get(a)?.name ?? a).localeCompare(siteById.get(b)?.name ?? b)
    })
    const minimumCount = Math.min(...edges.map((edge) => edge.count))
    const strength = minimumCount >= 10 ? 3 : minimumCount >= 5 ? 2 : 1
    const categoryNames = orderedSiteIds.map((id) => siteById.get(id)?.category?.name).filter(Boolean)
    const sameCategory = categoryNames.length === orderedSiteIds.length && new Set(categoryNames).size === 1
    const generatedName = sameCategory
      ? `${categoryNames[0]} 별자리`
      : `${orderedSiteIds.slice(0, 3).map((id) => siteById.get(id)?.name).join('–')} 별자리`

    const constellation = await prisma.constellation.upsert({
      where: { userId_patternKey: { userId, patternKey: siteIds.join('|') } },
      update: { strength, occurrenceCount: minimumCount },
      create: { userId, patternKey: siteIds.join('|'), name: generatedName, strength, occurrenceCount: minimumCount },
    })
    await prisma.$transaction([
      prisma.constellationSite.deleteMany({ where: { constellationId: constellation.id } }),
      prisma.constellationEdge.deleteMany({ where: { constellationId: constellation.id } }),
    ])
    await prisma.constellationSite.createMany({
      data: orderedSiteIds.map((siteId, sequence) => ({ constellationId: constellation.id, siteId, sequence })),
    })
    await prisma.constellationEdge.createMany({
      data: edges.map((edge) => ({ constellationId: constellation.id, fromSiteId: edge.fromSiteId, toSiteId: edge.toSiteId, count: edge.count })),
    })
  }
}
