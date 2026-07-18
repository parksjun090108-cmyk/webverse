import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from './env.js'

export function createToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '7d' })
}

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return response.status(401).json({ message: '로그인이 필요합니다.', requestId: request.requestId })
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    if (typeof payload === 'string' || !payload.sub) throw new Error('Invalid token')
    request.userId = String(payload.sub)
    next()
  } catch {
    return response.status(401).json({ message: '로그인 정보가 만료되었습니다.', requestId: request.requestId })
  }
}
