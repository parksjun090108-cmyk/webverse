const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '')
let unauthorizedHandler: (() => void) | null = null
let wakePromise: Promise<boolean> | null = null
let lastWakeAt = 0

const WAKE_FRESH_MS = 10 * 60_000

function wakeApi(force = false): Promise<boolean> {
  if (!force && lastWakeAt && Date.now() - lastWakeAt < WAKE_FRESH_MS) return Promise.resolve(true)
  if (wakePromise) return wakePromise

  const current = waitForApi()
    .then((awake) => {
      if (!awake) return false
      lastWakeAt = Date.now()
      return true
    })
    .finally(() => {
      if (wakePromise === current) wakePromise = null
    })

  wakePromise = current
  return current
}

async function waitForApi() {
  const deadline = Date.now() + 70_000
  while (Date.now() < deadline) {
    try {
      const remaining = deadline - Date.now()
      const response = await fetch(`${API_URL}/health`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(Math.min(12_000, remaining)),
      })
      const contentType = response.headers.get('content-type') ?? ''
      if (response.ok && contentType.includes('application/json')) {
        const body = await response.json() as { ok?: boolean; service?: string }
        if (body.ok && body.service === 'webverse-api') return true
      }
    } catch {
      // Render의 무료 인스턴스가 기동되는 동안에는 연결 실패가 정상입니다.
    }
    if (Date.now() < deadline) await new Promise((resolve) => window.setTimeout(resolve, 1_800))
  }
  return false
}

export type SessionUser = { id: string; nickname: string; email: string }

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  await wakeApi()
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(12_000),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError('API 서버에 연결할 수 없습니다. WebVerse를 다시 실행해주세요.', 0)
  }
  const text = response.status === 204 ? '' : await response.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = null }
  if (response.status === 401 && token) unauthorizedHandler?.()
  if (!response.ok) throw new ApiError(body?.message ?? '요청을 처리하지 못했습니다.', response.status)
  return body as T
}

