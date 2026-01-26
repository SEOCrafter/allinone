import { useEffect, useState } from 'react';
import { getStats } from '../api/client';
import { Users, MessageSquare, DollarSign, Zap } from 'lucide-react';

// Интерфейс соответствует ответу бэкенда
interface StatsResponse {
  ok: boolean;
  stats: {
    users: {
      total: number;
      by_role: Record<string, number>;
    };
    requests: {
      total: number;
      by_status: Record<string, number>;
    };
    costs: {
      total_credits_spent: number;
      total_provider_cost_usd: number;
    };
    tokens: {
      total_input: number;
      total_output: number;
    };
    by_provider: Array<{
      provider: string;
      requests: number;
      cost_usd: number;
    }>;
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatsResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await getStats();
      // Бэкенд возвращает { ok: true, stats: {...} }
      setStats(response.data.stats);
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-400">Загрузка...</div>;
  }

  // Подсчёт по ролям
  const adminsCount = (stats?.users.by_role?.['admin'] || 0) + (stats?.users.by_role?.['superadmin'] || 0);
  const devsCount = stats?.users.by_role?.['developer'] || 0;
  const completedCount = stats?.requests.by_status?.['completed'] || 0;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Дашборд</h1>

      {/* Карточки статистики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-400">Пользователи</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.users.total || 0}</p>
          <p className="text-sm text-gray-500">
            {adminsCount} админов, {devsCount} разработчиков
          </p>
        </div>

        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-600 rounded-lg">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-400">Запросы</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.requests.total || 0}</p>
          <p className="text-sm text-gray-500">
            {completedCount} выполнено
          </p>
        </div>

        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-600 rounded-lg">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-400">Расходы провайдеров</span>
          </div>
          <p className="text-3xl font-bold text-white">
            ${(stats?.costs.total_provider_cost_usd || 0).toFixed(6)}
          </p>
          <p className="text-sm text-gray-500">
            {(stats?.costs.total_credits_spent || 0).toFixed(2)} кредитов
          </p>
        </div>

        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-400">Токены</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {(stats?.tokens.total_input || 0) + (stats?.tokens.total_output || 0)}
          </p>
          <p className="text-sm text-gray-500">
            {stats?.tokens.total_input || 0} вход / {stats?.tokens.total_output || 0} выход
          </p>
        </div>
      </div>

      {/* По провайдерам */}
      <div className="bg-[#2f2f2f] rounded-lg p-4">
        <h2 className="text-lg font-semibold text-white mb-4">По провайдерам</h2>
        <table className="w-full">
          <thead>
            <tr className="text-gray-400 text-left">
              <th className="pb-3">Провайдер</th>
              <th className="pb-3">Запросы</th>
              <th className="pb-3">Расходы (USD)</th>
            </tr>
          </thead>
          <tbody>
            {stats?.by_provider?.map((p) => (
              <tr key={p.provider} className="border-t border-gray-700">
                <td className="py-3 text-white">{p.provider}</td>
                <td className="py-3 text-gray-300">{p.requests}</td>
                <td className="py-3 text-gray-300">${p.cost_usd.toFixed(6)}</td>
              </tr>
            ))}
            {(!stats?.by_provider || stats.by_provider.length === 0) && (
              <tr>
                <td colSpan={3} className="py-3 text-gray-500 text-center">Нет данных</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
