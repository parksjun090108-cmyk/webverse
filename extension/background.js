const DEFAULT_API_URL = 'http://localhost:4000/api'
const MAX_QUEUE = 500
const SAME_DOMAIN_COOLDOWN_MS = 30_000

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(['apiUrl', 'enabled', 'queue'])
  await chrome.storage.local.set({
    apiUrl: current.apiUrl || DEFAULT_API_URL,
    enabled: current.enabled ?? true,
    queue: current.queue || [],
  })
  chrome.alarms.create('webverse-flush', { periodInMinutes: 1 })
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'webverse-flush') void flushQueue()
})

chrome.history.onVisited.addListener((item) => {
  void captureVisit(item.url)
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'flush') void flushQueue().then(sendResponse)
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
  void flushQueue()
}

async function flushQueue() {
  const settings = await chrome.storage.local.get(['token', 'apiUrl', 'enabled', 'queue', 'syncedToday', 'syncedDate'])
  const queue = Array.isArray(settings.queue) ? settings.queue : []
  if (!settings.token || settings.enabled === false || !queue.length) return { ok: false, pending: queue.length }
  try {
    const response = await fetch(`${String(settings.apiUrl || DEFAULT_API_URL).replace(/\/$/, '')}/extension/visits`, {
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
    if (queue.length > 50) return flushQueue()
    return { ok: true, pending: Math.max(0, queue.length - 50), ...result }
  } catch {
    return { ok: false, pending: queue.length }
  }
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
