import { useEffect, useState } from 'react';
import { getStats } from '../api/client';
import { Users, MessageSquare, DollarSign, Zap } from 'lucide-react';

interface Stats {
  users: {
    total: number;
    by_role: Record<string, number>;
  };
  requests: {
    total: number;
    by_status: Record<string, number>;
  };
  costs: {
    total_credits_spent: number;
    total_provider_cost_usd: number;
  };
  tokens: {
    total_input: number;
    total_output: number;
  };
  by_provider: Array<{
    provider: string;
    requests: number;
    cost_usd: number;
  }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
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

  if (!stats) {
    return <div className="p-6 text-red-400">Failed to load stats</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Users className="w-6 h-6" />}
          title="Users"
          value={stats.users.total}
          subtitle={`${stats.users.by_role.superadmin || 0} admins, ${stats.users.by_role.developer || 0} devs`}
          color="blue"
        />
        <StatCard
          icon={<MessageSquare className="w-6 h-6" />}
          title="Requests"
          value={stats.requests.total}
          subtitle={`${stats.requests.by_status.completed || 0} completed`}
          color="green"
        />
        <StatCard
          icon={<DollarSign className="w-6 h-6" />}
          title="Provider Cost"
          value={`$${stats.costs.total_provider_cost_usd.toFixed(4)}`}
          subtitle={`${stats.costs.total_credits_spent.toFixed(2)} credits`}
          color="yellow"
        />
        <StatCard
          icon={<Zap className="w-6 h-6" />}
          title="Tokens"
          value={(stats.tokens.total_input + stats.tokens.total_output).toLocaleString()}
          subtitle={`${stats.tokens.total_input.toLocaleString()} in / ${stats.tokens.total_output.toLocaleString()} out`}
          color="purple"
        />
      </div>

      {/* By Provider */}
      <div className="bg-[#2f2f2f] rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">By Provider</h2>
        <table className="w-full">
          <thead>
            <tr className="text-gray-400 text-left">
              <th className="pb-3">Provider</th>
              <th className="pb-3">Requests</th>
              <th className="pb-3">Cost (USD)</th>
            </tr>
          </thead>
          <tbody>
            {stats.by_provider.map((p) => (
              <tr key={p.provider} className="border-t border-gray-700">
                <td className="py-3 text-white">{p.provider}</td>
                <td className="py-3 text-gray-300">{p.requests}</td>
                <td className="py-3 text-gray-300">${p.cost_usd.toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle: string;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const colors = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    purple: 'bg-purple-600',
  };

  return (
    <div className="bg-[#2f2f2f] rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <span className="text-gray-400">{title}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-500">{subtitle}</div>
    </div>
  );
}