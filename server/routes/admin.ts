import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { createAdminToken, requireAdmin } from '../lib/adminAuth.js'
import { prisma } from '../lib/prisma.js'
import { createRateLimiter } from '../lib/rateLimit.js'

export const adminRouter = Router()

const adminLoginLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  max: 5,
  keyPrefix: 'admin-login',
  skipSuccessfulRequests: true,
  message: '관리자 로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
})

const requestStatusSchema = z.enum(['REQUESTED', 'APPROVED', 'REJECTED'])
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})
const siteEditSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  faviconUrl: z.string().url().nullable().optional(),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

adminRouter.post('/auth/login', adminLoginLimiter, async (request, response, next) => {
  try {
    const input = z.object({
      email: z.string().trim().toLowerCase().email(),
      password: z.string().min(1),
    }).parse(request.body)
    const admin = await prisma.admin.findUnique({ where: { email: input.email } })
    if (!admin || !admin.active || !(await bcrypt.compare(input.password, admin.passwordHash))) {
      return response.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.', requestId: request.requestId })
    }
    await prisma.adminAuditLog.create({
      data: { adminId: admin.id, action: 'ADMIN_LOGIN', targetType: 'ADMIN', targetId: admin.id },
    })
    return response.json({
      token: createAdminToken(admin.id),
      admin: { id: admin.id, name: admin.name, email: admin.email },
    })
  } catch (error) { next(error) }
})

adminRouter.use(requireAdmin)

adminRouter.get('/me', async (request, response, next) => {
  try {
    const admin = await prisma.admin.findUniqueOrThrow({
      where: { id: request.adminId! }, select: { id: true, name: true, email: true, createdAt: true },
    })
    response.json({ admin })
  } catch (error) { next(error) }
})

adminRouter.patch('/me/password', async (request, response, next) => {
  try {
    const input = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(1),
    }).parse(request.body)
    const admin = await prisma.admin.findUniqueOrThrow({ where: { id: request.adminId! } })
    if (!(await bcrypt.compare(input.currentPassword, admin.passwordHash))) {
      return response.status(403).json({ message: '현재 비밀번호가 올바르지 않습니다.', requestId: request.requestId })
    }
    await prisma.$transaction([
      prisma.admin.update({ where: { id: admin.id }, data: { passwordHash: await bcrypt.hash(input.newPassword, 12) } }),
      prisma.adminAuditLog.create({ data: { adminId: admin.id, action: 'ADMIN_PASSWORD_CHANGED', targetType: 'ADMIN', targetId: admin.id } }),
    ])
    response.status(204).end()
  } catch (error) { next(error) }
})

adminRouter.get('/overview', async (_request, response, next) => {
  try {
    const [requested, approved, rejected, pendingSites, reviewRequestedSites] = await Promise.all([
      prisma.approvalRequest.count({ where: { status: 'REQUESTED' } }),
      prisma.approvalRequest.count({ where: { status: 'APPROVED' } }),
      prisma.approvalRequest.count({ where: { status: 'REJECTED' } }),
      prisma.site.count({ where: { status: 'PENDING' } }),
      prisma.site.count({ where: { status: 'REVIEW_REQUESTED' } }),
    ])
    response.json({ requests: { requested, approved, rejected }, sites: { pending: pendingSites, reviewRequested: reviewRequestedSites } })
  } catch (error) { next(error) }
})

adminRouter.get('/categories', async (_request, response, next) => {
  try {
    response.json({ categories: await prisma.category.findMany({ orderBy: { name: 'asc' } }) })
  } catch (error) { next(error) }
})

