import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { telegramLogin } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function TelegramCallback() {
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { login } = useAuth()

  useEffect(() => {
    const doAuth = async () => {
      try {
        const hash = window.location.hash
        const match = hash.match(/tgAuthResult=([^&]+)/)
        if (!match) {
          setError('Данные от Telegram не найдены')
          return
        }

        const decoded = JSON.parse(atob(match[1]))

        if (!decoded.id || !decoded.hash || !decoded.auth_date) {
          setError('Некорректные данные от Telegram')
          return
        }

        const user = await telegramLogin({
          id: decoded.id,
          first_name: decoded.first_name || '',
          last_name: decoded.last_name || '',
          username: decoded.username || '',
          photo_url: decoded.photo_url || '',
          auth_date: decoded.auth_date,
          hash: decoded.hash,
        })
        login(user)
        navigate('/')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка входа через Telegram')
      }
    }

    doAuth()
  }, [])

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Ошибка</h1>
          <div className="auth-error">{error}</div>
          <button className="auth-btn auth-btn-primary" onClick={() => navigate('/login')}>
            Вернуться к входу
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Вход через Telegram...</h1>
        <p className="auth-subtitle">Подождите, идёт авторизация</p>
      </div>
    </div>
  )
}