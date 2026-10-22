import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Radar, RefreshCw, Monitor, Users, Wrench, Mail, Activity,
  Search, X, MapPin, Wifi, WifiOff, ChevronLeft, ChevronRight,
  Copy, CheckCircle2, Smartphone, Clock, Shield, Globe, Eye,
} from 'lucide-react';
import TrackingHeatmap, { type HeatmapPoint } from '../components/Maps/TrackingHeatmap';
import { trackingApi } from '../lib/api';

/* ════════════════════════════════════════════════════════════════════
   THEME SYSTEM — mirrors admin panel's 6 themes
   ════════════════════════════════════════════════════════════════════ */
interface PageTheme {
  // backgrounds
  bgPage: string;
  bgCard: string;
  bgCardHover: string;
  bgInput: string;
  bgModal: string;
  bgOverlay: string;
  // text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // accents
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  accent: string;
  accentLight: string;
  // gradients
  gradientPrimary: string;
  gradientSecondary: string;
  gradientActive: string;
  gradientHeader: string;
  // borders
  border: string;
  borderLight: string;
  // badges
  badgeLive: string;
  badgeLiveGlow: string;
  // pill active / inactive
  pillActive: string;
  pillActiveBg: string;
  pillInactive: string;
  pillInactiveBg: string;
  // tabs
  tabActive: string;
  tabInactive: string;
  tabIndicator: string;
  // table header
  thBg: string;
  // misc
  scrollThumb: string;
  ringFocus: string;
}