adminRouter.get('/requests', async (request, response, next) => {
  try {
    const query = paginationSchema.extend({ status: requestStatusSchema.default('REQUESTED') }).parse(request.query)
    const where = { status: query.status }
    const [requests, total] = await Promise.all([
      prisma.approvalRequest.findMany({
        where,
        include: {
          site: {
            include: {
              category: true,
              createdBy: { select: { id: true, nickname: true } },
              _count: { select: { discoveries: true, userSites: true } },
            },
          },
          resolvedBy: { select: { id: true, name: true } },
        },
        orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.approvalRequest.count({ where }),
    ])
    const totalPages = Math.max(1, Math.ceil(total / query.limit))
    response.json({ requests, pagination: { page: query.page, limit: query.limit, total, totalPages, hasNext: query.page < totalPages } })
  } catch (error) { next(error) }
})

adminRouter.get('/requests/:requestId', async (request, response, next) => {
  try {
    const approvalRequest = await loadApprovalRequest(request.params.requestId)
    if (!approvalRequest) return response.status(404).json({ message: '승인 요청을 찾을 수 없습니다.', requestId: request.requestId })
    response.json({ request: approvalRequest })
  } catch (error) { next(error) }
})

adminRouter.post('/requests/:requestId/approve', async (request, response, next) => {
  try {
    const input = siteEditSchema.extend({
      categoryId: z.string().min(1),
    }).parse(request.body)
    if (!(await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }))) {
      return response.status(400).json({ message: '유효한 카테고리를 선택해주세요.', requestId: request.requestId })
    }
    try {
      await prisma.$transaction(async (database) => {
        const current = await database.approvalRequest.findUnique({ where: { id: request.params.requestId }, select: { siteId: true, status: true } })
        if (!current) throw new ApprovalNotFoundError()
        if (current.status !== 'REQUESTED') throw new ApprovalConflictError()
        const changed = await database.approvalRequest.updateMany({
          where: { id: request.params.requestId, status: 'REQUESTED' },
          data: { status: 'APPROVED', resolvedAt: new Date(), resolvedById: request.adminId!, resolutionNote: null },
        })
        if (changed.count !== 1) throw new ApprovalConflictError()
        await database.site.update({
          where: { id: current.siteId },
          data: {
            status: 'APPROVED', verified: true, categoryId: input.categoryId,
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.faviconUrl !== undefined ? { faviconUrl: input.faviconUrl } : {}),
            ...(input.themeColor !== undefined ? { themeColor: input.themeColor } : {}),
          },
        })
        await database.adminAuditLog.create({
          data: {
            adminId: request.adminId!, action: 'SITE_APPROVED', targetType: 'SITE', targetId: current.siteId,
            details: JSON.stringify({ requestId: request.params.requestId, categoryId: input.categoryId }),
          },
        })
      })
    } catch (error) {
      if (error instanceof ApprovalNotFoundError) return response.status(404).json({ message: '승인 요청을 찾을 수 없습니다.', requestId: request.requestId })
      if (error instanceof ApprovalConflictError) return response.status(409).json({ message: '이미 처리된 승인 요청입니다.', requestId: request.requestId })
      throw error
    }
    response.json({ request: await loadApprovalRequest(request.params.requestId) })
  } catch (error) { next(error) }
})

adminRouter.post('/requests/:requestId/reject', async (request, response, next) => {
  try {
    const input = z.object({ reason: z.string().trim().min(2).max(500) }).parse(request.body)
    try {
      await prisma.$transaction(async (database) => {
        const current = await database.approvalRequest.findUnique({ where: { id: request.params.requestId }, select: { siteId: true, status: true } })
        if (!current) throw new ApprovalNotFoundError()
        if (current.status !== 'REQUESTED') throw new ApprovalConflictError()
        const changed = await database.approvalRequest.updateMany({
          where: { id: request.params.requestId, status: 'REQUESTED' },
          data: { status: 'REJECTED', resolvedAt: new Date(), resolvedById: request.adminId!, resolutionNote: input.reason },
        })
        if (changed.count !== 1) throw new ApprovalConflictError()
        await database.site.update({
          where: { id: current.siteId }, data: { status: 'REJECTED_PRIVATE', verified: false, categoryId: null },
        })
        await database.constellation.deleteMany({ where: { sites: { some: { siteId: current.siteId } } } })
        await database.adminAuditLog.create({
          data: {
            adminId: request.adminId!, action: 'SITE_REJECTED', targetType: 'SITE', targetId: current.siteId,
            details: JSON.stringify({ requestId: request.params.requestId, reason: input.reason }),
          },
        })
      })
    } catch (error) {
      if (error instanceof ApprovalNotFoundError) return response.status(404).json({ message: '승인 요청을 찾을 수 없습니다.', requestId: request.requestId })
      if (error instanceof ApprovalConflictError) return response.status(409).json({ message: '이미 처리된 승인 요청입니다.', requestId: request.requestId })
      throw error
    }
    response.json({ request: await loadApprovalRequest(request.params.requestId) })
  } catch (error) { next(error) }
})

adminRouter.get('/audit-logs', async (request, response, next) => {
  try {
    const query = paginationSchema.parse(request.query)
    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        include: { admin: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit,
      }),
      prisma.adminAuditLog.count(),
    ])
    const totalPages = Math.max(1, Math.ceil(total / query.limit))
    response.json({ logs, pagination: { page: query.page, limit: query.limit, total, totalPages, hasNext: query.page < totalPages } })
  } catch (error) { next(error) }
})

function loadApprovalRequest(requestId: string) {
  return prisma.approvalRequest.findUnique({
    where: { id: requestId },
    include: {
      site: {
        include: {
          category: true,
          createdBy: { select: { id: true, nickname: true } },
          _count: { select: { discoveries: true, userSites: true } },
        },
      },
      resolvedBy: { select: { id: true, name: true } },
    },
  })
}

class ApprovalNotFoundError extends Error {}
class ApprovalConflictError extends Error {}
