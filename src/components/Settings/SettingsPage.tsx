import { useEffect, useState, type FormEvent } from 'react'
import { KeyRound, Link2, LogIn, PlugZap, RefreshCw, Save, Settings2, ShieldCheck, Trash2, Unplug, UserRound } from 'lucide-react'
import type { ExtensionStatus, SessionUser } from '../../lib/api'

type Props = {
  user: SessionUser | null
  onLogin: () => void
  onUpdateNickname: (nickname: string) => Promise<void>
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>
  onDeleteAccount: (password: string) => Promise<void>
  onGetExtensionStatus: () => Promise<ExtensionStatus>
  onCreateExtensionPairing: () => Promise<{ code: string; expiresAt: string }>
  onRevokeExtensionConnections: () => Promise<void>
}

export function SettingsPage({ user, onLogin, onUpdateNickname, onChangePassword, onDeleteAccount, onGetExtensionStatus, onCreateExtensionPairing, onRevokeExtensionConnections }: Props) {
  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deletePasswordReady, setDeletePasswordReady] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null)
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null)

  useEffect(() => {
    setNickname(user?.nickname ?? '')
    setDeletePassword('')
    setDeletePasswordReady(false)
  }, [user])
  useEffect(() => {
    if (!user) return
    void onGetExtensionStatus().then(setExtensionStatus).catch(() => undefined)
  }, [user?.id])
  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true); setError(''); setMessage('')
    try { await action(); setMessage(success) } catch (reason) { setError(reason instanceof Error ? reason.message : '요청을 처리하지 못했습니다.') } finally { setBusy(false) }
  }

  if (!user) return <section className="settings-page"><div className="settings-content">
    <p className="settings-kicker"><Settings2 size={13} /> UNIVERSE CONTROL</p><h1>우주 설정</h1>
    <div className="guest-settings glass-panel"><div><UserRound size={26} /></div><h2>체험 모드에서는 계정 설정을 사용할 수 없어요.</h2><p>로그인하면 닉네임과 비밀번호를 관리하고 우주 데이터를 안전하게 저장할 수 있습니다.</p><button onClick={onLogin}><LogIn size={15} /> 로그인하고 저장하기</button></div>
  </div></section>

  const submitNickname = (event: FormEvent) => { event.preventDefault(); void run(() => onUpdateNickname(nickname), '닉네임을 변경했습니다.') }
  const submitPassword = (event: FormEvent) => { event.preventDefault(); void run(async () => { await onChangePassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword('') }, '비밀번호를 변경했습니다.') }
  const deleteAccount = () => {
    if (!deletePassword || !window.confirm('정말 탈퇴할까요?\n우주, 방문 기록, 별자리를 포함한 모든 개인 데이터가 영구 삭제됩니다.')) return
    void run(() => onDeleteAccount(deletePassword), '')
  }
  const createPairing = () => void run(async () => { setPairing(await onCreateExtensionPairing()) }, '10분 동안 사용할 수 있는 연결 코드를 만들었습니다.')
  const revokeConnections = () => void run(async () => { await onRevokeExtensionConnections(); setPairing(null); setExtensionStatus(await onGetExtensionStatus()) }, '확장 프로그램 연결을 모두 해제했습니다.')

  return <section className="settings-page"><div className="settings-content">
    <p className="settings-kicker"><Settings2 size={13} /> UNIVERSE CONTROL</p><h1>우주 설정</h1><p className="settings-intro">계정과 개인 데이터를 관리하세요.</p>
    {(message || error) && <div className={`settings-message ${error ? 'error' : ''}`}>{error || message}</div>}
    <div className="settings-grid">
      <form className="settings-card glass-panel" onSubmit={submitNickname}>
        <div className="settings-card-title"><span><UserRound size={18} /></span><div><h2>프로필</h2><p>우주에서 표시할 이름을 설정합니다.</p></div></div>
        <label><span>이메일</span><input value={user.email} disabled /></label>
        <label><span>닉네임</span><input value={nickname} minLength={2} maxLength={24} onChange={(event) => setNickname(event.target.value)} /></label>
        <button className="settings-save" disabled={busy || nickname.trim() === user.nickname}><Save size={14} /> 변경사항 저장</button>
      </form>

      <form className="settings-card glass-panel" onSubmit={submitPassword}>
        <div className="settings-card-title"><span><KeyRound size={18} /></span><div><h2>비밀번호</h2><p>8자 이상의 새 비밀번호로 변경합니다.</p></div></div>
        <label><span>현재 비밀번호</span><input type="password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
        <label><span>새 비밀번호</span><input type="password" required minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
        <button className="settings-save" disabled={busy}><ShieldCheck size={14} /> 비밀번호 변경</button>
      </form>

      <article className="settings-card extension-card glass-panel">
        <div className="settings-card-title"><span><PlugZap size={18} /></span><div><h2>브라우저 자동 동기화</h2><p>평소 방문을 자동으로 우주에 기록합니다.</p></div></div>
        <div className={`extension-status ${extensionStatus?.connected ? 'connected' : ''}`}><i />{extensionStatus?.connected ? `${extensionStatus.sessions.length}개 브라우저 연결됨` : '연결된 확장 프로그램 없음'}</div>
        {extensionStatus?.sessions.map((session) => <div className="extension-session" key={session.id}><strong>{session.deviceName}</strong><span>{session.lastSeenAt ? `마지막 동기화 ${new Date(session.lastSeenAt).toLocaleString()}` : '아직 동기화 기록 없음'}</span></div>)}
        {pairing && <div className="pairing-code"><span>확장 프로그램에 입력</span><strong>{pairing.code}</strong><small>{new Date(pairing.expiresAt).toLocaleTimeString()}까지 유효</small></div>}
        <div className="extension-actions"><button className="settings-save" disabled={busy} onClick={createPairing}>{pairing ? <RefreshCw size={14} /> : <Link2 size={14} />}{pairing ? '새 코드 만들기' : '연결 코드 만들기'}</button>{extensionStatus?.connected && <button className="disconnect-extension" disabled={busy} onClick={revokeConnections}><Unplug size={14} /> 연결 해제</button>}</div>
        <p className="extension-privacy">전체 URL이나 검색어가 아닌 도메인과 방문 시각만 동기화합니다.</p>
      </article>

      <article className="settings-card danger-card glass-panel">
        <div className="settings-card-title"><span><Trash2 size={18} /></span><div><h2>회원 탈퇴</h2><p>모든 개인 데이터가 복구할 수 없게 삭제됩니다.</p></div></div>
        <ul><li>내 우주의 모든 사이트</li><li>방문 기록과 즐겨찾기</li><li>생성된 별자리와 개인 설정</li></ul>
        <label><span>확인을 위해 비밀번호 입력</span><input type="password" name="webverse-delete-account-confirmation" autoComplete="new-password" data-1p-ignore="true" data-lpignore="true" readOnly={!deletePasswordReady} value={deletePassword} onFocus={() => setDeletePasswordReady(true)} onChange={(event) => setDeletePassword(event.target.value)} /></label>
        <button className="delete-account" disabled={busy || !deletePassword} onClick={deleteAccount}><Trash2 size={14} /> 계정과 데이터 영구 삭제</button>
      </article>
    </div>
  </div></section>
}
