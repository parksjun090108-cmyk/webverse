const elements = Object.fromEntries(['status','connectPanel','syncPanel','code','connect','syncedToday','pending','enabled','syncNow','disconnect','apiUrl','saveApi','message'].map((id) => [id, document.getElementById(id)]))

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

async function connect() {
  const settings = await chrome.storage.local.get('apiUrl')
  try {
    const response = await fetch(`${String(settings.apiUrl || 'http://localhost:4000/api').replace(/\/$/, '')}/extension/connect`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: elements.code.value, deviceName: navigator.userAgentData?.brands?.[0]?.brand || 'Chromium Browser' }),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(body.message || '연결하지 못했습니다.')
    await chrome.storage.local.set({ token: body.token, enabled: true })
    elements.code.value = ''; show('WebVerse와 연결했습니다.', false); await refresh()
  } catch (error) { show(error instanceof Error ? error.message : '연결하지 못했습니다.', true) }
}

async function disconnect() {
  const settings = await chrome.storage.local.get(['token', 'apiUrl'])
  if (settings.token) {
    try {
      await fetch(`${String(settings.apiUrl || 'http://localhost:4000/api').replace(/\/$/, '')}/extension/session`, { method: 'DELETE', headers: { Authorization: `Extension ${settings.token}` } })
    } catch { /* 로컬 토큰은 네트워크 상태와 관계없이 제거합니다. */ }
  }
  await chrome.storage.local.remove(['token', 'queue', 'lastDomain', 'lastVisitAt'])
  show('연결을 해제했습니다.', false); await refresh()
}

async function refresh() {
  const data = await chrome.storage.local.get(['token','enabled','queue','syncedToday','syncedDate','apiUrl'])
  const connected = Boolean(data.token)
  elements.status.className = `status ${connected ? 'connected' : ''}`
  elements.status.querySelector('span').textContent = connected ? 'WebVerse 연결됨' : '연결 필요'
  elements.connectPanel.hidden = connected; elements.syncPanel.hidden = !connected
  elements.enabled.checked = data.enabled !== false
  elements.pending.textContent = String(Array.isArray(data.queue) ? data.queue.length : 0)
  elements.syncedToday.textContent = data.syncedDate === new Date().toISOString().slice(0,10) ? String(data.syncedToday || 0) : '0'
  elements.apiUrl.value = data.apiUrl || 'http://localhost:4000/api'
}

function show(message, error) { elements.message.textContent = message; elements.message.style.color = error ? '#ff9dac' : '#8bdcaf' }
