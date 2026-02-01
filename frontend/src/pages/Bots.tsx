import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProviders, type Brand, type BrandModel } from '../hooks/useProviders'

const TYPE_LABELS: Record<string, string> = {
  text: 'Текст',
  image: 'Изобр.',
  video: 'Видео',
}

const CATEGORIES = [
  { id: 'all', name: 'Все', icon: '🔥' },
  { id: 'text', name: 'Текст', icon: '💬' },
  { id: 'image', name: 'Изображения', icon: '🖼️' },
  { id: 'video', name: 'Видео', icon: '🎬' },
]

function modelsWord(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m100 >= 11 && m100 <= 19) return 'моделей'
  if (m10 === 1) return 'модель'
  if (m10 >= 2 && m10 <= 4) return 'модели'
  return 'моделей'
}

function formatPrice(price: number | null): string {
  if (price === null) return '—'
  if (price === 0) return 'Бесплатно'
  return `${price} кр.`
}

export default function Bots() {
  const { brands, loading, error } = useProviders()
  const [category, setCategory] = useState('all')
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const filtered = brands
    .filter(b => category === 'all' || b.category === category || b.category === 'mixed')
    .filter(b =>
      !search ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.models.some(m => m.displayName.toLowerCase().includes(search.toLowerCase()))
    )

  const activeBrand = brands.find(b => b.id === selectedBrand)

  const handleModelClick = (model: BrandModel) => {
    if (model.type === 'text') {
      navigate('/chat', { state: { provider: model.adapter, model: model.id } })
    } else {
      navigate('/generate', { state: { provider: model.adapter, model: model.id } })
    }
  }

  if (loading) {
    return (
      <div className="main-area">
        <div className="bots-status">Загрузка нейросетей...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="main-area">
        <div className="bots-status bots-error">Ошибка: {error}</div>
      </div>
    )
  }

  if (activeBrand) {
    return (
      <div className="main-area">
        <div className="brand-detail">
          <button className="brand-back" onClick={() => setSelectedBrand(null)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Все нейросети
          </button>

          <div className="brand-detail-header">
            {activeBrand.icon && (
              <img src={activeBrand.icon} alt={activeBrand.name} className="brand-detail-icon" draggable={false} />
            )}
            <div>
              <h2 className="brand-detail-name">{activeBrand.name}</h2>
              <p className="brand-detail-desc">{activeBrand.description}</p>
            </div>
          </div>

          <div className="brand-models-list">
            {activeBrand.models.map(model => (
              <button
                key={`${model.adapter}:${model.id}`}
                className="brand-model-row"
                onClick={() => handleModelClick(model)}
              >
                <div className="brand-model-info">
                  <span className="brand-model-name">{model.displayName}</span>
                  <span className="brand-model-type">{TYPE_LABELS[model.type] || model.type}</span>
                </div>
                <span className={`brand-model-price ${!model.creditsPrice ? 'free' : ''}`}>
                  {formatPrice(model.creditsPrice)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="main-area">
      <div className="section-header" style={{ marginBottom: 16 }}>
        <h2 className="section-title">Все нейросети</h2>
      </div>

      <div className="bots-filters">
        <div className="bots-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Поиск нейросети..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="bots-categories">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`category-btn ${category === cat.id ? 'active' : ''}`}
              onClick={() => setCategory(cat.id)}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="brands-grid">
        {filtered.map(brand => (
          <div key={brand.id} className="brand-card" onClick={() => setSelectedBrand(brand.id)}>
            <div className="brand-card-icon">
              {brand.icon ? (
                <img src={brand.icon} alt={brand.name} draggable={false} />
              ) : (
                <span className="brand-card-icon-fallback">{brand.name.charAt(0)}</span>
              )}
            </div>
            <div className="brand-card-body">
              <span className="brand-card-name">{brand.name}</span>
              <span className="brand-card-desc">{brand.description}</span>
            </div>
            <div className="brand-card-footer">
              <span className="brand-card-count">
                {brand.modelCount} {modelsWord(brand.modelCount)}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}