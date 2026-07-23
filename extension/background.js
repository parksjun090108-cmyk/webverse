const DEFAULT_API_URL = 'http://localhost:4000/api'
const MAX_QUEUE = 500
const SAME_DOMAIN_COOLDOWN_MS = 30_000

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(['apiUrl', 'enabled', 'queue', 'bookmarkQueue'])
  await chrome.storage.local.set({
    apiUrl: current.apiUrl || DEFAULT_API_URL,
    enabled: current.enabled ?? true,
    queue: current.queue || [],
    bookmarkQueue: current.bookmarkQueue || [],
  })
  chrome.alarms.create('webverse-flush', { periodInMinutes: 1 })
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'webverse-flush') void flushAllQueues()
})

chrome.history.onVisited.addListener((item) => {
  void captureVisit(item.url)
})

chrome.bookmarks.onCreated.addListener((_id, bookmark) => {
  if (bookmark.url) void captureBookmarkChange(bookmark.url, bookmark.title, true)
})

chrome.bookmarks.onRemoved.addListener((_id, info) => {
  if (info.node.url) void captureBookmarkRemoval(info.node.url, info.node.title)
})

chrome.bookmarks.onChanged.addListener((id, change) => {
  if (!change.url) return
  void chrome.bookmarks.get(id).then(([bookmark]) => {
    if (bookmark?.url) return captureBookmarkChange(bookmark.url, bookmark.title, true)
  })
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'flush') void flushAllQueues().then(sendResponse)
  else return false
  return true
})

async function captureVisit(rawUrl) {
  const settings = await chrome.storage.local.get(['token', 'enabled', 'lastDomain', 'lastVisitAt', 'queue'])
  if (!settings.token || settings.enabled === false) return
  const domain = domainFromUrl(rawUrl)
  if (!domain || isIgnoredDomain(domain)) return
  const now = Date.now()
  if (settings.lastDomain === domain && now - Number(settings.lastVisitAt || 0) < SAME_DOMAIN_COOLDOWN_MS) return
  const queue = Array.isArray(settings.queue) ? settings.queue : []
  queue.push({ id: crypto.randomUUID(), domain, visitedAt: new Date(now).toISOString() })
  await chrome.storage.local.set({ queue: queue.slice(-MAX_QUEUE), lastDomain: domain, lastVisitAt: now })
  void flushVisitQueue()
}

async function captureBookmarkRemoval(rawUrl, title) {
  const domain = domainFromUrl(rawUrl)
  if (!domain) return
  await captureBookmarkChange(rawUrl, title, await hasBookmarkForDomain(domain))
}

async function captureBookmarkChange(rawUrl, title, bookmarked) {
  const settings = await chrome.storage.local.get(['token', 'enabled', 'bookmarkQueue'])
  if (!settings.token || settings.enabled === false) return
  const domain = domainFromUrl(rawUrl)
  if (!domain || isIgnoredDomain(domain)) return
  const queue = Array.isArray(settings.bookmarkQueue) ? settings.bookmarkQueue : []
  const withoutDomain = queue.filter((entry) => entry.domain !== domain)
  withoutDomain.push({ domain, name: cleanName(title, domain), bookmarked })
  await chrome.storage.local.set({ bookmarkQueue: withoutDomain.slice(-MAX_QUEUE) })
  void flushBookmarkQueue()
}

async function flushAllQueues() {
  const visits = await flushVisitQueue()
  const bookmarks = await flushBookmarkQueue()
  return { visits, bookmarks }
}

async function flushVisitQueue() {
  const settings = await chrome.storage.local.get(['token', 'apiUrl', 'enabled', 'queue', 'syncedToday', 'syncedDate'])
  const queue = Array.isArray(settings.queue) ? settings.queue : []
  if (!settings.token || settings.enabled === false || !queue.length) return { ok: false, pending: queue.length }
  try {
    const response = await fetch(`${apiUrl(settings)}/extension/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Extension ${settings.token}` },
      body: JSON.stringify({ events: queue.slice(0, 50) }),
    })
    if (response.status === 401) {
      await chrome.storage.local.remove('token')
      return { ok: false, disconnected: true, pending: queue.length }
    }
    if (!response.ok) return { ok: false, pending: queue.length }
    const result = await response.json()
    const today = new Date().toISOString().slice(0, 10)
    const syncedToday = settings.syncedDate === today ? Number(settings.syncedToday || 0) : 0
    await chrome.storage.local.set({ queue: queue.slice(50), syncedDate: today, syncedToday: syncedToday + Number(result.accepted || 0), lastSyncAt: new Date().toISOString() })
    if (queue.length > 50) return flushVisitQueue()
    return { ok: true, pending: Math.max(0, queue.length - 50), ...result }
  } catch {
    return { ok: false, pending: queue.length }
  }
}

async function flushBookmarkQueue() {
  const settings = await chrome.storage.local.get(['token', 'apiUrl', 'enabled', 'bookmarkQueue'])
  const queue = Array.isArray(settings.bookmarkQueue) ? settings.bookmarkQueue : []
  if (!settings.token || settings.enabled === false || !queue.length) return { ok: false, pending: queue.length }
  try {
    const response = await fetch(`${apiUrl(settings)}/extension/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Extension ${settings.token}` },
      body: JSON.stringify({ events: queue.slice(0, 50) }),
    })
    if (response.status === 401) {
      await chrome.storage.local.remove('token')
      return { ok: false, disconnected: true, pending: queue.length }
    }
    if (!response.ok) return { ok: false, pending: queue.length }
    await chrome.storage.local.set({ bookmarkQueue: queue.slice(50) })
    if (queue.length > 50) return flushBookmarkQueue()
    return { ok: true, pending: Math.max(0, queue.length - 50) }
  } catch {
    return { ok: false, pending: queue.length }
  }
}

async function hasBookmarkForDomain(domain) {
  const roots = await chrome.bookmarks.getTree()
  const stack = [...roots]
  while (stack.length) {
    const node = stack.pop()
    if (node.url && domainFromUrl(node.url) === domain) return true
    if (node.children) stack.push(...node.children)
  }
  return false
}

function apiUrl(settings) {
  return String(settings.apiUrl || DEFAULT_API_URL).replace(/\/$/, '')
}

function domainFromUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
  } catch { return null }
}

function isIgnoredDomain(domain) {
  return domain === 'localhost' || domain.endsWith('.local') || domain === '127.0.0.1'
}

function cleanName(value, domain) {
  const name = String(value || '').trim().slice(0, 120)
  return name || domain.split('.')[0].replace(/^./, (letter) => letter.toUpperCase())
}
