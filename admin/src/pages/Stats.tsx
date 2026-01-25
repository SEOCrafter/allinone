import { useEffect, useState } from 'react';
import { getStats } from '../api/client';
import { RefreshCw } from 'lucide-react';

interface Stats {
  users_count: number;
  requests_count: number;
  total_credits_spent: number;
  total_provider_cost: number;
  tokens_input: number;
  tokens_output: number;
  by_status: Record<string, number>;
  by_role: Record<string, number>;
}

export default function Stats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await getStats();
      setStats(response.data);
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
    } finally {
      setLoading(false);
    }
  };

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
      dev: 'Разработчик',
      user: 'Пользователь',
    };
    return map[role] || role;
  };

  if (loading) {
    return <div className="p-6 text-gray-400">Загрузка...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Статистика</h1>
        <button
          onClick={loadStats}
          className="flex items-center gap-2 px-4 py-2 bg-[#3f3f3f] hover:bg-[#4f4f4f] text-white rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      {/* Расходы - Coming Soon */}
      <div className="bg-[#2f2f2f] rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Расходы (Скоро)</h2>
        <p className="text-gray-400">
          Детальная аналитика расходов по дням, неделям и месяцам будет доступна здесь.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* По статусам */}
        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Запросы по статусу</h2>
          <div className="space-y-2">
            {stats?.by_status && Object.entries(stats.by_status).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center">
                <span className="text-gray-300">{translateStatus(status)}</span>
                <span className="text-white font-semibold">{count}</span>
              </div>
            ))}
            {(!stats?.by_status || Object.keys(stats.by_status).length === 0) && (
              <p className="text-gray-500">Нет данных</p>
            )}
          </div>
        </div>

        {/* По ролям */}
        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Пользователи по ролям</h2>
          <div className="space-y-2">
            {stats?.by_role && Object.entries(stats.by_role).map(([role, count]) => (
              <div key={role} className="flex justify-between items-center">
                <span className="text-gray-300">{translateRole(role)}</span>
                <span className="text-white font-semibold">{count}</span>
              </div>
            ))}
            {(!stats?.by_role || Object.keys(stats.by_role).length === 0) && (
              <p className="text-gray-500">Нет данных</p>
            )}
          </div>
        </div>
      </div>

      {/* Итоги */}
      <div className="bg-[#2f2f2f] rounded-lg p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Итого</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#252525] p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Всего пользователей</p>
            <p className="text-2xl font-bold text-white">{stats?.users_count || 0}</p>
          </div>
          <div className="bg-[#252525] p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Всего запросов</p>
            <p className="text-2xl font-bold text-white">{stats?.requests_count || 0}</p>
          </div>
          <div className="bg-[#252525] p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Кредитов потрачено</p>
            <p className="text-2xl font-bold text-white">{(stats?.total_credits_spent || 0).toFixed(4)}</p>
          </div>
          <div className="bg-[#252525] p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Расходы провайдеров</p>
            <p className="text-2xl font-bold text-white">${(stats?.total_provider_cost || 0).toFixed(6)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}