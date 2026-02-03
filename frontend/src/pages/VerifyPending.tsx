import { useSearchParams, useNavigate } from 'react-router-dom'

export default function VerifyPending() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const email = searchParams.get('email') || ''

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
        <h2 className="auth-title">Подтвердите email</h2>
        <p className="auth-subtitle" style={{ marginBottom: 24 }}>
          Мы отправили письмо на <strong>{email}</strong>
          <br />
          Нажмите на кнопку в письме для завершения регистрации.
        </p>
        <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>
          Не получили письмо? Проверьте папку «Спам»
        </p>
        <button className="auth-btn auth-btn-primary" onClick={() => navigate('/login')}>
          Перейти к входу
        </button>
      </div>
    </div>
  )
}