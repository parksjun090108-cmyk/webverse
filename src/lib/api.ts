const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '')
let unauthorizedHandler: (() => void) | null = null

export type SessionUser = { id: string; nickname: string; email: string }

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
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
  addPending: (token: string, url: string) => request('/sites/pending', { method: 'POST', body: JSON.stringify({ url }) }, token),
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
}

export type ApiUserSite = {
  visitCount: number
  favorite: boolean
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
