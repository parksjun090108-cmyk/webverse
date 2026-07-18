import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireAuth } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'

export const usersRouter = Router()
usersRouter.use(requireAuth)

usersRouter.patch('/me', async (request, response, next) => {
  try {
    const input = z.object({ nickname: z.string().trim().min(2).max(24) }).parse(request.body)
    const user = await prisma.user.update({
      where: { id: request.userId! }, data: input,
      select: { id: true, nickname: true, email: true },
    })
    response.json({ user })
  } catch (error) { next(error) }
})

usersRouter.patch('/me/password', async (request, response, next) => {
  try {
    const input = z.object({ currentPassword: z.string(), newPassword: z.string().min(8).max(72) }).parse(request.body)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.userId! } })
    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      return response.status(403).json({ message: '현재 비밀번호가 올바르지 않습니다.' })
    }
    if (input.currentPassword === input.newPassword) {
      return response.status(400).json({ message: '새 비밀번호는 현재 비밀번호와 달라야 합니다.' })
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(input.newPassword, 12) } })
    response.status(204).end()
  } catch (error) { next(error) }
})

usersRouter.delete('/me', async (request, response, next) => {
  try {
    const input = z.object({ password: z.string() }).parse(request.body)
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.userId! },
      include: { createdSites: { where: { status: { not: 'APPROVED' } }, select: { id: true } } },
    })
    if (!(await bcrypt.compare(input.password, user.passwordHash))) {
      return response.status(403).json({ message: '비밀번호가 올바르지 않습니다.' })
    }
    const privateSiteIds = user.createdSites.map((site) => site.id)
    await prisma.user.delete({ where: { id: user.id } })
    if (privateSiteIds.length) {
      await prisma.site.deleteMany({ where: { id: { in: privateSiteIds }, status: { not: 'APPROVED' }, userSites: { none: {} } } })
    }
    response.status(204).end()
  } catch (error) { next(error) }
})
