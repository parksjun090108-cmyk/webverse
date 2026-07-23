import { useEffect, useState } from 'react'
import { Ban, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, ShieldAlert } from 'lucide-react'
import { adminApi, type Overview, type Pagination, type UniverseReport, type UniverseReportStatus } from '../api'

const WEB_URL = (import.meta.env.VITE_WEB_URL || 'http://localhost:4173').replace(/\/+$/, '')

export function UniverseReportsPage({ token, overview, onDataChanged }: { token: string; overview: Overview | null; onDataChanged: () => void | Promise<void> }) {
  const [status, setStatus] = useState<UniverseReportStatus>('OPEN')
  const [reports, setReports] = useState<UniverseReport[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async (page = 1) => {
    setLoading(true); setError('')
    try { const result = await adminApi.universeReports(token, status, page); setReports(result.reports); setPagination(result.pagination) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '신고 목록을 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load(1) }, [status, token])

  const hide = async (report: UniverseReport) => {
    const reason = window.prompt(`${report.target.nickname}님의 우주를 비공개 처리할 사유를 입력하세요.`, '공개 운영 정책 위반')?.trim()
    if (!reason) return
    try { await adminApi.hideUniverse(token, report.id, reason); await Promise.all([load(pagination?.page ?? 1), onDataChanged()]) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '우주를 숨기지 못했습니다.') }
  }
  const dismiss = async (report: UniverseReport) => {
    if (!window.confirm('문제없는 신고로 처리할까요?')) return
    try { await adminApi.dismissUniverseReport(token, report.id); await Promise.all([load(pagination?.page ?? 1), onDataChanged()]) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '신고를 처리하지 못했습니다.') }
  }

  return <section className="page universe-reports-page">
    <header className="page-header"><div><p>GALAXY SAFETY</p><h1>우주 신고 관리</h1><span>공개 은하의 신고를 검토하고 필요한 경우 즉시 비공개 처리합니다.</span></div></header>
    <div className="report-overview"><ShieldAlert size={18} /><span>처리 대기</span><strong>{overview?.universeReports.open ?? 0}</strong></div>
    <div className="request-panel">
      <div className="request-tabs">{(['OPEN','RESOLVED','DISMISSED'] as const).map((item) => <button key={item} className={status === item ? 'active' : ''} onClick={() => setStatus(item)}>{item === 'OPEN' ? '처리 대기' : item === 'RESOLVED' ? '공개 제한' : '문제없음'}</button>)}</div>
      {error && <div className="panel-error">{error}<button onClick={() => load()}>다시 시도</button></div>}
      {loading ? <div className="panel-loading"><p>신고 목록을 불러오는 중...</p></div> : !reports.length ? <div className="empty-state"><CheckCircle2 size={26} /><h3>해당 신고가 없습니다.</h3></div> : <div className="universe-report-list">{reports.map((report) => <article key={report.id}>
        <div className="report-users"><strong>{report.target.nickname}님의 우주</strong><span>신고자 · {report.reporter.nickname}</span></div>
        <div className="report-reason"><b>{reasonLabel(report.reason)}</b><p>{report.details || '상세 내용 없음'}</p></div>
        {report.target.publicSlug && <a href={`${WEB_URL}/universe/${report.target.publicSlug}`} target="_blank" rel="noreferrer">우주 확인 <ExternalLink size={13} /></a>}
        {status === 'OPEN' ? <div className="report-actions"><button className="dismiss" onClick={() => dismiss(report)}><CheckCircle2 size={13} /> 문제없음</button><button className="hide" onClick={() => hide(report)}><Ban size={13} /> 공개 제한</button></div> : <span className={`report-result ${status.toLowerCase()}`}>{status === 'RESOLVED' ? '공개 제한됨' : '문제없음 처리'}</span>}
      </article>)}</div>}
      {pagination && pagination.totalPages > 1 && <div className="pagination"><button disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}><ChevronLeft size={14} /></button><span>{pagination.page} / {pagination.totalPages}</span><button disabled={!pagination.hasNext} onClick={() => load(pagination.page + 1)}><ChevronRight size={14} /></button></div>}
    </div>
  </section>
}

function reasonLabel(reason: string) {
  return ({ SPAM: '스팸 또는 홍보', INAPPROPRIATE: '부적절한 콘텐츠', PRIVACY: '개인정보 노출', PHISHING: '피싱 또는 위험한 링크', OTHER: '기타' } as Record<string,string>)[reason] ?? reason
}
