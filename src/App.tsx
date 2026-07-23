import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Compass, Heart, LogIn, LogOut, Orbit, Search, Send, Settings2, Sparkles, Telescope, Trash2, X } from 'lucide-react'
import { demoSites } from './data/demoSites'
import type { Site } from './types/site'
import { getActivityBrightness, getCelestialStage, registerVisit } from './engine/UniverseEngine'
import { layoutSites } from './engine/LayoutEngine'
import { catalogSites, type CatalogSite } from './data/catalogSites'
import { AuthPage } from './components/Auth/AuthPage'
import { api, type ApiSite, type ApiUserSite, type PublicUniverse, type SessionUser } from './lib/api'
import type { Category } from './types/site'
import type { ConstellationView } from './types/constellation'
import type { ApiConstellation } from './lib/api'
import { createUniverseView, MAX_VISIBLE_BODIES } from './engine/DisplayEngine'
import { CATEGORY_DEFINITIONS } from './data/categories'
import { Favicon } from './components/Favicon/Favicon'
import { deleteCache, getCache, setCache } from './lib/indexedDbCache'
import { UniverseCanvas } from './components/Universe/UniverseCanvas'

const NebulaPage = lazy(() => import('./components/Nebula/NebulaPage').then((module) => ({ default: module.NebulaPage })))
const StatsPage = lazy(() => import('./components/Stats/StatsPage').then((module) => ({ default: module.StatsPage })))
const ConstellationsPage = lazy(() => import('./components/Constellations/ConstellationsPage').then((module) => ({ default: module.ConstellationsPage })))
const SettingsPage = lazy(() => import('./components/Settings/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const GalaxyPage = lazy(() => import('./components/Galaxy/GalaxyPage').then((module) => ({ default: module.GalaxyPage })))
const SharedUniverseView = lazy(() => import('./components/Galaxy/GalaxyPage').then((module) => ({ default: module.SharedUniverseView })))

export default function App() {
  const [sites, setSites] = useState(demoSites)
  const [selected, setSelected] = useState<Site | null>(demoSites[0])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState<'universe' | 'nebula' | 'stats' | 'constellations' | 'galaxy' | 'settings'>('universe')
  const [mode, setMode] = useState<'account' | 'guest' | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [catalog, setCatalog] = useState<CatalogSite[]>(catalogSites)
  const [constellations, setConstellations] = useState<ConstellationView[]>([])
  const [expandedCategory, setExpandedCategory] = useState<Category | null>(null)
  const [showConstellations, setShowConstellations] = useState(true)
  const [booting, setBooting] = useState(() => Boolean(localStorage.getItem('webverse-token')))
  const [dataLoading, setDataLoading] = useState(false)
  const [authNotice, setAuthNotice] = useState('')
  const [showLogin, setShowLogin] = useState(false)
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const busyRef = useRef(new Set<string>())
  const activeUserIdRef = useRef<string | null>(null)
  const universeSearchRef = useRef<HTMLInputElement | null>(null)
  const publicSlug = useMemo(() => window.location.pathname.match(/^\/universe\/([A-Za-z0-9_-]{8,64})\/?$/)?.[1] ?? null, [])
  const [publicUniverse, setPublicUniverse] = useState<PublicUniverse | null>(null)
  const [publicUniverseError, setPublicUniverseError] = useState('')

  useEffect(() => {
    void api.wake()
  }, [])

  useEffect(() => {
    if (!publicSlug) return
    void api.publicUniverse(publicSlug)
      .then((result) => setPublicUniverse(result.universe))
      .catch((reason) => setPublicUniverseError(reason instanceof Error ? reason.message : '공개 우주를 불러오지 못했습니다.'))
  }, [publicSlug])

  useEffect(() => {
    const savedToken = localStorage.getItem('webverse-token')
    if (!savedToken) { setBooting(false); return }
    void (async () => {
      try {
        const storedUser = readStoredUser()
        const savedUser = storedUser ?? (await api.me(savedToken)).user
        localStorage.setItem('webverse-user', JSON.stringify(savedUser))
        activeUserIdRef.current = savedUser.id
        setToken(savedToken); setUser(savedUser); setMode('account')
        const cached = await getCache<{ sites: Site[]; constellations: ConstellationView[] }>(`universe:v2:${savedUser.id}`, 7 * 24 * 60 * 60_000)
        if (cached) { setSites(cached.sites); setSelected(cached.sites[0] ?? null); setConstellations(cached.constellations) }
        setBooting(false)
        void loadAccountData(savedToken, Boolean(cached)).catch((reason) => showError(reason))
        if (storedUser) void api.me(savedToken).then(({ user: freshUser }) => { setUser(freshUser); localStorage.setItem('webverse-user', JSON.stringify(freshUser)) }).catch(() => undefined)
      } catch { localStorage.removeItem('webverse-token'); setAuthNotice('로그인 정보가 만료되어 다시 로그인이 필요합니다.') }
      finally { setBooting(false) }
    })()
  }, [])

  useEffect(() => {
    api.onUnauthorized(() => {
      if (activeUserIdRef.current) { void deleteCache(`universe:${activeUserIdRef.current}`); void deleteCache(`universe:v2:${activeUserIdRef.current}`) }
      activeUserIdRef.current = null
      localStorage.removeItem('webverse-token')
      localStorage.removeItem('webverse-user')
      setToken(null); setUser(null); setMode(null); setBooting(false)
      setAuthNotice('로그인 세션이 만료되었습니다. 다시 로그인해주세요.')
    })
    return () => api.onUnauthorized(null)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPage('universe')
        window.requestAnimationFrame(() => universeSearchRef.current?.focus())
      }
      if (event.key === 'Escape' && selected) setSelected(null)
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [selected])

  const loadAccountData = async (accountToken: string, hasHydratedCache = false) => {
    const cacheKey = activeUserIdRef.current ? `universe:v2:${activeUserIdRef.current}` : null
    const cached = cacheKey ? await getCache<{ sites: Site[]; constellations: ConstellationView[] }>(cacheKey, 10 * 60_000) : null
    if (cached) {
      setSites(cached.sites); setSelected(cached.sites[0] ?? null); setConstellations(cached.constellations)
    } else if (!hasHydratedCache) setDataLoading(true)
    try {
      const [mine, patterns] = await Promise.all([api.mine(accountToken), api.constellations(accountToken)])
      const nextSites = mine.userSites.map(mapUserSite)
      setSites(nextSites); setSelected(nextSites[0] ?? null)
      setConstellations(patterns.constellations.map(mapConstellation))
      if (cacheKey) void setCache(cacheKey, { sites: nextSites, constellations: patterns.constellations.map(mapConstellation) })
    } finally { setDataLoading(false) }
  }

  const authenticate = (nextToken: string, nextUser: SessionUser) => {
    localStorage.setItem('webverse-token', nextToken)
    localStorage.setItem('webverse-user', JSON.stringify(nextUser))
    activeUserIdRef.current = nextUser.id
    setAuthNotice(''); setShowLogin(false); setToken(nextToken); setUser(nextUser); setMode('account')
    void loadAccountData(nextToken).catch((reason) => showError(reason))
  }

  const enterGuest = () => {
    activeUserIdRef.current = null
    setSites(demoSites); setSelected(demoSites[0]); setCatalog(catalogSites); setConstellations(guestConstellations); setShowLogin(false); setMode('guest')
  }

  const leaveUniverse = () => {
    if (activeUserIdRef.current) { void deleteCache(`universe:${activeUserIdRef.current}`); void deleteCache(`universe:v2:${activeUserIdRef.current}`) }
    activeUserIdRef.current = null
    localStorage.removeItem('webverse-token')
    localStorage.removeItem('webverse-user')
    setToken(null); setUser(null); setShowLogin(false); setMode(null); setPage('universe'); setQuery(''); setExpandedCategory(null)
  }

  const handleSessionButton = () => {
    if (mode === 'guest') setShowLogin(true)
    else leaveUniverse()
  }

  const showError = (reason: unknown) => setToast({ message: reason instanceof Error ? reason.message : '요청을 처리하지 못했습니다.', error: true })

  const runBusy = async <T,>(key: string, action: () => Promise<T>): Promise<T | undefined> => {
    if (busyRef.current.has(key)) return
    busyRef.current.add(key); setBusyIds(new Set(busyRef.current))
    try { return await action() }
    catch (reason) { showError(reason); return undefined }
    finally { busyRef.current.delete(key); setBusyIds(new Set(busyRef.current)) }
  }

  const browseCatalog = useCallback(async (search: string, category: Category | null, pageNumber: number) => {
    if (!token) return { sites: [], total: 0, hasNext: false }
    const cacheKey = `catalog:${search.toLowerCase()}:${category ?? 'all'}:${pageNumber}`
    const cached = await getCache<{ sites: CatalogSite[]; total: number; hasNext: boolean }>(cacheKey, 5 * 60_000)
    if (cached) return cached
    const result = await api.catalog(token, { q: search || undefined, category: category ?? undefined, page: pageNumber, limit: 50 })
    const value = { sites: result.sites.map(mapCatalogSite), total: result.pagination.total, hasNext: result.pagination.hasNext }
    void setCache(cacheKey, value)
    return value
  }, [token])

  const positionedSites = useMemo(() => layoutSites(sites), [sites])

  const filteredSites = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return positionedSites
    return positionedSites.filter((site) => `${site.name} ${site.domain} ${site.category}`.toLowerCase().includes(normalized))
  }, [query, positionedSites])
  const universeView = useMemo(() => createUniverseView(filteredSites, expandedCategory), [filteredSites, expandedCategory])
  const visibleCategories = useMemo(() => [...new Map(universeView.visibleSites.map((site) => [site.category, site.color])).entries()], [universeView.visibleSites])

  const updateSelected = (update: (site: Site) => Site) => {
    if (!selected) return
    const next = update(selected)
    setSites((current) => current.map((site) => site.id === next.id ? next : site))
    setSelected(next)
  }

  const handleVisit = async () => {
    if (!selected) return
    const key = `visit:${selected.id}`
    if (busyRef.current.has(key)) return
    window.open(`https://${selected.domain}`, '_blank', 'noopener,noreferrer')
    updateSelected(registerVisit)
    if (token) {
      const result = await runBusy(key, () => api.visit(token, selected.id))
      if (!result) { void loadAccountData(token).catch(() => undefined); return }
      const patterns = await api.constellations(token).catch((reason) => { showError(reason); return null })
      if (patterns) setConstellations(patterns.constellations.map(mapConstellation))
    }
  }

  const discoverSite = async (catalogSite: CatalogSite) => {
    if (sites.some((site) => site.id === catalogSite.id)) return
    if (token) {
      await runBusy(`discover:${catalogSite.id}`, async () => {
        await api.discover(token, catalogSite.id)
        await loadAccountData(token)
        setToast({ message: `${catalogSite.name}이(가) 내 우주에 추가되었습니다.` })
      })
      return
    }
    setSites((current) => [...current, {
      id: catalogSite.id,
      name: catalogSite.name,
      domain: catalogSite.domain,
      category: catalogSite.category,
      visitCount: 0,
      favorite: false,
      lastVisitedDaysAgo: 0,
      position: [0, 0, 0],
      color: catalogSite.color,
      status: 'APPROVED',
    }])
  }

  const addCustomUrl = async (value: string) => {
    try {
      const parsed = new URL(value.trim())
      if (!['http:', 'https:'].includes(parsed.protocol)) return 'http 또는 https 주소만 입력해주세요.'
      const domain = parsed.hostname.replace(/^www\./, '')
      if (!domain.includes('.')) return '올바른 사이트 주소를 입력해주세요.'
      if (domain === 'localhost' || domain.endsWith('.local') || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(domain)) return '내부 네트워크 주소는 등록할 수 없습니다.'
      if (sites.some((site) => site.domain === domain)) return '이미 내 우주에 있는 사이트입니다.'
      if (token) {
        await api.addCustom(token, parsed.toString())
        await loadAccountData(token)
        return null
      }
      const id = `pending-${domain.replace(/[^a-z0-9]/gi, '-')}`
      setSites((current) => [...current, {
        id, name: domain.split('.')[0].replace(/^./, (letter) => letter.toUpperCase()), domain,
        category: 'Unclassified', visitCount: 0, favorite: false, lastVisitedDaysAgo: 0,
        position: [0, 0, 0], color: '#8992aa', status: 'UNLISTED',
      }])
      return null
    } catch (reason) { return reason instanceof Error ? reason.message : 'https://로 시작하는 올바른 URL을 입력해주세요.' }
  }

  const removeSelectedSite = async () => {
    if (!selected || !window.confirm(`${selected.name}을(를) 내 우주에서 삭제할까요?\n관련 방문 기록도 함께 삭제됩니다.`)) return
    if (token) {
      await runBusy(`delete:${selected.id}`, async () => {
        await api.removeSite(token, selected.id)
        await loadAccountData(token)
        setToast({ message: `${selected.name}을(를) 내 우주에서 삭제했습니다.` })
      })
    } else {
      setSites((current) => current.filter((site) => site.id !== selected.id))
      setSelected(null)
    }
  }

  const requestOfficialRegistration = async () => {
    if (!selected || !token || !['UNLISTED', 'PENDING'].includes(selected.status)) return
    await runBusy(`approval:${selected.id}`, async () => {
      await api.requestSiteApproval(token, selected.id)
      updateSelected((site) => ({ ...site, status: 'REVIEW_REQUESTED', reviewStatus: 'REQUESTED' }))
      setToast({ message: `${selected.name}의 공식 사이트 등록을 신청했습니다.` })
    })
  }

  const renameConstellation = async (id: string, name: string) => {
    if (token) {
      const result = await runBusy(`rename:${id}`, () => api.renameConstellation(token, id, name))
      if (!result) return
    }
    setConstellations((current) => current.map((item) => item.id === id ? { ...item, name } : item))
  }

  const toggleFavorite = async () => {
    if (!selected) return
    if (selected.browserFavorite && selected.favorite) {
      setToast({ message: '브라우저 북마크로 등록된 즐겨찾기입니다. 브라우저에서 북마크를 해제하면 고리도 사라집니다.' })
      return
    }
    const favorite = !selected.favorite
    if (busyRef.current.has(`favorite:${selected.id}`)) return
    updateSelected((site) => ({ ...site, favorite }))
    if (token) {
      const result = await runBusy(`favorite:${selected.id}`, () => api.favorite(token, selected.id, favorite))
      if (!result) updateSelected((site) => ({ ...site, favorite: !favorite }))
    }
  }

  const updateNickname = async (nickname: string) => {
    if (!token) return
    const result = await api.updateProfile(token, nickname)
    setUser(result.user)
    localStorage.setItem('webverse-user', JSON.stringify(result.user))
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!token) return
    await api.changePassword(token, currentPassword, newPassword)
  }

  const deleteAccount = async (password: string) => {
    if (!token) return
    await api.deleteAccount(token, password)
    leaveUniverse()
  }

  const getExtensionStatus = () => token ? api.extensionStatus(token) : Promise.resolve({ connected: false, sessions: [] })
  const createExtensionPairing = () => {
    if (!token) throw new Error('로그인이 필요합니다.')
    return api.createExtensionPairing(token)
  }
  const revokeExtensionConnections = async () => {
    if (!token) return
    await api.revokeExtensionConnections(token)
  }

  if (publicSlug) return <Suspense fallback={<div className="app-loading"><span className="loading-orbit" /><strong>공개 우주를 불러오는 중</strong><small>WEBVERSE GALAXY</small></div>}>
    {publicUniverse ? <SharedUniverseView universe={publicUniverse} /> : publicUniverseError ? <div className="public-universe-error"><Orbit size={34} /><h1>우주를 찾을 수 없어요.</h1><p>{publicUniverseError}</p><a href="/">WebVerse로 돌아가기</a></div> : <div className="app-loading"><span className="loading-orbit" /><strong>공개 우주를 불러오는 중</strong><small>WEBVERSE GALAXY</small></div>}
  </Suspense>
  if (booting) return <div className="app-loading"><span className="loading-orbit" /><strong>우주를 불러오는 중</strong><small>WEBVERSE</small></div>
  if (mode === null) return <AuthPage onAuthenticated={authenticate} onGuest={enterGuest} notice={authNotice} />

  return (
    <main className="app-shell">
      <header className="topbar glass-panel">
        <div className="brand">
          <span className="brand-mark"><Orbit size={20} /></span>
          <div><strong>WEBVERSE</strong><span>MY UNIVERSE</span></div>
        </div>
        <label className="search-box" htmlFor="universe-search">
          <Search size={17} />
          <input ref={universeSearchRef} id="universe-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="내 우주에서 검색" aria-label="내 우주 검색" />
          <kbd>Ctrl K</kbd>
        </label>
        <div className="header-actions">
          <button className={`icon-button ${page === 'settings' ? 'active' : ''}`} aria-label="설정" aria-current={page === 'settings' ? 'page' : undefined} onClick={() => setPage('settings')}><Settings2 size={18} /></button>
          <button type="button" className={`session-button ${mode === 'account' ? 'logout' : 'login'}`} onClick={handleSessionButton}>
            {mode === 'guest' ? <><LogIn size={14} /> 로그인하고 저장하기</> : <><LogOut size={14} /> 로그아웃하기</>}
          </button>
          <span className="avatar" tabIndex={0} data-tooltip={user?.nickname ?? 'Guest · 체험 모드'} aria-label={user ? `${user.nickname} 프로필` : '체험 모드'}>{user?.nickname.slice(0, 1).toUpperCase() ?? 'G'}</span>
        </div>
      </header>

      <nav className="side-nav glass-panel" aria-label="주 메뉴">
        <button className={`nav-button ${page === 'universe' ? 'active' : ''}`} aria-current={page === 'universe' ? 'page' : undefined} onClick={() => setPage('universe')}><Orbit size={20} /><span>내 우주</span></button>
        <button className={`nav-button ${page === 'nebula' ? 'active' : ''}`} aria-current={page === 'nebula' ? 'page' : undefined} onClick={() => setPage('nebula')}><Compass size={20} /><span>성운</span></button>
        <button className={`nav-button ${page === 'stats' ? 'active' : ''}`} aria-current={page === 'stats' ? 'page' : undefined} onClick={() => setPage('stats')}><BarChart3 size={20} /><span>통계</span></button>
        <button className={`nav-button ${page === 'constellations' ? 'active' : ''}`} aria-current={page === 'constellations' ? 'page' : undefined} onClick={() => setPage('constellations')}><Sparkles size={20} /><span>별자리</span></button>
        <button className={`nav-button ${page === 'galaxy' ? 'active' : ''}`} aria-current={page === 'galaxy' ? 'page' : undefined} onClick={() => setPage('galaxy')} disabled={!token}><Telescope size={20} /><span>은하</span></button>
      </nav>

      <Suspense fallback={<PageFallback />}>{page === 'universe' ? <><section className="universe-stage">
        <UniverseCanvas
          sites={universeView.visibleSites}
          clusters={universeView.clusters}
          constellations={showConstellations ? constellations : []}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
          onExpandCluster={(category) => { setExpandedCategory(category); setSelected(null) }}
        />
        <div className="universe-heading">
          <p>WELCOME BACK, {user?.nickname.toUpperCase() ?? 'EXPLORER'}</p>
          <h1>당신의 우주는<br /><em>{sites.length}개의 세계</em>로 이루어져 있어요.</h1>
        </div>
        <div className="category-legend glass-panel">
          {visibleCategories.slice(0, 6).map(([category, color]) => <span key={category}><i className="dot" style={{ color, background: color }} />{category}</span>)}
          {visibleCategories.length > 6 && <span className="more-categories">+{visibleCategories.length - 6} categories</span>}
        </div>
        {expandedCategory && <button className="category-focus" onClick={() => setExpandedCategory(null)}><X size={14} /> {expandedCategory} 집중 보기 종료</button>}
        {!expandedCategory && sites.length > MAX_VISIBLE_BODIES && <div className="body-limit-note">상위 {MAX_VISIBLE_BODIES}개 표시 · 나머지는 카테고리별 +N</div>}
        <button className={`constellation-toggle ${showConstellations ? 'active' : ''}`} aria-pressed={showConstellations} onClick={() => setShowConstellations((value) => !value)}><Sparkles size={13} /> 별자리 선 {showConstellations ? '켜짐' : '꺼짐'} <span>{constellations.length}</span></button>
        <div className="canvas-hint">드래그하여 회전 · 스크롤하여 확대</div>
      </section>

      {selected && (
        <aside className="detail-panel glass-panel">
          <button className="close-button" onClick={() => setSelected(null)} aria-label="닫기"><X size={18} /></button>
          <div className="detail-orbit" style={{ '--site-color': selected.color } as React.CSSProperties}>
            <Favicon src={selected.faviconUrl} name={selected.name} />
          </div>
          <p className="eyebrow">{selected.category}</p>
          <h2>{selected.name}</h2>
          <p className={`domain site-review-status status-${selected.status.toLowerCase()}`}>{selected.domain} · {siteStatusLabel(selected.status)}</p>
          {selected.status === 'REJECTED_PRIVATE' && selected.rejectionReason && (
            <div className="rejection-reason" role="note"><span>거절 사유</span><p>{selected.rejectionReason}</p></div>
          )}
          <div className="stat-grid">
            <div><span>방문</span><strong>{selected.visitCount.toLocaleString()}회</strong></div>
            <div><span>성장 단계</span><strong>{getCelestialStage(selected.visitCount)}</strong></div>
            <div><span>활동 밝기</span><strong>{Math.round(getActivityBrightness(selected.lastVisitedDaysAgo) * 100)}%</strong></div>
            <div><span>마지막 방문</span><strong>{selected.lastVisitedDaysAgo === 0 ? '오늘' : `${selected.lastVisitedDaysAgo}일 전`}</strong></div>
          </div>
          <div className="detail-actions">
            <button className="primary-button" disabled={busyIds.has(`visit:${selected.id}`)} onClick={handleVisit}>{busyIds.has(`visit:${selected.id}`) ? '기록 중...' : '사이트 방문하기'}</button>
            <button
              className={`favorite-button ${selected.favorite ? 'is-favorite' : ''}`}
              disabled={busyIds.has(`favorite:${selected.id}`)}
              onClick={toggleFavorite}
              aria-label="즐겨찾기"
            ><Heart size={19} fill={selected.favorite ? 'currentColor' : 'none'} /></button>
          </div>
          {token && selected.status !== 'APPROVED' && (
            <button
              className="approval-request-button"
              disabled={!['UNLISTED', 'PENDING'].includes(selected.status) || busyIds.has(`approval:${selected.id}`)}
              onClick={requestOfficialRegistration}
            >
              <Send size={14} /> {busyIds.has(`approval:${selected.id}`) ? '신청 전송 중...' : selected.status === 'REVIEW_REQUESTED' ? '공식 등록 검토 중' : selected.status === 'REJECTED_PRIVATE' ? '공식 등록 거절됨' : '공식 사이트 등록 신청'}
            </button>
          )}
          <button className="delete-site-button" disabled={busyIds.has(`delete:${selected.id}`)} onClick={removeSelectedSite}><Trash2 size={15} /> 내 우주에서 삭제</button>
          <p className="visit-note">WebVerse에서 사이트를 열 때 방문 횟수가 기록됩니다.</p>
        </aside>
      )}</> : page === 'nebula' ? <NebulaPage
        discoveredIds={new Set(sites.map((site) => site.id))}
        onDiscover={discoverSite}
        onAddUrl={addCustomUrl}
        catalog={catalog}
        busyIds={busyIds}
        onBrowse={mode === 'account' ? browseCatalog : undefined}
      /> : page === 'stats' ? <StatsPage sites={sites} /> : page === 'constellations'
        ? <ConstellationsPage constellations={constellations} onRename={renameConstellation} />
        : page === 'galaxy' && token ? <GalaxyPage token={token} onError={showError} />
          : <SettingsPage user={user} onLogin={handleSessionButton} onUpdateNickname={updateNickname} onChangePassword={changePassword} onDeleteAccount={deleteAccount} onGetExtensionStatus={getExtensionStatus} onCreateExtensionPairing={createExtensionPairing} onRevokeExtensionConnections={revokeExtensionConnections} onGetGalaxyProfile={() => api.galaxyProfile(token!)} onUpdateGalaxyProfile={(isPublic) => api.updateGalaxyProfile(token!, isPublic)} />}</Suspense>
      {dataLoading && <div className="data-loading"><span className="loading-orbit" /><p>우주 데이터를 동기화하는 중...</p></div>}
      {toast && <div className={`app-toast ${toast.error ? 'error' : ''}`} role={toast.error ? 'alert' : 'status'} aria-live="polite"><span>{toast.error ? '!' : '✓'}</span>{toast.message}<button aria-label="알림 닫기" onClick={() => setToast(null)}><X size={13} /></button></div>}
      {showLogin && <div className="auth-modal-layer" role="dialog" aria-modal="true" aria-label="로그인">
        <button type="button" className="auth-modal-close" onClick={() => setShowLogin(false)} aria-label="로그인 창 닫기"><X size={20} /></button>
        <AuthPage onAuthenticated={authenticate} onGuest={() => setShowLogin(false)} />
      </div>}
    </main>
  )
}

