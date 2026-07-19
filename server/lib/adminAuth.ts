import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from './env.js'
import { prisma } from './prisma.js'

const adminSecret = env.ADMIN_JWT_SECRET ?? env.JWT_SECRET

export function createAdminToken(adminId: string) {
  return jwt.sign({ sub: adminId, scope: 'admin' }, adminSecret, {
    expiresIn: '8h', issuer: 'webverse-api', audience: 'webverse-admin',
  })
}

export async function requireAdmin(request: Request, response: Response, next: NextFunction) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return response.status(401).json({ message: '관리자 로그인이 필요합니다.', requestId: request.requestId })
  try {
    const payload = jwt.verify(token, adminSecret, { issuer: 'webverse-api', audience: 'webverse-admin' })
    if (typeof payload === 'string' || !payload.sub || payload.scope !== 'admin') throw new Error('Invalid admin token')
    const adminId = String(payload.sub)
    const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { active: true } })
    if (!admin?.active) return response.status(403).json({ message: '비활성화된 관리자 계정입니다.', requestId: request.requestId })
    request.adminId = adminId
    next()
  } catch {
    return response.status(401).json({ message: '관리자 로그인 정보가 만료되었습니다.', requestId: request.requestId })
  }
}
