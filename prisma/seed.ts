import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { CATEGORY_DEFINITIONS } from '../src/data/categories'
import { OFFICIAL_SITES } from '../src/data/officialSites'

const prisma = new PrismaClient()

async function main() {
  for (const { name, color, anchor } of CATEGORY_DEFINITIONS) {
    const [anchorX, anchorY, anchorZ] = anchor
    await prisma.category.upsert({ where: { name }, update: { color, anchorX, anchorY, anchorZ }, create: { name, color, anchorX, anchorY, anchorZ } })
  }
  for (const site of OFFICIAL_SITES) {
    const category = await prisma.category.findUniqueOrThrow({ where: { name: site.category } })
    const data = {
      name: site.name, domain: site.domain, normalizedUrl: `https://${site.domain}`,
      description: site.description, faviconUrl: `https://${site.domain}/favicon.ico`, categoryId: category.id, themeColor: category.color,
      status: 'APPROVED', verified: true,
    }
    await prisma.site.upsert({
      where: { domain: site.domain }, update: data, create: data,
    })
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD
  if (Boolean(adminEmail) !== Boolean(adminPassword)) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set together.')
  let adminCreated = false
  if (adminEmail && adminPassword) {
    const existing = await prisma.admin.findUnique({ where: { email: adminEmail } })
    if (existing) {
      await prisma.admin.update({ where: { id: existing.id }, data: { name: process.env.ADMIN_NAME?.trim() || existing.name } })
    } else {
      await prisma.admin.create({
        data: {
          name: process.env.ADMIN_NAME?.trim() || 'WebVerse Admin',
          email: adminEmail,
          passwordHash: await bcrypt.hash(adminPassword, 12),
        },
      })
      adminCreated = true
    }
  }
  console.log(`Seeded ${CATEGORY_DEFINITIONS.length} categories and ${OFFICIAL_SITES.length} official sites.${adminCreated ? ' Created the initial admin account.' : ''}`)
}

main().finally(() => prisma.$disconnect())
