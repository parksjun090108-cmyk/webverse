import { createHash, randomBytes, randomInt } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { requireAuth } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'
import { createRateLimiter } from '../lib/rateLimit.js'
import { analyzeConstellations } from '../services/constellation.js'

export const extensionRouter = Router()
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

const connectLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 12, keyPrefix: 'extension-connect', message: '연결 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' })
const visitLimiter = createRateLimiter({ windowMs: 60_000, max: 12, keyPrefix: 'extension-visits', key: (request) => request.extensionUserId ?? request.ip ?? 'unknown', message: '방문 동기화 요청이 너무 많습니다.' })

extensionRouter.post('/pairing', requireAuth, async (request, response, next) => {
  try {
    const code = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
    const expiresAt = new Date(Date.now() + 10 * 60_000)
    await prisma.extensionPairing.upsert({
      where: { userId: request.userId! },
      update: { codeHash: hash(code), expiresAt },
      create: { userId: request.userId!, codeHash: hash(code), expiresAt },
    })
    response.status(201).json({ code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt })
  } catch (error) { next(error) }
})

extensionRouter.get('/status', requireAuth, async (request, response, next) => {
  try {
    const sessions = await prisma.extensionSession.findMany({
      where: { userId: request.userId!, revokedAt: null },
      select: { id: true, deviceName: true, createdAt: true, lastSeenAt: true }, orderBy: { createdAt: 'desc' },
    })
    response.json({ connected: sessions.length > 0, sessions })
  } catch (error) { next(error) }
})

extensionRouter.delete('/connections', requireAuth, async (request, response, next) => {
  try {
    await prisma.$transaction([
      prisma.extensionPairing.deleteMany({ where: { userId: request.userId! } }),
      prisma.extensionSession.updateMany({ where: { userId: request.userId!, revokedAt: null }, data: { revokedAt: new Date() } }),
    ])
    response.status(204).end()
  } catch (error) { next(error) }
})

extensionRouter.post('/connect', connectLimiter, async (request, response, next) => {
  try {
    const input = z.object({ code: z.string().trim().min(8).max(9), deviceName: z.string().trim().min(1).max(60).default('Chromium Browser') }).parse(request.body)
    const normalizedCode = input.code.replace('-', '').toUpperCase()
    const pairing = await prisma.extensionPairing.findUnique({ where: { codeHash: hash(normalizedCode) } })
    if (!pairing || pairing.expiresAt <= new Date()) return response.status(400).json({ message: '연결 코드가 올바르지 않거나 만료되었습니다.', requestId: request.requestId })
    const token = randomBytes(32).toString('base64url')
    await prisma.$transaction([
      prisma.extensionSession.create({ data: { userId: pairing.userId, tokenHash: hash(token), deviceName: input.deviceName } }),
      prisma.extensionPairing.delete({ where: { id: pairing.id } }),
    ])
    response.status(201).json({ token })
  } catch (error) { next(error) }
})

extensionRouter.post('/visits', requireExtension, visitLimiter, async (request, response, next) => {
  try {
    const input = z.object({ events: z.array(z.object({
      id: z.string().uuid(),
      domain: z.string().trim().toLowerCase().max(253),
      visitedAt: z.coerce.date(),
    })).min(1).max(50) }).parse(request.body)
    let accepted = 0; let ignored = 0; let duplicates = 0
    for (const event of [...input.events].sort((a, b) => a.visitedAt.getTime() - b.visitedAt.getTime())) {
      const domain = normalizeDomain(event.domain)
      if (!domain || Math.abs(Date.now() - event.visitedAt.getTime()) > 30 * 24 * 60 * 60_000) { ignored += 1; continue }
      try {
        await prisma.extensionVisitEvent.create({ data: { id: event.id, sessionId: request.extensionSessionId!, domain, visitedAt: event.visitedAt, accepted: false } })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { duplicates += 1; continue }
        throw error
      }
      const site = await prisma.site.findFirst({
        where: { domain, userSites: { some: { userId: request.extensionUserId! } } },
        include: { userSites: { where: { userId: request.extensionUserId! }, take: 1 } },
      })
      const userSite = site?.userSites[0]
      if (!site || !userSite) { ignored += 1; continue }
      await prisma.$transaction([
        prisma.userSite.update({
          where: { userId_siteId: { userId: request.extensionUserId!, siteId: site.id } },
          data: { visitCount: { increment: 1 }, lastVisit: event.visitedAt > userSite.lastVisit ? event.visitedAt : userSite.lastVisit },
        }),
        prisma.history.create({ data: { userId: request.extensionUserId!, siteId: site.id, action: 'VISIT', sessionId: request.extensionSessionId, createdAt: event.visitedAt } }),
        prisma.extensionVisitEvent.update({ where: { id: event.id }, data: { accepted: true } }),
      ])
      accepted += 1
    }
    await prisma.extensionSession.update({ where: { id: request.extensionSessionId! }, data: { lastSeenAt: new Date() } })
    if (accepted) await analyzeConstellations(request.extensionUserId!)
    response.json({ accepted, ignored, duplicates })
  } catch (error) { next(error) }
})

extensionRouter.delete('/session', requireExtension, async (request, response, next) => {
  try {
    await prisma.extensionSession.update({ where: { id: request.extensionSessionId! }, data: { revokedAt: new Date() } })
    response.status(204).end()
  } catch (error) { next(error) }
})

async function requireExtension(request: Request, response: Response, next: NextFunction) {
  const token = request.headers.authorization?.replace(/^Extension\s+/i, '')
  if (!token) return response.status(401).json({ message: '확장 프로그램 연결이 필요합니다.', requestId: request.requestId })
  const session = await prisma.extensionSession.findUnique({ where: { tokenHash: hash(token) } })
  if (!session || session.revokedAt) return response.status(401).json({ message: '확장 프로그램 연결이 만료되었습니다.', requestId: request.requestId })
  request.extensionUserId = session.userId; request.extensionSessionId = session.id
  next()
}

function hash(value: string) { return createHash('sha256').update(value).digest('hex') }

function normalizeDomain(value: string) {
  const domain = value.replace(/^www\./, '').replace(/\.$/, '')
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) return null
  return domain
}
