import { useCallback } from 'react';
import { getStats } from '../api/client';
import { Users, MessageSquare, DollarSign, Zap, Loader2 } from 'lucide-react';
import { useLoadData } from '../hooks/useLoadData';

interface Stats {
  users: { total: number; by_role: Record<string, number> };
  requests: { total: number; by_status: Record<string, number> };
  costs: { total_credits_spent: number; total_provider_cost_usd: number };
  tokens: { total_input: number; total_output: number };
  by_provider: Array<{ provider: string; requests: number; cost_usd: number }>;
}

const defaultStats: Stats = {
  users: { total: 0, by_role: {} },
  requests: { total: 0, by_status: {} },
  costs: { total_credits_spent: 0, total_provider_cost_usd: 0 },
  tokens: { total_input: 0, total_output: 0 },
  by_provider: [],
};

export default function Dashboard() {
  const loadFn = useCallback(async (signal: AbortSignal) => {
    const res = await getStats({ signal });
    return res.data.stats || defaultStats;
  }, []);

  const { data: stats, loading } = useLoadData<Stats>(loadFn, defaultStats);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  const adminsCount = (stats.users.by_role?.['admin'] || 0) + (stats.users.by_role?.['superadmin'] || 0);
  const devsCount = stats.users.by_role?.['developer'] || 0;
  const completedCount = stats.requests.by_status?.['completed'] || 0;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Дашборд</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-400">Пользователи</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats.users.total}</p>
          <p className="text-sm text-gray-500">{adminsCount} админов, {devsCount} разработчиков</p>
        </div>

        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-600 rounded-lg">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-400">Запросы</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats.requests.total}</p>
          <p className="text-sm text-gray-500">{completedCount} выполнено</p>
        </div>

        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-600 rounded-lg">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-400">Расходы провайдеров</span>
          </div>
          <p className="text-3xl font-bold text-white">${stats.costs.total_provider_cost_usd.toFixed(6)}</p>
          <p className="text-sm text-gray-500">{stats.costs.total_credits_spent.toFixed(2)} кредитов</p>
        </div>

        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-400">Токены</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats.tokens.total_input + stats.tokens.total_output}</p>
          <p className="text-sm text-gray-500">{stats.tokens.total_input} вход / {stats.tokens.total_output} выход</p>
        </div>
      </div>

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
            {stats.by_provider.map((p) => (
              <tr key={p.provider} className="border-t border-gray-700">
                <td className="py-3 text-white">{p.provider}</td>
                <td className="py-3 text-gray-300">{p.requests}</td>
                <td className="py-3 text-gray-300">${p.cost_usd.toFixed(6)}</td>
              </tr>
            ))}
            {stats.by_provider.length === 0 && (
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