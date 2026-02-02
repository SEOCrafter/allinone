import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

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

function formatPrice(price: number): string {
  if (price === 0) return 'Бесплатно'
  return price.toLocaleString('ru-RU') + ' ₽'
}

function formatCredits(credits: number): string {
  if (credits === 0) return '—'
  return credits.toLocaleString('ru-RU')
}

export default function Tariffs() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [loading, setLoading] = useState(true)
  const [showAuth, setShowAuth] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null)
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadTariffs()
  }, [])

  const loadTariffs = async () => {
    try {
      const res: Tariff[] = await api.request('/api/v1/tariffs')
      setTariffs(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (tariff: Tariff) => {
    if (tariff.price === 0) {
      if (user) return
      navigate('/register')
      return
    }
    setSelectedTariff(tariff)
    if (!user) {
      setShowAuth(true)
    } else {
      setShowCheckout(true)
    }
  }

  const handlePay = async () => {
    if (!selectedTariff) return
    setProcessing(true)
    setTimeout(() => {
      setProcessing(false)
      setSuccess(true)
    }, 2000)
  }

  const closeModals = () => {
    setShowAuth(false)
    setShowCheckout(false)
    setSelectedTariff(null)
    setSuccess(false)
    setProcessing(false)
  }

  const bestIndex = tariffs.length >= 3 ? 2 : -1

  if (loading) {
    return (
      <div className="tariffs-page">
        <div className="tariffs-loading"><div className="spinner" /></div>
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
            <div key={t.id} className={`tariff-card ${isBest ? 'best' : ''}`}>
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      <span>{clean}</span>
                    </li>
                  )
                })}
                {t.items.map((item, i) => (
                  <li key={`item-${i}`} className="tariff-feature">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    <span>
                      {item.custom_description || (item.model_id ? `${item.adapter_name} / ${item.model_id}` : item.adapter_name || item.item_type)}
                      {item.credits_override != null && <span className="tariff-feature-credits"> — {item.credits_override} ток.</span>}
                    </span>
                  </li>
                ))}
                {descLines.length === 0 && t.items.length === 0 && (
                  <li className="tariff-feature">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    <span>Доступ ко всем нейросетям</span>
                  </li>
                )}
              </ul>
              <button className={`tariff-btn ${isFree ? 'free' : ''} ${isBest ? 'best' : ''}`} onClick={() => handleSelect(t)}>
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

      {showAuth && selectedTariff && (
        <div className="tariff-modal-overlay" onClick={closeModals}>
          <div className="tariff-modal" onClick={e => e.stopPropagation()}>
            <button className="tariff-modal-close" onClick={closeModals}>✕</button>
            <div className="tariff-modal-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="tariff-modal-title">Войдите для оплаты</div>
            <div className="tariff-modal-desc">
              Для покупки тарифа «{selectedTariff.name}» необходимо войти в аккаунт или зарегистрироваться
            </div>
            <div className="tariff-modal-selected">
              <span>{selectedTariff.name}</span>
              <span>{formatPrice(selectedTariff.price)}</span>
            </div>
            <button className="tariff-modal-btn primary" onClick={() => { closeModals(); navigate('/login') }}>
              Войти в аккаунт
            </button>
            <button className="tariff-modal-btn secondary" onClick={() => { closeModals(); navigate('/register') }}>
              Зарегистрироваться
            </button>
          </div>
        </div>
      )}

      {showCheckout && selectedTariff && !success && (
        <div className="tariff-modal-overlay" onClick={closeModals}>
          <div className="tariff-modal checkout" onClick={e => e.stopPropagation()}>
            <button className="tariff-modal-close" onClick={closeModals}>✕</button>
            <div className="tariff-modal-title">Оформление заказа</div>

            <div className="checkout-summary">
              <div className="checkout-row">
                <span>Тариф</span>
                <span className="checkout-value">{selectedTariff.name}</span>
              </div>
              <div className="checkout-row">
                <span>Токены</span>
                <span className="checkout-value">{formatCredits(selectedTariff.credits)}</span>
              </div>
              <div className="checkout-row total">
                <span>К оплате</span>
                <span className="checkout-value">{formatPrice(selectedTariff.price)}</span>
              </div>
            </div>

            <div className="checkout-method-info">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M2 12h20" /><circle cx="12" cy="12" r="10" />
              </svg>
              <div>
                <div className="checkout-method-name">Оплата через СБП</div>
                <div className="checkout-method-desc">Система быстрых платежей — мгновенное зачисление</div>
              </div>
            </div>

            <button className="tariff-modal-btn primary" onClick={handlePay} disabled={processing}>
              {processing ? 'Обработка...' : `Оплатить ${formatPrice(selectedTariff.price)}`}
            </button>
            <div className="checkout-note">Безопасная оплата через Систему быстрых платежей</div>
          </div>
        </div>
      )}

      {showCheckout && success && selectedTariff && (
        <div className="tariff-modal-overlay" onClick={closeModals}>
          <div className="tariff-modal" onClick={e => e.stopPropagation()}>
            <button className="tariff-modal-close" onClick={closeModals}>✕</button>
            <div className="tariff-modal-icon success">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="16 8 10 16 7 13" /></svg>
            </div>
            <div className="tariff-modal-title">Платёж отправлен!</div>
            <div className="tariff-modal-desc">
              Тариф «{selectedTariff.name}» будет активирован после подтверждения оплаты. Токены поступят на ваш баланс автоматически.
            </div>
            <button className="tariff-modal-btn primary" onClick={() => { closeModals(); navigate('/account') }}>
              Перейти в аккаунт
            </button>
          </div>
        </div>
      )}
    </div>
  )
}