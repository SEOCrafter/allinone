import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ModelSelector from './ModelSelector'
import type { Model } from '../data/models'

interface Props {
  onMenuClick: () => void
  selectedModel: Model | null
  onSelectModel: (model: Model | null) => void
}

export default function Header({ onMenuClick, selectedModel, onSelectModel }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  const handleAccountClick = () => {
    if (user) {
      navigate('/account')
    } else {
      navigate('/login')
    }
  }

  const handleSelectModel = (model: Model) => {
    onSelectModel(model)
    if (model.category === 'text') {
      navigate('/chat')
    } else {
      navigate('/generate')
    }
  }

  return (
    <header className="header">
      <div className="header-left">
        <button className="header-menu-btn" onClick={onMenuClick}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <div className="header-model-selector">
          <ModelSelector selected={selectedModel} onSelect={handleSelectModel} />
        </div>
      </div>

      <div className="header-right">
        <div className="header-theme-toggle">
          <button
            className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
            title="Тёмная тема"
          >
            <img src="/icons/moon.svg" alt="" width="18" height="18" />
          </button>
          <button
            className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
            title="Светлая тема"
          >
            <img src="/icons/sun.svg" alt="" width="18" height="18" />
          </button>
        </div>

        <div className="header-actions">
          <div className="header-credits">
            <span className="credits-value">{user ? (user.credits_balance ?? 0).toFixed(0) : '0'}</span>
            <img src="/icons/token.svg" alt="" width="18" height="18" />
          </div>
          <button className="header-icon-btn" title="Уведомления">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="notification-dot"></span>
          </button>
          <button className="header-icon-btn header-account-btn" onClick={handleAccountClick} title={user ? 'Аккаунт' : 'Войти'}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}