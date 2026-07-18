import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'
import { analyzeConstellations } from '../services/constellation.js'

export const constellationsRouter = Router()
constellationsRouter.use(requireAuth)

constellationsRouter.get('/', async (request, response, next) => {
  try {
    const constellations = await prisma.constellation.findMany({
      where: { userId: request.userId! },
      include: {
        sites: { include: { site: { include: { category: true } } }, orderBy: { sequence: 'asc' } },
        edges: { orderBy: { count: 'desc' } },
      },
      orderBy: [{ strength: 'desc' }, { occurrenceCount: 'desc' }],
    })
    response.json({ constellations })
  } catch (error) { next(error) }
})

constellationsRouter.post('/analyze', async (request, response, next) => {
  try {
    await analyzeConstellations(request.userId!)
    response.status(204).end()
  } catch (error) { next(error) }
})

constellationsRouter.patch('/:id', async (request, response, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(1).max(40) }).parse(request.body)
    const existing = await prisma.constellation.findFirstOrThrow({ where: { id: request.params.id, userId: request.userId! } })
    const constellation = await prisma.constellation.update({ where: { id: existing.id }, data: { name: input.name } })
    response.json({ constellation })
  } catch (error) { next(error) }
})
