import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

interface Transaction {
  id: string
  amount: number
  currency: string
  credits: number
  status: string
  created_at: string
  completed_at: string | null
}

export default function PaymentSuccess() {
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'checking' | 'success' | 'pending'>('checking')
  const [credits, setCredits] = useState(0)

  useEffect(() => {
    checkPayment()
  }, [])

  const checkPayment = async () => {
    try {
      await refreshUser()
      const res = await api.request<{ transactions: Transaction[] }>('/api/v1/payments/history')
      const last = res.transactions[0]
      if (last && last.status === 'completed') {
        setCredits(last.credits)
        setStatus('success')
      } else {
        setStatus('pending')
        setTimeout(async () => {
          await refreshUser()
          const res2 = await api.request<{ transactions: Transaction[] }>('/api/v1/payments/history')
          const last2 = res2.transactions[0]
          if (last2 && last2.status === 'completed') {
            setCredits(last2.credits)
            setStatus('success')
          }
        }, 5000)
      }
    } catch {
      setStatus('pending')
    }
  }

  return (
    <div className="payment-success-page">
      <div className="payment-success-card">
        {status === 'checking' && (
          <>
            <div className="spinner" />
            <h2>Проверяем платёж...</h2>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="payment-success-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="8 12 11 15 16 9" />
              </svg>
            </div>
            <h2>Оплата получена!</h2>
            <p>На ваш баланс начислено <strong>{credits.toLocaleString('ru-RU')}</strong> токенов</p>
            <button className="pay-modal-btn primary" onClick={() => navigate('/account')}>
              Перейти в аккаунт
            </button>
            <button className="pay-modal-btn secondary" onClick={() => navigate('/')}>
              На главную
            </button>
          </>
        )}

        {status === 'pending' && (
          <>
            <div className="payment-success-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h2>Платёж обрабатывается</h2>
            <p>Токены будут начислены автоматически в течение нескольких минут</p>
            <button className="pay-modal-btn primary" onClick={() => navigate('/account')}>
              Перейти в аккаунт
            </button>
          </>
        )}
      </div>
    </div>
  )
}