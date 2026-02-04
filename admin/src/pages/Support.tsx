import { useState } from 'react';
import { MessageSquare, Clock, User, GripVertical, Plus, Search, Filter } from 'lucide-react';

interface Ticket {
  id: string;
  title: string;
  description: string;
  user: string;
  email: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  source: 'telegram' | 'web' | 'email';
  createdAt: string;
  status: string;
}

interface Column {
  id: string;
  title: string;
  color: string;
}

const COLUMNS: Column[] = [
  { id: 'new', title: 'Новые', color: '#3b82f6' },
  { id: 'in_progress', title: 'В работе', color: '#f59e0b' },
  { id: 'waiting', title: 'Ожидает ответа', color: '#8b5cf6' },
  { id: 'resolved', title: 'Решено', color: '#22c55e' },
];

const INITIAL_TICKETS: Ticket[] = [
  {
    id: '1',
    title: 'Не работает генерация изображений',
    description: 'При попытке сгенерировать изображение через Midjourney получаю ошибку 500',
    user: 'Александр Петров',
    email: 'alex@example.com',
    priority: 'high',
    source: 'telegram',
    createdAt: '2026-02-04T10:30:00',
    status: 'new',
  },
  {
    id: '2',
    title: 'Вопрос по тарифам',
    description: 'Хочу узнать подробнее про тариф Pro и что в него входит',
    user: 'Мария Иванова',
    email: 'maria@example.com',
    priority: 'low',
    source: 'web',
    createdAt: '2026-02-04T09:15:00',
    status: 'new',
  },
  {
    id: '3',
    title: 'Ошибка при оплате',
    description: 'Не могу пополнить баланс, платёж отклоняется',
    user: 'Дмитрий Сидоров',
    email: 'dmitry@example.com',
    priority: 'urgent',
    source: 'telegram',
    createdAt: '2026-02-04T08:45:00',
    status: 'in_progress',
  },
  {
    id: '4',
    title: 'Claude отвечает на английском',
    description: 'Несмотря на русский промпт, Claude иногда отвечает на английском языке',
    user: 'Елена Козлова',
    email: 'elena@example.com',
    priority: 'medium',
    source: 'email',
    createdAt: '2026-02-03T16:20:00',
    status: 'in_progress',
  },
  {
    id: '5',
    title: 'Запрос на API доступ',
    description: 'Хотим интегрировать ваш сервис в наше приложение, нужен API ключ',
    user: 'ООО "ТехСофт"',
    email: 'dev@techsoft.ru',
    priority: 'medium',
    source: 'web',
    createdAt: '2026-02-03T14:00:00',
    status: 'waiting',
  },
  {
    id: '6',
    title: 'Спасибо за быструю помощь!',
    description: 'Проблема с генерацией видео решена, всё работает отлично',
    user: 'Игорь Новиков',
    email: 'igor@example.com',
    priority: 'low',
    source: 'telegram',
    createdAt: '2026-02-02T11:30:00',
    status: 'resolved',
  },
  {
    id: '7',
    title: 'Долгая генерация видео',
    description: 'Kling генерирует видео уже 20 минут, это нормально?',
    user: 'Анна Белова',
    email: 'anna@example.com',
    priority: 'medium',
    source: 'telegram',
    createdAt: '2026-02-04T11:00:00',
    status: 'new',
  },
];

const priorityColors: Record<string, string> = {
  low: 'bg-gray-500',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

const priorityLabels: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  urgent: 'Срочный',
};

const sourceIcons: Record<string, string> = {
  telegram: '📱',
  web: '🌐',
  email: '📧',
};

export default function Support() {
  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);
  const [draggedTicket, setDraggedTicket] = useState<Ticket | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleDragStart = (e: React.DragEvent, ticket: Ticket) => {
    setDraggedTicket(ticket);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ticket.id);
    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggedTicket(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (draggedTicket) {
      setTickets(prev =>
        prev.map(t =>
          t.id === draggedTicket.id ? { ...t, status: columnId } : t
        )
      );
    }
    setDragOverColumn(null);
  };

  const getColumnTickets = (columnId: string) => {
    return tickets
      .filter(t => t.status === columnId)
      .filter(t => 
        searchQuery === '' || 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Только что';
    if (diffHours < 24) return `${diffHours}ч назад`;
    if (diffDays < 7) return `${diffDays}д назад`;
    return date.toLocaleDateString('ru-RU');
  };

  const totalTickets = tickets.length;
  const newTickets = tickets.filter(t => t.status === 'new').length;
  const urgentTickets = tickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Техподдержка</h1>
          <p className="text-gray-400 mt-1">Управление тикетами и обращениями пользователей</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Создать тикет
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
          <div className="text-3xl font-bold text-white">{totalTickets}</div>
          <div className="text-gray-400 text-sm">Всего тикетов</div>
        </div>
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
          <div className="text-3xl font-bold text-blue-400">{newTickets}</div>
          <div className="text-gray-400 text-sm">Новых</div>
        </div>
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
          <div className="text-3xl font-bold text-orange-400">{urgentTickets}</div>
          <div className="text-gray-400 text-sm">Срочных</div>
        </div>
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
          <div className="text-3xl font-bold text-green-400">
            {tickets.filter(t => t.status === 'resolved').length}
          </div>
          <div className="text-gray-400 text-sm">Решено сегодня</div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по тикетам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 bg-[#1a1a1a] border border-gray-800 text-gray-300 px-4 py-2 rounded-lg hover:bg-[#252525] transition-colors">
          <Filter className="w-4 h-4" />
          Фильтры
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 h-[calc(100vh-340px)]">
        {COLUMNS.map(column => {
          const columnTickets = getColumnTickets(column.id);
          const isOver = dragOverColumn === column.id;

          return (
            <div
              key={column.id}
              className={`bg-[#1a1a1a] rounded-lg border transition-all ${
                isOver ? 'border-blue-500 bg-blue-500/5' : 'border-gray-800'
              }`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: column.color }}
                  />
                  <span className="font-medium text-white">{column.title}</span>
                </div>
                <span className="bg-[#2f2f2f] text-gray-300 text-xs px-2 py-1 rounded-full">
                  {columnTickets.length}
                </span>
              </div>

              <div className="p-2 space-y-2 overflow-y-auto h-[calc(100%-52px)]">
                {columnTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, ticket)}
                    onDragEnd={handleDragEnd}
                    className={`bg-[#252525] rounded-lg p-3 cursor-grab active:cursor-grabbing hover:bg-[#2f2f2f] transition-colors border border-transparent hover:border-gray-700 ${
                      draggedTicket?.id === ticket.id ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="w-3 h-3 text-gray-600" />
                        <span className="text-lg">{sourceIcons[ticket.source]}</span>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full text-white ${priorityColors[ticket.priority]}`}
                      >
                        {priorityLabels[ticket.priority]}
                      </span>
                    </div>

                    <h3 className="text-white text-sm font-medium mb-1 line-clamp-2">
                      {ticket.title}
                    </h3>
                    <p className="text-gray-400 text-xs line-clamp-2 mb-3">
                      {ticket.description}
                    </p>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span className="truncate max-w-[100px]">{ticket.user}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(ticket.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {columnTickets.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Нет тикетов</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}