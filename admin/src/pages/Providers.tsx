import { useEffect, useState, useRef } from 'react';
import { RefreshCw, Loader2, ArrowRightLeft } from 'lucide-react';
import api from '../api/client';

interface ProviderPrice {
  id: string;
  model_name: string;
  provider: string;
  replicate_model_id: string | null;
  price_type: string;
  price_usd: number;
  is_active: boolean;
}

interface ModelWithProviders {
  model_name: string;
  current_provider: string;
  providers: ProviderPrice[];
}

export default function Providers() {
  const [models, setModels] = useState<ModelWithProviders[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'dual' | 'replicate_only'>('all');
  const [search, setSearch] = useState('');
  const loadedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (loadedRef.current && models.length > 0) return;
    loadedRef.current = true;
    
    abortRef.current = new AbortController();
    loadData(abortRef.current.signal);
    
    return () => {
      abortRef.current?.abort();
      loadedRef.current = false; 
    };
  }, []);

  const loadData = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await api.get('/admin/providers/models', { signal });
      if (!signal?.aborted) {
        setModels(res.data);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'CanceledError') return;
      console.error('Failed to load providers:', err);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const handleRefresh = () => {
    loadedRef.current = false;
    const controller = new AbortController();
    loadData(controller.signal);
  };

  const handleSwitch = async (modelName: string, newProvider: string) => {
    setSwitching(modelName);
    try {
      await api.post('/admin/providers/switch', {
        model_name: modelName,
        new_provider: newProvider,
      });
      setModels(prev => prev.map(m => 
        m.model_name === modelName
          ? {
              ...m,
              current_provider: newProvider,
              providers: m.providers.map(p => ({
                ...p,
                is_active: p.provider === newProvider,
              })),
            }
          : m
      ));
    } catch (err) {
      console.error('Failed to switch provider:', err);
    } finally {
      setSwitching(null);
    }
  };

  const formatPrice = (price: ProviderPrice) => {
    const val = price.price_usd;
    switch (price.price_type) {
      case 'per_second':
        return `$${val.toFixed(3)}/сек`;
      case 'per_request':
        return `$${val.toFixed(2)}/запрос`;
      case 'per_image':
        return `$${val.toFixed(3)}/изобр`;
      default:
        return `$${val.toFixed(4)}`;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'per_second': return '⏱️ Посекундная';
      case 'per_request': return '📦 За запрос';
      case 'per_image': return '🖼️ За изображение';
      default: return type;
    }
  };

  const filteredModels = models.filter(m => {
    if (search && !m.model_name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filter === 'dual') {
      return m.providers.length > 1;
    }
    if (filter === 'replicate_only') {
      return m.providers.length === 1 && m.providers[0].provider === 'replicate';
    }
    return true;
  });

  const stats = {
    total: models.length,
    dual: models.filter(m => m.providers.length > 1).length,
    onKie: models.filter(m => m.current_provider === 'kie').length,
    onReplicate: models.filter(m => m.current_provider === 'replicate').length,
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Провайдеры моделей</h1>
          <p className="text-gray-400 mt-1">Переключение между KIE и Replicate</p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-[#3f3f3f] hover:bg-[#4f4f4f] text-white rounded-lg flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <div className="text-3xl font-bold text-white">{stats.total}</div>
          <div className="text-gray-400 text-sm">Всего моделей</div>
        </div>
        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <div className="text-3xl font-bold text-purple-400">{stats.dual}</div>
          <div className="text-gray-400 text-sm">С выбором провайдера</div>
        </div>
        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <div className="text-3xl font-bold text-orange-400">{stats.onKie}</div>
          <div className="text-gray-400 text-sm">На KIE</div>
        </div>
        <div className="bg-[#2f2f2f] rounded-lg p-4">
          <div className="text-3xl font-bold text-blue-400">{stats.onReplicate}</div>
          <div className="text-gray-400 text-sm">На Replicate</div>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Поиск модели..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white w-64"
        />
        <div className="flex bg-[#3f3f3f] rounded-lg p-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1 rounded ${filter === 'all' ? 'bg-[#5f5f5f] text-white' : 'text-gray-400'}`}
          >
            Все ({stats.total})
          </button>
          <button
            onClick={() => setFilter('dual')}
            className={`px-4 py-1 rounded ${filter === 'dual' ? 'bg-[#5f5f5f] text-white' : 'text-gray-400'}`}
          >
            С выбором ({stats.dual})
          </button>
          <button
            onClick={() => setFilter('replicate_only')}
            className={`px-4 py-1 rounded ${filter === 'replicate_only' ? 'bg-[#5f5f5f] text-white' : 'text-gray-400'}`}
          >
            Только Replicate ({stats.total - stats.dual})
          </button>
        </div>
      </div>

      <div className="bg-[#2f2f2f] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#252525] text-gray-400 text-left text-sm">
              <th className="px-4 py-3">Модель</th>
              <th className="px-4 py-3">Тип</th>
              <th className="px-4 py-3 text-center">KIE</th>
              <th className="px-4 py-3 text-center">Replicate</th>
              <th className="px-4 py-3 text-center">Активный</th>
              <th className="px-4 py-3 text-center">Действие</th>
            </tr>
          </thead>
          <tbody>
            {filteredModels.map((model) => {
              const kiePrice = model.providers.find(p => p.provider === 'kie');
              const replicatePrice = model.providers.find(p => p.provider === 'replicate');
              const canSwitch = model.providers.length > 1;
              const isOnKie = model.current_provider === 'kie';
              const isOnReplicate = model.current_provider === 'replicate';

              return (
                <tr key={model.model_name} className="border-t border-gray-700 hover:bg-[#353535]">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{model.model_name}</div>
                    {replicatePrice?.replicate_model_id && (
                      <div className="text-gray-500 text-xs">{replicatePrice.replicate_model_id}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-400 text-sm">
                      {getTypeLabel(model.providers[0]?.price_type || '')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {kiePrice ? (
                      <span className={`font-mono ${isOnKie ? 'text-orange-400 font-bold' : 'text-gray-400'}`}>
                        {formatPrice(kiePrice)}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {replicatePrice ? (
                      <span className={`font-mono ${isOnReplicate ? 'text-blue-400 font-bold' : 'text-gray-400'}`}>
                        {formatPrice(replicatePrice)}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      isOnKie 
                        ? 'bg-orange-500/20 text-orange-400' 
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {model.current_provider.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {canSwitch ? (
                      <button
                        onClick={() => handleSwitch(
                          model.model_name, 
                          isOnKie ? 'replicate' : 'kie'
                        )}
                        disabled={switching === model.model_name}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded text-sm flex items-center gap-1 mx-auto"
                      >
                        {switching === model.model_name ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <ArrowRightLeft className="w-4 h-4" />
                            {isOnKie ? 'Replicate' : 'KIE'}
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-gray-600 text-sm">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-6 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500/50"></span>
          KIE — основной провайдер
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500/50"></span>
          Replicate — резервный/альтернативный
        </div>
      </div>
    </div>
  );
}