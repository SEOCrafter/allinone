import { useState, useCallback, useEffect, useRef } from 'react';
import { getRequests, getRequest } from '../api/client';
import { X, Loader2, ChevronDown, ChevronRight, ExternalLink, Clock, CheckCircle, XCircle, Send, Play } from 'lucide-react';


interface RequestItem {
  id: string;
  user_email: string;
  provider: string;
  external_provider: string;
  model: string;
  type: string;
  status: string;
  tokens_input: number;
  tokens_output: number;
  credits_spent: number;
  provider_cost: number;
  external_task_id: string | null;
  result_url: string | null;
  created_at: string;
}

interface TaskEvent {
  id: string;
  event_type: string;
  external_status: string | null;
  response_data: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
}

interface RequestDetail {
  id: string;
  user_email: string;
  provider: string;
  external_provider: string | null;
  model: string;
  type: string;
  status: string;
  external_task_id: string | null;
  result_url: string | null;
  result_urls: string[] | null;
  input: { prompt: string; params: Record<string, unknown> };
  output: { content: string | null; tokens_input: number; tokens_output: number };
  costs: { credits_spent: number; provider_cost_usd: number };
  error?: { code: string; message: string } | null;
  timing: { created_at: string; started_at: string | null; completed_at: string | null };
  events: TaskEvent[];
}

const TZ = { timeZone: 'Europe/Moscow' };

