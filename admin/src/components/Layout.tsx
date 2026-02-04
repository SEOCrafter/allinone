import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Activity, MessageSquare, Users, BarChart3, LogOut, Calculator, ArrowRightLeft, CreditCard, Headphones } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Дашборд' },
    { to: '/adapters', icon: Activity, label: 'Адаптеры' },
    { to: '/providers', icon: ArrowRightLeft, label: 'Провайдеры' },
    { to: '/tariffs', icon: CreditCard, label: 'Тарифы' },
    { to: '/requests', icon: MessageSquare, label: 'Запросы' },
    { to: '/users', icon: Users, label: 'Пользователи' },
    { to: '/stats', icon: BarChart3, label: 'Статистика' },
    { to: '/unit-economics', icon: Calculator, label: 'Unit-экономика' },
    { to: '/support', icon: Headphones, label: 'Техподдержка' },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <div className="w-64 bg-[#1a1a1a] flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">UmnikAI</h1>
          <p className="text-sm text-gray-500">Админ-панель</p>
        </div>

        <nav className="flex-1 p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-[#2f2f2f] text-white'
                    : 'text-gray-400 hover:bg-[#252525] hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">{user.email}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#2f2f2f] rounded"
              title="Выйти"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <Outlet />
      </div>
    </div>
  );
}