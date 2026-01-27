import { useEffect, useState } from 'react';
import { getAdapters, getAdaptersStatus, getAdaptersBalances, testAdapter, healthCheckAdapter, setProviderBalance } from '../api/client';
import { Send, RefreshCw, Loader2, Save } from 'lucide-react';

interface Adapter {
  name: string;
  display_name: string;
  type: string;
  models: Array<{
    id: string;
    display_name?: string;
    type: string;
    pricing: {
      input_per_1k: number;
      output_per_1k: number;
    };
  }>;
}

interface AdapterStatus {
  name: string;
  status: string;
  latency_ms: number | null;
  error: string | null;
}

interface AdapterBalance {
  provider: string;
  status: string;
  balance_usd: number | null;
  total_deposited_usd?: number;
  total_spent_usd?: number;
  updated_at?: string;
}

interface TestResult {
  ok: boolean;
  frontend_request: Record<string, unknown>;
  provider_request: Record<string, unknown> | null;
  provider_response_raw: Record<string, unknown> | null;
  parsed?: {
    content: string;
    tokens_input: number;
    tokens_output: number;
    provider_cost_usd: number;
  };
  error?: Record<string, unknown>;
}

export default function Adapters() {
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [statuses, setStatuses] = useState<AdapterStatus[]>([]);
  const [balances, setBalances] = useState<AdapterBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthCheckLoading, setHealthCheckLoading] = useState<Record<string, boolean>>({});
  const [balanceInputs, setBalanceInputs] = useState<Record<string, string>>({});
  const [balanceSaving, setBalanceSaving] = useState<Record<string, boolean>>({});

  const [selectedType, setSelectedType] = useState<string>('text');
  const [selectedAdapter, setSelectedAdapter] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [testMessage, setTestMessage] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    console.log('loadData started');
    setLoading(true);
    const token = localStorage.getItem('token');
    const BASE = 'http://95.140.153.151:8100/api/v1';
    
    // Adapters
    let adaptersData: Adapter[] = [];
    try {
      const res = await fetch(`${BASE}/admin/adapters`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        adaptersData = data.adapters || [];
      }
    } catch (err) {
      console.error('Adapters failed:', err);
    }
    
    // Balances
    let balancesData: AdapterBalance[] = [];
    try {
      const res = await fetch(`${BASE}/admin/adapters/balances`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        balancesData = data.balances || [];
      }
    } catch (err) {
      console.error('Balances failed:', err);
    }
    
    setAdapters(adaptersData);
    setBalances(balancesData);
    
    const inputs: Record<string, string> = {};
    balancesData.forEach((b) => {
      inputs[b.provider] = b.balance_usd?.toString() || '0';
    });
    setBalanceInputs(inputs);

    if (adaptersData.length > 0) {
      setSelectedAdapter(adaptersData[0].name);
      if (adaptersData[0].models?.length > 0) {
        setSelectedModel(adaptersData[0].models[0].id);
      }
    }
    
    setLoading(false);
    
    // Status в фоне
    try {
      const res = await fetch(`${BASE}/admin/adapters/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatuses(data.adapters || []);
      }
    } catch (err) {
      console.error('Status failed:', err);
    }
  };

  const handleSaveBalance = async (provider: string) => {
    const value = parseFloat(balanceInputs[provider] || '0');
    if (isNaN(value) || value < 0) return;

    setBalanceSaving(prev => ({ ...prev, [provider]: true }));
    try {
      await setProviderBalance(provider, value);
      // Обновляем локально
      setBalances(prev => prev.map(b => 
        b.provider === provider 
          ? { ...b, balance_usd: value, total_deposited_usd: value, total_spent_usd: 0 }
          : b
      ));
    } catch (err) {
      console.error('Ошибка сохранения:', err);
    } finally {
      setBalanceSaving(prev => ({ ...prev, [provider]: false }));
    }
  };

  const filteredAdapters = adapters.filter(a => a.type === selectedType);

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    const filtered = adapters.filter(a => a.type === type);
    if (filtered.length > 0) {
      setSelectedAdapter(filtered[0].name);
      if (filtered[0].models && filtered[0].models.length > 0) {
        setSelectedModel(filtered[0].models[0].id);
      } else {
        setSelectedModel('');
      }
    } else {
      setSelectedAdapter('');
      setSelectedModel('');
    }
    setTestResult(null);
  };

  const handleAdapterChange = (name: string) => {
    setSelectedAdapter(name);
    const adapter = adapters.find((a) => a.name === name);
    if (adapter && adapter.models && adapter.models.length > 0) {
      setSelectedModel(adapter.models[0].id);
    } else {
      setSelectedModel('');
    }
    setTestResult(null);
  };

  const handleHealthCheck = async (name: string) => {
    setHealthCheckLoading(prev => ({ ...prev, [name]: true }));
    try {
      const response = await healthCheckAdapter(name);
      setStatuses(prev => prev.map(s => 
        s.name === name 
          ? { ...s, status: response.data.status, latency_ms: response.data.latency_ms, error: response.data.error }
          : s
      ));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      setStatuses(prev => prev.map(s => 
        s.name === name 
          ? { ...s, status: 'error', error: error.response?.data?.detail || error.message || 'Unknown error' }
          : s
      ));
    } finally {
      setHealthCheckLoading(prev => ({ ...prev, [name]: false }));
    }
  };

  const handleHealthCheckAll = async () => {
    const names = statuses.map(s => s.name);
    names.forEach(name => setHealthCheckLoading(prev => ({ ...prev, [name]: true })));
    
    await Promise.all(names.map(async (name) => {
      try {
        const response = await healthCheckAdapter(name);
        setStatuses(prev => prev.map(s => 
          s.name === name 
            ? { ...s, status: response.data.status, latency_ms: response.data.latency_ms, error: response.data.error }
            : s
        ));
      } catch (err: unknown) {
        const error = err as { response?: { data?: { detail?: string } }; message?: string };
        setStatuses(prev => prev.map(s => 
          s.name === name 
            ? { ...s, status: 'error', error: error.response?.data?.detail || error.message || 'Unknown error' }
            : s
        ));
      } finally {
        setHealthCheckLoading(prev => ({ ...prev, [name]: false }));
      }
    }));
  };

  const handleTest = async () => {
    if (!selectedAdapter || !testMessage) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const response = await testAdapter(selectedAdapter, testMessage, selectedModel || undefined);
      setTestResult(response.data);
      // Обновляем балансы после теста
      const balancesRes = await getAdaptersBalances();
      setBalances(balancesRes.data.balances);
      const inputs: Record<string, string> = {};
      balancesRes.data.balances.forEach((b: AdapterBalance) => {
        inputs[b.provider] = b.balance_usd?.toString() || '0';
      });
      setBalanceInputs(inputs);
    } catch (err: unknown) {
      const error = err as { response?: { data?: unknown }; message?: string };
      setTestResult({
        ok: false,
        frontend_request: { message: testMessage, model: selectedModel },
        provider_request: null,
        provider_response_raw: null,
        error: (error.response?.data as Record<string, unknown>) || { message: error.message },
      });
    } finally {
      setTestLoading(false);
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'active':
        return 'bg-green-600';
      case 'degraded':
      case 'low':
        return 'bg-yellow-600';
      case 'unhealthy':
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'РАБОТАЕТ';
      case 'active':
        return 'АКТИВЕН';
      case 'degraded':
        return 'ДЕГРАДАЦИЯ';
      case 'low':
        return 'МАЛО';
      case 'unhealthy':
        return 'НЕДОСТУПЕН';
      case 'error':
        return 'ОШИБКА';
      default:
        return status.toUpperCase();
    }
  };

  const currentAdapter = adapters.find((a) => a.name === selectedAdapter);
  const types = [...new Set(adapters.map(a => a.type))];

  if (loading) {
    return <div className="p-6 text-gray-400">Загрузка...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Адаптеры</h1>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-[#3f3f3f] hover:bg-[#4f4f4f] text-white rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Статус провайдеров */}
        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Статус провайдеров</h2>
            <button
              onClick={handleHealthCheckAll}
              disabled={Object.values(healthCheckLoading).some(Boolean)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded"
            >
              Проверить все
            </button>
          </div>
          <div className="space-y-2">
            {statuses.map((s) => (
              <div key={s.name} className="flex items-center justify-between bg-[#252525] rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusBg(s.status)} transition-all`}>
                    {getStatusText(s.status)}
                  </span>
                  <span className="text-white">{s.name}</span>
                  {s.latency_ms && <span className="text-gray-500 text-sm">{s.latency_ms}мс</span>}
                </div>
                <button
                  onClick={() => handleHealthCheck(s.name)}
                  disabled={healthCheckLoading[s.name]}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded flex items-center gap-1"
                >
                  {healthCheckLoading[s.name] ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Проверить'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Балансы аккаунтов */}
        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Балансы аккаунтов</h2>
          <div className="space-y-3">
            {balances.map((b) => (
              <div key={b.provider} className="bg-[#252525] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{b.provider}</span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusBg(b.status)}`}>
                    {getStatusText(b.status)}
                  </span>
                </div>
                
                {/* Ввод баланса */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={balanceInputs[b.provider] || ''}
                    onChange={(e) => setBalanceInputs(prev => ({ ...prev, [b.provider]: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white text-lg font-bold"
                  />
                  <button
                    onClick={() => handleSaveBalance(b.provider)}
                    disabled={balanceSaving[b.provider]}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded flex items-center gap-1"
                  >
                    {balanceSaving[b.provider] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </button>
                </div>

                {/* Статистика */}
                {b.total_deposited_usd !== undefined && (
                  <div className="text-xs text-gray-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Внесено:</span>
                      <span className="text-green-400">${b.total_deposited_usd?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Потрачено:</span>
                      <span className="text-red-400">${b.total_spent_usd?.toFixed(6)}</span>
                    </div>
                    {b.updated_at && (
                      <div className="flex justify-between">
                        <span>Обновлено:</span>
                        <span>{new Date(b.updated_at).toLocaleString('ru')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Тестирование */}
      <div className="bg-[#2f2f2f] rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Тестирование адаптера</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-gray-400 mb-2">Тип</label>
            <select
              value={selectedType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
            >
              {types.length > 0 ? types.map((t) => (
                <option key={t} value={t}>{t === 'text' ? 'Текст' : t === 'image' ? 'Изображение' : t === 'audio' ? 'Аудио' : t}</option>
              )) : <option value="text">Текст</option>}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-2">Провайдер</label>
            <select
              value={selectedAdapter}
              onChange={(e) => handleAdapterChange(e.target.value)}
              className="w-full px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
            >
              {filteredAdapters.map((a) => (
                <option key={a.name} value={a.name}>{a.display_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-2">Модель</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
            >
              {currentAdapter?.models?.map((m) => (
                <option key={m.id} value={m.id}>{m.display_name || m.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-2">Сообщение</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Введите сообщение..."
                className="flex-1 px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
                onKeyDown={(e) => e.key === 'Enter' && handleTest()}
              />
              <button
                onClick={handleTest}
                disabled={testLoading || !testMessage}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg"
              >
                {testLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {testResult && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-[#252525] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">1. ЗАПРОС ОТ ФРОНТЕНДА</h3>
              <pre className="text-gray-300 text-xs whitespace-pre-wrap break-words overflow-auto max-h-48">
                {JSON.stringify(testResult.frontend_request, null, 2)}
              </pre>
            </div>
            <div className="bg-[#252525] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-400 mb-2">2. ЗАПРОС К ПРОВАЙДЕРУ</h3>
              <pre className="text-gray-300 text-xs whitespace-pre-wrap break-words overflow-auto max-h-48">
                {testResult.provider_request ? JSON.stringify(testResult.provider_request, null, 2) : 'Н/Д'}
              </pre>
            </div>
            <div className="bg-[#252525] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-orange-400 mb-2">3. СЫРОЙ ОТВЕТ</h3>
              <pre className="text-gray-300 text-xs whitespace-pre-wrap break-words overflow-auto max-h-48">
                {testResult.provider_response_raw
                  ? JSON.stringify(testResult.provider_response_raw, null, 2)
                  : testResult.error 
                    ? JSON.stringify(testResult.error, null, 2)
                    : 'Н/Д'}
              </pre>
            </div>
            <div className="bg-[#252525] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-green-400 mb-2">4. РАСПАРСЕННЫЙ ОТВЕТ</h3>
              {testResult.parsed ? (
                <div className="text-gray-300 text-sm space-y-2">
                  <p className="bg-[#1a1a1a] p-2 rounded">{testResult.parsed.content}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-[#1a1a1a] p-2 rounded">Вход: {testResult.parsed.tokens_input}</div>
                    <div className="bg-[#1a1a1a] p-2 rounded">Выход: {testResult.parsed.tokens_output}</div>
                    <div className="bg-[#1a1a1a] p-2 rounded">Цена: ${testResult.parsed.provider_cost_usd?.toFixed(6)}</div>
                  </div>
                </div>
              ) : (
                <div className="text-red-400">Ошибка</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Таблица моделей */}
      <div className="bg-[#2f2f2f] rounded-lg p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Доступные модели</h2>
        <table className="w-full">
          <thead>
            <tr className="text-gray-400 text-left">
              <th className="pb-3">Провайдер</th>
              <th className="pb-3">Модель</th>
              <th className="pb-3">Тип</th>
              <th className="pb-3">Вход / 1K</th>
              <th className="pb-3">Выход / 1K</th>
            </tr>
          </thead>
          <tbody>
            {adapters.flatMap((adapter) =>
              adapter.models?.map((model) => (
                <tr key={`${adapter.name}-${model.id}`} className="border-t border-gray-700">
                  <td className="py-3 text-gray-300">{model.display_name || model.id}</td>
                  <td className="py-3 text-gray-300">{model.id}</td>
                  <td className="py-3 text-gray-300">{model.type === 'text' ? 'Текст' : model.type}</td>
                  <td className="py-3 text-gray-300">${model.pricing.input_per_1k.toFixed(4)}</td>
                  <td className="py-3 text-gray-300">${model.pricing.output_per_1k.toFixed(4)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}