function PageFallback() {
  return <div className="page-fallback"><span className="loading-orbit" /><p>화면을 준비하는 중...</p></div>
}

const knownCategories: Category[] = CATEGORY_DEFINITIONS.map((item) => item.name)

function categoryOf(site: ApiSite): Category {
  const name = site.category?.name
  return name && knownCategories.includes(name as Category) ? name as Category : 'Unclassified'
}

function mapUserSite(entry: ApiUserSite): Site {
  const lastVisit = new Date(entry.lastVisit).getTime()
  const daysAgo = Math.max(0, Math.floor((Date.now() - lastVisit) / 86_400_000))
  return {
    id: entry.site.id, name: entry.site.name, domain: entry.site.domain,
    category: categoryOf(entry.site), visitCount: entry.visitCount, favorite: entry.favorite, browserFavorite: entry.browserFavorite,
    lastVisitedDaysAgo: daysAgo, position: [entry.positionX, entry.positionY, entry.positionZ],
    color: entry.site.category?.color ?? entry.site.themeColor,
    status: entry.site.status as Site['status'],
    faviconUrl: entry.site.faviconUrl,
    reviewStatus: entry.site.approvalRequest?.status ?? null,
    rejectionReason: entry.site.approvalRequest?.status === 'REJECTED' ? entry.site.approvalRequest.resolutionNote : null,
  }
}

