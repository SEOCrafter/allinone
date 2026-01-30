import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, GripVertical, Save, X, Pencil, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../api/client';

interface TariffItem {
  id?: string;
  item_type: string;
  adapter_name?: string;
  model_id?: string;
  custom_description?: string;
  credits_override?: number;
  credits_scope: string;
  is_enabled: boolean;
  sort_order: number;
}

interface Tariff {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  credits: number;
  is_active: boolean;
  sort_order: number;
  items: TariffItem[];
}

interface AdapterModel {
  id: string;
  display_name: string;
  type: string;
  credits_price?: number;
}

interface Adapter {
  name: string;
  display_name: string;
  type: string;
  models: AdapterModel[];
}

interface ModelSetting {
  id: string;
  provider: string;
  model_id: string;
  credits_price: number | null;
  is_enabled: boolean;
}

const ITEM_TYPE_GROUPS = [
  { id: 'all_text', label: 'Все текстовые', icon: '📝' },
  { id: 'all_images', label: 'Все изображения', icon: '🖼️' },
  { id: 'all_video', label: 'Все видео', icon: '🎬' },
  { id: 'all_audio', label: 'Все аудио', icon: '🎵' },
];

const CURRENCIES = ['RUB', 'USD', 'EUR', 'USDT'];

export default function Tariffs() {
  const [activeTab, setActiveTab] = useState<'list' | 'constructor'>('list');
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [modelSettings, setModelSettings] = useState<Record<string, ModelSetting>>({});
  const [loading, setLoading] = useState(true);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingItemDesc, setEditingItemDesc] = useState<number | null>(null);
  const [expandedAdapters, setExpandedAdapters] = useState<Record<string, boolean>>({});
  
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const emptyTariff: Tariff = {
    id: '',
    name: '',
    description: '',
    price: 0,
    currency: 'RUB',
    credits: 0,
    is_active: true,
    sort_order: 0,
    items: []
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tariffsRes, adaptersRes, settingsRes] = await Promise.all([
        api.get('/admin/tariffs'),
        api.get('/admin/adapters'),
        api.get('/admin/models/settings')
      ]);
      setTariffs(tariffsRes.data);
      setAdapters(adaptersRes.data.adapters || []);
      setModelSettings(settingsRes.data.settings || {});
      
      // Expand all adapters by default
      const expanded: Record<string, boolean> = {};
      (adaptersRes.data.adapters || []).forEach((a: Adapter) => {
        expanded[a.name] = false;
      });
      setExpandedAdapters(expanded);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getModelPrice = (adapterName: string, modelId: string): number | null => {
    const key = `${adapterName}:${modelId}`;
    return modelSettings[key]?.credits_price ?? null;
  };

  const toggleAdapter = (adapterName: string) => {
    setExpandedAdapters(prev => ({
      ...prev,
      [adapterName]: !prev[adapterName]
    }));
  };

  const handleToggle = async (tariff: Tariff) => {
    setTogglingId(tariff.id);
    try {
      await api.patch(`/admin/tariffs/${tariff.id}/toggle`);
      setTariffs(tariffs.map(t => 
        t.id === tariff.id ? { ...t, is_active: !t.is_active } : t
      ));
    } catch (error) {
      console.error('Failed to toggle tariff:', error);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (tariff: Tariff) => {
    if (!confirm(`Удалить тариф "${tariff.name}"?`)) return;
    try {
      await api.delete(`/admin/tariffs/${tariff.id}`);
      setTariffs(tariffs.filter(t => t.id !== tariff.id));
    } catch (error) {
      console.error('Failed to delete tariff:', error);
    }
  };

  const handleEdit = (tariff: Tariff) => {
    setEditingTariff({ ...tariff, items: [...tariff.items] });
    setIsCreating(false);
    setActiveTab('constructor');
  };

  const handleCreate = () => {
    setEditingTariff({ ...emptyTariff });
    setIsCreating(true);
    setActiveTab('constructor');
  };

  const handleSave = async () => {
    if (!editingTariff) return;
    
    setSaving(true);
    try {
      if (isCreating) {
        const res = await api.post('/admin/tariffs', editingTariff);
        setTariffs([...tariffs, res.data]);
      } else {
        const res = await api.put(`/admin/tariffs/${editingTariff.id}`, editingTariff);
        setTariffs(tariffs.map(t => t.id === editingTariff.id ? res.data : t));
      }
      
      const hasGlobalChanges = editingTariff.items.some(
        item => item.credits_scope === 'global' && item.credits_override
      );
      if (hasGlobalChanges) {
        const settingsRes = await api.get('/admin/models/settings');
        setModelSettings(settingsRes.data.settings || {});
      }
      
      setEditingTariff(null);
      setActiveTab('list');
    } catch (error) {
      console.error('Failed to save tariff:', error);
      alert('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingTariff(null);
    setActiveTab('list');
  };

  const addItem = (item_type: string, adapter_name?: string, model_id?: string) => {
    if (!editingTariff) return;
    
    let currentPrice: number | undefined = undefined;
    if (adapter_name && model_id) {
      const price = getModelPrice(adapter_name, model_id);
      if (price !== null) {
        currentPrice = price;
      }
    }
    
    const newItem: TariffItem = {
      item_type,
      adapter_name,
      model_id,
      custom_description: '',
      credits_override: currentPrice,
      credits_scope: 'plan_only',
      is_enabled: true,
      sort_order: editingTariff.items.length
    };
    
    setEditingTariff({
      ...editingTariff,
      items: [...editingTariff.items, newItem]
    });
  };

  const removeItem = (index: number) => {
    if (!editingTariff) return;
    setEditingTariff({
      ...editingTariff,
      items: editingTariff.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index: number, updates: Partial<TariffItem>) => {
    if (!editingTariff) return;
    setEditingTariff({
      ...editingTariff,
      items: editingTariff.items.map((item, i) => 
        i === index ? { ...item, ...updates } : item
      )
    });
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (!editingTariff || dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const items = [...editingTariff.items];
    const draggedItem = items[dragItem.current];
    items.splice(dragItem.current, 1);
    items.splice(dragOverItem.current, 0, draggedItem);
    
    items.forEach((item, i) => item.sort_order = i);
    
    setEditingTariff({ ...editingTariff, items });
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const getModelDisplayName = (adapter_name?: string, model_id?: string) => {
    if (!adapter_name || !model_id) return '';
    const adapter = adapters.find(a => a.name === adapter_name);
    if (!adapter) return model_id;
    const model = adapter.models.find(m => m.id === model_id);
    return model?.display_name || model_id;
  };

  const getItemLabel = (item: TariffItem) => {
    const group = ITEM_TYPE_GROUPS.find(g => g.id === item.item_type);
    if (group) return `${group.icon} ${group.label}`;
    if (item.adapter_name && item.model_id) {
      return getModelDisplayName(item.adapter_name, item.model_id);
    }
    return item.item_type;
  };

  const getItemCurrentPrice = (item: TariffItem): number | null => {
    if (item.adapter_name && item.model_id) {
      return getModelPrice(item.adapter_name, item.model_id);
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Тарифы</h1>
        {activeTab === 'list' && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Создать тариф
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => !editingTariff && setActiveTab('list')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'list'
              ? 'text-blue-500 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Тарифы
        </button>
        <button
          onClick={() => editingTariff && setActiveTab('constructor')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'constructor'
              ? 'text-blue-500 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white'
          } ${!editingTariff ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!editingTariff}
        >
          Конструктор
        </button>
      </div>

      {/* List Tab */}
      {activeTab === 'list' && (
        <div className="bg-[#1a1a1a] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#252525]">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Название</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Цена</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Кредиты</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Блоков</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">Статус</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {tariffs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Нет тарифов. Создайте первый!
                  </td>
                </tr>
              ) : (
                tariffs.map((tariff) => (
                  <tr key={tariff.id} className={`hover:bg-[#252525] ${!tariff.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-white">{tariff.name}</div>
                        {tariff.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">{tariff.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white">
                      {tariff.price} {tariff.currency}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {tariff.credits.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {tariff.items.length}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(tariff)}
                        disabled={togglingId === tariff.id}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          tariff.is_active ? 'bg-green-600' : 'bg-gray-600'
                        } ${togglingId === tariff.id ? 'opacity-50' : ''}`}
                        title={tariff.is_active ? 'Включено' : 'Отключено'}
                      >
                        {togglingId === tariff.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mx-auto text-white" />
                        ) : (
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              tariff.is_active ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(tariff)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-[#2f2f2f] rounded"
                          title="Редактировать"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tariff)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-[#2f2f2f] rounded"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Constructor Tab */}
      {activeTab === 'constructor' && editingTariff && (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Tariff Form */}
          <div className="col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-[#1a1a1a] rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-medium text-white">Основная информация</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Название</label>
                  <input
                    type="text"
                    value={editingTariff.name}
                    onChange={(e) => setEditingTariff({ ...editingTariff, name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#252525] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Базовый"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Порядок</label>
                  <input
                    type="number"
                    value={editingTariff.sort_order}
                    onChange={(e) => setEditingTariff({ ...editingTariff, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#252525] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Описание тарифа</label>
                <textarea
                  value={editingTariff.description || ''}
                  onChange={(e) => setEditingTariff({ ...editingTariff, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#252525] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  rows={3}
                  placeholder="Описание тарифа для пользователей..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Цена</label>
                  <input
                    type="number"
                    value={editingTariff.price}
                    onChange={(e) => setEditingTariff({ ...editingTariff, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#252525] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Валюта</label>
                  <select
                    value={editingTariff.currency}
                    onChange={(e) => setEditingTariff({ ...editingTariff, currency: e.target.value })}
                    className="w-full px-3 py-2 bg-[#252525] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Кредиты</label>
                  <input
                    type="number"
                    value={editingTariff.credits}
                    onChange={(e) => setEditingTariff({ ...editingTariff, credits: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#252525] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="bg-[#1a1a1a] rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-medium text-white">Блоки тарифа ({editingTariff.items.length})</h3>
              <p className="text-sm text-gray-500">Перетаскивайте блоки для изменения порядка</p>
              
              {editingTariff.items.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-700 rounded-lg">
                  Добавьте блоки из панели справа
                </div>
              ) : (
                <div className="space-y-2">
                  {editingTariff.items.map((item, index) => {
                    const currentPrice = getItemCurrentPrice(item);
                    return (
                      <div
                        key={index}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragEnter={() => handleDragEnter(index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        className={`bg-[#252525] rounded-lg ${!item.is_enabled ? 'opacity-50' : ''} cursor-move`}
                      >
                        <div className="flex items-center gap-3 p-3">
                          <GripVertical className="w-5 h-5 text-gray-500 flex-shrink-0" />
                          
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white">{getItemLabel(item)}</div>
                            {item.custom_description && (
                              <div className="text-sm text-gray-400 truncate">{item.custom_description}</div>
                            )}
                            {currentPrice !== null && !item.credits_override && (
                              <div className="text-xs text-gray-500">Текущая цена: {currentPrice}</div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => setEditingItemDesc(editingItemDesc === index ? null : index)}
                              className="p-1 text-gray-400 hover:text-blue-400"
                              title="Редактировать описание"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            
                            <input
                              type="number"
                              step="0.0001"
                              value={item.credits_override ?? ''}
                              onChange={(e) => updateItem(index, { credits_override: e.target.value ? parseFloat(e.target.value) : undefined })}
                              className="w-24 px-2 py-1 bg-[#1a1a1a] border border-gray-700 rounded text-white text-sm"
                              placeholder={currentPrice?.toString() || 'Цена'}
                              onClick={(e) => e.stopPropagation()}
                            />
                            
                            <select
                              value={item.credits_scope}
                              onChange={(e) => updateItem(index, { credits_scope: e.target.value })}
                              className="px-2 py-1 bg-[#1a1a1a] border border-gray-700 rounded text-white text-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="plan_only">Только для тарифа</option>
                              <option value="global">Глобально</option>
                            </select>
                            
                            <button
                              onClick={(e) => { e.stopPropagation(); updateItem(index, { is_enabled: !item.is_enabled }); }}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                item.is_enabled ? 'bg-green-600' : 'bg-gray-600'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  item.is_enabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            
                            <button
                              onClick={(e) => { e.stopPropagation(); removeItem(index); }}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {editingItemDesc === index && (
                          <div className="px-3 pb-3">
                            <input
                              type="text"
                              value={item.custom_description || ''}
                              onChange={(e) => updateItem(index, { custom_description: e.target.value })}
                              className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded text-white text-sm"
                              placeholder="Описание для этого блока..."
                              autoFocus
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Сохранить
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                <X className="w-4 h-4" />
                Отмена
              </button>
            </div>
          </div>

          {/* Right: Available Blocks */}
          <div className="space-y-4">
            <div className="bg-[#1a1a1a] rounded-xl p-4">
              <h3 className="text-lg font-medium text-white mb-4">Группы</h3>
              <div className="space-y-2">
                {ITEM_TYPE_GROUPS.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => addItem(group.id)}
                    className="w-full flex items-center gap-3 p-3 bg-[#252525] rounded-lg hover:bg-[#2f2f2f] text-left"
                  >
                    <span className="text-xl">{group.icon}</span>
                    <span className="text-white">{group.label}</span>
                    <Plus className="w-4 h-4 text-gray-500 ml-auto" />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#1a1a1a] rounded-xl p-4">
              <h3 className="text-lg font-medium text-white mb-4">Модели</h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {adapters.map((adapter) => {
                  const isExpanded = expandedAdapters[adapter.name];
                  return (
                    <div key={adapter.name} className="border border-gray-700 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleAdapter(adapter.name)}
                        className="w-full flex items-center gap-2 p-3 bg-[#252525] hover:bg-[#2f2f2f] text-left"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-white font-medium">{adapter.display_name}</span>
                        <span className="text-gray-500 text-sm ml-auto">{adapter.models.length}</span>
                      </button>
                      
                      {isExpanded && (
                        <div className="bg-[#1a1a1a] p-2 space-y-1">
                          {adapter.models.map((model) => {
                            const price = getModelPrice(adapter.name, model.id);
                            return (
                              <button
                                key={model.id}
                                onClick={() => addItem('single_model', adapter.name, model.id)}
                                className="w-full flex items-center gap-2 p-2 rounded hover:bg-[#252525] text-left text-sm"
                              >
                                <span className="text-white truncate flex-1">{model.display_name}</span>
                                {price !== null && (
                                  <span className="text-green-400 text-xs">{price}</span>
                                )}
                                <Plus className="w-3 h-3 text-gray-500 flex-shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}