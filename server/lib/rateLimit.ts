import type { Request, RequestHandler } from 'express'

type RateLimitOptions = {
  windowMs: number
  max: number
  keyPrefix: string
  message: string
  skipSuccessfulRequests?: boolean
  key?: (request: Request) => string
}

type Entry = { count: number; resetAt: number }

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const entries = new Map<string, Entry>()
  let lastCleanup = Date.now()

  return (request, response, next) => {
    const now = Date.now()
    if (now - lastCleanup >= options.windowMs) {
      for (const [key, entry] of entries) if (entry.resetAt <= now) entries.delete(key)
      lastCleanup = now
    }

    const identity = options.key?.(request) || request.ip || request.socket.remoteAddress || 'unknown'
    const key = `${options.keyPrefix}:${identity}`
    const current = entries.get(key)
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + options.windowMs } : current
    entry.count += 1
    entries.set(key, entry)

    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1_000))
    response.setHeader('RateLimit-Limit', options.max)
    response.setHeader('RateLimit-Remaining', Math.max(0, options.max - entry.count))
    response.setHeader('RateLimit-Reset', retryAfter)

    if (entry.count > options.max) {
      response.setHeader('Retry-After', retryAfter)
      return response.status(429).json({ message: options.message, retryAfter, requestId: request.requestId })
    }

    if (options.skipSuccessfulRequests) {
      response.on('finish', () => {
        if (response.statusCode < 400) {
          const saved = entries.get(key)
          if (saved) saved.count = Math.max(0, saved.count - 1)
        }
      })
    }
    next()
  }
}
