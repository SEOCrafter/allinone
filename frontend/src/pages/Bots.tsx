import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Model } from '../data/models'
import { CATEGORIES, getModelsByCategory } from '../data/models'
import BotCard from '../components/BotCard'

interface Props {
  onSelectModel: (model: Model) => void
}

export default function Bots({ onSelectModel }: Props) {
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const filtered = getModelsByCategory(category).filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.description.toLowerCase().includes(search.toLowerCase())
  )

  const handleModelClick = (model: Model) => {
    onSelectModel(model)
    navigate('/chat')
  }

  return (
    <div className="main-area">
      <section className="bots-page">
        <div className="bots-page-header">
          <h1 className="bots-page-title">Нейросети</h1>
          <p className="bots-page-subtitle">Здесь собраны все нейросети из нашей коллекции. Напишите, какую задачу нужно решить и умный поиск подберёт самую подходящую нейронку.</p>
        </div>

        <div className="bots-search-wrapper">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            className="bots-search"
            placeholder="Поиск нейросети"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="bots-categories">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`category-chip ${category === cat.id ? 'active' : ''}`}
              onClick={() => setCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <h2 className="bots-section-title">
          {category === 'all' && 'Все нейросети'}
          {category === 'text' && 'Текстовые нейросети'}
          {category === 'image' && 'Генерация изображений'}
          {category === 'video' && 'Генерация видео'}
        </h2>

        <div className="bots-grid">
          {filtered.map((model) => (
            <BotCard key={model.id} model={model} onClick={() => handleModelClick(model)} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="bots-empty">
            <p>Нейросети не найдены</p>
          </div>
        )}
      </section>
    </div>
  )
}