import { PrismaClient } from '@prisma/client'
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
  console.log(`Seeded ${CATEGORY_DEFINITIONS.length} categories and ${OFFICIAL_SITES.length} official sites.`)
}

main().finally(() => prisma.$disconnect())
