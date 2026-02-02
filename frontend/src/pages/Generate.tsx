import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Model } from '../data/models'
import { useAuth } from '../context/AuthContext'
import ModelIcon from '../components/ModelIcon'
import { 
  generateNanoBanana, 
  generateMidjourney, 
  generateImageAsync,
  getTaskStatus,
  imageToImage,
  generateVideo,
  generateMidjourneyVideo,
  uploadFile,
  getFileUrl,
  saveFromUrl,
} from '../api/images'

interface Props {
  selectedModel: Model | null
}

export default function Generate({ selectedModel }: Props) {
  const { user, updateCredits } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const [uploadedImage, setUploadedImage] = useState<{ file: File; preview: string; url?: string } | null>(null)
  const [uploadedVideo, setUploadedVideo] = useState<{ file: File; preview: string; url?: string } | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const [settings, setSettings] = useState({
    aspectRatio: '1:1',
    resolution: '1K',
    version: '7',
    speed: 'fast',
    stylization: 100,
    duration: '5',
    sound: false,
  })

  const isVideo = selectedModel?.category === 'video'
  const requiresImage = selectedModel?.requiresImage
  const supportsImageInput = selectedModel?.supportsImageInput
  const requiresVideo = selectedModel?.requiresVideo
  const showImageUpload = requiresImage || supportsImageInput

  const currentCost = (() => {
    if (selectedModel?.variants && settings.speed) {
      const variant = selectedModel.variants.find((v: any) => v.key === settings.speed)
      if (variant?.credits_price) return variant.credits_price
    }
    return selectedModel?.cost || 0
  })()

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const preview = URL.createObjectURL(file)
    setUploadedImage({ file, preview })
    setIsUploading(true)

    try {
      const uploadResult = await uploadFile(file, 'images')
      const urlResult = await getFileUrl(uploadResult.id)
      setUploadedImage({ file, preview, url: urlResult.url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки файла')
    } finally {
      setIsUploading(false)
    }
  }

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const preview = URL.createObjectURL(file)
    setUploadedVideo({ file, preview })
    setIsUploading(true)

    try {
      const uploadResult = await uploadFile(file, 'videos')
      const urlResult = await getFileUrl(uploadResult.id)
      setUploadedVideo({ file, preview, url: urlResult.url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки файла')
    } finally {
      setIsUploading(false)
    }
  }

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
    if (requiresImage && !uploadedImage?.url) {
      setError('Загрузите изображение')
      return
    }
    if (requiresVideo && !uploadedVideo?.url) {
      setError('Загрузите видео')
      return
    }

    setError(null)
    setIsLoading(true)
    setResult(null)

    const pollForResult = async (requestId: string): Promise<string> => {
      const maxAttempts = 120
      const interval = 3000
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, interval))
        const status = await getTaskStatus(requestId)
        if (status.status === 'completed' && status.result_url) {
          return status.result_url
        }
        if (status.status === 'failed') {
          throw new Error(status.error_message || 'Генерация не удалась')
        }
      }
      throw new Error('Таймаут генерации — попробуйте проверить позже')
    }

    const saveAndGetLocalUrl = async (url: string, isVideoResult: boolean): Promise<string> => {
      try {
        const saved = await saveFromUrl({
          url,
          category: isVideoResult ? 'videos' : 'images',
          filename_hint: `generation_${Date.now()}`,
        })
        const presigned = await getFileUrl(saved.id)
        return presigned.url
      } catch (e) {
        console.error('Failed to save result:', e)
        return url
      }
    }

    try {
      let response

      if (selectedModel.provider === 'nano_banana') {
        response = await generateNanoBanana({
          prompt: prompt.trim(),
          model: selectedModel.backendModel,
          aspect_ratio: settings.aspectRatio,
          resolution: settings.resolution,
          image_input: uploadedImage?.url ? [uploadedImage.url] : undefined,
        })
        if (response.ok && response.image_url) {
          const localUrl = await saveAndGetLocalUrl(response.image_url, false)
          setResult(localUrl)
        }
      } else if (selectedModel.provider === 'midjourney') {
        if (selectedModel.taskType === 'i2v') {
          response = await generateMidjourneyVideo({
            prompt: prompt.trim(),
            image_url: uploadedImage!.url!,
          })
          if (response.ok && response.video_url) {
            const localUrl = await saveAndGetLocalUrl(response.video_url, true)
            setResult(localUrl)
          }
        } else if (selectedModel.taskType === 'i2i') {
          response = await imageToImage({
            prompt: prompt.trim(),
            provider: 'midjourney',
            image_url: uploadedImage!.url!,
            aspect_ratio: settings.aspectRatio,
            version: settings.version,
            speed: settings.speed,
            stylization: settings.stylization,
          })
          if (response.ok && response.image_url) {
            const localUrl = await saveAndGetLocalUrl(response.image_url, false)
            setResult(localUrl)
          }
        } else {
          response = await generateMidjourney({
            prompt: prompt.trim(),
            task_type: selectedModel.backendModel,
            aspect_ratio: settings.aspectRatio,
            version: settings.version,
            speed: settings.speed,
            stylization: settings.stylization,
          })
          if (response.ok && response.image_url) {
            const localUrl = await saveAndGetLocalUrl(response.image_url, false)
            setResult(localUrl)
          }
        }
      } else if (selectedModel.provider === 'kling') {
        response = await generateVideo({
          prompt: prompt.trim(),
          provider: 'kling',
          model: selectedModel.backendModel,
          image_urls: uploadedImage?.url ? [uploadedImage.url] : undefined,
          video_urls: uploadedVideo?.url ? [uploadedVideo.url] : undefined,
          duration: settings.duration,
          aspect_ratio: settings.aspectRatio,
          sound: settings.sound,
        })
        if (response.ok && response.video_url) {
          const localUrl = await saveAndGetLocalUrl(response.video_url, true)
          setResult(localUrl)
        }
      } else if (selectedModel.category === 'video') {
        response = await generateVideo({
          prompt: prompt.trim(),
          provider: selectedModel.provider,
          model: selectedModel.backendModel,
          image_urls: uploadedImage?.url ? [uploadedImage.url] : undefined,
          duration: settings.duration,
          aspect_ratio: settings.aspectRatio,
        })
        if (response.ok && response.video_url) {
          const localUrl = await saveAndGetLocalUrl(response.video_url, true)
          setResult(localUrl)
        }
      } else if (selectedModel.provider === 'flux') {
          response = await generateImageAsync({
          prompt: prompt.trim(),
          provider: 'flux',
          model: selectedModel.backendModel,
          aspect_ratio: settings.aspectRatio,
          resolution: settings.resolution,
          image_input: uploadedImage?.url ? [uploadedImage.url] : undefined,
        })
        if (response.ok) {
          if (response.image_url) {
            const localUrl = await saveAndGetLocalUrl(response.image_url, false)
            setResult(localUrl)
          } else if (response.request_id) {
            const resultUrl = await pollForResult(response.request_id)
            const localUrl = await saveAndGetLocalUrl(resultUrl, false)
            setResult(localUrl)
          }
        }
      } else if (selectedModel.category === 'image') {
        response = await generateImageAsync({
          prompt: prompt.trim(),
          provider: selectedModel.provider,
          model: selectedModel.backendModel,
          aspect_ratio: settings.aspectRatio,
          resolution: settings.resolution,
          image_input: uploadedImage?.url ? [uploadedImage.url] : undefined,
        })
        if (response.ok) {
          if (response.image_url) {
            const localUrl = await saveAndGetLocalUrl(response.image_url, false)
            setResult(localUrl)
          } else if (response.request_id) {
            const resultUrl = await pollForResult(response.request_id)
            const localUrl = await saveAndGetLocalUrl(resultUrl, false)
            setResult(localUrl)
          }
        }
      }

      if (response && !response.ok) {
        setError(response.error || 'Ошибка генерации')
      } else if (response?.credits_spent && user) {
        updateCredits((user.credits_balance ?? 0) - response.credits_spent)
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
          <span className="generate-model-icon">
            <ModelIcon icon={selectedModel.icon} name={selectedModel.name} size={48} />
          </span>
          <div>
            <h1 className="generate-model-name">{selectedModel.name}</h1>
            <p className="generate-model-desc">{selectedModel.description}</p>
          </div>
        </div>
        <div className="generate-model-cost">
          <img src="/icons/token.svg" alt="" width="18" height="18" />
          <span>{currentCost} токенов / генерация</span>
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

          <div className="form-section">
            <label className="form-label">Настройки</label>
            <div className="settings-grid">
              {selectedModel.aspectRatios && (
                <div className="setting-item">
                  <span>Соотношение сторон</span>
                  <select 
                    value={settings.aspectRatio} 
                    onChange={(e) => setSettings({...settings, aspectRatio: e.target.value})}
                    disabled={isLoading}
                  >
                    {selectedModel.aspectRatios.map(ar => (
                      <option key={ar} value={ar}>{ar}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedModel.resolutions && (
                <div className="setting-item">
                  <span>Разрешение</span>
                  <select 
                    value={settings.resolution} 
                    onChange={(e) => setSettings({...settings, resolution: e.target.value})}
                    disabled={isLoading}
                  >
                    {selectedModel.resolutions.map(res => (
                      <option key={res} value={res}>{res}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedModel.provider === 'midjourney' && selectedModel.taskType !== 'i2v' && (
                <>
                  <div className="setting-item">
                    <span>Версия</span>
                    <select 
                      value={settings.version} 
                      onChange={(e) => setSettings({...settings, version: e.target.value})}
                      disabled={isLoading}
                    >
                      <option value="7">v7</option>
                      <option value="6.1">v6.1</option>
                      <option value="6">v6</option>
                      <option value="5.2">v5.2</option>
                      <option value="niji6">Niji 6</option>
                    </select>
                  </div>
                  <div className="setting-item">
                    <span>Скорость</span>
                    <select 
                      value={settings.speed} 
                      onChange={(e) => setSettings({...settings, speed: e.target.value})}
                      disabled={isLoading}
                    >
                      <option value="turbo">Turbo</option>
                      <option value="fast">Fast</option>
                      <option value="relaxed">Relaxed</option>
                    </select>
                  </div>
                  <div className="setting-item">
                    <span>Стилизация</span>
                    <input 
                      type="number" 
                      value={settings.stylization} 
                      onChange={(e) => setSettings({...settings, stylization: +e.target.value})}
                      min={0} 
                      max={1000}
                      disabled={isLoading}
                    />
                  </div>
                </>
              )}

              {selectedModel.durations && (
                <div className="setting-item">
                  <span>Длительность (сек)</span>
                  <select 
                    value={settings.duration} 
                    onChange={(e) => setSettings({...settings, duration: e.target.value})}
                    disabled={isLoading}
                  >
                    {selectedModel.durations.map(d => (
                      <option key={d} value={d}>{d}s</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedModel.provider === 'kling' && (
                <div className="setting-item">
                  <span>Звук</span>
                  <label className="toggle">
                    <input 
                      type="checkbox" 
                      checked={settings.sound}
                      onChange={(e) => setSettings({...settings, sound: e.target.checked})}
                      disabled={isLoading}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {showImageUpload && (
            <div className="form-section">
              <label className="form-label">{requiresImage ? 'Исходное изображение' : 'Референсные изображения (до 8)'} {requiresImage && <span className="required">*</span>}</label>
              <div 
                className={`upload-area ${uploadedImage ? 'has-file' : ''} ${isUploading ? 'uploading' : ''}`}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadedImage ? (
                  <div className="upload-preview">
                    <img src={uploadedImage.preview} alt="Preview" />
                    {isUploading && <div className="upload-overlay">Загрузка...</div>}
                    {uploadedImage.url && <div className="upload-success">✓</div>}
                  </div>
                ) : (
                  <>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17,8 12,3 7,8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p>Перетащите изображение или кликните для выбора</p>
                  </>
                )}
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload}
                  disabled={isLoading || isUploading} 
                  style={{ display: 'none' }}
                />
              </div>
              {uploadedImage && (
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setUploadedImage(null)
                  }}
                  disabled={isLoading}
                >
                  Удалить
                </button>
              )}
            </div>
          )}

          {requiresVideo && (
            <div className="form-section">
              <label className="form-label">Видео с движением {requiresVideo && <span className="required">*</span>}</label>
              <div 
                className={`upload-area ${uploadedVideo ? 'has-file' : ''} ${isUploading ? 'uploading' : ''}`}
                onClick={() => videoInputRef.current?.click()}
              >
                {uploadedVideo ? (
                  <div className="upload-preview">
                    <video src={uploadedVideo.preview} muted />
                    {isUploading && <div className="upload-overlay">Загрузка...</div>}
                    {uploadedVideo.url && <div className="upload-success">✓</div>}
                  </div>
                ) : (
                  <>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17,8 12,3 7,8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p>Перетащите видео или кликните для выбора</p>
                  </>
                )}
                <input 
                  ref={videoInputRef}
                  type="file" 
                  accept="video/*" 
                  onChange={handleVideoUpload}
                  disabled={isLoading || isUploading} 
                  style={{ display: 'none' }}
                />
              </div>
              {uploadedVideo && (
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setUploadedVideo(null)
                  }}
                  disabled={isLoading}
                >
                  Удалить
                </button>
              )}
            </div>
          )}

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
            disabled={!prompt.trim() || isLoading || !user || isUploading || (requiresImage && !uploadedImage?.url)}
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
                  <img src="/icons/token.svg" alt="" width="14" height="14" />
                  {currentCost}
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