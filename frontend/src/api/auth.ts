import api from './client'
interface LoginResponse {
  ok: boolean
  access_token: string
  refresh_token: string
  user: User
}
export interface User {
  id: string
  email: string
  name?: string
  role: string
  credits_balance: number
  telegram_id?: number | null
}
export async function login(email: string, password: string): Promise<User> {
  const response = await api.request<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  })
  api.setTokens(response.access_token, response.refresh_token)
  return response.user
}
export async function register(email: string, password: string, name: string): Promise<User> {
  const response = await api.request<LoginResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: { email, password, name },
    skipAuth: true,
  })
  api.setTokens(response.access_token, response.refresh_token)
  return response.user
}
export async function getProfile(): Promise<User> {
  const res = await api.request<{ ok: boolean; user: User }>('/api/v1/user/me')
  return res.user
}
export function logout() {
  api.setTokens(null, null)
}
export function isAuthenticated() {
  return api.isAuthenticated()
}