import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import bcrypt from 'bcryptjs'
import { createApp } from '../app.js'
import { createToken } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'

const stamp = Date.now()
const adminEmail = `admin-${stamp}@webverse.test`
const adminPassword = 'short'
const userEmail = `admin-flow-user-${stamp}@webverse.test`
const approvedDomain = `approved-${stamp}.example.com`
const rejectedDomain = `rejected-${stamp}.example.com`
let adminId = ''
let userId = ''
let discoveryUserIds: string[] = []
let approvedSiteId = ''
let rejectedSiteId = ''

const server = createApp().listen(0)
const port = (server.address() as AddressInfo).port
const baseUrl = `http://127.0.0.1:${port}/api/admin`
const apiBaseUrl = `http://127.0.0.1:${port}/api`

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

async function userRequest(path: string, userToken: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}`, ...options.headers },
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

try {
  const category = await prisma.category.findFirstOrThrow({ orderBy: { name: 'asc' } })
  const admin = await prisma.admin.create({
    data: { name: 'Integration Admin', email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 4) },
  })
  adminId = admin.id
  const user = await prisma.user.create({
    data: { nickname: 'Approval Owner', email: userEmail, passwordHash: await bcrypt.hash('User-password-123!', 4) },
  })
  userId = user.id

  const approvedSite = await prisma.site.create({
    data: { name: 'Approve Candidate', domain: approvedDomain, normalizedUrl: `https://${approvedDomain}`, status: 'PENDING', createdById: user.id },
  })
  approvedSiteId = approvedSite.id
  const discoveryUsers = [user]
  for (let index = 0; index < 2; index += 1) {
    discoveryUsers.push(await prisma.user.create({
      data: {
        nickname: `Discoverer ${index + 2}`,
        email: `discoverer-${stamp}-${index}@webverse.test`,
        passwordHash: await bcrypt.hash('User-password-123!', 4),
      },
    }))
  }
  discoveryUserIds = discoveryUsers.map((entry) => entry.id)
  for (let index = 0; index < discoveryUsers.length; index += 1) {
    const discovered = await userRequest(`/sites/${approvedSite.id}/discover`, createToken(discoveryUsers[index]!.id), { method: 'POST' })
    assert.equal(discovered.status, 201)
    assert.equal(discovered.body.site.status, 'REVIEW_REQUESTED')
    if (index === 0) {
      assert.ok(await prisma.approvalRequest.findUnique({ where: { siteId: approvedSite.id } }))
    }
  }
  const approvedRequest = await prisma.approvalRequest.findUniqueOrThrow({ where: { siteId: approvedSite.id } })
  assert.equal(await prisma.siteDiscovery.count({ where: { siteId: approvedSite.id } }), 3)

  const rejectedSite = await prisma.site.create({
    data: { name: 'Reject Candidate', domain: rejectedDomain, normalizedUrl: `https://${rejectedDomain}`, status: 'REVIEW_REQUESTED', createdById: user.id },
  })
  rejectedSiteId = rejectedSite.id
  const rejectedRequest = await prisma.approvalRequest.create({ data: { siteId: rejectedSite.id } })
  await prisma.userSite.create({ data: { userId: user.id, siteId: rejectedSite.id } })

  const userDenied = await request('/requests', { headers: { Authorization: `Bearer ${createToken(user.id)}` } })
  assert.equal(userDenied.status, 401)

  const wrongLogin = await request('/auth/login', {
    method: 'POST', body: JSON.stringify({ email: adminEmail, password: 'wrong-password' }),
  })
  assert.equal(wrongLogin.status, 401)

  const login = await request('/auth/login', {
    method: 'POST', body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  })
  assert.equal(login.status, 200)
  assert.ok(login.body.token)
  const authorization = { Authorization: `Bearer ${login.body.token}` }

  const me = await request('/me', { headers: authorization })
  assert.equal(me.status, 200)
  assert.equal(me.body.admin.email, adminEmail)

  const list = await request('/requests?status=REQUESTED', { headers: authorization })
  assert.equal(list.status, 200)
  assert.ok(list.body.requests.some((entry: { id: string }) => entry.id === approvedRequest.id))
  assert.ok(list.body.requests.some((entry: { id: string }) => entry.id === rejectedRequest.id))

  const approved = await request(`/requests/${approvedRequest.id}/approve`, {
    method: 'POST', headers: authorization,
    body: JSON.stringify({ categoryId: category.id }),
  })
  assert.equal(approved.status, 200)
  assert.equal(approved.body.request.status, 'APPROVED')
  assert.equal(approved.body.request.resolutionNote, null)
  const approvedSiteAfter = await prisma.site.findUniqueOrThrow({ where: { id: approvedSite.id } })
  assert.equal(approvedSiteAfter.status, 'APPROVED')
  assert.equal(approvedSiteAfter.verified, true)
  assert.equal(approvedSiteAfter.categoryId, category.id)

  const duplicateApproval = await request(`/requests/${approvedRequest.id}/approve`, {
    method: 'POST', headers: authorization, body: JSON.stringify({ categoryId: category.id }),
  })
  assert.equal(duplicateApproval.status, 409)

  const rejected = await request(`/requests/${rejectedRequest.id}/reject`, {
    method: 'POST', headers: authorization, body: JSON.stringify({ reason: '공식 사이트로 확인할 수 없음' }),
  })
  assert.equal(rejected.status, 200)
  assert.equal(rejected.body.request.status, 'REJECTED')
  const rejectedSiteAfter = await prisma.site.findUniqueOrThrow({ where: { id: rejectedSite.id } })
  assert.equal(rejectedSiteAfter.status, 'REJECTED_PRIVATE')
  assert.equal(rejectedSiteAfter.categoryId, null)
  assert.equal(await prisma.userSite.count({ where: { userId: user.id, siteId: rejectedSite.id } }), 1)
  const ownerUniverse = await userRequest('/sites/mine', createToken(user.id))
  const rejectedUserSite = ownerUniverse.body.userSites.find((entry: { site: { id: string } }) => entry.site.id === rejectedSite.id)
  assert.equal(rejectedUserSite.site.approvalRequest.status, 'REJECTED')
  assert.equal(rejectedUserSite.site.approvalRequest.resolutionNote, '공식 사이트로 확인할 수 없음')

  assert.equal(await prisma.adminAuditLog.count({ where: { adminId: admin.id, action: { in: ['SITE_APPROVED', 'SITE_REJECTED'] } } }), 2)

  await prisma.admin.update({ where: { id: admin.id }, data: { active: false } })
  const disabled = await request('/me', { headers: authorization })
  assert.equal(disabled.status, 403)

  console.log('Admin API integration lifecycle passed')
} finally {
  if (approvedSiteId || rejectedSiteId) await prisma.site.deleteMany({ where: { id: { in: [approvedSiteId, rejectedSiteId].filter(Boolean) } } })
  if (discoveryUserIds.length || userId) await prisma.user.deleteMany({ where: { id: { in: [...new Set([...discoveryUserIds, userId].filter(Boolean))] } } })
  if (adminId) {
    await prisma.adminAuditLog.deleteMany({ where: { adminId } })
    await prisma.admin.deleteMany({ where: { id: adminId } })
  }
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  await prisma.$disconnect()
}
