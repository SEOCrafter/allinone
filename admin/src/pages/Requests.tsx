import { useEffect, useState } from 'react';
import { getRequests, getRequest } from '../api/client';
import { X } from 'lucide-react';
import { flushSync } from 'react-dom';

interface RequestItem {
  id: string;
  user_email: string;
  provider: string;
  model: string;
  status: string;
  tokens_input: number;
  tokens_output: number;
  credits_spent: number;
  provider_cost: number;
  created_at: string;
  prompt?: string;
  response?: string;
  error_message?: string;
}

interface RequestDetail {
  id: string;
  user_email: string;
  provider: string;
  model: string;
  status: string;
  input: {
    prompt: string;
    params: Record<string, unknown>;
  };
  output: {
    content: string | null;
    tokens_input: number;
    tokens_output: number;
  };
  costs: {
    credits_spent: number;
    provider_cost_usd: number;
  };
  error?: {
    code: string;
    message: string;
  } | null;
}

export default function Requests() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<RequestDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadRequests();
  }, []);

    const loadRequests = async () => {
    try {
      const response = await getRequests(1, 100);
      const items = response.data?.data;
      flushSync(() => {
        setRequests(Array.isArray(items) ? items : []);
        setLoading(false);
      });
    } catch (err) {
      console.error('Ошибка загрузки запросов:', err);
      flushSync(() => {
        setRequests([]);
        setLoading(false);
      });
    }
  };

  const openDetail = async (id: string) => {
    setModalLoading(true);
    try {
      const response = await getRequest(id);
      // Бэкенд возвращает { ok: true, request: {...} }
      setSelectedRequest(response.data?.request || null);
    } catch (err) {
      console.error('Ошибка загрузки деталей:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">OK</span>;
      case 'failed':
        return <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">ОШИБКА</span>;
      case 'processing':
        return <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded">В РАБОТЕ</span>;
      default:
        return <span className="px-2 py-1 bg-gray-600 text-white text-xs rounded">{status}</span>;
    }
  };

  const filteredRequests = (requests || []).filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  if (loading) {
    return <div className="p-6 text-gray-400">Загрузка...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Журнал запросов</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
        >
          <option value="all">Все</option>
          <option value="completed">Выполненные</option>
          <option value="failed">Ошибки</option>
          <option value="processing">В работе</option>
        </select>
      </div>

      <div className="bg-[#2f2f2f] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-gray-400 text-left bg-[#252525]">
              <th className="p-4">Статус</th>
              <th className="p-4">Пользователь</th>
              <th className="p-4">Провайдер</th>
              <th className="p-4">Модель</th>
              <th className="p-4">Токены</th>
              <th className="p-4">Стоимость</th>
              <th className="p-4">Время</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((r) => (
              <tr
                key={r.id}
                onClick={() => openDetail(r.id)}
                className="border-t border-gray-700 hover:bg-[#353535] cursor-pointer"
              >
                <td className="p-4">{getStatusBadge(r.status)}</td>
                <td className="p-4 text-white">{r.user_email}</td>
                <td className="p-4 text-gray-300">{r.provider}</td>
                <td className="p-4 text-gray-300">{r.model}</td>
                <td className="p-4 text-gray-300">{r.tokens_input} / {r.tokens_output}</td>
                <td className="p-4 text-gray-300">${(r.provider_cost || 0).toFixed(6)}</td>
                <td className="p-4 text-gray-500">
                  {new Date(r.created_at).toLocaleString('ru')}
                </td>
              </tr>
            ))}
            {filteredRequests.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  Нет запросов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Модальное окно с деталями */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#2f2f2f] rounded-lg w-full max-w-4xl max-h-[90vh] overflow-auto m-4">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Детали запроса</h2>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 hover:bg-[#3f3f3f] rounded"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {modalLoading ? (
              <div className="p-4 text-gray-400">Загрузка...</div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Информация */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500">Статус</p>
                    <p className="text-white">{selectedRequest.status}</p>
                  </div>
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500">Провайдер</p>
                    <p className="text-white">{selectedRequest.provider}</p>
                  </div>
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500">Модель</p>
                    <p className="text-white">{selectedRequest.model}</p>
                  </div>
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500">Стоимость</p>
                    <p className="text-white">${(selectedRequest.costs?.provider_cost_usd || 0).toFixed(6)}</p>
                  </div>
                </div>

                {/* Токены */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500">Токены (вход)</p>
                    <p className="text-white">{selectedRequest.output?.tokens_input || 0}</p>
                  </div>
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500">Токены (выход)</p>
                    <p className="text-white">{selectedRequest.output?.tokens_output || 0}</p>
                  </div>
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500">Кредиты</p>
                    <p className="text-white">{(selectedRequest.costs?.credits_spent || 0).toFixed(4)}</p>
                  </div>
                </div>

                {/* Промпт */}
                <div className="bg-[#252525] p-3 rounded">
                  <p className="text-xs text-gray-500 mb-2">Запрос (промпт)</p>
                  <p className="text-white whitespace-pre-wrap">{selectedRequest.input?.prompt || 'Нет данных'}</p>
                </div>

                {/* Ответ */}
                <div className="bg-[#252525] p-3 rounded">
                  <p className="text-xs text-gray-500 mb-2">Ответ</p>
                  <p className="text-white whitespace-pre-wrap">
                    {selectedRequest.output?.content || selectedRequest.error?.message || 'Нет ответа'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}