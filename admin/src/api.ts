const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api/admin').replace(/\/+$/, '')
let unauthorizedHandler: (() => void) | null = null

export type Admin = { id: string; name: string; email: string; createdAt?: string }
export type Category = { id: string; name: string; color: string }
export type RequestStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED'

export type ReviewSite = {
  id: string
  name: string
  domain: string
  normalizedUrl: string
  faviconUrl: string | null
  description: string | null
  themeColor: string
  status: string
  verified: boolean
  createdAt: string
  category: Category | null
  createdBy: { id: string; nickname: string } | null
  _count: { discoveries: number; userSites: number }
}

export type ReviewRequest = {
  id: string
  siteId: string
  status: RequestStatus
  requestedAt: string
  resolvedAt: string | null
  resolutionNote: string | null
  site: ReviewSite
  resolvedBy: { id: string; name: string } | null
}

export type Overview = {
  requests: { requested: number; approved: number; rejected: number }
  sites: { pending: number; reviewRequested: number }
}

export type Pagination = { page: number; limit: number; total: number; totalPages: number; hasNext: boolean }

export type AuditLog = {
  id: string
  action: string
  targetType: string
  targetId: string
  details: string | null
  createdAt: string
  admin: Admin
}

export class AdminApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new AdminApiError('관리자 API 서버에 연결할 수 없습니다.', 0)
  }
  const text = response.status === 204 ? '' : await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = null }
  if (response.status === 401 && token) unauthorizedHandler?.()
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? String(body.message) : '요청을 처리하지 못했습니다.'
    throw new AdminApiError(message, response.status)
  }
  return body as T
}

export const adminApi = {
  onUnauthorized: (handler: (() => void) | null) => { unauthorizedHandler = handler },
  login: (email: string, password: string) => request<{ token: string; admin: Admin }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  }),
  me: (token: string) => request<{ admin: Admin }>('/me', {}, token),
  overview: (token: string) => request<Overview>('/overview', {}, token),
  categories: (token: string) => request<{ categories: Category[] }>('/categories', {}, token),
  requests: (token: string, status: RequestStatus, page = 1, limit = 30) =>
    request<{ requests: ReviewRequest[]; pagination: Pagination }>(`/requests?status=${status}&page=${page}&limit=${limit}`, {}, token),
  requestDetail: (token: string, id: string) => request<{ request: ReviewRequest }>(`/requests/${id}`, {}, token),
  approve: (token: string, id: string, input: {
    categoryId: string; name?: string; description?: string | null; faviconUrl?: string | null; themeColor?: string
  }) => request<{ request: ReviewRequest }>(`/requests/${id}/approve`, { method: 'POST', body: JSON.stringify(input) }, token),
  reject: (token: string, id: string, reason: string) =>
    request<{ request: ReviewRequest }>(`/requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }, token),
  auditLogs: (token: string, page = 1, limit = 30) =>
    request<{ logs: AuditLog[]; pagination: Pagination }>(`/audit-logs?page=${page}&limit=${limit}`, {}, token),
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<void>('/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }, token),
}
