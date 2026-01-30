import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Save, X, Pencil, Loader2 } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
      const [tariffsRes, adaptersRes] = await Promise.all([
        api.get('/admin/tariffs'),
        api.get('/admin/adapters')
      ]);
      setTariffs(tariffsRes.data);
      setAdapters(adaptersRes.data.adapters || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
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
    
    const newItem: TariffItem = {
      item_type,
      adapter_name,
      model_id,
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

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (!editingTariff) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= editingTariff.items.length) return;
    
    const items = [...editingTariff.items];
    [items[index], items[newIndex]] = [items[newIndex], items[index]];
    items.forEach((item, i) => item.sort_order = i);
    
    setEditingTariff({ ...editingTariff, items });
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
                <label className="block text-sm font-medium text-gray-400 mb-1">Описание</label>
                <textarea
                  value={editingTariff.description || ''}
                  onChange={(e) => setEditingTariff({ ...editingTariff, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#252525] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  rows={2}
                  placeholder="Описание тарифа..."
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
              
              {editingTariff.items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Добавьте блоки из панели справа
                </div>
              ) : (
                <div className="space-y-2">
                  {editingTariff.items.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 bg-[#252525] rounded-lg ${!item.is_enabled ? 'opacity-50' : ''}`}
                    >
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveItem(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveItem(index, 'down')}
                          disabled={index === editingTariff.items.length - 1}
                          className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </div>
                      
                      <GripVertical className="w-4 h-4 text-gray-600" />
                      
                      <div className="flex-1">
                        <div className="font-medium text-white">{getItemLabel(item)}</div>
                        {item.custom_description && (
                          <div className="text-sm text-gray-500">{item.custom_description}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={item.credits_override || ''}
                          onChange={(e) => updateItem(index, { credits_override: parseFloat(e.target.value) || undefined })}
                          className="w-24 px-2 py-1 bg-[#1a1a1a] border border-gray-700 rounded text-white text-sm"
                          placeholder="Цена"
                        />
                        <select
                          value={item.credits_scope}
                          onChange={(e) => updateItem(index, { credits_scope: e.target.value })}
                          className="px-2 py-1 bg-[#1a1a1a] border border-gray-700 rounded text-white text-sm"
                        >
                          <option value="plan_only">Только тариф</option>
                          <option value="global">Глобально</option>
                        </select>
                        <button
                          onClick={() => updateItem(index, { is_enabled: !item.is_enabled })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            item.is_enabled ? 'bg-green-600' : 'bg-gray-600'
                          }`}
                          title={item.is_enabled ? 'Включено' : 'Отключено'}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              item.is_enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => removeItem(index)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
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
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {adapters.map((adapter) => (
                  <div key={adapter.name}>
                    <div className="text-sm font-medium text-gray-400 mb-2">{adapter.display_name}</div>
                    <div className="space-y-1">
                      {adapter.models.slice(0, 5).map((model) => (
                        <button
                          key={model.id}
                          onClick={() => addItem('single_model', adapter.name, model.id)}
                          className="w-full flex items-center gap-2 p-2 bg-[#252525] rounded hover:bg-[#2f2f2f] text-left text-sm"
                        >
                          <span className="text-white truncate flex-1">{model.display_name}</span>
                          {model.credits_price && (
                            <span className="text-gray-500">{model.credits_price}</span>
                          )}
                          <Plus className="w-3 h-3 text-gray-500" />
                        </button>
                      ))}
                      {adapter.models.length > 5 && (
                        <div className="text-xs text-gray-500 text-center py-1">
                          +{adapter.models.length - 5} моделей
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}