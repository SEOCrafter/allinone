import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.params = { ...config.params, _t: Date.now() };
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

export const getStats = (config?: { signal?: AbortSignal }) => 
  api.get('/admin/stats', config);

export const getUsers = (page = 1, limit = 50, config?: { signal?: AbortSignal }) =>
  api.get('/admin/users', { params: { page, limit }, ...config });

export const setUserRole = (userId: string, role: string) =>
  api.post(`/admin/users/${userId}/set-role`, { role });

export const setUserPassword = (userId: string, password: string) =>
  api.post(`/admin/users/${userId}/set-password`, { password });

export const blockUser = (userId: string) =>
  api.post(`/admin/users/${userId}/block`);

export const unblockUser = (userId: string) =>
  api.post(`/admin/users/${userId}/unblock`);

export const getRequests = (page = 1, limit = 20, config?: { signal?: AbortSignal }) =>
  api.get('/admin/requests', { params: { page, limit }, ...config });

export const getRequest = (id: string) =>
  api.get(`/admin/requests/${id}`);

export const getAdapters = (config?: { signal?: AbortSignal }) => 
  api.get('/admin/adapters', config);

export const getAdaptersStatus = (config?: { signal?: AbortSignal }) => 
  api.get('/admin/adapters/status', config);

export const getAdaptersBalances = (config?: { signal?: AbortSignal }) => 
  api.get('/admin/adapters/balances', config);

export const testAdapter = (name: string, message: string, model?: string) =>
  api.post(`/admin/adapters/${name}/test`, { message, model });

export const healthCheckAdapter = (name: string) =>
  api.post(`/admin/adapters/${name}/health`);

export const setProviderBalance = (provider: string, balance_usd: number) =>
  api.post(`/admin/adapters/balances/${provider}/set`, { balance_usd });

export const depositProviderBalance = (provider: string, amount_usd: number) =>
  api.post(`/admin/adapters/balances/${provider}/deposit`, { amount_usd });

export const getUnitEconomics = () => api.get('/admin/unit-economics');

export const createUnitEconomics = (data: {
  name: string;
  currency: string;
  subscription_price: number;
  credits_in_plan: number;
  requests_in_plan: number;
  avg_tokens_input: number;
  avg_tokens_output: number;
  overhead_percent: number;
  selected_model: string;
  notes?: string;
}) => api.post('/admin/unit-economics', data);

export const updateUnitEconomics = (id: string, data: Record<string, unknown>) =>
  api.put(`/admin/unit-economics/${id}`, data);

export const deleteUnitEconomics = (id: string) =>
  api.delete(`/admin/unit-economics/${id}`);

export const getProviderModels = (config?: { signal?: AbortSignal }) => 
  api.get('/admin/providers/models', config);

export const getProviderPrices = (params?: { model_name?: string; provider?: string }) =>
  api.get('/admin/providers/prices', { params });

export const switchModelProvider = (model_name: string, new_provider: string) =>
  api.post('/admin/providers/switch', { model_name, new_provider });

export const updateProviderPrice = (id: string, data: { price_usd?: number; is_active?: boolean }) =>
  api.put(`/admin/providers/prices/${id}`, data);

export const getActiveProvider = (model_name: string) =>
  api.get(`/admin/providers/active/${model_name}`);

export const getModelSettings = (config?: { signal?: AbortSignal }) =>
  api.get('/admin/models/settings', config);

export const getStatsUsersDetails = (page = 1, limit = 50, config?: { signal?: AbortSignal }) =>
  api.get('/admin/stats/users-details', { params: { page, limit }, ...config });

export const getUserGenerations = (userId: string, page = 1, limit = 50, config?: { signal?: AbortSignal }) =>
  api.get(`/admin/stats/users/${userId}/generations`, { params: { page, limit }, ...config });

export const getStatsPeriods = (config?: { signal?: AbortSignal }) =>
  api.get('/admin/stats/periods', config);

export const getStatsCharts = (days = 30, config?: { signal?: AbortSignal }) =>
  api.get('/admin/stats/charts', { params: { days }, ...config });