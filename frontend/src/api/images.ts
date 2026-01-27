import api from './client'

export interface GenerateRequest {
  prompt: string
  provider: string
  model?: string
  negative_prompt?: string
  width?: number
  height?: number
  steps?: number
  guidance?: number
  style?: string
}

export interface GenerateResponse {
  ok: boolean
  image_url?: string
  request_id?: string
  credits_spent?: number
  error?: string
}

export async function generateImage(request: GenerateRequest): Promise<GenerateResponse> {
  return api.request<GenerateResponse>('/api/v1/images/generate', {
    method: 'POST',
    body: request,
  })
}

export interface ImageToImageRequest {
  prompt: string
  provider: string
  model?: string
  image_url: string
  strength?: number
}

export async function imageToImage(request: ImageToImageRequest): Promise<GenerateResponse> {
  return api.request<GenerateResponse>('/api/v1/images/image-to-image', {
    method: 'POST',
    body: request,
  })
}