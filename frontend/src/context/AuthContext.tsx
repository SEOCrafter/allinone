import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../api/auth'
import { getProfile, logout as apiLogout, isAuthenticated } from '../api/auth'
import { showToast } from '../components/Toast'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (user: User) => void
  logout: () => void
  updateCredits: (credits: number) => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const POLL_INTERVAL = 15000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const prevBalanceRef = useRef<number | null>(null)

  useEffect(() => {
    if (isAuthenticated()) {
      getProfile()
        .then(u => {
          setUser(u)
          prevBalanceRef.current = u.credits_balance
        })
        .catch(() => {
          apiLogout()
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const interval = setInterval(async () => {
      try {
        const profile = await getProfile()
        const oldBalance = prevBalanceRef.current ?? 0
        const newBalance = profile.credits_balance
        if (newBalance > oldBalance) {
          const diff = Math.round(newBalance - oldBalance)
          showToast(`Баланс пополнен на ${diff.toLocaleString('ru-RU')} токенов`)
        }
        prevBalanceRef.current = newBalance
        setUser(profile)
      } catch {
        // ignore
      }
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [user?.id])

  const login = (u: User) => {
    setUser(u)
    prevBalanceRef.current = u.credits_balance
  }

  const logout = () => {
    apiLogout()
    setUser(null)
    prevBalanceRef.current = null
  }

  const updateCredits = (credits: number) => {
    if (user) {
      prevBalanceRef.current = credits
      setUser({ ...user, credits_balance: credits })
    }
  }

  const refreshUser = useCallback(async () => {
    try {
      const profile = await getProfile()
      prevBalanceRef.current = profile.credits_balance
      setUser(profile)
    } catch {
      // ignore
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateCredits, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}