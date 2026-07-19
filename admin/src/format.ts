import type { RequestStatus } from './api'

export function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function statusLabel(status: RequestStatus) {
  if (status === 'APPROVED') return '승인 완료'
  if (status === 'REJECTED') return '거절 완료'
  return '검토 대기'
}

export function actionLabel(action: string) {
  if (action === 'SITE_APPROVED') return '사이트 승인'
  if (action === 'SITE_REJECTED') return '사이트 거절'
  if (action === 'ADMIN_LOGIN') return '관리자 로그인'
  if (action === 'ADMIN_PASSWORD_CHANGED') return '비밀번호 변경'
  return action
}
