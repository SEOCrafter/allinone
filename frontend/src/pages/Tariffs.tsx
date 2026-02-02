import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { QRCodeSVG } from 'qrcode.react'

interface TariffItem {
  item_type: string
  adapter_name: string | null
  model_id: string | null
  custom_description: string | null
  credits_override: number | null
  is_enabled: boolean
}

interface Tariff {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  credits: number
  items: TariffItem[]
}

interface PaymentCreateResponse {
  payment_url: string
  order_id: string
  amount: number
  credits: number
}

interface PaymentStatusResponse {
  order_id: string
  status: string
  amount: number
  credits: number
  created_at: string
  completed_at: string | null
}

type ModalStep = 'confirm' | 'loading' | 'qr' | 'success' | 'error' | 'timeout'

function formatPrice(price: number): string {
  if (price === 0) return 'Бесплатно'
  return price.toLocaleString('ru-RU') + ' ₽'
}

function formatCredits(credits: number): string {
  if (credits === 0) return '—'
  return credits.toLocaleString('ru-RU')
}

export default function Tariffs() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null)
  const [modalStep, setModalStep] = useState<ModalStep>('confirm')
  const [paymentUrl, setPaymentUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [creditsAdded, setCreditsAdded] = useState(0)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingStartRef = useRef<number>(0)

  useEffect(() => {
    loadTariffs()
    return () => stopPolling()
  }, [])

  const loadTariffs = async () => {
    try {
      const res = await api.request<Tariff[]>('/api/v1/tariffs')
      setTariffs(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startPolling = useCallback((oid: string) => {
    stopPolling()
    pollingStartRef.current = Date.now()

    pollingRef.current = setInterval(async () => {
      const elapsed = Date.now() - pollingStartRef.current
      if (elapsed > 300000) {
        stopPolling()
        setModalStep('timeout')
        return
      }

      try {
        const res = await api.request<PaymentStatusResponse>(`/api/v1/payments/status/${oid}`)
        if (res.status === 'completed') {
          stopPolling()
          setCreditsAdded(res.credits)
          setModalStep('success')
          refreshUser()
        }
      } catch {
        // ignore polling errors
      }
    }, 3000)
  }, [stopPolling, refreshUser])

  const handleSelect = (tariff: Tariff) => {
    if (tariff.price === 0) {
      navigate('/register')
      return
    }
    setSelectedTariff(tariff)
    setModalStep('confirm')
  }

  const handlePay = async () => {
    if (!selectedTariff || !user) return

    setModalStep('loading')
    setErrorMsg('')

    try {
      const res = await api.request<PaymentCreateResponse>('/api/v1/payments/create', {
        method: 'POST',
        body: {
          amount: selectedTariff.price,
          credits: selectedTariff.credits,
          email: user.email || 'noemail@placeholder.com',
          telegram_id: user.telegram_id || null,
          currency: 'RUB'
        }
      })

      setPaymentUrl(res.payment_url)
      setModalStep('qr')
      startPolling(res.order_id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка создания платежа'
      setErrorMsg(msg)
      setModalStep('error')
    }
  }

  const closeModal = () => {
    stopPolling()
    setSelectedTariff(null)
    setPaymentUrl('')
    setErrorMsg('')
    setModalStep('confirm')
  }

  const bestIndex = tariffs.length >= 3 ? 2 : -1

  if (loading) {
    return (
      <div className="tariffs-page">
        <div className="tariffs-loading">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="tariffs-page">
      <div className="tariffs-header">
        <h1 className="tariffs-title">Тарифы</h1>
        <p className="tariffs-subtitle">Выберите подходящий тариф и получите токены для работы с нейросетями</p>
      </div>

      <div className="tariffs-grid">
        {tariffs.map((t, idx) => {
          const isBest = idx === bestIndex
          const isFree = t.price === 0
          const descLines = t.description ? t.description.split('\n').filter(l => l.trim()) : []

          return (
            <div
              key={t.id}
              className={`tariff-card ${isBest ? 'best' : ''} ${selectedTariff?.id === t.id ? 'selected' : ''}`}
            >
              {isBest && <div className="tariff-badge">Популярный</div>}

              <div className="tariff-name">{t.name}</div>

              <div className="tariff-price-block">
                <span className="tariff-price">{formatPrice(t.price)}</span>
                {!isFree && <span className="tariff-period">разовый платёж</span>}
              </div>

              <div className="tariff-credits-block">
                <span className="tariff-credits-value">{formatCredits(t.credits)}</span>
                {t.credits > 0 && <span className="tariff-credits-label">токенов</span>}
              </div>

              <div className="tariff-divider" />

              <ul className="tariff-features">
                {descLines.map((line, i) => {
                  const clean = line.replace(/^[—\-–]\s*/, '').trim()
                  if (!clean) return null
                  return (
                    <li key={i} className="tariff-feature">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{clean}</span>
                    </li>
                  )
                })}

                {t.items.map((item, i) => (
                  <li key={`item-${i}`} className="tariff-feature">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>
                      {item.custom_description
                        ? item.custom_description
                        : item.model_id
                          ? `${item.adapter_name} / ${item.model_id}`
                          : item.adapter_name || item.item_type}
                      {item.credits_override != null && (
                        <span className="tariff-feature-credits"> — {item.credits_override} ток.</span>
                      )}
                    </span>
                  </li>
                ))}

                {descLines.length === 0 && t.items.length === 0 && (
                  <li className="tariff-feature">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Доступ ко всем нейросетям</span>
                  </li>
                )}
              </ul>

              <button
                className={`tariff-btn ${isFree ? 'free' : ''} ${isBest ? 'best' : ''}`}
                onClick={() => handleSelect(t)}
              >
                {isFree ? 'Начать бесплатно' : 'Выбрать'}
              </button>
            </div>
          )
        })}
      </div>

      {!user && (
        <div className="tariffs-login-hint">
          Уже есть аккаунт? <span onClick={() => navigate('/login')}>Войти</span>
        </div>
      )}

      {selectedTariff && (
        <div className="pay-overlay" onClick={closeModal}>
          <div className="pay-modal" onClick={e => e.stopPropagation()}>
            <button className="pay-modal-close" onClick={closeModal}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {!user && (
              <>
                <div className="pay-modal-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6c7ae0" strokeWidth="1.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h2 className="pay-modal-title">Войдите для оплаты</h2>
                <p className="pay-modal-text">Для оформления заказа необходимо авторизоваться</p>
                <div className="pay-modal-actions">
                  <button className="pay-modal-btn primary" onClick={() => navigate('/login')}>Войти</button>
                  <button className="pay-modal-btn secondary" onClick={() => navigate('/register')}>Регистрация</button>
                </div>
              </>
            )}

            {user && modalStep === 'confirm' && (
              <>
                <h2 className="pay-modal-title">Оформление заказа</h2>
                <div className="pay-order-info">
                  <div className="pay-order-row">
                    <span>Тариф</span>
                    <span className="pay-order-value">{selectedTariff.name}</span>
                  </div>
                  <div className="pay-order-row">
                    <span>Токены</span>
                    <span className="pay-order-value">{formatCredits(selectedTariff.credits)}</span>
                  </div>
                  <div className="pay-order-row total">
                    <span>К оплате</span>
                    <span className="pay-order-value">{formatPrice(selectedTariff.price)}</span>
                  </div>
                </div>
                <div className="pay-method">
                  <div className="pay-method-item active">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    <div>
                      <div className="pay-method-name">OnlyPay - Оплата через СБП</div>
                      <div className="pay-method-desc">Система быстрых платежей — мгновенное зачисление</div>
                    </div>
                  </div>
                </div>
                <button className="pay-modal-btn primary full" onClick={handlePay}>
                  Оплатить {formatPrice(selectedTariff.price)}
                </button>
              </>
            )}

            {user && modalStep === 'loading' && (
              <div className="pay-loading">
                <div className="spinner" />
                <p>Переход к оплате...</p>
              </div>
            )}

            {user && modalStep === 'qr' && (
              <>
                <h2 className="pay-modal-title">Оплата через СБП</h2>
                <h2 className="pay-modal-title">OnlyPay, Kassa.ai</h2>
                <div className="pay-qr-amount">{formatPrice(selectedTariff.price)}</div>
                <p className="pay-qr-hint">Отсканируйте QR-код в приложении вашего банка</p>
                <div className="pay-qr-wrapper">
                  <QRCodeSVG
                    value={paymentUrl}
                    size={220}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                    includeMargin={true}
                  />
                </div>
                <div className="pay-qr-status">
                  <div className="pay-qr-spinner" />
                  <span>Ожидание оплаты...</span>
                </div>
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pay-modal-btn primary full"
                >
                  📱 Открыть на телефоне
                </a>
                <button className="pay-modal-btn secondary full" onClick={closeModal}>Отменить</button>
              </>
            )}

            {user && modalStep === 'success' && (
              <>
                <div className="pay-modal-icon success">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="8 12 11 15 16 9" />
                  </svg>
                </div>
                <h2 className="pay-modal-title">Оплата получена!</h2>
                <p className="pay-modal-text">
                  На ваш баланс начислено <strong>{formatCredits(creditsAdded)}</strong> токенов
                </p>
                <button className="pay-modal-btn primary full" onClick={() => { closeModal(); navigate('/account') }}>
                  Перейти в аккаунт
                </button>
              </>
            )}

            {user && modalStep === 'error' && (
              <>
                <div className="pay-modal-icon error">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <h2 className="pay-modal-title">Ошибка</h2>
                <p className="pay-modal-text">{errorMsg}</p>
                <button className="pay-modal-btn primary full" onClick={() => setModalStep('confirm')}>Попробовать снова</button>
                <button className="pay-modal-btn secondary full" onClick={closeModal}>Закрыть</button>
              </>
            )}

            {user && modalStep === 'timeout' && (
              <>
                <div className="pay-modal-icon error">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h2 className="pay-modal-title">Время ожидания истекло</h2>
                <p className="pay-modal-text">Платёж не был получен в течение 5 минут. Если вы оплатили — токены будут начислены автоматически.</p>
                <button className="pay-modal-btn primary full" onClick={() => setModalStep('confirm')}>Попробовать снова</button>
                <button className="pay-modal-btn secondary full" onClick={closeModal}>Закрыть</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}