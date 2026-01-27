import api from './client'

export interface BackendModel {
  id: string
  name: string
  provider: string
  display_name: string
  pricing: {
    input: number
    output: number
  }
}

export interface BackendAdapter {
  name: string
  display_name: string
  provider_type: string
  status: string
  models: BackendModel[]
  balance_usd?: number
}

export async function getAdapters(): Promise<BackendAdapter[]> {
  return api.request<BackendAdapter[]>('/api/v1/admin/adapters')
}

export async function getAdaptersStatus(): Promise<Record<string, { status: string; latency_ms: number }>> {
  return api.request('/api/v1/admin/adapters/status')
}