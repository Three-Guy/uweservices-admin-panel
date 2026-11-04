// src/pages/DirectPushCenter.tsx
// Direct Push Center — FCM sender + User/Provider browser with FCM tokens
// v3.1 — Fixed "Objects are not valid as React child" crash in failure rendering

import React, { useState, useEffect, useCallback } from 'react';
import {
  Rocket, Send, Users, User, UserCheck, Hash, List, Search, X,
  CheckCircle2, XCircle, AlertTriangle, Loader2, Eye, History,
  RefreshCw, Image as ImageIcon, Link as LinkIcon, Code,
  ChevronRight, Clock, TrendingUp, Sparkles, Smartphone, Copy,
  ChevronLeft, Zap, Gift, Star, Heart, Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  directPushApi,
  DirectPushTargetMode,
  DirectPushResult,
  DirectPushLog,
  PreviewCountResult,
  ProviderSearchResult,
  FcmUserRecord,
  FcmProviderRecord,
} from '../lib/directPushApi';

// ─── Helpers ───
const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return String(iso); }
};
const formatDuration = (ms?: number) => {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
};
const statusColor = (s: string) => {
  if (s === 'completed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (s === 'partial') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (s === 'failed') return 'bg-red-100 text-red-700 border-red-200';
  if (s === 'sending') return 'bg-blue-100 text-blue-700 border-blue-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
};
const useDebounce = <T,>(value: T, delay: number): T => {
  const [d, setD] = useState(value);
  useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return d;
};
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => toast.success('Copied!')).catch(() => toast.error('Copy failed'));
};

// ═══════════════════════════════════════════════════════════
// 🔒 SAFE STRING — converts ANY value to a string for JSX
// This is the FIX for "Objects are not valid as React child"
// ═══════════════════════════════════════════════════════════
const safe = (val: any): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (val instanceof Error) return val.message || 'Unknown error';
  if (typeof val === 'object') {
    // Extract the most readable field from common error shapes
    if (typeof val.message === 'string') return val.message;
    if (typeof val.error === 'string') return val.error;
    if (typeof val.msg === 'string') return val.msg;
    if (typeof val.details === 'string') return val.details;
    if (typeof val.code === 'string') return val.code;
    // Fallback: JSON
    try {
      const s = JSON.stringify(val);
      return s.length > 300 ? s.substring(0, 300) + '…' : s;
    } catch {
      return '[Object]';
    }
  }
  return String(val);
};

// ─── Swiggy-style templates ───
const TEMPLATES = [
  {
    name: '⚡ Flash Deal',
    icon: Zap,
    color: 'from-orange-500 to-red-500',
    title: '⚡ Flash Deal! 60% OFF on All Services',
    body: '🔥 Only for next 2 hours! Use code FLASH60 at checkout. Book your electrician, plumber & more at HALF PRICE! 🏃‍♂️💨',
    customData: { type: 'offer', offerType: 'flash_deal', discount: '60%', code: 'FLASH60', minOrder: '299', maxDiscount: '200', urgency: 'high', ctaText: 'Book Now ⚡', ctaLink: '/offers/flash60', bgColor: '#FF5722' },
  },
  {
    name: '🎁 Welcome Offer',
    icon: Gift,
    color: 'from-green-500 to-emerald-500',
    title: '🎉 Welcome! Flat ₹150 OFF Your First Booking',
    body: 'Your home deserves the best! 🏠 Use code WELCOME150 on your first service booking. Electrician, Plumber, AC Repair — ALL included! ✅',
    customData: { type: 'welcome_offer', discount: '₹150', code: 'WELCOME150', minOrder: '399', ctaText: 'Claim Offer 🎁', ctaLink: '/offers/welcome', bgColor: '#4CAF50' },
  },
  {
    name: '🥳 Weekend BOGO',
    icon: Star,
    color: 'from-purple-500 to-pink-500',
    title: '🥳 Weekend Special! Buy 1 Get 1 FREE Service',
    body: 'This weekend only! 🎊 Book any home service and get the SECOND one FREE. AC + Cleaning, Plumbing + Electrical — mix & match! 🛠️✨',
    customData: { type: 'promo', offerType: 'bogo', discount: 'BOGO', code: 'WKND2FOR1', minOrder: '499', ctaText: 'Grab BOGO 🥳', ctaLink: '/offers/weekend', bgColor: '#9C27B0' },
  },
  {
    name: '🪔 Festival Deal',
    icon: Sparkles,
    color: 'from-amber-500 to-orange-500',
    title: '🪔 Diwali Dhamaka! Flat 70% OFF + Free Visit',
    body: 'Celebrate with a sparkling clean home! ✨ 70% OFF on Deep Cleaning, Painting & Electrical. Use code DIWALI70. Free doorstep visit! 🏡',
    customData: { type: 'festival_offer', discount: '70%', code: 'DIWALI70', minOrder: '599', maxDiscount: '500', ctaText: 'Celebrate 🪔', ctaLink: '/offers/diwali', bgColor: '#FF9800' },
  },
  {
    name: '💖 We Miss You',
    icon: Heart,
    color: 'from-pink-500 to-rose-500',
    title: '😢 We Miss You! Here\'s ₹200 OFF Just For You',
    body: 'It\'s been a while! 💔 Come back and enjoy ₹200 OFF on any service. Your AC needs cleaning? Tap leaking? We\'re one tap away! 🔧❤️',
    customData: { type: 'reengagement', discount: '₹200', code: 'COMEBACK200', minOrder: '299', ctaText: 'I\'m Back! 💖', ctaLink: '/offers/comeback', bgColor: '#E91E63' },
  },
];

