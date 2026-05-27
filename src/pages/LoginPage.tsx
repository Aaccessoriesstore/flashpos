import { useState } from 'react'
import { Zap, User, Lock, Hash, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [mode, setMode] = useState<'password' | 'pin'>('password')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const { login, loginWithPin, isLoading } = useAuthStore()

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(username.trim(), password)
      toast.success('أهلاً بك في FlashPOS')
    } catch (err: any) {
      setError(err.message || 'خطأ في تسجيل الدخول')
    }
  }

  const handlePinInput = async (digit: string) => {
    if (digit === 'C') { setPin(''); setError(''); return }
    const newPin = pin + digit
    setPin(newPin)
    if (newPin.length === 4) {
      setError('')
      try {
        await loginWithPin(newPin)
        toast.success('أهلاً بك في FlashPOS')
      } catch (err: any) {
        setError(err.message || 'رمز PIN غير صحيح')
        setTimeout(() => setPin(''), 600)
      }
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute', top: '-20%', right: '-10%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(0,200,150,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', left: '-10%',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(14,165,233,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div className="text-center" style={{ marginBottom: '2rem' }}>
          <div style={{
            width: '64px', height: '64px',
            background: 'linear-gradient(135deg, #00C896, #0EA5E9)',
            borderRadius: '18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 32px rgba(0,200,150,0.3)',
          }}>
            <Zap size={32} color="white" fill="white" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.5px' }}>
            Flash<span style={{ color: 'var(--brand-primary)' }}>POS</span>
          </h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
            نظام الكاشير الذكي المتكامل
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.75rem',
          boxShadow: 'var(--shadow-lg)',
        }}>
          {/* Mode Toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius)',
            padding: '3px',
            marginBottom: '1.5rem',
          }}>
            {(['password', 'pin'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setPin('') }}
                className="btn"
                style={{
                  flex: 1, gap: '0.4rem', fontSize: '0.85rem',
                  background: mode === m ? 'var(--bg-elevated)' : 'transparent',
                  color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: mode === m ? '1px solid var(--border)' : '1px solid transparent',
                  boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
                  transition: 'all var(--transition)',
                }}
              >
                {m === 'password' ? <><Lock size={14} /> كلمة المرور</> : <><Hash size={14} /> رمز PIN</>}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="animate-slide-up" style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius)',
              padding: '0.65rem 0.9rem',
              marginBottom: '1rem',
              fontSize: '0.85rem',
              color: 'var(--brand-danger)',
            }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {/* Password Form */}
          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">اسم المستخدم</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="أدخل اسم المستخدم"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                  <User size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">كلمة المرور</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showPass ? 'text' : 'password'}
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                    placeholder="أدخل كلمة المرور"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <Lock size={15} style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={isLoading} style={{ marginTop: '0.25rem' }}>
                {isLoading ? <span className="spinner" /> : 'تسجيل الدخول'}
              </button>
            </form>
          )}

          {/* PIN Form */}
          {mode === 'pin' && (
            <div>
              {/* PIN Display */}
              <div className="flex-center" style={{ gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{
                    width: '52px', height: '52px',
                    borderRadius: 'var(--radius)',
                    border: `2px solid ${pin.length > i ? 'var(--brand-primary)' : 'var(--border)'}`,
                    background: pin.length > i ? 'var(--brand-primary-light)' : 'var(--bg-input)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all var(--transition)',
                    fontSize: '1.5rem',
                  }}>
                    {pin.length > i ? '●' : ''}
                  </div>
                ))}
              </div>

              {/* PIN Keypad */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
                {['1','2','3','4','5','6','7','8','9','C','0','⌫'].map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === '⌫') setPin(p => p.slice(0, -1))
                      else handlePinInput(key)
                    }}
                    disabled={isLoading || (key !== 'C' && key !== '⌫' && pin.length >= 4)}
                    style={{
                      padding: '1rem',
                      background: key === 'C' ? 'rgba(239,68,68,0.1)' : key === '⌫' ? 'var(--bg-elevated)' : 'var(--bg-elevated)',
                      border: `1px solid ${key === 'C' ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius)',
                      color: key === 'C' ? 'var(--brand-danger)' : 'var(--text-primary)',
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all var(--transition)',
                      fontFamily: "'Cairo', sans-serif",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = key === 'C' ? 'rgba(239,68,68,0.1)' : 'var(--bg-elevated)')}
                  >
                    {isLoading && pin.length === 4 ? <span className="spinner" style={{ margin: 'auto' }} /> : key}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs" style={{ color: 'var(--text-muted)', marginTop: '1.5rem' }}>
          FlashPOS © {new Date().getFullYear()} — نظام الكاشير الذكي
        </p>
      </div>
    </div>
  )
}
