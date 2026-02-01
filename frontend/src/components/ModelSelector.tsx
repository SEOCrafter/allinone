import { useState, useRef, useEffect } from 'react'
import type { Model } from '../data/models'
import { CATEGORIES, getModelsByCategory } from '../data/models'
import ModelIcon from './ModelIcon'

interface Props {
  selected: Model | null
  onSelect: (model: Model) => void
}

export default function ModelSelector({ selected, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = getModelsByCategory(category).filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.description.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce((acc, model) => {
    const cat = model.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(model)
    return acc
  }, {} as Record<string, Model[]>)

  const categoryLabels: Record<string, string> = {
    text: '💬 ТЕКСТОВЫЕ',
    image: '🖼️ ИЗОБРАЖЕНИЯ',
    video: '🎬 ВИДЕО',
  }

  const renderModelItem = (model: Model) => (
    <button
      key={model.id}
      className={`model-item ${selected?.id === model.id ? 'active' : ''}`}
      onClick={() => { onSelect(model); setOpen(false) }}
    >
      <span className="model-icon">
        <ModelIcon icon={model.icon} name={model.name} size={20} />
      </span>
      <div className="model-info">
        <span className="model-item-name">{model.name}</span>
        <span className="model-item-desc">{model.description}</span>
      </div>
      <span className="model-cost">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#facc15"><circle cx="12" cy="12" r="10"/></svg>
        {model.cost}
      </span>
    </button>
  )

  return (
    <div className="model-selector" ref={ref}>
      <button className="model-selector-btn" onClick={() => setOpen(!open)}>
        {selected ? (
          <>
            <span className="model-icon">
              <ModelIcon icon={selected.icon} name={selected.name} size={20} />
            </span>
            <span className="model-name">{selected.name}</span>
          </>
        ) : (
          <>
            <span className="model-icon model-icon-placeholder">?</span>
            <span className="model-name">Выбрать нейросеть</span>
          </>
        )}
        <svg className={`chevron ${open ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div className="model-dropdown">
          <div className="model-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Поиск нейросети"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="model-categories">
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

          <div className="model-list">
            {category === 'all' ? (
              Object.entries(grouped).map(([cat, models]) => (
                <div key={cat} className="model-group">
                  <div className="model-group-title">
                    {categoryLabels[cat] || cat}
                  </div>
                  {models.map(renderModelItem)}
                </div>
              ))
            ) : (
              filtered.map(renderModelItem)
            )}
          </div>

          <button className="model-all-link" onClick={() => setOpen(false)}>
            Все нейросети и возможности
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}