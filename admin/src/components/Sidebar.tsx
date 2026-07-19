import { ClipboardCheck, History, LockKeyhole, LogOut, Orbit } from 'lucide-react'
import type { Admin, Overview } from '../api'

export type AdminView = 'requests' | 'history' | 'security'

type Props = {
  view: AdminView
  admin: Admin
  overview: Overview | null
  onChange: (view: AdminView) => void
  onLogout: () => void
}

export function Sidebar({ view, admin, overview, onChange, onLogout }: Props) {
  return <aside className="admin-sidebar">
    <div className="sidebar-brand"><span><Orbit size={22} /></span><div><strong>WEBVERSE</strong><small>CONTROL CENTER</small></div></div>
    <nav>
      <p>MANAGEMENT</p>
      <button className={view === 'requests' ? 'active' : ''} onClick={() => onChange('requests')}><ClipboardCheck size={18} /><span>등록 요청</span>{Boolean(overview?.requests.requested) && <b>{overview!.requests.requested}</b>}</button>
      <button className={view === 'history' ? 'active' : ''} onClick={() => onChange('history')}><History size={18} /><span>처리 기록</span></button>
      <p>ACCOUNT</p>
      <button className={view === 'security' ? 'active' : ''} onClick={() => onChange('security')}><LockKeyhole size={18} /><span>보안 설정</span></button>
    </nav>
    <div className="sidebar-profile">
      <span>{admin.name.slice(0, 1).toUpperCase()}</span>
      <div><strong>{admin.name}</strong><small>{admin.email}</small></div>
      <button aria-label="로그아웃" onClick={onLogout}><LogOut size={17} /></button>
    </div>
  </aside>
}
