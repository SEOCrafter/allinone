import { useState, useCallback, useEffect } from 'react';
import { 
  getStatsUsersDetails, 
  getUserGenerations, 
  getStatsPeriods, 
  getStatsCharts 
} from '../api/client';
import { 
  Loader2, 
  ChevronDown, 
  ChevronRight, 
  Users, 
  Calendar, 
  BarChart3,
  DollarSign,
  Zap,
  UserPlus
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

type TabType = 'users' | 'periods' | 'charts';

interface UserStats {
  id: string;
  email: string | null;
  name: string | null;
  telegram_id: number | null;
  created_at: string | null;
  payments: number;
  tax_5_percent: number;
  generations_count: number;
  cost: number;
  revenue: number;
  profit: number;
  credits_balance: number;
}

interface Generation {
  id: string;
  created_at: string | null;
  model: string;
  provider: string;
  type: string;
  status: string;
  tokens_input: number | null;
  tokens_output: number | null;
  cost: number;
  revenue: number;
  profit: number;
  prompt: string | null;
}

interface PeriodStats {
  period: string;
  name: string;
  new_users: number;
  generations: number;
  payments: number;
  cost: number;
  revenue: number;
  profit: number;
  tax: number;
  net_profit: number;
}

interface ChartDataPoint {
  date: string;
  new_users: number;
  total_users: number;
  generations: number;
  cost: number;
  revenue: number;
  profit: number;
  payments: number;
}

interface ChartResponse {
  days: number;
  start_date: string;
  end_date: string;
  data: ChartDataPoint[];
  totals: {
    new_users: number;
    generations: number;
    cost: number;
    revenue: number;
    profit: number;
    payments: number;
  };
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatShortDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

const formatMoney = (value: number, decimals = 2) => {
  if (Math.abs(value) < 0.01) return '$0.00';
  return '$' + value.toFixed(decimals);
};

const formatNumber = (value: number) => {
  return value.toLocaleString('ru-RU');
};

function UsersTab() {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [generationsLoading, setGenerationsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStatsUsersDetails(page, 20);
      setUsers(res.data.users || []);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const loadGenerations = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    setGenerationsLoading(true);
    try {
      const res = await getUserGenerations(userId, 1, 20);
      setGenerations(res.data.generations || []);
    } catch (err) {
      console.error('Failed to load generations:', err);
      setGenerations([]);
    } finally {
      setGenerationsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="pb-3 pr-4"></th>
              <th className="pb-3 pr-4">Пользователь</th>
              <th className="pb-3 pr-4">Дата рег.</th>
              <th className="pb-3 pr-4 text-right">Платежи</th>
              <th className="pb-3 pr-4 text-right">Налог 5%</th>
              <th className="pb-3 pr-4 text-right">Генерации</th>
              <th className="pb-3 pr-4 text-right">Себест.</th>
              <th className="pb-3 pr-4 text-right">Доход</th>
              <th className="pb-3 pr-4 text-right">Прибыль</th>
              <th className="pb-3 text-right">Баланс</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <>
                <tr 
                  key={user.id}
                  className="border-b border-gray-700/50 hover:bg-[#353535] cursor-pointer"
                  onClick={() => user.generations_count > 0 && loadGenerations(user.id)}
                >
                  <td className="py-3 pr-4">
                    {user.generations_count > 0 && (
                      expandedUser === user.id 
                        ? <ChevronDown className="w-4 h-4 text-gray-400" />
                        : <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="text-white">{user.name || user.email || `TG: ${user.telegram_id}` || 'Без имени'}</div>
                    {user.email && user.name && (
                      <div className="text-gray-500 text-xs">{user.email}</div>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-gray-300">{formatDate(user.created_at)?.split(',')[0]}</td>
                  <td className="py-3 pr-4 text-right text-white">{formatMoney(user.payments)}</td>
                  <td className="py-3 pr-4 text-right text-red-400">{formatMoney(user.tax_5_percent)}</td>
                  <td className="py-3 pr-4 text-right text-white">{formatNumber(user.generations_count)}</td>
                  <td className="py-3 pr-4 text-right text-orange-400">{formatMoney(user.cost, 4)}</td>
                  <td className="py-3 pr-4 text-right text-blue-400">{formatMoney(user.revenue, 2)}</td>
                  <td className={`py-3 pr-4 text-right ${user.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatMoney(user.profit, 2)}
                  </td>
                  <td className="py-3 text-right text-white">{user.credits_balance.toFixed(2)}</td>
                </tr>
                {expandedUser === user.id && (
                  <tr key={`${user.id}-expanded`}>
                    <td colSpan={10} className="bg-[#252525] p-4">
                      {generationsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-white" />
                        </div>
                      ) : generations.length === 0 ? (
                        <div className="text-gray-500 text-center py-4">Нет генераций</div>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-gray-500">
                              <th className="pb-2 pr-3">Дата/Время</th>
                              <th className="pb-2 pr-3">Модель</th>
                              <th className="pb-2 pr-3">Провайдер</th>
                              <th className="pb-2 pr-3">Тип</th>
                              <th className="pb-2 pr-3">Статус</th>
                              <th className="pb-2 pr-3 text-right">Токены</th>
                              <th className="pb-2 pr-3 text-right">Себест.</th>
                              <th className="pb-2 pr-3 text-right">Доход</th>
                              <th className="pb-2 text-right">Прибыль</th>
                            </tr>
                          </thead>
                          <tbody>
                            {generations.map((gen) => (
                              <tr key={gen.id} className="border-t border-gray-700/30">
                                <td className="py-2 pr-3 text-gray-300">{formatDate(gen.created_at)}</td>
                                <td className="py-2 pr-3 text-white">{gen.model}</td>
                                <td className="py-2 pr-3 text-gray-300">{gen.provider}</td>
                                <td className="py-2 pr-3 text-gray-300">{gen.type}</td>
                                <td className="py-2 pr-3">
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    gen.status === 'completed' ? 'bg-green-900/50 text-green-400' :
                                    gen.status === 'failed' ? 'bg-red-900/50 text-red-400' :
                                    'bg-yellow-900/50 text-yellow-400'
                                  }`}>
                                    {gen.status}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 text-right text-gray-300">
                                  {gen.tokens_input || gen.tokens_output 
                                    ? `${gen.tokens_input || 0}/${gen.tokens_output || 0}` 
                                    : '—'}
                                </td>
                                <td className="py-2 pr-3 text-right text-orange-400">{formatMoney(gen.cost, 4)}</td>
                                <td className="py-2 pr-3 text-right text-blue-400">{formatMoney(gen.revenue, 2)}</td>
                                <td className={`py-2 text-right ${gen.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {formatMoney(gen.profit, 2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-[#3f3f3f] hover:bg-[#4f4f4f] disabled:opacity-50 rounded text-white text-sm"
          >
            ←
          </button>
          <span className="px-3 py-1 text-white text-sm">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 bg-[#3f3f3f] hover:bg-[#4f4f4f] disabled:opacity-50 rounded text-white text-sm"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

function PeriodsTab() {
  const [periods, setPeriods] = useState<PeriodStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getStatsPeriods();
        setPeriods(res.data.periods || []);
      } catch (err) {
        console.error('Failed to load periods:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {periods.map((period) => (
        <div key={period.period} className="bg-[#252525] rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">{period.name}</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400 flex items-center gap-1">
                <UserPlus className="w-3 h-3" /> Новых польз.
              </span>
              <span className="text-white">{period.new_users}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Генераций
              </span>
              <span className="text-white">{formatNumber(period.generations)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400 flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Платежи
              </span>
              <span className="text-green-400">{formatMoney(period.payments)}</span>
            </div>

            <div className="border-t border-gray-700 my-2"></div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Себестоимость</span>
              <span className="text-orange-400">{formatMoney(period.cost, 4)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Доход</span>
              <span className="text-blue-400">{formatMoney(period.revenue)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Прибыль</span>
              <span className={period.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                {formatMoney(period.profit)}
              </span>
            </div>

            <div className="border-t border-gray-700 my-2"></div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Налог 5%</span>
              <span className="text-red-400">-{formatMoney(period.tax)}</span>
            </div>
            
            <div className="flex justify-between font-semibold">
              <span className="text-gray-300">Чистая прибыль</span>
              <span className={period.net_profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                {formatMoney(period.net_profit)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartsTab() {
  const [chartData, setChartData] = useState<ChartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getStatsCharts(days);
        setChartData(res.data);
      } catch (err) {
        console.error('Failed to load charts:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!chartData) {
    return <div className="text-gray-500 text-center py-8">Нет данных</div>;
  }

  const data = chartData.data.map(d => ({
    ...d,
    dateLabel: formatShortDate(d.date)
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {[7, 14, 30, 90, 365].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded text-sm ${
                days === d 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-[#3f3f3f] text-gray-300 hover:bg-[#4f4f4f]'
              }`}
            >
              {d === 365 ? 'Год' : `${d} дн.`}
            </button>
          ))}
        </div>
        
        <div className="flex gap-4 text-sm">
          <div className="text-gray-400">
            Период: <span className="text-white">{chartData.start_date} — {chartData.end_date}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#252525] rounded-lg p-3">
          <div className="text-gray-400 text-xs">Новых пользователей</div>
          <div className="text-xl font-bold text-white">{chartData.totals.new_users}</div>
        </div>
        <div className="bg-[#252525] rounded-lg p-3">
          <div className="text-gray-400 text-xs">Генераций</div>
          <div className="text-xl font-bold text-white">{formatNumber(chartData.totals.generations)}</div>
        </div>
        <div className="bg-[#252525] rounded-lg p-3">
          <div className="text-gray-400 text-xs">Себестоимость</div>
          <div className="text-xl font-bold text-orange-400">{formatMoney(chartData.totals.cost, 2)}</div>
        </div>
        <div className="bg-[#252525] rounded-lg p-3">
          <div className="text-gray-400 text-xs">Доход</div>
          <div className="text-xl font-bold text-blue-400">{formatMoney(chartData.totals.revenue)}</div>
        </div>
        <div className="bg-[#252525] rounded-lg p-3">
          <div className="text-gray-400 text-xs">Прибыль</div>
          <div className={`text-xl font-bold ${chartData.totals.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatMoney(chartData.totals.profit)}
          </div>
        </div>
      </div>

      <div className="bg-[#252525] rounded-lg p-4">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" /> Пользователи
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="dateLabel" stroke="#888" fontSize={10} />
            <YAxis stroke="#888" fontSize={10} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#2f2f2f', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#fff' }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="total_users" 
              name="Всего пользователей" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="new_users" 
              name="Новых" 
              stroke="#22c55e" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#252525] rounded-lg p-4">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4" /> Генерации
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="dateLabel" stroke="#888" fontSize={10} />
            <YAxis stroke="#888" fontSize={10} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#2f2f2f', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#fff' }}
            />
            <Area 
              type="monotone" 
              dataKey="generations" 
              name="Генерации" 
              stroke="#8b5cf6" 
              fill="#8b5cf6" 
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#252525] rounded-lg p-4">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> Финансы
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="dateLabel" stroke="#888" fontSize={10} />
            <YAxis stroke="#888" fontSize={10} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#2f2f2f', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#fff' }}
              formatter={(value: number) => formatMoney(value)}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              name="Доход" 
              stroke="#3b82f6" 
              fill="#3b82f6" 
              fillOpacity={0.3}
            />
            <Area 
              type="monotone" 
              dataKey="profit" 
              name="Прибыль" 
              stroke="#22c55e" 
              fill="#22c55e" 
              fillOpacity={0.3}
            />
            <Area 
              type="monotone" 
              dataKey="cost" 
              name="Себестоимость" 
              stroke="#f97316" 
              fill="#f97316" 
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Stats() {
  const [activeTab, setActiveTab] = useState<TabType>('periods');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'users', label: 'Пользователи', icon: <Users className="w-4 h-4" /> },
    { id: 'periods', label: 'Периоды', icon: <Calendar className="w-4 h-4" /> },
    { id: 'charts', label: 'Графики', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Статистика</h1>
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-[#2f2f2f] text-gray-300 hover:bg-[#3f3f3f]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-[#2f2f2f] rounded-lg p-4">
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'periods' && <PeriodsTab />}
        {activeTab === 'charts' && <ChartsTab />}
      </div>
    </div>
  );
}