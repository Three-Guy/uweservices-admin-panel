// frontend2/src/pages/ManualDispatch.tsx
// Manual Dispatch — Real-time online detection + token health + force offline option
// Professional Redesign v2.0 — All logic preserved, UI enhanced

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { manualDispatchApi } from '../lib/dispatchClient';

// ============================================================
// TYPES
// ============================================================

interface Provider {
  _id: string;
  name: string;
  phone: string;
  email: string;
  category: string;
  categoryName: string;
  city: string;
  cityName: string;
  isOnline: boolean;
  realTimeStatus: 'online' | 'online_unverified' | 'recently_active' | 'idle' | 'offline';
  dbOnline: boolean;
  hasLiveSignal: boolean;
  minutesSinceActive: number | null;
  lastActive: string;
  lastActiveAgo: string;
  isApproved: boolean;
  isVerified: boolean;
  hasFCM: boolean;
  fcmTokenLength: number;
  tokenHealth: 'fresh' | 'stale' | 'invalid' | 'missing' | 'unknown';
  tokenWarning: string;
  tokenAgeDays: number | null;
  rating: number;
  totalJobs: number;
  profileImage: string;
  createdAt: string;
  timeAgo: string;
}

interface Booking {
  _id: string;
  bookingId: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  serviceIcon: string;
  categoryName: string;
  address: string;
  city: string;
  totalAmount: number;
  baseAmount: number;
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  createdAt: string;
  timeAgo: string;
  assignedProviderName: string;
  paymentMethod: string;
}

interface DispatchResult {
  offerId: string;
  providerName: string;
  fcmSent: boolean;
  fcmError: string | null;
  fcmErrorCode: string | null;
  tokenHealth: string;
  providerRealTimeStatus: string;
  providerMinutesSinceActive: number | null;
  diagnosticTips: string[];
  message: string;
}

// ============================================================
// HELPERS
// ============================================================

function deepUnwrap(res: any, listKey: 'providers' | 'bookings'): any[] {
  if (!res) return [];
  const candidates: any[] = [
    res, res?.data, res?.data?.data, res?.data?.data?.data, res?.result, res?.payload,
  ].filter(Boolean);
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
    if (c && typeof c === 'object' && Array.isArray(c[listKey])) return c[listKey];
    if (c && typeof c === 'object' && c.data && Array.isArray(c.data[listKey])) return c.data[listKey];
    if (c && typeof c === 'object' && c.data && Array.isArray(c.data)) return c.data;
  }
  return [];
}

function deepUnwrapStats(res: any): any {
  if (!res) return {};
  const candidates: any[] = [res, res?.data, res?.data?.data].filter(Boolean);
  for (const c of candidates) {
    if (c && typeof c === 'object' && c.stats) return c.stats;
    if (c && typeof c === 'object' && c.data && c.data.stats) return c.data.stats;
  }
  return {};
}

function formatAmount(amount: any): string {
  const n = Number(amount || 0);
  return isNaN(n) ? '0' : n.toFixed(2);
}

function getStatusBadge(status: string): { color: string; bg: string; label: string; icon: string } {
  const s = (status || '').toLowerCase();
  if (s === 'no_provider_found') return { color: 'text-red-700', bg: 'bg-red-50 ring-1 ring-red-200', label: 'No Provider', icon: '🚫' };
  if (s === 'searching') return { color: 'text-amber-700', bg: 'bg-amber-50 ring-1 ring-amber-200', label: 'Searching', icon: '🔍' };
  if (s === 'pending') return { color: 'text-orange-700', bg: 'bg-orange-50 ring-1 ring-orange-200', label: 'Pending', icon: '⏳' };
  if (s === 'accepted' || s === 'confirmed') return { color: 'text-blue-700', bg: 'bg-blue-50 ring-1 ring-blue-200', label: 'Accepted', icon: '✅' };
  if (s === 'in_progress' || s === 'active' || s === 'ongoing') return { color: 'text-indigo-700', bg: 'bg-indigo-50 ring-1 ring-indigo-200', label: 'In Progress', icon: '🔧' };
  if (s === 'completed') return { color: 'text-emerald-700', bg: 'bg-emerald-50 ring-1 ring-emerald-200', label: 'Completed', icon: '✓' };
  if (s === 'cancelled' || s === 'rejected') return { color: 'text-gray-600', bg: 'bg-gray-50 ring-1 ring-gray-200', label: 'Cancelled', icon: '✗' };
  return { color: 'text-gray-600', bg: 'bg-gray-50 ring-1 ring-gray-200', label: status || 'Unknown', icon: '•' };
}

