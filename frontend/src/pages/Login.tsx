import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login as apiLogin, telegramLogin } from '../api/auth'
import { useAuth } from '../context/AuthContext'

const TG_BOT_USERNAME = 'umn_ai_bot'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()
  const tgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    (window as any).onTelegramAuth = async (tgUser: any) => {
      setError('')
      setLoading(true)
      try {
        const user = await telegramLogin({
          id: tgUser.id,
          first_name: tgUser.first_name || '',
          last_name: tgUser.last_name || '',
          username: tgUser.username || '',
          photo_url: tgUser.photo_url || '',
          auth_date: tgUser.auth_date,
          hash: tgUser.hash,
        })
        login(user)
        navigate('/')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка входа через Telegram')
      } finally {
        setLoading(false)
      }
    }

    if (tgRef.current && !tgRef.current.querySelector('iframe')) {
      const script = document.createElement('script')
      script.src = 'https://telegram.org/js/telegram-widget.js?22'
      script.setAttribute('data-telegram-login', TG_BOT_USERNAME)
      script.setAttribute('data-size', 'large')
      script.setAttribute('data-radius', '12')
      script.setAttribute('data-onauth', 'onTelegramAuth(user)')
      script.setAttribute('data-request-access', 'write')
      script.async = true
      tgRef.current.appendChild(script)
    }

    return () => {
      delete (window as any).onTelegramAuth
    }
  }, [])

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

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Вход</h1>
        <p className="auth-subtitle">Войдите в аккаунт, чтобы продолжить</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="auth-input"
            required
          />

          <div className="auth-password-wrapper">
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
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
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

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="auth-divider">
          <span>или</span>
        </div>

        <div className="auth-telegram-widget" ref={tgRef} />

        <div className="auth-links">
          <Link to="/register" className="auth-link">Регистрация</Link>
        </div>
      </div>
    </div>
  )
}