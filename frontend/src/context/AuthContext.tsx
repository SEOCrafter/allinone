import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../api/auth'
import { getProfile, logout as apiLogout, isAuthenticated } from '../api/auth'
interface AuthContextType {
  user: User | null
  loading: boolean
  login: (user: User) => void
  logout: () => void
  updateCredits: (credits: number) => void
  refreshUser: () => Promise<void>
}
const AuthContext = createContext<AuthContextType | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (isAuthenticated()) {
      getProfile()
        .then(setUser)
        .catch(() => {
          apiLogout()
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])
  const login = (user: User) => setUser(user)
  const logout = () => {
    apiLogout()
    setUser(null)
  }
  const updateCredits = (credits: number) => {
    if (user) {
      setUser({ ...user, credits_balance: credits })
    }
  }
  const refreshUser = useCallback(async () => {
    try {
      const profile = await getProfile()
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