function siteStatusLabel(status: Site['status']) {
  if (status === 'APPROVED') return '공식 사이트'
  if (status === 'REVIEW_REQUESTED') return '관리자 검토 중'
  if (status === 'REJECTED_PRIVATE') return '등록 거절'
  return '비공식 사이트'
}

function mapCatalogSite(site: ApiSite): CatalogSite {
  return {
    id: site.id, name: site.name, domain: site.domain,
    description: site.description ?? `${site.name} 공식 사이트`,
    category: categoryOf(site), color: site.category?.color ?? site.themeColor, faviconUrl: site.faviconUrl,
  }
}

function mapConstellation(item: ApiConstellation): ConstellationView {
  return {
    id: item.id, name: item.name, strength: item.strength, occurrenceCount: item.occurrenceCount,
    sites: item.sites.map(({ site }) => ({ id: site.id, name: site.name, color: site.category?.color ?? site.themeColor })),
    edges: item.edges ?? [],
  }
}

const guestConstellations: ConstellationView[] = [{
  id: 'guest-development', name: 'Development 별자리', strength: 2, occurrenceCount: 5,
  sites: [demoSites[0], demoSites[5], demoSites[4]].map((site) => ({ id: site.id, name: site.name, color: site.color })),
  edges: [
    { fromSiteId: demoSites[0].id, toSiteId: demoSites[5].id, count: 5 },
    { fromSiteId: demoSites[5].id, toSiteId: demoSites[4].id, count: 4 },
  ],
}]

function readStoredUser(): SessionUser | null {
  try {
    const value = JSON.parse(localStorage.getItem('webverse-user') ?? 'null') as Partial<SessionUser> | null
    return value && typeof value.id === 'string' && typeof value.nickname === 'string' && typeof value.email === 'string'
      ? value as SessionUser : null
  } catch { return null }
}
