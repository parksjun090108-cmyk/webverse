import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import bcrypt from 'bcryptjs'
import { createApp } from '../app.js'
import { createToken } from '../lib/auth.js'
import { createAdminToken } from '../lib/adminAuth.js'
import { prisma } from '../lib/prisma.js'

const stamp = Date.now()
const server = createApp().listen(0)
const port = (server.address() as AddressInfo).port
const baseUrl = `http://127.0.0.1:${port}/api`
const userIds: string[] = []
const siteIds: string[] = []
let adminId = ''

async function request(path: string, token?: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

try {
  const [owner, viewer] = await Promise.all([
    prisma.user.create({ data: { nickname: 'Public Explorer', email: `galaxy-owner-${stamp}@test.dev`, passwordHash: await bcrypt.hash('password', 4) } }),
    prisma.user.create({ data: { nickname: 'Galaxy Viewer', email: `galaxy-viewer-${stamp}@test.dev`, passwordHash: await bcrypt.hash('password', 4) } }),
  ])
  userIds.push(owner.id, viewer.id)
  const category = await prisma.category.findFirstOrThrow()
  const approved = await prisma.site.create({ data: { name: 'Public Site', domain: `public-${stamp}.example.com`, normalizedUrl: `https://public-${stamp}.example.com`, status: 'APPROVED', verified: true, categoryId: category.id } })
  const unlisted = await prisma.site.create({ data: { name: 'Sensitive Private Tool', domain: `private-${stamp}.example.com`, normalizedUrl: `https://private-${stamp}.example.com`, status: 'UNLISTED', createdById: owner.id } })
  siteIds.push(approved.id, unlisted.id)
  await prisma.userSite.createMany({ data: [
    { userId: owner.id, siteId: approved.id, visitCount: 187, favorite: true, lastVisit: new Date() },
    { userId: owner.id, siteId: unlisted.id, visitCount: 73, browserFavorite: true, lastVisit: new Date() },
  ] })

  const ownerToken = createToken(owner.id)
  const viewerToken = createToken(viewer.id)
  assert.equal((await request('/galaxy/me', ownerToken)).body.profile.public, false)
  assert.equal((await request('/galaxy', viewerToken)).body.universes.length, 0)

  const published = await request('/galaxy/me', ownerToken, { method: 'PATCH', body: JSON.stringify({ public: true }) })
  assert.equal(published.status, 200)
  assert.equal(published.body.profile.public, true)
  const slug = published.body.profile.slug as string
  assert.match(slug, /^[A-Za-z0-9_-]{8,64}$/)

  const galaxy = await request('/galaxy', viewerToken)
  assert.equal(galaxy.status, 200)
  assert.equal(galaxy.body.universes.length, 1)
  assert.equal(galaxy.body.universes[0].nickname, 'Public Explorer')

  const publicUniverse = await request(`/galaxy/public/${slug}`)
  assert.equal(publicUniverse.status, 200)
  const publicSite = publicUniverse.body.universe.sites.find((site: { anonymous: boolean }) => !site.anonymous)
  const anonymousSite = publicUniverse.body.universe.sites.find((site: { anonymous: boolean }) => site.anonymous)
  assert.equal(publicSite.domain, approved.domain)
  assert.equal(publicSite.visitCount, 150)
  assert.equal(anonymousSite.name, '미확인 천체')
  assert.equal(anonymousSite.domain, '')
  assert.equal(anonymousSite.visitCount, 50)

  const reported = await request(`/galaxy/${slug}/report`, viewerToken, { method: 'POST', body: JSON.stringify({ reason: 'PRIVACY', details: '개인정보 노출 확인 필요' }) })
  assert.equal(reported.status, 201)
  assert.equal(await prisma.universeReport.count({ where: { targetUserId: owner.id, status: 'OPEN' } }), 1)

  assert.equal((await request(`/galaxy/${slug}/block`, viewerToken, { method: 'POST' })).status, 204)
  assert.equal((await request('/galaxy', viewerToken)).body.universes.length, 0)
  assert.equal((await request(`/galaxy/${slug}`, viewerToken)).status, 404)

  const admin = await prisma.admin.create({ data: { name: 'Galaxy Admin', email: `galaxy-admin-${stamp}@test.dev`, passwordHash: await bcrypt.hash('password', 4) } })
  adminId = admin.id
  const adminToken = createAdminToken(admin.id)
  const reports = await request('/admin/universe-reports?status=OPEN', adminToken)
  assert.equal(reports.status, 200)
  const reportId = reports.body.reports.find((report: { target: { id: string } }) => report.target.id === owner.id).id as string
  assert.equal((await request(`/admin/universe-reports/${reportId}/hide`, adminToken, { method: 'POST', body: JSON.stringify({ reason: '공개 운영 정책 위반' }) })).status, 204)
  assert.equal((await request(`/galaxy/public/${slug}`)).status, 404)
  const restricted = await request('/galaxy/me', ownerToken)
  assert.equal(restricted.body.profile.public, false)
  assert.equal(restricted.body.profile.restricted, true)
  assert.equal((await request('/galaxy/me', ownerToken, { method: 'PATCH', body: JSON.stringify({ public: true }) })).status, 403)

  console.log('Galaxy sharing and moderation lifecycle passed')
} finally {
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  if (siteIds.length) await prisma.site.deleteMany({ where: { id: { in: siteIds } } })
  if (adminId) {
    await prisma.adminAuditLog.deleteMany({ where: { adminId } })
    await prisma.admin.deleteMany({ where: { id: adminId } })
  }
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  await prisma.$disconnect()
}
