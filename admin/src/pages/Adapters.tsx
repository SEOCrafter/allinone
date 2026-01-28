import { useEffect, useState } from 'react';
import { healthCheckAdapter, setProviderBalance } from '../api/client';
import { Send, RefreshCw, Loader2, Save, Pencil, Check, X } from 'lucide-react';
import axios from 'axios';
import { flushSync } from 'react-dom';

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
      per_request?: number;
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

interface ModelSettingData {
  credits_price: number | null;
  is_enabled: boolean;
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

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = 10000) => {
  console.log('[fetchWithTimeout] START:', url, 'timeout:', timeoutMs);
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.log('[fetchWithTimeout] TIMEOUT TRIGGERED:', url);
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    console.log('[fetchWithTimeout] RESPONSE:', url, 'status:', response.status, 'ok:', response.ok);
    return response;
  } catch (e) {
    console.error('[fetchWithTimeout] ERROR:', url, e);
    throw e;
  } finally {
    clearTimeout(timeout);
    console.log('[fetchWithTimeout] FINALLY:', url);
  }
};

export default function Adapters() {
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [statuses, setStatuses] = useState<AdapterStatus[]>([]);
  const [balances, setBalances] = useState<AdapterBalance[]>([]);
  const [modelSettings, setModelSettings] = useState<Record<string, ModelSettingData>>({});
  const [loading, setLoading] = useState(true);
  const [healthCheckLoading, setHealthCheckLoading] = useState<Record<string, boolean>>({});
  const [balanceInputs, setBalanceInputs] = useState<Record<string, string>>({});
  const [balanceSaving, setBalanceSaving] = useState<Record<string, boolean>>({});

  const [editingCredits, setEditingCredits] = useState<string | null>(null);
  const [creditsInput, setCreditsInput] = useState<string>('');
  const [savingSettings, setSavingSettings] = useState<Record<string, boolean>>({});

  const [selectedType, setSelectedType] = useState<string>('text');
  const [selectedAdapter, setSelectedAdapter] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [testMessage, setTestMessage] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const BASE = '/api/v1';

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, []);

  const loadData = async (signal?: AbortSignal) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const t = Date.now();

    try {
      const [adaptersRes, balancesRes] = await Promise.all([
        axios.get(`${BASE}/admin/adapters?_t=${t}`, { headers, signal }),
        axios.get(`${BASE}/admin/adapters/balances?_t=${t}`, { headers, signal }),
        axios.get(`${BASE}/admin/models/settings?_t=${t}`, { headers, signal }),
      ]);

      const adaptersData = adaptersRes.data.adapters || [];
      const balancesData = balancesRes.data.balances || [];
      const settingsData: Record<string, ModelSettingData> = {};

      const inputs: Record<string, string> = {};
      balancesData.forEach((b: AdapterBalance) => {
        inputs[b.provider] = b.balance_usd?.toString() || '0';
      });

      flushSync(() => {
        setAdapters(adaptersData);
        setBalances(balancesData);
        setModelSettings(settingsData);
        setBalanceInputs(inputs);
        if (adaptersData.length > 0) {
          setSelectedAdapter(adaptersData[0].name);
          if (adaptersData[0].models?.length > 0) {
            setSelectedModel(adaptersData[0].models[0].id);
          }
        }
        setLoading(false);
      });
      
      axios.get(`${BASE}/admin/adapters/status?_t=${t}`, { headers })
        .then(res => setStatuses(res.data.adapters || []))
        .catch(console.error);
        
    } catch (e) {
      if (axios.isCancel(e)) return;
      console.error('[loadData] ERROR:', e);
      setLoading(false);
    }
  };
  const handleSaveBalance = async (provider: string) => {
    const value = parseFloat(balanceInputs[provider] || '0');
    if (isNaN(value) || value < 0) return;

    setBalanceSaving(prev => ({ ...prev, [provider]: true }));
    try {
      await setProviderBalance(provider, value);
      setBalances(prev => prev.map(b => 
        b.provider === provider 
          ? { ...b, balance_usd: value, total_deposited_usd: value, total_spent_usd: 0 }
          : b
      ));
    } catch (e) {
      console.error('Ошибка сохранения:', e);
    } finally {
      setBalanceSaving(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleEditCredits = (adapterName: string, modelId: string) => {
    const key = `${adapterName}:${modelId}`;
    const current = modelSettings[key]?.credits_price;
    setEditingCredits(key);
    setCreditsInput(current?.toString() || '');
  };

  const handleSaveCredits = async (adapterName: string, modelId: string) => {
    const key = `${adapterName}:${modelId}`;
    const value = creditsInput ? parseFloat(creditsInput) : null;
    
    setSavingSettings(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetchWithTimeout(
        `${BASE}/admin/models/${adapterName}/${encodeURIComponent(modelId)}/settings`,
        { method: 'POST', headers: getHeaders(), body: JSON.stringify({ credits_price: value }) },
        10000
      );
      if (res.ok) {
        setModelSettings(prev => ({
          ...prev,
          [key]: { 
            credits_price: value, 
            is_enabled: prev[key]?.is_enabled ?? true 
          }
        }));
      }
    } catch (e) {
      console.error('Ошибка сохранения:', e);
    } finally {
      setSavingSettings(prev => ({ ...prev, [key]: false }));
      setEditingCredits(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingCredits(null);
    setCreditsInput('');
  };

  const handleToggleEnabled = async (adapterName: string, modelId: string) => {
    const key = `${adapterName}:${modelId}`;
    const currentEnabled = modelSettings[key]?.is_enabled ?? true;
    const newEnabled = !currentEnabled;
    
    setSavingSettings(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetchWithTimeout(
        `${BASE}/admin/models/${adapterName}/${encodeURIComponent(modelId)}/settings`,
        { method: 'POST', headers: getHeaders(), body: JSON.stringify({ is_enabled: newEnabled }) },
        10000
      );
      if (res.ok) {
        setModelSettings(prev => ({
          ...prev,
          [key]: { 
            credits_price: prev[key]?.credits_price ?? null,
            is_enabled: newEnabled 
          }
        }));
      }
    } catch (e) {
      console.error('Ошибка переключения:', e);
    } finally {
      setSavingSettings(prev => ({ ...prev, [key]: false }));
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
    } catch (e) {
      const error = e as { response?: { data?: { detail?: string } }; message?: string };
      setStatuses(prev => prev.map(s => 
        s.name === name 
          ? { ...s, status: 'error', error: error.response?.data?.detail || error.message || 'Unknown error' }
          : s
      ));
    } finally {
      setHealthCheckLoading(prev => ({ ...prev, [name]: false }));
    }
  };

  const handleTest = async () => {
    if (!testMessage || !selectedAdapter) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      const res = await fetchWithTimeout(
        `${BASE}/admin/adapters/${selectedAdapter}/test`,
        { method: 'POST', headers: getHeaders(), body: JSON.stringify({ message: testMessage, model: selectedModel || undefined }) },
        60000
      );
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ ok: false, frontend_request: {}, provider_request: null, provider_response_raw: null, error: { message: 'Ошибка запроса или таймаут' } });
    } finally {
      setTestLoading(false);
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-600';
      case 'active': return 'bg-green-600';
      case 'degraded': return 'bg-yellow-600';
      case 'low': return 'bg-yellow-600';
      case 'unhealthy': return 'bg-red-600';
      case 'error': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy': return 'OK';
      case 'active': return 'Активен';
      case 'degraded': return 'Проблемы';
      case 'low': return 'Мало';
      case 'unhealthy': return 'Ошибка';
      case 'error': return 'Ошибка';
      default: return status;
    }
  };

  const types = [...new Set(adapters.map(a => a.type))];
  const currentAdapter = adapters.find((a) => a.name === selectedAdapter);

  const formatPrice = (price: number) => {
    if (price === 0) return '$0.0000';
    if (price < 0.0001) return `$${price.toFixed(6)}`;
    if (price < 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  if (loading) {
    console.log('[render] Loading state = true, showing spinner');
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  console.log('[render] Loading state = false, rendering content. Adapters:', adapters.length, 'Balances:', balances.length);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Адаптеры</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Статус провайдеров</h2>
          <div className="space-y-2">
            {statuses.map((s) => (
              <div key={s.name} className="flex items-center justify-between bg-[#252525] px-4 py-2 rounded-lg">
                <span className="text-gray-300">{s.name}</span>
                <div className="flex items-center gap-2">
                  {s.latency_ms && <span className="text-gray-400 text-sm">{s.latency_ms}ms</span>}
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusBg(s.status)}`}>
                    {getStatusText(s.status)}
                  </span>
                  <button
                    onClick={() => handleHealthCheck(s.name)}
                    disabled={healthCheckLoading[s.name]}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    {healthCheckLoading[s.name] ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

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
                <option key={t} value={t}>{t === 'text' ? 'Текст' : t === 'image' ? 'Изображение' : t === 'video' ? 'Видео' : t === 'audio' ? 'Аудио' : t}</option>
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

      <div className="bg-[#2f2f2f] rounded-lg p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Доступные модели</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-gray-400 text-left">
                <th className="pb-3">Название</th>
                <th className="pb-3">Модель ID</th>
                <th className="pb-3">Тип</th>
                <th className="pb-3">Себестоимость</th>
                <th className="pb-3">Кредиты</th>
                <th className="pb-3 text-center">Статус</th>
              </tr>
            </thead>
            <tbody>
              {adapters.flatMap((adapter) =>
                adapter.models?.map((model) => {
                  const key = `${adapter.name}:${model.id}`;
                  const settings = modelSettings[key] || { credits_price: null, is_enabled: true };
                  const isEditing = editingCredits === key;
                  const isSaving = savingSettings[key];

                  return (
                    <tr key={key} className={`border-t border-gray-700 ${!settings.is_enabled ? 'opacity-50' : ''}`}>
                      <td className="py-3 text-gray-300">{model.display_name || model.id}</td>
                      <td className="py-3 text-gray-500 text-sm font-mono">{model.id}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          model.type === 'text' ? 'bg-blue-600' : 
                          model.type === 'image' ? 'bg-purple-600' : 
                          model.type === 'video' ? 'bg-pink-600' : 'bg-gray-600'
                        }`}>
                          {model.type === 'text' ? 'Текст' : 
                           model.type === 'image' ? 'Изображение' : 
                           model.type === 'video' ? 'Видео' : model.type}
                        </span>
                      </td>
                      <td className="py-3 text-gray-300 text-sm">
                        {model.type === 'text' 
                          ? `${formatPrice(model.pricing.input_per_1k)} / ${formatPrice(model.pricing.output_per_1k)}`
                          : formatPrice(model.pricing.per_request || model.pricing.input_per_1k)
                        }
                      </td>
                      <td className="py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.0001"
                              value={creditsInput}
                              onChange={(e) => setCreditsInput(e.target.value)}
                              className="w-24 px-2 py-1 bg-[#3f3f3f] border border-gray-600 rounded text-white text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveCredits(adapter.name, model.id);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                            />
                            <button
                              onClick={() => handleSaveCredits(adapter.name, model.id)}
                              disabled={isSaving}
                              className="p-1 text-green-400 hover:text-green-300"
                            >
                              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1 text-red-400 hover:text-red-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`${settings.credits_price !== null ? 'text-green-400 font-medium' : 'text-gray-500'}`}>
                              {settings.credits_price !== null ? settings.credits_price.toFixed(4) : '—'}
                            </span>
                            <button
                              onClick={() => handleEditCredits(adapter.name, model.id)}
                              className="p-1 text-gray-400 hover:text-white"
                              title="Редактировать цену"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => handleToggleEnabled(adapter.name, model.id)}
                          disabled={isSaving}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.is_enabled ? 'bg-green-600' : 'bg-gray-600'
                          } ${isSaving ? 'opacity-50' : ''}`}
                          title={settings.is_enabled ? 'Включено' : 'Отключено'}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.is_enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}