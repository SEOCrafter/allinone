import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProviders, brandModelToModel } from '../hooks/useProviders'
import type { Brand } from '../hooks/useProviders'
import type { Model } from '../data/models'
import ModelIcon from '../components/ModelIcon'

interface Props {
  selectedModel: Model | null
  onSelectModel: (model: Model) => void
}

function declModels(n: number): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return 'моделей'
  if (last > 1 && last < 5) return 'модели'
  if (last === 1) return 'модель'
  return 'моделей'
}

export default function Home({ selectedModel, onSelectModel }: Props) {
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const { brands, allModels, loading } = useProviders()
  const topBrands = brands.slice(0, 5)
  const popularBrands = brands.slice(0, 9)
  const totalModels = allModels.length

  const handleSend = () => {
    if (!message.trim()) return
    navigate('/chat', { state: { message } })
  }

  const handleBrandClick = (brand: Brand) => {
    if (brand.models.length === 0) return
    const model = brandModelToModel(brand, brand.models[0])
    onSelectModel(model)
    if (model.category === 'text') {
      navigate('/chat')
    } else {
      navigate('/generate')
    }
  }

  return (
    <div className="main-area">
      <section className="hero-section">
        <h1 className="hero-title">
          Простой старт в мир <span>нейросетей</span>
        </h1>
        <p className="hero-subtitle">Без VPN, зарубежных карт и сложностей</p>

        <div className="chat-input-wrapper">
          <textarea
            className="chat-input"
            placeholder="Что хочешь узнать или обсудить?"
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          />
          <div className="chat-input-actions">
            <button className="attach-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <button className="send-btn" disabled={!message.trim()} onClick={handleSend}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="bot-selector">
          {topBrands.map(brand => {
            const firstModel = brand.models[0] ? brandModelToModel(brand, brand.models[0]) : null
            return (
              <button
                key={brand.id}
                className={`bot-chip ${firstModel && selectedModel?.id === firstModel.id ? 'active' : ''}`}
                onClick={() => handleBrandClick(brand)}
              >
                <span className="bot-chip-icon">
                  <ModelIcon icon={brand.icon} name={brand.name} size={24} />
                </span>
              </button>
            )
          })}
          <button className="bot-chip bot-chip-all" onClick={() => navigate('/bots')}>
            <span className="bot-count">{totalModels}+</span>
            <span>Все нейронки</span>
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">Популярные нейросети</h2>
            <p className="section-subtitle">Все модели доступны по одной подписке</p>
          </div>
          <button className="section-link" onClick={() => navigate('/bots')}>Все нейросети</button>
        </div>

        <div className="brands-grid">
          {loading ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              Загрузка...
            </div>
          ) : (
            popularBrands.map(brand => (
              <div key={brand.id} className="brand-card" onClick={() => handleBrandClick(brand)}>
                <div className="brand-card-header">
                  <img
                    className="brand-card-icon"
                    src={brand.icon}
                    alt={brand.name}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
                <div className="brand-card-name">{brand.name}</div>
                <div className="brand-card-desc">{brand.description}</div>
                <div className="brand-card-footer">
                  <span className="brand-card-count">{brand.modelCount} {declModels(brand.modelCount)}</span>
                  <span className="brand-card-arrow">›</span>
                </div>
              </div>
            ))
          )}
        </div>

        <button className="show-more-btn" onClick={() => navigate('/bots')}>Показать все нейросети</button>
      </section>

      <footer className="footer">
        <div className="footer-cta">
          <h3 className="footer-cta-title">Следи за нами в Telegram и VK</h3>
          <p className="footer-cta-subtitle">Будь в тренде и учись работать с AI быстрее</p>
          <div className="footer-cta-links">
            <a href="#" className="footer-cta-link">Telegram</a>
            <a href="#" className="footer-cta-link">Вконтакте</a>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-logo">
            <svg viewBox="0 0 33 36" fill="none" width="20" height="20">
              <path fill="currentColor" d="M10.94 11.6C12.76 9.05 14.2 4.4 15.12.67c.23-.92 2-.9 2.2.03.83 3.53 2.19 7.97 4.28 10.88 1.38 1.94 3.44 2.93 5.4 3.53.79.25.68 1.11-.15 1.11h-4.53c-.3 0-.58-.09-.8-.27-.76-.59-2.55-2.05-3.41-3.38a11 11 0 0 1-1.13-2.59c-.2-.62-1.32-.67-1.56-.06-.64 1.6-1.6 3.58-2.83 4.76-1.26 1.23-3.38 2.17-5.02 2.77-.6.22-.6 1.24 0 1.45 1.64.59 3.76 1.51 5.02 2.72a13 13 0 0 1 2.6 4.23c.27.63 1.74.58 1.99-.06a12 12 0 0 1 3.37-4.75c.15-.13.15-.36 0-.48a13 13 0 0 0-2.97-1.44c-.32-.12-.24-.73.1-.73l13.2-.04c1.56 0 1.67 1.34.16 1.68-4 .9-7.43 2.2-9.47 5.04-2 2.79-3.34 6.97-4.16 10.43-.23.94-2.13.95-2.35.01-.9-3.74-2.29-8.24-4.15-10.44-2.28-2.7-6.44-4.34-10.2-5.32-.96-.25-1-2.66-.03-2.91 4.08-1.07 8.57-2.72 10.23-5.04"/>
            </svg>
            <span>AI Агрегатор</span>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Пользовательское соглашение</a>
          </div>
        </div>
      </footer>
    </div>
  )
}