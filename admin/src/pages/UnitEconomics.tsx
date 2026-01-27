import { useEffect, useState, useMemo } from 'react';
import { getAdapters } from '../api/client';
import { Calculator, TrendingUp, DollarSign, Percent, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface Model {
  id: string;
  display_name?: string;
  type: string;
  pricing: {
    input_per_1k: number;
    output_per_1k: number;
  };
  provider: string;
}

interface Adapter {
  name: string;
  display_name: string;
  type: string;
  models?: Model[];
}

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

const STORAGE_KEY = 'unit_economics_calculations';

export default function UnitEconomics() {
  const [models, setModels] = useState<Model[]>([]);
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

  useEffect(() => {
    loadData();
    loadSavedCalculations();
  }, []);

  const loadData = async () => {
    try {
      const response = await getAdapters();
      const adapters: Adapter[] = response.data.adapters || [];
      
      const allModels: Model[] = [];
      adapters.forEach(adapter => {
        if (adapter.models) {
          adapter.models.forEach(model => {
            allModels.push({
              ...model,
              provider: adapter.display_name,
            });
          });
        }
      });
      
      setModels(allModels);
      if (allModels.length > 0) {
        setSelectedModel(allModels[0].id);
      }
    } catch (err) {
      console.error('Ошибка загрузки:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedCalculations = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSavedCalculations(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Ошибка загрузки сохранённых расчётов:', err);
    }
  };

  const saveCalculations = (calcs: TariffCalculation[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calcs));
    setSavedCalculations(calcs);
  };

  const currentModel = useMemo(() => {
    return models.find(m => m.id === selectedModel);
  }, [models, selectedModel]);

  const calculation = useMemo((): CalculationResult | null => {
    if (!currentModel || requestsInPlan === 0 || creditsInPlan === 0) return null;

    const priceInUsd = currency === 'USD' ? subscriptionPrice : subscriptionPrice / usdRate;

    const creditsPerRequest = creditsInPlan / requestsInPlan;
    const pricePerCredit = priceInUsd / creditsInPlan;
    const pricePerRequest = priceInUsd / requestsInPlan;

    const costPerRequest = 
      (avgTokensInput / 1000) * currentModel.pricing.input_per_1k +
      (avgTokensOutput / 1000) * currentModel.pricing.output_per_1k;

    const costWithOverhead = costPerRequest * (1 + overheadPercent / 100);

    const profitPerRequest = pricePerRequest - costWithOverhead;
    const marginPercent = pricePerRequest > 0 ? (profitPerRequest / pricePerRequest) * 100 : 0;

    const totalCost = costWithOverhead * requestsInPlan;
    const totalProfit = profitPerRequest * requestsInPlan;

    return {
      creditsPerRequest,
      pricePerCredit,
      pricePerRequest,
      costPerRequest,
      costWithOverhead,
      profitPerRequest,
      marginPercent,
      totalCost,
      totalProfit,
    };
  }, [currentModel, subscriptionPrice, creditsInPlan, requestsInPlan, avgTokensInput, avgTokensOutput, overheadPercent, currency, usdRate]);

  const handleSaveCalculation = () => {
    if (!tariffName.trim()) {
      alert('Введите название тарифа');
      return;
    }

    const newCalc: TariffCalculation = {
      id: Date.now().toString(),
      name: tariffName,
      currency,
      subscriptionPrice,
      creditsInPlan,
      requestsInPlan,
      avgTokensInput,
      avgTokensOutput,
      overheadPercent,
      selectedModel,
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
  };

  const toggleExpanded = (id: string) => {
    setExpandedCalcs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getCalculationForSaved = (calc: TariffCalculation): CalculationResult | null => {
    const model = models.find(m => m.id === calc.selectedModel);
    if (!model || calc.requestsInPlan === 0 || calc.creditsInPlan === 0) return null;

    const priceInUsd = calc.currency === 'USD' ? calc.subscriptionPrice : calc.subscriptionPrice / usdRate;

    const creditsPerRequest = calc.creditsInPlan / calc.requestsInPlan;
    const pricePerCredit = priceInUsd / calc.creditsInPlan;
    const pricePerRequest = priceInUsd / calc.requestsInPlan;

    const costPerRequest = 
      (calc.avgTokensInput / 1000) * model.pricing.input_per_1k +
      (calc.avgTokensOutput / 1000) * model.pricing.output_per_1k;

    const costWithOverhead = costPerRequest * (1 + calc.overheadPercent / 100);
    const profitPerRequest = pricePerRequest - costWithOverhead;
    const marginPercent = pricePerRequest > 0 ? (profitPerRequest / pricePerRequest) * 100 : 0;

    const totalCost = costWithOverhead * calc.requestsInPlan;
    const totalProfit = profitPerRequest * calc.requestsInPlan;

    return {
      creditsPerRequest,
      pricePerCredit,
      pricePerRequest,
      costPerRequest,
      costWithOverhead,
      profitPerRequest,
      marginPercent,
      totalCost,
      totalProfit,
    };
  };

  const formatUSD = (value: number, decimals = 6) => `$${value.toFixed(decimals)}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const getMarginColor = (margin: number) => {
    if (margin >= 50) return 'text-green-400';
    if (margin >= 30) return 'text-yellow-400';
    if (margin >= 0) return 'text-orange-400';
    return 'text-red-400';
  };

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
        {/* Левая колонка - Ввод данных */}
        <div className="space-y-4">
          {/* Параметры тарифа */}
          <div className="bg-[#2f2f2f] rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Параметры тарифа конкурента
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Название тарифа</label>
                <input
                  type="text"
                  value={tariffName}
                  onChange={(e) => setTariffName(e.target.value)}
                  placeholder="Например: ChatGPT Plus"
                  className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Цена подписки</label>
                  <input
                    type="number"
                    value={subscriptionPrice}
                    onChange={(e) => setSubscriptionPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Валюта</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'RUB' | 'USD')}
                    className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white"
                  >
                    <option value="RUB">₽ RUB</option>
                    <option value="USD">$ USD</option>
                  </select>
                </div>
              </div>

              {currency === 'RUB' && (
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Курс USD/RUB</label>
                  <input
                    type="number"
                    value={usdRate}
                    onChange={(e) => setUsdRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Кредитов в тарифе</label>
                  <input
                    type="number"
                    value={creditsInPlan}
                    onChange={(e) => setCreditsInPlan(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Запросов в тарифе</label>
                  <input
                    type="number"
                    value={requestsInPlan}
                    onChange={(e) => setRequestsInPlan(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Параметры использования */}
          <div className="bg-[#2f2f2f] rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Параметры использования
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Модель</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white"
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.provider} — {m.display_name || m.id}
                    </option>
                  ))}
                </select>
                {currentModel && (
                  <div className="mt-1 text-xs text-gray-500">
                    Вход: ${currentModel.pricing.input_per_1k.toFixed(4)}/1K • 
                    Выход: ${currentModel.pricing.output_per_1k.toFixed(4)}/1K
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Средн. токенов (вход)</label>
                  <input
                    type="number"
                    value={avgTokensInput}
                    onChange={(e) => setAvgTokensInput(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Средн. токенов (выход)</label>
                  <input
                    type="number"
                    value={avgTokensOutput}
                    onChange={(e) => setAvgTokensOutput(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#3f3f3f] border border-gray-600 rounded text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1 flex items-center gap-1">
                  <Percent className="w-4 h-4" />
                  Накладные расходы (касса, налоги)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={overheadPercent}
                    onChange={(e) => setOverheadPercent(Number(e.target.value))}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    value={overheadPercent}
                    onChange={(e) => setOverheadPercent(Number(e.target.value))}
                    className="w-20 px-2 py-1 bg-[#3f3f3f] border border-gray-600 rounded text-white text-center"
                  />
                  <span className="text-gray-400">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Кнопка сохранения */}
          <button
            onClick={handleSaveCalculation}
            className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-2 font-semibold"
          >
            <Save className="w-5 h-5" />
            Сохранить расчёт
          </button>
        </div>

        {/* Правая колонка - Результаты */}
        <div className="space-y-4">
          {/* Результаты расчёта */}
          <div className="bg-[#2f2f2f] rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Результаты расчёта</h2>

            {calculation ? (
              <div className="space-y-4">
                {/* Основные метрики */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#252525] rounded-lg p-3">
                    <div className="text-gray-400 text-sm">Кредитов за запрос</div>
                    <div className="text-2xl font-bold text-white">
                      {calculation.creditsPerRequest.toFixed(1)}
                    </div>
                  </div>
                  <div className="bg-[#252525] rounded-lg p-3">
                    <div className="text-gray-400 text-sm">Цена кредита</div>
                    <div className="text-2xl font-bold text-white">
                      {formatUSD(calculation.pricePerCredit, 4)}
                    </div>
                  </div>
                </div>

                {/* Детализация */}
                <div className="bg-[#252525] rounded-lg p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Цена продажи за запрос</span>
                    <span className="text-white font-mono">{formatUSD(calculation.pricePerRequest)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Себестоимость (API)</span>
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
                    <span className="text-red-400 font-mono font-semibold">
                      {formatUSD(calculation.costWithOverhead)}
                    </span>
                  </div>
                </div>

                {/* Прибыль и маржа */}
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

                {/* Итого за подписку */}
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

                {/* Визуальная шкала маржи */}
                <div className="bg-[#252525] rounded-lg p-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Шкала маржинальности</span>
                    <span className={getMarginColor(calculation.marginPercent)}>
                      {formatPercent(calculation.marginPercent)}
                    </span>
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
                    <span>0%</span>
                    <span>30%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-8">
                Заполните параметры для расчёта
              </div>
            )}
          </div>

          {/* Сохранённые расчёты */}
          {savedCalculations.length > 0 && (
            <div className="bg-[#2f2f2f] rounded-lg p-4">
              <h2 className="text-lg font-semibold text-white mb-4">Сохранённые расчёты</h2>
              <div className="space-y-2">
                {savedCalculations.map(calc => {
                  const result = getCalculationForSaved(calc);
                  const isExpanded = expandedCalcs.has(calc.id);
                  const model = models.find(m => m.id === calc.selectedModel);

                  return (
                    <div key={calc.id} className="bg-[#252525] rounded-lg overflow-hidden">
                      <div
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#2a2a2a]"
                        onClick={() => toggleExpanded(calc.id)}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          <div>
                            <div className="text-white font-medium">{calc.name}</div>
                            <div className="text-xs text-gray-500">
                              {calc.subscriptionPrice} {calc.currency} • {calc.requestsInPlan} запросов
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
                            onClick={(e) => { e.stopPropagation(); handleLoadCalculation(calc); }}
                            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                          >
                            Загрузить
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteCalculation(calc.id); }}
                            className="p-1 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {isExpanded && result && (
                        <div className="px-3 pb-3 border-t border-gray-700 pt-3 text-sm">
                          <div className="grid grid-cols-2 gap-2 text-gray-400">
                            <div>Модель: <span className="text-white">{model?.display_name || calc.selectedModel}</span></div>
                            <div>Кред./запрос: <span className="text-white">{result.creditsPerRequest.toFixed(1)}</span></div>
                            <div>Себестоимость: <span className="text-red-400">{formatUSD(result.costWithOverhead)}</span></div>
                            <div>Прибыль: <span className={result.profitPerRequest >= 0 ? 'text-green-400' : 'text-red-400'}>{formatUSD(result.profitPerRequest)}</span></div>
                            <div>Токены вход: <span className="text-white">{calc.avgTokensInput}</span></div>
                            <div>Токены выход: <span className="text-white">{calc.avgTokensOutput}</span></div>
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

      {/* Сравнительная таблица */}
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
                  <th className="pb-3">Кред./запрос</th>
                  <th className="pb-3">Себестоимость</th>
                  <th className="pb-3">Прибыль/запрос</th>
                  <th className="pb-3">Маржа</th>
                  <th className="pb-3">Общая прибыль</th>
                </tr>
              </thead>
              <tbody>
                {savedCalculations.map(calc => {
                  const result = getCalculationForSaved(calc);
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