export default function Requests() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<RequestDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const selectedRequestIdRef = useRef<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const res = await getRequests(1, 100);
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setRequests(data);
    } catch (err) {
      console.error('Ошибка загрузки запросов:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 5000);
    return () => clearInterval(interval);
  }, [loadRequests]);

  useEffect(() => {
    if (!selectedRequestIdRef.current) return;
    
    const refreshDetail = async () => {
      try {
        const response = await getRequest(selectedRequestIdRef.current!);
        const detail = response.data?.request;
        if (detail) {
          setSelectedRequest(detail);
        }
      } catch (err) {
        console.error('Ошибка обновления деталей:', err);
      }
    };

    const interval = setInterval(refreshDetail, 3000);
    return () => clearInterval(interval);
  }, [selectedRequest?.id]);

  const openDetail = async (id: string) => {
    setModalLoading(true);
    setExpandedEvents(new Set());
    selectedRequestIdRef.current = id;
    try {
      const response = await getRequest(id);
      setSelectedRequest(response.data?.request || null);
    } catch (err) {
      console.error('Ошибка загрузки деталей:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedRequest(null);
    selectedRequestIdRef.current = null;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  const toggleEventExpand = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
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

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'image':
        return <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded">IMG</span>;
      case 'video':
        return <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">VIDEO</span>;
      case 'chat':
        return <span className="px-2 py-1 bg-gray-600 text-white text-xs rounded">CHAT</span>;
      default:
        return <span className="px-2 py-1 bg-gray-600 text-white text-xs rounded">{type}</span>;
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'created':
        return <Play className="w-4 h-4 text-blue-400" />;
      case 'sent_to_provider':
        return <Send className="w-4 h-4 text-yellow-400" />;
      case 'poll':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'created':
        return 'Задача создана';
      case 'sent_to_provider':
        return 'Отправлено провайдеру';
      case 'poll':
        return 'Опрос статуса';
      case 'completed':
        return 'Завершено успешно';
      case 'failed':
        return 'Ошибка';
      case 'timeout':
        return 'Таймаут';
      default:
        return eventType;
    }
  };

  const filteredRequests = requests.filter(r => {
    const statusMatch = filter === 'all' || r.status === filter;
    const typeMatch = typeFilter === 'all' || r.type === typeFilter;
    return statusMatch && typeMatch;
  });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Журнал запросов</h1>
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
          >
            <option value="all">Все типы</option>
            <option value="chat">Чат</option>
            <option value="image">Изображения</option>
            <option value="video">Видео</option>
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
          >
            <option value="all">Все статусы</option>
            <option value="completed">Выполненные</option>
            <option value="failed">Ошибки</option>
            <option value="processing">В работе</option>
          </select>
        </div>
      </div>

      <div className="bg-[#2f2f2f] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-gray-400 text-left bg-[#252525]">
              <th className="p-4">Статус</th>
              <th className="p-4">Тип</th>
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
                <td className="p-4">{getTypeBadge(r.type)}</td>
                <td className="p-4 text-white">{r.user_email}</td>
                <td className="p-4 text-gray-300">{r.external_provider || r.provider}</td>
                <td className="p-4 text-gray-300">{r.model}</td>
                <td className="p-4 text-gray-300">
                  {r.type === 'chat' ? `${r.tokens_input || 0} / ${r.tokens_output || 0}` : '/'}
                </td>
                <td className="p-4 text-gray-300">${(r.provider_cost || 0).toFixed(6)}</td>
                <td className="p-4 text-gray-500">{new Date(r.created_at).toLocaleString('ru', TZ)}</td>
              </tr>
            ))}
            {filteredRequests.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-gray-500">Нет запросов</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedRequest && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={handleBackdropClick}
        >
          <div className="bg-[#2f2f2f] rounded-lg w-full max-w-5xl max-h-[90vh] overflow-auto m-4">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">Детали запроса</h2>
                {getStatusBadge(selectedRequest.status)}
                {getTypeBadge(selectedRequest.type)}
              </div>
              <button onClick={closeModal} className="p-1 hover:bg-[#3f3f3f] rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {modalLoading ? (
              <div className="p-4 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500">Провайдер</p>
                    <p className="text-white">{selectedRequest.external_provider || selectedRequest.provider}</p>
                  </div>
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500">Модель</p>
                    <p className="text-white">{selectedRequest.model}</p>
                  </div>
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500">Стоимость (USD)</p>
                    <p className="text-white">${(selectedRequest.costs?.provider_cost_usd || 0).toFixed(6)}</p>
                  </div>
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500">Токены</p>
                    <p className="text-white">{(selectedRequest.costs?.credits_spent || 0).toFixed(4)}</p>
                  </div>
                </div>

                {selectedRequest.external_task_id && (
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500 mb-1">Task ID</p>
                    <code className="text-green-400 text-sm">{selectedRequest.external_task_id}</code>
                  </div>
                )}

                {selectedRequest.result_url && (
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500 mb-2">Результат</p>
                    {selectedRequest.type === 'image' ? (
                      <div className="flex gap-2 flex-wrap">
                        {(selectedRequest.result_urls || [selectedRequest.result_url]).map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt={`Result ${i + 1}`} className="h-32 rounded border border-gray-600 hover:border-blue-500" />
                          </a>
                        ))}
                      </div>
                    ) : selectedRequest.type === 'video' ? (
                      <video src={selectedRequest.result_url} controls className="max-h-48 rounded" />
                    ) : (
                      <a href={selectedRequest.result_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 flex items-center gap-1">
                        {selectedRequest.result_url} <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}

                <div className="bg-[#252525] p-3 rounded">
                  <p className="text-xs text-gray-500 mb-2">Промпт</p>
                  <p className="text-white whitespace-pre-wrap">{selectedRequest.input?.prompt || 'Нет данных'}</p>
                </div>

                {selectedRequest.output?.content && (
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500 mb-2">Ответ</p>
                    <p className="text-white whitespace-pre-wrap">{selectedRequest.output.content}</p>
                  </div>
                )}

                {selectedRequest.error && (
                  <div className="bg-red-900/30 border border-red-700 p-3 rounded">
                    <p className="text-xs text-red-400 mb-1">Ошибка: {selectedRequest.error.code}</p>
                    <p className="text-red-300 text-sm">{selectedRequest.error.message}</p>
                  </div>
                )}

                {selectedRequest.events && selectedRequest.events.length > 0 && (
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500 mb-3">История событий ({selectedRequest.events.length})</p>
                    <div className="space-y-2">
                      {selectedRequest.events.map((event) => (
                        <div key={event.id} className="border border-gray-700 rounded">
                          <div
                            onClick={() => toggleEventExpand(event.id)}
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[#353535]"
                          >
                            {expandedEvents.has(event.id) ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                            {getEventIcon(event.event_type)}
                            <span className="text-white font-medium">{getEventLabel(event.event_type)}</span>
                            {event.external_status && (
                              <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                                {event.external_status}
                              </span>
                            )}
                            <span className="text-xs text-gray-500 ml-auto">
                              {new Date(event.created_at).toLocaleTimeString('ru', TZ)}
                            </span>
                          </div>
                          {expandedEvents.has(event.id) && event.response_data && (
                            <div className="border-t border-gray-700 p-3 bg-[#1f1f1f]">
                              <pre className="text-xs text-gray-400 overflow-auto max-h-64">
                                {JSON.stringify(event.response_data, null, 2)}
                              </pre>
                            </div>
                          )}
                          {expandedEvents.has(event.id) && event.error_message && (
                            <div className="border-t border-gray-700 p-3 bg-red-900/20">
                              <p className="text-sm text-red-400">{event.error_message}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500">Создан</p>
                    <p className="text-gray-300">{new Date(selectedRequest.timing.created_at).toLocaleString('ru', TZ)}</p>
                  </div>
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500">Запущен</p>
                    <p className="text-gray-300">
                      {selectedRequest.timing.started_at ? new Date(selectedRequest.timing.started_at).toLocaleString('ru', TZ) : '-'}
                    </p>
                  </div>
                  <div className="bg-[#252525] p-3 rounded">
                    <p className="text-xs text-gray-500">Завершён</p>
                    <p className="text-gray-300">
                      {selectedRequest.timing.completed_at ? new Date(selectedRequest.timing.completed_at).toLocaleString('ru', TZ) : '-'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}