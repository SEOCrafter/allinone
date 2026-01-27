import { NavLink } from 'react-router-dom'
import ModelSelector from './ModelSelector'
import type { Model } from '../data/models'

interface Props {
  selectedModel: Model | null
  onSelectModel: (model: Model) => void
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ selectedModel, onSelectModel, isOpen, onClose }: Props) {
  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <NavLink to="/" className="logo" onClick={onClose}>
            <svg viewBox="0 0 33 36" fill="none">
              <path fill="currentColor" d="M10.94 11.6C12.76 9.05 14.2 4.4 15.12.67c.23-.92 2-.9 2.2.03.83 3.53 2.19 7.97 4.28 10.88 1.38 1.94 3.44 2.93 5.4 3.53.79.25.68 1.11-.15 1.11h-4.53c-.3 0-.58-.09-.8-.27-.76-.59-2.55-2.05-3.41-3.38a11 11 0 0 1-1.13-2.59c-.2-.62-1.32-.67-1.56-.06-.64 1.6-1.6 3.58-2.83 4.76-1.26 1.23-3.38 2.17-5.02 2.77-.6.22-.6 1.24 0 1.45 1.64.59 3.76 1.51 5.02 2.72a13 13 0 0 1 2.6 4.23c.27.63 1.74.58 1.99-.06a12 12 0 0 1 3.37-4.75c.15-.13.15-.36 0-.48a13 13 0 0 0-2.97-1.44c-.32-.12-.24-.73.1-.73l13.2-.04c1.56 0 1.67 1.34.16 1.68-4 .9-7.43 2.2-9.47 5.04-2 2.79-3.34 6.97-4.16 10.43-.23.94-2.13.95-2.35.01-.9-3.74-2.29-8.24-4.15-10.44-2.28-2.7-6.44-4.34-10.2-5.32-.96-.25-1-2.66-.03-2.91 4.08-1.07 8.57-2.72 10.23-5.04"/>
            </svg>
            <span>AI Агрегатор</span>
          </NavLink>
          <button className="sidebar-toggle" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        </div>

        <div className="sidebar-model-selector">
          <ModelSelector selected={selectedModel} onSelect={onSelectModel} />
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/chat" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>Новый чат</span>
          </NavLink>
          <NavLink to="/files" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
              <path d="M14 2v6h6" fill="none" stroke="white" strokeWidth="1"/>
            </svg>
            <span>Мои файлы</span>
          </NavLink>
          <NavLink to="/bots" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <circle cx="17.5" cy="17.5" r="3.5"/>
            </svg>
            <span>Все нейросети</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <NavLink to="/login" className="btn btn-primary" onClick={onClose}>Войти</NavLink>
          <button className="btn-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </button>
        </div>
      </aside>
    </>
  )
}