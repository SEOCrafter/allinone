import { useEffect, useState } from 'react';
import { getAdapters, getAdaptersStatus, getAdaptersBalances, testAdapter, healthCheckAdapter } from '../api/client';
import { Activity, Send, RefreshCw } from 'lucide-react';

interface Adapter {
  name: string;
  display_name: string;
  type: string;
  models: Array<{
    id: string;
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
  balance: number | null;
  note?: string;
  error?: string;
}

interface TestResult {
  ok: boolean;
  frontend_request: any;
  provider_request: any;
  provider_response_raw: any;
  parsed?: any;
  error?: any;
}

export default function Adapters() {
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [statuses, setStatuses] = useState<AdapterStatus[]>([]);
  const [balances, setBalances] = useState<AdapterBalance[]>([]);
  const [loading, setLoading] = useState(true);

  // Test form
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
    setLoading(true);
    try {
      const [adaptersRes, statusRes, balancesRes] = await Promise.all([
        getAdapters(),
        getAdaptersStatus(),
        getAdaptersBalances(),
      ]);
      setAdapters(adaptersRes.data.adapters);
      setStatuses(statusRes.data.adapters);
      setBalances(balancesRes.data.balances);

      if (adaptersRes.data.adapters.length > 0) {
        setSelectedAdapter(adaptersRes.data.adapters[0].name);
        if (adaptersRes.data.adapters[0].models?.length > 0) {
          setSelectedModel(adaptersRes.data.adapters[0].models[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load adapters:', err);
    } finally {
      setLoading(false);
    }
  };

  // Фильтруем адаптеры по типу
  const filteredAdapters = adapters.filter(a => a.type === selectedType);

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    const filtered = adapters.filter(a => a.type === type);
    if (filtered.length > 0) {
      setSelectedAdapter(filtered[0].name);
      if (filtered[0].models?.length > 0) {
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
    if (adapter?.models?.length > 0) {
      setSelectedModel(adapter.models[0].id);
    } else {
      setSelectedModel('');
    }
    setTestResult(null);
  };

  const handleHealthCheck = async (name: string) => {
    try {
      const response = await healthCheckAdapter(name);
      alert(`Status: ${response.data.status}\nLatency: ${response.data.latency_ms}ms`);
      loadData();
    } catch (err: any) {
      alert(`Health check failed: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleTest = async () => {
    if (!selectedAdapter || !testMessage) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const response = await testAdapter(selectedAdapter, testMessage, selectedModel || undefined);
      setTestResult(response.data);
    } catch (err: any) {
      setTestResult({
        ok: false,
        frontend_request: { message: testMessage, model: selectedModel },
        provider_request: null,
        provider_response_raw: null,
        error: err.response?.data || err.message,
      });
    } finally {
      setTestLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'active':
        return 'text-green-400';
      case 'degraded':
        return 'text-yellow-400';
      case 'unhealthy':
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'active':
        return 'bg-green-600';
      case 'degraded':
        return 'bg-yellow-600';
      case 'unhealthy':
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  const currentAdapter = adapters.find((a) => a.name === selectedAdapter);

  // Получаем уникальные типы
  const types = [...new Set(adapters.map(a => a.type))];

  if (loading) {
    return <div className="p-6 text-gray-400">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Adapters</h1>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-[#3f3f3f] hover:bg-[#4f4f4f] text-white rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Status & Balances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Status */}
        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Status</h2>
          <div className="space-y-2">
            {statuses.map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusBg(s.status)}`}>
                    {s.status.toUpperCase()}
                  </span>
                  <span className="text-white">{s.name}</span>
                  {s.latency_ms && (
                    <span className="text-gray-500 text-sm">{s.latency_ms}ms</span>
                  )}
                </div>
                <button
                  onClick={() => handleHealthCheck(s.name)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                >
                  Health
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Balances */}
        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Account Balances</h2>
          <div className="space-y-2">
            {balances.map((b) => (
              <div key={b.provider} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`${getStatusColor(b.status)}`}>●</span>
                  <span className="text-white">{b.provider}</span>
                </div>
                <div className="text-gray-400 text-sm">{b.note || b.error || 'OK'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Test Form */}
      <div className="bg-[#2f2f2f] rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Test Adapter</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Type */}
          <div>
            <label className="block text-gray-400 mb-2">Type</label>
            <select
              value={selectedType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
            >
              {types.length > 0 ? types.map((t) => (
                <option key={t} value={t}>{t}</option>
              )) : <option value="text">text</option>}
            </select>
          </div>

          {/* Adapter */}
          <div>
            <label className="block text-gray-400 mb-2">Provider</label>
            <select
              value={selectedAdapter}
              onChange={(e) => handleAdapterChange(e.target.value)}
              className="w-full px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
            >
              {filteredAdapters.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div>
            <label className="block text-gray-400 mb-2">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
            >
              {currentAdapter?.models?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                </option>
              ))}
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block text-gray-400 mb-2">Message</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Enter test message..."
                className="flex-1 px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
                onKeyDown={(e) => e.key === 'Enter' && handleTest()}
              />
              <button
                onClick={handleTest}
                disabled={testLoading || !testMessage}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg"
              >
                {testLoading ? '...' : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Test Results - 4 Windows */}
        {testResult && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            {/* 1. Frontend Request */}
            <div className="bg-[#252525] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">1. FRONTEND REQUEST</h3>
              <p className="text-xs text-gray-500 mb-2">Запрос от фронтенда к нашему API</p>
              <pre className="text-gray-300 text-xs whitespace-pre-wrap break-words overflow-auto max-h-48">
                {JSON.stringify(testResult.frontend_request, null, 2)}
              </pre>
            </div>

            {/* 2. Provider Request */}
            <div className="bg-[#252525] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-400 mb-2">2. PROVIDER REQUEST</h3>
              <p className="text-xs text-gray-500 mb-2">Запрос к провайдеру (OpenAI/Anthropic)</p>
              <pre className="text-gray-300 text-xs whitespace-pre-wrap break-words overflow-auto max-h-48">
                {testResult.provider_request 
                  ? JSON.stringify(testResult.provider_request, null, 2)
                  : 'N/A'}
              </pre>
            </div>

            {/* 3. Provider Response Raw */}
            <div className="bg-[#252525] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-orange-400 mb-2">3. PROVIDER RESPONSE RAW</h3>
              <p className="text-xs text-gray-500 mb-2">Сырой ответ от провайдера</p>
              <pre className="text-gray-300 text-xs whitespace-pre-wrap break-words overflow-auto max-h-48">
                {testResult.provider_response_raw
                  ? JSON.stringify(testResult.provider_response_raw, null, 2)
                  : testResult.error 
                    ? JSON.stringify(testResult.error, null, 2)
                    : 'N/A'}
              </pre>
            </div>

            {/* 4. Parsed Response */}
            <div className="bg-[#252525] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-green-400 mb-2">4. PARSED RESPONSE</h3>
              <p className="text-xs text-gray-500 mb-2">Распарсенный ответ</p>
              {testResult.parsed ? (
                <div className="text-gray-300 text-sm space-y-2">
                  <div className="break-words">
                    <span className="text-gray-500">Content:</span>
                    <p className="mt-1 bg-[#1a1a1a] p-2 rounded">{testResult.parsed.content}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-[#1a1a1a] p-2 rounded">
                      <span className="text-gray-500">Tokens In:</span>
                      <span className="ml-1">{testResult.parsed.tokens_input}</span>
                    </div>
                    <div className="bg-[#1a1a1a] p-2 rounded">
                      <span className="text-gray-500">Tokens Out:</span>
                      <span className="ml-1">{testResult.parsed.tokens_output}</span>
                    </div>
                    <div className="bg-[#1a1a1a] p-2 rounded">
                      <span className="text-gray-500">Cost:</span>
                      <span className="ml-1">${testResult.parsed.provider_cost_usd?.toFixed(6)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-red-400">Error</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Models Table */}
      <div className="bg-[#2f2f2f] rounded-lg p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Available Models</h2>
        <table className="w-full">
          <thead>
            <tr className="text-gray-400 text-left">
              <th className="pb-3">Provider</th>
              <th className="pb-3">Model</th>
              <th className="pb-3">Type</th>
              <th className="pb-3">Input / 1K</th>
              <th className="pb-3">Output / 1K</th>
            </tr>
          </thead>
          <tbody>
            {adapters.flatMap((adapter) =>
              adapter.models?.map((model) => (
                <tr key={`${adapter.name}-${model.id}`} className="border-t border-gray-700">
                  <td className="py-3 text-white">{adapter.display_name}</td>
                  <td className="py-3 text-gray-300">{model.id}</td>
                  <td className="py-3 text-gray-300">{model.type}</td>
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