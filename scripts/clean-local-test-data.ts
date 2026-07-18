import { PrismaClient } from '@prisma/client'

if (!process.argv.includes('--confirm')) throw new Error('안전 확인이 필요합니다: pnpm db:clean:test -- --confirm')
if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.startsWith('postgres')) {
  throw new Error('운영 PostgreSQL에서는 이 명령을 실행할 수 없습니다.')
}

const prisma = new PrismaClient()
try {
  const before = {
    users: await prisma.user.count(),
    userSites: await prisma.userSite.count(),
    histories: await prisma.history.count(),
    constellations: await prisma.constellation.count(),
    extensionSessions: await prisma.extensionSession.count(),
    nonOfficialSites: await prisma.site.count({ where: { status: { not: 'APPROVED' } } }),
  }
  await prisma.user.deleteMany()
  await prisma.site.deleteMany({ where: { status: { not: 'APPROVED' } } })
  const after = {
    users: await prisma.user.count(),
    userSites: await prisma.userSite.count(),
    histories: await prisma.history.count(),
    constellations: await prisma.constellation.count(),
    extensionSessions: await prisma.extensionSession.count(),
    nonOfficialSites: await prisma.site.count({ where: { status: { not: 'APPROVED' } } }),
  }
  console.log('정리 전:', before)
  console.log('정리 후:', after)
} finally {
  await prisma.$disconnect()
}
