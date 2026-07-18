import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, Orbit, Sparkles } from 'lucide-react'
import { api, type SessionUser } from '../../lib/api'

type Props = {
  onAuthenticated: (token: string, user: SessionUser) => void
  onGuest: () => void
  notice?: string
}

export function AuthPage({ onAuthenticated, onGuest, notice }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true)
    try {
      const result = mode === 'login'
        ? await api.login({ email, password })
        : await api.register({ nickname, email, password })
      onAuthenticated(result.token, result.user)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '로그인할 수 없습니다.')
    } finally { setLoading(false) }
  }

  return (
    <main className="auth-page">
      <div className="auth-stars" />
      <section className="auth-story">
        <div className="auth-brand"><span><Orbit size={22} /></span><strong>WEBVERSE</strong></div>
        <div className="auth-copy">
          <p><Sparkles size={13} /> YOUR INTERNET, REIMAGINED</p>
          <h1><span className="auth-title-line">당신이 탐험한 인터넷을</span><br /><em>하나의 우주로.</em></h1>
          <span>사이트를 발견하고, 자주 찾는 세계를 성장시키며,<br />당신만의 인터넷 궤적을 기록하세요.</span>
        </div>
        <div className="auth-solar"><i className="orbit-line a" /><i className="orbit-line b" /><i className="planet p1" /><i className="planet p2" /><i className="planet p3" /><i className="sun-core" /></div>
        <small>YOUR UNIVERSE, YOUR RULES</small>
      </section>

      <section className="auth-form-wrap">
        <form className="auth-form glass-panel" onSubmit={submit}>
          <p className="form-kicker">{mode === 'login' ? 'WELCOME BACK' : 'CREATE YOUR UNIVERSE'}</p>
          <h2>{mode === 'login' ? '다시 우주로 돌아가기' : '새로운 우주 시작하기'}</h2>
          <p className="form-subtitle">{mode === 'login' ? '저장된 세계들이 기다리고 있어요.' : '처음에는 태양 하나에서 시작합니다.'}</p>
          {notice && <p className="auth-notice">{notice}</p>}
          {mode === 'register' && <label><span>닉네임</span><input required minLength={2} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="우주에서 사용할 이름" /></label>}
          <label><span>이메일</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <label><span>비밀번호</span><div className="password-field"><input required minLength={8} type={visible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상 입력" /><button type="button" aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={loading}>{loading ? '연결 중...' : mode === 'login' ? '내 우주 입장' : '우주 생성'}<ArrowRight size={16} /></button>
          <button className="guest-button" type="button" onClick={onGuest}>로그인 없이 체험하기</button>
          <p className="mode-switch">{mode === 'login' ? '아직 우주가 없나요?' : '이미 우주가 있나요?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? '회원가입' : '로그인'}</button></p>
        </form>
      </section>
    </main>
  )
}
