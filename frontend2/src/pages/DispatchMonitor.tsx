import React, { useState, useEffect, useCallback } from 'react';
import { dispatchApi } from '../lib/dispatchClient';
import { getSocket } from '../lib/socket';
import UnassignedBookingsPanel from '../components/UnassignedBookingsPanel';

/* ─── Types ─── */
interface DispatchStats {
  activeDispatches?: number;
  recentFailures?: number;
  cooldowns?: number;
  acceptRate24h?: number;
  breakdown24h?: {
    total?: number;
    accepted?: number;
    rejected?: number;
    expired?: number;
    noProvider?: number;
    failed?: number;
  };
  [key: string]: any;
}

interface ActiveDispatch {
  bookingId?: string;
  startedAt?: string;
  currentRadius?: number;
  radius?: number;
  attempt?: number;
  cycle?: number;
  batch?: number;
  status?: string;
}

/* ─── Helpers ─── */
const timeAgo = (dateStr?: string): string => {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff)) return '—';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

const num = (v: any): number => (typeof v === 'number' && !isNaN(v) ? v : 0);

/* ══════════════════════════════════════════════ */
const DispatchMonitor: React.FC = () => {
  const [stats, setStats] = useState<DispatchStats | null>(null);
  const [active, setActive] = useState<ActiveDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [debugId, setDebugId] = useState('');
  const [debugResult, setDebugResult] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState(false);

  /* ─── Fetch ─── */
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [s, a] = await Promise.allSettled([
        dispatchApi.getStats(),
        dispatchApi.getActive(),
      ]);

      if (s.status === 'fulfilled') {
        setStats(s.value || null);
      } else {
        console.warn('⚠️ stats failed:', s.reason);
      }

      if (a.status === 'fulfilled') {
        setActive(Array.isArray(a.value) ? a.value : []);
      } else {
        setActive([]);
      }

      if (s.status === 'rejected' && a.status === 'rejected') {
        setError(
          (s.reason as any)?.response?.data?.message ||
            (s.reason as any)?.message ||
            'Failed to load dispatch data'
        );
      }

      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  /* ─── Socket ─── */
  useEffect(() => {
    let socket: any;
    try {
      socket = getSocket();
    } catch {
      return;
    }
    const refresh = () => fetchData();

    socket.on('dispatch:status', refresh);
    socket.on('dispatch:started', refresh);
    socket.on('dispatch:completed', refresh);
    socket.on('new:booking', refresh);
    socket.on('booking:assigned', refresh);

    return () => {
      socket.off('dispatch:status', refresh);
      socket.off('dispatch:started', refresh);
      socket.off('dispatch:completed', refresh);
      socket.off('new:booking', refresh);
      socket.off('booking:assigned', refresh);
    };
  }, [fetchData]);

  /* ─── Debug ─── */
  const runDebug = async () => {
    const id = debugId.trim();
    if (!id) {
      alert('Enter a booking ID (e.g. PL000009)');
      return;
    }
    setDebugLoading(true);
    setDebugResult(null);
    try {
      const data = await dispatchApi.getEligibleProvidersDebug(id);
      setDebugResult(data);
    } catch (err: any) {
      setDebugResult({
        error: err?.response?.data?.message || err?.message || 'Debug failed',
        status: err?.response?.status,
      });
    } finally {
      setDebugLoading(false);
    }
  };

  const bd = stats?.breakdown24h || {};

  /* ══════════════════════════════════════════════ */
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-800">🎯 Dispatch Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time dispatch engine — live data from backend
            {lastUpdated && (
              <span className="ml-2 text-xs text-gray-400">
                (updated {lastUpdated.toLocaleTimeString()})
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition"
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={fetchData} className="underline font-bold text-xs">
            Retry
          </button>
        </div>
      )}

      {/* Stat cards */}
      {loading && !stats ? (
        <div className="text-center py-10 text-gray-400 text-sm">⏳ Loading dispatch stats...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 rounded-xl shadow-lg">
            <div className="text-[11px] font-bold uppercase opacity-80 tracking-wide">
              Active Dispatches
            </div>
            <div className="text-4xl font-black mt-2">{num(stats?.activeDispatches)}</div>
            <div className="text-[11px] opacity-70 mt-1">Currently searching</div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-rose-600 text-white p-5 rounded-xl shadow-lg">
            <div className="text-[11px] font-bold uppercase opacity-80 tracking-wide">
              Recent Failures
            </div>
            <div className="text-4xl font-black mt-2">{num(stats?.recentFailures)}</div>
            <div className="text-[11px] opacity-70 mt-1">no_provider_found</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-amber-600 text-white p-5 rounded-xl shadow-lg">
            <div className="text-[11px] font-bold uppercase opacity-80 tracking-wide">
              In Cooldown
            </div>
            <div className="text-4xl font-black mt-2">{num(stats?.cooldowns)}</div>
            <div className="text-[11px] opacity-70 mt-1">Waiting 10 min to retry</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white p-5 rounded-xl shadow-lg">
            <div className="text-[11px] font-bold uppercase opacity-80 tracking-wide">
              Accept Rate 24h
            </div>
            <div className="text-4xl font-black mt-2">
              {stats?.acceptRate24h != null ? `${Math.round(stats.acceptRate24h)}%` : '—'}
            </div>
            <div className="text-[11px] opacity-70 mt-1">Offers accepted</div>
          </div>
        </div>
      )}

      {/* 24h breakdown */}
      {stats?.breakdown24h && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">📊 Last 24 Hours — Offer Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-gray-50 p-3 rounded-lg text-center border">
              <div className="text-[11px] text-gray-500 font-bold uppercase">Total</div>
              <div className="text-2xl font-black text-gray-800">{num(bd.total)}</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg text-center border border-green-200">
              <div className="text-[11px] text-green-700 font-bold uppercase">Accepted</div>
              <div className="text-2xl font-black text-green-700">{num(bd.accepted)}</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg text-center border border-red-200">
              <div className="text-[11px] text-red-700 font-bold uppercase">Rejected</div>
              <div className="text-2xl font-black text-red-700">{num(bd.rejected)}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg text-center border">
              <div className="text-[11px] text-gray-600 font-bold uppercase">Expired</div>
              <div className="text-2xl font-black text-gray-700">{num(bd.expired)}</div>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg text-center border border-orange-200">
              <div className="text-[11px] text-orange-700 font-bold uppercase">No Provider</div>
              <div className="text-2xl font-black text-orange-700">
                {num(bd.noProvider) || num(bd.failed)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active dispatches */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-blue-50">
          <h2 className="text-sm font-bold text-gray-700">
            🚀 Active Dispatches ({active.length})
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Bookings currently being offered to providers
          </p>
        </div>
        {active.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            💤 No active dispatches right now
          </div>
        ) : (
          <div className="divide-y max-h-80 overflow-y-auto">
            {active.map((d, idx) => (
              <div key={idx} className="p-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-mono text-sm font-bold text-blue-600">
                    {d.bookingId || '—'}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Started {timeAgo(d.startedAt)}
                    {d.cycle != null && ` · Cycle ${d.cycle}`}
                    {d.batch != null && ` · Batch ${d.batch}`}
                    {d.attempt != null && ` · Attempt ${d.attempt}`}
                    {(d.currentRadius ?? d.radius) != null &&
                      ` · ${d.currentRadius ?? d.radius} km`}
                  </div>
                </div>
                <span className="text-[10px] px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-bold uppercase">
                  {d.status || 'searching'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Debug tool */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <h2 className="text-sm font-bold text-gray-700 mb-1">🔍 Why Was No Provider Found?</h2>
        <p className="text-[11px] text-gray-500 mb-3">
          Enter a booking ID to see exactly which providers were filtered out and why.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={debugId}
            onChange={(e) => setDebugId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runDebug()}
            placeholder="e.g. PL000009"
            className="flex-1 min-w-[220px] px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <button
            onClick={runDebug}
            disabled={debugLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition disabled:opacity-50"
          >
            {debugLoading ? '⏳ Running...' : '🔍 Debug'}
          </button>
        </div>
        {debugResult && (
          <div className="mt-3 p-3 bg-gray-900 text-green-400 rounded-lg text-[11px] font-mono overflow-auto max-h-96">
            <pre className="whitespace-pre-wrap break-words">
              {JSON.stringify(debugResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Unassigned bookings */}
      <UnassignedBookingsPanel />
    </div>
  );
};

export default DispatchMonitor;