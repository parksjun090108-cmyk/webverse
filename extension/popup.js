const DEFAULT_API_URL = 'http://localhost:4000/api'
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const HISTORY_RESULT_LIMIT = 2000
const elements = Object.fromEntries([
  'status','connectPanel','importPanel','scanState','importControls','selectAll','selectedCount','candidateList','importSelected',
  'syncPanel','code','connect','syncedToday','pending','enabled','syncNow','disconnect','apiUrl','saveApi','message',
].map((id) => [id, document.getElementById(id)]))

let candidates = []
let scanning = false

void refresh()

elements.code.addEventListener('input', () => {
  const raw = elements.code.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8)
  elements.code.value = raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw
})
elements.connect.addEventListener('click', connect)
elements.enabled.addEventListener('change', async () => { await chrome.storage.local.set({ enabled: elements.enabled.checked }); await refresh() })
elements.syncNow.addEventListener('click', async () => { await chrome.runtime.sendMessage({ type: 'flush' }); await refresh() })
elements.disconnect.addEventListener('click', disconnect)
elements.saveApi.addEventListener('click', async () => { await chrome.storage.local.set({ apiUrl: elements.apiUrl.value.replace(/\/$/, '') }); show('API 주소를 저장했습니다.', false) })
elements.selectAll.addEventListener('change', () => {
  candidates = candidates.map((candidate) => ({ ...candidate, selected: elements.selectAll.checked }))
  renderCandidates()
})
elements.importSelected.addEventListener('click', importSelected)

async function connect() {
  const settings = await chrome.storage.local.get('apiUrl')
  try {
    const response = await fetch(`${apiUrl(settings)}/extension/connect`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: elements.code.value, deviceName: navigator.userAgentData?.brands?.[0]?.brand || 'Chromium Browser' }),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(body.message || '연결하지 못했습니다.')
    await chrome.storage.local.set({ token: body.token, enabled: true })
    elements.code.value = ''
    show('WebVerse와 연결했습니다.', false)
    await refresh()
  } catch (error) { show(error instanceof Error ? error.message : '연결하지 못했습니다.', true) }
}

async function disconnect() {
  const settings = await chrome.storage.local.get(['token', 'apiUrl'])
  if (settings.token) {
    try {
      await fetch(`${apiUrl(settings)}/extension/session`, { method: 'DELETE', headers: { Authorization: `Extension ${settings.token}` } })
    } catch { /* 로컬 연결 정보는 네트워크 상태와 관계없이 제거합니다. */ }
  }
  await chrome.storage.local.remove(['token', 'queue', 'bookmarkQueue', 'lastDomain', 'lastVisitAt'])
  candidates = []
  show('연결을 해제했습니다.', false)
  await refresh()
}

async function refresh() {
  const data = await chrome.storage.local.get(['token','enabled','queue','bookmarkQueue','syncedToday','syncedDate','apiUrl'])
  const connected = Boolean(data.token)
  elements.status.className = `status ${connected ? 'connected' : ''}`
  elements.status.querySelector('span').textContent = connected ? 'WebVerse 연결됨' : '연결 필요'
  elements.connectPanel.hidden = connected
  elements.importPanel.hidden = true
  elements.syncPanel.hidden = !connected
  elements.enabled.checked = data.enabled !== false
  elements.pending.textContent = String((Array.isArray(data.queue) ? data.queue.length : 0) + (Array.isArray(data.bookmarkQueue) ? data.bookmarkQueue.length : 0))
  elements.syncedToday.textContent = data.syncedDate === new Date().toISOString().slice(0,10) ? String(data.syncedToday || 0) : '0'
  elements.apiUrl.value = data.apiUrl || DEFAULT_API_URL
  if (!connected) return
  try {
    const response = await fetch(`${apiUrl(data)}/extension/initial-import/status`, { headers: { Authorization: `Extension ${data.token}` } })
    if (response.status === 401) {
      await chrome.storage.local.remove('token')
      return refresh()
    }
    if (!response.ok) throw new Error('첫 우주 상태를 확인하지 못했습니다.')
    const state = await response.json()
    elements.importPanel.hidden = state.imported
    elements.syncPanel.hidden = !state.imported
    if (!state.imported && !scanning && !candidates.length) void scanBrowser()
  } catch (error) { show(error instanceof Error ? error.message : '서버 상태를 확인하지 못했습니다.', true) }
}