export const api = {
  onUnauthorized: (handler: (() => void) | null) => { unauthorizedHandler = handler },
  wake: (force = false) => wakeApi(force),
  register: (input: { nickname: string; email: string; password: string }) =>
    request<{ token: string; user: SessionUser }>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) =>
    request<{ token: string; user: SessionUser }>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  me: (token: string) => request<{ user: SessionUser }>('/auth/me', {}, token),
  catalog: (token: string, options: { q?: string; category?: string; page?: number; limit?: number } = {}) => {
    const params = new URLSearchParams()
    if (options.q) params.set('q', options.q)
    if (options.category) params.set('category', options.category)
    params.set('page', String(options.page ?? 1)); params.set('limit', String(options.limit ?? 50))
    return request<{ sites: ApiSite[]; pagination: ApiPagination }>(`/sites?${params}`, {}, token)
  },
  mine: (token: string) => request<{ userSites: ApiUserSite[] }>('/sites/mine', {}, token),
  discover: (token: string, siteId: string) => request(`/sites/${siteId}/discover`, { method: 'POST' }, token),
  addCustom: (token: string, url: string) => request('/sites/custom', { method: 'POST', body: JSON.stringify({ url }) }, token),
  requestSiteApproval: (token: string, siteId: string) => request(`/sites/${siteId}/approval-request`, { method: 'POST' }, token),
  visit: (token: string, siteId: string) => request(`/sites/${siteId}/visit`, { method: 'POST' }, token),
  favorite: (token: string, siteId: string, favorite: boolean) => request(`/sites/${siteId}/favorite`, { method: 'PATCH', body: JSON.stringify({ favorite }) }, token),
  removeSite: (token: string, siteId: string) => request(`/sites/${siteId}`, { method: 'DELETE' }, token),
  constellations: (token: string) => request<{ constellations: ApiConstellation[] }>('/constellations', {}, token),
  analyzeConstellations: (token: string) => request('/constellations/analyze', { method: 'POST' }, token),
  renameConstellation: (token: string, id: string, name: string) => request(`/constellations/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }, token),
  updateProfile: (token: string, nickname: string) => request<{ user: SessionUser }>('/users/me', { method: 'PATCH', body: JSON.stringify({ nickname }) }, token),
  changePassword: (token: string, currentPassword: string, newPassword: string) => request('/users/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }, token),
  deleteAccount: (token: string, password: string) => request('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) }, token),
  extensionStatus: (token: string) => request<ExtensionStatus>('/extension/status', {}, token),
  createExtensionPairing: (token: string) => request<{ code: string; expiresAt: string }>('/extension/pairing', { method: 'POST' }, token),
  revokeExtensionConnections: (token: string) => request('/extension/connections', { method: 'DELETE' }, token),
  galaxyProfile: (token: string) => request<{ profile: GalaxyProfile }>('/galaxy/me', {}, token),
  updateGalaxyProfile: (token: string, isPublic: boolean) => request<{ profile: GalaxyProfile }>('/galaxy/me', { method: 'PATCH', body: JSON.stringify({ public: isPublic }) }, token),
  galaxy: (token: string, page = 1, limit = 12) => request<{ universes: GalaxySummary[]; pagination: ApiPagination }>(`/galaxy?page=${page}&limit=${limit}`, {}, token),
  galaxyUniverse: (token: string, slug: string) => request<{ universe: PublicUniverse }>(`/galaxy/${encodeURIComponent(slug)}`, {}, token),
  publicUniverse: (slug: string) => request<{ universe: PublicUniverse }>(`/galaxy/public/${encodeURIComponent(slug)}`),
  reportUniverse: (token: string, slug: string, reason: GalaxyReportReason, details?: string) => request(`/galaxy/${encodeURIComponent(slug)}/report`, { method: 'POST', body: JSON.stringify({ reason, details }) }, token),
  blockUniverse: (token: string, slug: string) => request(`/galaxy/${encodeURIComponent(slug)}/block`, { method: 'POST' }, token),
}

export type ExtensionStatus = {
  connected: boolean
  sessions: Array<{ id: string; deviceName: string; createdAt: string; lastSeenAt: string | null }>
}

export type ApiSite = {
  id: string
  name: string
  domain: string
  description: string | null
  faviconUrl: string | null
  themeColor: string
  status: string
  category: { name: string; color: string } | null
  approvalRequest?: {
    status: 'REQUESTED' | 'APPROVED' | 'REJECTED'
    resolutionNote: string | null
    resolvedAt: string | null
  } | null
}

export type ApiUserSite = {
  visitCount: number
  favorite: boolean
  browserFavorite: boolean
  lastVisit: string
  positionX: number
  positionY: number
  positionZ: number
  site: ApiSite
}

export type ApiConstellation = {
  id: string
  name: string
  strength: number
  occurrenceCount: number
  sites: Array<{ sequence: number; site: ApiSite }>
  edges: Array<{ fromSiteId: string; toSiteId: string; count: number }>
}

export type ApiPagination = { page: number; limit: number; total: number; totalPages: number; hasNext: boolean }

export type GalaxyProfile = {
  public: boolean
  slug: string | null
  publishedAt: string | null
  restricted: boolean
  restrictionReason: string | null
}

export type ApiPublicSite = {
  id: string
  name: string
  domain: string
  faviconUrl: string | null
  category: { name: string; color: string } | null
  themeColor: string
  status: 'APPROVED' | 'UNLISTED'
  anonymous: boolean
  visitCount: number
  favorite: boolean
  lastVisitedDaysAgo: number
  positionX: number
  positionY: number
  positionZ: number
}

export type GalaxySummary = {
  slug: string
  nickname: string
  publishedAt: string
  siteCount: number
  constellationCount: number
  previewSites: ApiPublicSite[]
}

export type PublicUniverse = {
  slug: string
  nickname: string
  publishedAt: string
  sites: ApiPublicSite[]
  constellations: ApiConstellation[]
}

export type GalaxyReportReason = 'SPAM' | 'INAPPROPRIATE' | 'PRIVACY' | 'PHISHING' | 'OTHER'
