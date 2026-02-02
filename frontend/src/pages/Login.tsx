import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login as apiLogin } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await apiLogin(email, password)
      login(user)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка авторизации')
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
        <h1 className="auth-title">Вход</h1>
        <p className="auth-subtitle">Войдите в аккаунт, чтобы продолжить</p>

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

          <div className="auth-forgot">
            <Link to="/forgot-password">Забыли пароль?</Link>
          </div>

          <button type="submit" className="auth-btn auth-btn-primary" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <button className="auth-btn auth-btn-telegram" onClick={handleTelegram}>
          Войти через Telegram
          <img src="/icons/telegram.svg" alt="" width="20" height="20" />
        </button>

        <Link to="/register" className="auth-link">Регистрация</Link>
      </div>
    </div>
  )
}