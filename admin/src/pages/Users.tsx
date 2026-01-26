import { useEffect, useState } from 'react';
import { getUsers, setUserRole, setUserPassword, blockUser, unblockUser } from '../api/client';
import { MoreVertical, RefreshCw, Plus, X } from 'lucide-react';
import api from '../api/client';

interface User {
  id: string;
  email: string;
  role: string;
  credits_balance: number;
  is_blocked: boolean;
  created_at: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  // Закрыть меню при клике вне
  useEffect(() => {
    const handleClickOutside = () => setMenuOpen(null);
    if (menuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [menuOpen]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await getUsers(1, 100);
      const items = response.data?.data;
      setUsers(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword) return;
    setCreating(true);
    try {
      await api.post('/auth/register', {
        email: newEmail,
        password: newPassword,
      });
      // Если нужна другая роль — меняем сразу после создания
      if (newRole !== 'user') {
        const usersResponse = await getUsers(1, 100);
        const created = usersResponse.data?.data?.find((u: User) => u.email === newEmail);
        if (created) {
          await setUserRole(created.id, newRole);
        }
      }
      setShowCreateModal(false);
      setNewEmail('');
      setNewPassword('');
      setNewRole('user');
      loadUsers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || 'Ошибка создания пользователя');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await setUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setMenuOpen(null);
    } catch (err) {
      console.error('Ошибка изменения роли:', err);
    }
  };

  const handlePasswordReset = async (userId: string) => {
    const newPassword = prompt('Введите новый пароль:');
    if (!newPassword) return;
    
    try {
      await setUserPassword(userId, newPassword);
      alert('Пароль изменён');
      setMenuOpen(null);
    } catch (err) {
      console.error('Ошибка изменения пароля:', err);
      alert('Ошибка изменения пароля');
    }
  };

  const handleBlockToggle = async (userId: string, currentBlocked: boolean) => {
    try {
      if (currentBlocked) {
        await unblockUser(userId);
      } else {
        await blockUser(userId);
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_blocked: !currentBlocked } : u));
      setMenuOpen(null);
    } catch (err) {
      console.error('Ошибка блокировки:', err);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'superadmin':
        return <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">superadmin</span>;
      case 'admin':
        return <span className="px-2 py-1 bg-orange-600 text-white text-xs rounded">admin</span>;
      case 'developer':
        return <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">developer</span>;
      default:
        return <span className="px-2 py-1 bg-gray-600 text-white text-xs rounded">user</span>;
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-400">Загрузка...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Пользователи</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Создать
          </button>
          <button
            onClick={loadUsers}
            className="flex items-center gap-2 px-4 py-2 bg-[#3f3f3f] hover:bg-[#4f4f4f] text-white rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Обновить
          </button>
        </div>
      </div>

      {/* Таблица без overflow-hidden */}
      <div className="bg-[#2f2f2f] rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="text-gray-400 text-left bg-[#252525]">
              <th className="p-4 rounded-tl-lg">Email</th>
              <th className="p-4">Роль</th>
              <th className="p-4">Кредиты</th>
              <th className="p-4">Статус</th>
              <th className="p-4">Создан</th>
              <th className="p-4 w-10 rounded-tr-lg"></th>
            </tr>
          </thead>
          <tbody>
            {(users || []).map((u, index) => (
              <tr key={u.id} className="border-t border-gray-700">
                <td className="p-4 text-white">{u.email}</td>
                <td className="p-4">{getRoleBadge(u.role)}</td>
                <td className="p-4 text-gray-300">{parseFloat(String(u.credits_balance || 0)).toFixed(2)}</td>
                <td className="p-4">
                  {u.is_blocked ? (
                    <span className="text-red-400">Заблокирован</span>
                  ) : (
                    <span className="text-green-400">Активен</span>
                  )}
                </td>
                <td className="p-4 text-gray-500">
                  {new Date(u.created_at).toLocaleDateString('ru')}
                </td>
                <td className="p-4 relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === u.id ? null : u.id);
                    }}
                    className="p-1 hover:bg-[#3f3f3f] rounded"
                  >
                    <MoreVertical className="w-5 h-5 text-gray-400" />
                  </button>

                  {menuOpen === u.id && (
                    <div 
                      className={`absolute right-4 bg-[#3f3f3f] rounded-lg shadow-xl z-50 py-1 min-w-[180px] ${
                        index >= users.length - 2 ? 'bottom-12' : 'top-12'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleRoleChange(u.id, 'user')}
                        className="w-full px-4 py-2 text-left text-white hover:bg-[#4f4f4f]"
                      >
                        Роль: user
                      </button>
                      <button
                        onClick={() => handleRoleChange(u.id, 'developer')}
                        className="w-full px-4 py-2 text-left text-white hover:bg-[#4f4f4f]"
                      >
                        Роль: developer
                      </button>
                      <button
                        onClick={() => handleRoleChange(u.id, 'superadmin')}
                        className="w-full px-4 py-2 text-left text-white hover:bg-[#4f4f4f]"
                      >
                        Роль: superadmin
                      </button>
                      <hr className="border-gray-600 my-1" />
                      <button
                        onClick={() => handlePasswordReset(u.id)}
                        className="w-full px-4 py-2 text-left text-white hover:bg-[#4f4f4f]"
                      >
                        Сменить пароль
                      </button>
                      <button
                        onClick={() => handleBlockToggle(u.id, u.is_blocked)}
                        className="w-full px-4 py-2 text-left text-red-400 hover:bg-[#4f4f4f]"
                      >
                        {u.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  Нет пользователей
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Модальное окно создания пользователя */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#2f2f2f] rounded-lg w-full max-w-md m-4">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Создать пользователя</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-[#3f3f3f] rounded"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-gray-400 mb-2">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-2">Пароль</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-2">Роль</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
                >
                  <option value="user">user</option>
                  <option value="developer">developer</option>
                  <option value="superadmin">superadmin</option>
                </select>
              </div>

              <button
                onClick={handleCreateUser}
                disabled={creating || !newEmail || !newPassword}
                className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-semibold"
              >
                {creating ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}