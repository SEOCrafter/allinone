import axios from 'axios';

const api = axios.create({
  baseURL: 'http://95.140.153.151:8100/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password });

export const getStats = () => api.get('/admin/stats');

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

export const getRequests = (page = 1, limit = 20) =>
  api.get(`/admin/requests?page=${page}&limit=${limit}`);

export const getRequest = (id: string) =>
  api.get(`/admin/requests/${id}`);

export const getAdapters = () => api.get('/admin/adapters');

export const getAdaptersStatus = () => api.get('/admin/adapters/status');

export const getAdaptersBalances = () => api.get('/admin/adapters/balances');

export const testAdapter = (name: string, message: string, model?: string) =>
  api.post(`/admin/adapters/${name}/test`, { message, model });

export const healthCheckAdapter = (name: string) =>
  api.post(`/admin/adapters/${name}/health`);

export const setProviderBalance = (provider: string, balance_usd: number) =>
  api.post(`/admin/adapters/balances/${provider}/set`, { balance_usd });

export const depositProviderBalance = (provider: string, amount_usd: number) =>
  api.post(`/admin/adapters/balances/${provider}/deposit`, { amount_usd });