// frontend2/src/pages/BookingsManager.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { bookingsApi, Booking, BookingFilters, BookingStats } from '../lib/api';
import OfferTrailPanel from '../components/OfferTrailPanel';
import DispatchActionButtons from '../components/DispatchActionButtons';

/* ─── constants ─── */
const ALL_STATUSES = [
  'pending','confirmed','searching','assigned','accepted',
  'en-route','arrived','in-progress','completed','cancelled',
  'rejected','failed','refunded',
];
const ALL_PAYMENT_STATUSES = [
  'pending','completed','failed','refunded','pay_after_service','paid',
];

/* ─── helpers ─── */
const statusMeta: Record<string, { bg: string; text: string; dot: string; icon: string }> = {
  pending:       { bg: 'bg-amber-50 dark:bg-amber-900/20',       text: 'text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500',   icon: '⏳' },
  confirmed:     { bg: 'bg-blue-50 dark:bg-blue-900/20',         text: 'text-blue-700 dark:text-blue-400',       dot: 'bg-blue-500',    icon: '✓' },
  searching:     { bg: 'bg-violet-50 dark:bg-violet-900/20',     text: 'text-violet-700 dark:text-violet-400',   dot: 'bg-violet-500',  icon: '🔍' },
  assigned:      { bg: 'bg-indigo-50 dark:bg-indigo-900/20',     text: 'text-indigo-700 dark:text-indigo-400',   dot: 'bg-indigo-500',  icon: '👤' },
  accepted:      { bg: 'bg-cyan-50 dark:bg-cyan-900/20',         text: 'text-cyan-700 dark:text-cyan-400',       dot: 'bg-cyan-500',    icon: '👍' },
  'en-route':    { bg: 'bg-orange-50 dark:bg-orange-900/20',     text: 'text-orange-700 dark:text-orange-400',   dot: 'bg-orange-500',  icon: '🚗' },
  arrived:       { bg: 'bg-teal-50 dark:bg-teal-900/20',         text: 'text-teal-700 dark:text-teal-400',       dot: 'bg-teal-500',    icon: '📍' },
  'in-progress': { bg: 'bg-yellow-50 dark:bg-yellow-900/20',     text: 'text-yellow-700 dark:text-yellow-400',   dot: 'bg-yellow-500',  icon: '🔧' },
  completed:     { bg: 'bg-emerald-50 dark:bg-emerald-900/20',   text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', icon: '✅' },
  cancelled:     { bg: 'bg-red-50 dark:bg-red-900/20',           text: 'text-red-700 dark:text-red-400',         dot: 'bg-red-500',     icon: '✕' },
  rejected:      { bg: 'bg-rose-50 dark:bg-rose-900/20',         text: 'text-rose-700 dark:text-rose-400',       dot: 'bg-rose-500',    icon: '🚫' },
  failed:        { bg: 'bg-red-50 dark:bg-red-900/20',           text: 'text-red-700 dark:text-red-400',         dot: 'bg-red-500',     icon: '❌' },
  refunded:      { bg: 'bg-slate-50 dark:bg-slate-900/20',       text: 'text-slate-700 dark:text-slate-400',     dot: 'bg-slate-500',   icon: '↩️' },
};
const getSM = (s: string) => statusMeta[s] || statusMeta.pending;

const fmtDate = (d?: string | null): string => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
           dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return String(d); }
};

const fmtCurrency = (n?: number | null): string => {
  if (n === null || n === undefined) return '₹0.00';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);
};

const fmtShortDate = (d?: string | null): string => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    const now = new Date();
    const diff = now.getTime() - dt.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch { return String(d); }
};

