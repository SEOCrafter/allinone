import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { telegramLogin } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function TelegramCallback() {
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { login } = useAuth()

  useEffect(() => {
    const doAuth = async () => {
      const id = searchParams.get('id')
      const hash = searchParams.get('hash')
      const auth_date = searchParams.get('auth_date')

      if (!id || !hash || !auth_date) {
        setError('Некорректные данные от Telegram')
        return
      }

      try {
        const user = await telegramLogin({
          id: parseInt(id),
          first_name: searchParams.get('first_name') || '',
          last_name: searchParams.get('last_name') || '',
          username: searchParams.get('username') || '',
          photo_url: searchParams.get('photo_url') || '',
          auth_date: parseInt(auth_date),
          hash: hash,
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