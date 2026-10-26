// src/pages/ProviderOfferHistory.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Send,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { providerOffersApi, ProviderOffer } from '../lib/api';

export default function ProviderOfferHistory() {
  const [offers, setOffers] = useState<ProviderOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [bookingIdFilter, setBookingIdFilter] = useState('');
  const [providerIdFilter, setProviderIdFilter] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await providerOffersApi.getAll({
        page,
        limit: 20,
        status: statusFilter || undefined,
        bookingId: bookingIdFilter || undefined,
        providerId: providerIdFilter || undefined,
      });
      if (res.success) {
        setOffers(res.data.offers);
        setTotalPages(res.data.pagination.totalPages);
        setTotal(res.data.pagination.total);
      }
    } catch (e) {
      console.error('Fetch offers error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [page, statusFilter, bookingIdFilter, providerIdFilter]);

  const statusIcon = (s: string) => {
    if (s === 'accepted') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (['rejected', 'cancelled', 'failed'].includes(s)) return <XCircle className="w-4 h-4 text-red-500" />;
    if (s === 'timeout') return <Clock className="w-4 h-4 text-amber-500" />;
    if (s === 'superseded') return <AlertCircle className="w-4 h-4 text-gray-400" />;
    return <Send className="w-4 h-4 text-blue-500" />;
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      accepted: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-red-100 text-red-700',
      cancelled: 'bg-red-100 text-red-700',
      timeout: 'bg-amber-100 text-amber-700',
      failed: 'bg-red-100 text-red-700',
      superseded: 'bg-gray-100 text-gray-600',
      sent: 'bg-blue-100 text-blue-700',
      delivered: 'bg-indigo-100 text-indigo-700',
      viewed: 'bg-purple-100 text-purple-700',
    };
    return map[s] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Provider Offer History</h1>
          <p className="text-sm text-gray-500 mt-1">Every booking offer sent to every provider ({total} total)</p>
        </div>
        <button onClick={fetch} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Filters:</span>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="viewed">Viewed</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
          <option value="timeout">Timeout</option>
          <option value="failed">Failed</option>
          <option value="superseded">Superseded</option>
        </select>
        <input
          type="text"
          value={bookingIdFilter}
          onChange={(e) => {
            setBookingIdFilter(e.target.value);
            setPage(1);
          }}
          placeholder="Booking ID"
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-40"
        />
        <input
          type="text"
          value={providerIdFilter}
          onChange={(e) => {
            setProviderIdFilter(e.target.value);
            setPage(1);
          }}
          placeholder="Provider ID"
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-40"
        />
        {(statusFilter || bookingIdFilter || providerIdFilter) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setBookingIdFilter('');
              setProviderIdFilter('');
              setPage(1);
            }}
            className="text-xs text-red-600 font-semibold hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase">Booking</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase">Provider</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase">Cycle/Batch</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase">Distance</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase">FCM</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase">Sent At</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase">Responded</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                  </td>
                </tr>
              )}
              {!loading && offers.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-500">
                    No offers found
                  </td>
                </tr>
              )}
              {!loading &&
                offers.map((o) => (
                  <tr key={o._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/bookings?open=${o.bookingId}`}
                        className="text-indigo-600 hover:underline font-semibold text-xs"
                      >
                        {o.bookingId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 text-xs">{o.providerName}</div>
                      <div className="text-[10px] text-gray-500">{o.providerId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${statusColor(
                          o.status
                        )}`}
                      >
                        {statusIcon(o.status)}
                        {o.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      C{o.dispatchCycle} / B{o.batchNumber}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {o.distanceKm > 0 ? `${o.distanceKm.toFixed(2)}km` : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {o.fcmSent ? (
                        <span className="text-emerald-600 font-semibold">✓</span>
                      ) : (
                        <span className="text-red-600 font-semibold">✗</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">
                      {new Date(o.offeredAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">
                      {o.respondedAt
                        ? new Date(o.respondedAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-xs text-gray-600">
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}