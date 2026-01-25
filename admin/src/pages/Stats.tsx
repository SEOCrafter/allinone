import { useEffect, useState } from 'react';
import { getStats } from '../api/client';

export default function Stats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await getStats();
      setStats(response.data.stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-400">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Statistics</h1>

      {/* Expenses Placeholder */}
      <div className="bg-[#2f2f2f] rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Expenses (Coming Soon)</h2>
        <div className="text-gray-400">
          Detailed expense tracking with daily, weekly, and monthly breakdowns will be available here.
        </div>
      </div>

      {/* Request Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#2f2f2f] rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Requests by Status</h2>
          <div className="space-y-3">
            {stats?.requests?.by_status && Object.entries(stats.requests.by_status).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center">
                <span className="text-gray-300 capitalize">{status}</span>
                <span className="text-white font-semibold">{count as number}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#2f2f2f] rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Users by Role</h2>
          <div className="space-y-3">
            {stats?.users?.by_role && Object.entries(stats.users.by_role).map(([role, count]) => (
              <div key={role} className="flex justify-between items-center">
                <span className="text-gray-300 capitalize">{role}</span>
                <span className="text-white font-semibold">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-[#2f2f2f] rounded-lg p-6 mt-6">
        <h2 className="text-lg font-semibold text-white mb-4">Totals</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-gray-400 text-sm">Total Users</div>
            <div className="text-2xl font-bold text-white">{stats?.users?.total || 0}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Total Requests</div>
            <div className="text-2xl font-bold text-white">{stats?.requests?.total || 0}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Credits Spent</div>
            <div className="text-2xl font-bold text-white">{stats?.costs?.total_credits_spent?.toFixed(4) || 0}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Provider Cost</div>
            <div className="text-2xl font-bold text-white">${stats?.costs?.total_provider_cost_usd?.toFixed(4) || 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}