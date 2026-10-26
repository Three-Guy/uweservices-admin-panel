import React, { useState, useEffect, useCallback } from 'react';
import { dispatchApi } from '../lib/dispatchClient';
import { getSocket } from '../lib/socket';

/* ─── Types ─── */
interface Offer {
  providerId?: string;
  providerName?: string;
  status?: string;
  sentAt?: string;
  respondedAt?: string;
  distanceKm?: number;
  fcmSent?: boolean;
}

interface Booking {
  _id: string;
  bookingId: string;
  customerName?: string;
  serviceName?: string;
  categoryName?: string;
  city?: { cityName?: string } | string;
  status: string;
  createdAt: string;
  providerId?: string | null;
  offers?: Offer[];
  offerCount?: number;
}

/* ─── Helpers ─── */
const statusColor = (status: string): string => {
  switch (status) {
    case 'confirmed': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'searching': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'no_provider_found': return 'bg-red-100 text-red-800 border-red-300';
    case 'pending': return 'bg-gray-100 text-gray-800 border-gray-300';
    default: return 'bg-gray-100 text-gray-700 border-gray-300';
  }
};

const offerBadge = (status?: string): string => {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    sent: 'bg-blue-100 text-blue-700',
    accepted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    expired: 'bg-gray-100 text-gray-600',
    failed: 'bg-rose-100 text-rose-700',
    superseded: 'bg-purple-100 text-purple-700',
  };
  return map[String(status || '').toLowerCase()] || 'bg-gray-100 text-gray-700';
};

const timeAgo = (dateStr?: string): string => {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff)) return '—';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const cityName = (city: any): string => {
  if (!city) return '—';
  if (typeof city === 'string') return city;
  return city.cityName || city.name || '—';
};

