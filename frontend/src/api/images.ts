import api from './client'

export interface GenerateImageRequest {
  prompt: string
  provider: string
  model?: string
  negative_prompt?: string
  width?: number
  height?: number
  aspect_ratio?: string
  resolution?: string
  steps?: number
  guidance?: number
  safety_filter_level?: string
  output_format?: string
  style?: string
  image_input?: string[]
}

export interface GenerateResponse {
  ok: boolean
  image_url?: string
  video_url?: string
  request_id?: string
  task_id?: string
  credits_spent?: number
  status?: string
  error?: string
}

export interface TaskStatusResponse {
  request_id: string
  status: string
  type: string
  model: string
  result_url?: string
  result_urls?: string[]
  credits_spent?: number
  error_code?: string
  error_message?: string
}

export interface NanoBananaRequest {
  prompt: string
  model?: string
  aspect_ratio?: string
  resolution?: string
  output_format?: string
  image_input?: string[]
}

export interface MidjourneyRequest {
  prompt: string
  task_type?: string
  file_url?: string
  aspect_ratio?: string
  version?: string
  speed?: string
  stylization?: number
  weirdness?: number
}

export interface ImageToImageRequest {
  prompt: string
  provider: string
  model?: string
  image_url: string
  aspect_ratio?: string
  version?: string
  speed?: string
  stylization?: number
}

export interface VideoGenerateRequest {
  prompt: string
  provider?: string
  model?: string
  image_urls?: string[]
  video_urls?: string[]
  duration?: string
  aspect_ratio?: string
  sound?: boolean
  prompt_optimizer?: boolean
}

export interface MidjourneyVideoRequest {
  prompt: string
  image_url: string
  model?: string
}

export async function generateImage(request: GenerateImageRequest): Promise<GenerateResponse> {
  return api.request<GenerateResponse>('/api/v1/images/generate', {
    method: 'POST',
    body: request,
  })
}

export async function generateImageAsync(request: GenerateImageRequest): Promise<GenerateResponse> {
  return api.request<GenerateResponse>('/api/v1/images/generate-async', {
    method: 'POST',
    body: request,
  })
}

export async function getTaskStatus(requestId: string): Promise<TaskStatusResponse> {
  return api.request<TaskStatusResponse>(`/api/v1/tasks/${requestId}`, {
    method: 'GET',
  })
}

export async function generateNanoBanana(request: NanoBananaRequest): Promise<GenerateResponse> {
  return api.request<GenerateResponse>('/api/v1/images/nano-banana', {
    method: 'POST',
    body: request,
  })
}

export async function generateMidjourney(request: MidjourneyRequest): Promise<GenerateResponse> {
  return api.request<GenerateResponse>('/api/v1/images/midjourney', {
    method: 'POST',
    body: request,
  })
}

export async function imageToImage(request: ImageToImageRequest): Promise<GenerateResponse> {
  return api.request<GenerateResponse>('/api/v1/images/image-to-image', {
    method: 'POST',
    body: request,
  })
}

export async function generateVideo(request: VideoGenerateRequest): Promise<GenerateResponse> {
  return api.request<GenerateResponse>('/api/v1/video/generate-async', {
    method: 'POST',
    body: request,
  })
}

export async function generateMidjourneyVideo(request: MidjourneyVideoRequest): Promise<GenerateResponse> {
  return api.request<GenerateResponse>('/api/v1/video/midjourney', {
    method: 'POST',
    body: request,
  })
}

export interface FileUploadResponse {
  id: string
  key: string
  filename: string
  original_filename?: string
  category: string
  content_type?: string
  size_bytes: number
  url: string
}

export async function uploadFile(file: File, category: string = 'images'): Promise<FileUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const token = api.getToken()
  const API_URL = import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8100'
    : '')

  const response = await fetch(`${API_URL}/api/v1/files/upload?category=${category}`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(error.detail || 'Upload failed')
  }

  return response.json()
}

export async function getFileUrl(fileId: string): Promise<{ url: string }> {
  return api.request<{ url: string }>(`/api/v1/files/url/${fileId}`, {
    method: 'GET',
  })
}

export interface SaveFromUrlRequest {
  url: string
  category?: string
  filename_hint?: string
}

export async function saveFromUrl(request: SaveFromUrlRequest): Promise<FileUploadResponse> {
  return api.request<FileUploadResponse>('/api/v1/files/save-from-url', {
    method: 'POST',
    body: request,
  })
}