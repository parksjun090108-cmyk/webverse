import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'

export const galaxyRouter = Router()

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(12),
})
const reportSchema = z.object({
  reason: z.enum(['SPAM', 'INAPPROPRIATE', 'PRIVACY', 'PHISHING', 'OTHER']),
  details: z.string().trim().max(300).optional(),
})

galaxyRouter.get('/public/:slug', async (request, response, next) => {
  try {
    const universe = await loadPublicUniverse(z.string().min(8).max(64).parse(request.params.slug))
    if (!universe) return response.status(404).json({ message: '공개된 우주를 찾을 수 없습니다.' })
    response.json({ universe })
  } catch (error) { next(error) }
})

galaxyRouter.use(requireAuth)

galaxyRouter.get('/me', async (request, response, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.userId! },
      select: { universeVisibility: true, publicSlug: true, universePublishedAt: true, universeHiddenAt: true, universeHiddenReason: true },
    })
    response.json({ profile: publicProfileState(user) })
  } catch (error) { next(error) }
})

galaxyRouter.patch('/me', async (request, response, next) => {
  try {
    const input = z.object({ public: z.boolean() }).parse(request.body)
    const current = await prisma.user.findUniqueOrThrow({
      where: { id: request.userId! },
      select: { publicSlug: true, universeHiddenAt: true, universeHiddenReason: true },
    })
    if (input.public && current.universeHiddenAt) {
      return response.status(403).json({ message: current.universeHiddenReason || '관리자에 의해 공개가 제한된 우주입니다.' })
    }
    const user = await prisma.user.update({
      where: { id: request.userId! },
      data: input.public
        ? { universeVisibility: 'PUBLIC', publicSlug: current.publicSlug ?? createPublicSlug(), universePublishedAt: new Date() }
        : { universeVisibility: 'PRIVATE' },
      select: { universeVisibility: true, publicSlug: true, universePublishedAt: true, universeHiddenAt: true, universeHiddenReason: true },
    })
    response.json({ profile: publicProfileState(user) })
  } catch (error) { next(error) }
})

galaxyRouter.get('/', async (request, response, next) => {
  try {
    const query = paginationSchema.parse(request.query)
    const blockRelations = await prisma.universeBlock.findMany({
      where: { OR: [{ userId: request.userId! }, { blockedUserId: request.userId! }] },
      select: { userId: true, blockedUserId: true },
    })
    const excludedIds = [...new Set([request.userId!, ...blockRelations.flatMap((entry) => [entry.userId, entry.blockedUserId])])]
    const where = { universeVisibility: 'PUBLIC', universeHiddenAt: null, id: { notIn: excludedIds } }
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, nickname: true, publicSlug: true, universePublishedAt: true,
          userSites: {
            orderBy: [{ visitCount: 'desc' }, { discoveredAt: 'asc' }], take: 10,
            include: { site: { include: { category: true } } },
          },
          _count: { select: { userSites: true, constellations: true } },
        },
        orderBy: [{ universePublishedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit, take: query.limit,
      }),
      prisma.user.count({ where }),
    ])
    const totalPages = Math.max(1, Math.ceil(total / query.limit))
    response.json({
      universes: users.map((user) => ({
        slug: user.publicSlug!, nickname: user.nickname, publishedAt: user.universePublishedAt,
        siteCount: user._count.userSites, constellationCount: user._count.constellations,
        previewSites: user.userSites.map(publicSite),
      })),
      pagination: { page: query.page, limit: query.limit, total, totalPages, hasNext: query.page < totalPages },
    })
  } catch (error) { next(error) }
})

galaxyRouter.get('/:slug', async (request, response, next) => {
  try {
    const slug = z.string().min(8).max(64).parse(request.params.slug)
    const target = await prisma.user.findFirst({ where: { publicSlug: slug }, select: { id: true } })
    if (!target) return response.status(404).json({ message: '공개된 우주를 찾을 수 없습니다.' })
    const blocked = await prisma.universeBlock.findFirst({
      where: { OR: [
        { userId: request.userId!, blockedUserId: target.id },
        { userId: target.id, blockedUserId: request.userId! },
      ] },
      select: { userId: true },
    })
    if (blocked) return response.status(404).json({ message: '공개된 우주를 찾을 수 없습니다.' })
    const universe = await loadPublicUniverse(slug)
    if (!universe) return response.status(404).json({ message: '공개된 우주를 찾을 수 없습니다.' })
    response.json({ universe })
  } catch (error) { next(error) }
})

