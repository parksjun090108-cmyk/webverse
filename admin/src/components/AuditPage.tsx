import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, History, KeyRound, LoaderCircle, LogIn, ShieldX } from 'lucide-react'
import { adminApi, type AuditLog, type Pagination } from '../api'
import { actionLabel, formatDate } from '../format'

type Props = { token: string }

export function AuditPage({ token }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const result = await adminApi.auditLogs(token, page); setLogs(result.logs); setPagination(result.pagination) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '처리 기록을 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }, [token, page])
  useEffect(() => { void load() }, [load])

  return <section className="page audit-page">
    <header className="page-header"><div><p>SECURITY AUDIT</p><h1>관리자 작업 기록</h1><span>로그인, 승인, 거절 및 보안 변경 기록을 시간순으로 확인합니다.</span></div></header>
    <div className="audit-panel">
      {error && <div className="panel-error">{error}<button onClick={() => void load()}>다시 시도</button></div>}
      {loading ? <div className="panel-loading"><LoaderCircle className="spin" size={24} /><p>작업 기록을 불러오는 중...</p></div> : logs.length === 0 ? <div className="empty-state"><History size={31} /><h3>아직 기록이 없습니다.</h3></div> : <div className="audit-list">{logs.map((log) => <article key={log.id}>
        <span className={`audit-icon ${log.action.toLowerCase()}`}>{log.action === 'SITE_APPROVED' ? <CheckCircle2 size={17} /> : log.action === 'SITE_REJECTED' ? <ShieldX size={17} /> : log.action === 'ADMIN_PASSWORD_CHANGED' ? <KeyRound size={17} /> : <LogIn size={17} />}</span>
        <div><strong>{actionLabel(log.action)}</strong><p>{auditDescription(log)}</p><small>{log.admin.name} · {formatDate(log.createdAt)}</small></div>
      </article>)}</div>}
      {pagination && pagination.totalPages > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={15} /></button><span>{page} / {pagination.totalPages}</span><button disabled={!pagination.hasNext} onClick={() => setPage((value) => value + 1)}><ArrowRight size={15} /></button></div>}
    </div>
  </section>
}

function auditDescription(log: AuditLog) {
  if (log.action === 'ADMIN_LOGIN') return '관리자 계정으로 로그인했습니다.'
  if (log.action === 'ADMIN_PASSWORD_CHANGED') return '관리자 비밀번호를 변경했습니다.'
  let details: Record<string, unknown> = {}
  try { details = log.details ? JSON.parse(log.details) as Record<string, unknown> : {} } catch { details = {} }
  if (log.action === 'SITE_APPROVED') return `사이트를 공식 DB에 승인했습니다. · ${String(details.categoryId ?? log.targetId)}`
  if (log.action === 'SITE_REJECTED') return `사이트 등록을 거절했습니다. · ${String(details.reason ?? log.targetId)}`
  return `${log.targetType} · ${log.targetId}`
}