/* ══════════════════════════════════════════════ */
const UnassignedBookingsPanel: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] =
    useState<'all' | 'confirmed' | 'searching' | 'no_provider_found'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  /* ─── Fetch ─── */
  const fetchBookings = useCallback(async () => {
    try {
      setError(null);
      const list = await dispatchApi.getUnassignedBookings();
      setBookings(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('❌ Unassigned fetch error:', err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load unassigned bookings'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 15000);
    return () => clearInterval(interval);
  }, [fetchBookings]);

  /* ─── Socket live refresh ─── */
  useEffect(() => {
    let socket: any;
    try {
      socket = getSocket();
    } catch {
      return;
    }
    const refresh = () => fetchBookings();

    socket.on('new:booking', refresh);
    socket.on('new_booking', refresh);
    socket.on('booking:created', refresh);
    socket.on('booking:updated', refresh);
    socket.on('booking:assigned', refresh);
    socket.on('dispatch:status', refresh);
    socket.on('offer:updated', refresh);

    return () => {
      socket.off('new:booking', refresh);
      socket.off('new_booking', refresh);
      socket.off('booking:created', refresh);
      socket.off('booking:updated', refresh);
      socket.off('booking:assigned', refresh);
      socket.off('dispatch:status', refresh);
      socket.off('offer:updated', refresh);
    };
  }, [fetchBookings]);

  /* ─── Redispatch ─── */
  const handleRedispatch = async (bookingId: string) => {
    if (!window.confirm(`Redispatch ${bookingId}?\n\nThis clears the cooldown, supersedes old offers, and searches for providers again.`)) {
      return;
    }
    setBusyId(bookingId);
    try {
      await dispatchApi.autoRedispatch(bookingId);
      showToast(`✅ Redispatch triggered for ${bookingId}`, true);
      setTimeout(fetchBookings, 1500);
    } catch (err: any) {
      console.error('❌ Redispatch failed:', err);
      showToast(
        `❌ ${err?.response?.data?.message || err?.message || 'Redispatch failed'}`,
        false
      );
    } finally {
      setBusyId(null);
    }
  };

  /* ─── Plain trigger ─── */
  const handleTrigger = async (bookingId: string) => {
    setBusyId(bookingId);
    try {
      await dispatchApi.trigger(bookingId);
      showToast(`🚀 Dispatch triggered for ${bookingId}`, true);
      setTimeout(fetchBookings, 1500);
    } catch (err: any) {
      showToast(
        `❌ ${err?.response?.data?.message || err?.message || 'Trigger failed'}`,
        false
      );
    } finally {
      setBusyId(null);
    }
  };

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  /* ─── Filter + counts ─── */
  const counts = {
    all: bookings.length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    searching: bookings.filter((b) => b.status === 'searching').length,
    no_provider_found: bookings.filter((b) => b.status === 'no_provider_found').length,
  };

  const filtered =
    filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  /* ══════════════════════════════════════════════ */
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden relative">
      {/* Toast */}
      {toast && (
        <div
          className={`absolute top-3 right-3 z-20 px-4 py-2 rounded-lg text-xs font-bold shadow-lg ${
            toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-red-50 to-orange-50">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              🚨 Unassigned Bookings
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                {bookings.length}
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Live from <code className="font-mono">bookings_db.bookings</code> — no provider assigned yet
            </p>
          </div>
          <button
            onClick={fetchBookings}
            className="px-3 py-1.5 bg-white border rounded-lg text-xs font-bold hover:bg-gray-50 transition"
          >
            🔄 Refresh
          </button>
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          {(['all', 'confirmed', 'searching', 'no_provider_found'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === f
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'All' : f.replace(/_/g, ' ')} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border-b text-xs text-red-700">
          ⚠️ {error}
          <button onClick={fetchBookings} className="ml-2 underline font-bold">
            Retry
          </button>
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="p-10 text-center text-gray-400 text-sm">
          ⏳ Loading unassigned bookings...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-gray-400">
          <div className="text-4xl mb-2">✅</div>
          <div className="text-sm">
            No unassigned bookings{filter !== 'all' ? ` in "${filter.replace(/_/g, ' ')}"` : ''}
          </div>
        </div>
      ) : (
        <div className="divide-y max-h-[640px] overflow-y-auto">
          {filtered.map((b) => {
            const offers = Array.isArray(b.offers) ? b.offers : [];
            return (
              <div key={b._id || b.bookingId} className="p-4 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-blue-600">
                        {b.bookingId}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${statusColor(
                          b.status
                        )}`}
                      >
                        {String(b.status).replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-gray-400">{timeAgo(b.createdAt)}</span>
                    </div>

                    <div className="mt-1 text-sm text-gray-800 font-medium">
                      {b.customerName || 'Unknown customer'}
                      {b.serviceName ? ` · ${b.serviceName}` : ''}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {b.categoryName || '—'} · 📍 {cityName(b.city)}
                    </div>

                    {(offers.length > 0 || b.offerCount) && (
                      <button
                        onClick={() => toggleExpand(b._id || b.bookingId)}
                        className="mt-2 text-xs text-blue-600 hover:underline font-medium"
                      >
                        {expandedId === (b._id || b.bookingId) ? '▲ Hide' : '▼ Show'}{' '}
                        {offers.length || b.offerCount} offer(s) sent
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleTrigger(b.bookingId)}
                      disabled={busyId === b.bookingId}
                      className="px-3 py-1.5 bg-white border border-blue-300 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-50 transition disabled:opacity-50"
                    >
                      🚀 Trigger
                    </button>
                    <button
                      onClick={() => handleRedispatch(b.bookingId)}
                      disabled={busyId === b.bookingId}
                      className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg text-xs font-bold hover:from-orange-600 hover:to-red-600 transition disabled:opacity-50 shadow"
                    >
                      {busyId === b.bookingId ? '⏳ Working...' : '🔄 Redispatch'}
                    </button>
                  </div>
                </div>

                {/* Offer trail */}
                {expandedId === (b._id || b.bookingId) && offers.length > 0 && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                    <div className="text-[11px] font-bold text-gray-700 mb-2 uppercase tracking-wide">
                      Offer Trail ({offers.length})
                    </div>
                    <div className="space-y-1.5">
                      {offers.map((o, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 text-xs bg-white p-2 rounded border flex-wrap"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold text-gray-700">
                              {o.providerId || '—'}
                            </span>
                            {o.providerName && (
                              <span className="text-gray-500 truncate">{o.providerName}</span>
                            )}
                            {typeof o.distanceKm === 'number' && (
                              <span className="text-gray-400">{o.distanceKm.toFixed(1)} km</span>
                            )}
                            {o.fcmSent === false && (
                              <span className="text-rose-600 font-bold" title="FCM push failed">
                                ✗ FCM
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${offerBadge(
                                o.status
                              )}`}
                            >
                              {o.status || 'unknown'}
                            </span>
                            <span className="text-gray-400 text-[10px]">{timeAgo(o.sentAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UnassignedBookingsPanel;