import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

interface VerifyResponse {
  ok: boolean
  access_token: string
  refresh_token: string
  user: {
    id: string
    email: string
    name?: string
    role: string
    credits_balance: number
  }
}

export default function Verify() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const calledRef = useRef(false)

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true

    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setError('Токен не найден')
      return
    }

    api.request<VerifyResponse>(`/api/v1/auth/verify?token=${token}`)
      .then(res => {
        api.setTokens(res.access_token, res.refresh_token)
        login(res.user)
        setStatus('success')
        setTimeout(() => navigate('/account'), 1500)
      })
      .catch((err: any) => {
        setStatus('error')
        setError(err?.message || 'Ошибка верификации')
      })
  }, [])

  return (
    <div className="auth-page">
      <div className="auth-card">
        {status === 'loading' && (
          <>
            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
            <h2 className="auth-title">Проверяем...</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 className="auth-title">Email подтверждён!</h2>
            <p className="auth-subtitle">Перенаправляем в личный кабинет...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 className="auth-title">Ошибка</h2>
            <p className="auth-subtitle">{error}</p>
            <button className="auth-btn auth-btn-primary" onClick={() => navigate('/login')}>
              Войти
            </button>
          </>
        )}
      </div>
    </div>
  )
}