/* ══════════════════════════════ MAIN COMPONENT ══════════════════════════════ */
const BookingsManager: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<BookingFilters>({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [selected, setSelected] = useState<Booking | null>(null);
  const [statusDraft, setStatusDraft] = useState('');
  const [reasonDraft, setReasonDraft] = useState('');
  const [paymentStatusDraft, setPaymentStatusDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'financial' | 'dispatch' | 'raw'>('details');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const modalRef = useRef<HTMLDivElement>(null);

  /* ── fetchers ── */
  const fetchBookings = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await bookingsApi.getAll(filters);
      if (res.success) {
        setBookings(res.data.bookings || []);
        setPagination({ page: res.data.pagination.page, totalPages: res.data.pagination.totalPages, total: res.data.pagination.total });
      }
    } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Failed to fetch bookings'); }
    finally { setLoading(false); }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try { const r = await bookingsApi.getStats(); if (r.success) setStats(r.data); } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  /* ── actions ── */
  const openDetails = async (b: Booking) => {
    try {
      const r = await bookingsApi.getById(b._id);
      if (r.success) { setSelected(r.data.booking); setStatusDraft(r.data.booking.status); setPaymentStatusDraft(r.data.booking.paymentStatus || ''); }
    } catch { setSelected(b); setStatusDraft(b.status); setPaymentStatusDraft(b.paymentStatus || ''); }
    setReasonDraft(''); setActiveTab('details');
  };

  const handleStatusSave = async () => {
    if (!selected || !statusDraft || statusDraft === selected.status) return;
    setSaving(true);
    try {
      const r = await bookingsApi.updateStatus(selected._id, statusDraft, reasonDraft);
      if (r.success) { setSelected(r.data.booking); setReasonDraft(''); await fetchBookings(); await fetchStats(); }
    } catch (e: any) { alert('Error: ' + (e?.response?.data?.message || e?.message)); }
    finally { setSaving(false); }
  };

  const handlePaymentSave = async () => {
    if (!selected || !paymentStatusDraft || paymentStatusDraft === selected.paymentStatus) return;
    setSaving(true);
    try {
      const r = await bookingsApi.updatePaymentStatus(selected._id, paymentStatusDraft);
      if (r.success) { setSelected(r.data.booking); await fetchBookings(); }
    } catch (e: any) { alert('Error: ' + (e?.response?.data?.message || e?.message)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (b: Booking) => {
    if (!window.confirm(`Are you sure you want to delete booking ${b.bookingId}?`)) return;
    try { await bookingsApi.delete(b._id, false); await fetchBookings(); if (selected?._id === b._id) setSelected(null); }
    catch (e: any) { alert('Error: ' + (e?.response?.data?.message || e?.message)); }
  };

  /* ── dispatch action callback ── */
  const handleDispatchActionDone = async () => {
    // Refresh the selected booking + list after dispatch/reassign/manual-assign
    if (selected) {
      try {
        const r = await bookingsApi.getById(selected._id);
        if (r.success) {
          setSelected(r.data.booking);
          setStatusDraft(r.data.booking.status);
          setPaymentStatusDraft(r.data.booking.paymentStatus || '');
        }
      } catch { /* silent */ }
    }
    await fetchBookings();
    await fetchStats();
  };

  /* ══════════════════════════════ RENDER ══════════════════════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ─── HEADER ─── */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Booking Management</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Monitor and manage all service bookings in real-time</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-0.5 shadow-sm">
                <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'table' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M3 6h18M3 18h18" /></svg>
                  Table
                </button>
                <button onClick={() => setViewMode('cards')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'cards' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  Cards
                </button>
              </div>
              <button onClick={() => { fetchBookings(); fetchStats(); }} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ─── STATS ─── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <StatsCard icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            } label="Total Bookings" value={stats.totalBookings} gradient="from-blue-500 to-blue-600" lightBg="bg-blue-50" lightText="text-blue-600" />
            <StatsCard icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            } label="Today" value={stats.todayBookings} gradient="from-violet-500 to-purple-600" lightBg="bg-violet-50" lightText="text-violet-600" />
            <StatsCard icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            } label="Completed" value={stats.completedBookings} gradient="from-emerald-500 to-green-600" lightBg="bg-emerald-50" lightText="text-emerald-600" />
            <StatsCard icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            } label="In Progress" value={stats.inProgressBookings} gradient="from-amber-500 to-orange-600" lightBg="bg-amber-50" lightText="text-amber-600" />
            <StatsCard icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            } label="Revenue" value={fmtCurrency(stats.totalRevenue)} gradient="from-teal-500 to-cyan-600" lightBg="bg-teal-50" lightText="text-teal-600" isRevenue />
            <StatsCard icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            } label="Avg. Value" value={fmtCurrency(stats.totalBookings ? (stats.totalRevenue || 0) / (stats.completedBookings || 1) : 0)} gradient="from-pink-500 to-rose-600" lightBg="bg-pink-50" lightText="text-pink-600" isRevenue />
          </div>
        )}

        {/* ─── FILTERS BAR ─── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-end gap-3">
            {/* search */}
            <div className="flex-1 min-w-[220px]">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Search</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Booking ID, name, phone, email..." value={filters.search || ''} onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all outline-none bg-gray-50/50" />
              </div>
            </div>
            {/* status */}
            <div className="min-w-[140px]">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Status</label>
              <select value={filters.status || ''} onChange={e => setFilters(f => ({ ...f, status: e.target.value || undefined, page: 1 }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all outline-none bg-gray-50/50 appearance-none cursor-pointer">
                <option value="">All Statuses</option>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{getSM(s).icon} {s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            {/* payment */}
            <div className="min-w-[140px]">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Payment</label>
              <select value={filters.paymentStatus || ''} onChange={e => setFilters(f => ({ ...f, paymentStatus: e.target.value || undefined, page: 1 }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all outline-none bg-gray-50/50 appearance-none cursor-pointer">
                <option value="">All Payments</option>
                {ALL_PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            {/* type */}
            <div className="min-w-[130px]">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Type</label>
              <select value={filters.bookingType || ''} onChange={e => setFilters(f => ({ ...f, bookingType: e.target.value || undefined, page: 1 }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all outline-none bg-gray-50/50 appearance-none cursor-pointer">
                <option value="">All Types</option>
                <option value="instant">⚡ Instant</option>
                <option value="scheduled">📅 Scheduled</option>
              </select>
            </div>
            {/* clear */}
            <button onClick={() => setFilters({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' })}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all">
              Clear
            </button>
          </div>
          {/* active filter chips */}
          {(filters.search || filters.status || filters.paymentStatus || filters.bookingType) && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
              <span className="text-[11px] text-gray-400 font-medium self-center">Active:</span>
              {filters.search && <FilterChip label={`Search: "${filters.search}"`} onClear={() => setFilters(f => ({ ...f, search: undefined, page: 1 }))} />}
              {filters.status && <FilterChip label={`Status: ${filters.status}`} onClear={() => setFilters(f => ({ ...f, status: undefined, page: 1 }))} />}
              {filters.paymentStatus && <FilterChip label={`Payment: ${filters.paymentStatus}`} onClear={() => setFilters(f => ({ ...f, paymentStatus: undefined, page: 1 }))} />}
              {filters.bookingType && <FilterChip label={`Type: ${filters.bookingType}`} onClear={() => setFilters(f => ({ ...f, bookingType: undefined, page: 1 }))} />}
            </div>
          )}
        </div>

        {/* ─── ERROR ─── */}
        {error && (
          <div className="mb-6 flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-100">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error Loading Bookings</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <button onClick={fetchBookings} className="text-xs font-medium text-red-700 hover:text-red-900 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">Retry</button>
          </div>
        )}

        {/* ─── LOADING SKELETON ─── */}
        {loading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-200 rounded-full w-1/4" />
                    <div className="h-3 bg-gray-100 rounded-full w-1/3" />
                  </div>
                  <div className="h-6 w-20 bg-gray-200 rounded-full" />
                  <div className="h-4 w-16 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── TABLE VIEW ─── */}
        {!loading && viewMode === 'table' && (
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Booking</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Customer</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Service</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Provider</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Payment</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Time</th>
                    <th className="px-5 py-4 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bookings.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-16">
                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                          <p className="text-sm font-medium text-gray-500">No bookings found</p>
                          <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {bookings.map(b => {
                    const sm = getSM(b.status);
                    return (
                      <tr key={b._id} className="group hover:bg-indigo-50/30 transition-colors cursor-pointer" onClick={() => openDetails(b)}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl ${sm.bg} flex items-center justify-center text-sm`}>{sm.icon}</div>
                            <div>
                              <p className="text-[13px] font-semibold text-gray-900 font-mono">{b.bookingId}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                                {b.bookingType === 'instant' ? '⚡' : '📅'} {b.bookingType}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[13px] font-medium text-gray-900">{b.customerName || '—'}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{b.customerPhone || '—'}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[13px] text-gray-800">{b.serviceIcon} {b.serviceName}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{b.categoryName || '—'}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[13px] text-gray-800">{b.providerName || <span className="text-gray-300 italic">Unassigned</span>}</p>
                          {b.assignmentMethod && <p className="text-[11px] text-gray-400 mt-0.5">{b.assignmentMethod}</p>}
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[13px] font-semibold text-gray-900">{fmtCurrency(b.totalAmount)}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${sm.bg} ${sm.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                            {b.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                            b.paymentStatus === 'completed' || b.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' :
                            b.paymentStatus === 'failed' ? 'bg-red-50 text-red-700' :
                            b.paymentStatus === 'refunded' ? 'bg-slate-100 text-slate-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>{b.paymentStatus || '—'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[12px] text-gray-500">{fmtShortDate(b.createdAt)}</p>
                        </td>
                        <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openDetails(b)} className="p-2 rounded-lg hover:bg-indigo-100 text-indigo-600 transition-colors" title="View Details">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                            <button onClick={() => handleDelete(b)} className="p-2 rounded-lg hover:bg-red-100 text-red-500 transition-colors" title="Delete">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* pagination */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <p className="text-[12px] text-gray-500">
                Showing <span className="font-semibold text-gray-700">{((pagination.page - 1) * (filters.limit || 20)) + 1}</span> to <span className="font-semibold text-gray-700">{Math.min(pagination.page * (filters.limit || 20), pagination.total)}</span> of <span className="font-semibold text-gray-700">{pagination.total}</span> bookings
              </p>
              <div className="flex items-center gap-1">
                <button disabled={pagination.page <= 1} onClick={() => setFilters(f => ({ ...f, page: 1 }))}
                  className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all" title="First">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                </button>
                <button disabled={pagination.page <= 1} onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  Previous
                </button>
                {/* page numbers */}
                {generatePageNumbers(pagination.page, pagination.totalPages).map((p, i) =>
                  p === '...' ? <span key={`dot-${i}`} className="px-1.5 text-gray-400 text-xs">…</span> : (
                    <button key={p} onClick={() => setFilters(f => ({ ...f, page: p as number }))}
                      className={`w-9 h-9 rounded-lg text-xs font-medium transition-all ${p === pagination.page ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {p}
                    </button>
                  )
                )}
                <button disabled={pagination.page >= pagination.totalPages} onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  Next
                </button>
                <button disabled={pagination.page >= pagination.totalPages} onClick={() => setFilters(f => ({ ...f, page: pagination.totalPages }))}
                  className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all" title="Last">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── CARD VIEW ─── */}
        {!loading && viewMode === 'cards' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              {bookings.length === 0 && (
                <div className="col-span-full text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                    <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="text-sm font-medium text-gray-500">No bookings found</p>
                </div>
              )}
              {bookings.map(b => {
                const sm = getSM(b.status);
                return (
                  <div key={b._id} className="bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group" onClick={() => openDetails(b)}>
                    <div className="p-5">
                      {/* top row */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${sm.bg} flex items-center justify-center text-base`}>{sm.icon}</div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 font-mono">{b.bookingId}</p>
                            <p className="text-[11px] text-gray-400">{fmtShortDate(b.createdAt)}</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${sm.bg} ${sm.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                          {b.status}
                        </span>
                      </div>
                      {/* service */}
                      <div className="mb-3">
                        <p className="text-[13px] font-medium text-gray-800">{b.serviceIcon} {b.serviceName}</p>
                        <p className="text-[11px] text-gray-400">{b.categoryName}</p>
                      </div>
                      {/* customer & provider */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Customer</p>
                          <p className="text-[12px] font-medium text-gray-700 mt-0.5">{b.customerName || '—'}</p>
                          <p className="text-[11px] text-gray-400">{b.customerPhone}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Provider</p>
                          <p className="text-[12px] font-medium text-gray-700 mt-0.5">{b.providerName || <span className="italic text-gray-300">Unassigned</span>}</p>
                        </div>
                      </div>
                      {/* bottom bar */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div>
                          <p className="text-base font-bold text-gray-900">{fmtCurrency(b.totalAmount)}</p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            b.paymentStatus === 'completed' || b.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>{b.paymentStatus}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <button onClick={() => openDetails(b)} className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(b)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* card view pagination */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200/80 shadow-sm px-5 py-4">
              <p className="text-[12px] text-gray-500">
                Page <span className="font-semibold text-gray-700">{pagination.page}</span> of <span className="font-semibold text-gray-700">{pagination.totalPages}</span> • {pagination.total} bookings
              </p>
              <div className="flex gap-2">
                <button disabled={pagination.page <= 1} onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all">Previous</button>
                <button disabled={pagination.page >= pagination.totalPages} onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-sm">Next</button>
              </div>
            </div>
          </>
        )}

        {/* ═════════════════════════ DETAIL MODAL ═════════════════════════ */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
            {/* backdrop */}
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            {/* modal */}
            <div ref={modalRef} onClick={e => e.stopPropagation()}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-modal-in">

              {/* ── modal header ── */}
              <div className="flex-shrink-0 px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-white to-indigo-50/40">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl ${getSM(selected.status).bg} flex items-center justify-center text-xl shadow-sm`}>
                      {getSM(selected.status).icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-gray-900 font-mono">{selected.bookingId}</h2>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${getSM(selected.status).bg} ${getSM(selected.status).text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getSM(selected.status).dot}`} />
                          {selected.status}
                        </span>
                        {selected.bookingType && (
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-medium text-gray-500 uppercase">{selected.bookingType}</span>
                        )}
                      </div>
                      <p className="text-[12px] text-gray-400 mt-1">
                        Created {fmtDate(selected.createdAt)} • {selected.serviceName}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                {/* OTP prominent bar */}
                {selected.otp?.code && (
                  <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-white/70 uppercase tracking-wider">Verification OTP</p>
                      <p className="text-2xl font-black tracking-[0.3em] mt-0.5">{selected.otp.code}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-4 text-[11px]">
                      <div className="text-center">
                        <p className="text-white/60">Status</p>
                        <p className="font-bold mt-0.5">{selected.otp.verified ? '✅ Verified' : '⏳ Pending'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-white/60">Attempts</p>
                        <p className="font-bold mt-0.5">{selected.otp.attempts ?? 0}/{selected.otp.maxAttempts ?? 0}</p>
                      </div>
                      {selected.otp.sentVia && (
                        <div className="text-center">
                          <p className="text-white/60">Sent Via</p>
                          <p className="font-bold mt-0.5 uppercase">{selected.otp.sentVia}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* tabs — added 'dispatch' tab */}
                <div className="flex gap-1 mt-4 bg-gray-100 rounded-xl p-1">
                  {(['details', 'timeline', 'financial', 'dispatch', 'raw'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {{ details: '📋 Details', timeline: '⏱ Timeline', financial: '💰 Financial', dispatch: '🚀 Dispatch', raw: '{ } Raw Data' }[tab]}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── modal body ── */}
              <div className="flex-1 overflow-y-auto p-6">

                {/* ── TAB: DETAILS ── */}
                {activeTab === 'details' && (
                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Status Control */}
                    <DetailCard title="Status Control" icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    } accent="indigo">
                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Booking Status</label>
                          <select value={statusDraft} onChange={e => setStatusDraft(e.target.value)}
                            className="w-full mt-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none bg-white">
                            {ALL_STATUSES.map(s => <option key={s} value={s}>{getSM(s).icon} {s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Reason (optional)</label>
                          <input type="text" value={reasonDraft} onChange={e => setReasonDraft(e.target.value)} placeholder="Enter reason for status change..."
                            className="w-full mt-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none" />
                        </div>
                        <button onClick={handleStatusSave} disabled={saving || statusDraft === selected.status}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-semibold hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-200">
                          {saving ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                              Updating...
                            </span>
                          ) : 'Update Status'}
                        </button>
                        <div className="pt-3 border-t border-gray-100">
                          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Payment Status</label>
                          <div className="flex gap-2 mt-1.5">
                            <select value={paymentStatusDraft} onChange={e => setPaymentStatusDraft(e.target.value)}
                              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none bg-white">
                              {ALL_PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                            </select>
                            <button onClick={handlePaymentSave} disabled={saving || paymentStatusDraft === selected.paymentStatus}
                              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-semibold hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-emerald-200">
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    </DetailCard>

                    {/* Customer */}
                    <DetailCard title="Customer Information" icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    } accent="blue">
                      <InfoRow label="Full Name" value={selected.customerName} />
                      <InfoRow label="Email" value={selected.customerEmail} />
                      <InfoRow label="Phone" value={selected.customerPhone} />
                      <InfoRow label="User ID" value={selected.userId} mono />
                      <InfoRow label="Address" value={selected.address} />
                      <InfoRow label="House / Flat" value={selected.houseFlat} />
                      <InfoRow label="Building / Street" value={selected.buildingStreet} />
                      <InfoRow label="Instructions" value={selected.providerInstructions} />
                    </DetailCard>

                    {/* Service */}
                    <DetailCard title="Service Details" icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.193 23.193 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    } accent="violet">
                      <InfoRow label="Service" value={`${selected.serviceIcon || ''} ${selected.serviceName}`} />
                      <InfoRow label="Service ID" value={selected.serviceId} mono />
                      <InfoRow label="Category" value={selected.categoryName} />
                      <InfoRow label="Category ID" value={selected.categoryId} mono />
                      <InfoRow label="Price (Display)" value={selected.servicePrice != null ? `₹${selected.servicePrice}` : undefined} />
                      <InfoRow label="Booking Type" value={selected.bookingType} tag />
                      <InfoRow label="Source" value={selected.source} />
                      <InfoRow label="Platform" value={selected.platform} />
                      <InfoRow label="App Version" value={selected.appVersion} />
                      <InfoRow label="Requirements" value={selected.specialRequirements} />
                      <InfoRow label="Notes" value={selected.notes} />
                      {selected.cartItems && selected.cartItems.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Cart Items ({selected.cartItems.length})</p>
                          <div className="space-y-2">
                            {selected.cartItems.map((item: any, i: number) => (
                              <div key={i} className="p-2.5 rounded-lg bg-gray-50 text-[12px]">
                                <pre className="whitespace-pre-wrap text-[11px] text-gray-600 font-mono">{JSON.stringify(item, null, 2)}</pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </DetailCard>

                    {/* Schedule */}
                    <DetailCard title="Schedule" icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    } accent="amber">
                      <InfoRow label="Date" value={selected.scheduledDate} />
                      <InfoRow label="Time" value={selected.scheduledTime} />
                      <InfoRow label="DateTime" value={fmtDate(selected.scheduledDateTime)} />
                      <InfoRow label="Day" value={selected.scheduledDateDay} />
                      <InfoRow label="Date #" value={selected.scheduledDateNum} />
                      <InfoRow label="Month" value={selected.scheduledDateMonth} />
                    </DetailCard>

                    {/* Location */}
                    <DetailCard title="Location" icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    } accent="teal">
                      <InfoRow label="Latitude" value={selected.latitude} mono />
                      <InfoRow label="Longitude" value={selected.longitude} mono />
                      <InfoRow label="City" value={selected.city ? `${selected.city.cityName}${selected.city.state ? ', ' + selected.city.state : ''}${selected.city.country ? ', ' + selected.city.country : ''}` : undefined} />
                      <InfoRow label="City ID" value={selected.city?.cityId} mono />
                      <InfoRow label="Zone" value={selected.zone?.zoneName} />
                      <InfoRow label="Zone ID" value={selected.zone?.zoneId} mono />
                      <InfoRow label="Coordinates" value={selected.customerLocation?.coordinates?.join(', ')} mono />
                      <InfoRow label="Accuracy" value={selected.customerLocation?.accuracy != null ? `${selected.customerLocation.accuracy}m` : undefined} />
                    </DetailCard>

                    {/* Provider */}
                    <DetailCard title="Provider" icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                    } accent="cyan">
                      <InfoRow label="Provider ID" value={selected.providerId} mono />
                      <InfoRow label="Name" value={selected.providerName} />
                      <InfoRow label="Phone" value={selected.providerPhone} />
                      <InfoRow label="Assigned At" value={fmtDate(selected.assignedAt)} />
                      <InfoRow label="Assignment" value={selected.assignmentMethod} tag />
                      <InfoRow label="Attempts" value={selected.assignmentAttempts} />
                      <InfoRow label="Dispatch Done" value={fmtDate(selected.dispatchCompletedAt)} />
                      {selected.providerSelfie?.url && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Provider Selfie</p>
                          <img src={selected.providerSelfie.url} alt="Provider" className="w-24 h-24 rounded-xl object-cover border-2 border-white shadow-md" />
                        </div>
                      )}
                      {(selected.providerLiveLocation?.latitude || selected.providerLiveLocation?.longitude) && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Live Location</p>
                          <p className="text-[12px] font-mono text-gray-600">{selected.providerLiveLocation?.latitude}, {selected.providerLiveLocation?.longitude}</p>
                        </div>
                      )}
                    </DetailCard>

                    {/* Rating */}
                    {(selected.rating || selected.review) && (
                      <DetailCard title="Rating & Review" icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                      } accent="yellow">
                        {selected.rating && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map(s => (
                                <svg key={s} className={`w-5 h-5 ${s <= (selected.rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-200'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                              ))}
                            </div>
                            <span className="text-lg font-bold text-gray-900">{selected.rating}</span>
                          </div>
                        )}
                        <InfoRow label="Review" value={selected.review} />
                        <InfoRow label="Rated At" value={fmtDate(selected.ratedAt)} />
                      </DetailCard>
                    )}

                    {/* Service Photos */}
                    {(selected.servicePhoto?.url || (selected.servicePhotos && selected.servicePhotos.length > 0)) && (
                      <DetailCard title="Service Photos" icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      } accent="rose">
                        <div className="flex flex-wrap gap-3">
                          {selected.servicePhoto?.url && (
                            <img src={selected.servicePhoto.url} alt="service" className="w-28 h-28 rounded-xl object-cover border-2 border-white shadow-md" />
                          )}
                          {selected.servicePhotos?.map((p: any, i: number) => p?.url ? (
                            <img key={i} src={p.url} alt={`photo-${i}`} className="w-28 h-28 rounded-xl object-cover border-2 border-white shadow-md" />
                          ) : null)}
                        </div>
                      </DetailCard>
                    )}
                  </div>
                )}

                {/* ── TAB: TIMELINE ── */}
                {activeTab === 'timeline' && (
                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Lifecycle */}
                    <DetailCard title="Lifecycle Timestamps" icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    } accent="indigo">
                      <div className="space-y-0">
                        <TimelineStep label="Created" time={selected.createdAt} status="completed" />
                        <TimelineStep label="En-Route" time={selected.enRouteAt} status={selected.enRouteAt ? 'completed' : 'pending'} />
                        <TimelineStep label="Arrived" time={selected.arrivedAt} status={selected.arrivedAt ? 'completed' : 'pending'} />
                        <TimelineStep label="Started" time={selected.startedAt} status={selected.startedAt ? 'completed' : 'pending'} />
                        <TimelineStep label="Completed" time={selected.completedAt} status={selected.completedAt ? 'completed' : 'pending'} isLast={!selected.cancelledAt} />
                        {selected.cancelledAt && (
                          <TimelineStep label="Cancelled" time={selected.cancelledAt} status="cancelled" isLast />
                        )}
                      </div>
                      {selected.cancellationReason && (
                        <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100">
                          <p className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">Cancellation Reason</p>
                          <p className="text-[13px] text-red-700 mt-1">{selected.cancellationReason}</p>
                          {selected.cancelledBy && <p className="text-[11px] text-red-500 mt-1">By: {selected.cancelledBy}</p>}
                        </div>
                      )}
                    </DetailCard>

                    {/* Status History */}
                    <DetailCard title={`Status History (${selected.statusHistory?.length || 0})`} icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    } accent="purple">
                      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                        {(!selected.statusHistory || selected.statusHistory.length === 0) && (
                          <p className="text-[12px] text-gray-400 italic text-center py-4">No status history recorded</p>
                        )}
                        {(selected.statusHistory || []).map((h, idx) => {
                          const hsm = getSM(h.status);
                          return (
                            <div key={h._id || idx} className="flex gap-3 p-3 rounded-xl bg-gray-50/80 hover:bg-gray-50 transition-colors">
                              <div className={`w-8 h-8 rounded-lg ${hsm.bg} flex items-center justify-center text-sm flex-shrink-0`}>{hsm.icon}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${hsm.bg} ${hsm.text}`}>
                                    <span className={`w-1 h-1 rounded-full ${hsm.dot}`} />{h.status}
                                  </span>
                                  <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtDate(h.changedAt)}</span>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-1">By: {h.changedBy}</p>
                                {h.reason && <p className="text-[11px] text-gray-600 mt-1 italic bg-white px-2 py-1 rounded-md">"{h.reason}"</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </DetailCard>

                    {/* OTP Details */}
                    <DetailCard title="OTP Details" icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    } accent="emerald">
                      {selected.otp ? (
                        <>
                          <div className="flex items-center justify-center p-4 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 mb-3">
                            <span className="text-3xl font-black tracking-[0.4em] text-white font-mono">{selected.otp.code || '----'}</span>
                          </div>
                          <InfoRow label="Generated At" value={fmtDate(selected.otp.generatedAt)} />
                          <InfoRow label="Expires At" value={fmtDate(selected.otp.expiresAt)} />
                          <InfoRow label="Verified" value={selected.otp.verified ? '✅ Yes' : '❌ No'} />
                          <InfoRow label="Verified At" value={fmtDate(selected.otp.verifiedAt)} />
                          <InfoRow label="Attempts" value={`${selected.otp.attempts ?? 0} / ${selected.otp.maxAttempts ?? 0}`} />
                          <InfoRow label="Sent Via" value={selected.otp.sentVia} tag />
                        </>
                      ) : (
                        <p className="text-[12px] text-gray-400 italic text-center py-4">No OTP generated</p>
                      )}
                    </DetailCard>
                  </div>
                )}

                {/* ── TAB: FINANCIAL ── */}
                {activeTab === 'financial' && (
                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Pricing Breakdown */}
                    <DetailCard title="Pricing Breakdown" icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    } accent="emerald">
                      <div className="space-y-2">
                        <PriceRow label="Base Amount" value={selected.baseAmount} />
                        <PriceRow label="Service Fee" value={selected.serviceFee} />
                        <PriceRow label="Platform Fee" value={selected.platformFee} />
                        <PriceRow label="Tax" value={selected.tax} />
                        {(selected.couponDiscount != null && selected.couponDiscount > 0) && (
                          <PriceRow label={`Coupon (${selected.couponCode || '—'})`} value={selected.couponDiscount} isDiscount />
                        )}
                        <div className="pt-3 mt-3 border-t-2 border-gray-200">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-gray-900">Total Amount</span>
                            <span className="text-lg font-black text-emerald-600">{fmtCurrency(selected.totalAmount)}</span>
                          </div>
                        </div>
                        {selected.estimatedPrice != null && (
                          <InfoRow label="Estimated Price" value={`₹${selected.estimatedPrice}`} />
                        )}
                      </div>
                    </DetailCard>

                    {/* Fee Config */}
                    <DetailCard title="Fee Configuration" icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    } accent="orange">
                      <InfoRow label="Commission %" value={selected.feeConfig?.commissionPercent != null ? `${selected.feeConfig.commissionPercent}%` : undefined} />
                      <InfoRow label="GST %" value={selected.feeConfig?.gstPercent != null ? `${selected.feeConfig.gstPercent}%` : undefined} />
                      <InfoRow label="Platform Fee Flat" value={selected.feeConfig?.platformFeeFlatINR != null ? `₹${selected.feeConfig.platformFeeFlatINR}` : undefined} />
                      <InfoRow label="Service Fee Flat" value={selected.feeConfig?.serviceFeeFlatINR != null ? `₹${selected.feeConfig.serviceFeeFlatINR}` : undefined} />
                      <div className="pt-3 mt-3 border-t border-gray-100">
                        <InfoRow label="Platform Fee Amount" value={selected.platformFeeAmount != null ? `₹${selected.platformFeeAmount}` : undefined} />
                        <InfoRow label="Platform Fee Status" value={selected.platformFeeStatus} tag />
                        <InfoRow label="Paid At" value={fmtDate(selected.platformFeePaidAt)} />
                        <InfoRow label="Wallet Credited" value={selected.walletCredited != null ? (selected.walletCredited ? '✅ Yes' : '❌ No') : undefined} />
                      </div>
                    </DetailCard>

                    {/* Payment */}
                    <DetailCard title="Payment Details" icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    } accent="sky">
                      <InfoRow label="Method" value={selected.paymentMethod} tag />
                      <InfoRow label="Status" value={selected.paymentStatus} tag />
                      <InfoRow label="Order ID" value={selected.orderId} mono />
                      <InfoRow label="Razorpay Order" value={selected.paymentDetails?.razorpayOrderId || selected.razorpayOrderId} mono />
                      <InfoRow label="Razorpay Payment" value={selected.paymentDetails?.razorpayPaymentId || selected.razorpayPaymentId} mono />
                      <InfoRow label="Transaction ID" value={selected.paymentDetails?.transactionId} mono />
                      <InfoRow label="Paid At" value={fmtDate(selected.paymentDetails?.paidAt)} />
                    </DetailCard>
                  </div>
                )}

                {/* ── TAB: DISPATCH ── ✅ NEW TAB */}
                {activeTab === 'dispatch' && (
                  <div className="space-y-6">
                    {/* Dispatch Action Buttons */}
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden border-l-4 border-l-indigo-400">
                      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-2.5">
                          <span className="text-gray-500">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          </span>
                          <h3 className="text-sm font-bold text-gray-800">Dispatch Actions</h3>
                        </div>
                      </div>
                      <div className="px-5 py-4">
                        <DispatchActionButtons
                          bookingId={selected._id}
                          currentStatus={selected.status}
                          currentProviderId={selected.providerId}
                          onActionDone={handleDispatchActionDone}
                        />
                      </div>
                    </div>

                    {/* Offer Trail Panel */}
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden border-l-4 border-l-violet-400">
                      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-2.5">
                          <span className="text-gray-500">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                          </span>
                          <h3 className="text-sm font-bold text-gray-800">Provider Offer Trail</h3>
                        </div>
                      </div>
                      <div className="px-5 py-4">
                        <OfferTrailPanel bookingId={selected.bookingId || selected._id} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB: RAW ── */}
                {activeTab === 'raw' && (
                  <div className="rounded-2xl overflow-hidden border border-gray-800">
                    <div className="bg-gray-900 px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-red-500" />
                          <span className="w-3 h-3 rounded-full bg-yellow-500" />
                          <span className="w-3 h-3 rounded-full bg-green-500" />
                        </div>
                        <span className="text-[11px] text-gray-400 ml-2 font-mono">booking-document.json</span>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(selected, null, 2)); }}
                        className="text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors">
                        📋 Copy
                      </button>
                    </div>
                    <pre className="text-[11px] bg-gray-950 text-emerald-400 p-5 overflow-x-auto max-h-[600px] font-mono leading-relaxed">
                      {JSON.stringify(selected, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* modal animation */}
      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-in { animation: modal-in 0.2s ease-out; }
      `}</style>
    </div>
  );
};

/* ═══════════════════════════════ SUB-COMPONENTS ═══════════════════════════════ */

const StatsCard: React.FC<{
  icon: React.ReactNode; label: string; value: any; gradient: string; lightBg: string; lightText: string; isRevenue?: boolean;
}> = ({ icon, label, value, gradient, lightBg, lightText, isRevenue }) => (
  <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4 hover:shadow-md hover:border-gray-300 transition-all group">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">{label}</p>
        <p className={`text-xl font-bold text-gray-900 mt-0.5 ${isRevenue ? 'text-[16px]' : ''}`}>{value}</p>
      </div>
    </div>
  </div>
);

const FilterChip: React.FC<{ label: string; onClear: () => void }> = ({ label, onClear }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-[11px] font-medium text-indigo-700">
    {label}
    <button onClick={onClear} className="ml-0.5 text-indigo-400 hover:text-indigo-700 transition-colors">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  </span>
);

const accentColors: Record<string, string> = {
  indigo: 'border-l-indigo-400', blue: 'border-l-blue-400', violet: 'border-l-violet-400',
  amber: 'border-l-amber-400', teal: 'border-l-teal-400', cyan: 'border-l-cyan-400',
  emerald: 'border-l-emerald-400', orange: 'border-l-orange-400', sky: 'border-l-sky-400',
  purple: 'border-l-purple-400', yellow: 'border-l-yellow-400', rose: 'border-l-rose-400',
};

const DetailCard: React.FC<{ title: string; icon: React.ReactNode; accent: string; children: React.ReactNode }> = ({ title, icon, accent, children }) => (
  <div className={`bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden border-l-4 ${accentColors[accent] || 'border-l-gray-400'}`}>
    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
      <div className="flex items-center gap-2.5">
        <span className="text-gray-500">{icon}</span>
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      </div>
    </div>
    <div className="px-5 py-4">{children}</div>
  </div>
);

const InfoRow: React.FC<{ label: string; value: any; mono?: boolean; tag?: boolean }> = ({ label, value, mono, tag }) => {
  const display = value === null || value === undefined || value === '' ? '—' : String(value);
  const isEmpty = display === '—';
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-[11px] font-medium text-gray-400 min-w-[100px] flex-shrink-0">{label}</span>
      {tag && !isEmpty ? (
        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[11px] font-semibold text-gray-600 uppercase">{display}</span>
      ) : (
        <span className={`text-[12px] text-right break-all ${isEmpty ? 'text-gray-300' : mono ? 'font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded' : 'text-gray-800 font-medium'}`}>
          {display}
        </span>
      )}
    </div>
  );
};

const PriceRow: React.FC<{ label: string; value?: number | null; isDiscount?: boolean }> = ({ label, value, isDiscount }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
    <span className="text-[12px] text-gray-500">{label}</span>
    <span className={`text-[13px] font-semibold ${isDiscount ? 'text-red-600' : 'text-gray-800'}`}>
      {isDiscount ? '- ' : ''}{fmtCurrency(value)}
    </span>
  </div>
);

const TimelineStep: React.FC<{ label: string; time?: string | null; status: 'completed' | 'pending' | 'cancelled'; isLast?: boolean }> = ({ label, time, status, isLast }) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center">
      <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
        status === 'completed' ? 'bg-emerald-500 border-emerald-500' :
        status === 'cancelled' ? 'bg-red-500 border-red-500' :
        'bg-white border-gray-300'
      }`} />
      {!isLast && <div className={`w-0.5 flex-1 min-h-[24px] ${status === 'completed' ? 'bg-emerald-200' : 'bg-gray-200'}`} />}
    </div>
    <div className="pb-4">
      <p className={`text-[12px] font-semibold ${status === 'completed' ? 'text-gray-900' : status === 'cancelled' ? 'text-red-700' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-[11px] mt-0.5 ${status === 'completed' || status === 'cancelled' ? 'text-gray-500' : 'text-gray-300'}`}>{time ? fmtDate(time) : 'Pending'}</p>
    </div>
  </div>
);

/* ── page number generator ── */
function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

export default BookingsManager;