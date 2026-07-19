import { useEffect, useState } from 'react'
import { Check, ExternalLink, Globe2, LoaderCircle, ShieldAlert, Users, X } from 'lucide-react'
import { adminApi, type Category, type ReviewRequest } from '../api'
import { formatDate, statusLabel } from '../format'

type Props = {
  token: string
  initialRequest: ReviewRequest
  categories: Category[]
  onClose: () => void
  onCompleted: () => Promise<void>
}

export function RequestDrawer({ token, initialRequest, categories, onClose, onCompleted }: Props) {
  const [request, setRequest] = useState(initialRequest)
  const [categoryId, setCategoryId] = useState(initialRequest.site.category?.id ?? '')
  const [name, setName] = useState(initialRequest.site.name)
  const [description, setDescription] = useState(initialRequest.site.description ?? '')
  const [faviconUrl, setFaviconUrl] = useState(initialRequest.site.faviconUrl ?? '')
  const [themeColor, setThemeColor] = useState(initialRequest.site.themeColor || '#8992aa')
  const [reason, setReason] = useState('')
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void adminApi.requestDetail(token, initialRequest.id).then(({ request: fresh }) => setRequest(fresh)).catch(() => undefined).finally(() => setLoading(false))
  }, [token, initialRequest.id])

  const approve = async () => {
    if (!categoryId) { setError('카테고리를 선택해주세요.'); return }
    setBusy(true); setError('')
    try {
      await adminApi.approve(token, request.id, {
        categoryId, name: name.trim(), description: description.trim() || null,
        faviconUrl: faviconUrl.trim() || null, themeColor,
      })
      await onCompleted()
    } catch (reason) { setError(reason instanceof Error ? reason.message : '승인하지 못했습니다.') }
    finally { setBusy(false) }
  }

  const reject = async () => {
    const normalized = reason.trim()
    if (normalized.length < 2) { setError('사용자가 확인할 수 있도록 거절 사유를 입력해주세요.'); return }
    setBusy(true); setError('')
    try { await adminApi.reject(token, request.id, normalized); await onCompleted() }
    catch (reason) { setError(reason instanceof Error ? reason.message : '거절하지 못했습니다.') }
    finally { setBusy(false) }
  }

  const editable = request.status === 'REQUESTED'

  return <div className="drawer-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <aside className="request-drawer" aria-label="등록 요청 상세">
      <header><div><p>REQUEST DETAILS</p><h2>사이트 검토</h2></div><button aria-label="닫기" onClick={onClose}><X size={19} /></button></header>
      {loading && <div className="drawer-progress"><LoaderCircle className="spin" size={15} /> 최신 정보 확인 중</div>}
      <div className="site-summary"><span style={{ '--site-color': request.site.themeColor } as React.CSSProperties}><Globe2 size={23} /></span><div><b className={`status-badge ${request.status.toLowerCase()}`}>{statusLabel(request.status)}</b><h3>{request.site.name}</h3><a href={request.site.normalizedUrl} target="_blank" rel="noreferrer">{request.site.domain}<ExternalLink size={12} /></a></div></div>
      <div className="request-facts"><div><span>서로 다른 신청자</span><strong><Users size={14} /> {request.site._count.discoveries}명</strong></div><div><span>개인 우주 등록</span><strong>{request.site._count.userSites}개</strong></div><div><span>신청 시각</span><strong>{formatDate(request.requestedAt)}</strong></div><div><span>최초 신청자</span><strong>{request.site.createdBy?.nickname ?? '알 수 없음'}</strong></div></div>

      {editable ? <>
        <div className="decision-tabs"><button className={decision === 'approve' ? 'approve active' : ''} onClick={() => { setDecision('approve'); setError('') }}><Check size={15} /> 승인</button><button className={decision === 'reject' ? 'reject active' : ''} onClick={() => { setDecision('reject'); setError('') }}><X size={15} /> 거절</button></div>
        {decision === 'approve' ? <div className="decision-form">
          <label><span>카테고리 <b>*</b></span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">카테고리 선택</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label><span>사이트 이름</span><input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></label>
          <label><span>설명</span><textarea value={description} maxLength={500} rows={3} onChange={(event) => setDescription(event.target.value)} /></label>
          <label><span>파비콘 URL</span><input type="url" value={faviconUrl} onChange={(event) => setFaviconUrl(event.target.value)} placeholder="https://..." /></label>
          <label className="color-field"><span>테마 색상</span><div><input type="color" value={themeColor} onChange={(event) => setThemeColor(event.target.value)} /><code>{themeColor}</code></div></label>
          {error && <div className="form-error">{error}</div>}
          <button className="approve-submit" disabled={busy} onClick={() => void approve()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} 공식 사이트로 승인</button>
        </div> : <div className="decision-form reject-form">
          <div className="reject-warning"><ShieldAlert size={18} /><p><strong>거절 후에도 기존 사용자의 우주에는 유지됩니다.</strong><span>전체 검색, 카테고리, 별자리에서는 제외됩니다.</span></p></div>
          <label><span>사용자에게 표시할 거절 사유 <b>*</b></span><textarea value={reason} maxLength={500} rows={5} onChange={(event) => setReason(event.target.value)} placeholder="공식 사이트로 등록할 수 없는 이유를 구체적으로 입력하세요." /><small>{reason.length}/500</small></label>
          {error && <div className="form-error">{error}</div>}
          <button className="reject-submit" disabled={busy || reason.trim().length < 2} onClick={() => void reject()}>{busy ? <LoaderCircle className="spin" size={16} /> : <X size={16} />} 등록 요청 거절</button>
        </div>}
      </> : <div className={`resolved-box ${request.status.toLowerCase()}`}><span>{request.status === 'APPROVED' ? <Check size={18} /> : <X size={18} />}</span><div><strong>{statusLabel(request.status)}</strong><p>{request.resolvedBy?.name ?? '관리자'} · {formatDate(request.resolvedAt)}</p>{request.status === 'REJECTED' && request.resolutionNote && <blockquote>{request.resolutionNote}</blockquote>}</div></div>}
    </aside>
  </div>
}
