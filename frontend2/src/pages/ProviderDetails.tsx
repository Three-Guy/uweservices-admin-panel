// src/pages/ProviderDetails.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { providersApi, DetailedProvider } from '../lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  ShieldOff,
  ShieldCheck,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Star,
  Briefcase,
  IndianRupee,
  Wallet,
  Lock,
  Unlock,
  Smartphone,
  Globe,
  Key,
  Activity,
  Zap,
  AlertTriangle,
  FileCheck,
  Camera,
  Image as ImageIcon,
  Edit2,
  Save,
  X,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Users as UsersIcon,
  Hash,
  Database,
  Circle,
  Package,
  Eye,
  EyeOff,
  Info,
  Ban,
  UserCheck,
  UserX,
  RotateCcw,
  History,
  Fingerprint,
  CreditCard,
  FileText,
  Settings,
  Trash2,
} from 'lucide-react';

type TabKey =
  | 'profile'
  | 'professional'
  | 'location'
  | 'verification'
  | 'wallet'
  | 'paymentLock'
  | 'state'
  | 'device'
  | 'currentBooking'
  | 'timestamps'
  | 'raw';

export default function ProviderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [provider, setProvider] = useState<DetailedProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showSelfieFullscreen, setShowSelfieFullscreen] = useState<string | null>(null);
  const [showRevealTokens, setShowRevealTokens] = useState(false);

  // Verification modal
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationChoice, setVerificationChoice] = useState<string>('approved');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verificationReason, setVerificationReason] = useState('');

  // Payment lock modal
  const [showPaymentLockModal, setShowPaymentLockModal] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [lockUnpaidAmount, setLockUnpaidAmount] = useState<number>(0);
  const [lockPendingCount, setLockPendingCount] = useState<number>(0);

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ============== FETCH PROVIDER ==============
  const fetchProvider = useCallback(
    async (showSpinner = true) => {
      // ✅ FIX: If no id, stop loading and show error instead of hanging forever
      if (!id) {
        console.warn('⚠️ No provider ID found in URL params');
        setLoading(false);
        setRefreshing(false);
        setError('No provider ID provided. Please navigate from the providers list.');
        return;
      }

      try {
        if (showSpinner) setLoading(true);
        else setRefreshing(true);
        setError(null);

        console.log('🔍 Fetching provider details for ID:', id);

        const response = await providersApi.getFullDetails(id);

        console.log('✅ Provider API response:', response);

        if (response.success && response.data?.provider) {
          setProvider(response.data.provider);
          setLastRefresh(new Date());
        } else {
          throw new Error(response.message || 'Failed to load provider');
        }
      } catch (err: any) {
        console.error('❌ Fetch provider error:', err);
        setError(
          err.response?.data?.message || err.message || 'Failed to load provider details'
        );
      } finally {
        // ✅ FIX: Always set loading to false in finally block
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    fetchProvider(true);
  }, [fetchProvider]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!autoRefresh || !id) {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      return;
    }
    refreshIntervalRef.current = setInterval(() => {
      fetchProvider(false);
    }, 30000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [autoRefresh, fetchProvider, id]);

  // ============== ACTIONS ==============
  const handleToggleField = async (
    field: 'isAvailable' | 'isAcceptingJobs' | 'isBusy' | 'isOnline' | 'isActive',
    value: boolean
  ) => {
    if (!provider) return;
    try {
      setActionLoading(field);
      if (field === 'isActive') {
        await providersApi.toggleStatus(provider._id, value);
      } else {
        await providersApi.updateAvailability(provider._id, { [field]: value });
      }
      await fetchProvider(false);
    } catch (err: any) {
      alert(err.response?.data?.message || `Failed to update ${field}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateVerification = async () => {
    if (!provider) return;
    try {
      setActionLoading('verification');
      await providersApi.updateVerification(provider._id, {
        verificationStatus: verificationChoice,
        notes: verificationNotes,
        reason: verificationReason,
      });
      setShowVerificationModal(false);
      setVerificationNotes('');
      setVerificationReason('');
      await fetchProvider(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update verification');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTogglePaymentLock = async (lock: boolean) => {
    if (!provider) return;

    if (lock) {
      // Open modal for lock reason
      setLockReason(provider.paymentLock?.reason || '');
      setLockUnpaidAmount(provider.paymentLock?.unpaidAmount || 0);
      setLockPendingCount(provider.paymentLock?.pendingTransactionCount || 0);
      setShowPaymentLockModal(true);
      return;
    }

    // Unlock immediately
    try {
      setActionLoading('paymentLock');
      await providersApi.updatePaymentLock(provider._id, { isLocked: false });
      await fetchProvider(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to unlock payments');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitPaymentLock = async () => {
    if (!provider) return;
    try {
      setActionLoading('paymentLock');
      await providersApi.updatePaymentLock(provider._id, {
        isLocked: true,
        reason: lockReason,
        unpaidAmount: lockUnpaidAmount,
        pendingTransactionCount: lockPendingCount,
      });
      setShowPaymentLockModal(false);
      await fetchProvider(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to lock payments');
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  // ============== HELPERS ==============
  const formatDateTime = (date: any) => {
    if (!date) return '—';
    try {
      return format(new Date(date), 'MMM dd, yyyy • hh:mm:ss a');
    } catch {
      return String(date);
    }
  };

  const formatRelative = (date: any) => {
    if (!date) return '—';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return '';
    }
  };

  const formatMoney = (n: any) => {
    const num = Number(n || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getRatingValue = (r: any): number => {
    if (!r) return 0;
    if (typeof r === 'number') return r;
    if (typeof r === 'object' && r.average !== undefined) return Number(r.average);
    return 0;
  };

  const getRatingCount = (r: any): number => {
    if (!r) return 0;
    if (typeof r === 'object' && r.count !== undefined) return Number(r.count);
    return 0;
  };

  const getProfileImage = (p: DetailedProvider) =>
    p.profilePicture || p.profileImage || p.profilePhoto || null;

  const getSelfieUrl = (p: DetailedProvider) => p.selfieImage?.url || null;

  // ============== LOADING STATE ==============
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-14 h-14 animate-spin text-green-600" />
          <p className="text-gray-600 dark:text-gray-300 font-semibold text-lg">
            Loading provider details...
          </p>
          {id && (
            <p className="text-gray-400 dark:text-gray-500 text-xs font-mono">
              ID: {id}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ============== ERROR STATE ==============
  if (error || !provider) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Error Loading Provider
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">{error || 'Provider not found'}</p>
          {id && (
            <p className="text-gray-400 dark:text-gray-500 text-xs font-mono mb-6">
              Attempted ID: {id}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/providers')}
              className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Back to Providers
            </button>
            <button
              onClick={() => fetchProvider(true)}
              className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const profileImg = getProfileImage(provider);
  const selfieUrl = getSelfieUrl(provider);
  const rating = getRatingValue(provider.rating);
  const ratingCount = getRatingCount(provider.rating);
  const isVerified =
    provider.verificationStatus === 'approved' || provider.verificationStatus === 'verified';
  const isPaymentLocked = !!provider.paymentLock?.isLocked;

  // ============== RENDER ==============
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* ============== TOP BAR ============== */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/providers')}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Back to Providers"
            >
              <ArrowLeft size={20} className="text-gray-700 dark:text-gray-200" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Provider Details
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Circle
                  size={6}
                  className={`fill-current ${
                    autoRefresh ? 'text-green-500 animate-pulse' : 'text-gray-400'
                  }`}
                />
                Updated {formatRelative(lastRefresh)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                autoRefresh
                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
              title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            >
              <Zap size={14} />
              {autoRefresh ? 'LIVE' : 'PAUSED'}
            </button>
            <button
              onClick={() => fetchProvider(false)}
              disabled={refreshing}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                size={18}
                className={`text-gray-700 dark:text-gray-200 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ============== HERO SECTION ============== */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
              {/* Images Row */}
              <div className="flex gap-4 items-center">
                {/* Profile Picture */}
                <div className="relative group">
                  <div
                    onClick={() => profileImg && setShowSelfieFullscreen(profileImg)}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/20 backdrop-blur-sm border-4 border-white/30 overflow-hidden shadow-xl cursor-pointer hover:scale-105 transition-transform"
                  >
                    {profileImg ? (
                      <img
                        src={profileImg}
                        alt={provider.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">
                        {provider.name?.[0]?.toUpperCase() || 'P'}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-white dark:bg-gray-800 rounded-full shadow text-[10px] font-bold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                    Profile
                  </div>
                </div>

                {/* Selfie */}
                <div className="relative group">
                  <div
                    onClick={() => selfieUrl && setShowSelfieFullscreen(selfieUrl)}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/20 backdrop-blur-sm border-4 border-white/30 overflow-hidden shadow-xl cursor-pointer hover:scale-105 transition-transform"
                  >
                    {selfieUrl ? (
                      <img src={selfieUrl} alt="Selfie" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/60">
                        <Camera size={32} />
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-white dark:bg-gray-800 rounded-full shadow text-[10px] font-bold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                    Selfie
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 text-white min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold flex items-center gap-1">
                    <Hash size={12} />
                    {provider.providerId || provider._id?.slice(-8)}
                  </span>
                  {isVerified && (
                    <span className="px-3 py-1 bg-blue-500/90 rounded-full text-xs font-bold flex items-center gap-1">
                      <ShieldCheck size={12} />
                      VERIFIED
                    </span>
                  )}
                  {provider.isBlocked && (
                    <span className="px-3 py-1 bg-red-500/90 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse">
                      <Ban size={12} />
                      BLOCKED
                    </span>
                  )}
                  {isPaymentLocked && (
                    <span className="px-3 py-1 bg-orange-500/90 rounded-full text-xs font-bold flex items-center gap-1">
                      <Lock size={12} />
                      PAYMENTS LOCKED
                    </span>
                  )}
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold mb-1 truncate">
                  {provider.name || 'Unnamed Provider'}
                </h2>
                <p className="text-white/80 text-sm mb-3 flex items-center gap-2 flex-wrap">
                  <Briefcase size={14} />
                  {provider.profession || 'No profession'}
                  {provider.categoryName && (
                    <>
                      <span>•</span>
                      {provider.categoryName}
                    </>
                  )}
                </p>

                {/* Live Status Dots */}
                <div className="flex flex-wrap gap-2">
                  <StatusDot
                    label={provider.isOnline ? 'Online' : 'Offline'}
                    active={!!provider.isOnline}
                    color={provider.isOnline ? 'bg-green-400' : 'bg-gray-400'}
                  />
                  <StatusDot
                    label={provider.isAvailable ? 'Available' : 'Unavailable'}
                    active={!!provider.isAvailable}
                    color={provider.isAvailable ? 'bg-emerald-400' : 'bg-gray-400'}
                  />
                  <StatusDot
                    label={provider.isAcceptingJobs ? 'Accepting Jobs' : 'Not Accepting'}
                    active={!!provider.isAcceptingJobs}
                    color={provider.isAcceptingJobs ? 'bg-blue-400' : 'bg-gray-400'}
                  />
                  <StatusDot
                    label={provider.isBusy ? 'Busy' : 'Free'}
                    active={!!provider.isBusy}
                    color={provider.isBusy ? 'bg-orange-400' : 'bg-gray-400'}
                  />
                  <StatusDot
                    label={provider.isActive ? 'Active' : 'Inactive'}
                    active={!!provider.isActive}
                    color={provider.isActive ? 'bg-cyan-400' : 'bg-red-400'}
                  />
                </div>
              </div>

              {/* Quick Metrics */}
              <div className="grid grid-cols-2 gap-3 lg:min-w-[280px]">
                <QuickMetric
                  icon={<Star size={18} className="fill-yellow-300 text-yellow-300" />}
                  label="Rating"
                  value={rating.toFixed(1)}
                  sub={`${ratingCount} reviews`}
                />
                <QuickMetric
                  icon={<CheckCircle size={18} className="text-green-200" />}
                  label="Jobs Done"
                  value={String(provider.completedJobs || provider.completedBookings || 0)}
                  sub={`${provider.totalBookings || 0} total`}
                />
                <QuickMetric
                  icon={<Wallet size={18} className="text-amber-200" />}
                  label="Wallet"
                  value={formatMoney(provider.wallet?.balance || provider.walletBalance || 0)}
                  sub=""
                />
                <QuickMetric
                  icon={<TrendingUp size={18} className="text-emerald-200" />}
                  label="Earnings"
                  value={formatMoney(
                    provider.wallet?.totalEarnings || provider.totalEarnings || 0
                  )}
                  sub=""
                />
              </div>
            </div>
          </div>
        </div>

        {/* ============== STATUS CONTROL CARDS ============== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Availability Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                <Activity size={18} />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Availability Controls</h3>
            </div>
            <div className="space-y-2">
              <ToggleRow
                label="Active Account"
                value={!!provider.isActive}
                loading={actionLoading === 'isActive'}
                onToggle={(v) => handleToggleField('isActive', v)}
                disabled={!!provider.isBlocked}
              />
              <ToggleRow
                label="Available"
                value={!!provider.isAvailable}
                loading={actionLoading === 'isAvailable'}
                onToggle={(v) => handleToggleField('isAvailable', v)}
                disabled={!!provider.isBlocked}
              />
              <ToggleRow
                label="Accepting Jobs"
                value={!!provider.isAcceptingJobs}
                loading={actionLoading === 'isAcceptingJobs'}
                onToggle={(v) => handleToggleField('isAcceptingJobs', v)}
                disabled={!!provider.isBlocked}
              />
              <ToggleRow
                label="Busy"
                value={!!provider.isBusy}
                loading={actionLoading === 'isBusy'}
                onToggle={(v) => handleToggleField('isBusy', v)}
                disabled={!!provider.isBlocked}
              />
              <ToggleRow
                label="Online"
                value={!!provider.isOnline}
                loading={actionLoading === 'isOnline'}
                onToggle={(v) => handleToggleField('isOnline', v)}
                disabled={!!provider.isBlocked}
              />
            </div>
          </div>

          {/* Verification Control */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
                <ShieldCheck size={18} />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Verification Status</h3>
            </div>

            <div className="mb-4">
              <VerificationBadge status={provider.verificationStatus || 'pending'} />
            </div>

            {provider.verifiedAt && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                ✅ Verified: {formatDateTime(provider.verifiedAt)}
              </p>
            )}
            {provider.rejectedAt && (
              <p className="text-xs text-red-500 mb-1">
                ❌ Rejected: {formatDateTime(provider.rejectedAt)}
              </p>
            )}
            {provider.rejectionReason && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-2 italic">
                "{provider.rejectionReason}"
              </p>
            )}
            {provider.verificationNotes && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 italic">
                📝 {provider.verificationNotes}
              </p>
            )}

            <button
              onClick={() => {
                setVerificationChoice(provider.verificationStatus || 'approved');
                setShowVerificationModal(true);
              }}
              className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-shadow flex items-center justify-center gap-2"
            >
              <Edit2 size={14} />
              Change Verification
            </button>
          </div>

          {/* Payment Lock Control */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <div
                className={`p-2 rounded-xl bg-gradient-to-br text-white ${
                  isPaymentLocked ? 'from-red-500 to-orange-500' : 'from-green-500 to-emerald-500'
                }`}
              >
                {isPaymentLocked ? <Lock size={18} /> : <Unlock size={18} />}
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Payment Lock</h3>
            </div>

            <div className="mb-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                  isPaymentLocked
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                    : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                }`}
              >
                {isPaymentLocked ? <Lock size={12} /> : <Unlock size={12} />}
                {isPaymentLocked ? 'LOCKED' : 'UNLOCKED'}
              </span>
            </div>

            {isPaymentLocked && (
              <>
                {provider.paymentLock?.reason && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 italic">
                    "{provider.paymentLock.reason}"
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold uppercase">
                      Unpaid
                    </p>
                    <p className="text-sm font-bold text-orange-900 dark:text-orange-200">
                      {formatMoney(provider.paymentLock?.unpaidAmount)}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                    <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold uppercase">
                      Pending
                    </p>
                    <p className="text-sm font-bold text-red-900 dark:text-red-200">
                      {provider.paymentLock?.pendingTransactionCount || 0}
                    </p>
                  </div>
                </div>
              </>
            )}

            <button
              onClick={() => handleTogglePaymentLock(!isPaymentLocked)}
              disabled={actionLoading === 'paymentLock'}
              className={`w-full py-2.5 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-shadow flex items-center justify-center gap-2 disabled:opacity-50 ${
                isPaymentLocked
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                  : 'bg-gradient-to-r from-red-500 to-orange-500'
              }`}
            >
              {actionLoading === 'paymentLock' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : isPaymentLocked ? (
                <>
                  <Unlock size={14} />
                  Unlock Payments
                </>
              ) : (
                <>
                  <Lock size={14} />
                  Lock Payments
                </>
              )}
            </button>
          </div>
        </div>

        {/* ============== TABS ============== */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Tab Headers */}
          <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            <div className="flex gap-1 p-2 min-w-max">
              <TabBtn active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<User size={14} />} label="Profile" />
              <TabBtn active={activeTab === 'professional'} onClick={() => setActiveTab('professional')} icon={<Briefcase size={14} />} label="Professional" />
              <TabBtn active={activeTab === 'location'} onClick={() => setActiveTab('location')} icon={<MapPin size={14} />} label="Location" />
              <TabBtn active={activeTab === 'verification'} onClick={() => setActiveTab('verification')} icon={<FileCheck size={14} />} label="Verification" />
              <TabBtn active={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} icon={<Wallet size={14} />} label="Wallet" />
              <TabBtn active={activeTab === 'paymentLock'} onClick={() => setActiveTab('paymentLock')} icon={<Lock size={14} />} label="Payment Lock" />
              <TabBtn active={activeTab === 'state'} onClick={() => setActiveTab('state')} icon={<Database size={14} />} label="State & Sync" />
              <TabBtn active={activeTab === 'device'} onClick={() => setActiveTab('device')} icon={<Smartphone size={14} />} label="Device" />
              <TabBtn active={activeTab === 'currentBooking'} onClick={() => setActiveTab('currentBooking')} icon={<Package size={14} />} label="Current Booking" />
              <TabBtn active={activeTab === 'timestamps'} onClick={() => setActiveTab('timestamps')} icon={<Clock size={14} />} label="Timestamps" />
              <TabBtn active={activeTab === 'raw'} onClick={() => setActiveTab('raw')} icon={<FileText size={14} />} label="Raw JSON" />
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'profile' && (
              <ProfileTab provider={provider} copy={copyToClipboard} copied={copied} />
            )}
            {activeTab === 'professional' && (
              <ProfessionalTab provider={provider} rating={rating} ratingCount={ratingCount} />
            )}
            {activeTab === 'location' && <LocationTab provider={provider} />}
            {activeTab === 'verification' && (
              <VerificationTab provider={provider} formatDateTime={formatDateTime} />
            )}
            {activeTab === 'wallet' && (
              <WalletTab provider={provider} formatMoney={formatMoney} />
            )}
            {activeTab === 'paymentLock' && (
              <PaymentLockTab
                provider={provider}
                formatMoney={formatMoney}
                formatDateTime={formatDateTime}
              />
            )}
            {activeTab === 'state' && (
              <StateTab
                provider={provider}
                formatDateTime={formatDateTime}
                formatRelative={formatRelative}
              />
            )}
            {activeTab === 'device' && (
              <DeviceTab
                provider={provider}
                formatDateTime={formatDateTime}
                formatRelative={formatRelative}
                showRevealTokens={showRevealTokens}
                setShowRevealTokens={setShowRevealTokens}
                copy={copyToClipboard}
                copied={copied}
              />
            )}
            {activeTab === 'currentBooking' && <CurrentBookingTab provider={provider} />}
            {activeTab === 'timestamps' && (
              <TimestampsTab
                provider={provider}
                formatDateTime={formatDateTime}
                formatRelative={formatRelative}
              />
            )}
            {activeTab === 'raw' && (
              <RawJsonTab provider={provider} copy={copyToClipboard} copied={copied} />
            )}
          </div>
        </div>
      </div>

      {/* ============== VERIFICATION MODAL ============== */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowVerificationModal(false)}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ShieldCheck size={20} />
                  Update Verification
                </h3>
                <button
                  onClick={() => setShowVerificationModal(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  New Status
                </label>
                <select
                  value={verificationChoice}
                  onChange={(e) => setVerificationChoice(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                  <option value="incomplete">Incomplete</option>
                </select>
              </div>

              {verificationChoice === 'rejected' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                    Rejection Reason *
                  </label>
                  <textarea
                    value={verificationReason}
                    onChange={(e) => setVerificationReason(e.target.value)}
                    placeholder="Why is this provider being rejected?"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-red-500 resize-none h-24"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20"
                />
              </div>
            </div>
            <div className="p-5 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setShowVerificationModal(false)}
                disabled={actionLoading === 'verification'}
                className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateVerification}
                disabled={
                  actionLoading === 'verification' ||
                  (verificationChoice === 'rejected' && !verificationReason.trim())
                }
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === 'verification' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <Save size={16} />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============== PAYMENT LOCK MODAL ============== */}
      {showPaymentLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPaymentLockModal(false)}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-red-500 to-orange-500 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Lock size={20} />
                  Lock Provider Payments
                </h3>
                <button
                  onClick={() => setShowPaymentLockModal(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 flex gap-2">
                <AlertTriangle
                  size={18}
                  className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Provider will not be able to receive payments or complete transactions until
                  unlocked.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Lock Reason *
                </label>
                <textarea
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  placeholder="Why are payments being locked?"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-red-500 resize-none h-24"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                    Unpaid Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={lockUnpaidAmount}
                    onChange={(e) => setLockUnpaidAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                    Pending Count
                  </label>
                  <input
                    type="number"
                    value={lockPendingCount}
                    onChange={(e) => setLockPendingCount(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-5 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setShowPaymentLockModal(false)}
                disabled={actionLoading === 'paymentLock'}
                className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPaymentLock}
                disabled={actionLoading === 'paymentLock' || !lockReason.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === 'paymentLock' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <Lock size={16} />
                    Lock Payments
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============== IMAGE FULLSCREEN ============== */}
      {showSelfieFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowSelfieFullscreen(null)}
        >
          <button
            onClick={() => setShowSelfieFullscreen(null)}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X size={24} />
          </button>
          <img
            src={showSelfieFullscreen}
            alt="Fullscreen"
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}

// ========================================================================
// ==================== HELPER COMPONENTS ==================================
// ========================================================================

function StatusDot({
  label,
  active,
  color,
}: {
  label: string;
  active: boolean;
  color: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-xs font-semibold text-white">
      <span className={`w-2 h-2 rounded-full ${color} ${active ? 'animate-pulse' : ''}`} />
      {label}
    </div>
  );
}

function QuickMetric({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white/15 backdrop-blur-md rounded-xl p-3 border border-white/20">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-lg font-bold text-white truncate">{value}</p>
      {sub && <p className="text-[10px] text-white/70">{sub}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  value,
  loading,
  onToggle,
  disabled,
}: {
  label: string;
  value: boolean;
  loading: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <button
        onClick={() => onToggle(!value)}
        disabled={loading || disabled}
        className="disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={22} className="animate-spin text-gray-400" />
        ) : value ? (
          <ToggleRight size={28} className="text-green-500" />
        ) : (
          <ToggleLeft size={28} className="text-gray-400" />
        )}
      </button>
    </div>
  );
}

function VerificationBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    approved: {
      bg: 'bg-green-100 dark:bg-green-900/40',
      text: 'text-green-700 dark:text-green-300',
      icon: <CheckCircle size={14} />,
      label: 'Approved',
    },
    verified: {
      bg: 'bg-emerald-100 dark:bg-emerald-900/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      icon: <ShieldCheck size={14} />,
      label: 'Verified',
    },
    pending: {
      bg: 'bg-amber-100 dark:bg-amber-900/40',
      text: 'text-amber-700 dark:text-amber-300',
      icon: <Clock size={14} />,
      label: 'Pending',
    },
    rejected: {
      bg: 'bg-red-100 dark:bg-red-900/40',
      text: 'text-red-700 dark:text-red-300',
      icon: <XCircle size={14} />,
      label: 'Rejected',
    },
    incomplete: {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-700 dark:text-gray-300',
      icon: <Info size={14} />,
      label: 'Incomplete',
    },
  };
  const cfg = map[status] || map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${cfg.bg} ${cfg.text}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
        active
          ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Field({
  label,
  value,
  icon,
  copyKey,
  copy,
  copied,
  mono,
}: {
  label: string;
  value: any;
  icon?: React.ReactNode;
  copyKey?: string;
  copy?: (text: string, key: string) => void;
  copied?: string | null;
  mono?: boolean;
}) {
  const displayValue =
    value === null || value === undefined || value === '' ? '—' : String(value);
  const canCopy = copy && copyKey && displayValue !== '—';

  return (
    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-1.5 mb-1">
            {icon}
            {label}
          </p>
          <p
            className={`text-sm font-semibold text-gray-900 dark:text-white break-all ${
              mono ? 'font-mono' : ''
            }`}
          >
            {displayValue}
          </p>
        </div>
        {canCopy && (
          <button
            onClick={() => copy!(displayValue, copyKey!)}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-600 transition-colors"
            title="Copy"
          >
            {copied === copyKey ? (
              <Check size={14} className="text-green-600" />
            ) : (
              <Copy size={14} className="text-gray-400" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function BooleanBadge({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
          value
            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
        }`}
      >
        {value ? <CheckCircle size={12} /> : <XCircle size={12} />}
        {value ? 'YES' : 'NO'}
      </span>
    </div>
  );
}

// ========================================================================
// ==================== TAB COMPONENTS =====================================
// ========================================================================

function ProfileTab({
  provider,
  copy,
  copied,
}: {
  provider: DetailedProvider;
  copy: (text: string, key: string) => void;
  copied: string | null;
}) {
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <User size={18} />
        Basic Information
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Full Name" value={provider.name} icon={<User size={12} />} copyKey="name" copy={copy} copied={copied} />
        <Field label="Email" value={provider.email} icon={<Mail size={12} />} copyKey="email" copy={copy} copied={copied} />
        <Field label="Phone" value={provider.phone} icon={<Phone size={12} />} copyKey="phone" copy={copy} copied={copied} />
        <Field label="Gender" value={provider.gender} icon={<UsersIcon size={12} />} />
        <Field label="Date of Birth" value={provider.dateOfBirth} icon={<Calendar size={12} />} />
        <Field label="Provider ID" value={provider.providerId} icon={<Hash size={12} />} copyKey="pid" copy={copy} copied={copied} mono />
        <Field label="MongoDB _id" value={provider._id} icon={<Database size={12} />} copyKey="mid" copy={copy} copied={copied} mono />
        <Field label="Auth Provider" value={provider.authProvider} icon={<Key size={12} />} />
        <Field label="Google ID" value={provider.googleId} icon={<Globe size={12} />} mono />
      </div>

      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 pt-4">
        <CheckCircle size={18} />
        Verification Flags
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BooleanBadge label="Profile Complete" value={!!provider.isProfileComplete} />
        <BooleanBadge label="Email Verified" value={!!provider.emailVerified} />
        <BooleanBadge label="Phone Verified" value={!!provider.phoneVerified} />
        <BooleanBadge label="Is Verified" value={!!provider.isVerified} />
      </div>
    </div>
  );
}

function ProfessionalTab({
  provider,
  rating,
  ratingCount,
}: {
  provider: DetailedProvider;
  rating: number;
  ratingCount: number;
}) {
  const services: string[] = Array.isArray(provider.services) ? provider.services : [];

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Briefcase size={18} />
        Professional Info
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Profession" value={provider.profession} icon={<Briefcase size={12} />} />
        <Field label="Category" value={provider.categoryName} icon={<Package size={12} />} />
        <Field label="Category ID" value={provider.categoryId} icon={<Hash size={12} />} mono />
        <Field
          label="Service Radius"
          value={provider.serviceRadius ? `${provider.serviceRadius} km` : '—'}
          icon={<MapPin size={12} />}
        />
      </div>

      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 pt-4">
        <Star size={18} />
        Performance
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800">
          <Star size={20} className="fill-amber-500 text-amber-500 mb-2" />
          <p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">Rating</p>
          <p className="text-xl font-bold text-amber-900 dark:text-amber-100">{rating.toFixed(1)}</p>
          <p className="text-[10px] text-amber-600 dark:text-amber-400">{ratingCount} reviews</p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800">
          <CheckCircle size={20} className="text-green-600 mb-2" />
          <p className="text-[10px] font-bold uppercase text-green-700 dark:text-green-300">Completed</p>
          <p className="text-xl font-bold text-green-900 dark:text-green-100">
            {provider.completedJobs || provider.completedBookings || 0}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800">
          <Package size={20} className="text-blue-600 mb-2" />
          <p className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-300">Total Bookings</p>
          <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
            {provider.totalBookings || 0}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800">
          <XCircle size={20} className="text-red-600 mb-2" />
          <p className="text-[10px] font-bold uppercase text-red-700 dark:text-red-300">Cancelled</p>
          <p className="text-xl font-bold text-red-900 dark:text-red-100">
            {provider.cancelledBookings || 0}
          </p>
        </div>
      </div>

      {services.length > 0 && (
        <>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 pt-4">
            <Settings size={18} />
            Services Offered ({services.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {services.map((s, i) => (
              <span
                key={i}
                className="px-3 py-1.5 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 text-green-700 dark:text-green-300 rounded-full text-xs font-semibold"
              >
                {s}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LocationTab({ provider }: { provider: DetailedProvider }) {
  const coords = provider.location?.coordinates || [];
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <MapPin size={18} />
        Location Details
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="City" value={provider.city} icon={<MapPin size={12} />} />
        <Field label="City ID" value={provider.cityId} icon={<Hash size={12} />} mono />
        <Field
          label="Service Radius"
          value={provider.serviceRadius ? `${provider.serviceRadius} km` : '—'}
          icon={<Globe size={12} />}
        />
        <Field label="Location Type" value={provider.location?.type} icon={<MapPin size={12} />} />
        <Field label="Latitude" value={coords[1] ?? '—'} icon={<MapPin size={12} />} mono />
        <Field label="Longitude" value={coords[0] ?? '—'} icon={<MapPin size={12} />} mono />
        {provider.location?.address && (
          <div className="md:col-span-2">
            <Field label="Address" value={provider.location.address} icon={<MapPin size={12} />} />
          </div>
        )}
      </div>

      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 pt-4">
        <Globe size={18} />
        City Service Status
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BooleanBadge label="City Service Available" value={!!provider.isCityServiceAvailable} />
        <BooleanBadge label="City Notification Requested" value={!!provider.cityNotificationRequested} />
      </div>

      {coords.length === 2 && (
        <a
          href={`https://www.google.com/maps?q=${coords[1]},${coords[0]}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-shadow"
        >
          <MapPin size={16} />
          Open in Google Maps
        </a>
      )}
    </div>
  );
}

function VerificationTab({
  provider,
  formatDateTime,
}: {
  provider: DetailedProvider;
  formatDateTime: (d: any) => string;
}) {
  const selfieUrl = provider.selfieImage?.url;
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <FileCheck size={18} />
        Verification Status
      </h3>

      <div className="flex items-center gap-3 flex-wrap">
        <VerificationBadge status={provider.verificationStatus || 'pending'} />
        {provider.isVerified && (
          <span className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold flex items-center gap-1">
            <ShieldCheck size={12} />
            isVerified = true
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Verified At" value={formatDateTime(provider.verifiedAt)} icon={<CheckCircle size={12} />} />
        <Field label="Verified By" value={provider.verifiedBy} icon={<User size={12} />} mono />
        <Field label="Rejected At" value={formatDateTime(provider.rejectedAt)} icon={<XCircle size={12} />} />
        <Field label="Rejected By" value={provider.rejectedBy} icon={<User size={12} />} mono />
      </div>

      {provider.verificationNotes && (
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
          <p className="text-xs font-bold uppercase text-blue-700 dark:text-blue-300 mb-1">
            📝 Verification Notes
          </p>
          <p className="text-sm text-blue-900 dark:text-blue-200">{provider.verificationNotes}</p>
        </div>
      )}

      {provider.rejectionReason && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
          <p className="text-xs font-bold uppercase text-red-700 dark:text-red-300 mb-1">
            ❌ Rejection Reason
          </p>
          <p className="text-sm text-red-900 dark:text-red-200">{provider.rejectionReason}</p>
        </div>
      )}

      {selfieUrl && (
        <>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 pt-4">
            <Camera size={18} />
            Selfie Verification Image
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl overflow-hidden shadow-lg border-2 border-gray-200 dark:border-gray-700">
              <img src={selfieUrl} alt="Selfie" className="w-full h-auto" />
            </div>
            <div className="space-y-3">
              <Field label="Public ID" value={provider.selfieImage?.publicId} icon={<Hash size={12} />} mono />
              <Field label="Uploaded At" value={formatDateTime(provider.selfieImage?.uploadedAt)} icon={<Clock size={12} />} />
              <a
                href={selfieUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors"
              >
                <Eye size={14} />
                Open Full Size
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WalletTab({
  provider,
  formatMoney,
}: {
  provider: DetailedProvider;
  formatMoney: (n: any) => string;
}) {
  const balance = provider.wallet?.balance ?? provider.walletBalance ?? 0;
  const totalEarnings = provider.wallet?.totalEarnings ?? provider.totalEarnings ?? 0;
  const todayEarnings = provider.todayEarnings ?? 0;

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Wallet size={18} />
        Wallet & Earnings
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
          <Wallet size={24} className="mb-3 relative" />
          <p className="text-xs font-bold uppercase opacity-90">Current Balance</p>
          <p className="text-3xl font-bold mt-1">{formatMoney(balance)}</p>
        </div>
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
          <TrendingUp size={24} className="mb-3 relative" />
          <p className="text-xs font-bold uppercase opacity-90">Total Earnings</p>
          <p className="text-3xl font-bold mt-1">{formatMoney(totalEarnings)}</p>
        </div>
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
          <IndianRupee size={24} className="mb-3 relative" />
          <p className="text-xs font-bold uppercase opacity-90">Today's Earnings</p>
          <p className="text-3xl font-bold mt-1">{formatMoney(todayEarnings)}</p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
        <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">
          Raw Wallet Object
        </p>
        <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
          {JSON.stringify(provider.wallet || {}, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function PaymentLockTab({
  provider,
  formatMoney,
  formatDateTime,
}: {
  provider: DetailedProvider;
  formatMoney: (n: any) => string;
  formatDateTime: (d: any) => string;
}) {
  const lock = provider.paymentLock || {};
  const isLocked = !!lock.isLocked;

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
        {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
        Payment Lock Details
      </h3>

      <div
        className={`p-5 rounded-2xl ${
          isLocked
            ? 'bg-gradient-to-br from-red-500 to-orange-500'
            : 'bg-gradient-to-br from-green-500 to-emerald-500'
        } text-white shadow-lg`}
      >
        <div className="flex items-center gap-3 mb-2">
          {isLocked ? <Lock size={28} /> : <Unlock size={28} />}
          <div>
            <p className="text-xl font-bold">
              {isLocked ? 'PAYMENTS LOCKED' : 'PAYMENTS UNLOCKED'}
            </p>
            <p className="text-sm opacity-90">
              {isLocked
                ? 'Provider cannot receive payments'
                : 'Provider can receive payments normally'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Unpaid Amount" value={formatMoney(lock.unpaidAmount)} icon={<IndianRupee size={12} />} />
        <Field label="Pending Transactions" value={lock.pendingTransactionCount ?? 0} icon={<CreditCard size={12} />} />
        <Field label="Locked At" value={formatDateTime(lock.lockedAt)} icon={<Lock size={12} />} />
        <Field label="Unlocked At" value={formatDateTime(lock.unlockedAt)} icon={<Unlock size={12} />} />
        <Field label="Last Checked At" value={formatDateTime(lock.lastCheckedAt)} icon={<Clock size={12} />} />
        <Field label="Last Transaction ID" value={lock.lastTransactionId} icon={<Hash size={12} />} mono />
        <Field label="Last Modified By" value={lock.lastModifiedBy} icon={<User size={12} />} mono />
      </div>

      {lock.reason && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
          <p className="text-xs font-bold uppercase text-amber-700 dark:text-amber-300 mb-1">
            🔒 Lock Reason
          </p>
          <p className="text-sm text-amber-900 dark:text-amber-200">{lock.reason}</p>
        </div>
      )}

      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
        <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">
          Raw PaymentLock Object
        </p>
        <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
          {JSON.stringify(lock, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function StateTab({
  provider,
  formatDateTime,
  formatRelative,
}: {
  provider: DetailedProvider;
  formatDateTime: (d: any) => string;
  formatRelative: (d: any) => string;
}) {
  const preLock = provider.preOnlineLockState || {};
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Database size={18} />
        State & Sync
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="State Version" value={provider.stateVersion} icon={<Hash size={12} />} />
        <Field
          label="Last State Sync"
          value={`${formatDateTime(provider.lastStateSyncAt)} (${formatRelative(provider.lastStateSyncAt)})`}
          icon={<Clock size={12} />}
        />
      </div>

      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 pt-4">
        <Activity size={18} />
        Pre-Online Lock State
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <BooleanBadge label="Was Available" value={!!preLock.isAvailable} />
        <BooleanBadge label="Was Accepting Jobs" value={!!preLock.isAcceptingJobs} />
        <Field label="Saved At" value={formatDateTime(preLock.savedAt)} icon={<Clock size={12} />} />
      </div>

      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
        <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">
          Raw preOnlineLockState Object
        </p>
        <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
          {JSON.stringify(preLock, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function DeviceTab({
  provider,
  formatDateTime,
  formatRelative,
  showRevealTokens,
  setShowRevealTokens,
  copy,
  copied,
}: {
  provider: DetailedProvider;
  formatDateTime: (d: any) => string;
  formatRelative: (d: any) => string;
  showRevealTokens: boolean;
  setShowRevealTokens: (v: boolean) => void;
  copy: (text: string, key: string) => void;
  copied: string | null;
}) {
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Smartphone size={18} />
        Device & Session
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field
          label="Last Login"
          value={`${formatDateTime(provider.lastLogin)} (${formatRelative(provider.lastLogin)})`}
          icon={<Clock size={12} />}
        />
        <Field
          label="Last Online At"
          value={`${formatDateTime(provider.lastOnlineAt)} (${formatRelative(provider.lastOnlineAt)})`}
          icon={<Activity size={12} />}
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <h4 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Fingerprint size={16} />
          Sensitive Tokens
        </h4>
        <button
          onClick={() => setShowRevealTokens(!showRevealTokens)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {showRevealTokens ? <EyeOff size={14} /> : <Eye size={14} />}
          {showRevealTokens ? 'Hide' : 'Show'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Field
          label="FCM Token (masked by backend)"
          value={
            showRevealTokens
              ? provider.fcmToken
              : provider.fcmToken
              ? '•••••••••••••••'
              : '—'
          }
          icon={<Smartphone size={12} />}
          copyKey="fcm"
          copy={copy}
          copied={copied}
          mono
        />
        <Field
          label="Refresh Token (masked by backend)"
          value={
            showRevealTokens
              ? provider.refreshToken
              : provider.refreshToken
              ? '•••••••••••••••'
              : '—'
          }
          icon={<Key size={12} />}
          copyKey="rt"
          copy={copy}
          copied={copied}
          mono
        />
      </div>

      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 flex gap-2">
        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Tokens are already masked by the backend for security. Only partial characters are shown.
        </p>
      </div>
    </div>
  );
}

function CurrentBookingTab({ provider }: { provider: DetailedProvider }) {
  const bookingId = provider.currentBookingId;

  if (!bookingId) {
    return (
      <div className="text-center py-12">
        <Package size={56} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No Active Booking</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This provider is not currently assigned to any booking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Package size={18} />
        Current Active Booking
      </h3>

      <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-bold uppercase opacity-90 mb-1">Booking ID</p>
            <p className="text-2xl font-bold font-mono">{bookingId}</p>
          </div>
          <Link
            to="/bookings"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-blue-600 rounded-xl text-sm font-bold hover:shadow-lg transition-shadow"
          >
            <Eye size={16} />
            View in Bookings
          </Link>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 flex gap-2">
        <Info size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Open the Bookings Manager to view full details, OTP, customer info, and payment status
          for this booking.
        </p>
      </div>
    </div>
  );
}

function TimestampsTab({
  provider,
  formatDateTime,
  formatRelative,
}: {
  provider: DetailedProvider;
  formatDateTime: (d: any) => string;
  formatRelative: (d: any) => string;
}) {
  const rows: { label: string; date: any; icon: React.ReactNode; color: string }[] = [
    { label: 'Created', date: provider.createdAt, icon: <Calendar size={14} />, color: 'from-green-500 to-emerald-500' },
    { label: 'Last Updated', date: provider.updatedAt, icon: <Edit2 size={14} />, color: 'from-blue-500 to-indigo-500' },
    { label: 'Last Login', date: provider.lastLogin, icon: <Key size={14} />, color: 'from-purple-500 to-pink-500' },
    { label: 'Last Online', date: provider.lastOnlineAt, icon: <Activity size={14} />, color: 'from-cyan-500 to-teal-500' },
    { label: 'Verified At', date: provider.verifiedAt, icon: <CheckCircle size={14} />, color: 'from-green-500 to-emerald-500' },
    { label: 'Rejected At', date: provider.rejectedAt, icon: <XCircle size={14} />, color: 'from-red-500 to-orange-500' },
    { label: 'Blocked At', date: provider.blockedAt, icon: <Ban size={14} />, color: 'from-red-500 to-pink-500' },
    { label: 'Deleted At', date: provider.deletedAt, icon: <Trash2 size={14} />, color: 'from-gray-500 to-slate-500' },
    { label: 'Restored At', date: provider.restoredAt, icon: <RotateCcw size={14} />, color: 'from-emerald-500 to-green-500' },
    { label: 'State Sync', date: provider.lastStateSyncAt, icon: <Database size={14} />, color: 'from-indigo-500 to-blue-500' },
  ].filter((r) => r.date);

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Clock size={18} />
        Timeline
      </h3>

      {rows.length === 0 ? (
        <div className="text-center py-12">
          <Clock size={56} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No timestamp data available.</p>
        </div>
      ) : (
        <div className="relative pl-8 space-y-4">
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-400 via-blue-400 to-purple-400" />
          {rows.map((row, i) => (
            <div key={i} className="relative">
              <div
                className={`absolute -left-6 top-2 w-5 h-5 rounded-full bg-gradient-to-br ${row.color} shadow-lg flex items-center justify-center`}
              >
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-1">
                  {row.icon}
                  <p className="font-bold text-gray-900 dark:text-white">{row.label}</p>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {formatDateTime(row.date)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {formatRelative(row.date)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RawJsonTab({
  provider,
  copy,
  copied,
}: {
  provider: DetailedProvider;
  copy: (text: string, key: string) => void;
  copied: string | null;
}) {
  const json = JSON.stringify(provider, null, 2);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText size={18} />
          Raw Provider JSON
        </h3>
        <button
          onClick={() => copy(json, 'raw')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {copied === 'raw' ? (
            <Check size={14} className="text-green-600" />
          ) : (
            <Copy size={14} />
          )}
          {copied === 'raw' ? 'Copied!' : 'Copy JSON'}
        </button>
      </div>
      <pre className="p-4 bg-gray-900 text-green-300 rounded-xl text-xs overflow-x-auto max-h-[600px] overflow-y-auto font-mono shadow-inner">
        {json}
      </pre>
    </div>
  );
}