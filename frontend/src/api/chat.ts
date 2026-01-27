import api from './client'

export interface ChatRequest {
  message: string
  provider: string
  model?: string
  system_prompt?: string
}

export interface ChatResponse {
  ok: boolean
  content?: string
  tokens_input?: number
  tokens_output?: number
  credits_spent?: number
  error?: string
}

export async function sendMessage(request: ChatRequest): Promise<ChatResponse> {
  return api.request<ChatResponse>('/api/v1/chat', {
    method: 'POST',
    body: request,
  })
}