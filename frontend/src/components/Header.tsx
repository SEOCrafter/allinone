import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface Props {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: Props) {
  const { user, logout } = useAuth()

  return (
    <header className="header">
      <div className="header-left">
        <button className="header-menu-btn" onClick={onMenuClick}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
      </div>
      <div className="header-right">
        {user ? (
          <div className="header-user">
            <span className="header-credits">
              <svg viewBox="0 0 24 24" fill="#facc15" width="16" height="16">
                <circle cx="12" cy="12" r="10"/>
              </svg>
              {(user.credits_balance ?? 0).toFixed(0)}
            </span>
            <span className="header-name">{user.email}</span>
            <button className="btn-logout" onClick={logout}>Выйти</button>
          </div>
        ) : (
          <NavLink to="/login" className="btn btn-login">Войти</NavLink>
        )}
      </div>
    </header>
  )
}