// ─── Main tabs ───
type MainTab = 'send' | 'users' | 'providers';

export default function DirectPushCenter() {
  const [mainTab, setMainTab] = useState<MainTab>('send');

  // ─── SEND TAB STATE ───
  const [targetMode, setTargetMode] = useState<DirectPushTargetMode>('single');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [clickAction, setClickAction] = useState('');
  const [customDataText, setCustomDataText] = useState('{}');
  const [customDataError, setCustomDataError] = useState<string | null>(null);
  const [singleToken, setSingleToken] = useState('');
  const [multipleTokensText, setMultipleTokensText] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderSearchResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<ProviderSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [previewCount, setPreviewCount] = useState<PreviewCountResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<DirectPushResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<DirectPushLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyDetailId, setHistoryDetailId] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<DirectPushLog | null>(null);
  const [showJsonPreview, setShowJsonPreview] = useState(false);

  // ─── FCM BROWSER STATE ───
  const [fcmUsers, setFcmUsers] = useState<FcmUserRecord[]>([]);
  const [fcmUsersTotal, setFcmUsersTotal] = useState(0);
  const [fcmUsersPage, setFcmUsersPage] = useState(1);
  const [fcmUsersPages, setFcmUsersPages] = useState(1);
  const [fcmUsersSearch, setFcmUsersSearch] = useState('');
  const [loadingFcmUsers, setLoadingFcmUsers] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const [fcmProviders, setFcmProviders] = useState<FcmProviderRecord[]>([]);
  const [fcmProvidersTotal, setFcmProvidersTotal] = useState(0);
  const [fcmProvidersPage, setFcmProvidersPage] = useState(1);
  const [fcmProvidersPages, setFcmProvidersPages] = useState(1);
  const [fcmProvidersSearch, setFcmProvidersSearch] = useState('');
  const [loadingFcmProviders, setLoadingFcmProviders] = useState(false);

  const debouncedFcmUserSearch = useDebounce(fcmUsersSearch, 400);
  const debouncedFcmProviderSearch = useDebounce(fcmProvidersSearch, 400);

  // ─── Validate JSON ───
  useEffect(() => {
    if (!customDataText.trim() || customDataText.trim() === '{}') {
      setCustomDataError(null);
      return;
    }
    try {
      const p = JSON.parse(customDataText);
      if (typeof p !== 'object' || Array.isArray(p) || p === null) setCustomDataError('Must be a JSON object');
      else setCustomDataError(null);
    } catch (e: any) {
      setCustomDataError('Invalid JSON: ' + (e?.message || 'parse error'));
    }
  }, [customDataText]);

  // ─── Fetch preview ───
  const fetchPreview = useCallback(async () => {
    if (targetMode === 'single') {
      setPreviewCount({ targetMode: 'single', totalCount: singleToken.trim() ? 1 : 0, withTokenCount: singleToken.trim() ? 1 : 0, withoutTokenCount: 0 });
      return;
    }
    if (targetMode === 'multiple') {
      const c = multipleTokensText.split(/\r?\n/).map(t => t.trim()).filter(t => t.length > 0).length;
      setPreviewCount({ targetMode: 'multiple', totalCount: c, withTokenCount: c, withoutTokenCount: 0 });
      return;
    }
    setLoadingPreview(true);
    try {
      const extra: any = {};
      if (targetMode === 'specific_provider' && selectedProvider) extra.providerId = selectedProvider._id;
      const res = await directPushApi.previewCount(targetMode, extra);
      if (res.success) setPreviewCount(res.data);
    } catch { setPreviewCount(null); }
    finally { setLoadingPreview(false); }
  }, [targetMode, singleToken, multipleTokensText, selectedProvider]);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  // ─── Provider search ───
  useEffect(() => {
    if (targetMode !== 'specific_provider' || !debouncedSearch.trim() || debouncedSearch.length < 2) {
      setSearchResults([]);
      return;
    }
    const go = async () => {
      setSearching(true);
      try {
        const res = await directPushApi.searchProviders(debouncedSearch.trim(), 15);
        if (res.success) setSearchResults(res.data.providers);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    };
    go();
  }, [debouncedSearch, targetMode]);

  // ─── FCM Users loader ───
  const loadFcmUsers = useCallback(async (page = 1) => {
    setLoadingFcmUsers(true);
    try {
      const res = await directPushApi.listFcmUsers({ page, limit: 20, search: debouncedFcmUserSearch });
      setFcmUsers(res.users);
      setFcmUsersTotal(res.total);
      setFcmUsersPage(res.page);
      setFcmUsersPages(res.pages);
    } catch { toast.error('Failed to load users'); }
    finally { setLoadingFcmUsers(false); }
  }, [debouncedFcmUserSearch]);

  useEffect(() => { if (mainTab === 'users') loadFcmUsers(1); }, [mainTab, debouncedFcmUserSearch, loadFcmUsers]);

  // ─── FCM Providers loader ───
  const loadFcmProviders = useCallback(async (page = 1) => {
    setLoadingFcmProviders(true);
    try {
      const res = await directPushApi.listFcmProviders({ page, limit: 20, search: debouncedFcmProviderSearch });
      setFcmProviders(res.providers);
      setFcmProvidersTotal(res.total);
      setFcmProvidersPage(res.page);
      setFcmProvidersPages(res.pages);
    } catch { toast.error('Failed to load providers'); }
    finally { setLoadingFcmProviders(false); }
  }, [debouncedFcmProviderSearch]);

  useEffect(() => { if (mainTab === 'providers') loadFcmProviders(1); }, [mainTab, debouncedFcmProviderSearch, loadFcmProviders]);

  // ─── Use token from browser → switch to send tab ───
  const useTokenForSend = (token: string) => {
    setTargetMode('single');
    setSingleToken(token);
    setMainTab('send');
    toast.success('Token loaded! Fill title & body, then send.');
  };

  // ─── Build payload ───
  const buildPayload = () => {
    let customData: Record<string, string> = {};
    if (customDataText.trim() && customDataText.trim() !== '{}') {
      try {
        const parsed = JSON.parse(customDataText);
        for (const [k, v] of Object.entries(parsed)) {
          if (v === null || v === undefined) continue;
          customData[k] = typeof v === 'string' ? v : JSON.stringify(v);
        }
      } catch {
        customData = {};
      }
    }

    const payload: any = { title: title.trim(), body: body.trim(), targetMode };
    if (imageUrl.trim()) payload.imageUrl = imageUrl.trim();
    if (clickAction.trim()) payload.clickAction = clickAction.trim();
    if (Object.keys(customData).length > 0) payload.customData = customData;
    if (targetMode === 'single') payload.token = singleToken.trim();
    else if (targetMode === 'multiple') payload.tokens = multipleTokensText.split(/\r?\n/).map(t => t.trim()).filter(t => t.length > 0);
    else if (targetMode === 'specific_provider') payload.providerId = selectedProvider?._id || '';
    return payload;
  };

  // ─── Send ───
  const handleSend = async () => {
    if (!title.trim()) return toast.error('Title is required');
    if (!body.trim()) return toast.error('Body is required');
    if (customDataError) return toast.error('Fix JSON: ' + customDataError);
    const payload = buildPayload();
    if (targetMode === 'single' && !payload.token) return toast.error('Token required');
    if (targetMode === 'multiple' && (!payload.tokens || !payload.tokens.length)) return toast.error('At least one token');
    if (targetMode === 'specific_provider' && !payload.providerId) return toast.error('Select a provider');
    if (previewCount && previewCount.withTokenCount > 100) {
      if (!window.confirm(`Send to ${previewCount.withTokenCount} devices?`)) return;
    }
    setSending(true);
    setLastResult(null);
    try {
      const res = await directPushApi.send(payload);
      if (res.success) {
        setLastResult(res.data);
        toast.success(`✅ ${res.data.successCount} success · ❌ ${res.data.failureCount} failed`);
      } else {
        toast.error(safe(res.message) || 'Send failed');
      }
    } catch (e: any) {
      toast.error(safe(e.response?.data?.message) || safe(e.message) || 'Send failed');
    } finally { setSending(false); }
  };

  // ─── History ───
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await directPushApi.getHistory({ page: 1, limit: 50 });
      if (res.success) setHistory(res.data.logs);
    } catch { toast.error('Failed to load history'); }
    finally { setLoadingHistory(false); }
  }, []);
  useEffect(() => { if (showHistory) loadHistory(); }, [showHistory, loadHistory]);

  const loadHistoryDetail = async (id: string) => {
    setHistoryDetailId(id);
    setHistoryDetail(null);
    try {
      const res = await directPushApi.getHistoryDetail(id);
      if (res.success) setHistoryDetail(res.data.log);
    } catch { toast.error('Failed to load detail'); }
  };

  // ─── Apply template ───
  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setTitle(t.title);
    setBody(t.body);
    setCustomDataText(JSON.stringify(t.customData, null, 2));
    toast.success(`Template "${t.name}" applied!`);
  };

  // ─── Target modes ───
  const targetModes: { id: DirectPushTargetMode; label: string; desc: string; icon: React.ElementType; color: string }[] = [
    { id: 'single', label: 'Single Token', desc: 'One FCM device token', icon: Hash, color: 'from-indigo-500 to-blue-500' },
    { id: 'multiple', label: 'Multiple Tokens', desc: 'Paste tokens (one per line)', icon: List, color: 'from-purple-500 to-pink-500' },
    { id: 'all_providers', label: 'All Providers', desc: 'Every active provider', icon: UserCheck, color: 'from-emerald-500 to-teal-500' },
    { id: 'all_users', label: 'All Users', desc: 'Every active app user', icon: Users, color: 'from-orange-500 to-red-500' },
    { id: 'specific_provider', label: 'Specific Provider', desc: 'Search & select provider', icon: User, color: 'from-cyan-500 to-blue-500' },
  ];

  // ─── Pagination helper ───
  const Pagination = ({ page, pages, total, onPrev, onNext, label }: { page: number; pages: number; total: number; onPrev: () => void; onNext: () => void; label: string }) => (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
      <span className="text-xs text-gray-500">{total} {label} with FCM tokens</span>
      <div className="flex items-center gap-2">
        <button onClick={onPrev} disabled={page <= 1} className="p-1.5 rounded border border-gray-300 disabled:opacity-30 hover:bg-white"><ChevronLeft className="w-3.5 h-3.5" /></button>
        <span className="text-xs font-medium text-gray-700">Page {page}/{pages || 1}</span>
        <button onClick={onNext} disabled={page >= pages} className="p-1.5 rounded border border-gray-300 disabled:opacity-30 hover:bg-white"><ChevronRight className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // 🔒 SAFE FAILURE RENDERER — handles object errors properly
  // ═══════════════════════════════════════════════════════════
  const renderFailure = (f: any, idx: number) => {
    // f can be: { code, error, token, project, message, details, invalidToken, allErrors }
    // any of these fields can be string OR object
    const errorCode = safe(f?.code || f?.project || '');
    const errorMsg = safe(f?.error || f?.message || f?.details || 'Unknown error');
    const tokenStr = safe(f?.token || f?.invalidToken || '');

    return (
      <div key={idx} className="p-2 bg-red-50 border border-red-100 rounded text-[10px]">
        <p className="font-semibold text-red-700">
          {errorCode ? `${errorCode}: ` : ''}{errorMsg}
        </p>
        {tokenStr && (
          <p className="text-gray-500 truncate font-mono mt-0.5">
            {tokenStr.length > 60 ? tokenStr.substring(0, 60) + '...' : tokenStr}
          </p>
        )}
        {f?.allErrors && Array.isArray(f.allErrors) && f.allErrors.length > 0 && (
          <details className="mt-1">
            <summary className="text-[9px] text-red-600 cursor-pointer font-semibold">
              All project attempts ({f.allErrors.length})
            </summary>
            <div className="mt-1 space-y-0.5 pl-2 border-l-2 border-red-200">
              {f.allErrors.map((a: any, i: number) => (
                <p key={i} className="text-[9px] text-red-600">
                  <span className="font-semibold">{safe(a?.project || 'unknown')}:</span>{' '}
                  {safe(a?.message || a?.error || a?.code || 'failed')}
                </p>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Direct Push Center</h1>
            <p className="text-sm text-gray-500 mt-0.5">Send FCM notifications · Browse users & providers with tokens</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowHistory(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
            <History className="w-4 h-4" /> History
          </button>
          <button onClick={() => setShowJsonPreview(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
            <Code className="w-4 h-4" /> Payload
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl border border-gray-200 p-1">
        {([
          { id: 'send' as MainTab, label: 'Send Push', icon: Send, badge: null },
          { id: 'users' as MainTab, label: 'Users with Tokens', icon: Users, badge: fcmUsersTotal || null },
          { id: 'providers' as MainTab, label: 'Providers with Tokens', icon: UserCheck, badge: fcmProvidersTotal || null },
        ]).map(tab => {
          const Icon = tab.icon;
          const active = mainTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${active ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.badge ? (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ═══════ SEND TAB ═══════ */}
      {mainTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Templates */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-gray-900">Quick Templates (Swiggy-style)</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {TEMPLATES.map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <button key={i} onClick={() => applyTemplate(t)} className="p-2.5 rounded-lg border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition text-left group">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center mb-1.5`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-[11px] font-semibold text-gray-800 group-hover:text-indigo-700 leading-tight">{t.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target selector */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center"><Users className="w-4 h-4 text-indigo-600" /></div>
                <h2 className="text-base font-bold text-gray-900">Choose Target</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {targetModes.map(mode => {
                  const Icon = mode.icon;
                  const active = targetMode === mode.id;
                  return (
                    <button key={mode.id} onClick={() => setTargetMode(mode.id)}
                      className={`relative p-3 rounded-lg border-2 text-left transition-all ${active ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                      <div className="flex items-start gap-2.5">
                        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${mode.color} flex items-center justify-center shadow-sm flex-shrink-0`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold ${active ? 'text-indigo-700' : 'text-gray-900'}`}>{mode.label}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{mode.desc}</p>
                        </div>
                      </div>
                      {active && <div className="absolute top-2 right-2"><CheckCircle2 className="w-4 h-4 text-indigo-600" /></div>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target input */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              {targetMode === 'single' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">FCM Device Token</label>
                  <textarea value={singleToken} onChange={e => setSingleToken(e.target.value)} placeholder="Paste FCM registration token..." rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
                  <p className="text-xs text-gray-500 mt-1.5">{singleToken.trim() ? `Length: ${singleToken.trim().length} chars` : 'Enter a single FCM token'}</p>
                </div>
              )}
              {targetMode === 'multiple' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Multiple FCM Tokens</label>
                  <textarea value={multipleTokensText} onChange={e => setMultipleTokensText(e.target.value)} placeholder="Paste one FCM token per line..." rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
                  <p className="text-xs text-gray-500 mt-1.5">{multipleTokensText.split(/\r?\n/).filter(t => t.trim()).length} tokens parsed</p>
                </div>
              )}
              {targetMode === 'specific_provider' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Search Provider</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, phone, email..." className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                    {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
                  </div>
                  {selectedProvider && (
                    <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">{selectedProvider.name?.charAt(0) || '?'}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-indigo-900 truncate">{safe(selectedProvider.name)}</p>
                        <p className="text-xs text-indigo-700 truncate">{safe(selectedProvider.phone)} · {safe(selectedProvider.city) || '—'}</p>
                      </div>
                      {selectedProvider.hasToken ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">FCM OK</span> : <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded">NO TOKEN</span>}
                      <button onClick={() => setSelectedProvider(null)} className="p-1 text-indigo-600 hover:bg-indigo-100 rounded"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                  {!selectedProvider && searchResults.length > 0 && (
                    <div className="mt-3 border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                      {searchResults.map(p => (
                        <button key={p._id} onClick={() => { setSelectedProvider(p); setSearchQuery(''); setSearchResults([]); }} className="w-full flex items-center gap-3 p-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-left">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-xs text-gray-700">{safe(p.name)?.charAt(0) || '?'}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{safe(p.name)}</p>
                            <p className="text-xs text-gray-500 truncate">{safe(p.phone)} · {safe(p.profession) || '—'}</p>
                          </div>
                          {p.hasToken ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {(targetMode === 'all_providers' || targetMode === 'all_users') && (
                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
                  <div className="flex gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Broadcast Mode</p>
                      <p className="text-xs text-amber-700 mt-1">This sends to every {targetMode === 'all_providers' ? 'active provider' : 'active user'} with a valid FCM token.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center"><Bell className="w-4 h-4 text-purple-600" /></div>
                <h2 className="text-base font-bold text-gray-900">Notification Content</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Title <span className="text-red-500">*</span></label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="e.g. New booking available" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  <p className="text-[11px] text-gray-500 mt-1">{title.length}/120</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Body <span className="text-red-500">*</span></label>
                  <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={500} rows={3} placeholder="Notification body..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
                  <p className="text-[11px] text-gray-500 mt-1">{body.length}/500</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> Image URL (optional)</label>
                  <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/banner.jpg" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5 flex items-center gap-1.5"><LinkIcon className="w-3.5 h-3.5" /> Click Action (optional)</label>
                  <input type="text" value={clickAction} onChange={e => setClickAction(e.target.value)} placeholder="e.g. /bookings/123" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5 flex items-center gap-1.5"><Code className="w-3.5 h-3.5" /> Custom Data (JSON)</label>
                  <textarea value={customDataText} onChange={e => setCustomDataText(e.target.value)} rows={5} placeholder='{"type": "offer", "code": "SAVE50"}'
                    className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:border-transparent resize-none ${customDataError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`} />
                  {customDataError && <p className="text-[11px] text-red-600 mt-1">{safe(customDataError)}</p>}
                  <p className="text-[11px] text-gray-500 mt-1">All values auto-converted to strings for FCM</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-4">
              <div className="p-4 border-b border-gray-100 bg-gradient-to-br from-indigo-50 to-purple-50">
                <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-indigo-600" /><h3 className="text-sm font-bold text-gray-900">Live Preview</h3></div>
              </div>
              <div className="p-4 space-y-4">
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-3 shadow-lg">
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center flex-shrink-0"><Rocket className="w-4 h-4 text-white" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-gray-900 truncate">{title || 'Notification Title'}</p>
                        <p className="text-[10px] text-gray-600 line-clamp-2 mt-0.5">{body || 'Body text...'}</p>
                        {imageUrl && <div className="mt-1.5 rounded overflow-hidden bg-gray-100"><img src={imageUrl} alt="" className="w-full h-16 object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /></div>}
                        <p className="text-[9px] text-gray-400 mt-1">now · your app</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Recipients</span>
                    {loadingPreview && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                  </div>
                  {previewCount ? (
                    <div className="mt-1.5">
                      <p className="text-2xl font-black text-gray-900">{previewCount.withTokenCount.toLocaleString()}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{previewCount.totalCount === previewCount.withTokenCount ? 'All have FCM tokens' : `${previewCount.withoutTokenCount} without token`}</p>
                    </div>
                  ) : <p className="text-xs text-gray-400 mt-1">—</p>}
                </div>
                <button onClick={handleSend} disabled={sending || !title.trim() || !body.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition shadow-md">
                  {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send Push Notification</>}
                </button>
              </div>
            </div>

            {/* Last Result — uses safe() for all dynamic values */}
            {lastResult && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-indigo-600" /><h3 className="text-sm font-bold text-gray-900">Last Result</h3></div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-center"><p className="text-[10px] font-bold uppercase text-emerald-600">Success</p><p className="text-xl font-black text-emerald-700">{lastResult.successCount}</p></div>
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-center"><p className="text-[10px] font-bold uppercase text-red-600">Failed</p><p className="text-xl font-black text-red-700">{lastResult.failureCount}</p></div>
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-center"><p className="text-[10px] font-bold uppercase text-amber-600">Invalid</p><p className="text-xl font-black text-amber-700">{lastResult.invalidTokenCount}</p></div>
                </div>
                <div className="text-[11px] text-gray-500 flex items-center justify-between">
                  <span>Duration: {formatDuration(lastResult.durationMs)}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusColor(safe(lastResult.status))}`}>{safe(lastResult.status)}</span>
                </div>
                {lastResult.failures && Array.isArray(lastResult.failures) && lastResult.failures.length > 0 && (
                  <div className="mt-3 max-h-40 overflow-y-auto space-y-1">
                    {lastResult.failures.slice(0, 10).map((f: any, i: number) => renderFailure(f, i))}
                    {lastResult.failures.length > 10 && (
                      <p className="text-[9px] text-gray-500 text-center py-1">
                        ...and {lastResult.failures.length - 10} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ USERS TAB ═══════ */}
      {mainTab === 'users' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
              <h2 className="text-base font-bold text-gray-900">Users with FCM Tokens</h2>
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full">{fcmUsersTotal}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={fcmUsersSearch} onChange={e => setFcmUsersSearch(e.target.value)} placeholder="Search users..." className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-56 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <button onClick={() => loadFcmUsers(fcmUsersPage)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><RefreshCw className={`w-4 h-4 ${loadingFcmUsers ? 'animate-spin' : ''}`} /></button>
            </div>
          </div>

          {loadingFcmUsers ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : fcmUsers.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">No users with FCM tokens found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {fcmUsers.map(user => (
                <div key={user._id} className="hover:bg-gray-50 transition">
                  <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpandedUser(expandedUser === user._id ? null : user._id)}>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {user.profilePicture ? <img src={user.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" /> : (safe(user.name)?.charAt(0)?.toUpperCase() || '?')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{safe(user.name)}</p>
                      <p className="text-xs text-gray-500 truncate">{safe(user.email)} · {safe(user.phone) || '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded">
                        <Smartphone className="w-3 h-3 inline mr-0.5" />{user.tokenCount} token{user.tokenCount > 1 ? 's' : ''}
                      </span>
                      <span className="text-[10px] text-gray-400">{formatDate(user.lastLogin)}</span>
                      <ChevronRight className={`w-4 h-4 text-gray-400 transition ${expandedUser === user._id ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                  {expandedUser === user._id && (
                    <div className="px-4 pb-4 pl-16 space-y-2">
                      {user.tokens.map((t, i) => (
                        <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded uppercase">{safe(t.platform)}</span>
                              {t.deviceModel && <span className="text-[10px] text-gray-500">{safe(t.deviceModel)}</span>}
                              {t.appVersion && <span className="text-[10px] text-gray-400">v{safe(t.appVersion)}</span>}
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => copyToClipboard(t.token)} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Copy token"><Copy className="w-3.5 h-3.5" /></button>
                              <button onClick={() => useTokenForSend(t.token)} className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded hover:bg-indigo-700 transition">Send Push</button>
                            </div>
                          </div>
                          <p className="text-[10px] font-mono text-gray-600 break-all leading-relaxed">{safe(t.token)}</p>
                          <div className="flex gap-3 mt-1.5 text-[9px] text-gray-400">
                            <span>Created: {formatDate(t.createdAt)}</span>
                            <span>Last used: {formatDate(t.lastUsedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <Pagination page={fcmUsersPage} pages={fcmUsersPages} total={fcmUsersTotal} label="users" onPrev={() => loadFcmUsers(fcmUsersPage - 1)} onNext={() => loadFcmUsers(fcmUsersPage + 1)} />
        </div>
      )}

      {/* ═══════ PROVIDERS TAB ═══════ */}
      {mainTab === 'providers' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-gray-900">Providers with FCM Tokens</h2>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">{fcmProvidersTotal}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={fcmProvidersSearch} onChange={e => setFcmProvidersSearch(e.target.value)} placeholder="Search providers..." className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-56 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <button onClick={() => loadFcmProviders(fcmProvidersPage)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><RefreshCw className={`w-4 h-4 ${loadingFcmProviders ? 'animate-spin' : ''}`} /></button>
            </div>
          </div>

          {loadingFcmProviders ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : fcmProviders.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">No providers with FCM tokens found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-3 font-semibold text-gray-600 text-xs">Provider</th>
                    <th className="text-left p-3 font-semibold text-gray-600 text-xs">Profession</th>
                    <th className="text-left p-3 font-semibold text-gray-600 text-xs">City</th>
                    <th className="text-left p-3 font-semibold text-gray-600 text-xs">Status</th>
                    <th className="text-left p-3 font-semibold text-gray-600 text-xs">Last Login</th>
                    <th className="text-left p-3 font-semibold text-gray-600 text-xs">FCM Token</th>
                    <th className="text-center p-3 font-semibold text-gray-600 text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fcmProviders.map(p => (
                    <tr key={p._id} className="hover:bg-gray-50 transition">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {p.profilePicture ? <img src={p.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover" /> : (safe(p.name)?.charAt(0)?.toUpperCase() || '?')}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{safe(p.name)}</p>
                            <p className="text-[10px] text-gray-500 truncate">{safe(p.providerId)} · {safe(p.phone)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-xs text-gray-700">{safe(p.profession) || '—'}</td>
                      <td className="p-3 text-xs text-gray-700">{safe(p.city) || '—'}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {p.isOnline ? <span className="w-2 h-2 rounded-full bg-emerald-500" /> : <span className="w-2 h-2 rounded-full bg-gray-300" />}
                          <span className="text-[10px] text-gray-600">{p.isOnline ? 'Online' : 'Offline'}</span>
                        </div>
                      </td>
                      <td className="p-3 text-[10px] text-gray-500">{formatDate(p.lastLogin)}</td>
                      <td className="p-3">
                        <p className="text-[9px] font-mono text-gray-500 truncate max-w-[140px]" title={p.token}>{safe(p.token)}</p>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => copyToClipboard(p.token)} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Copy"><Copy className="w-3.5 h-3.5" /></button>
                          <button onClick={() => useTokenForSend(p.token)} className="px-2 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded hover:bg-indigo-700 transition">Send</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={fcmProvidersPage} pages={fcmProvidersPages} total={fcmProvidersTotal} label="providers" onPrev={() => loadFcmProviders(fcmProvidersPage - 1)} onNext={() => loadFcmProviders(fcmProvidersPage + 1)} />
        </div>
      )}

      {/* ═══════ HISTORY DRAWER ═══════ */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowHistory(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2"><History className="w-5 h-5 text-indigo-600" /><h2 className="text-lg font-bold text-gray-900">Push History</h2></div>
              <div className="flex gap-2">
                <button onClick={loadHistory} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"><RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} /></button>
                <button onClick={() => setShowHistory(false)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingHistory ? <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              : history.length === 0 ? <div className="p-8 text-center text-gray-500 text-sm">No history yet</div>
              : <div className="divide-y divide-gray-100">
                  {history.map(log => (
                    <button key={log._id} onClick={() => loadHistoryDetail(log._id)} className="w-full p-4 hover:bg-gray-50 text-left transition">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{safe(log.title)}</p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{safe(log.body)}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${statusColor(safe(log.status))}`}>{safe(log.status)}</span>
                            <span className="text-[10px] text-gray-500"><span className="font-bold text-emerald-600">{log.successCount}</span>/<span className="font-bold text-red-600">{log.failureCount}</span>/<span className="font-bold text-gray-700">{log.targetCount}</span></span>
                            <span className="text-[10px] text-gray-400"><Clock className="w-2.5 h-2.5 inline mr-0.5" />{formatDate(log.createdAt)}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                      </div>
                    </button>
                  ))}
                </div>}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ HISTORY DETAIL MODAL — uses safe() + renderFailure() ═══════ */}
      {historyDetailId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => { setHistoryDetailId(null); setHistoryDetail(null); }}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Push Detail</h2>
              <button onClick={() => { setHistoryDetailId(null); setHistoryDetail(null); }} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!historyDetail ? <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              : <div className="space-y-4">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{safe(historyDetail.title)}</p>
                    <p className="text-xs text-gray-600 mt-1">{safe(historyDetail.body)}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-2 bg-gray-50 rounded text-center"><p className="text-[10px] uppercase font-bold text-gray-500">Target</p><p className="text-lg font-black text-gray-900">{historyDetail.targetCount}</p></div>
                    <div className="p-2 bg-emerald-50 rounded text-center"><p className="text-[10px] uppercase font-bold text-emerald-600">Success</p><p className="text-lg font-black text-emerald-700">{historyDetail.successCount}</p></div>
                    <div className="p-2 bg-red-50 rounded text-center"><p className="text-[10px] uppercase font-bold text-red-600">Failed</p><p className="text-lg font-black text-red-700">{historyDetail.failureCount}</p></div>
                    <div className="p-2 bg-amber-50 rounded text-center"><p className="text-[10px] uppercase font-bold text-amber-600">Invalid</p><p className="text-lg font-black text-amber-700">{historyDetail.invalidTokenCount}</p></div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Mode: <span className="font-semibold text-gray-700">{safe(historyDetail.targetMode)}</span></p>
                    <p>Created: {formatDate(historyDetail.createdAt)}</p>
                    <p>Completed: {formatDate(historyDetail.completedAt)}</p>
                    <p>Duration: {formatDuration(historyDetail.durationMs)}</p>
                  </div>

                  {/* ══ FAILURES — uses renderFailure() for safe rendering ══ */}
                  {historyDetail.failures && Array.isArray(historyDetail.failures) && historyDetail.failures.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-red-700 mb-2">Failures ({historyDetail.failures.length})</h4>
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {historyDetail.failures.map((f: any, i: number) => renderFailure(f, i))}
                      </div>
                    </div>
                  )}

                  {/* Raw data for debug */}
                  <details>
                    <summary className="text-xs font-bold text-gray-500 cursor-pointer hover:text-gray-700">
                      🔧 Raw Response (debug)
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-900 text-green-400 rounded-lg text-[10px] overflow-auto max-h-64 font-mono">
                      {JSON.stringify(historyDetail, null, 2)}
                    </pre>
                  </details>
                </div>}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ JSON PREVIEW MODAL ═══════ */}
      {showJsonPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowJsonPreview(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2"><Code className="w-5 h-5 text-indigo-600" /><h2 className="text-lg font-bold text-gray-900">Request Payload</h2></div>
              <button onClick={() => setShowJsonPreview(false)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4">
              <pre className="bg-gray-900 text-emerald-300 text-xs font-mono p-4 rounded-lg overflow-auto max-h-96">{JSON.stringify(buildPayload(), null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}