const PAGE_THEMES: Record<string, PageTheme> = {
  light: {
    bgPage: 'bg-gray-50', bgCard: 'bg-white', bgCardHover: 'hover:bg-gray-50',
    bgInput: 'bg-gray-100', bgModal: 'bg-white', bgOverlay: 'bg-black/40',
    textPrimary: 'text-gray-900', textSecondary: 'text-gray-600', textMuted: 'text-gray-400',
    primary: '#6366f1', primaryLight: '#818cf8', primaryDark: '#4f46e5',
    secondary: '#10b981', secondaryLight: '#34d399',
    accent: '#f59e0b', accentLight: '#fbbf24',
    gradientPrimary: 'from-indigo-500 to-purple-600',
    gradientSecondary: 'from-emerald-500 to-teal-600',
    gradientActive: 'from-emerald-400 to-green-500',
    gradientHeader: 'from-indigo-500 via-purple-500 to-pink-500',
    border: 'border-gray-200', borderLight: 'border-gray-100',
    badgeLive: '#10b981', badgeLiveGlow: '#10b98155',
    pillActive: 'text-white', pillActiveBg: 'bg-indigo-500',
    pillInactive: 'text-gray-600', pillInactiveBg: 'bg-gray-100',
    tabActive: 'text-indigo-600', tabInactive: 'text-gray-500', tabIndicator: 'bg-indigo-500',
    thBg: 'bg-gray-50',
    scrollThumb: '#cbd5e1', ringFocus: 'ring-indigo-300',
  },
  dark: {
    bgPage: 'bg-gray-950', bgCard: 'bg-gray-900', bgCardHover: 'hover:bg-gray-800',
    bgInput: 'bg-gray-800', bgModal: 'bg-gray-900', bgOverlay: 'bg-black/70',
    textPrimary: 'text-gray-100', textSecondary: 'text-gray-400', textMuted: 'text-gray-600',
    primary: '#818cf8', primaryLight: '#a5b4fc', primaryDark: '#6366f1',
    secondary: '#34d399', secondaryLight: '#6ee7b7',
    accent: '#fbbf24', accentLight: '#fde68a',
    gradientPrimary: 'from-indigo-600 to-purple-700',
    gradientSecondary: 'from-emerald-600 to-teal-700',
    gradientActive: 'from-emerald-500 to-green-600',
    gradientHeader: 'from-indigo-600 via-purple-600 to-pink-600',
    border: 'border-gray-800', borderLight: 'border-gray-700',
    badgeLive: '#34d399', badgeLiveGlow: '#34d39955',
    pillActive: 'text-white', pillActiveBg: 'bg-indigo-600',
    pillInactive: 'text-gray-400', pillInactiveBg: 'bg-gray-800',
    tabActive: 'text-indigo-400', tabInactive: 'text-gray-500', tabIndicator: 'bg-indigo-500',
    thBg: 'bg-gray-800/60',
    scrollThumb: '#475569', ringFocus: 'ring-indigo-500/40',
  },
  purple: {
    bgPage: 'bg-[#0c0515]', bgCard: 'bg-[#1a0a2e]', bgCardHover: 'hover:bg-[#25103d]',
    bgInput: 'bg-[#25103d]', bgModal: 'bg-[#1a0a2e]', bgOverlay: 'bg-black/70',
    textPrimary: 'text-purple-100', textSecondary: 'text-purple-300', textMuted: 'text-purple-500',
    primary: '#a855f7', primaryLight: '#c084fc', primaryDark: '#9333ea',
    secondary: '#ec4899', secondaryLight: '#f472b6',
    accent: '#f59e0b', accentLight: '#fbbf24',
    gradientPrimary: 'from-purple-600 to-fuchsia-700',
    gradientSecondary: 'from-pink-600 to-rose-700',
    gradientActive: 'from-fuchsia-500 to-pink-600',
    gradientHeader: 'from-purple-600 via-fuchsia-600 to-pink-600',
    border: 'border-purple-800/50', borderLight: 'border-purple-700/30',
    badgeLive: '#c084fc', badgeLiveGlow: '#c084fc55',
    pillActive: 'text-white', pillActiveBg: 'bg-purple-600',
    pillInactive: 'text-purple-300', pillInactiveBg: 'bg-purple-900/50',
    tabActive: 'text-purple-400', tabInactive: 'text-purple-600', tabIndicator: 'bg-purple-500',
    thBg: 'bg-purple-900/40',
    scrollThumb: '#7c3aed', ringFocus: 'ring-purple-500/40',
  },
  ocean: {
    bgPage: 'bg-[#021526]', bgCard: 'bg-[#0a2540]', bgCardHover: 'hover:bg-[#0d3156]',
    bgInput: 'bg-[#0d3156]', bgModal: 'bg-[#0a2540]', bgOverlay: 'bg-black/70',
    textPrimary: 'text-cyan-100', textSecondary: 'text-cyan-300', textMuted: 'text-cyan-600',
    primary: '#06b6d4', primaryLight: '#22d3ee', primaryDark: '#0891b2',
    secondary: '#0ea5e9', secondaryLight: '#38bdf8',
    accent: '#f59e0b', accentLight: '#fbbf24',
    gradientPrimary: 'from-cyan-600 to-blue-700',
    gradientSecondary: 'from-sky-600 to-blue-700',
    gradientActive: 'from-cyan-500 to-teal-600',
    gradientHeader: 'from-cyan-600 via-blue-600 to-indigo-600',
    border: 'border-cyan-800/40', borderLight: 'border-cyan-700/30',
    badgeLive: '#22d3ee', badgeLiveGlow: '#22d3ee55',
    pillActive: 'text-white', pillActiveBg: 'bg-cyan-600',
    pillInactive: 'text-cyan-300', pillInactiveBg: 'bg-cyan-900/50',
    tabActive: 'text-cyan-400', tabInactive: 'text-cyan-600', tabIndicator: 'bg-cyan-500',
    thBg: 'bg-cyan-900/40',
    scrollThumb: '#0891b2', ringFocus: 'ring-cyan-500/40',
  },
  forest: {
    bgPage: 'bg-[#052e16]', bgCard: 'bg-[#14532d]', bgCardHover: 'hover:bg-[#166534]',
    bgInput: 'bg-[#166534]', bgModal: 'bg-[#14532d]', bgOverlay: 'bg-black/70',
    textPrimary: 'text-green-100', textSecondary: 'text-green-300', textMuted: 'text-green-600',
    primary: '#22c55e', primaryLight: '#4ade80', primaryDark: '#16a34a',
    secondary: '#84cc16', secondaryLight: '#a3e635',
    accent: '#f59e0b', accentLight: '#fbbf24',
    gradientPrimary: 'from-green-600 to-emerald-700',
    gradientSecondary: 'from-lime-600 to-green-700',
    gradientActive: 'from-green-500 to-emerald-600',
    gradientHeader: 'from-green-600 via-emerald-600 to-teal-600',
    border: 'border-green-800/40', borderLight: 'border-green-700/30',
    badgeLive: '#4ade80', badgeLiveGlow: '#4ade8055',
    pillActive: 'text-white', pillActiveBg: 'bg-green-600',
    pillInactive: 'text-green-300', pillInactiveBg: 'bg-green-900/50',
    tabActive: 'text-green-400', tabInactive: 'text-green-600', tabIndicator: 'bg-green-500',
    thBg: 'bg-green-900/40',
    scrollThumb: '#16a34a', ringFocus: 'ring-green-500/40',
  },
  sunset: {
    bgPage: 'bg-[#1c0a00]', bgCard: 'bg-[#3b1506]', bgCardHover: 'hover:bg-[#4d1d08]',
    bgInput: 'bg-[#4d1d08]', bgModal: 'bg-[#3b1506]', bgOverlay: 'bg-black/70',
    textPrimary: 'text-orange-100', textSecondary: 'text-orange-300', textMuted: 'text-orange-600',
    primary: '#f97316', primaryLight: '#fb923c', primaryDark: '#ea580c',
    secondary: '#ef4444', secondaryLight: '#f87171',
    accent: '#eab308', accentLight: '#facc15',
    gradientPrimary: 'from-orange-600 to-red-700',
    gradientSecondary: 'from-red-600 to-rose-700',
    gradientActive: 'from-orange-500 to-amber-600',
    gradientHeader: 'from-orange-600 via-red-600 to-rose-600',
    border: 'border-orange-800/40', borderLight: 'border-orange-700/30',
    badgeLive: '#fb923c', badgeLiveGlow: '#fb923c55',
    pillActive: 'text-white', pillActiveBg: 'bg-orange-600',
    pillInactive: 'text-orange-300', pillInactiveBg: 'bg-orange-900/50',
    tabActive: 'text-orange-400', tabInactive: 'text-orange-600', tabIndicator: 'bg-orange-500',
    thBg: 'bg-orange-900/40',
    scrollThumb: '#ea580c', ringFocus: 'ring-orange-500/40',
  },
};

