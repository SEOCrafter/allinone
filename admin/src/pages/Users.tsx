import { useEffect, useState } from 'react';
import { getUsers, setUserRole, setUserPassword, blockUser, unblockUser } from '../api/client';
import { MoreVertical, X } from 'lucide-react';

interface User {
  id: string;
  email: string;
  role: string;
  credits_balance: number;
  is_active: boolean;
  is_blocked: boolean;
  language: string;
  created_at: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await getUsers(1, 100);
      setUsers(response.data.data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const openUserModal = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setNewPassword('');
    setShowModal(true);
  };

  const handleSetPassword = async () => {
    if (!selectedUser || !newPassword) return;
    setActionLoading(true);
    try {
      await setUserPassword(selectedUser.id, newPassword);
      alert('Password updated');
      setNewPassword('');
    } catch (err) {
      alert('Failed to update password');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetRole = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      await setUserRole(selectedUser.id, newRole);
      await loadUsers();
      alert('Role updated');
    } catch (err) {
      alert('Failed to update role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      if (selectedUser.is_blocked) {
        await unblockUser(selectedUser.id);
      } else {
        await blockUser(selectedUser.id);
      }
      await loadUsers();
      setShowModal(false);
    } catch (err) {
      alert('Failed to toggle block status');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-red-600';
      case 'developer':
        return 'bg-blue-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Users</h1>

      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : (
        <div className="bg-[#2f2f2f] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-gray-400 text-left bg-[#252525]">
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Credits</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-gray-700 hover:bg-[#353535]">
                  <td className="p-3 text-white">{user.email}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getRoleBadgeColor(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-3 text-gray-300">{user.credits_balance.toFixed(2)}</td>
                  <td className="p-3">
                    {user.is_blocked ? (
                      <span className="text-red-400">Blocked</span>
                    ) : (
                      <span className="text-green-400">Active</span>
                    )}
                  </td>
                  <td className="p-3 text-gray-500 text-sm">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => openUserModal(user)}
                      className="text-gray-400 hover:text-white"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* User Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#2f2f2f] rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">{selectedUser.email}</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Set Role */}
              <div>
                <label className="block text-gray-400 mb-2">Role</label>
                <div className="flex gap-2">
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="flex-1 px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
                  >
                    <option value="user">user</option>
                    <option value="developer">developer</option>
                    <option value="superadmin">superadmin</option>
                  </select>
                  <button
                    onClick={handleSetRole}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Set Password */}
              <div>
                <label className="block text-gray-400 mb-2">New Password</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="flex-1 px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
                  />
                  <button
                    onClick={handleSetPassword}
                    disabled={actionLoading || !newPassword}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg"
                  >
                    Set
                  </button>
                </div>
              </div>

              {/* Block/Unblock */}
              <div className="pt-4 border-t border-gray-700">
                <button
                  onClick={handleToggleBlock}
                  disabled={actionLoading}
                  className={`w-full py-2 rounded-lg ${
                    selectedUser.is_blocked
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  } text-white`}
                >
                  {selectedUser.is_blocked ? 'Unblock User' : 'Block User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}