async function scanBrowser() {
  scanning = true
  elements.scanState.hidden = false
  elements.importControls.hidden = true
  try {
    const since = Date.now() - THIRTY_DAYS_MS
    const [historyItems, bookmarkRoots] = await Promise.all([
      chrome.history.search({ text: '', startTime: since, maxResults: HISTORY_RESULT_LIMIT }),
      chrome.bookmarks.getTree(),
    ])
    const visitsByDomain = new Map()
    for (let offset = 0; offset < historyItems.length; offset += 25) {
      const chunk = historyItems.slice(offset, offset + 25)
      const visits = await Promise.all(chunk.map(async (item) => ({ item, visits: item.url ? await chrome.history.getVisits({ url: item.url }) : [] })))
      for (const { item, visits: urlVisits } of visits) {
        const domain = domainFromUrl(item.url)
        if (!domain || isIgnoredDomain(domain)) continue
        const recentVisits = urlVisits.filter((visit) => Number(visit.visitTime || 0) >= since)
        if (!recentVisits.length) continue
        const current = visitsByDomain.get(domain) || { visitCount: 0, lastVisitedAt: 0 }
        current.visitCount += recentVisits.length
        current.lastVisitedAt = Math.max(current.lastVisitedAt, ...recentVisits.map((visit) => Number(visit.visitTime || 0)))
        visitsByDomain.set(domain, current)
      }
    }

    const bookmarksByDomain = new Map()
    const stack = [...bookmarkRoots]
    while (stack.length) {
      const node = stack.pop()
      const domain = domainFromUrl(node.url)
      if (domain && !isIgnoredDomain(domain) && !bookmarksByDomain.has(domain)) {
        bookmarksByDomain.set(domain, { name: cleanName(node.title, domain) })
      }
      if (node.children) stack.push(...node.children)
    }

    const topHistoryDomains = [...visitsByDomain.entries()]
      .sort(([, a], [, b]) => b.visitCount - a.visitCount || b.lastVisitedAt - a.lastVisitedAt)
      .slice(0, 20)
      .map(([domain]) => domain)
    const selectedDomains = [...new Set([...topHistoryDomains, ...bookmarksByDomain.keys()])]
    candidates = selectedDomains.slice(0, 1000).map((domain) => {
      const history = visitsByDomain.get(domain)
      const bookmark = bookmarksByDomain.get(domain)
      return {
        domain,
        name: bookmark?.name || cleanName('', domain),
        visitCount: history?.visitCount || 0,
        lastVisitedAt: history?.lastVisitedAt ? new Date(history.lastVisitedAt).toISOString() : null,
        bookmarked: Boolean(bookmark),
        selected: true,
      }
    })
    renderCandidates()
    elements.scanState.hidden = true
    elements.importControls.hidden = false
    if (!candidates.length) show('가져올 방문 기록이나 북마크가 없습니다.', true)
    if (selectedDomains.length > 1000) show('북마크가 많아 최대 1,000개까지 표시했습니다.', true)
  } catch (error) {
    elements.scanState.textContent = error instanceof Error ? error.message : '브라우저 기록을 분석하지 못했습니다.'
  } finally { scanning = false }
}

function renderCandidates() {
  elements.candidateList.replaceChildren()
  for (const candidate of candidates) {
    const label = document.createElement('label')
    label.className = 'candidate'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = candidate.selected
    checkbox.addEventListener('change', () => {
      candidate.selected = checkbox.checked
      updateSelectionState()
    })
    const text = document.createElement('div')
    const name = document.createElement('strong')
    name.textContent = candidate.name
    const domain = document.createElement('small')
    domain.textContent = candidate.domain
    text.append(name, domain)
    const reason = document.createElement('em')
    reason.className = candidate.bookmarked ? 'bookmark' : ''
    reason.textContent = candidate.bookmarked ? `★ 북마크${candidate.visitCount ? ` · ${candidate.visitCount}회` : ''}` : `${candidate.visitCount}회`
    label.append(checkbox, text, reason)
    elements.candidateList.append(label)
  }
  updateSelectionState()
}

function updateSelectionState() {
  const count = candidates.filter((candidate) => candidate.selected).length
  elements.selectedCount.textContent = `${count}개`
  elements.selectAll.checked = Boolean(candidates.length) && count === candidates.length
  elements.selectAll.indeterminate = count > 0 && count < candidates.length
  elements.importSelected.disabled = count === 0
}

async function importSelected() {
  const selected = candidates.filter((candidate) => candidate.selected).map(({ selected: _selected, ...candidate }) => candidate)
  if (!selected.length) return
  elements.importSelected.disabled = true
  elements.importSelected.textContent = '우주 생성 중...'
  const settings = await chrome.storage.local.get(['token', 'apiUrl'])
  try {
    const response = await fetch(`${apiUrl(settings)}/extension/initial-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Extension ${settings.token}` },
      body: JSON.stringify({ sites: selected }),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(body.message || '첫 우주를 만들지 못했습니다.')
    candidates = []
    show(`${body.selected}개 사이트로 첫 우주를 만들었습니다. WebVerse를 새로고침해주세요.`, false)
    await refresh()
  } catch (error) {
    show(error instanceof Error ? error.message : '첫 우주를 만들지 못했습니다.', true)
    elements.importSelected.disabled = false
    elements.importSelected.textContent = '선택한 사이트로 우주 만들기'
  }
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

function show(message, error) {
  elements.message.textContent = message
  elements.message.style.color = error ? '#ff9dac' : '#8bdcaf'
}
