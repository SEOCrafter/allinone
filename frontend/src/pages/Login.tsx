import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as apiLogin } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Вход</h1>
        <p className="login-subtitle">Войдите в аккаунт, чтобы продолжить</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="login-divider">или</div>

        <button className="btn btn-social">
          <svg width="20" height="20" viewBox="0 0 18 18" fill="currentColor">
            <path d="M16.2 2.1L1.4 8.3C.3 8.7.3 9.3 1.2 9.6L5 10.9 13.7 5.2c.4-.3.8-.1.5.2L7.3 11.7l-.3 4c.4 0 .6-.2.8-.4l1.9-1.8 3.8 2.8c.7.4 1.2.2 1.4-.6L17 3.2c.3-1-.3-1.5-.8-1.1z"/>
          </svg>
          Войти через Telegram
        </button>

        <p className="login-footer">
          Нет аккаунта? <a href="/register">Зарегистрироваться</a>
        </p>

        <div className="login-demo">
          <p>Тестовый аккаунт:</p>
          <code>admin@example.com / password</code>
        </div>
      </div>
    </div>
  )
}