import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LoaderCircle, Orbit, ShieldCheck } from 'lucide-react'

type Props = { onLogin: (email: string, password: string) => Promise<void> }

export function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onLogin(email, password)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '로그인하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="login-page">
    <div className="login-space" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    <header className="login-top-brand">
      <span><Orbit size={25} /></span>
      <div><strong>WEBVERSE</strong><small>CONTROL CENTER</small></div>
    </header>
    <section className="login-brand">
      <p><Orbit size={13} /> WEBVERSE CONTROL</p>
      <h1>발견된 인터넷을<br /><em>안전하게 관리하세요.</em></h1>
      <span>사이트 등록 요청을 검토하고 WebVerse의 공식 우주를 관리하는 관리자 전용 공간입니다.</span>
    </section>
    <section className="login-card">
      <div className="security-label"><ShieldCheck size={14} /> ADMINISTRATOR ONLY</div>
      <h2>관리자 로그인</h2>
      <p>승인된 관리자 계정으로 접속하세요.</p>
      <form onSubmit={submit}>
        <label>
          <span>관리자 이메일</span>
          <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@webverse.com" />
        </label>
        <label>
          <span>비밀번호</span>
          <div className="password-input">
            <input type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호 입력" />
            <button type="button" aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'} onClick={() => setVisible((value) => !value)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="login-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <><span>관리 화면으로 이동</span><ArrowRight size={17} /></>}</button>
      </form>
      <small>관리자 접속 및 모든 승인·거절 작업은 기록됩니다.</small>
    </section>
  </main>
}
