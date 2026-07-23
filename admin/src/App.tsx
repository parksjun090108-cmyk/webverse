import { useCallback, useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { adminApi, type Admin, type Category, type Overview } from './api'
import { LoginPage } from './components/LoginPage'
import { Sidebar, type AdminView } from './components/Sidebar'
import { RequestsPage } from './components/RequestsPage'
import { AuditPage } from './components/AuditPage'
import { SecurityPage } from './components/SecurityPage'
import { UniverseReportsPage } from './components/UniverseReportsPage'

const TOKEN_KEY = 'webverse-admin-token'

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [view, setView] = useState<AdminView>('requests')
  const [booting, setBooting] = useState(Boolean(token))

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null); setAdmin(null); setOverview(null); setCategories([]); setView('requests'); setBooting(false)
  }, [])

  const loadShared = useCallback(async (activeToken: string) => {
    const [overviewResult, categoryResult] = await Promise.all([adminApi.overview(activeToken), adminApi.categories(activeToken)])
    setOverview(overviewResult); setCategories(categoryResult.categories)
  }, [])

  useEffect(() => { adminApi.onUnauthorized(logout); return () => adminApi.onUnauthorized(null) }, [logout])
  useEffect(() => { void adminApi.wake() }, [])
  useEffect(() => {
    if (!token) { setBooting(false); return }
    void Promise.all([adminApi.me(token), loadShared(token)])
      .then(([me]) => setAdmin(me.admin))
      .catch(() => logout())
      .finally(() => setBooting(false))
  }, [token, loadShared, logout])

  const login = async (email: string, password: string) => {
    const result = await adminApi.login(email, password)
    localStorage.setItem(TOKEN_KEY, result.token)
    setToken(result.token); setAdmin(result.admin); setBooting(false)
    await loadShared(result.token)
  }

  if (booting) return <main className="admin-boot"><div className="boot-orbit"><LoaderCircle className="spin" size={24} /></div><h1>WEBVERSE CONTROL</h1><p>관리자 세션을 확인하고 있습니다.</p></main>
  if (!token || !admin) return <LoginPage onLogin={login} />

  return <main className="admin-shell">
    <Sidebar view={view} admin={admin} overview={overview} onChange={setView} onLogout={logout} />
    <div className="admin-content">
      {view === 'requests' ? <RequestsPage token={token} overview={overview} categories={categories} onDataChanged={() => loadShared(token)} />
        : view === 'reports' ? <UniverseReportsPage token={token} overview={overview} onDataChanged={() => loadShared(token)} />
        : view === 'history' ? <AuditPage token={token} />
          : <SecurityPage token={token} admin={admin} />}
    </div>
  </main>
}