function getRealTimeBadge(status: string, minutesAgo: number | null): { color: string; label: string; dot: string; glow: string } {
  if (status === 'online') {
    return { color: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300', label: 'LIVE NOW', dot: 'bg-emerald-500', glow: 'shadow-[0_0_8px_rgba(16,185,129,0.6)]' };
  }
  if (status === 'online_unverified') {
    return { color: 'bg-green-50 text-green-700 ring-1 ring-green-200', label: 'Online', dot: 'bg-green-400', glow: '' };
  }
  if (status === 'recently_active') {
    const m = minutesAgo != null ? `${minutesAgo}m` : '';
    return { color: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', label: `Recent ${m}`, dot: 'bg-amber-500', glow: '' };
  }
  if (status === 'idle') {
    const m = minutesAgo != null ? `${minutesAgo}m` : '';
    return { color: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200', label: `Idle ${m}`, dot: 'bg-orange-400', glow: '' };
  }
  const m = minutesAgo != null ? `${minutesAgo}m` : '?';
  return { color: 'bg-red-50 text-red-600 ring-1 ring-red-200', label: `Offline ${m}`, dot: 'bg-red-400', glow: '' };
}

function getTokenBadge(health: string, ageDays: number | null): { color: string; label: string; icon: string } {
  if (health === 'fresh') return { color: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', label: `Fresh${ageDays != null ? ` ${ageDays}d` : ''}`, icon: '🔔' };
  if (health === 'stale') return { color: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', label: `Stale ${ageDays}d`, icon: '⚠️' };
  if (health === 'invalid') return { color: 'bg-red-50 text-red-700 ring-1 ring-red-200', label: 'Invalid', icon: '🚫' };
  if (health === 'missing') return { color: 'bg-red-50 text-red-700 ring-1 ring-red-200', label: 'No FCM', icon: '🔕' };
  return { color: 'bg-gray-50 text-gray-600 ring-1 ring-gray-200', label: 'Unknown', icon: '🔔' };
}

// Animated pulse dot component
function PulseDot({ color, glow, size = 'w-2.5 h-2.5' }: { color: string; glow?: string; size?: string }) {
  return (
    <span className="relative flex">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 ${color}`}></span>
      <span className={`relative inline-flex rounded-full ${size} ${color} ${glow || ''}`}></span>
    </span>
  );
}

// Circular countdown ring
function CountdownRing({ seconds, total = 30 }: { seconds: number; total?: number }) {
  const pct = Math.max(0, (seconds / total) * 100);
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width="48" height="48" className="transform -rotate-90">
      <circle cx="24" cy="24" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
      <circle
        cx="24" cy="24" r={r} fill="none"
        stroke={seconds > 10 ? '#3b82f6' : seconds > 5 ? '#f59e0b' : '#ef4444'}
        strokeWidth="3" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        className="transition-all duration-1000 ease-linear"
      />
      <text
        x="24" y="24"
        textAnchor="middle" dominantBaseline="central"
        className="fill-gray-700 text-[11px] font-bold"
        transform="rotate(90 24 24)"
      >
        {seconds}s
      </text>
    </svg>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function ManualDispatch() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [providerStats, setProviderStats] = useState<any>({});
  const [bookingStats, setBookingStats] = useState<any>({});

  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [forceOffline, setForceOffline] = useState(false);

  const [providerSearch, setProviderSearch] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [includeAll, setIncludeAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState('no_provider_found');

  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [dispatchResult, setDispatchResult] = useState<DispatchResult | null>(null);
  const [offerStatus, setOfferStatus] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);

  const pollTimerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);
  const autoRefreshTimerRef = useRef<any>(null);

  // ── Fetch providers ──
  const fetchProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const params: any = {};
      if (includeAll) params.all = 'true';
      if (providerSearch) params.search = providerSearch;
      if (categoryFilter) params.category = categoryFilter;

      const res: any = await manualDispatchApi.getOnlineProviders(params);
      console.log('[ManualDispatch] 📦 Raw providers response:', res);

      const list = deepUnwrap(res, 'providers');
      const stats = deepUnwrapStats(res);
      console.log('[ManualDispatch] ✅ Unwrapped providers count:', list.length);
      if (list[0]) console.log('[ManualDispatch] 🔍 Sample provider:', list[0]);

      setProviders(list);
      setProviderStats(stats);

      const cats: string[] = [];
      const candidates = [res?.data, res?.data?.data, res];
      for (const c of candidates) {
        if (c && Array.isArray(c.allCategories)) {
          cats.push(...c.allCategories);
          break;
        }
      }
      if (cats.length > 0) setAllCategories(cats);
    } catch (err: any) {
      console.error('❌ Failed to fetch providers:', err);
      alert('Failed to fetch providers: ' + (err.message || err));
    } finally {
      setLoadingProviders(false);
    }
  }, [providerSearch, categoryFilter, includeAll]);

  // ── Fetch bookings ──
  const fetchBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const params: any = {};
      if (bookingSearch) params.search = bookingSearch;
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;

      const res: any = await manualDispatchApi.getDispatchableBookings(params);
      console.log('[ManualDispatch] 📦 Raw bookings response:', res);

      const list = deepUnwrap(res, 'bookings');
      const stats = deepUnwrapStats(res);
      console.log('[ManualDispatch] ✅ Unwrapped bookings count:', list.length);
      if (list[0]) console.log('[ManualDispatch] 🔍 Sample booking:', list[0]);

      setBookings(list);
      setBookingStats(stats);
    } catch (err: any) {
      console.error('❌ Failed to fetch bookings:', err);
      alert('Failed to fetch bookings: ' + (err.message || err));
    } finally {
      setLoadingBookings(false);
    }
  }, [bookingSearch, statusFilter]);

  // ── Initial load + auto-refresh ──
  useEffect(() => {
    fetchProviders();
    fetchBookings();

    autoRefreshTimerRef.current = setInterval(() => {
      console.log('[ManualDispatch] 🔄 Auto-refresh providers (real-time status)');
      fetchProviders();
    }, 30000);

    return () => {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-fetch on filter changes ──
  useEffect(() => {
    const t = setTimeout(() => fetchProviders(), 500);
    return () => clearTimeout(t);
  }, [providerSearch, categoryFilter, includeAll, fetchProviders]);

  useEffect(() => {
    const t = setTimeout(() => fetchBookings(), 500);
    return () => clearTimeout(t);
  }, [bookingSearch, statusFilter, fetchBookings]);

  // ── Dispatch ──
  const handleDispatch = async () => {
    if (!selectedProvider || !selectedBooking) {
      alert('Please select both a provider and a booking');
      return;
    }

    const isOffline = !selectedProvider.isOnline;
    if (isOffline && !forceOffline) {
      const confirm = window.confirm(
        `⚠️ Provider "${selectedProvider.name}" is OFFLINE (${selectedProvider.realTimeStatus}).\n\n` +
        `Last active: ${selectedProvider.lastActiveAgo || 'unknown'}\n\n` +
        `Notification may not show immediately. Continue anyway?`
      );
      if (!confirm) return;
      setForceOffline(true);
    }

    if (selectedProvider.tokenHealth === 'invalid' || selectedProvider.tokenHealth === 'missing') {
      alert(`❌ Cannot dispatch — provider's FCM token is ${selectedProvider.tokenHealth}. Ask them to logout and login in the app.`);
      return;
    }

    setDispatching(true);
    setDispatchResult(null);
    setOfferStatus('sending');
    setCountdown(30);

    try {
      const res: any = await manualDispatchApi.send({
        bookingId: selectedBooking._id,
        providerId: selectedProvider._id,
        adminNote: adminNote.trim(),
        forceEvenIfOffline: isOffline || forceOffline,
      });

      console.log('[ManualDispatch] 📤 Dispatch response:', res);

      const data = res?.data?.data || res?.data || res;
      const success = res?.data?.success ?? res?.success;

      const result: DispatchResult = {
        offerId: data?.offerId || '',
        providerName: data?.providerName || selectedProvider.name,
        fcmSent: data?.fcmSent || false,
        fcmError: data?.fcmError || null,
        fcmErrorCode: data?.fcmErrorCode || null,
        tokenHealth: data?.tokenHealth || 'unknown',
        providerRealTimeStatus: data?.providerRealTimeStatus || '',
        providerMinutesSinceActive: data?.providerMinutesSinceActive ?? null,
        diagnosticTips: data?.diagnosticTips || [],
        message: data?.message || (success ? 'Sent successfully' : 'Failed'),
      };

      setDispatchResult(result);
      setOfferStatus(result.fcmSent ? 'pending' : 'fcm_failed');

      if (result.fcmSent && result.offerId) {
        startPolling(result.offerId);
        startCountdown();
      }

      setTimeout(() => fetchProviders(), 2000);
    } catch (err: any) {
      console.error('❌ Dispatch failed:', err);
      const errMsg = err?.response?.data?.error || err?.message || String(err);
      const requiresForce = err?.response?.data?.requiresForce;

      if (requiresForce) {
        const confirm = window.confirm(`${errMsg}\n\nForce dispatch anyway?`);
        if (confirm) {
          setForceOffline(true);
          setDispatching(false);
          setTimeout(() => handleDispatch(), 100);
          return;
        }
      }

      alert('❌ Dispatch failed: ' + errMsg);
      setOfferStatus('error');
    } finally {
      setDispatching(false);
    }
  };

  const startCountdown = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    let c = 30;
    setCountdown(c);
    countdownTimerRef.current = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(countdownTimerRef.current);
      }
    }, 1000);
  };

  const startPolling = (offerId: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      try {
        const res: any = await manualDispatchApi.getOfferStatus(offerId);
        const data = res?.data?.data || res?.data || res;
        const status = data?.status || data?.offer?.status || 'pending';
        setOfferStatus(status);
        if (['accepted', 'rejected', 'expired', 'cancelled', 'not_found'].includes(status)) {
          clearInterval(pollTimerRef.current);
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        }
      } catch (e) {
        // silent
      }
    }, 2000);
  };

  const handleTestFCM = async (provider: Provider) => {
    try {
      const res: any = await manualDispatchApi.testFCM(provider._id);
      const data = res?.data?.data || res?.data || res;
      const success = res?.data?.success ?? res?.success;
      const tips = (data?.tips || []).join('\n');
      alert(`${success ? '✅ Test FCM Sent' : '❌ Test FCM Failed'}\n\n${data?.providerName}\n\nStatus: ${data?.realTimeStatus}\nToken Health: ${data?.tokenHealth}\n\n${tips}`);
      fetchProviders();
    } catch (err: any) {
      alert('❌ Test FCM error: ' + (err?.message || err));
    }
  };

  const getOfferStatusDisplay = () => {
    switch (offerStatus) {
      case 'sending': return { color: 'from-blue-500 to-blue-600', textColor: 'text-white', label: 'Sending FCM...', icon: '📡' };
      case 'pending': return { color: 'from-amber-400 to-amber-500', textColor: 'text-white', label: 'Waiting for response', icon: '⏳' };
      case 'accepted': return { color: 'from-emerald-500 to-emerald-600', textColor: 'text-white', label: 'ACCEPTED!', icon: '🎉' };
      case 'rejected': return { color: 'from-red-500 to-red-600', textColor: 'text-white', label: 'REJECTED', icon: '✗' };
      case 'expired': return { color: 'from-gray-400 to-gray-500', textColor: 'text-white', label: 'EXPIRED (30s)', icon: '⏱️' };
      case 'cancelled': return { color: 'from-gray-400 to-gray-500', textColor: 'text-white', label: 'Cancelled', icon: '🚫' };
      case 'fcm_failed': return { color: 'from-red-500 to-red-600', textColor: 'text-white', label: 'FCM Failed', icon: '❌' };
      case 'error': return { color: 'from-red-500 to-red-600', textColor: 'text-white', label: 'Error', icon: '❌' };
      default: return { color: 'from-gray-400 to-gray-500', textColor: 'text-white', label: offerStatus || '—', icon: '•' };
    }
  };

  const canDispatch = selectedProvider && selectedBooking && !dispatching;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="p-4 md:p-6 max-w-[1900px] mx-auto space-y-5">

        {/* ───────── HEADER ───────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 md:p-8 text-white shadow-xl">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjEuNSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-50"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
                  <span className="bg-white/20 backdrop-blur-sm rounded-xl p-2.5">🚀</span>
                  Manual Dispatch
                </h1>
                <p className="mt-2 text-blue-100 text-sm md:text-base">
                  Real-time provider detection • FCM health diagnostics • Instant dispatch with Accept/Reject
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium">
                  <PulseDot color="bg-emerald-400" glow="shadow-[0_0_6px_rgba(52,211,153,0.8)]" size="w-2 h-2" />
                  Auto-refresh 30s
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ───────── STATS GRID ───────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Providers', value: providerStats.total || 0, gradient: 'from-blue-500 to-blue-600', icon: '👥' },
            { label: 'Live Now', value: providerStats.online || 0, gradient: 'from-emerald-500 to-emerald-600', icon: '🟢' },
            { label: 'Recently Active', value: providerStats.recentlyActive || 0, gradient: 'from-amber-500 to-amber-600', icon: '🟡' },
            { label: 'Fresh FCM', value: providerStats.withFreshToken || 0, gradient: 'from-violet-500 to-violet-600', icon: '🔔' },
            { label: 'No Provider', value: bookingStats.noProvider || 0, gradient: 'from-red-500 to-red-600', icon: '🚫' },
            { label: 'Total Bookings', value: bookingStats.total || 0, gradient: 'from-indigo-500 to-indigo-600', icon: '📋' },
          ].map((stat) => (
            <div key={stat.label} className="group relative bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient}`}></div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.label}</span>
                  <span className="text-lg">{stat.icon}</span>
                </div>
                <div className="text-2xl md:text-3xl font-extrabold text-gray-800">{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ───────── DISPATCH COMMAND CENTER ───────── */}
        <div className={`rounded-2xl shadow-lg overflow-hidden transition-all duration-500 ${
          canDispatch
            ? 'bg-white ring-2 ring-blue-200'
            : 'bg-white ring-1 ring-gray-100'
        }`}>
          <div className={`px-5 py-3 flex items-center gap-2 ${
            canDispatch
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
              : 'bg-gray-50 text-gray-700 border-b'
          }`}>
            <span className="text-lg">⚡</span>
            <span className="font-bold text-sm tracking-wide uppercase">Dispatch Command Center</span>
            {canDispatch && (
              <span className="ml-auto flex items-center gap-1.5 bg-white/20 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                <PulseDot color="bg-white" size="w-1.5 h-1.5" />
                Ready
              </span>
            )}
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Selected Booking */}
              <div className={`rounded-xl p-4 transition-all duration-300 ${
                selectedBooking
                  ? 'bg-blue-50 ring-2 ring-blue-200'
                  : 'bg-gray-50 ring-1 ring-dashed ring-gray-300'
              }`}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Selected Booking</div>
                {selectedBooking ? (
                  <div className="space-y-1.5">
                    <div className="font-bold text-gray-900 text-base leading-tight">{selectedBooking.serviceName}</div>
                    <div className="text-sm text-gray-600 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">👤</span>
                      {selectedBooking.customerName}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-gray-400">{selectedBooking.bookingId}</span>
                      <span className="text-sm font-extrabold text-emerald-600">₹{formatAmount(selectedBooking.totalAmount)}</span>
                    </div>
                    {selectedBooking.scheduledDate && (
                      <div className="text-xs text-gray-500">
                        📅 {String(selectedBooking.scheduledDate).slice(0, 10)}
                        {selectedBooking.scheduledTime && ` • 🕐 ${selectedBooking.scheduledTime}`}
                      </div>
                    )}
                    <button
                      onClick={() => setSelectedBooking(null)}
                      className="text-[10px] text-red-500 hover:text-red-700 mt-1"
                    >
                      ✕ Clear
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 italic flex flex-col items-center py-4">
                    <span className="text-3xl mb-2 opacity-30">📋</span>
                    Click a booking below
                  </div>
                )}
              </div>

              {/* Selected Provider */}
              <div className={`rounded-xl p-4 transition-all duration-300 ${
                selectedProvider
                  ? 'bg-emerald-50 ring-2 ring-emerald-200'
                  : 'bg-gray-50 ring-1 ring-dashed ring-gray-300'
              }`}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Selected Provider</div>
                {selectedProvider ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        {selectedProvider.profileImage ? (
                          <img src={selectedProvider.profileImage} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white">
                            {selectedProvider.name.charAt(0)}
                          </div>
                        )}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${getRealTimeBadge(selectedProvider.realTimeStatus, selectedProvider.minutesSinceActive).dot}`}></div>
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-sm leading-tight">{selectedProvider.name}</div>
                        <div className="text-xs text-gray-500">{selectedProvider.category} • ⭐ {selectedProvider.rating}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${getRealTimeBadge(selectedProvider.realTimeStatus, selectedProvider.minutesSinceActive).color}`}>
                        <PulseDot color={getRealTimeBadge(selectedProvider.realTimeStatus, selectedProvider.minutesSinceActive).dot} size="w-1.5 h-1.5" />
                        {getRealTimeBadge(selectedProvider.realTimeStatus, selectedProvider.minutesSinceActive).label}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${getTokenBadge(selectedProvider.tokenHealth, selectedProvider.tokenAgeDays).color}`}>
                        {getTokenBadge(selectedProvider.tokenHealth, selectedProvider.tokenAgeDays).icon} {getTokenBadge(selectedProvider.tokenHealth, selectedProvider.tokenAgeDays).label}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedProvider(null)}
                      className="text-[10px] text-red-500 hover:text-red-700 mt-1"
                    >
                      ✕ Clear
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 italic flex flex-col items-center py-4">
                    <span className="text-3xl mb-2 opacity-30">👤</span>
                    Click a provider below
                  </div>
                )}
              </div>

              {/* Dispatch Controls */}
              <div className="flex flex-col justify-between">
                <div>
                  <input
                    type="text"
                    placeholder="Admin note (optional)..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition-all placeholder-gray-400"
                  />
                  {selectedProvider && !selectedProvider.isOnline && (
                    <label className="flex items-center gap-2 mt-2.5 text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-orange-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={forceOffline}
                        onChange={(e) => setForceOffline(e.target.checked)}
                        className="accent-orange-600 w-3.5 h-3.5"
                      />
                      <span>⚠️ Force dispatch to offline provider</span>
                    </label>
                  )}
                </div>
                <button
                  onClick={handleDispatch}
                  disabled={!canDispatch}
                  className={`mt-3 w-full relative overflow-hidden font-bold py-3.5 px-6 rounded-xl text-sm uppercase tracking-wider transition-all duration-300 ${
                    canDispatch
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {dispatching ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                      Dispatching...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      🚀 Dispatch Now
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* ── Dispatch Result ── */}
            {dispatchResult && (
              <div className="mt-5 rounded-xl overflow-hidden ring-1 ring-gray-200 shadow-sm">
                <div className={`bg-gradient-to-r ${getOfferStatusDisplay().color} ${getOfferStatusDisplay().textColor} px-5 py-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getOfferStatusDisplay().icon}</span>
                    <div>
                      <div className="font-bold text-sm">{getOfferStatusDisplay().label}</div>
                      <div className="text-xs opacity-80">{dispatchResult.message}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {offerStatus === 'pending' && countdown > 0 && (
                      <CountdownRing seconds={countdown} />
                    )}
                  </div>
                </div>

                {(dispatchResult.diagnosticTips.length > 0 || dispatchResult.fcmError) && (
                  <div className="bg-white p-4 space-y-3">
                    {dispatchResult.diagnosticTips.length > 0 && (
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">📋 Diagnostics</div>
                        <ul className="space-y-1">
                          {dispatchResult.diagnosticTips.map((tip, i) => (
                            <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                              <span className="text-blue-400 mt-0.5">›</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {dispatchResult.fcmError && (
                      <div className="bg-red-50 rounded-lg p-3 ring-1 ring-red-100">
                        <div className="text-xs text-red-700">
                          <span className="font-bold">Error Code:</span> {dispatchResult.fcmErrorCode}
                        </div>
                        <div className="text-xs text-red-600 mt-1">{dispatchResult.fcmError}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ───────── TWO COLUMNS: BOOKINGS + PROVIDERS ───────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* ═══ BOOKINGS COLUMN ═══ */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-extrabold text-lg text-gray-800 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-sm">📋</span>
                  Bookings
                  <span className="ml-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full px-2.5 py-0.5">{bookings.length}</span>
                </h2>
                <button
                  onClick={fetchBookings}
                  disabled={loadingBookings}
                  className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
                  title="Refresh bookings"
                >
                  <svg className={`w-4 h-4 ${loadingBookings ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search bookings..."
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-300 outline-none transition-all"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none transition-all min-w-[150px]"
                >
                  <option value="no_provider_found">🚫 No Provider</option>
                  <option value="all">📂 All Statuses</option>
                  <option value="searching">🔍 Searching</option>
                  <option value="pending">⏳ Pending</option>
                  <option value="accepted">✅ Accepted</option>
                  <option value="completed">✓ Completed</option>
                  <option value="cancelled">✗ Cancelled</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[680px] divide-y divide-gray-50">
              {loadingBookings ? (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center gap-2 text-gray-400">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                    </svg>
                    Loading bookings...
                  </div>
                </div>
              ) : bookings.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3 opacity-20">📋</div>
                  <div className="text-gray-400 font-medium">No bookings found</div>
                  <div className="text-xs text-gray-300 mt-1">Try changing filters</div>
                </div>
              ) : (
                bookings.map((b) => {
                  const sb = getStatusBadge(b.status);
                  const isSelected = selectedBooking?._id === b._id;
                  return (
                    <div
                      key={b._id}
                      onClick={() => setSelectedBooking(b)}
                      className={`group p-4 cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'bg-blue-50/80 border-l-[3px] border-blue-500 pl-[13px]'
                          : 'hover:bg-gray-50/80 border-l-[3px] border-transparent pl-[13px]'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${sb.bg} ${sb.color}`}>
                              {sb.icon} {sb.label}
                            </span>
                            <span className="text-[10px] text-gray-400">{b.timeAgo}</span>
                          </div>
                          <div className="font-bold text-sm text-gray-800 leading-tight">{b.serviceName || 'Service'}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center text-[8px]">👤</span>
                            {b.customerName}
                            {b.customerPhone && (
                              <span className="text-gray-300">•</span>
                            )}
                            {b.customerPhone && (
                              <span className="text-gray-400">📞 {b.customerPhone}</span>
                            )}
                          </div>
                          {b.address && (
                            <div className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                              <span>📍</span> {b.address}
                            </div>
                          )}
                          {(b.scheduledDate || b.scheduledTime) && (
                            <div className="text-[11px] text-gray-400 flex items-center gap-2">
                              {b.scheduledDate && <span>📅 {String(b.scheduledDate).slice(0, 10)}</span>}
                              {b.scheduledTime && <span>🕐 {b.scheduledTime}</span>}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <div className="text-base font-extrabold text-emerald-600">₹{formatAmount(b.totalAmount)}</div>
                          {b.paymentMethod && (
                            <span className="text-[10px] text-gray-400 bg-gray-50 rounded px-1.5 py-0.5">{b.paymentMethod}</span>
                          )}
                          {isSelected && (
                            <span className="mt-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ═══ PROVIDERS COLUMN ═══ */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-extrabold text-lg text-gray-800 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-sm">👥</span>
                  Providers
                  <span className="ml-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full px-2.5 py-0.5">{providers.length}</span>
                </h2>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-50 rounded-full px-2 py-1">
                    <PulseDot color="bg-blue-400" size="w-1.5 h-1.5" />
                    Live
                  </span>
                  <button
                    onClick={fetchProviders}
                    disabled={loadingProviders}
                    className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    title="Refresh providers"
                  >
                    <svg className={`w-4 h-4 ${loadingProviders ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 mb-2">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search providers..."
                    value={providerSearch}
                    onChange={(e) => setProviderSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 outline-none transition-all"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-200 outline-none transition-all min-w-[140px]"
                >
                  <option value="">All Categories</option>
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={includeAll}
                  onChange={(e) => setIncludeAll(e.target.checked)}
                  className="accent-emerald-600 w-3.5 h-3.5"
                />
                Include offline providers
              </label>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[680px] divide-y divide-gray-50">
              {loadingProviders ? (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center gap-2 text-gray-400">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                    </svg>
                    Loading providers...
                  </div>
                </div>
              ) : providers.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3 opacity-20">👥</div>
                  <div className="text-gray-400 font-medium">No providers found</div>
                  <div className="text-xs text-gray-300 mt-1">Try enabling "Include offline"</div>
                </div>
              ) : (
                providers.map((p) => {
                  const rtb = getRealTimeBadge(p.realTimeStatus, p.minutesSinceActive);
                  const tb = getTokenBadge(p.tokenHealth, p.tokenAgeDays);
                  const isSelected = selectedProvider?._id === p._id;
                  return (
                    <div
                      key={p._id}
                      onClick={() => setSelectedProvider(p)}
                      className={`group p-4 cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'bg-emerald-50/80 border-l-[3px] border-emerald-500 pl-[13px]'
                          : 'hover:bg-gray-50/80 border-l-[3px] border-transparent pl-[13px]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          {p.profileImage ? (
                            <img src={p.profileImage} alt="" className="w-11 h-11 rounded-xl object-cover ring-2 ring-white shadow-sm" />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white shadow-sm">
                              {p.name.charAt(0)}
                            </div>
                          )}
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${rtb.dot} ${rtb.glow}`}></div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-gray-800">{p.name}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${rtb.color}`}>
                              {p.realTimeStatus === 'online' && <PulseDot color={rtb.dot} size="w-1.5 h-1.5" />}
                              {rtb.label}
                            </span>
                          </div>

                          <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                            {p.category && <span>🏷️ {p.category}</span>}
                            {p.city && <span>📍 {p.city}</span>}
                          </div>

                          <div className="text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">
                            <span>📞 {p.phone || 'N/A'}</span>
                            <span>⭐ {p.rating}</span>
                            <span>{p.totalJobs} jobs</span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${tb.color}`}>
                              {tb.icon} {tb.label}
                            </span>
                            {p.isVerified && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 ring-1 ring-blue-200">
                                ✓ Verified
                              </span>
                            )}
                            {p.hasFCM && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleTestFCM(p); }}
                                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-600 ring-1 ring-violet-200 hover:bg-violet-100 transition-colors"
                                title="Send test FCM notification"
                              >
                                🧪 Test
                              </button>
                            )}
                          </div>

                          {p.tokenWarning && (
                            <div className="text-[10px] text-amber-600 bg-amber-50 rounded-md px-2 py-1 mt-0.5">
                              ⚠️ {p.tokenWarning}
                            </div>
                          )}
                        </div>

                        {/* Selection indicator */}
                        <div className="flex-shrink-0 flex flex-col items-center gap-1">
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}