import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Clock3, Globe2, LoaderCircle, SearchX, Users, XCircle } from 'lucide-react'
import { adminApi, type Category, type Overview, type Pagination, type RequestStatus, type ReviewRequest } from '../api'
import { formatDate, statusLabel } from '../format'
import { RequestDrawer } from './RequestDrawer'

type Props = {
  token: string
  overview: Overview | null
  categories: Category[]
  onDataChanged: () => Promise<void>
}

const tabs: Array<{ status: RequestStatus; label: string }> = [
  { status: 'REQUESTED', label: '검토 대기' },
  { status: 'APPROVED', label: '승인 완료' },
  { status: 'REJECTED', label: '거절 완료' },
]

export function RequestsPage({ token, overview, categories, onDataChanged }: Props) {
  const [status, setStatus] = useState<RequestStatus>('REQUESTED')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<ReviewRequest[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [selected, setSelected] = useState<ReviewRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await adminApi.requests(token, status, page)
      setItems(result.requests); setPagination(result.pagination)
    } catch (reason) { setError(reason instanceof Error ? reason.message : '요청 목록을 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }, [token, status, page])

  useEffect(() => { void load() }, [load])

  const changeStatus = (next: RequestStatus) => { setStatus(next); setPage(1); setSelected(null) }
  const completed = async () => { setSelected(null); await Promise.all([load(), onDataChanged()]) }

  return <section className="page requests-page">
    <header className="page-header"><div><p>SITE GOVERNANCE</p><h1>등록 요청 관리</h1><span>사용자들이 발견한 사이트를 검토하고 공식 우주 등록 여부를 결정합니다.</span></div></header>

    <div className="overview-grid">
      <article><span className="metric-icon waiting"><Clock3 size={19} /></span><div><small>검토 대기</small><strong>{overview?.requests.requested ?? '-'}</strong><p>관리자 결정 필요</p></div></article>
      <article><span className="metric-icon approved"><CheckCircle2 size={19} /></span><div><small>승인 완료</small><strong>{overview?.requests.approved ?? '-'}</strong><p>공식 사이트 등록</p></div></article>
      <article><span className="metric-icon rejected"><XCircle size={19} /></span><div><small>거절 완료</small><strong>{overview?.requests.rejected ?? '-'}</strong><p>개인 우주에서만 유지</p></div></article>
      <article><span className="metric-icon pending"><Users size={19} /></span><div><small>검토 중 사이트</small><strong>{overview?.sites.reviewRequested ?? '-'}</strong><p>신청자 수와 함께 표시</p></div></article>
    </div>

    <div className="request-panel">
      <div className="request-tabs">{tabs.map((tab) => <button key={tab.status} className={status === tab.status ? 'active' : ''} onClick={() => changeStatus(tab.status)}>{tab.label}<span>{tab.status === 'REQUESTED' ? overview?.requests.requested : tab.status === 'APPROVED' ? overview?.requests.approved : overview?.requests.rejected}</span></button>)}</div>
      {error && <div className="panel-error">{error}<button onClick={() => void load()}>다시 시도</button></div>}
      {loading ? <div className="panel-loading"><LoaderCircle className="spin" size={24} /><p>요청을 불러오는 중...</p></div> : items.length === 0 ? <div className="empty-state"><SearchX size={31} /><h3>{statusLabel(status)} 요청이 없습니다.</h3><p>새로운 요청이 들어오면 이곳에 표시됩니다.</p></div> : <div className="request-table">
        <div className="table-head"><span>사이트</span><span>신청자 수</span><span>요청 시각</span><span>상태</span><span /></div>
        {items.map((item) => <button className="request-row" key={item.id} onClick={() => setSelected(item)}>
          <span className="site-cell"><i style={{ '--site-color': item.site.themeColor } as React.CSSProperties}><Globe2 size={17} /></i><span><strong>{item.site.name}</strong><small>{item.site.domain}</small></span></span>
          <span className="discoveries"><Users size={14} /> {item.site._count.discoveries}명</span>
          <span className="requested-at">{formatDate(item.requestedAt)}</span>
          <span><b className={`status-badge ${item.status.toLowerCase()}`}>{statusLabel(item.status)}</b></span>
          <span className="row-arrow"><ChevronRight size={17} /></span>
        </button>)}
      </div>}
      {pagination && pagination.totalPages > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={15} /></button><span>{page} / {pagination.totalPages}</span><button disabled={!pagination.hasNext} onClick={() => setPage((value) => value + 1)}><ArrowRight size={15} /></button></div>}
    </div>
    {selected && <RequestDrawer token={token} initialRequest={selected} categories={categories} onClose={() => setSelected(null)} onCompleted={completed} />}
  </section>
}
