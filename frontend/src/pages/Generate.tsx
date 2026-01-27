import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Model } from '../data/models'
import { useAuth } from '../context/AuthContext'
import { generateImage } from '../api/images'

interface Props {
  selectedModel: Model | null
}

export default function Generate({ selectedModel }: Props) {
  const { user, updateCredits } = useAuth()
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  
  const [settings, setSettings] = useState({
    width: 1024,
    height: 1024,
    steps: 30,
    guidance: 7.5,
  })

  const isImage = selectedModel?.category === 'image'
  const isVideo = selectedModel?.category === 'video'

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return
    if (!selectedModel) {
      setError('Выберите нейросеть')
      return
    }
    if (!user) {
      setError('Войдите в аккаунт')
      return
    }

    setError(null)
    setIsLoading(true)
    setResult(null)

    try {
      if (isVideo) {
        setError('Генерация видео пока не реализована')
        setIsLoading(false)
        return
      }

      const response = await generateImage({
        prompt: prompt.trim(),
        provider: selectedModel.provider,
        model: selectedModel.backendModel,
        negative_prompt: negativePrompt || undefined,
        width: settings.width,
        height: settings.height,
        steps: settings.steps,
        guidance: settings.guidance,
      })

      if (response.ok && response.image_url) {
        setResult(response.image_url)
        if (response.credits_spent && user) {
          updateCredits((user.credits_balance ?? 0) - response.credits_spent)
        }
      } else {
        setError(response.error || 'Ошибка генерации')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка генерации')
    } finally {
      setIsLoading(false)
    }
  }

  const credits = user?.credits_balance ?? 0

  if (!selectedModel || selectedModel.category === 'text') {
    return (
      <div className="generate-page">
        <div className="generate-empty">
          <div className="generate-empty-icon">🖼️</div>
          <h2>Выберите модель для генерации</h2>
          <p>Выберите модель из категории "Изображения" или "Видео" в меню слева</p>
          <button className="btn btn-primary" onClick={() => navigate('/bots')}>
            Выбрать модель
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="generate-page">
      <div className="generate-header">
        <div className="generate-model-info">
          <span className="generate-model-icon" style={{ background: selectedModel.color }}>
            {selectedModel.icon}
          </span>
          <div>
            <h1 className="generate-model-name">{selectedModel.name}</h1>
            <p className="generate-model-desc">{selectedModel.description}</p>
          </div>
        </div>
        <div className="generate-model-cost">
          <svg viewBox="0 0 24 24" fill="#facc15" width="18" height="18">
            <circle cx="12" cy="12" r="10"/>
          </svg>
          <span>{selectedModel.cost} кредитов / генерация</span>
        </div>
      </div>

      <div className="generate-content">
        <div className="generate-form">
          <div className="form-section">
            <label className="form-label">Промпт</label>
            <textarea
              className="form-textarea"
              placeholder={isVideo 
                ? "Опишите видео, которое хотите создать..." 
                : "Опишите изображение, которое хотите создать..."
              }
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {isImage && (
            <div className="form-section">
              <label className="form-label">Негативный промпт (необязательно)</label>
              <textarea
                className="form-textarea"
                placeholder="Что НЕ должно быть на изображении..."
                rows={2}
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                disabled={isLoading}
              />
            </div>
          )}

          <div className="form-section">
            <label className="form-label">Настройки</label>
            <div className="settings-grid">
              <div className="setting-item">
                <span>Ширина</span>
                <select 
                  value={settings.width} 
                  onChange={(e) => setSettings({...settings, width: +e.target.value})}
                  disabled={isLoading}
                >
                  <option value={512}>512</option>
                  <option value={768}>768</option>
                  <option value={1024}>1024</option>
                  <option value={1280}>1280</option>
                </select>
              </div>
              <div className="setting-item">
                <span>Высота</span>
                <select 
                  value={settings.height} 
                  onChange={(e) => setSettings({...settings, height: +e.target.value})}
                  disabled={isLoading}
                >
                  <option value={512}>512</option>
                  <option value={768}>768</option>
                  <option value={1024}>1024</option>
                  <option value={1280}>1280</option>
                </select>
              </div>
              {isImage && (
                <>
                  <div className="setting-item">
                    <span>Шаги</span>
                    <input 
                      type="number" 
                      value={settings.steps} 
                      onChange={(e) => setSettings({...settings, steps: +e.target.value})}
                      min={10} 
                      max={50}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="setting-item">
                    <span>Guidance</span>
                    <input 
                      type="number" 
                      value={settings.guidance} 
                      onChange={(e) => setSettings({...settings, guidance: +e.target.value})}
                      min={1} 
                      max={20} 
                      step={0.5}
                      disabled={isLoading}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {selectedModel.id.includes('i2i') || selectedModel.id.includes('i2v') ? (
            <div className="form-section">
              <label className="form-label">Исходное изображение</label>
              <div className="upload-area">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17,8 12,3 7,8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p>Перетащите изображение или кликните для выбора</p>
                <input type="file" accept="image/*" disabled={isLoading} />
              </div>
            </div>
          ) : null}

          {error && (
            <div className="generate-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              {error}
            </div>
          )}

          <button 
            className="btn btn-primary btn-generate"
            onClick={handleGenerate}
            disabled={!prompt.trim() || isLoading || !user}
          >
            {isLoading ? (
              <>
                <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
                Генерация...
              </>
            ) : (
              <>
                {isVideo ? '🎬 Создать видео' : '🖼️ Создать изображение'}
                <span className="btn-cost">
                  <svg viewBox="0 0 24 24" fill="#facc15" width="14" height="14">
                    <circle cx="12" cy="12" r="10"/>
                  </svg>
                  {selectedModel.cost}
                </span>
              </>
            )}
          </button>

          {user && (
            <p className="generate-balance">Ваш баланс: {credits.toFixed(0)} кредитов</p>
          )}
          {!user && (
            <p className="generate-login-hint">
              <a href="/login">Войдите</a> для генерации
            </p>
          )}
        </div>

        <div className="generate-result">
          <h3>Результат</h3>
          {result ? (
            <div className="result-preview">
              {isVideo ? (
                <video src={result} controls autoPlay loop />
              ) : (
                <img src={result} alt="Generated" />
              )}
              <div className="result-actions">
                <a href={result} download className="btn btn-secondary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Скачать
                </a>
                <button className="btn btn-secondary" onClick={() => setResult(null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                    <path d="M8 16H3v5"/>
                  </svg>
                  Ещё раз
                </button>
              </div>
            </div>
          ) : (
            <div className="result-empty">
              <div className="result-empty-icon">{isVideo ? '🎬' : '🖼️'}</div>
              <p>Здесь появится результат генерации</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}