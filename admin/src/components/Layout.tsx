import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Activity, MessageSquare, Users, BarChart3, LogOut } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/adapters', icon: Activity, label: 'Adapters' },
    { to: '/requests', icon: MessageSquare, label: 'Requests' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/stats', icon: BarChart3, label: 'Stats' },
  ];

  return (
    <div className="min-h-screen bg-[#212121] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#171717] border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">AI Aggregator</h1>
          <p className="text-sm text-gray-500">Admin Panel</p>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-[#2f2f2f] text-white'
                        : 'text-gray-400 hover:bg-[#252525] hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white truncate">{user.email}</p>
              <p className="text-xs text-gray-500">Superadmin</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#2f2f2f] rounded-lg"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}