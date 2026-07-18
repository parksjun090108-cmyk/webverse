import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { createToken, requireAuth } from '../lib/auth.js'

export const authRouter = Router()

const registerSchema = z.object({
  nickname: z.string().trim().min(2).max(24),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
})

authRouter.post('/register', async (request, response, next) => {
  try {
    const input = registerSchema.parse(request.body)
    if (await prisma.user.findUnique({ where: { email: input.email } })) {
      return response.status(409).json({ message: '이미 사용 중인 이메일입니다.' })
    }
    const user = await prisma.user.create({
      data: { nickname: input.nickname, email: input.email, passwordHash: await bcrypt.hash(input.password, 12) },
    })
    return response.status(201).json({ token: createToken(user.id), user: { id: user.id, nickname: user.nickname, email: user.email } })
  } catch (error) { next(error) }
})

authRouter.post('/login', async (request, response, next) => {
  try {
    const input = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string() }).parse(request.body)
    const user = await prisma.user.findUnique({ where: { email: input.email } })
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      return response.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' })
    }
    return response.json({ token: createToken(user.id), user: { id: user.id, nickname: user.nickname, email: user.email } })
  } catch (error) { next(error) }
})

authRouter.get('/me', requireAuth, async (request, response, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.userId! }, select: { id: true, nickname: true, email: true, createdAt: true } })
    response.json({ user })
  } catch (error) { next(error) }
})
