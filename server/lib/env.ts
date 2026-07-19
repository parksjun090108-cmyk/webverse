import { z } from 'zod'

const originsSchema = z.string().default('http://localhost:4173').refine((value) => value.split(',').every((rawOrigin) => {
  const origin = rawOrigin.trim().replace(/\/+$/, '')
  if (!origin) return false
  try {
    const parsed = new URL(origin)
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin === origin
  } catch { return false }
}), 'WEB_ORIGIN must contain comma-separated HTTP(S) origins without paths.')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(24).default('webverse-local-development-secret'),
  ADMIN_JWT_SECRET: z.string().min(24).optional(),
  ADMIN_EMAIL: z.string().trim().toLowerCase().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).max(72).optional(),
  ADMIN_NAME: z.string().trim().min(2).max(40).default('WebVerse Admin'),
  WEB_ORIGIN: originsSchema,
}).superRefine((value, context) => {
  if (Boolean(value.ADMIN_EMAIL) !== Boolean(value.ADMIN_PASSWORD)) {
    context.addIssue({ code: 'custom', path: ['ADMIN_EMAIL'], message: 'ADMIN_EMAIL and ADMIN_PASSWORD must be set together.' })
  }
})

export const env = schema.parse(process.env)

if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'webverse-local-development-secret') {
  throw new Error('Production requires a unique JWT_SECRET.')
}
