import { useCallback } from 'react';
import { getStats } from '../api/client';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useLoadData } from '../hooks/useLoadData';

interface StatsData {
  users: { total: number; by_role: Record<string, number> };
  requests: { total: number; by_status: Record<string, number> };
  costs: { total_credits_spent: number; total_provider_cost_usd: number };
  tokens: { total_input: number; total_output: number };
  by_provider: Array<{ provider: string; requests: number; cost_usd: number }>;
}

const defaultStats: StatsData = {
  users: { total: 0, by_role: {} },
  requests: { total: 0, by_status: {} },
  costs: { total_credits_spent: 0, total_provider_cost_usd: 0 },
  tokens: { total_input: 0, total_output: 0 },
  by_provider: [],
};

export default function Stats() {
  const loadFn = useCallback(async (signal: AbortSignal) => {
    const res = await getStats({ signal });
    return res.data?.stats || defaultStats;
  }, []);

  const { data: stats, loading, refresh } = useLoadData<StatsData>(loadFn, defaultStats);

  const translateStatus = (status: string) => {
    const map: Record<string, string> = {
      completed: 'Выполнено',
      failed: 'Ошибка',
      processing: 'В работе',
      pending: 'Ожидание',
    };
    return map[status] || status;
  };

  const translateRole = (role: string) => {
    const map: Record<string, string> = {
      superadmin: 'Суперадмин',
      admin: 'Админ',
      developer: 'Разработчик',
      user: 'Пользователь',
    };
    return map[role] || role;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Статистика</h1>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 bg-[#3f3f3f] hover:bg-[#4f4f4f] text-white rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      <div className="bg-[#2f2f2f] rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Расходы (Скоро)</h2>
        <p className="text-gray-400">Детальная аналитика расходов по дням, неделям и месяцам будет доступна здесь.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Запросы по статусу</h2>
          <div className="space-y-2">
            {Object.entries(stats.requests.by_status || {}).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center">
                <span className="text-gray-300">{translateStatus(status)}</span>
                <span className="text-white font-semibold">{count}</span>
              </div>
            ))}
            {Object.keys(stats.requests.by_status || {}).length === 0 && (
              <p className="text-gray-500">Нет данных</p>
            )}
          </div>
        </div>

        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Пользователи по ролям</h2>
          <div className="space-y-2">
            {Object.entries(stats.users.by_role || {}).map(([role, count]) => (
              <div key={role} className="flex justify-between items-center">
                <span className="text-gray-300">{translateRole(role)}</span>
                <span className="text-white font-semibold">{count}</span>
              </div>
            ))}
            {Object.keys(stats.users.by_role || {}).length === 0 && (
              <p className="text-gray-500">Нет данных</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#2f2f2f] rounded-lg p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Итого</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#252525] p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Всего пользователей</p>
            <p className="text-2xl font-bold text-white">{stats.users.total}</p>
          </div>
          <div className="bg-[#252525] p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Всего запросов</p>
            <p className="text-2xl font-bold text-white">{stats.requests.total}</p>
          </div>
          <div className="bg-[#252525] p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Токенов потрачено</p>
            <p className="text-2xl font-bold text-white">{stats.costs.total_credits_spent.toFixed(4)}</p>
          </div>
          <div className="bg-[#252525] p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Расходы провайдеров</p>
            <p className="text-2xl font-bold text-white">${stats.costs.total_provider_cost_usd.toFixed(6)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}