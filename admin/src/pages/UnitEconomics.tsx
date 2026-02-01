import { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { Calculator, TrendingUp, DollarSign, Percent, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface AdapterModel {
  id: string;
  display_name?: string;
  type: string;
  pricing: {
    input_per_1k: number;
    output_per_1k: number;
    per_request?: number;
    price_type?: string;
  };
}

interface Adapter {
  name: string;
  display_name: string;
  type: string;
  models?: AdapterModel[];
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

interface UnifiedModel {
  id: string;
  name: string;
  provider: string;
  providerDisplay: string;
  type: 'text' | 'image' | 'video' | 'audio';
  priceType: string;
  priceUsd: number;
  priceUsdOutput?: number;
  priceVariants: Record<string, PriceVariant> | null;
  hasVariants: boolean;
}

type PricingMode = 'base' | 'average' | 'variant';

interface TariffCalculation {
  id: string;
  name: string;
  currency: 'RUB' | 'USD';
  subscriptionPrice: number;
  creditsInPlan: number;
  requestsInPlan: number;
  avgTokensInput: number;
  avgTokensOutput: number;
  overheadPercent: number;
  selectedModel: string;
  pricingMode: PricingMode;
  selectedVariant: string;
  avgDuration: number;
  createdAt: number;
}

interface CalculationResult {
  creditsPerRequest: number;
  pricePerCredit: number;
  pricePerRequest: number;
  costPerRequest: number;
  costWithOverhead: number;
  profitPerRequest: number;
  marginPercent: number;
  totalCost: number;
  totalProfit: number;
}

const STORAGE_KEY = 'unit_economics_calculations_v2';

const PROVIDER_NAMES: Record<string, string> = {
  kie: 'KIE',
  replicate: 'Replicate',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
  xai: 'xAI',
};

const getModelType = (name: string): 'text' | 'image' | 'video' | 'audio' => {
  if (
    name.includes('flux') || name.includes('midjourney') || name.includes('nano') ||
    name.includes('imagen') || name.includes('sd-') || name.includes('face-swap') ||
    name.includes('photon') || name.includes('minimax-image') || name.includes('runway-gen4-image')
  ) return 'image';
  if (name.includes('speech')) return 'audio';
  return 'video';
};

const prettifyProvider = (p: string) => PROVIDER_NAMES[p] || p.charAt(0).toUpperCase() + p.slice(1);

const prettifyModelName = (name: string) =>
  name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

const TYPE_LABELS: Record<string, string> = {
  text: 'Текст',
  image: 'Изображения',
  video: 'Видео',
  audio: 'Аудио',
};

const PRICE_TYPE_LABELS: Record<string, string> = {
  per_1k_tokens: 'за 1K токенов',
  per_second: 'за секунду',
  per_generation: 'за генерацию',
  per_image: 'за изображение',
  per_request: 'за запрос',
};

export default function UnitEconomics() {
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [providerPrices, setProviderPrices] = useState<ProviderPrice[]>([]);
  const [modelStats, setModelStats] = useState<Record<string, ModelStat>>({});
  const [loading, setLoading] = useState(true);

  const [savedCalculations, setSavedCalculations] = useState<TariffCalculation[]>([]);
  const [expandedCalcs, setExpandedCalcs] = useState<Set<string>>(new Set());

  const [tariffName, setTariffName] = useState('');
  const [currency, setCurrency] = useState<'RUB' | 'USD'>('RUB');
  const [subscriptionPrice, setSubscriptionPrice] = useState<number>(990);
  const [creditsInPlan, setCreditsInPlan] = useState<number>(3000);
  const [requestsInPlan, setRequestsInPlan] = useState<number>(500);
  const [avgTokensInput, setAvgTokensInput] = useState<number>(500);
  const [avgTokensOutput, setAvgTokensOutput] = useState<number>(1000);
  const [overheadPercent, setOverheadPercent] = useState<number>(15);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [usdRate, setUsdRate] = useState<number>(95);

  const [pricingMode, setPricingMode] = useState<PricingMode>('base');
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [avgDuration, setAvgDuration] = useState<number>(5);
  const [showVariantDetails, setShowVariantDetails] = useState(false);
  const [useActualAvg, setUseActualAvg] = useState(false);

  const loadedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (loadedRef.current && adapters.length > 0) return;
    loadedRef.current = true;
    abortRef.current = new AbortController();
    loadData(abortRef.current.signal);
    loadSavedCalculations();
    return () => {
      abortRef.current?.abort();
      loadedRef.current = false;
    };
  }, []);

  const loadData = async (signal: AbortSignal) => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const t = Date.now();

    try {
      const [adaptersRes, pricesRes, statsRes] = await Promise.all([
        axios.get(`/api/v1/admin/adapters?_t=${t}`, { headers, signal }),
        axios.get(`/api/v1/admin/adapters/models/prices?_t=${t}`, { headers, signal }),
        axios.get(`/api/v1/admin/adapters/models/stats?_t=${t}`, { headers, signal }),
      ]);
      if (signal.aborted) return;

      const a = adaptersRes.data.adapters || [];
      const p = pricesRes.data.prices || [];
      const s = statsRes.data.stats || {};
      setAdapters(a);
      setProviderPrices(p);
      setModelStats(s);
    } catch (err) {
      if (axios.isCancel(err) || signal.aborted) return;
      console.error('Ошибка загрузки:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedCalculations = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSavedCalculations(JSON.parse(saved));
    } catch {}
  };

  const saveCalculations = (calcs: TariffCalculation[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calcs));
    setSavedCalculations(calcs);
  };

  const unifiedModels = useMemo((): UnifiedModel[] => {
    const models: UnifiedModel[] = [];

    adapters.filter(a => a.type === 'text').forEach(adapter => {
      adapter.models?.forEach(model => {
        models.push({
          id: `${adapter.name}:${model.id}`,
          name: `${adapter.display_name} — ${model.display_name || model.id}`,
          provider: adapter.name,
          providerDisplay: adapter.display_name,
          type: 'text',
          priceType: 'per_1k_tokens',
          priceUsd: model.pricing.input_per_1k,
          priceUsdOutput: model.pricing.output_per_1k,
          priceVariants: null,
          hasVariants: false,
        });
      });
    });

    providerPrices.forEach(p => {
      const variantEntries = p.price_variants
        ? Object.entries(p.price_variants).filter(([k]) => k !== 'constraints' && k !== 'display_name')
        : [];

      models.push({
        id: `${p.provider}:${p.model_name}`,
        name: `${prettifyProvider(p.provider)} — ${prettifyModelName(p.model_name)}`,
        provider: p.provider,
        providerDisplay: prettifyProvider(p.provider),
        type: getModelType(p.model_name),
        priceType: p.price_type,
        priceUsd: p.price_usd,
        priceVariants: p.price_variants,
        hasVariants: variantEntries.length > 0,
      });
    });

    return models.sort((a, b) => a.name.localeCompare(b.name));
  }, [adapters, providerPrices]);

  const modelsByType = useMemo(() => {
    const groups: Record<string, UnifiedModel[]> = { text: [], image: [], video: [], audio: [] };
    unifiedModels.forEach(m => {
      if (groups[m.type]) groups[m.type].push(m);
    });
    return groups;
  }, [unifiedModels]);

  useEffect(() => {
    if (unifiedModels.length > 0 && !selectedModel) {
      setSelectedModel(unifiedModels[0].id);
    }
  }, [unifiedModels]);

  const currentModel = useMemo(() => {
    return unifiedModels.find(m => m.id === selectedModel) || null;
  }, [unifiedModels, selectedModel]);

  const currentVariants = useMemo(() => {
    if (!currentModel?.priceVariants) return [];
    return Object.entries(currentModel.priceVariants)
      .filter(([k]) => k !== 'constraints' && k !== 'display_name')
      .map(([key, v]) => ({ key, ...v }));
  }, [currentModel]);

  useEffect(() => {
    if (currentModel) {
      if (!currentModel.hasVariants) {
        setPricingMode('base');
        setSelectedVariant('');
      } else if (pricingMode === 'variant' && currentVariants.length > 0 && !selectedVariant) {
        setSelectedVariant(currentVariants[0].key);
      }
    }
  }, [currentModel]);

  const getVariantCost = (v: PriceVariant): number => {
    if (v.price_usd !== undefined && v.price_usd > 0) return v.price_usd;
    if (v.price_per_second !== undefined) return v.price_per_second * (v.duration || avgDuration);
    return 0;
  };

  const actualAvgCost = useMemo((): { cost: number | null; count: number } => {
    if (!currentModel) return { cost: null, count: 0 };

    let statsKey = `${currentModel.provider}:${currentModel.id.split(':')[1] || ''}`;
    let stat = modelStats[statsKey];
    if (!stat) {
      const modelId = currentModel.id.includes(':') ? currentModel.id.split(':')[1] : currentModel.id;
      statsKey = `${currentModel.provider}:${modelId}`;
      stat = modelStats[statsKey];
    }
    if (!stat) {
      const modelId = currentModel.id.includes(':') ? currentModel.id.split(':')[1] : currentModel.id;
      statsKey = `direct:${modelId}`;
      stat = modelStats[statsKey];
    }
    if (!stat || stat.request_count === 0) return { cost: null, count: 0 };

    if (currentModel.priceType === 'per_second' && stat.avg_video_duration) {
      return { cost: stat.avg_video_duration * currentModel.priceUsd, count: stat.request_count };
    }
    if (currentModel.priceType === 'per_1k_tokens') {
      if (stat.avg_provider_cost && stat.avg_provider_cost > 0) {
        return { cost: stat.avg_provider_cost, count: stat.request_count };
      }
      if (stat.avg_tokens_total) {
        if (currentModel.priceUsdOutput && stat.avg_tokens_input && stat.avg_tokens_output) {
          const inputCost = (stat.avg_tokens_input / 1000) * currentModel.priceUsd;
          const outputCost = (stat.avg_tokens_output / 1000) * currentModel.priceUsdOutput;
          return { cost: inputCost + outputCost, count: stat.request_count };
        }
        return { cost: (stat.avg_tokens_total / 1000) * currentModel.priceUsd, count: stat.request_count };
      }
    }
    if (stat.avg_provider_cost && stat.avg_provider_cost > 0) {
      return { cost: stat.avg_provider_cost, count: stat.request_count };
    }
    return { cost: null, count: 0 };
  }, [currentModel, modelStats, avgDuration]);

  const hasActualAvg = actualAvgCost.cost !== null && actualAvgCost.count > 0;

  const effectiveCost = useMemo((): number => {
    if (!currentModel) return 0;

    if (useActualAvg && hasActualAvg && actualAvgCost.cost !== null) {
      return actualAvgCost.cost;
    }

    if (currentModel.priceType === 'per_1k_tokens') {
      return (avgTokensInput / 1000) * currentModel.priceUsd +
             (avgTokensOutput / 1000) * (currentModel.priceUsdOutput || 0);
    }

    if (currentModel.hasVariants && currentVariants.length > 0) {
      if (pricingMode === 'average') {
        const costs = currentVariants.map(v => getVariantCost(v)).filter(c => c > 0);
        if (costs.length > 0) return costs.reduce((a, b) => a + b, 0) / costs.length;
      }
      if (pricingMode === 'variant' && selectedVariant) {
        const v = currentModel.priceVariants?.[selectedVariant];
        if (v) return getVariantCost(v);
      }
    }

    if (currentModel.priceType === 'per_second') {
      return currentModel.priceUsd * avgDuration;
    }

    return currentModel.priceUsd;
  }, [currentModel, useActualAvg, hasActualAvg, actualAvgCost, pricingMode, selectedVariant, avgDuration, avgTokensInput, avgTokensOutput, currentVariants]);

  const calculation = useMemo((): CalculationResult | null => {
    if (!currentModel || requestsInPlan === 0 || creditsInPlan === 0) return null;

    const priceInUsd = currency === 'USD' ? subscriptionPrice : subscriptionPrice / usdRate;
    const creditsPerRequest = creditsInPlan / requestsInPlan;
    const pricePerCredit = priceInUsd / creditsInPlan;
    const pricePerRequest = priceInUsd / requestsInPlan;

    const costPerRequest = effectiveCost;
    const costWithOverhead = costPerRequest * (1 + overheadPercent / 100);
    const profitPerRequest = pricePerRequest - costWithOverhead;
    const marginPercent = pricePerRequest > 0 ? (profitPerRequest / pricePerRequest) * 100 : 0;
    const totalCost = costWithOverhead * requestsInPlan;
    const totalProfit = profitPerRequest * requestsInPlan;

    return {
      creditsPerRequest, pricePerCredit, pricePerRequest,
      costPerRequest, costWithOverhead, profitPerRequest,
      marginPercent, totalCost, totalProfit,
    };
  }, [currentModel, effectiveCost, subscriptionPrice, creditsInPlan, requestsInPlan, overheadPercent, currency, usdRate]);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    setPricingMode('base');
    setSelectedVariant('');
    setShowVariantDetails(false);
    setUseActualAvg(false);
  };

  const handlePricingModeChange = (mode: PricingMode) => {
    setPricingMode(mode);
    if (mode === 'variant' && currentVariants.length > 0 && !selectedVariant) {
      setSelectedVariant(currentVariants[0].key);
    }
  };

  const handleSaveCalculation = () => {
    if (!tariffName.trim()) {
      alert('Введите название тарифа');
      return;
    }
    const newCalc: TariffCalculation = {
      id: Date.now().toString(),
      name: tariffName,
      currency, subscriptionPrice, creditsInPlan, requestsInPlan,
      avgTokensInput, avgTokensOutput, overheadPercent,
      selectedModel, pricingMode, selectedVariant, avgDuration,
      createdAt: Date.now(),
    };
    saveCalculations([...savedCalculations, newCalc]);
    setTariffName('');
  };

  const handleDeleteCalculation = (id: string) => {
    saveCalculations(savedCalculations.filter(c => c.id !== id));
  };

  const handleLoadCalculation = (calc: TariffCalculation) => {
    setTariffName(calc.name);
    setCurrency(calc.currency);
    setSubscriptionPrice(calc.subscriptionPrice);
    setCreditsInPlan(calc.creditsInPlan);
    setRequestsInPlan(calc.requestsInPlan);
    setAvgTokensInput(calc.avgTokensInput);
    setAvgTokensOutput(calc.avgTokensOutput);
    setOverheadPercent(calc.overheadPercent);
    setSelectedModel(calc.selectedModel);
    setPricingMode(calc.pricingMode || 'base');
    setSelectedVariant(calc.selectedVariant || '');
    setAvgDuration(calc.avgDuration || 5);
  };

  const getCalcForSaved = (calc: TariffCalculation): CalculationResult | null => {
    const model = unifiedModels.find(m => m.id === calc.selectedModel);
    if (!model || calc.requestsInPlan === 0 || calc.creditsInPlan === 0) return null;

    const priceInUsd = calc.currency === 'USD' ? calc.subscriptionPrice : calc.subscriptionPrice / usdRate;
    const creditsPerRequest = calc.creditsInPlan / calc.requestsInPlan;
    const pricePerCredit = priceInUsd / calc.creditsInPlan;
    const pricePerRequest = priceInUsd / calc.requestsInPlan;

    let costPerRequest: number;

    if (model.priceType === 'per_1k_tokens') {
      costPerRequest = (calc.avgTokensInput / 1000) * model.priceUsd +
                       (calc.avgTokensOutput / 1000) * (model.priceUsdOutput || 0);
    } else if (model.hasVariants && model.priceVariants) {
      const variants = Object.entries(model.priceVariants)
        .filter(([k]) => k !== 'constraints' && k !== 'display_name');

      const mode = calc.pricingMode || 'base';

      if (mode === 'average' && variants.length > 0) {
        const costs = variants.map(([, v]) => {
          if (v.price_usd !== undefined && v.price_usd > 0) return v.price_usd;
          if (v.price_per_second !== undefined) return v.price_per_second * (v.duration || calc.avgDuration || 5);
          return 0;
        }).filter(c => c > 0);
        costPerRequest = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : model.priceUsd;
      } else if (mode === 'variant' && calc.selectedVariant && model.priceVariants[calc.selectedVariant]) {
        const v = model.priceVariants[calc.selectedVariant];
        if (v.price_usd !== undefined && v.price_usd > 0) costPerRequest = v.price_usd;
        else if (v.price_per_second !== undefined) costPerRequest = v.price_per_second * (v.duration || calc.avgDuration || 5);
        else costPerRequest = model.priceUsd;
      } else {
        costPerRequest = model.priceType === 'per_second' ? model.priceUsd * (calc.avgDuration || 5) : model.priceUsd;
      }
    } else if (model.priceType === 'per_second') {
      costPerRequest = model.priceUsd * (calc.avgDuration || 5);
    } else {
      costPerRequest = model.priceUsd;
    }

    const costWithOverhead = costPerRequest * (1 + calc.overheadPercent / 100);
    const profitPerRequest = pricePerRequest - costWithOverhead;
    const marginPercent = pricePerRequest > 0 ? (profitPerRequest / pricePerRequest) * 100 : 0;
    const totalCost = costWithOverhead * calc.requestsInPlan;
    const totalProfit = profitPerRequest * calc.requestsInPlan;

    return {
      creditsPerRequest, pricePerCredit, pricePerRequest,
      costPerRequest, costWithOverhead, profitPerRequest,
      marginPercent, totalCost, totalProfit,
    };
  };

  const formatUSD = (v: number, d = 6) => `$${v.toFixed(d)}`;
  const formatPercent = (v: number) => `${v.toFixed(1)}%`;

  const getMarginColor = (m: number) => {
    if (m >= 50) return 'text-green-400';
    if (m >= 30) return 'text-yellow-400';
    if (m >= 0) return 'text-orange-400';
    return 'text-red-400';
  };

  const isTokenBased = currentModel?.priceType === 'per_1k_tokens';
  const isPerSecond = currentModel?.priceType === 'per_second' && !currentModel?.hasVariants;

  if (loading) {
    return <div className="p-6 text-gray-400">Загрузка моделей...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Calculator className="w-8 h-8 text-purple-400" />
        <h1 className="text-2xl font-bold text-white">Unit-экономика</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT PANEL */}
        <div className="space-y-4">
          {/* Tariff params */}
          <div className="bg-[#2f2f2f] rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Параметры тарифа
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Название тарифа</label>
                <input
                  type="text"
                  value={tariffName}
                  onChange={e => setTariffName(e.target.value)}
                  placeholder="Например: Pro Plan"
                  className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Цена подписки</label>
                  <input type="number" value={subscriptionPrice}
                    onChange={e => setSubscriptionPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Валюта</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value as 'RUB' | 'USD')}
                    className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white">
                    <option value="RUB">₽ RUB</option>
                    <option value="USD">$ USD</option>
                  </select>
                </div>
              </div>
              {currency === 'RUB' && (
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Курс USD/RUB</label>
                  <input type="number" value={usdRate}
                    onChange={e => setUsdRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Токенов в тарифе</label>
                  <input type="number" value={creditsInPlan}
                    onChange={e => setCreditsInPlan(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Запросов в тарифе</label>
                  <input type="number" value={requestsInPlan}
                    onChange={e => setRequestsInPlan(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Usage params */}
          <div className="bg-[#2f2f2f] rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Параметры использования
            </h2>
            <div className="space-y-3">
              {/* Model selector with optgroups */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Модель</label>
                <select
                  value={selectedModel}
                  onChange={e => handleModelChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white"
                >
                  {(['text', 'image', 'video', 'audio'] as const).map(type => {
                    const group = modelsByType[type];
                    if (!group || group.length === 0) return null;
                    return (
                      <optgroup key={type} label={TYPE_LABELS[type]}>
                        {group.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>

                {/* Price info under selector */}
                {currentModel && (
                  <div className="mt-1 text-xs text-gray-500">
                    {isTokenBased ? (
                      <span>
                        Вход: <span className="text-blue-400">${currentModel.priceUsd.toFixed(4)}</span>/1K
                        {' • '}
                        Выход: <span className="text-blue-400">${(currentModel.priceUsdOutput || 0).toFixed(4)}</span>/1K
                      </span>
                    ) : (
                      <span>
                        Базовая цена: <span className="text-purple-400">${currentModel.priceUsd.toFixed(4)}</span>
                        /{PRICE_TYPE_LABELS[currentModel.priceType] || currentModel.priceType}
                        {currentModel.hasVariants && (
                          <span className="text-yellow-400 ml-2">• {currentVariants.length} вариаций</span>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actual avg toggle */}
              {currentModel && hasActualAvg && (
                <div className="bg-[#252525] rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-300">
                      <span className="font-medium">Себестоимость для расчёта</span>
                    </div>
                    <button
                      onClick={() => setUseActualAvg(!useActualAvg)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        useActualAvg ? 'bg-yellow-600' : 'bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        useActualAvg ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs">
                    <div className={`${!useActualAvg ? 'text-purple-400 font-medium' : 'text-gray-500'}`}>
                      Базовая: ${currentModel.priceType === 'per_1k_tokens'
                        ? `${currentModel.priceUsd.toFixed(4)}/1K in + ${(currentModel.priceUsdOutput || 0).toFixed(4)}/1K out`
                        : currentModel.priceType === 'per_second'
                          ? `${currentModel.priceUsd.toFixed(4)}/сек × ${avgDuration}с = $${(currentModel.priceUsd * avgDuration).toFixed(4)}`
                          : `$${currentModel.priceUsd.toFixed(4)}`
                      }
                    </div>
                    <div className={`${useActualAvg ? 'text-yellow-400 font-medium' : 'text-gray-500'}`}>
                      Средняя (факт): <span className="text-yellow-400">${actualAvgCost.cost!.toFixed(4)}</span>
                      <span className="text-gray-600 ml-1">({actualAvgCost.count} запросов)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Token inputs for text models */}
              {isTokenBased && !useActualAvg && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Средн. токенов (вход)</label>
                    <input type="number" value={avgTokensInput}
                      onChange={e => setAvgTokensInput(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Средн. токенов (выход)</label>
                    <input type="number" value={avgTokensOutput}
                      onChange={e => setAvgTokensOutput(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white" />
                  </div>
                </div>
              )}

              {/* Duration for per_second models without variants */}
              {isPerSecond && !useActualAvg && (
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Средняя длительность (сек)</label>
                  <input type="number" min="1" max="60" value={avgDuration}
                    onChange={e => setAvgDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white" />
                  <div className="mt-1 text-xs text-gray-500">
                    Расчёт: ${currentModel?.priceUsd.toFixed(4)}/сек × {avgDuration} сек = <span className="text-green-400">${(currentModel!.priceUsd * avgDuration).toFixed(4)}</span>
                  </div>
                </div>
              )}

              {/* VARIANTS SECTION */}
              {currentModel?.hasVariants && (
                <div className="bg-[#252525] rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm font-medium">Режим ценообразования</span>
                    <button
                      onClick={() => setShowVariantDetails(!showVariantDetails)}
                      className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                    >
                      {showVariantDetails ? 'Скрыть' : 'Показать'} вариации
                      {showVariantDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Toggle: Base / Average / Variant */}
                  <div className="flex gap-1 bg-[#1a1a1a] rounded-lg p-1">
                    <button
                      onClick={() => handlePricingModeChange('base')}
                      className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        pricingMode === 'base'
                          ? 'bg-purple-600 text-white'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      Базовая
                    </button>
                    <button
                      onClick={() => handlePricingModeChange('average')}
                      className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        pricingMode === 'average'
                          ? 'bg-yellow-600 text-white'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      Средняя
                    </button>
                    <button
                      onClick={() => handlePricingModeChange('variant')}
                      className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        pricingMode === 'variant'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      Вариация
                    </button>
                  </div>

                  {/* Mode description */}
                  <div className="text-xs text-gray-500">
                    {pricingMode === 'base' && (
                      <>Используется базовая цена из БД: <span className="text-purple-400">${currentModel.priceUsd.toFixed(4)}</span></>
                    )}
                    {pricingMode === 'average' && (
                      <>Среднее по всем вариациям: <span className="text-yellow-400">${effectiveCost.toFixed(4)}</span></>
                    )}
                    {pricingMode === 'variant' && selectedVariant && currentModel.priceVariants?.[selectedVariant] && (
                      <>Выбранная вариация: <span className="text-blue-400">${effectiveCost.toFixed(4)}</span></>
                    )}
                  </div>

                  {/* Variant selector dropdown */}
                  {pricingMode === 'variant' && (
                    <select
                      value={selectedVariant}
                      onChange={e => setSelectedVariant(e.target.value)}
                      className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white text-sm"
                    >
                      {currentVariants.map(v => (
                        <option key={v.key} value={v.key}>
                          {v.label} — ${(v.price_usd ?? (v.price_per_second ? v.price_per_second * (v.duration || avgDuration) : 0)).toFixed(4)}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Per-second duration input for variant models */}
                  {currentModel.priceType === 'per_second' && pricingMode === 'base' && (
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Средняя длительность (сек)</label>
                      <input type="number" min="1" max="60" value={avgDuration}
                        onChange={e => setAvgDuration(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-[#3f3f3f] border border-gray-600 rounded text-white text-sm" />
                    </div>
                  )}

                  {/* Variant details table */}
                  {showVariantDetails && (
                    <div className="border-t border-gray-700 pt-2 space-y-1">
                      {currentVariants.map(v => {
                        const cost = getVariantCost(v);
                        const isSelected = pricingMode === 'variant' && selectedVariant === v.key;
                        return (
                          <div
                            key={v.key}
                            onClick={() => { setPricingMode('variant'); setSelectedVariant(v.key); }}
                            className={`flex justify-between items-center px-2 py-1.5 rounded text-sm cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-900/40 border border-blue-500/30' : 'hover:bg-[#2a2a2a]'
                            }`}
                          >
                            <span className="text-gray-300">{v.label}</span>
                            <span className={`font-mono ${isSelected ? 'text-blue-400' : 'text-green-400'}`}>
                              ${cost.toFixed(4)}
                            </span>
                          </div>
                        );
                      })}
                      {currentVariants.length > 1 && (
                        <div className="flex justify-between items-center px-2 py-1.5 border-t border-gray-700 text-sm">
                          <span className="text-yellow-400 font-medium">Среднее</span>
                          <span className="text-yellow-400 font-mono font-medium">
                            ${(currentVariants.map(v => getVariantCost(v)).filter(c => c > 0).reduce((a, b) => a + b, 0) / currentVariants.filter(v => getVariantCost(v) > 0).length).toFixed(4)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Static price info for non-token, non-variant, non-per_second models */}
              {currentModel && !isTokenBased && !isPerSecond && !currentModel.hasVariants && (
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                  <p className="text-purple-300 text-sm">
                    Фиксированная цена за запрос: <strong>${currentModel.priceUsd.toFixed(4)}</strong>
                  </p>
                </div>
              )}

              {/* Overhead */}
              <div>
                <label className="block text-gray-400 text-sm mb-1 flex items-center gap-1">
                  <Percent className="w-4 h-4" />
                  Накладные расходы (касса, налоги)
                </label>
                <div className="flex items-center gap-2">
                  <input type="range" min="0" max="50" value={overheadPercent}
                    onChange={e => setOverheadPercent(Number(e.target.value))} className="flex-1" />
                  <input type="number" value={overheadPercent}
                    onChange={e => setOverheadPercent(Number(e.target.value))}
                    className="w-20 px-2 py-1 bg-[#3f3f3f] border border-gray-600 rounded text-white text-center" />
                  <span className="text-gray-400">%</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveCalculation}
            className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-2 font-semibold"
          >
            <Save className="w-5 h-5" />
            Сохранить расчёт
          </button>
        </div>

        {/* RIGHT PANEL */}
        <div className="space-y-4">
          <div className="bg-[#2f2f2f] rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Результаты расчёта</h2>

            {calculation ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#252525] rounded-lg p-3">
                    <div className="text-gray-400 text-sm">Токенов за запрос</div>
                    <div className="text-2xl font-bold text-white">{calculation.creditsPerRequest.toFixed(1)}</div>
                  </div>
                  <div className="bg-[#252525] rounded-lg p-3">
                    <div className="text-gray-400 text-sm">Цена токена</div>
                    <div className="text-2xl font-bold text-white">{formatUSD(calculation.pricePerCredit, 4)}</div>
                  </div>
                </div>

                <div className="bg-[#252525] rounded-lg p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Цена продажи за запрос</span>
                    <span className="text-white font-mono">{formatUSD(calculation.pricePerRequest)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Себестоимость
                      {isTokenBased ? ' (токены)' : ''}
                      {currentModel?.hasVariants ? ` (${pricingMode === 'base' ? 'базовая' : pricingMode === 'average' ? 'средняя' : 'вариация'})` : ''}
                      {!isTokenBased && !currentModel?.hasVariants ? ' (фикс.)' : ''}
                    </span>
                    <span className="text-white font-mono">{formatUSD(calculation.costPerRequest)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">+ Накладные ({overheadPercent}%)</span>
                    <span className="text-orange-400 font-mono">
                      {formatUSD(calculation.costWithOverhead - calculation.costPerRequest)}
                    </span>
                  </div>
                  <div className="border-t border-gray-600 pt-2 flex justify-between">
                    <span className="text-gray-400 font-semibold">Полная себестоимость</span>
                    <span className="text-red-400 font-mono font-semibold">{formatUSD(calculation.costWithOverhead)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#252525] rounded-lg p-3">
                    <div className="text-gray-400 text-sm">Прибыль за запрос</div>
                    <div className={`text-2xl font-bold ${calculation.profitPerRequest >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatUSD(calculation.profitPerRequest)}
                    </div>
                  </div>
                  <div className="bg-[#252525] rounded-lg p-3">
                    <div className="text-gray-400 text-sm">Маржа</div>
                    <div className={`text-2xl font-bold ${getMarginColor(calculation.marginPercent)}`}>
                      {formatPercent(calculation.marginPercent)}
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg p-4 border border-purple-500/30">
                  <div className="text-gray-300 text-sm mb-2">Итого за подписку ({requestsInPlan} запросов)</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-400 text-xs">Общая себестоимость</div>
                      <div className="text-xl font-bold text-red-400">{formatUSD(calculation.totalCost, 2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">Общая прибыль</div>
                      <div className={`text-xl font-bold ${calculation.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatUSD(calculation.totalProfit, 2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#252525] rounded-lg p-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Шкала маржинальности</span>
                    <span className={getMarginColor(calculation.marginPercent)}>{formatPercent(calculation.marginPercent)}</span>
                  </div>
                  <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        calculation.marginPercent >= 50 ? 'bg-green-500' :
                        calculation.marginPercent >= 30 ? 'bg-yellow-500' :
                        calculation.marginPercent >= 0 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, calculation.marginPercent))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span><span>30%</span><span>50%</span><span>100%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-8">Заполните параметры для расчёта</div>
            )}
          </div>

          {/* Saved calculations */}
          {savedCalculations.length > 0 && (
            <div className="bg-[#2f2f2f] rounded-lg p-4">
              <h2 className="text-lg font-semibold text-white mb-4">Сохранённые расчёты</h2>
              <div className="space-y-2">
                {savedCalculations.map(calc => {
                  const result = getCalcForSaved(calc);
                  const isExpanded = expandedCalcs.has(calc.id);
                  const model = unifiedModels.find(m => m.id === calc.selectedModel);

                  return (
                    <div key={calc.id} className="bg-[#252525] rounded-lg overflow-hidden">
                      <div
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#2a2a2a]"
                        onClick={() => {
                          const next = new Set(expandedCalcs);
                          if (next.has(calc.id)) next.delete(calc.id); else next.add(calc.id);
                          setExpandedCalcs(next);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          <div>
                            <div className="text-white font-medium">{calc.name}</div>
                            <div className="text-xs text-gray-500">
                              {calc.subscriptionPrice} {calc.currency} • {calc.requestsInPlan} запросов
                              {calc.pricingMode && calc.pricingMode !== 'base' && (
                                <span className="ml-1 text-yellow-500">• {calc.pricingMode === 'average' ? 'средняя' : 'вариация'}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {result && (
                            <span className={`text-lg font-bold ${getMarginColor(result.marginPercent)}`}>
                              {formatPercent(result.marginPercent)}
                            </span>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); handleLoadCalculation(calc); }}
                            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                          >Загрузить</button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteCalculation(calc.id); }}
                            className="p-1 text-red-400 hover:text-red-300"
                          ><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      {isExpanded && result && (
                        <div className="px-3 pb-3 border-t border-gray-700 pt-3 text-sm">
                          <div className="grid grid-cols-2 gap-2 text-gray-400">
                            <div>Модель: <span className="text-white">{model?.name || calc.selectedModel}</span></div>
                            <div>Ток./запрос: <span className="text-white">{result.creditsPerRequest.toFixed(1)}</span></div>
                            <div>Себестоимость: <span className="text-red-400">{formatUSD(result.costWithOverhead)}</span></div>
                            <div>Прибыль: <span className={result.profitPerRequest >= 0 ? 'text-green-400' : 'text-red-400'}>{formatUSD(result.profitPerRequest)}</span></div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comparison table */}
      {savedCalculations.length > 1 && (
        <div className="mt-6 bg-[#2f2f2f] rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Сравнение тарифов</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-gray-400 text-left text-sm">
                  <th className="pb-3">Тариф</th>
                  <th className="pb-3">Цена</th>
                  <th className="pb-3">Запросов</th>
                  <th className="pb-3">Ток./запрос</th>
                  <th className="pb-3">Себестоимость</th>
                  <th className="pb-3">Прибыль/запрос</th>
                  <th className="pb-3">Маржа</th>
                  <th className="pb-3">Общая прибыль</th>
                </tr>
              </thead>
              <tbody>
                {savedCalculations.map(calc => {
                  const result = getCalcForSaved(calc);
                  if (!result) return null;
                  return (
                    <tr key={calc.id} className="border-t border-gray-700">
                      <td className="py-3 text-white">{calc.name}</td>
                      <td className="py-3 text-gray-300">{calc.subscriptionPrice} {calc.currency}</td>
                      <td className="py-3 text-gray-300">{calc.requestsInPlan}</td>
                      <td className="py-3 text-gray-300">{result.creditsPerRequest.toFixed(1)}</td>
                      <td className="py-3 text-red-400">{formatUSD(result.costWithOverhead)}</td>
                      <td className={`py-3 ${result.profitPerRequest >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatUSD(result.profitPerRequest)}
                      </td>
                      <td className={`py-3 font-bold ${getMarginColor(result.marginPercent)}`}>
                        {formatPercent(result.marginPercent)}
                      </td>
                      <td className={`py-3 font-bold ${result.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatUSD(result.totalProfit, 2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}