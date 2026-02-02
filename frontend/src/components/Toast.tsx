import { useState, useEffect, useCallback } from 'react'

interface ToastMessage {
  id: number
  text: string
  type: 'success' | 'info' | 'error'
}

let toastId = 0
let addToastGlobal: ((text: string, type?: 'success' | 'info' | 'error') => void) | null = null

export function showToast(text: string, type: 'success' | 'info' | 'error' = 'success') {
  if (addToastGlobal) addToastGlobal(text, type)
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, text, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }, [])

  useEffect(() => {
    addToastGlobal = addToast
    return () => { addToastGlobal = null }
  }, [addToast])

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="8 12 11 15 16 9" />
            </svg>
          )}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}