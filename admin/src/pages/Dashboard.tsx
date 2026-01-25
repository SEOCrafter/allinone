import { useEffect, useState } from 'react';
import { getStats } from '../api/client';
import { Users, MessageSquare, DollarSign, Zap } from 'lucide-react';

interface Stats {
  users_count: number;
  requests_count: number;
  total_credits_spent: number;
  total_provider_cost: number;
  tokens_input: number;
  tokens_output: number;
  by_provider: Array<{
    provider: string;
    requests: number;
    cost: number;
  }>;
  admins_count?: number;
  devs_count?: number;
  completed_count?: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await getStats();
      setStats(response.data);
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-400">Загрузка...</div>;
  }

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
          <p className="text-3xl font-bold text-white">{stats?.users_count || 0}</p>
          <p className="text-sm text-gray-500">
            {stats?.admins_count || 0} админов, {stats?.devs_count || 0} разработчиков
          </p>
        </div>

        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-600 rounded-lg">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-400">Запросы</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.requests_count || 0}</p>
          <p className="text-sm text-gray-500">
            {stats?.completed_count || 0} выполнено
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
            ${(stats?.total_provider_cost || 0).toFixed(6)}
          </p>
          <p className="text-sm text-gray-500">
            {(stats?.total_credits_spent || 0).toFixed(2)} кредитов
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
            {(stats?.tokens_input || 0) + (stats?.tokens_output || 0)}
          </p>
          <p className="text-sm text-gray-500">
            {stats?.tokens_input || 0} вход / {stats?.tokens_output || 0} выход
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
                <td className="py-3 text-gray-300">${p.cost.toFixed(6)}</td>
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