galaxyRouter.post('/:slug/report', async (request, response, next) => {
  try {
    const slug = z.string().min(8).max(64).parse(request.params.slug)
    const input = reportSchema.parse(request.body)
    const target = await prisma.user.findFirst({
      where: { publicSlug: slug, universeVisibility: 'PUBLIC', universeHiddenAt: null }, select: { id: true },
    })
    if (!target) return response.status(404).json({ message: '공개된 우주를 찾을 수 없습니다.' })
    if (target.id === request.userId) return response.status(400).json({ message: '자신의 우주는 신고할 수 없습니다.' })
    await prisma.universeReport.upsert({
      where: { reporterUserId_targetUserId: { reporterUserId: request.userId!, targetUserId: target.id } },
      update: { reason: input.reason, details: input.details || null, status: 'OPEN', createdAt: new Date(), resolvedAt: null, resolvedById: null },
      create: { reporterUserId: request.userId!, targetUserId: target.id, reason: input.reason, details: input.details || null },
    })
    response.status(201).json({ reported: true })
  } catch (error) { next(error) }
})

galaxyRouter.post('/:slug/block', async (request, response, next) => {
  try {
    const target = await prisma.user.findFirst({ where: { publicSlug: z.string().min(8).max(64).parse(request.params.slug) }, select: { id: true } })
    if (!target) return response.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
    if (target.id === request.userId) return response.status(400).json({ message: '자신을 차단할 수 없습니다.' })
    await prisma.universeBlock.upsert({
      where: { userId_blockedUserId: { userId: request.userId!, blockedUserId: target.id } },
      update: {}, create: { userId: request.userId!, blockedUserId: target.id },
    })
    response.status(204).end()
  } catch (error) { next(error) }
})

async function loadPublicUniverse(slug: string) {
  const user = await prisma.user.findFirst({
    where: { publicSlug: slug, universeVisibility: 'PUBLIC', universeHiddenAt: null },
    select: {
      id: true, nickname: true, publicSlug: true, universePublishedAt: true,
      userSites: {
        include: { site: { include: { category: true } } },
        orderBy: [{ visitCount: 'desc' }, { discoveredAt: 'asc' }],
      },
      constellations: {
        where: { sites: { every: { site: { status: 'APPROVED' } } } },
        include: {
          sites: { include: { site: { include: { category: true } } }, orderBy: { sequence: 'asc' } },
          edges: true,
        },
      },
    },
  })
  if (!user) return null
  return {
    slug: user.publicSlug!, nickname: user.nickname, publishedAt: user.universePublishedAt,
    sites: user.userSites.map(publicSite),
    constellations: user.constellations,
  }
}

function publicSite(entry: {
  siteId: string
  visitCount: number
  favorite: boolean
  browserFavorite: boolean
  positionX: number
  positionY: number
  positionZ: number
  lastVisit: Date
  site: { id: string; name: string; domain: string; faviconUrl: string | null; themeColor: string; status: string; category: { name: string; color: string } | null }
}, index: number) {
  const official = entry.site.status === 'APPROVED'
  return {
    id: official ? entry.site.id : `anonymous-${index}`,
    name: official ? entry.site.name : '미확인 천체',
    domain: official ? entry.site.domain : '',
    faviconUrl: official ? entry.site.faviconUrl : null,
    category: official && entry.site.category ? entry.site.category : null,
    themeColor: official ? entry.site.themeColor : '#737b91',
    status: official ? 'APPROVED' : 'UNLISTED',
    anonymous: !official,
    visitCount: publicVisitLevel(entry.visitCount),
    favorite: entry.favorite || entry.browserFavorite,
    lastVisitedDaysAgo: publicActivityDays(entry.lastVisit),
    positionX: entry.positionX, positionY: entry.positionY, positionZ: entry.positionZ,
  }
}

function publicVisitLevel(visits: number) {
  if (visits >= 150) return 150
  if (visits >= 100) return 100
  if (visits >= 50) return 50
  if (visits >= 20) return 20
  if (visits >= 5) return 5
  return 0
}

function publicActivityDays(lastVisit: Date) {
  const days = Math.max(0, Math.floor((Date.now() - lastVisit.getTime()) / 86_400_000))
  if (days <= 30) return 0
  if (days <= 90) return 60
  if (days <= 180) return 120
  if (days <= 365) return 270
  return 500
}

function publicProfileState(user: {
  universeVisibility: string
  publicSlug: string | null
  universePublishedAt: Date | null
  universeHiddenAt: Date | null
  universeHiddenReason: string | null
}) {
  return {
    public: user.universeVisibility === 'PUBLIC' && !user.universeHiddenAt,
    slug: user.publicSlug,
    publishedAt: user.universePublishedAt,
    restricted: Boolean(user.universeHiddenAt),
    restrictionReason: user.universeHiddenReason,
  }
}

function createPublicSlug() {
  return randomBytes(12).toString('base64url')
}
