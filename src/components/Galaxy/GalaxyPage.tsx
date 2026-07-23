import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Ban, ChevronRight, Copy, ExternalLink, Orbit, RefreshCw, ShieldAlert, Sparkles, Telescope, X } from 'lucide-react'
import { api, type ApiPublicSite, type GalaxyReportReason, type GalaxySummary, type PublicUniverse } from '../../lib/api'
import type { Site } from '../../types/site'
import type { ConstellationView } from '../../types/constellation'
import { getActivityBrightness, getCelestialScale, getCelestialStage } from '../../engine/UniverseEngine'
import { layoutSites } from '../../engine/LayoutEngine'
import { UniverseCanvas } from '../Universe/UniverseCanvas'
import { Favicon } from '../Favicon/Favicon'

type Props = { token: string; onError: (reason: unknown) => void }

export function GalaxyPage({ token, onError }: Props) {
  const [universes, setUniverses] = useState<GalaxySummary[]>([])
  const [selected, setSelected] = useState<PublicUniverse | null>(null)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)

  const load = async (nextPage = 1) => {
    setLoading(true)
    try {
      const result = await api.galaxy(token, nextPage)
      setUniverses((current) => nextPage === 1 ? result.universes : [...current, ...result.universes])
      setPage(nextPage); setHasNext(result.pagination.hasNext)
    } catch (reason) { onError(reason) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [token])

  const openUniverse = async (slug: string) => {
    setOpening(slug)
    try { setSelected((await api.galaxyUniverse(token, slug)).universe) }
    catch (reason) { onError(reason) }
    finally { setOpening(null) }
  }

  if (selected) return <SharedUniverseView
    universe={selected}
    token={token}
    onBack={() => setSelected(null)}
    onError={onError}
    onBlocked={() => { setUniverses((current) => current.filter((item) => item.slug !== selected.slug)); setSelected(null) }}
  />

  return <section className="galaxy-page">
    <div className="galaxy-backdrop" />
    <div className="galaxy-content">
      <header className="galaxy-heading">
        <div><p><Telescope size={13} /> PUBLIC GALAXY</p><h1>다른 탐험가들의<br /><em>우주를 여행하세요.</em></h1><span>공개된 우주의 천체와 즐겨찾기 고리, 별자리를 살펴볼 수 있어요.</span></div>
        <button onClick={() => load(1)} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={15} /> 새로고침</button>
      </header>
      {loading && !universes.length ? <div className="galaxy-loading"><span className="loading-orbit" /> 은하를 관측하는 중...</div>
        : !universes.length ? <div className="galaxy-empty"><Orbit size={29} /><h2>아직 공개된 우주가 없어요.</h2><p>첫 번째로 우주를 공개해 은하를 밝혀보세요.</p></div>
          : <div className="galaxy-grid">{universes.map((universe) => <button className="galaxy-card glass-panel" key={universe.slug} onClick={() => openUniverse(universe.slug)} disabled={opening === universe.slug}>
            <UniversePreview sites={universe.previewSites} />
            <div className="galaxy-card-info"><span>{universe.nickname.slice(0, 1).toUpperCase()}</span><div><strong>{universe.nickname}님의 우주</strong><small>{universe.siteCount}개의 천체 · {universe.constellationCount}개의 별자리</small></div><ChevronRight size={17} /></div>
          </button>)}</div>}
      {hasNext && <button className="galaxy-more" disabled={loading} onClick={() => load(page + 1)}>{loading ? '불러오는 중...' : '더 많은 우주 보기'}</button>}
    </div>
  </section>
}

