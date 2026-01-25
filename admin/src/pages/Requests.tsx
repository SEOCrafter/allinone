import { useEffect, useState } from 'react';
import { getRequests, getRequestDetail } from '../api/client';
import { X } from 'lucide-react';

interface Request {
  id: string;
  user_email: string;
  type: string;
  provider: string;
  model: string;
  status: string;
  status_label: string;
  prompt: string;
  response: string;
  tokens_input: number;
  tokens_output: number;
  credits_spent: number;
  provider_cost: number;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

interface RequestDetail {
  id: string;
  user_email: string;
  input: {
    prompt: string;
    params: Record<string, any>;
  };
  output: {
    content: string;
    tokens_input: number;
    tokens_output: number;
  };
  costs: {
    credits_spent: number;
    provider_cost_usd: number;
  };
  error: {
    code: string;
    message: string;
  } | null;
}

export default function Requests() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [selectedRequest, setSelectedRequest] = useState<RequestDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await getRequests(1, 100, filter || undefined);
      setRequests(response.data.data);
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id: string) => {
    setModalLoading(true);
    try {
      const response = await getRequestDetail(id);
      setSelectedRequest(response.data.request);
    } catch (err) {
      console.error('Failed to load request detail:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const getStatusColor = (label: string) => {
    switch (label) {
      case 'OK':
        return 'bg-green-600';
      case 'ERR':
        return 'bg-red-600';
      case 'WARN':
        return 'bg-yellow-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Requests Log</h1>
        
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 bg-[#3f3f3f] border border-gray-600 rounded-lg text-white"
        >
          <option value="">All</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : (
        <div className="bg-[#2f2f2f] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-gray-400 text-left bg-[#252525]">
                <th className="p-3">Status</th>
                <th className="p-3">User</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Model</th>
                <th className="p-3">Tokens</th>
                <th className="p-3">Cost</th>
                <th className="p-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => openDetail(req.id)}
                  className="border-t border-gray-700 hover:bg-[#353535] cursor-pointer"
                >
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(req.status_label)}`}>
                      {req.status_label}
                    </span>
                  </td>
                  <td className="p-3 text-gray-300">{req.user_email}</td>
                  <td className="p-3 text-gray-300">{req.provider}</td>
                  <td className="p-3 text-gray-300 text-sm">{req.model}</td>
                  <td className="p-3 text-gray-300 text-sm">
                    {req.tokens_input} / {req.tokens_output}
                  </td>
                  <td className="p-3 text-gray-300 text-sm">
                    ${req.provider_cost.toFixed(6)}
                  </td>
                  <td className="p-3 text-gray-500 text-sm">
                    {new Date(req.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#2f2f2f] rounded-lg w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">Request Detail</h2>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {modalLoading ? (
              <div className="p-4 text-gray-400">Loading...</div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {/* Input */}
                  <div className="bg-[#252525] rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">INPUT</h3>
                    <pre className="text-gray-300 text-sm whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedRequest.input, null, 2)}
                    </pre>
                  </div>

                  {/* Output */}
                  <div className="bg-[#252525] rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">OUTPUT</h3>
                    <pre className="text-gray-300 text-sm whitespace-pre-wrap break-words">
                      {selectedRequest.error 
                        ? JSON.stringify(selectedRequest.error, null, 2)
                        : selectedRequest.output.content}
                    </pre>
                  </div>

                  {/* Parsed */}
                  <div className="bg-[#252525] rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">PARSED</h3>
                    <div className="text-gray-300 text-sm space-y-2">
                      <div>Tokens In: {selectedRequest.output.tokens_input}</div>
                      <div>Tokens Out: {selectedRequest.output.tokens_output}</div>
                      <div>Credits: {selectedRequest.costs.credits_spent.toFixed(6)}</div>
                      <div>Provider: ${selectedRequest.costs.provider_cost_usd.toFixed(6)}</div>
                    </div>
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