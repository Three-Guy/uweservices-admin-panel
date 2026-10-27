// frontend2/src/pages/ManualDispatch.tsx
// Manual Dispatch — Real-time online detection + token health + force offline option

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

function getStatusBadge(status: string): { color: string; label: string; emoji: string } {
  const s = (status || '').toLowerCase();
  if (s === 'no_provider_found') return { color: 'bg-red-100 text-red-800 border-red-300', label: 'No Provider', emoji: '❌' };
  if (s === 'searching') return { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'Searching', emoji: '🔍' };
  if (s === 'pending') return { color: 'bg-orange-100 text-orange-800 border-orange-300', label: 'Pending', emoji: '⏳' };
  if (s === 'accepted' || s === 'confirmed') return { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Accepted', emoji: '✅' };
  if (s === 'in_progress' || s === 'active' || s === 'ongoing') return { color: 'bg-indigo-100 text-indigo-800 border-indigo-300', label: 'In Progress', emoji: '🔧' };
  if (s === 'completed') return { color: 'bg-green-100 text-green-800 border-green-300', label: 'Completed', emoji: '✓' };
  if (s === 'cancelled' || s === 'rejected') return { color: 'bg-gray-100 text-gray-800 border-gray-300', label: 'Cancelled', emoji: '✗' };
  return { color: 'bg-gray-100 text-gray-800 border-gray-300', label: status || 'Unknown', emoji: '•' };
}

// REAL-TIME STATUS BADGE
function getRealTimeBadge(status: string, minutesAgo: number | null): { color: string; label: string; dot: string } {
  if (status === 'online') {
    return { color: 'bg-green-100 text-green-800 border-green-400', label: '🟢 LIVE NOW', dot: 'bg-green-500 animate-pulse' };
  }
  if (status === 'online_unverified') {
    return { color: 'bg-green-50 text-green-700 border-green-300', label: '🟢 Online (unverified)', dot: 'bg-green-400' };
  }
  if (status === 'recently_active') {
    const m = minutesAgo != null ? `${minutesAgo}m` : '';
    return { color: 'bg-yellow-100 text-yellow-800 border-yellow-400', label: `🟡 Recent ${m}`, dot: 'bg-yellow-500' };
  }
  if (status === 'idle') {
    const m = minutesAgo != null ? `${minutesAgo}m` : '';
    return { color: 'bg-orange-100 text-orange-800 border-orange-400', label: `⚪ Idle ${m}`, dot: 'bg-orange-400' };
  }
  const m = minutesAgo != null ? `${minutesAgo}m ago` : 'unknown';
  return { color: 'bg-red-100 text-red-700 border-red-300', label: `🔴 Offline (${m})`, dot: 'bg-red-500' };
}

// TOKEN HEALTH BADGE
function getTokenBadge(health: string, ageDays: number | null): { color: string; label: string } {
  if (health === 'fresh') return { color: 'bg-green-100 text-green-700 border-green-300', label: `🔔 FCM Fresh${ageDays != null ? ` (${ageDays}d)` : ''}` };
  if (health === 'stale') return { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', label: `⚠️ FCM Stale (${ageDays}d)` };
  if (health === 'invalid') return { color: 'bg-red-100 text-red-700 border-red-300', label: '🚫 FCM Invalid' };
  if (health === 'missing') return { color: 'bg-red-100 text-red-700 border-red-300', label: '🔕 No FCM' };
  return { color: 'bg-gray-100 text-gray-700 border-gray-300', label: '🔔 FCM' };
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

  // Fetch providers
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

      // Extract categories
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

  // Fetch bookings
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

  // Initial load + auto-refresh providers every 30 sec for real-time status
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

  // Re-fetch when filters change
  useEffect(() => {
    const t = setTimeout(() => fetchProviders(), 500);
    return () => clearTimeout(t);
  }, [providerSearch, categoryFilter, includeAll, fetchProviders]);

  useEffect(() => {
    const t = setTimeout(() => fetchBookings(), 500);
    return () => clearTimeout(t);
  }, [bookingSearch, statusFilter, fetchBookings]);

  // Dispatch
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

      // Refresh providers to show new activity
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
      case 'sending': return { color: 'bg-blue-100 text-blue-800', label: '⏳ Sending FCM...' };
      case 'pending': return { color: 'bg-yellow-100 text-yellow-800', label: `⏳ Waiting for provider... (${countdown}s)` };
      case 'accepted': return { color: 'bg-green-100 text-green-800', label: '✅ ACCEPTED by provider!' };
      case 'rejected': return { color: 'bg-red-100 text-red-800', label: '❌ REJECTED by provider' };
      case 'expired': return { color: 'bg-gray-100 text-gray-800', label: '⏱️ EXPIRED (30s timeout)' };
      case 'cancelled': return { color: 'bg-gray-100 text-gray-800', label: '🚫 Cancelled' };
      case 'fcm_failed': return { color: 'bg-red-100 text-red-800', label: '❌ FCM delivery failed' };
      case 'error': return { color: 'bg-red-100 text-red-800', label: '❌ Error' };
      default: return { color: 'bg-gray-100 text-gray-800', label: offerStatus };
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🚀 Manual Dispatch</h1>
        <p className="text-gray-600">Real-time provider status + FCM dispatch with Accept/Reject popup</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <div className="text-xs text-gray-500">Total Providers</div>
          <div className="text-2xl font-bold text-blue-600">{providerStats.total || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <div className="text-xs text-gray-500">🟢 Live Now</div>
          <div className="text-2xl font-bold text-green-600">{providerStats.online || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
          <div className="text-xs text-gray-500">🟡 Recent</div>
          <div className="text-2xl font-bold text-yellow-600">{providerStats.recentlyActive || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
          <div className="text-xs text-gray-500">🔔 Fresh FCM</div>
          <div className="text-2xl font-bold text-purple-600">{providerStats.withFreshToken || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
          <div className="text-xs text-gray-500">❌ No Provider</div>
          <div className="text-2xl font-bold text-red-600">{bookingStats.noProvider || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-indigo-500">
          <div className="text-xs text-gray-500">Total Bookings</div>
          <div className="text-2xl font-bold text-indigo-600">{bookingStats.total || 0}</div>
        </div>
      </div>

      {/* Selected pair + Dispatch button */}
      {(selectedProvider || selectedBooking) && (
        <div className="bg-white p-4 rounded-lg shadow-lg mb-6 border-2 border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-xs text-gray-500 mb-1">Selected Booking</div>
              {selectedBooking ? (
                <div>
                  <div className="font-semibold">{selectedBooking.serviceName}</div>
                  <div className="text-sm text-gray-600">{selectedBooking.customerName} • ₹{formatAmount(selectedBooking.totalAmount)}</div>
                  <div className="text-xs text-gray-500">{selectedBooking.bookingId}</div>
                </div>
              ) : (
                <div className="text-gray-400">None selected</div>
              )}
            </div>

            <div className="bg-green-50 p-3 rounded">
              <div className="text-xs text-gray-500 mb-1">Selected Provider</div>
              {selectedProvider ? (
                <div>
                  <div className="font-semibold">{selectedProvider.name}</div>
                  <div className="text-sm text-gray-600">{selectedProvider.category} • ⭐ {selectedProvider.rating}</div>
                  <div className="text-xs mt-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full ${getRealTimeBadge(selectedProvider.realTimeStatus, selectedProvider.minutesSinceActive).color}`}>
                      {getRealTimeBadge(selectedProvider.realTimeStatus, selectedProvider.minutesSinceActive).label}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-gray-400">None selected</div>
              )}
            </div>

            <div>
              <input
                type="text"
                placeholder="Admin note (optional)"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="w-full px-3 py-2 border rounded mb-2 text-sm"
              />
              {selectedProvider && !selectedProvider.isOnline && (
                <label className="flex items-center text-xs text-orange-700 mb-2">
                  <input
                    type="checkbox"
                    checked={forceOffline}
                    onChange={(e) => setForceOffline(e.target.checked)}
                    className="mr-2"
                  />
                  ⚠️ Force dispatch to offline provider
                </label>
              )}
              <button
                onClick={handleDispatch}
                disabled={!selectedProvider || !selectedBooking || dispatching}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-4 rounded hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {dispatching ? '⏳ Dispatching...' : '🚀 Dispatch Now'}
              </button>
            </div>
          </div>

          {/* Dispatch Result */}
          {dispatchResult && (
            <div className="mt-4 p-4 rounded border-l-4 border-blue-500 bg-blue-50">
              <div className="flex justify-between items-start mb-2">
                <div className="font-semibold">
                  {dispatchResult.fcmSent ? '✅' : '❌'} Dispatch Result
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getOfferStatusDisplay().color}`}>
                  {getOfferStatusDisplay().label}
                </span>
              </div>
              <div className="text-sm text-gray-700 mb-2">{dispatchResult.message}</div>

              {dispatchResult.diagnosticTips.length > 0 && (
                <div className="mt-3 bg-white p-3 rounded border">
                  <div className="text-xs font-semibold text-gray-600 mb-1">📋 Diagnostic:</div>
                  <ul className="text-xs text-gray-700 space-y-1">
                    {dispatchResult.diagnosticTips.map((tip, i) => (
                      <li key={i}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {dispatchResult.fcmError && (
                <div className="mt-2 text-xs text-red-700 bg-red-50 p-2 rounded">
                  <strong>Error Code:</strong> {dispatchResult.fcmErrorCode}<br />
                  <strong>Message:</strong> {dispatchResult.fcmError}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Two columns: Bookings + Providers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BOOKINGS COLUMN */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-bold text-lg mb-3">📋 Bookings ({bookings.length})</h2>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Search bookings..."
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                className="flex-1 px-3 py-2 border rounded text-sm"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded text-sm"
              >
                <option value="no_provider_found">❌ No Provider (default)</option>
                <option value="all">All Statuses</option>
                <option value="searching">🔍 Searching</option>
                <option value="pending">⏳ Pending</option>
                <option value="accepted">✅ Accepted</option>
                <option value="completed">✓ Completed</option>
                <option value="cancelled">✗ Cancelled</option>
              </select>
              <button
                onClick={fetchBookings}
                className="px-3 py-2 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
              >
                🔄
              </button>
            </div>
          </div>

          <div className="max-h-[700px] overflow-y-auto">
            {loadingBookings ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : bookings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No bookings found</div>
            ) : (
              <div className="divide-y">
                {bookings.map((b) => {
                  const sb = getStatusBadge(b.status);
                  const isSelected = selectedBooking?._id === b._id;
                  return (
                    <div
                      key={b._id}
                      onClick={() => setSelectedBooking(b)}
                      className={`p-3 cursor-pointer hover:bg-blue-50 transition ${isSelected ? 'bg-blue-100 border-l-4 border-blue-500' : ''}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${sb.color}`}>
                              {sb.emoji} {sb.label}
                            </span>
                            <span className="text-xs text-gray-500">{b.timeAgo}</span>
                          </div>
                          <div className="font-semibold text-sm">{b.serviceName || 'Service'}</div>
                          <div className="text-xs text-gray-600">
                            👤 {b.customerName} {b.customerPhone && `• 📞 ${b.customerPhone}`}
                          </div>
                          {b.address && (
                            <div className="text-xs text-gray-500 truncate">📍 {b.address}</div>
                          )}
                          <div className="text-xs text-gray-500">
                            {b.scheduledDate && `📅 ${String(b.scheduledDate).slice(0, 10)}`}
                            {b.scheduledTime && ` 🕐 ${b.scheduledTime}`}
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <div className="font-bold text-green-600">₹{formatAmount(b.totalAmount)}</div>
                          {b.paymentMethod && <div className="text-xs text-gray-500">{b.paymentMethod}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* PROVIDERS COLUMN */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg">👥 Providers ({providers.length})</h2>
              <span className="text-xs text-gray-500">🔄 Auto-refresh 30s</span>
            </div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Search providers..."
                value={providerSearch}
                onChange={(e) => setProviderSearch(e.target.value)}
                className="flex-1 px-3 py-2 border rounded text-sm"
              />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border rounded text-sm"
              >
                <option value="">All Categories</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <button
                onClick={fetchProviders}
                className="px-3 py-2 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
              >
                🔄
              </button>
            </div>
            <label className="flex items-center text-xs text-gray-600">
              <input
                type="checkbox"
                checked={includeAll}
                onChange={(e) => setIncludeAll(e.target.checked)}
                className="mr-2"
              />
              Include offline providers
            </label>
          </div>

          <div className="max-h-[700px] overflow-y-auto">
            {loadingProviders ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : providers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No providers found</div>
            ) : (
              <div className="divide-y">
                {providers.map((p) => {
                  const rtb = getRealTimeBadge(p.realTimeStatus, p.minutesSinceActive);
                  const tb = getTokenBadge(p.tokenHealth, p.tokenAgeDays);
                  const isSelected = selectedProvider?._id === p._id;
                  return (
                    <div
                      key={p._id}
                      onClick={() => setSelectedProvider(p)}
                      className={`p-3 cursor-pointer hover:bg-green-50 transition ${isSelected ? 'bg-green-100 border-l-4 border-green-500' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          {p.profileImage ? (
                            <img src={p.profileImage} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold">
                              {p.name.charAt(0)}
                            </div>
                          )}
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${rtb.dot}`}></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-sm">{p.name}</span>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold border ${rtb.color}`}>
                              {rtb.label}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            {p.category && `🏷️ ${p.category}`} {p.city && `• 📍 ${p.city}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            📞 {p.phone || 'No phone'} • ⭐ {p.rating} • {p.totalJobs} jobs
                          </div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-xs border ${tb.color}`}>
                              {tb.label}
                            </span>
                            {p.isVerified && <span className="text-xs text-blue-600">✓ Verified</span>}
                            {p.hasFCM && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleTestFCM(p); }}
                                className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200"
                                title="Send test FCM"
                              >
                                🧪 Test
                              </button>
                            )}
                          </div>
                          {p.tokenWarning && (
                            <div className="text-xs text-orange-600 mt-1">⚠️ {p.tokenWarning}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}