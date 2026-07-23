import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'
import { analyzeConstellations } from '../services/constellation.js'
import { collectSiteMetadata } from '../services/siteMetadata.js'
import { createRateLimiter } from '../lib/rateLimit.js'

export const sitesRouter = Router()
sitesRouter.use(requireAuth)
const customSiteLimiter = createRateLimiter({
  windowMs: 60 * 60_000, max: 10, keyPrefix: 'custom-site',
  key: (request) => request.userId ?? request.ip ?? 'unknown',
  message: '사이트 분석 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
})
const approvalRequestLimiter = createRateLimiter({
  windowMs: 60 * 60_000, max: 10, keyPrefix: 'site-approval-request',
  key: (request) => request.userId ?? request.ip ?? 'unknown',
  message: '공식 사이트 등록 신청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
})

sitesRouter.get('/', async (request, response, next) => {
  try {
    const query = z.object({
      q: z.string().trim().max(100).optional(), category: z.string().trim().max(40).optional(),
      page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(50),
    }).parse(request.query)
    const where = {
      status: 'APPROVED',
      ...(query.category ? { category: { name: query.category } } : {}),
      ...(query.q ? { OR: [{ name: { contains: query.q } }, { domain: { contains: query.q.toLowerCase() } }] } : {}),
    }
    const [sites, total] = await Promise.all([
      prisma.site.findMany({ where, include: { category: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.limit, take: query.limit }),
      prisma.site.count({ where }),
    ])
    const totalPages = Math.max(1, Math.ceil(total / query.limit))
    response.json({ sites, pagination: { page: query.page, limit: query.limit, total, totalPages, hasNext: query.page < totalPages } })
  } catch (error) { next(error) }
})

sitesRouter.get('/mine', async (request, response, next) => {
  try {
    const userSites = await prisma.userSite.findMany({
      where: { userId: request.userId! },
      include: {
        site: {
          include: {
            category: true,
            approvalRequest: { select: { status: true, resolutionNote: true, resolvedAt: true } },
          },
        },
      },
      orderBy: [{ favorite: 'desc' }, { lastVisit: 'desc' }],
    })
    response.json({
      userSites: userSites.map((entry) => ({
        ...entry,
        favorite: entry.favorite || entry.browserFavorite,
      })),
    })
  } catch (error) { next(error) }
})

sitesRouter.post('/custom', customSiteLimiter, async (request, response, next) => {
  try {
    const userId = request.userId!
    const input = z.object({ url: z.string().url() }).parse(request.body)
    const metadata = await collectSiteMetadata(input.url)

    const site = await prisma.site.upsert({
      where: { domain: metadata.domain },
      update: {},
      create: {
        name: metadata.title, domain: metadata.domain, normalizedUrl: metadata.url,
        description: metadata.description, faviconUrl: metadata.faviconUrl,
        themeColor: metadata.themeColor ?? '#8992aa', createdById: userId, status: 'UNLISTED',
      },
    })
    await discover(userId, site.id)
    response.status(201).json({ site: await siteWithDiscoveryCount(site.id) })
  } catch (error) { next(error) }
})

sitesRouter.post('/:siteId/discover', async (request, response, next) => {
  try {
    const userId = request.userId!
    const site = await prisma.site.findUniqueOrThrow({ where: { id: request.params.siteId } })
    if (site.status === 'REJECTED_PRIVATE') return response.status(404).json({ message: '발견할 수 없는 사이트입니다.' })
    await discover(userId, site.id)
    response.status(201).json({ site: await siteWithDiscoveryCount(site.id) })
  } catch (error) { next(error) }
})

sitesRouter.post('/:siteId/approval-request', approvalRequestLimiter, async (request, response, next) => {
  try {
    const userId = request.userId!
    const siteId = z.string().min(1).parse(request.params.siteId)
    const site = await prisma.site.findFirst({
      where: { id: siteId, userSites: { some: { userId } } },
      include: { approvalRequest: true },
    })
    if (!site) return response.status(404).json({ message: '내 우주에 있는 사이트만 공식 등록을 신청할 수 있습니다.' })
    if (site.status === 'APPROVED') return response.status(409).json({ message: '이미 공식 사이트입니다.' })
    if (site.approvalRequest?.status === 'REQUESTED') {
      return response.json({ site: await siteWithDiscoveryCount(siteId), request: site.approvalRequest })
    }
    if (site.approvalRequest?.status === 'REJECTED') {
      return response.status(409).json({ message: '이미 검토가 완료된 사이트입니다. 거절 사유를 확인해주세요.' })
    }

    await prisma.$transaction([
      prisma.site.update({ where: { id: siteId }, data: { status: 'REVIEW_REQUESTED' } }),
      prisma.approvalRequest.create({ data: { siteId } }),
    ])
    response.status(201).json({
      site: await siteWithDiscoveryCount(siteId),
      request: await prisma.approvalRequest.findUniqueOrThrow({ where: { siteId } }),
    })
  } catch (error) { next(error) }
})

sitesRouter.post('/:siteId/visit', async (request, response, next) => {
  try {
    const userId = request.userId!
    const result = await prisma.$transaction(async (database) => {
      const userSite = await database.userSite.update({
        where: { userId_siteId: { userId, siteId: request.params.siteId } },
        data: { visitCount: { increment: 1 }, lastVisit: new Date() }, include: { site: true },
      })
      await database.history.create({ data: { userId, siteId: request.params.siteId, action: 'VISIT' } })
      return userSite
    })
    await analyzeConstellations(userId)
    response.json({ userSite: result })
  } catch (error) { next(error) }
})

sitesRouter.patch('/:siteId/favorite', async (request, response, next) => {
  try {
    const userId = request.userId!
    const input = z.object({ favorite: z.boolean() }).parse(request.body)
    const userSite = await prisma.userSite.update({
      where: { userId_siteId: { userId, siteId: request.params.siteId } }, data: input,
    })
    await prisma.history.create({ data: { userId, siteId: request.params.siteId, action: input.favorite ? 'FAVORITE' : 'UNFAVORITE' } })
    response.json({ userSite })
  } catch (error) { next(error) }
})

sitesRouter.delete('/:siteId', async (request, response, next) => {
  try {
    const userId = request.userId!
    const siteId = request.params.siteId
    await prisma.$transaction([
      prisma.history.deleteMany({ where: { userId, siteId } }),
      prisma.siteDiscovery.deleteMany({ where: { userId, siteId } }),
      prisma.userSite.delete({ where: { userId_siteId: { userId, siteId } } }),
    ])
    await analyzeConstellations(userId)
    response.status(204).end()
  } catch (error) { next(error) }
})

async function discover(userId: string, siteId: string) {
  await prisma.$transaction(async (database) => {
    await database.siteDiscovery.upsert({ where: { userId_siteId: { userId, siteId } }, update: {}, create: { userId, siteId } })
    await database.userSite.upsert({
      where: { userId_siteId: { userId, siteId } }, update: {}, create: { userId, siteId, visitCount: 0 },
    })
    const historyExists = await database.history.findFirst({ where: { userId, siteId, action: 'DISCOVER' } })
    if (!historyExists) await database.history.create({ data: { userId, siteId, action: 'DISCOVER' } })
  })
}

async function siteWithDiscoveryCount(siteId: string) {
  return prisma.site.findUniqueOrThrow({
    where: { id: siteId }, include: { category: true, _count: { select: { discoveries: true } } },
  })
}
