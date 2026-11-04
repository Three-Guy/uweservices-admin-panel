import { useEffect, useMemo, useState } from 'react';
import {
  Send,
  RefreshCw,
  Users,
  User,
  Smartphone,
  Image as ImageIcon,
  Link as LinkIcon,
  Code2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Search,
  History,
  X,
  Copy,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../lib/api';

type TargetMode =
  | 'single'
  | 'multiple'
  | 'all_providers'
  | 'all_users'
  | 'specific_provider';

interface SearchProvider {
  _id: string;
  name: string;
  email: string;
  phone: string;
  providerId: string;
  profession: string;
  isActive: boolean;
  hasFcmToken: boolean;
  tokenPreview: string;
}

interface HistoryItem {
  _id: string;
  title: string;
  body: string;
  targetMode: string;
  targetCount: number;
  successCount: number;
  failureCount: number;
  status: string;
  durationMs: number;
  createdAt: string;
  sentBy?: { email?: string; name?: string };
}

interface SendResult {
  logId: string;
  targetMode: string;
  targetCount: number;
  successCount: number;
  failureCount: number;
  invalidTokenCount: number;
  durationMs: number;
  status: string;
  failures: Array<{
    tokenPreview: string;
    recipientLabel?: string;
    errorCode: string;
    errorMessage: string;
  }>;
  successes: Array<{
    tokenPreview: string;
    recipientLabel?: string;
    messageId: string;
  }>;
}

export default function DirectPushCenter() {
  // Form state
  const [targetMode, setTargetMode] = useState<TargetMode>('single');
  const [singleToken, setSingleToken] = useState('');
  const [multipleTokens, setMultipleTokens] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<SearchProvider | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [clickAction, setClickAction] = useState('');
  const [customDataText, setCustomDataText] = useState('{}');
  const [customDataError, setCustomDataError] = useState('');

  // UI state
  const [sending, setSending] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Search providers
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchProvider[]>([]);
  const [searching, setSearching] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // ---------------- Preview count ----------------
  const fetchPreviewCount = async () => {
    setLoadingCount(true);
    try {
      const params: any = { targetMode };
      if (targetMode === 'specific_provider' && selectedProvider) {
        params.providerIds = selectedProvider._id;
      }
      const res = await apiClient.get('/v1/admin/direct-push/preview-count', { params });
      if (res.data?.success) {
        setPreviewCount(res.data.data.tokenCount);
      }
    } catch (e: any) {
      setPreviewCount(null);
    } finally {
      setLoadingCount(false);
    }
  };

  useEffect(() => {
    if (targetMode === 'single' || targetMode === 'multiple') {
      // Count comes from local parsing
      if (targetMode === 'single') {
        setPreviewCount(singleToken.trim() ? 1 : 0);
      } else {
        const list = multipleTokens
          .split(/[\n,;\s]+/)
          .map(s => s.trim())
          .filter(Boolean);
        setPreviewCount(new Set(list).size);
      }
      return;
    }
    if (targetMode === 'specific_provider') {
      setPreviewCount(selectedProvider?.hasFcmToken ? 1 : 0);
      return;
    }
    fetchPreviewCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMode, singleToken, multipleTokens, selectedProvider]);

  // ---------------- Custom data validation ----------------
  useEffect(() => {
    if (!customDataText.trim()) {
      setCustomDataError('');
      return;
    }
    try {
      const parsed = JSON.parse(customDataText);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setCustomDataError('Must be a JSON object');
      } else {
        setCustomDataError('');
      }
    } catch {
      setCustomDataError('Invalid JSON');
    }
  }, [customDataText]);

  // ---------------- Search providers ----------------
  useEffect(() => {
    if (targetMode !== 'specific_provider') return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiClient.get('/v1/admin/direct-push/search-providers', {
          params: { q: searchQuery, limit: 20 },
        });
        if (res.data?.success) {
          setSearchResults(res.data.data.providers);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, targetMode]);

  // ---------------- History ----------------
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiClient.get('/v1/admin/direct-push/history', {
        params: { page: 1, limit: 25 },
      });
      if (res.data?.success) {
        setHistory(res.data.data.items);
      }
    } catch {
      /* noop */
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory]);

  // ---------------- Validation ----------------
  const canSend = useMemo(() => {
    if (!title.trim() || !body.trim()) return false;
    if (customDataError) return false;
    if (targetMode === 'single' && !singleToken.trim()) return false;
    if (targetMode === 'multiple' && !multipleTokens.trim()) return false;
    if (targetMode === 'specific_provider' && !selectedProvider) return false;
    if ((previewCount ?? 0) === 0) return false;
    return true;
  }, [title, body, customDataError, targetMode, singleToken, multipleTokens, selectedProvider, previewCount]);

  // ---------------- Send ----------------
  const handleSend = async () => {
    if (!canSend) return;
    if (!confirm(`Send push to ${previewCount} recipient(s)?`)) return;

    setSending(true);
    setResult(null);
    try {
      const payload: any = {
        targetMode,
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl.trim() || undefined,
        clickAction: clickAction.trim() || undefined,
        customData: customDataText.trim() ? JSON.parse(customDataText) : {},
      };

      if (targetMode === 'single') payload.token = singleToken.trim();
      if (targetMode === 'multiple') {
        payload.tokens = multipleTokens
          .split(/[\n,;\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (targetMode === 'specific_provider' && selectedProvider) {
        payload.providerIds = [selectedProvider._id];
      }

      const res = await apiClient.post('/v1/admin/direct-push/send', payload);
      if (res.data?.success) {
        setResult(res.data.data);
        toast.success(
          `Sent: ${res.data.data.successCount} ✓  Failed: ${res.data.data.failureCount}`
        );
      } else {
        toast.error(res.data?.message || 'Send failed');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  // ---------------- UI helpers ----------------
  const copyToClipboard = (txt: string) => {
    navigator.clipboard.writeText(txt).then(() => toast.success('Copied'));
  };

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // ---------------- Render ----------------
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Send className="w-6 h-6 text-indigo-600" />
            Direct Push Notification
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Send FCM push directly to tokens or user groups
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-semibold text-gray-700"
          >
            <History className="w-4 h-4" /> History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ============ LEFT: FORM ============ */}
        <div className="lg:col-span-2 space-y-5">
          {/* Target selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">1. Target Audience</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { v: 'single', label: 'Single Token', icon: Smartphone },
                { v: 'multiple', label: 'Multiple Tokens', icon: Code2 },
                { v: 'specific_provider', label: 'Find Provider', icon: Search },
                { v: 'all_providers', label: 'All Providers', icon: Users },
                { v: 'all_users', label: 'All Users', icon: User },
              ].map((opt) => {
                const Ic = opt.icon;
                const active = targetMode === opt.v;
                return (
                  <button
                    key={opt.v}
                    onClick={() => {
                      setTargetMode(opt.v as TargetMode);
                      setResult(null);
                    }}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg text-xs font-semibold transition-all border ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <Ic className="w-4 h-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Mode-specific inputs */}
            <div className="mt-4">
              {targetMode === 'single' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    FCM Token
                  </label>
                  <input
                    type="text"
                    value={singleToken}
                    onChange={(e) => setSingleToken(e.target.value)}
                    placeholder="Paste FCM registration token..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>
              )}

              {targetMode === 'multiple' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    FCM Tokens (one per line, or comma-separated)
                  </label>
                  <textarea
                    value={multipleTokens}
                    onChange={(e) => setMultipleTokens(e.target.value)}
                    rows={6}
                    placeholder={'token1\ntoken2\ntoken3'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono"
                  />
                </div>
              )}

              {targetMode === 'specific_provider' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Search Provider (by name, email, phone, or ID)
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Type to search..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  {selectedProvider && (
                    <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {selectedProvider.name}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {selectedProvider.email} · {selectedProvider.phone}
                        </p>
                        {!selectedProvider.hasFcmToken && (
                          <p className="text-[10px] text-red-600 font-semibold mt-1">
                            ⚠ No FCM token
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedProvider(null)}
                        className="p-1.5 text-gray-500 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {!selectedProvider && (
                    <div className="mt-2 max-h-56 overflow-y-auto border border-gray-200 rounded-lg">
                      {searching && (
                        <div className="p-3 text-center text-xs text-gray-500">
                          <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                        </div>
                      )}
                      {!searching && searchResults.length === 0 && (
                        <div className="p-4 text-center text-xs text-gray-500">
                          No providers found
                        </div>
                      )}
                      {!searching &&
                        searchResults.map((p) => (
                          <button
                            key={p._id}
                            onClick={() => setSelectedProvider(p)}
                            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 border-b border-gray-100 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {p.name}
                              </p>
                              <p className="text-[11px] text-gray-500 truncate">
                                {p.email} · {p.phone}
                              </p>
                            </div>
                            <span
                              className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                p.hasFcmToken
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-gray-200 text-gray-600'
                              }`}
                            >
                              {p.hasFcmToken ? 'FCM OK' : 'NO FCM'}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {(targetMode === 'all_providers' || targetMode === 'all_users') && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    This will send push to <b>every active {targetMode === 'all_providers' ? 'provider' : 'user'}</b> with an FCM token.
                  </p>
                </div>
              )}
            </div>

            {/* Count */}
            <div className="mt-3 flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
              <span className="text-xs font-semibold text-gray-700">Recipients:</span>
              <span className="text-sm font-black text-indigo-700">
                {loadingCount ? (
                  <RefreshCw className="w-3 h-3 animate-spin inline" />
                ) : (
                  (previewCount ?? 0).toLocaleString()
                )}
              </span>
            </div>
          </div>

          {/* Message content */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">2. Notification Content</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. New Offer!"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-[10px] text-gray-500 mt-0.5">{title.length}/200</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Body *</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="Your message..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-[10px] text-gray-500 mt-0.5">{body.length}/2000</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> Image URL (optional)
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" /> Click Action URL (optional)
                </label>
                <input
                  type="text"
                  value={clickAction}
                  onChange={(e) => setClickAction(e.target.value)}
                  placeholder="/bookings or https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Code2 className="w-3 h-3" /> Custom Data (JSON object)
                </label>
                <textarea
                  value={customDataText}
                  onChange={(e) => setCustomDataText(e.target.value)}
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-lg text-xs font-mono ${
                    customDataError ? 'border-red-400' : 'border-gray-300'
                  }`}
                  placeholder='{"type": "promo", "id": "123"}'
                />
                {customDataError && (
                  <p className="text-[10px] text-red-600 mt-0.5">{customDataError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
            <button
              onClick={() => setShowPreview(true)}
              disabled={!title.trim() || !body.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-semibold text-gray-700 disabled:opacity-40"
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
            <button
              onClick={handleSend}
              disabled={!canSend || sending}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-md disabled:opacity-40"
            >
              {sending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Send Push ({previewCount ?? 0})
                </>
              )}
            </button>
          </div>
        </div>

        {/* ============ RIGHT: PREVIEW + RESULT ============ */}
        <div className="space-y-5">
          {/* Live preview */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-600" /> Live Preview
            </h3>
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4">
              <div className="bg-white rounded-lg p-3 shadow-lg">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Send className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 truncate">
                      {title || 'Notification Title'}
                    </p>
                    <p className="text-[11px] text-gray-600 line-clamp-3 mt-0.5">
                      {body || 'Your message will appear here.'}
                    </p>
                    {imageUrl && (
                      <img
                        src={imageUrl}
                        alt=""
                        className="mt-2 rounded w-full max-h-32 object-cover"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                      />
                    )}
                    <p className="text-[9px] text-gray-400 mt-1">now · Your App</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Delivery Report</h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="p-2 bg-emerald-50 rounded-lg text-center">
                  <p className="text-xl font-black text-emerald-700">{result.successCount}</p>
                  <p className="text-[9px] text-emerald-800 font-semibold uppercase">Success</p>
                </div>
                <div className="p-2 bg-red-50 rounded-lg text-center">
                  <p className="text-xl font-black text-red-700">{result.failureCount}</p>
                  <p className="text-[9px] text-red-800 font-semibold uppercase">Failed</p>
                </div>
                <div className="p-2 bg-amber-50 rounded-lg text-center">
                  <p className="text-xl font-black text-amber-700">{result.invalidTokenCount}</p>
                  <p className="text-[9px] text-amber-800 font-semibold uppercase">Invalid</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 mb-3">
                <span>Took {formatMs(result.durationMs)}</span>
                <span className="font-semibold">{result.status}</span>
              </div>

              {result.failures.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-bold text-gray-700 mb-1">
                    Failures (first {result.failures.length})
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {result.failures.map((f, i) => (
                      <div key={i} className="p-2 bg-red-50 rounded border border-red-100 text-[10px]">
                        <p className="font-mono text-gray-700 truncate">
                          {f.recipientLabel || f.tokenPreview}
                        </p>
                        <p className="text-red-700 font-semibold">{f.errorCode}</p>
                        <p className="text-gray-600 line-clamp-2">{f.errorMessage}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============ HISTORY DRAWER ============ */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowHistory(false)} />
          <div className="relative w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" /> Push History
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {loadingHistory && (
                <div className="p-10 text-center text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
                </div>
              )}
              {!loadingHistory && history.length === 0 && (
                <div className="p-10 text-center text-gray-500">
                  <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p>No push history yet</p>
                </div>
              )}
              {!loadingHistory &&
                history.map((h) => (
                  <div
                    key={h._id}
                    className="p-3 border border-gray-200 rounded-lg mb-2 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 truncate">{h.title}</p>
                        <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{h.body}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px]">
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded font-bold uppercase">
                            {h.targetMode.replace(/_/g, ' ')}
                          </span>
                          <span className="text-emerald-700 font-bold">✓ {h.successCount}</span>
                          <span className="text-red-700 font-bold">✗ {h.failureCount}</span>
                          <span className="text-gray-500">{new Date(h.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          h.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : h.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {h.status}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ============ PREVIEW MODAL ============ */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl max-w-md w-full p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">Preview Payload</h3>
              <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-gray-900 text-emerald-300 rounded-lg p-3 max-h-96 overflow-auto">
              <pre className="text-[11px] font-mono whitespace-pre-wrap">
                {JSON.stringify(
                  {
                    targetMode,
                    title,
                    body,
                    imageUrl: imageUrl || undefined,
                    clickAction: clickAction || undefined,
                    customData: customDataError ? customDataText : JSON.parse(customDataText || '{}'),
                  },
                  null,
                  2
                )}
              </pre>
            </div>
            <button
              onClick={() =>
                copyToClipboard(
                  JSON.stringify(
                    {
                      targetMode,
                      title,
                      body,
                      imageUrl,
                      clickAction,
                      customData: customDataText,
                    },
                    null,
                    2
                  )
                )
              }
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold"
            >
              <Copy className="w-4 h-4" /> Copy JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}