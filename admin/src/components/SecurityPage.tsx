import { useState, type FormEvent } from 'react'
import { CheckCircle2, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react'
import { adminApi, type Admin } from '../api'

type Props = { token: string; admin: Admin }

export function SecurityPage({ token, admin }: Props) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSuccess('')
    if (newPassword.length < 12) { setError('새 비밀번호는 12자 이상이어야 합니다.'); return }
    if (newPassword !== confirmation) { setError('새 비밀번호 확인이 일치하지 않습니다.'); return }
    setBusy(true)
    try {
      await adminApi.changePassword(token, currentPassword, newPassword)
      setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setSuccess('비밀번호를 변경했습니다.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : '비밀번호를 변경하지 못했습니다.') }
    finally { setBusy(false) }
  }

  return <section className="page security-page">
    <header className="page-header"><div><p>ACCOUNT SECURITY</p><h1>보안 설정</h1><span>관리자 계정과 접속 비밀번호를 안전하게 관리합니다.</span></div></header>
    <div className="security-grid">
      <article className="admin-account-card"><span>{admin.name.slice(0, 1).toUpperCase()}</span><div><small>현재 관리자</small><h2>{admin.name}</h2><p>{admin.email}</p><b><ShieldCheck size={13} /> 활성 관리자 계정</b></div></article>
      <form className="password-card" onSubmit={submit}>
        <header><span><KeyRound size={20} /></span><div><h2>비밀번호 변경</h2><p>다른 서비스에서 사용하지 않는 비밀번호를 권장합니다.</p></div></header>
        <label><span>현재 비밀번호</span><input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
        <label><span>새 비밀번호</span><input type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="12자 이상" /></label>
        <label><span>새 비밀번호 확인</span><input type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        {error && <div className="form-error">{error}</div>}{success && <div className="form-success"><CheckCircle2 size={15} /> {success}</div>}
        <button disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />} 비밀번호 변경</button>
      </form>
    </div>
  </section>
}
