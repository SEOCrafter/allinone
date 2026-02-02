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
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
    if (tariff.price === 0) return
    setSelectedId(tariff.id)
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
              className={`tariff-card ${isBest ? 'best' : ''} ${selectedId === t.id ? 'selected' : ''}`}
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
                onClick={() => isFree ? navigate('/register') : handleSelect(t)}
              >
                {isFree ? 'Начать бесплатно' : selectedId === t.id ? 'Выбрано ✓' : 'Выбрать'}
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
    </div>
  )
}