import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Globe2, Link2, Search, Sparkles } from 'lucide-react'
import type { CatalogSite } from '../../data/catalogSites'
import type { Category } from '../../types/site'
import { CATEGORY_DEFINITIONS } from '../../data/categories'
import { Favicon } from '../Favicon/Favicon'

export type BrowseResult = { sites: CatalogSite[]; total: number; hasNext: boolean }

type Props = {
  discoveredIds: Set<string>
  onDiscover: (site: CatalogSite) => void | Promise<void>
  onAddUrl: (url: string) => string | null | Promise<string | null>
  catalog: CatalogSite[]
  busyIds?: Set<string>
  onBrowse?: (query: string, category: Category | null, page: number) => Promise<BrowseResult>
}

export function NebulaPage({ discoveredIds, onDiscover, onAddUrl, catalog, busyIds = new Set(), onBrowse }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'All' | Category>('All')
  const [url, setUrl] = useState('')
  const [message, setMessage] = useState('')
  const [adding, setAdding] = useState(false)
  const [remoteResults, setRemoteResults] = useState<CatalogSite[]>([])
  const [remoteTotal, setRemoteTotal] = useState(0)
  const [remotePage, setRemotePage] = useState(1)
  const [remoteHasNext, setRemoteHasNext] = useState(false)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteError, setRemoteError] = useState('')
  const [localLimit, setLocalLimit] = useState(50)
  const requestId = useRef(0)
  const categories = useMemo<Array<'All' | Category>>(() => ['All', ...CATEGORY_DEFINITIONS.map((item) => item.name)], [])

  const localResults = useMemo(() => catalog.filter((site) => {
    const matchesCategory = category === 'All' || site.category === category
    const text = `${site.name} ${site.domain} ${site.description}`.toLowerCase()
    return matchesCategory && text.includes(query.toLowerCase().trim())
  }), [catalog, category, query])
  const results = onBrowse ? remoteResults : localResults.slice(0, localLimit)
  const total = onBrowse ? remoteTotal : localResults.length
  const hasNext = onBrowse ? remoteHasNext : localLimit < localResults.length

  useEffect(() => {
    setLocalLimit(50)
    if (!onBrowse) return
    const currentRequest = ++requestId.current
    setRemoteLoading(true); setRemoteError(''); setRemotePage(1)
    const timer = window.setTimeout(() => {
      onBrowse(query.trim(), category === 'All' ? null : category, 1).then((result) => {
        if (currentRequest !== requestId.current) return
        setRemoteResults(result.sites); setRemoteTotal(result.total); setRemoteHasNext(result.hasNext)
      }).catch((reason) => {
        if (currentRequest === requestId.current) setRemoteError(reason instanceof Error ? reason.message : '검색 결과를 불러오지 못했습니다.')
      }).finally(() => { if (currentRequest === requestId.current) setRemoteLoading(false) })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [category, onBrowse, query])

  const loadMore = async () => {
    if (!hasNext || remoteLoading) return
    if (!onBrowse) { setLocalLimit((value) => value + 50); return }
    setRemoteLoading(true); setRemoteError('')
    try {
      const nextPage = remotePage + 1
      const result = await onBrowse(query.trim(), category === 'All' ? null : category, nextPage)
      setRemoteResults((current) => [...current, ...result.sites]); setRemotePage(nextPage); setRemoteHasNext(result.hasNext); setRemoteTotal(result.total)
    } catch (reason) { setRemoteError(reason instanceof Error ? reason.message : '다음 결과를 불러오지 못했습니다.') }
    finally { setRemoteLoading(false) }
  }

  const submitUrl = async () => {
    if (adding) return
    setAdding(true)
    try {
      const result = await onAddUrl(url)
      setMessage(result ?? '사이트 정보를 확인해 Pending으로 등록했습니다.')
      if (!result) setUrl('')
    } finally { setAdding(false) }
  }

  return (
    <section className="nebula-page">
      <div className="nebula-glow one" /><div className="nebula-glow two" />
      <div className="nebula-content">
        <p className="nebula-kicker"><Sparkles size={13} /> THE DISCOVERY SPACE</p>
        <h1>아직 만나지 못한<br /><em>새로운 세계를 발견하세요.</em></h1>
        <p className="nebula-intro">성운에서 사이트를 발견하면 당신의 우주에 새로운 천체가 태어납니다.</p>

        <div className="nebula-search glass-panel">
          <Search size={19} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="사이트 이름, 도메인으로 검색" aria-label="성운 사이트 검색" />
          <span>{total} worlds</span>
        </div>

        <div className="category-tabs">
          {categories.map((item) => <button key={item} className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
        {!remoteLoading && !results.length && <div className="nebula-empty glass-panel"><Search size={22} /><strong>검색 결과가 없어요.</strong><span>다른 검색어를 입력하거나 아래에서 URL을 직접 추가해보세요.</span></div>}

        <div className="discovery-grid">
          {results.map((site) => {
            const discovered = discoveredIds.has(site.id)
            const busy = busyIds.has(`discover:${site.id}`)
            return (
              <article className="discovery-card glass-panel" key={site.id}>
                <div className="site-glyph" style={{ '--card-color': site.color } as React.CSSProperties}><Favicon src={site.faviconUrl} name={site.name} /></div>
                <span className="site-category">{site.category}</span>
                <h2>{site.name}</h2>
                <p className="site-domain">{site.domain}</p>
                <p>{site.description}</p>
                <button disabled={discovered || busy} onClick={() => onDiscover(site)}>
                  {discovered ? <><Check size={15} /> 발견 완료</> : busy ? <>추가 중...</> : <>내 우주에 발견 <ArrowRight size={15} /></>}
                </button>
              </article>
            )
          })}
        </div>
        {remoteError && <p className="nebula-error">{remoteError}</p>}
        {remoteLoading && !results.length && <div className="nebula-loading"><span className="loading-orbit" /> 성운을 탐색하는 중...</div>}
        {hasNext && <button className="load-more-sites" disabled={remoteLoading} onClick={loadMore}>{remoteLoading ? '불러오는 중...' : `더 보기 · ${results.length}/${total}`}</button>}

        <div className="url-discovery glass-panel">
          <div className="url-icon"><Globe2 size={22} /></div>
          <div><h3>찾는 사이트가 없나요?</h3><p>URL을 입력하면 정보를 확인한 뒤 Pending 사이트로 등록합니다.</p></div>
          <label><Link2 size={16} /><input value={url} disabled={adding} onChange={(event) => { setUrl(event.target.value); setMessage('') }} placeholder="https://example.com" /><button disabled={adding || !url.trim()} onClick={submitUrl}>{adding ? '분석 중' : '추가'}</button></label>
          {message && <p className="url-message" role="status">{message}</p>}
        </div>
      </div>
    </section>
  )
}
