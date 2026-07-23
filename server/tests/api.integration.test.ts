import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { createApp } from '../app.js'
import { prisma } from '../lib/prisma.js'

const email = `integration-${Date.now()}@webverse.test`
const importedDomain = `browser-import-${Date.now()}.example.com`
const originalPassword = 'Test-password-123!'
const newPassword = 'Changed-password-456!'
const server = createApp().listen(0)
const port = (server.address() as AddressInfo).port
const baseUrl = `http://127.0.0.1:${port}/api`
let token = ''
let importedSiteId = ''

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null, requestId: response.headers.get('x-request-id') }
}

try {
  const health = await request('/health')
  assert.equal(health.status, 200)
  assert.equal(health.body.ok, true)
  assert.ok(health.requestId)
  const healthResponse = await fetch(`${baseUrl}/health`)
  assert.equal(healthResponse.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(healthResponse.headers.get('x-frame-options'), 'DENY')

  const missing = await request('/does-not-exist')
  assert.equal(missing.status, 404)
  assert.equal(missing.body.requestId, missing.requestId)

  const malformed = await request('/auth/login', { method: 'POST', body: '{broken-json' })
  assert.equal(malformed.status, 400)
  assert.equal(malformed.body.requestId, malformed.requestId)

  const traced = await request('/health', { headers: { 'x-request-id': 'integration-request-123' } })
  assert.equal(traced.requestId, 'integration-request-123')

  const unauthorized = await request('/sites/mine')
  assert.equal(unauthorized.status, 401)
  assert.equal(unauthorized.body.requestId, unauthorized.requestId)
  const invalidToken = await request('/sites/mine', { headers: { Authorization: 'Bearer invalid-token' } })
  assert.equal(invalidToken.status, 401)
  assert.equal(invalidToken.body.requestId, invalidToken.requestId)

  const registration = await request('/auth/register', {
    method: 'POST', body: JSON.stringify({ nickname: 'Integration Explorer', email, password: originalPassword }),
  })
  assert.equal(registration.status, 201)
  assert.ok(registration.body.token)
  token = registration.body.token
  const userId = registration.body.user.id as string

  const duplicate = await request('/auth/register', {
    method: 'POST', body: JSON.stringify({ nickname: 'Duplicate', email, password: originalPassword }),
  })
  assert.equal(duplicate.status, 409)

  const me = await request('/auth/me')
  assert.equal(me.status, 200)
  assert.equal(me.body.user.email, email)

  const catalog = await request('/sites')
  assert.equal(catalog.status, 200)
  assert.equal(catalog.body.sites.length, 50)
  assert.ok(catalog.body.pagination.total >= 74)
  assert.equal(catalog.body.pagination.hasNext, true)
  let catalogCount = catalog.body.sites.length
  for (let page = 2; page <= catalog.body.pagination.totalPages; page += 1) {
    const pageResult = await request(`/sites?page=${page}&limit=50`)
    assert.equal(pageResult.status, 200)
    catalogCount += pageResult.body.sites.length
    assert.equal(pageResult.body.pagination.hasNext, page < catalog.body.pagination.totalPages)
  }
  assert.equal(catalogCount, catalog.body.pagination.total)
  const searched = await request('/sites?q=github')
  assert.equal(searched.body.pagination.total, 1)
  assert.equal(searched.body.sites[0].domain, 'github.com')
  const categoryResult = await request('/sites?category=Development')
  assert.ok(categoryResult.body.sites.length >= 7)
  assert.ok(categoryResult.body.sites.every((site: { category: { name: string } }) => site.category.name === 'Development'))
  const targetSites = categoryResult.body.sites.slice(0, 3) as Array<{ id: string; name: string; domain: string }>
  const targetSite = targetSites[0]
  assert.ok(targetSite?.id)

  const invalidPage = await request('/sites?page=0')
  assert.equal(invalidPage.status, 400)
  const missingSite = await request('/sites/site-that-does-not-exist/discover', { method: 'POST' })
  assert.equal(missingSite.status, 404)
  assert.equal(missingSite.body.requestId, missingSite.requestId)

  const emptyUniverse = await request('/sites/mine')
  assert.equal(emptyUniverse.body.userSites.length, 0)

  for (const site of targetSites) {
    const discovered = await request(`/sites/${site.id}/discover`, { method: 'POST' })
    assert.equal(discovered.status, 201)
  }
  const duplicateDiscovery = await request(`/sites/${targetSite.id}/discover`, { method: 'POST' })
  assert.equal(duplicateDiscovery.status, 201)
  assert.equal(await prisma.siteDiscovery.count({ where: { userId, siteId: targetSite.id } }), 1)
  assert.equal(await prisma.history.count({ where: { userId, siteId: targetSite.id, action: 'DISCOVER' } }), 1)
  let universe = await request('/sites/mine')
  assert.equal(universe.body.userSites.length, 3)
  assert.ok(universe.body.userSites.every((entry: { visitCount: number }) => entry.visitCount === 0))

  const pairing = await request('/extension/pairing', { method: 'POST' })
  assert.equal(pairing.status, 201)
  assert.match(pairing.body.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  const extensionConnection = await request('/extension/connect', {
    method: 'POST', body: JSON.stringify({ code: pairing.body.code, deviceName: 'Integration Browser' }),
  })
  assert.equal(extensionConnection.status, 201)
  const extensionToken = extensionConnection.body.token as string
  const importStatus = await request('/extension/initial-import/status', { headers: { Authorization: `Extension ${extensionToken}` } })
  assert.equal(importStatus.status, 200)
  assert.equal(importStatus.body.imported, false)
  const initialImport = await request('/extension/initial-import', {
    method: 'POST', headers: { Authorization: `Extension ${extensionToken}` },
    body: JSON.stringify({ sites: [
      { domain: targetSite.domain, name: targetSite.name, visitCount: 0, lastVisitedAt: null, bookmarked: true },
      { domain: importedDomain, name: 'Imported Bookmark', visitCount: 2, lastVisitedAt: new Date().toISOString(), bookmarked: true },
    ] }),
  })
  assert.equal(initialImport.status, 201)
  assert.equal(initialImport.body.selected, 2)
  assert.equal(initialImport.body.added, 1)
  importedSiteId = (await prisma.site.findUniqueOrThrow({ where: { domain: importedDomain } })).id
  assert.equal((await prisma.site.findUniqueOrThrow({ where: { id: importedSiteId } })).status, 'UNLISTED')
  assert.equal(await prisma.approvalRequest.findUnique({ where: { siteId: importedSiteId } }), null)
  const importedUniverse = await request('/sites/mine')
  const importedBookmark = importedUniverse.body.userSites.find((entry: { site: { id: string } }) => entry.site.id === importedSiteId)
  assert.equal(importedBookmark.favorite, true)
  const duplicateImport = await request('/extension/initial-import', {
    method: 'POST', headers: { Authorization: `Extension ${extensionToken}` },
    body: JSON.stringify({ sites: [{ domain: targetSite.domain, name: targetSite.name, visitCount: 0, lastVisitedAt: null, bookmarked: false }] }),
  })
  assert.equal(duplicateImport.status, 409)
  const bookmarkRemoved = await request('/extension/bookmarks', {
    method: 'POST', headers: { Authorization: `Extension ${extensionToken}` },
    body: JSON.stringify({ events: [{ domain: importedDomain, name: 'Imported Bookmark', bookmarked: false }] }),
  })
  assert.equal(bookmarkRemoved.status, 200)
  const importedAfterRemoval = (await request('/sites/mine')).body.userSites.find((entry: { site: { id: string } }) => entry.site.id === importedSiteId)
  assert.equal(importedAfterRemoval.favorite, false)
  const extensionEventId = randomUUID()
  const extensionVisit = await request('/extension/visits', {
    method: 'POST', headers: { Authorization: `Extension ${extensionToken}` },
    body: JSON.stringify({ events: [{ id: extensionEventId, domain: targetSite.domain, visitedAt: new Date().toISOString() }] }),
  })
  assert.equal(extensionVisit.status, 200)
  assert.equal(extensionVisit.body.accepted, 1)
  const duplicateExtensionVisit = await request('/extension/visits', {
    method: 'POST', headers: { Authorization: `Extension ${extensionToken}` },
    body: JSON.stringify({ events: [{ id: extensionEventId, domain: targetSite.domain, visitedAt: new Date().toISOString() }] }),
  })
  assert.equal(duplicateExtensionVisit.body.duplicates, 1)
  assert.equal((await request('/extension/status')).body.sessions[0].deviceName, 'Integration Browser')

  const favorite = await request(`/sites/${targetSite.id}/favorite`, { method: 'PATCH', body: JSON.stringify({ favorite: true }) })
  assert.equal(favorite.status, 200)
  assert.equal(favorite.body.userSite.favorite, true)

  for (let round = 0; round < 3; round += 1) {
    for (const site of targetSites) {
      const visit = await request(`/sites/${site.id}/visit`, { method: 'POST' })
      assert.equal(visit.status, 200)
      assert.equal(visit.body.userSite.visitCount, round + 1 + (site.id === targetSite.id ? 1 : 0))
    }
  }
  const constellationResult = await request('/constellations')
  assert.equal(constellationResult.status, 200)
  assert.equal(constellationResult.body.constellations.length, 1)
  assert.equal(constellationResult.body.constellations[0].occurrenceCount, 3)
  assert.equal(constellationResult.body.constellations[0].sites.length, 3)
  assert.equal(constellationResult.body.constellations[0].edges.length, 2)
  assert.ok(constellationResult.body.constellations[0].edges.every((edge: { count: number }) => edge.count >= 3))
  const renamed = await request(`/constellations/${constellationResult.body.constellations[0].id}`, {
    method: 'PATCH', body: JSON.stringify({ name: '나의 개발 별자리' }),
  })
  assert.equal(renamed.status, 200)
  assert.equal(renamed.body.constellation.name, '나의 개발 별자리')
  const revoked = await request('/extension/connections', { method: 'DELETE' })
  assert.equal(revoked.status, 204)
  const rejectedExtensionVisit = await request('/extension/visits', {
    method: 'POST', headers: { Authorization: `Extension ${extensionToken}` },
    body: JSON.stringify({ events: [{ id: randomUUID(), domain: targetSite.domain, visitedAt: new Date().toISOString() }] }),
  })
  assert.equal(rejectedExtensionVisit.status, 401)

  const profile = await request('/users/me', { method: 'PATCH', body: JSON.stringify({ nickname: 'Updated Explorer' }) })
  assert.equal(profile.status, 200)
  assert.equal(profile.body.user.nickname, 'Updated Explorer')

  const password = await request('/users/me/password', {
    method: 'PATCH', body: JSON.stringify({ currentPassword: originalPassword, newPassword }),
  })
  assert.equal(password.status, 204)

  token = ''
  const login = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: newPassword }) })
  assert.equal(login.status, 200)
  token = login.body.token

  const removed = await request(`/sites/${targetSite.id}`, { method: 'DELETE' })
  assert.equal(removed.status, 204)
  const removedAgain = await request(`/sites/${targetSite.id}`, { method: 'DELETE' })
  assert.equal(removedAgain.status, 404)
  universe = await request('/sites/mine')
  assert.equal(universe.body.userSites.length, 3)
  assert.equal((await request('/constellations')).body.constellations.length, 0)

  const deleted = await request('/users/me', { method: 'DELETE', body: JSON.stringify({ password: newPassword }) })
  assert.equal(deleted.status, 204)
  assert.equal(await prisma.user.count({ where: { email } }), 0)
  assert.equal(await prisma.userSite.count({ where: { userId } }), 0)
  assert.equal(await prisma.history.count({ where: { userId } }), 0)
  assert.equal(await prisma.siteDiscovery.count({ where: { userId } }), 0)
  assert.equal(await prisma.constellation.count({ where: { userId } }), 0)

  let limited = false
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'missing@webverse.test', password: 'wrong-password' }) })
    if (result.status === 429) {
      assert.ok(result.body.retryAfter > 0)
      assert.ok(result.requestId)
      limited = true
      break
    }
  }
  assert.equal(limited, true)

  console.log('API integration lifecycle passed')
} finally {
  await prisma.user.deleteMany({ where: { email } })
  if (importedSiteId) await prisma.site.deleteMany({ where: { id: importedSiteId } })
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  await prisma.$disconnect()
}
