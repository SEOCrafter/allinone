import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { showToast } from '../components/Toast'

export default function TelegramLinkCallback() {
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { refreshUser } = useAuth()

  useEffect(() => {
    const doLink = async () => {
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

        await api.request('/api/v1/auth/telegram-link', {
          method: 'POST',
          body: {
            id: decoded.id,
            first_name: decoded.first_name || '',
            last_name: decoded.last_name || '',
            username: decoded.username || '',
            photo_url: decoded.photo_url || '',
            auth_date: decoded.auth_date,
            hash: decoded.hash,
          },
        })

        if (refreshUser) await refreshUser()
        showToast('Telegram успешно привязан!', 'success')
        navigate('/account?tab=profile')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка привязки Telegram')
      }
    }

    doLink()
  }, [])

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Ошибка</h1>
          <div className="auth-error">{error}</div>
          <button className="auth-btn auth-btn-primary" onClick={() => navigate('/account?tab=profile')}>
            Вернуться в профиль
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Привязка Telegram...</h1>
        <p className="auth-subtitle">Подождите</p>
      </div>
    </div>
  )
}