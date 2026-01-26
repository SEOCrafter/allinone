import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
});

// Добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Обработка 401 ошибки
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password });

// Admin - Stats
export const getStats = () => api.get('/admin/stats');

// Admin - Users
export const getUsers = (page = 1, limit = 50) =>
  api.get('/admin/users', { params: { page, limit } });

export const setUserRole = (userId: string, role: string) =>
  api.post(`/admin/users/${userId}/set-role`, { role });

export const setUserPassword = (userId: string, password: string) =>
  api.post(`/admin/users/${userId}/set-password`, { password });

export const blockUser = (userId: string) =>
  api.post(`/admin/users/${userId}/block`);

export const unblockUser = (userId: string) =>
  api.post(`/admin/users/${userId}/unblock`);

// Requests
export const getRequests = (page = 1, limit = 20) =>
  api.get(`/admin/requests?page=${page}&limit=${limit}`);

export const getRequest = (id: string) =>
  api.get(`/admin/requests/${id}`);

// Admin - Adapters
export const getAdapters = () => api.get('/admin/adapters');

export const getAdaptersStatus = () => api.get('/admin/adapters/status');

export const getAdaptersBalances = () => api.get('/admin/adapters/balances');

export const testAdapter = (name: string, message: string, model?: string) =>
  api.post(`/admin/adapters/${name}/test`, { message, model });

export const healthCheckAdapter = (name: string) =>
  api.post(`/admin/adapters/${name}/health`);

// Балансы провайдеров
export const setProviderBalance = (provider: string, balance_usd: number) =>
  api.post(`/admin/adapters/balances/${provider}/set`, { balance_usd });

export const depositProviderBalance = (provider: string, amount_usd: number) =>
  api.post(`/admin/adapters/balances/${provider}/deposit`, { amount_usd });