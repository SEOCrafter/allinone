import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    if (!agreed) {
      setError('Необходимо принять пользовательское соглашение')
      return
    }

    setLoading(true)
    try {
      const res: any = await api.request('/auth/register', {
        method: 'POST',
        body: { email, password },
      })
      if (res.access_token) {
        localStorage.setItem('token', res.access_token)
        if (res.refresh_token) {
          localStorage.setItem('refresh_token', res.refresh_token)
        }
        const me: any = await api.request('/users/me')
        login(me)
        navigate('/')
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail
      if (typeof msg === 'string') {
        setError(msg)
      } else {
        setError('Ошибка регистрации')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleTelegram = () => {
    window.open('https://t.me/umnik_ai_bot?start=auth', '_blank')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Регистрация</h1>
        <p className="auth-subtitle">Зарегистрируйтесь и погрузитесь в мир нейросетей</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="auth-input"
            required
          />

          <div className="auth-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              className="auth-input"
              required
            />
            <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>

          <div className="auth-input-wrapper">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              className="auth-input"
              required
            />
            <button type="button" className="auth-eye-btn" onClick={() => setShowConfirm(!showConfirm)}>
              {showConfirm ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>

          <label className="auth-checkbox">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>Соглашаюсь с <a href="/terms" target="_blank">политикой конфиденциальности</a> и <a href="/terms" target="_blank">пользовательским соглашением</a></span>
          </label>

          <button type="submit" className="auth-btn auth-btn-primary" disabled={loading || !agreed}>
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <button className="auth-btn auth-btn-telegram" onClick={handleTelegram}>
          Войти через Telegram
          <img src="/icons/telegram.svg" alt="" width="20" height="20" />
        </button>

        <Link to="/login" className="auth-link">Уже есть аккаунт</Link>
      </div>
    </div>
  )
}