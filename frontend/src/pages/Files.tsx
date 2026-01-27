import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

interface FileItem {
  id: string
  key: string
  filename: string
  original_filename?: string
  category: string
  content_type?: string
  size_bytes: number
  url: string
  created_at?: string
  presigned_url?: string
}

interface FilesResponse {
  files: FileItem[]
  total: number
}

export default function Files() {
  const { user } = useAuth()
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadFiles()
    } else {
      setLoading(false)
    }
  }, [user, category])

  const loadFiles = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category) params.append('category', category)
      params.append('limit', '50')
      
      const response = await api.request<FilesResponse>(`/api/v1/files?${params.toString()}`)
      
      const filesWithUrls = await Promise.all(
        response.files.map(async (file) => {
          try {
            const urlResponse = await api.request<{ url: string }>(`/api/v1/files/url/${file.id}`)
            return { ...file, presigned_url: urlResponse.url }
          } catch {
            return file
          }
        })
      )
      
      setFiles(filesWithUrls)
    } catch (err) {
      console.error('Failed to load files:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (fileId: string) => {
    if (!confirm('Удалить файл?')) return
    try {
      await api.request(`/api/v1/files/${fileId}`, { method: 'DELETE' })
      setFiles(files.filter(f => f.id !== fileId))
    } catch (err) {
      console.error('Failed to delete file:', err)
    }
  }

  const handleDownload = (file: FileItem) => {
    if (file.presigned_url) {
      window.open(file.presigned_url, '_blank')
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const isImage = (contentType?: string) => contentType?.startsWith('image/')
  const isVideo = (contentType?: string) => contentType?.startsWith('video/')

  if (!user) {
    return (
      <div className="main-area">
        <section className="files-page">
          <div className="files-empty">
            <div className="files-empty-icon">📁</div>
            <h2>Мои файлы</h2>
            <p>Здесь будут храниться ваши файлы и генерации</p>
            <p className="files-hint">Войдите в аккаунт, чтобы сохранять файлы</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="main-area">
      <section className="files-page">
        <div className="files-header">
          <h1 className="files-title">Мои файлы</h1>
          <div className="files-filters">
            <button 
              className={`filter-btn ${category === null ? 'active' : ''}`}
              onClick={() => setCategory(null)}
            >
              Все
            </button>
            <button 
              className={`filter-btn ${category === 'images' ? 'active' : ''}`}
              onClick={() => setCategory('images')}
            >
              Изображения
            </button>
            <button 
              className={`filter-btn ${category === 'videos' ? 'active' : ''}`}
              onClick={() => setCategory('videos')}
            >
              Видео
            </button>
          </div>
        </div>

        {loading ? (
          <div className="files-loading">
            <div className="spinner"></div>
            <p>Загрузка файлов...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="files-empty">
            <div className="files-empty-icon">📁</div>
            <h2>Нет файлов</h2>
            <p>Здесь появятся ваши генерации</p>
          </div>
        ) : (
          <div className="files-grid">
            {files.map(file => (
              <div key={file.id} className="file-card">
                <div className="file-preview">
                  {isImage(file.content_type) && file.presigned_url ? (
                    <img 
                      src={file.presigned_url} 
                      alt={file.original_filename || file.filename}
                      loading="lazy"
                    />
                  ) : isVideo(file.content_type) && file.presigned_url ? (
                    <video 
                      src={file.presigned_url}
                      muted
                      playsInline
                      onMouseEnter={(e) => e.currentTarget.play()}
                      onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }}
                    />
                  ) : (
                    <div className="file-icon">📄</div>
                  )}
                  <div className="file-overlay">
                    <button className="file-action" onClick={() => handleDownload(file)} title="Скачать">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7,10 12,15 17,10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                    <button className="file-action delete" onClick={() => handleDelete(file.id)} title="Удалить">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3,6 5,6 21,6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="file-info">
                  <span className="file-name">{file.original_filename || file.filename}</span>
                  <span className="file-size">{formatSize(file.size_bytes)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
