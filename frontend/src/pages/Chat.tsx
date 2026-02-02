import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import type { Model } from '../data/models'
import { sendMessage } from '../api/chat'
import { useAuth } from '../context/AuthContext'
import ModelIcon from '../components/ModelIcon'

interface Message {
  role: 'user' | 'assistant'
  content: string
  modelIcon?: string
  modelName?: string
}

interface Props {
  selectedModel: Model | null
}

export default function Chat({ selectedModel }: Props) {
  const location = useLocation()
  const { user, updateCredits } = useAuth()
  const initialMessage = (location.state as { message?: string })?.message || ''
  const [input, setInput] = useState(initialMessage)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const activeModelRef = useRef<Model | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    activeModelRef.current = selectedModel
  }, [selectedModel])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    if (!selectedModel) {
      setError('Выберите нейросеть')
      return
    }
    if (selectedModel.category !== 'text') {
      setError('Эта модель не поддерживает текстовый чат')
      return
    }
    if (!user) {
      setError('Войдите в аккаунт для отправки сообщений')
      return
    }

    const currentModel = selectedModel
    const userMessage: Message = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setError(null)
    setIsLoading(true)

    try {
      const response = await sendMessage({
        message: input.trim(),
        provider: currentModel.provider,
        model: currentModel.backendModel || undefined,
      })

      if (response.ok && response.content) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.content!,
          modelIcon: currentModel.icon,
          modelName: currentModel.name,
        }])
        if (response.credits_spent && user) {
          updateCredits((user.credits_balance ?? 0) - response.credits_spent)
        }
      } else {
        setError(response.error || 'Ошибка получения ответа')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const clearChat = () => {
    setMessages([])
    setError(null)
  }

  const credits = user?.credits_balance ?? 0

  return (
    <div className="chat-page">
      <div className="chat-header-bar">
        <div className="chat-model-info">
          {selectedModel && (
            <>
              <span className="chat-model-icon">
                <ModelIcon icon={selectedModel.icon} name={selectedModel.name} size={32} />
              </span>
              <span className="chat-model-name">{selectedModel.name}</span>
              <span className="chat-model-cost">
                <img src="/icons/token.svg" alt="" width="14" height="14" />
                {selectedModel.cost} / сообщение
              </span>
            </>
          )}
        </div>
        <div className="chat-header-actions">
          {user && (
            <span className="user-credits">
              Баланс: {credits.toFixed(2)} кредитов
            </span>
          )}
          {messages.length > 0 && (
            <button className="clear-chat-btn" onClick={clearChat}>
              Очистить чат
            </button>
          )}
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <h2>Начните диалог</h2>
            <p>Выберите нейросеть в меню слева и напишите ваш первый запрос</p>
            {selectedModel && (
              <div className="chat-selected-model">
                <span>Выбрана:</span>
                <span className="model-badge">
                  <ModelIcon icon={selectedModel.icon} name={selectedModel.name} size={20} />
                  {selectedModel.name}
                </span>
              </div>
            )}
            {selectedModel?.category !== 'text' && selectedModel && (
              <p className="chat-warning">
                ⚠️ Эта модель предназначена для генерации {selectedModel.category === 'image' ? 'изображений' : 'видео'}
              </p>
            )}
            {!user && (
              <p className="chat-warning">
                ⚠️ Войдите в аккаунт для отправки сообщений
              </p>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="chat-message-avatar">
                    <ModelIcon
                      icon={msg.modelIcon || selectedModel?.icon || ''}
                      name={msg.modelName || selectedModel?.name || ''}
                      size={32}
                    />
                  </div>
                )}
                <div className="chat-message-content">
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chat-message assistant">
                {selectedModel && (
                  <div className="chat-message-avatar">
                    <ModelIcon icon={selectedModel.icon} name={selectedModel.name} size={32} />
                  </div>
                )}
                <div className="chat-message-content">
                  <span className="typing-indicator">
                    <span></span><span></span><span></span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {error && (
        <div className="chat-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {error}
        </div>
      )}

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            className="chat-input"
            placeholder={selectedModel ? `Напишите сообщение для ${selectedModel.name}...` : 'Выберите нейросеть...'}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !selectedModel || !user}
          />
          <div className="chat-input-actions">
            <button className="attach-btn" disabled={isLoading}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <button
              className="send-btn"
              disabled={!input.trim() || isLoading || !selectedModel || !user}
              onClick={handleSend}
            >
              {isLoading ? (
                <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19V5M5 12l7-7 7 7"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}