export function SharedUniverseView({ universe, token, onBack, onError, onBlocked }: {
  universe: PublicUniverse
  token?: string
  onBack?: () => void
  onError?: (reason: unknown) => void
  onBlocked?: () => void
}) {
  const sites = useMemo(() => layoutSites(universe.sites.map(mapPublicSite)), [universe.sites])
  const constellations = useMemo(() => universe.constellations.map(mapPublicConstellation), [universe.constellations])
  const [selected, setSelected] = useState<Site | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const publicUrl = `${window.location.origin}/universe/${universe.slug}`

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true); window.setTimeout(() => setCopied(false), 1800)
  }
  const block = async () => {
    if (!token || !window.confirm(`${universe.nickname}님의 우주를 차단할까요?\n은하 목록에서 더 이상 표시되지 않습니다.`)) return
    try { await api.blockUniverse(token, universe.slug); onBlocked?.() } catch (reason) { onError?.(reason) }
  }

  return <section className={`shared-universe ${onBack ? 'embedded' : 'standalone'}`}>
    <UniverseCanvas sites={sites} clusters={[]} constellations={constellations} selectedId={selected?.id ?? null} onSelect={setSelected} onExpandCluster={() => undefined} />
    {onBack ? <div className="shared-actions shared-embedded-toolbar glass-panel">
      <button onClick={onBack} aria-label="은하로 돌아가기"><ArrowLeft size={15} /> 은하로</button>
      <button onClick={copyLink} aria-label="공개 우주 링크 복사"><Copy size={14} /> {copied ? '복사됨' : '링크 복사'}</button>
      {token && <><button onClick={() => setReportOpen(true)} aria-label="공개 우주 신고"><ShieldAlert size={14} /> 신고</button><button className="block" onClick={block} aria-label="공개 우주 차단"><Ban size={14} /> 차단</button></>}
    </div> : <header className="shared-topbar glass-panel">
      <div className="shared-brand"><Orbit size={19} /><div><strong>WEBVERSE</strong><small>PUBLIC UNIVERSE</small></div></div>
      <div className="shared-actions"><button onClick={copyLink}><Copy size={14} /> {copied ? '복사됨' : '링크 복사'}</button></div>
    </header>}
    <div className="shared-heading"><p>EXPLORER'S UNIVERSE</p><h1>{universe.nickname}님의 우주</h1><span>{sites.length}개의 천체 · {constellations.length}개의 별자리</span></div>
    <div className="shared-disclosure glass-panel"><Sparkles size={13} /><span>크기는 이용 빈도, 밝기는 최근 활동을 나타냅니다. 정확한 횟수와 날짜는 공개되지 않습니다.</span></div>
    {!token && <a className="shared-cta" href="/">나도 내 우주 만들기 <ChevronRight size={15} /></a>}
    {selected && <aside className="shared-detail glass-panel">
      <button className="close-button" onClick={() => setSelected(null)} aria-label="닫기"><X size={17} /></button>
      <div className="detail-orbit" style={{ '--site-color': selected.color } as React.CSSProperties}><Favicon src={selected.faviconUrl} name={selected.name} /></div>
      <p className="eyebrow">{selected.category}</p><h2>{selected.name}</h2>
      <p className="domain">{selected.anonymous ? '비공식 사이트 정보는 공개되지 않습니다.' : selected.domain}</p>
      <div className="public-facts"><div><span>성장 단계</span><strong>{getCelestialStage(selected.visitCount)}</strong></div><div><span>활동 밝기</span><strong>{activityLabel(selected.lastVisitedDaysAgo)}</strong></div><div><span>즐겨찾기</span><strong>{selected.favorite ? '고리 있음' : '고리 없음'}</strong></div><div><span>공개 상태</span><strong>{selected.anonymous ? '미확인 천체' : '공식 사이트'}</strong></div></div>
      {!selected.anonymous && <a className="public-site-link" href={`https://${selected.domain}`} target="_blank" rel="noreferrer">사이트 방문하기 <ExternalLink size={14} /></a>}
    </aside>}
    {reportOpen && token && <ReportDialog token={token} universe={universe} onClose={() => setReportOpen(false)} onError={onError} />}
  </section>
}

function UniversePreview({ sites }: { sites: ApiPublicSite[] }) {
  return <div className="universe-preview"><i className="preview-sun" />{sites.slice(0, 10).map((site, index) => {
    const angle = index * 2.399 + .4
    const radius = 24 + (index % 4) * 13
    const size = 4 + getCelestialScale(site.visitCount) * 6
    return <i key={site.id} className={site.favorite ? 'ringed' : ''} style={{ left: `calc(50% + ${Math.cos(angle) * radius}px)`, top: `calc(50% + ${Math.sin(angle) * radius * .55}px)`, width: size, height: size, background: site.category?.color ?? site.themeColor }} />
  })}</div>
}

function ReportDialog({ token, universe, onClose, onError }: { token: string; universe: PublicUniverse; onClose: () => void; onError?: (reason: unknown) => void }) {
  const [reason, setReason] = useState<GalaxyReportReason>('INAPPROPRIATE')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try { await api.reportUniverse(token, universe.slug, reason, details); window.alert('신고를 접수했습니다.'); onClose() }
    catch (error) { onError?.(error) }
    finally { setBusy(false) }
  }
  return <div className="galaxy-modal-layer" role="dialog" aria-modal="true"><div className="galaxy-modal glass-panel"><button className="close-button" onClick={onClose}><X size={17} /></button><AlertTriangle size={24} /><h2>공개 우주 신고</h2><p>관리자가 내용을 확인하고 필요한 경우 공개를 제한합니다.</p><label>신고 사유<select value={reason} onChange={(event) => setReason(event.target.value as GalaxyReportReason)}><option value="INAPPROPRIATE">부적절한 콘텐츠</option><option value="SPAM">스팸 또는 홍보</option><option value="PRIVACY">개인정보 노출</option><option value="PHISHING">피싱 또는 위험한 링크</option><option value="OTHER">기타</option></select></label><label>상세 내용<textarea maxLength={300} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="관리자가 확인할 내용을 입력해주세요." /></label><button className="report-submit" disabled={busy} onClick={submit}>{busy ? '접수 중...' : '신고 접수'}</button></div></div>
}

function mapPublicSite(site: ApiPublicSite): Site {
  return {
    id: site.id, name: site.name, domain: site.domain, faviconUrl: site.faviconUrl,
    category: (site.category?.name ?? 'Unclassified') as Site['category'], color: site.category?.color ?? site.themeColor,
    visitCount: site.visitCount, favorite: site.favorite, lastVisitedDaysAgo: site.lastVisitedDaysAgo,
    position: [site.positionX, site.positionY, site.positionZ], status: site.status, anonymous: site.anonymous,
  }
}

function mapPublicConstellation(item: PublicUniverse['constellations'][number]): ConstellationView {
  return {
    id: item.id, name: item.name, strength: item.strength, occurrenceCount: item.occurrenceCount,
    sites: item.sites.map(({ site }) => ({ id: site.id, name: site.name, color: site.category?.color ?? site.themeColor })),
    edges: item.edges,
  }
}

function activityLabel(daysAgo: number) {
  const brightness = getActivityBrightness(daysAgo)
  if (brightness >= 1) return '활발함'
  if (brightness >= .8) return '최근 활동'
  if (brightness >= .6) return '보통'
  if (brightness >= .35) return '희미함'
  return '비활성'
}
