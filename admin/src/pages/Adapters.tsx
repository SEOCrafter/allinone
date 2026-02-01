import { useEffect, useState, useRef } from 'react';
import { healthCheckAdapter, setProviderBalance } from '../api/client';
import { Send, RefreshCw, Loader2, Save, Pencil, Check, X } from 'lucide-react';
import axios from 'axios';

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

interface PriceVariant {
  label: string;
  duration?: number;
  sound?: boolean;
  price_usd?: number;
  price_per_second?: number;
  mode?: string;
}

interface ProviderPrice {
  model_name: string;
  provider: string;
  price_usd: number;
  price_type: string;
  is_active: boolean;
  replicate_model_id: string | null;
  price_variants: Record<string, PriceVariant> | null;
}

interface ModelStat {
  model: string;
  provider: string;
  type: string;
  request_count: number;
  avg_video_duration: number | null;
  avg_tokens_input: number | null;
  avg_tokens_output: number | null;
  avg_tokens_total: number | null;
  avg_provider_cost: number | null;
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

interface UnifiedModel {
  name: string;
  modelId: string;
  type: string;
  provider: string;
  providerDisplay: string;
  priceType: string;
  priceUsd: number;
  priceUsdOutput?: number;
  isActive: boolean;
  settingsKey: string;
  priceVariants?: Record<string, PriceVariant> | null;
}

export default function Adapters() {
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [statuses, setStatuses] = useState<AdapterStatus[]>([]);
  const [balances, setBalances] = useState<AdapterBalance[]>([]);
  const [modelSettings, setModelSettings] = useState<Record<string, ModelSettingData>>({});
  const [providerPrices, setProviderPrices] = useState<ProviderPrice[]>([]);
  const [modelStats, setModelStats] = useState<Record<string, ModelStat>>({});
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

  const [modelTypeFilter, setModelTypeFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const loadedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const BASE = '/api/v1';

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  useEffect(() => {
    if (loadedRef.current && adapters.length > 0) return;
    loadedRef.current = true;
    mountedRef.current = true;
    
    abortRef.current = new AbortController();
    loadData(abortRef.current.signal);
    
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const loadData = async (signal: AbortSignal) => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const t = Date.now();

    try {
      const [adaptersRes, balancesRes, settingsRes, pricesRes, statsRes] = await Promise.all([
        axios.get(`${BASE}/admin/adapters?_t=${t}`, { headers, signal }),
        axios.get(`${BASE}/admin/adapters/balances?_t=${t}`, { headers, signal }),
        axios.get(`${BASE}/admin/models/settings?_t=${t}`, { headers, signal }),
        axios.get(`${BASE}/admin/adapters/models/prices?_t=${t}`, { headers, signal }),
        axios.get(`${BASE}/admin/adapters/models/stats?_t=${t}`, { headers, signal }),
      ]);

      if (signal.aborted || !mountedRef.current) return;

      const adaptersData = adaptersRes.data.adapters || [];
      const balancesData = balancesRes.data.balances || [];
      const settingsData = settingsRes.data.settings || {};
      const pricesData = pricesRes.data.prices || [];
      const statsData = statsRes.data.stats || {};

      const inputs: Record<string, string> = {};
      balancesData.forEach((b: AdapterBalance) => {
        inputs[b.provider] = b.balance_usd?.toString() || '0';
      });

      setAdapters(adaptersData);
      setBalances(balancesData);
      setModelSettings(settingsData);
      setProviderPrices(pricesData);
      setModelStats(statsData);
      setBalanceInputs(inputs);
      
      if (adaptersData.length > 0) {
        setSelectedAdapter(adaptersData[0].name);
        if (adaptersData[0].models?.length > 0) {
          setSelectedModel(adaptersData[0].models[0].id);
        }
      }
      setLoading(false);
      
      axios.get(`${BASE}/admin/adapters/status?_t=${t}`, { headers, signal, timeout: 15000 })
        .then(res => {
          if (mountedRef.current) {
            setStatuses(res.data.adapters || []);
          }
        })
        .catch(() => {});
        
    } catch (e) {
      if (axios.isCancel(e) || signal.aborted) return;
      console.error('[loadData] ERROR:', e);
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setStatuses([]);
    loadData(abortRef.current.signal);
    
    const token = localStorage.getItem('token');
    axios.get(`${BASE}/admin/adapters/status?_t=${Date.now()}`, { 
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000 
    })
      .then(res => setStatuses(res.data.adapters || []))
      .catch(() => {});
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

  const handleEditCredits = (settingsKey: string) => {
    const current = modelSettings[settingsKey]?.credits_price;
    setEditingCredits(settingsKey);
    setCreditsInput(current?.toString() || '');
  };

  const handleSaveCredits = async (settingsKey: string) => {
    const value = creditsInput ? parseFloat(creditsInput) : null;
    const [adapterName, modelId] = settingsKey.split(':');
    
    setSavingSettings(prev => ({ ...prev, [settingsKey]: true }));
    try {
      const res = await axios.post(
        `${BASE}/admin/models/${adapterName}/${encodeURIComponent(modelId)}/settings`,
        { credits_price: value },
        { headers: getHeaders(), timeout: 10000 }
      );
      if (res.status === 200) {
        setModelSettings(prev => ({
          ...prev,
          [settingsKey]: { 
            credits_price: value, 
            is_enabled: prev[settingsKey]?.is_enabled ?? true 
          }
        }));
      }
    } catch (e) {
      console.error('Ошибка сохранения:', e);
    } finally {
      setSavingSettings(prev => ({ ...prev, [settingsKey]: false }));
      setEditingCredits(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingCredits(null);
    setCreditsInput('');
  };

  const handleToggleEnabled = async (settingsKey: string) => {
    const currentEnabled = modelSettings[settingsKey]?.is_enabled ?? true;
    const newEnabled = !currentEnabled;
    const [adapterName, modelId] = settingsKey.split(':');
    
    setSavingSettings(prev => ({ ...prev, [settingsKey]: true }));
    try {
      const res = await axios.post(
        `${BASE}/admin/models/${adapterName}/${encodeURIComponent(modelId)}/settings`,
        { is_enabled: newEnabled },
        { headers: getHeaders(), timeout: 10000 }
      );
      if (res.status === 200) {
        setModelSettings(prev => ({
          ...prev,
          [settingsKey]: { 
            credits_price: prev[settingsKey]?.credits_price ?? null,
            is_enabled: newEnabled 
          }
        }));
      }
    } catch (e) {
      console.error('Ошибка переключения:', e);
    } finally {
      setSavingSettings(prev => ({ ...prev, [settingsKey]: false }));
    }
  };

  const handleToggleVariantEnabled = async (model: UnifiedModel, variantKey: string) => {
    const variantSettingsKey = `${model.settingsKey}:${variantKey}`;
    const currentEnabled = modelSettings[variantSettingsKey]?.is_enabled ?? true;
    const newEnabled = !currentEnabled;
    
    setSavingSettings(prev => ({ ...prev, [variantSettingsKey]: true }));
    try {
      const [adapterName, modelId] = model.settingsKey.split(':');
      const res = await axios.post(
        `${BASE}/admin/models/${adapterName}/${encodeURIComponent(modelId + ':' + variantKey)}/settings`,
        { is_enabled: newEnabled },
        { headers: getHeaders(), timeout: 10000 }
      );
      if (res.status === 200) {
        const newSettings = {
          ...modelSettings,
          [variantSettingsKey]: { 
            credits_price: modelSettings[variantSettingsKey]?.credits_price ?? null,
            is_enabled: newEnabled 
          }
        };
        
        if (model.priceVariants) {
          const variantKeys = Object.keys(model.priceVariants);
          const anyEnabled = variantKeys.some(vk => {
            const vsk = `${model.settingsKey}:${vk}`;
            if (vk === variantKey) return newEnabled;
            return newSettings[vsk]?.is_enabled ?? true;
          });
          
          newSettings[model.settingsKey] = {
            credits_price: newSettings[model.settingsKey]?.credits_price ?? null,
            is_enabled: anyEnabled
          };
        }
        
        setModelSettings(newSettings);
      }
    } catch (e) {
      console.error('Ошибка переключения:', e);
    } finally {
      setSavingSettings(prev => ({ ...prev, [variantSettingsKey]: false }));
    }
  };

  const handleToggleAllVariants = async (model: UnifiedModel) => {
    if (!model.priceVariants) return;
    
    const mainEnabled = modelSettings[model.settingsKey]?.is_enabled ?? true;
    const newEnabled = !mainEnabled;
    
    setSavingSettings(prev => ({ ...prev, [model.settingsKey]: true }));
    
    try {
      const [adapterName, modelId] = model.settingsKey.split(':');
      
      await axios.post(
        `${BASE}/admin/models/${adapterName}/${encodeURIComponent(modelId)}/settings`,
        { is_enabled: newEnabled },
        { headers: getHeaders(), timeout: 10000 }
      );
      
      const variantKeys = Object.keys(model.priceVariants);
      await Promise.all(variantKeys.map(vk =>
        axios.post(
          `${BASE}/admin/models/${adapterName}/${encodeURIComponent(modelId + ':' + vk)}/settings`,
          { is_enabled: newEnabled },
          { headers: getHeaders(), timeout: 10000 }
        )
      ));
      
      const newSettings = { ...modelSettings };
      newSettings[model.settingsKey] = {
        credits_price: newSettings[model.settingsKey]?.credits_price ?? null,
        is_enabled: newEnabled
      };
      variantKeys.forEach(vk => {
        const vsk = `${model.settingsKey}:${vk}`;
        newSettings[vsk] = {
          credits_price: newSettings[vsk]?.credits_price ?? null,
          is_enabled: newEnabled
        };
      });
      setModelSettings(newSettings);
      
    } catch (e) {
      console.error('Ошибка переключения:', e);
    } finally {
      setSavingSettings(prev => ({ ...prev, [model.settingsKey]: false }));
    }
  };

  const getMainToggleState = (model: UnifiedModel): boolean => {
    if (!model.priceVariants || Object.keys(model.priceVariants).length === 0) {
      return modelSettings[model.settingsKey]?.is_enabled ?? true;
    }
    
    const variantKeys = Object.keys(model.priceVariants);
    return variantKeys.some(vk => {
      const vsk = `${model.settingsKey}:${vk}`;
      return modelSettings[vsk]?.is_enabled ?? true;
    });
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
      const res = await axios.post(
        `${BASE}/admin/adapters/${selectedAdapter}/test`,
        { message: testMessage, model: selectedModel || undefined },
        { headers: getHeaders(), timeout: 60000 }
      );
      setTestResult(res.data);
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

  const formatPrice = (price: number | undefined) => {
    if (price === undefined || price === null) return '—';
    if (price === 0) return '$0.0000';
    if (price < 0.0001) return `$${price.toFixed(6)}`;
    if (price < 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  const getVariantPrice = (variant: PriceVariant): string => {
    if (variant.price_usd !== undefined) {
      return formatPrice(variant.price_usd);
    }
    if (variant.price_per_second !== undefined) {
      return `${formatPrice(variant.price_per_second)}/сек`;
    }
    return '—';
  };

  const getPriceTypeLabel = (priceType: string) => {
    switch (priceType) {
      case 'per_second': return 'за сек';
      case 'per_image': return 'за изобр';
      case 'per_request': return 'за запрос';
      case 'per_generation': return 'за генер';
      case 'per_1k_tokens': return 'за 1K токенов';
      default: return priceType;
    }
  };

  const getProviderBadge = (provider: string, providerDisplay: string) => {
    if (provider === 'kie') {
      return <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-600">KIE</span>;
    }
    if (provider === 'replicate') {
      return <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-600">Replicate</span>;
    }
    if (provider === 'openai') {
      return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-700">OpenAI</span>;
    }
    if (provider === 'anthropic') {
      return <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-700">Anthropic</span>;
    }
    if (provider === 'gemini') {
      return <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-700">Gemini</span>;
    }
    if (provider === 'deepseek') {
      return <span className="px-2 py-0.5 rounded text-xs font-bold bg-cyan-700">DeepSeek</span>;
    }
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-600">{providerDisplay}</span>;
  };

  const getModelType = (modelName: string): string => {
    if (modelName.includes('flux') || modelName.includes('midjourney') || modelName.includes('nano') || modelName.includes('imagen') || modelName.includes('sd-') || modelName.includes('face-swap') || modelName.includes('photon') || modelName.includes('minimax-image') || modelName.includes('runway-gen4-image')) {
      return 'image';
    }
    if (modelName.includes('speech')) {
      return 'audio';
    }
    return 'video';
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'text':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-600">Текст</span>;
      case 'image':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-600">Изобр</span>;
      case 'video':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-pink-600">Видео</span>;
      case 'audio':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-teal-600">Аудио</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-600">{type}</span>;
    }
  };

  const calculateAvgCost = (model: UnifiedModel): { cost: number | null; count: number } => {
    let statsKey = `${model.provider}:${model.modelId}`;
    let stat = modelStats[statsKey];
    
    if (!stat && model.type === 'text') {
      statsKey = `direct:${model.modelId}`;
      stat = modelStats[statsKey];
    }
    
    if (!stat || stat.request_count === 0) {
      return { cost: null, count: 0 };
    }

    if (model.priceType === 'per_generation' || model.priceType === 'per_image' || model.priceType === 'per_request') {
      return { cost: null, count: 0 };
    }

    if (model.priceType === 'per_second' && stat.avg_video_duration) {
      return { cost: stat.avg_video_duration * model.priceUsd, count: stat.request_count };
    }

    if (model.priceType === 'per_1k_tokens') {
      if (stat.avg_provider_cost && stat.avg_provider_cost > 0) {
        return { cost: stat.avg_provider_cost, count: stat.request_count };
      }
      if (stat.avg_tokens_total) {
        if (model.priceUsdOutput && stat.avg_tokens_input && stat.avg_tokens_output) {
          const inputCost = (stat.avg_tokens_input / 1000) * model.priceUsd;
          const outputCost = (stat.avg_tokens_output / 1000) * model.priceUsdOutput;
          return { cost: inputCost + outputCost, count: stat.request_count };
        }
        const avgCost = (stat.avg_tokens_total / 1000) * model.priceUsd;
        return { cost: avgCost, count: stat.request_count };
      }
    }

    return { cost: null, count: 0 };
  };

  const unifiedModels: UnifiedModel[] = [];

  providerPrices.forEach(p => {
    const modelType = getModelType(p.model_name);
    unifiedModels.push({
      name: p.model_name,
      modelId: p.model_name,
      type: modelType,
      provider: p.provider,
      providerDisplay: p.provider === 'kie' ? 'KIE' : p.provider === 'replicate' ? 'Replicate' : p.provider,
      priceType: p.price_type,
      priceUsd: p.price_usd,
      isActive: p.is_active,
      settingsKey: `${p.provider}:${p.model_name}`,
      priceVariants: p.price_variants,
    });
  });

  adapters.filter(a => a.type === 'text').forEach(adapter => {
    adapter.models?.forEach(model => {
      unifiedModels.push({
        name: model.display_name || model.id,
        modelId: model.id,
        type: 'text',
        provider: adapter.name,
        providerDisplay: adapter.display_name,
        priceType: 'per_1k_tokens',
        priceUsd: model.pricing.input_per_1k,
        priceUsdOutput: model.pricing.output_per_1k,
        isActive: true,
        settingsKey: `${adapter.name}:${model.id}`,
      });
    });
  });

  const filteredModels = unifiedModels.filter(m => {
    if (modelTypeFilter === 'all') return true;
    return m.type === modelTypeFilter;
  }).sort((a, b) => a.name.localeCompare(b.name));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Адаптеры</h1>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-[#3f3f3f] hover:bg-[#4f4f4f] text-white rounded-lg flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Статус провайдеров</h2>
          <div className="space-y-2">
            {statuses.length === 0 ? (
              <div className="text-gray-500 text-center py-4">Нажмите "Обновить" для загрузки статусов</div>
            ) : statuses.map((s) => (
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Доступные модели</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setModelTypeFilter('all')}
              className={`px-3 py-1 rounded text-sm ${modelTypeFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-[#3f3f3f] text-gray-400'}`}
            >
              Все
            </button>
            <button
              onClick={() => setModelTypeFilter('text')}
              className={`px-3 py-1 rounded text-sm ${modelTypeFilter === 'text' ? 'bg-blue-600 text-white' : 'bg-[#3f3f3f] text-gray-400'}`}
            >
              Текст
            </button>
            <button
              onClick={() => setModelTypeFilter('video')}
              className={`px-3 py-1 rounded text-sm ${modelTypeFilter === 'video' ? 'bg-pink-600 text-white' : 'bg-[#3f3f3f] text-gray-400'}`}
            >
              Видео
            </button>
            <button
              onClick={() => setModelTypeFilter('image')}
              className={`px-3 py-1 rounded text-sm ${modelTypeFilter === 'image' ? 'bg-purple-600 text-white' : 'bg-[#3f3f3f] text-gray-400'}`}
            >
              Изображения
            </button>
            <button
              onClick={() => setModelTypeFilter('audio')}
              className={`px-3 py-1 rounded text-sm ${modelTypeFilter === 'audio' ? 'bg-teal-600 text-white' : 'bg-[#3f3f3f] text-gray-400'}`}
            >
              Аудио
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-gray-400 text-left text-sm">
                <th className="pb-3">Название</th>
                <th className="pb-3">Тип</th>
                <th className="pb-3">Провайдер</th>
                <th className="pb-3">Тип цены</th>
                <th className="pb-3">Себестоимость</th>
                <th className="pb-3">Среднее</th>
                <th className="pb-3">Токены</th>
                <th className="pb-3 text-center">Статус</th>
              </tr>
            </thead>
            <tbody>
              {filteredModels.map((model, idx) => {
                const settings = modelSettings[model.settingsKey] || { credits_price: null, is_enabled: true };
                const isEditing = editingCredits === model.settingsKey;
                const isSaving = savingSettings[model.settingsKey];
                const avgData = calculateAvgCost(model);
                const hasVariants = model.priceVariants && Object.keys(model.priceVariants).filter(k => k !== 'constraints' && k !== 'display_name').length > 0;
                const isExpanded = expandedRows.has(model.settingsKey);

                return (
                  <>
                    <tr key={`${model.settingsKey}-${idx}`} className={`border-t border-gray-700 ${!model.isActive ? 'opacity-50' : ''}`}>
                      <td className="py-3 text-white font-medium">
                        <div className="flex items-center gap-2">
                          {hasVariants && (
                            <button
                              onClick={() => {
                                const newExpanded = new Set(expandedRows);
                                if (newExpanded.has(model.settingsKey)) {
                                  newExpanded.delete(model.settingsKey);
                                } else {
                                  newExpanded.add(model.settingsKey);
                                }
                                setExpandedRows(newExpanded);
                              }}
                              className="w-5 h-5 flex items-center justify-center rounded bg-[#3f3f3f] hover:bg-[#4f4f4f] text-green-400 text-sm font-bold"
                              title="Показать варианты цен"
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          )}
                          {model.name}
                        </div>
                      </td>
                      <td className="py-3">{getTypeBadge(model.type)}</td>
                      <td className="py-3">{getProviderBadge(model.provider, model.providerDisplay)}</td>
                      <td className="py-3 text-gray-400 text-sm">{getPriceTypeLabel(model.priceType)}</td>
                      <td className="py-3 text-green-400 font-mono text-sm">
                        {model.priceUsdOutput 
                          ? `${formatPrice(model.priceUsd)} / ${formatPrice(model.priceUsdOutput)}`
                          : formatPrice(model.priceUsd)
                        }
                      </td>
                      <td className="py-3 text-sm">
                        {avgData.cost !== null ? (
                          <span className="text-yellow-400 font-mono" title={`На основе ${avgData.count} запросов`}>
                            {formatPrice(avgData.cost)}
                            <span className="text-gray-500 text-xs ml-1">({avgData.count})</span>
                          </span>
                        ) : avgData.count > 0 ? (
                          <span className="text-gray-500" title="Фиксированная цена">—</span>
                        ) : (
                          <span className="text-gray-600" title="Нет данных">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.0001"
                              value={creditsInput}
                              onChange={(e) => setCreditsInput(e.target.value)}
                              className="w-20 px-2 py-1 bg-[#3f3f3f] border border-gray-600 rounded text-white text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveCredits(model.settingsKey);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                            />
                            <button
                              onClick={() => handleSaveCredits(model.settingsKey)}
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
                              onClick={() => handleEditCredits(model.settingsKey)}
                              className="p-1 text-gray-400 hover:text-white"
                              title="Редактировать цену"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {hasVariants ? (
                          <button
                            onClick={() => handleToggleAllVariants(model)}
                            disabled={isSaving}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              getMainToggleState(model) ? 'bg-green-600' : 'bg-gray-600'
                            } ${isSaving ? 'opacity-50' : ''}`}
                            title={getMainToggleState(model) ? 'Выключить все варианты' : 'Включить все варианты'}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                getMainToggleState(model) ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleEnabled(model.settingsKey)}
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
                        )}
                      </td>
                    </tr>
                    {hasVariants && isExpanded && Object.entries(model.priceVariants!).filter(([variantKey]) => variantKey !== 'constraints' && variantKey !== 'display_name').map(([variantKey, variant]) => {
                      const variantSettingsKey = `${model.settingsKey}:${variantKey}`;
                      const variantSettings = modelSettings[variantSettingsKey] || { credits_price: null, is_enabled: true };
                      const isVariantEditing = editingCredits === variantSettingsKey;
                      const isVariantSaving = savingSettings[variantSettingsKey];

                      return (
                        <tr key={variantSettingsKey} className="bg-[#1a1a1a]">
                          <td className="py-2 pl-10 text-gray-300 text-sm">
                            ↳ {variant.label}
                          </td>
                          <td className="py-2"></td>
                          <td className="py-2"></td>
                          <td className="py-2"></td>
                          <td className="py-2 text-green-400 font-mono text-sm">
                            {getVariantPrice(variant)}
                          </td>
                          <td className="py-2 text-sm">
                            <span className="text-gray-600">—</span>
                          </td>
                          <td className="py-2">
                            {isVariantEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.0001"
                                  value={creditsInput}
                                  onChange={(e) => setCreditsInput(e.target.value)}
                                  className="w-20 px-2 py-1 bg-[#3f3f3f] border border-gray-600 rounded text-white text-sm"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveCredits(variantSettingsKey);
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                />
                                <button
                                  onClick={() => handleSaveCredits(variantSettingsKey)}
                                  disabled={isVariantSaving}
                                  className="p-1 text-green-400 hover:text-green-300"
                                >
                                  {isVariantSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
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
                                <span className={`${variantSettings.credits_price !== null ? 'text-green-400 font-medium' : 'text-gray-500'}`}>
                                  {variantSettings.credits_price !== null ? variantSettings.credits_price.toFixed(4) : '—'}
                                </span>
                                <button
                                  onClick={() => handleEditCredits(variantSettingsKey)}
                                  className="p-1 text-gray-400 hover:text-white"
                                  title="Редактировать цену"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-2 text-center">
                            <button
                              onClick={() => handleToggleVariantEnabled(model, variantKey)}
                              disabled={isVariantSaving}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                variantSettings.is_enabled ? 'bg-green-600' : 'bg-gray-600'
                              } ${isVariantSaving ? 'opacity-50' : ''}`}
                              title={variantSettings.is_enabled ? 'Включено' : 'Отключено'}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  variantSettings.is_enabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}