function getActiveThemeName(): string {
  try {
    const stored = localStorage.getItem('admin-theme');
    if (stored && PAGE_THEMES[stored]) return stored;
  } catch {}
  return 'dark';
}

/* ════════════════════════════════════════════════════════════════════ */

interface TrackingDevice {
  _id: string;
  deviceId?: string;
  userId?: string;
  providerId?: string;
  city?: string;
  platform?: string;
  appVersion?: string;
  lat?: number;
  lng?: number;
  lastSeenAt?: number | null;
  createdAt?: number | null;
  active?: boolean;
  type?: 'customer' | 'provider';
  isActive?: boolean;
  isServiceable?: boolean;
  fcmToken?: string;
}

interface TrackingLead {
  _id: string;
  deviceId?: string;
  email?: string;
  city?: string;
  createdAt?: number | null;
}

interface TrackingStats {
  totalDevices: number;
  totalCustomers: number;
  totalProviders: number;
  totalLeads: number;
  activeNow: number;
  activeCustomers: number;
  activeProviders: number;
  byCity: Record<string, number>;
  byPlatform: Record<string, number>;
}

const PAGE_SIZE = 25;
const AUTO_REFRESH = 30_000;

function fmtDate(v?: number | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function timeAgo(v?: number | null): string {
  if (!v) return '';
  const sec = Math.floor((Date.now() - v) / 1000);
  if (sec < 0) return '';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

/* ════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ════════════════════════════════════════════════════════════════════ */
const LiveTracking: React.FC = () => {
  /* ── theme state ───────────────────────────────────────────────── */
  const [themeName, setThemeName] = useState(getActiveThemeName);
  const t = PAGE_THEMES[themeName] || PAGE_THEMES.dark;

  useEffect(() => {
    const onStorage = () => setThemeName(getActiveThemeName());
    window.addEventListener('storage', onStorage);
    const iv = setInterval(() => {
      const n = getActiveThemeName();
      setThemeName((prev) => (prev !== n ? n : prev));
    }, 1000);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(iv); };
  }, []);

  /* ── data states ───────────────────────────────────────────────── */
  const [stats, setStats] = useState<TrackingStats | null>(null);
  const [devices, setDevices] = useState<TrackingDevice[]>([]);
  const [leads, setLeads] = useState<TrackingLead[]>([]);
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'heatmap' | 'devices' | 'leads'>('heatmap');

  /* ── filters ───────────────────────────────────────────────────── */
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'provider'>('all');
  const [cityFilter, setCityFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalDevices, setTotalDevices] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState<TrackingDevice | null>(null);
  const [copiedField, setCopiedField] = useState('');

  const refreshTimer = useRef<ReturnType<typeof setInterval>>();

  /* ── fetch stats ───────────────────────────────────────────────── */
  const fetchStats = useCallback(async () => {
    try {
      const r = await trackingApi.getStats();
      setStats(r.data || r);
    } catch {}
  }, []);

  /* ── fetch devices ─────────────────────────────────────────────── */
  const fetchDevices = useCallback(async () => {
    try {
      const r = await trackingApi.getDevices({
        type: typeFilter,
        city: cityFilter || undefined,
        platform: platformFilter || undefined,
        active: activeOnly ? 'true' : undefined,
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      });
      const data = r.data || r;
      setDevices(data.devices || []);
      setTotalDevices(data.total || 0);
    } catch {}
  }, [typeFilter, cityFilter, platformFilter, activeOnly, search, page]);

  /* ── fetch leads ───────────────────────────────────────────────── */
  const fetchLeads = useCallback(async () => {
    try {
      const r = await trackingApi.getLeads({
        city: cityFilter || undefined,
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      });
      const data = r.data || r;
      setLeads(data.leads || []);
      setTotalLeads(data.total || 0);
    } catch {}
  }, [cityFilter, search, page]);

  /* ── fetch heatmap ─────────────────────────────────────────────── */
  const fetchHeatmap = useCallback(async () => {
    try {
      const r = await trackingApi.getHeatmap({
        type: typeFilter,
        city: cityFilter || undefined,
        activeOnly: activeOnly ? 'true' : undefined,
      });
      const data = r.data || r;
      setHeatmapPoints(data.points || []);
    } catch {}
  }, [typeFilter, cityFilter, activeOnly]);

  /* ── master fetch ──────────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchStats(),
        tab === 'heatmap' ? fetchHeatmap() : tab === 'devices' ? fetchDevices() : fetchLeads(),
      ]);
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [fetchStats, fetchHeatmap, fetchDevices, fetchLeads, tab]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    refreshTimer.current = setInterval(fetchAll, AUTO_REFRESH);
    return () => clearInterval(refreshTimer.current);
  }, [fetchAll]);

  useEffect(() => { setPage(1); }, [typeFilter, cityFilter, platformFilter, activeOnly, search, tab]);

  /* ── copy helper ───────────────────────────────────────────────── */
  const copyText = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(''), 1500);
  };

  /* ── city chips (top 6) ────────────────────────────────────────── */
  const topCities = stats
    ? Object.entries(stats.byCity).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c)
    : [];

  const totalPages = tab === 'leads' ? Math.ceil(totalLeads / PAGE_SIZE) : Math.ceil(totalDevices / PAGE_SIZE);

  /* ── clear filters ─────────────────────────────────────────────── */
  const clearFilters = () => {
    setTypeFilter('all');
    setCityFilter('');
    setPlatformFilter('');
    setActiveOnly(false);
    setSearch('');
    setPage(1);
  };

  const hasFilters = typeFilter !== 'all' || cityFilter || platformFilter || activeOnly || search;

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className={`min-h-screen ${t.bgPage} p-4 md:p-6 transition-colors duration-300`}>
      {/* ── header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {/* animated radar */}
          <div className="relative">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br" style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.primaryDark})` }}>
              <Radar className="w-6 h-6 text-white animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping" style={{ background: t.badgeLive }} />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{ background: t.badgeLive }} />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${t.textPrimary}`}>Live Tracking</h1>
            <p className={`text-sm ${t.textSecondary}`}>
              Real-time device monitoring &amp; heatmap
              {stats && <span className={`ml-2 ${t.textMuted}`}>• Auto-refresh every 30s</span>}
            </p>
          </div>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.primaryDark})` }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── error banner ──────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
          <button onClick={fetchAll} className="ml-auto underline text-xs">Retry</button>
        </div>
      )}

      {/* ── stat cards ────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {([
            { label: 'Total Devices', value: stats.totalDevices, icon: Monitor, gradient: `linear-gradient(135deg, ${t.primary}22, ${t.primaryDark}22)`, iconColor: t.primary },
            { label: 'Active Now', value: stats.activeNow, icon: Activity, gradient: `linear-gradient(135deg, ${t.badgeLive}22, ${t.secondaryLight || t.secondary}22)`, iconColor: t.badgeLive, highlight: true },
            { label: 'Customers', value: stats.totalCustomers, icon: Users, gradient: `linear-gradient(135deg, ${t.secondary}22, ${t.secondaryLight || t.secondary}22)`, iconColor: t.secondary },
            { label: 'Providers', value: stats.totalProviders, icon: Wrench, gradient: `linear-gradient(135deg, ${t.primary}22, ${t.primaryLight}22)`, iconColor: t.primary },
            { label: 'Email Leads', value: stats.totalLeads, icon: Mail, gradient: `linear-gradient(135deg, ${t.accent}22, ${t.accentLight}22)`, iconColor: t.accent },
          ] as const).map((c) => (
            <div
              key={c.label}
              className={`${t.bgCard} rounded-xl p-4 ${t.border} border transition-all hover:scale-[1.02]`}
              style={{ background: c.gradient }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium ${t.textSecondary}`}>{c.label}</span>
                <c.icon className="w-4 h-4" style={{ color: c.iconColor }} />
              </div>
              <div className={`text-2xl font-bold ${t.textPrimary}`}>{c.value.toLocaleString()}</div>
              {c.highlight && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: t.badgeLive, boxShadow: `0 0 8px ${t.badgeLiveGlow}` }} />
                  <span className="text-xs font-medium" style={{ color: t.badgeLive }}>
                    {stats.activeCustomers} customers · {stats.activeProviders} providers
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── tabs ──────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-1 mb-4 p-1 rounded-xl ${t.bgCard} ${t.border} border w-fit`}>
        {(['heatmap', 'devices', 'leads'] as const).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === tb
                ? `${t.pillActive} shadow-lg`
                : `${t.pillInactive} ${t.pillInactiveBg}`
            }`}
            style={tab === tb ? { background: t.primary } : undefined}
          >
            {tb === 'heatmap' && '🗺️ Heatmap'}
            {tb === 'devices' && `📱 Devices${stats ? ` (${stats.totalDevices})` : ''}`}
            {tb === 'leads' && `📧 Leads${stats ? ` (${stats.totalLeads})` : ''}`}
          </button>
        ))}
      </div>

      {/* ── filter bar ────────────────────────────────────────────── */}
      <div className={`${t.bgCard} rounded-xl p-4 ${t.border} border mb-4`}>
        <div className="flex flex-wrap items-center gap-3">
          {/* type pills */}
          {tab !== 'leads' && (
            <div className="flex items-center gap-1">
              {(['all', 'customer', 'provider'] as const).map((tp) => (
                <button
                  key={tp}
                  onClick={() => setTypeFilter(tp)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    typeFilter === tp ? `${t.pillActive}` : `${t.pillInactive} ${t.pillInactiveBg}`
                  }`}
                  style={typeFilter === tp ? { background: t.primary } : undefined}
                >
                  {tp === 'all' ? 'All' : tp === 'customer' ? '👤 Customers' : '🔧 Providers'}
                </button>
              ))}
            </div>
          )}

          {/* city input */}
          <div className="relative">
            <MapPin className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${t.textMuted}`} />
            <input
              placeholder="City…"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className={`pl-8 pr-3 py-1.5 rounded-lg text-xs ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none focus:ring-2 ${t.ringFocus} w-32`}
            />
          </div>

          {/* platform select */}
          {tab !== 'leads' && (
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className={`px-3 py-1.5 rounded-lg text-xs ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none focus:ring-2 ${t.ringFocus}`}
            >
              <option value="">All Platforms</option>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
              <option value="web">Web</option>
            </select>
          )}

          {/* active only */}
          {tab !== 'leads' && (
            <label className={`flex items-center gap-2 text-xs ${t.textSecondary} cursor-pointer`}>
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="rounded accent-current"
                style={{ accentColor: t.primary }}
              />
              Active only
            </label>
          )}

          {/* search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${t.textMuted}`} />
            <input
              placeholder="Search device/user/email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none focus:ring-2 ${t.ringFocus}`}
            />
          </div>

          {/* clear */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {/* city quick-chips */}
        {topCities.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {topCities.map((c) => (
              <button
                key={c}
                onClick={() => setCityFilter(cityFilter === c ? '' : c)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                  cityFilter === c ? `${t.pillActive}` : `${t.pillInactive} ${t.pillInactiveBg}`
                }`}
                style={cityFilter === c ? { background: t.primary } : undefined}
              >
                {c} ({stats?.byCity[c]})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── TAB: HEATMAP ─────────────────────────────────────────── */}
      {tab === 'heatmap' && (
        <TrackingHeatmap
          points={heatmapPoints}
          loading={loading}
          activeFilter={typeFilter}
        />
      )}

      {/* ── TAB: DEVICES ─────────────────────────────────────────── */}
      {tab === 'devices' && (
        <>
          {loading && !devices.length ? (
            <div className={`flex items-center justify-center py-20 ${t.textSecondary}`}>
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading devices…
            </div>
          ) : devices.length === 0 ? (
            <div className={`text-center py-20 ${t.textSecondary}`}>
              <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No devices found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {devices.map((dev) => (
                <DeviceCard key={dev._id} device={dev} theme={t} onSelect={setSelectedDevice} />
              ))}
            </div>
          )}
          <Pagination page={page} total={totalPages} onPage={setPage} theme={t} />
        </>
      )}

      {/* ── TAB: LEADS ───────────────────────────────────────────── */}
      {tab === 'leads' && (
        <>
          <div className={`${t.bgCard} rounded-xl ${t.border} border overflow-hidden`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={t.thBg}>
                  {['Email', 'City', 'Device ID', 'Registered'].map((h) => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold ${t.textSecondary} uppercase tracking-wider`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l._id} className={`${t.border} border-t ${t.bgCardHover} transition-colors`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accentLight})` }}>
                          {(l.email || '?')[0].toUpperCase()}
                        </div>
                        <span className={`font-medium ${t.textPrimary}`}>{l.email || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {l.city ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${t.pillInactiveBg} ${t.textSecondary}`}>{l.city}</span>
                      ) : (
                        <span className={t.textMuted}>—</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 font-mono text-xs ${t.textSecondary}`}>{l.deviceId || '—'}</td>
                    <td className={`px-4 py-3 text-xs ${t.textSecondary}`}>{fmtDate(l.createdAt)}</td>
                  </tr>
                ))}
                {!leads.length && (
                  <tr>
                    <td colSpan={4} className={`text-center py-12 ${t.textSecondary}`}>
                      <Mail className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      No leads found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={Math.ceil(totalLeads / PAGE_SIZE)} onPage={setPage} theme={t} />
        </>
      )}

      {/* ── device detail modal ──────────────────────────────────── */}
      {selectedDevice && (
        <DeviceDetailModal
          device={selectedDevice}
          theme={t}
          copiedField={copiedField}
          onCopy={copyText}
          onClose={() => setSelectedDevice(null)}
        />
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ════════════════════════════════════════════════════════════════════ */

/* ── Device Card ─────────────────────────────────────────────────── */
const DeviceCard: React.FC<{
  device: TrackingDevice;
  theme: PageTheme;
  onSelect: (d: TrackingDevice) => void;
}> = ({ device, theme: t, onSelect }) => {
  const isProvider = device.type === 'provider';
  const isActive = device.active ?? false;

  return (
    <div
      onClick={() => onSelect(device)}
      className={`${t.bgCard} rounded-xl p-4 ${t.border} border cursor-pointer transition-all hover:scale-[1.01] hover:shadow-xl`}
    >
      <div className="flex items-start gap-3">
        {/* avatar */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{
            background: isProvider
              ? `linear-gradient(135deg, ${t.primary}, ${t.primaryDark})`
              : `linear-gradient(135deg, ${t.secondary}, ${t.secondaryLight || t.secondary})`,
          }}
        >
          {isProvider ? '🔧' : '👤'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-semibold text-sm ${t.textPrimary} truncate`}>
              {isProvider ? device.providerId : device.userId || device.deviceId || '—'}
            </span>
            {isActive && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: t.badgeLive }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
            )}
          </div>

          {/* info chips */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {device.city && (
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${t.pillInactiveBg} ${t.textSecondary}`}>
                <MapPin className="w-2.5 h-2.5" /> {device.city}
              </span>
            )}
            {device.platform && (
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${t.pillInactiveBg} ${t.textSecondary}`}>
                <Smartphone className="w-2.5 h-2.5" /> {device.platform}
              </span>
            )}
            {device.appVersion && (
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${t.pillInactiveBg} ${t.textSecondary}`}>
                v{device.appVersion}
              </span>
            )}
          </div>

          {/* status row */}
          <div className="flex items-center gap-3">
            {isActive ? (
              <Wifi className="w-3.5 h-3.5" style={{ color: t.badgeLive }} />
            ) : (
              <WifiOff className={`w-3.5 h-3.5 ${t.textMuted}`} />
            )}
            <span className={`text-[10px] ${t.textMuted}`}>
              {device.lastSeenAt ? timeAgo(device.lastSeenAt) : 'Never seen'}
            </span>
            <Eye className={`w-3 h-3 ml-auto ${t.textMuted}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Device Detail Modal ─────────────────────────────────────────── */
const DeviceDetailModal: React.FC<{
  device: TrackingDevice;
  theme: PageTheme;
  copiedField: string;
  onCopy: (label: string, text: string) => void;
  onClose: () => void;
}> = ({ device, theme: t, copiedField, onCopy, onClose }) => {
  const isProvider = device.type === 'provider';

  const rows: { icon: React.ReactNode; label: string; value: string; copyable?: boolean }[] = [
    { icon: <Globe className="w-3.5 h-3.5" />, label: 'Type', value: isProvider ? 'Provider' : 'Customer' },
    { icon: <Users className="w-3.5 h-3.5" />, label: isProvider ? 'Provider ID' : 'User ID', value: (isProvider ? device.providerId : device.userId) || '—', copyable: true },
    { icon: <Smartphone className="w-3.5 h-3.5" />, label: 'Device ID', value: device.deviceId || '—', copyable: true },
    { icon: <MapPin className="w-3.5 h-3.5" />, label: 'City', value: device.city || '—' },
    { icon: <Monitor className="w-3.5 h-3.5" />, label: 'Platform', value: device.platform || '—' },
    { icon: <Activity className="w-3.5 h-3.5" />, label: 'App Version', value: device.appVersion || '—' },
    { icon: <Clock className="w-3.5 h-3.5" />, label: 'Last Seen', value: device.lastSeenAt ? `${fmtDate(device.lastSeenAt)} (${timeAgo(device.lastSeenAt)})` : '—' },
    { icon: <Clock className="w-3.5 h-3.5" />, label: 'Registered', value: fmtDate(device.createdAt) },
    { icon: <MapPin className="w-3.5 h-3.5" />, label: 'Coordinates', value: device.lat && device.lng ? `${device.lat.toFixed(5)}, ${device.lng.toFixed(5)}` : '—', copyable: !!(device.lat && device.lng) },
    { icon: <Shield className="w-3.5 h-3.5" />, label: 'Serviceable', value: device.isServiceable != null ? (device.isServiceable ? '✅ Yes' : '❌ No') : '—' },
    { icon: <Activity className="w-3.5 h-3.5" />, label: 'Is Active (DB)', value: device.isActive != null ? (device.isActive ? '✅ Yes' : '❌ No') : '—' },
    { icon: <Shield className="w-3.5 h-3.5" />, label: 'FCM Token', value: device.fcmToken ? `${device.fcmToken.slice(0, 6)}…${device.fcmToken.slice(-4)}` : '—', copyable: !!device.fcmToken },
  ];

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${t.bgOverlay}`} onClick={onClose}>
      <div
        className={`${t.bgModal} rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto border ${t.border} shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="p-5 rounded-t-2xl text-white" style={{ background: `linear-gradient(135deg, ${isProvider ? t.primary : t.secondary}, ${isProvider ? t.primaryDark : (t.secondaryLight || t.secondary)})` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl">
                {isProvider ? '🔧' : '👤'}
              </div>
              <div>
                <div className="font-bold text-lg">{isProvider ? 'Provider' : 'Customer'} Device</div>
                <div className="text-white/70 text-sm font-mono">{device.deviceId || '—'}</div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            {device.active ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50" />
                <span className="text-sm font-semibold text-green-200">Currently Active</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="text-sm font-semibold text-red-200">Offline</span>
              </>
            )}
          </div>
        </div>

        {/* body */}
        <div className="p-4 space-y-1">
          {rows.map((r) => (
            <div key={r.label} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${t.bgCardHover} transition-colors group`}>
              <span style={{ color: t.primary }}>{r.icon}</span>
              <span className={`text-xs font-medium ${t.textSecondary} w-28 shrink-0`}>{r.label}</span>
              <span className={`text-xs font-semibold ${t.textPrimary} flex-1 truncate`}>{r.value}</span>
              {r.copyable && r.value !== '—' && (
                <button
                  onClick={() => onCopy(r.label, r.value)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copy"
                >
                  {copiedField === r.label ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className={`w-3.5 h-3.5 ${t.textMuted} hover:${t.textSecondary}`} />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Pagination ──────────────────────────────────────────────────── */
const Pagination: React.FC<{
  page: number;
  total: number;
  onPage: (p: number) => void;
  theme: PageTheme;
}> = ({ page, total, onPage, theme: t }) => {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-6">
      <button
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page <= 1}
        className={`p-2 rounded-lg ${t.bgCard} ${t.border} border ${t.textSecondary} disabled:opacity-30 hover:scale-105 transition-all`}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className={`text-xs font-semibold px-4 py-2 rounded-lg`} style={{ background: t.primary, color: '#fff' }}>
        {page} / {total}
      </span>
      <button
        onClick={() => onPage(Math.min(total, page + 1))}
        disabled={page >= total}
        className={`p-2 rounded-lg ${t.bgCard} ${t.border} border ${t.textSecondary} disabled:opacity-30 hover:scale-105 transition-all`}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default LiveTracking;