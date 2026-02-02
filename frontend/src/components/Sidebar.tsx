import { useState } from 'react'
import { NavLink } from 'react-router-dom'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {collapsed ? (
            <button className="logo-expand-btn" onClick={() => setCollapsed(false)} title="Развернуть меню">
              <img src="/icons/logo.svg" alt="" className="logo-icon" />
              <svg className="expand-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M9 3v18"/>
              </svg>
            </button>
          ) : (
            <>
              <NavLink to="/" className="logo" onClick={onClose}>
                <img src="/icons/logo.svg" alt="" className="logo-icon" />
                <span className="logo-text">Umnik.AI</span>
              </NavLink>
              <button className="sidebar-toggle" onClick={() => setCollapsed(true)} title="Свернуть">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M9 3v18"/>
                </svg>
              </button>
            </>
          )}
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/chat" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose} title="Новый чат">
            <img src="/icons/pencil.svg" alt="" className="nav-icon" />
            <span className="nav-label">Новый чат</span>
          </NavLink>
          <NavLink to="/files" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose} title="Мои файлы">
            <img src="/icons/myfiles.svg" alt="" className="nav-icon" />
            <span className="nav-label">Мои файлы</span>
          </NavLink>
          <NavLink to="/bots" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose} title="Все нейросети">
            <img src="/icons/all.svg" alt="" className="nav-icon" />
            <span className="nav-label">Все нейросети</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          {collapsed ? (
            <NavLink to="/tarifs" className="sidebar-token-btn" onClick={onClose} title="Выбрать тариф">
              <img src="/icons/token.svg" alt="" width="22" height="22" />
            </NavLink>
          ) : (
            <NavLink to="/tarifs" className="sidebar-tariff-btn" onClick={onClose}>
              Выбрать тариф
            </NavLink>
          )}
        </div>
      </aside>
    </>
  )
}