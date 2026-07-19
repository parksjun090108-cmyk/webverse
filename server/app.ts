import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import { randomUUID } from 'node:crypto'
import { ZodError } from 'zod'
import { env } from './lib/env.js'
import { authRouter } from './routes/auth.js'
import { sitesRouter } from './routes/sites.js'
import { constellationsRouter } from './routes/constellations.js'
import { usersRouter } from './routes/users.js'
import { MetadataFetchError, UnsafeUrlError } from './services/siteMetadata.js'
import { prisma } from './lib/prisma.js'
import { Prisma } from '@prisma/client'
import { logger } from './lib/logger.js'
import { createRateLimiter } from './lib/rateLimit.js'
import { securityHeaders } from './lib/security.js'
import { extensionRouter } from './routes/extension.js'
import { adminRouter } from './routes/admin.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.set('query parser', 'simple')
  app.use((request, response, next) => {
    const suppliedId = request.get('x-request-id')
    request.requestId = suppliedId && /^[a-zA-Z0-9_-]{8,80}$/.test(suppliedId) ? suppliedId : randomUUID()
    response.setHeader('x-request-id', request.requestId)
    const startedAt = performance.now()
    response.on('finish', () => {
      if (request.path === '/api/health' && response.statusCode < 400) return
      const durationMs = Math.round(performance.now() - startedAt)
      const fields = { requestId: request.requestId, method: request.method, path: request.originalUrl.split('?')[0] || request.path, status: response.statusCode, durationMs }
      if (response.statusCode >= 500) logger.error('http_request', fields)
      else if (response.statusCode >= 400 || durationMs >= 1_000) logger.warn('http_request', fields)
      else logger.info('http_request', fields)
    })
    next()
  })
  app.use(securityHeaders)
  const allowedOrigins = env.WEB_ORIGIN.split(',').map((origin) => origin.trim().replace(/\/+$/, '')).filter(Boolean)
  app.use(cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
    credentials: false,
  }))
  app.use(express.json({ limit: '64kb' }))
  app.use('/api', createRateLimiter({
    windowMs: 5 * 60_000, max: 300, keyPrefix: 'api',
    message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  }))
  app.use('/api/auth', createRateLimiter({
    windowMs: 15 * 60_000, max: 10, keyPrefix: 'auth', skipSuccessfulRequests: true,
    message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
  }))

  app.get('/api/health', (_request, response) => response.json({ ok: true, service: 'webverse-api' }))
  app.get('/api/ready', async (_request, response) => {
    try { await prisma.$queryRawUnsafe('SELECT 1'); response.json({ ok: true, database: 'connected' }) }
    catch { response.status(503).json({ ok: false, database: 'unavailable' }) }
  })
  app.use('/api/auth', authRouter)
  app.use('/api/sites', sitesRouter)
  app.use('/api/constellations', constellationsRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/extension', extensionRouter)
  app.use('/api/admin', adminRouter)
  app.use((request, response) => response.status(404).json({ message: '요청한 API를 찾을 수 없습니다.', requestId: request.requestId }))

  const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
    if (error instanceof ZodError) return response.status(400).json({ message: '입력값을 확인해주세요.', issues: error.issues, requestId: request.requestId })
    if (error instanceof UnsafeUrlError) return response.status(400).json({ message: error.message, requestId: request.requestId })
    if (error instanceof MetadataFetchError) return response.status(422).json({ message: error.message, requestId: request.requestId })
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return response.status(404).json({ message: '요청한 데이터를 찾을 수 없습니다.', requestId: request.requestId })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return response.status(409).json({ message: '이미 존재하는 데이터입니다.', requestId: request.requestId })
    }
    if (isExpressBodyError(error)) {
      const status = error.status === 413 ? 413 : 400
      const message = status === 413 ? '요청 데이터가 너무 큽니다.' : 'JSON 형식을 확인해주세요.'
      return response.status(status).json({ message, requestId: request.requestId })
    }
    logger.error('unhandled_request_error', {
      requestId: request.requestId,
      method: request.method,
      path: request.originalUrl.split('?')[0] || request.path,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : 'Unknown server error',
    })
    return response.status(500).json({ message: '서버 오류가 발생했습니다.', requestId: request.requestId })
  }
  app.use(errorHandler)
  return app
}

function isExpressBodyError(error: unknown): error is { status: number; type?: string } {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { status?: unknown; type?: unknown }
  return (candidate.status === 400 && candidate.type === 'entity.parse.failed') || candidate.status === 413
}
