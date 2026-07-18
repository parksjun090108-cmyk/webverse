import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(24).default('webverse-local-development-secret'),
  WEB_ORIGIN: z.string().url().default('http://localhost:4173'),
})

export const env = schema.parse(process.env)

if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'webverse-local-development-secret') {
  throw new Error('Production requires a unique JWT_SECRET.')
}
