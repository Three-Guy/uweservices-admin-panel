import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { verificationsApi, type ProviderVerification, type VerificationStats, type VerificationStatus } from '../../lib/api';
import {
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  Download,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ExternalLink,
  X,
  CheckSquare,
  Square,
  RotateCcw,
  Eye as EyeIcon,
  History,
  TrendingUp,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

// ==================== MAIN COMPONENT ====================
export default function VerificationModule() {
  const [verifications, setVerifications] = useState<ProviderVerification[]>([]);
  const [stats, setStats] = useState<VerificationStats>({
    pending: 0,
    underReview: 0,
    approved: 0,
    rejected: 0,
    resubmission: 0,
    total: 0,
    todayCount: 0,
    weekCount: 0,
    pendingTotal: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedVerification, setSelectedVerification] = useState<ProviderVerification | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [bulkRejectMode, setBulkRejectMode] = useState(false);

  // Resubmission modal
  const [showResubmitModal, setShowResubmitModal] = useState(false);
  const [resubmitReason, setResubmitReason] = useState('');
  const [resubmitTargetId, setResubmitTargetId] = useState<string | null>(null);

  // ==================== FETCH DATA ====================
  const fetchVerifications = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const params: any = {
          page,
          limit: 20,
          sortBy,
          sortOrder,
        };
        if (statusFilter !== 'all') params.status = statusFilter;
        if (searchQuery.trim()) params.search = searchQuery.trim();

        const response = await verificationsApi.getAll(params);

        if (response.success) {
          setVerifications(response.data.verifications || []);
          if (response.data.pagination) {
            setTotalPages(response.data.pagination.totalPages || 1);
          }
        } else {
          setError('Failed to fetch verifications');
        }
      } catch (err: any) {
        console.error('❌ Failed to fetch verifications:', err);
        setError(err.response?.data?.message || err.message || 'Failed to fetch verifications');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter, searchQuery, page, sortBy, sortOrder]
  );

  const fetchStats = useCallback(async () => {
    try {
      const response = await verificationsApi.getStats();
      if (response.success) setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // ==================== EFFECTS ====================
  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [statusFilter, searchQuery]);

  // Clear selections on page change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  // ==================== ACTIONS ====================
  const handleApprove = async (id: string, notes?: string) => {
    try {
      setActionLoading(true);
      const response = await verificationsApi.approve(id, notes);
      if (response.success) {
        setShowModal(false);
        setSelectedVerification(null);
        await Promise.all([fetchVerifications(true), fetchStats()]);
        showToast('✅ Verification approved successfully!', 'success');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to approve verification', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = (id: string | null, isBulk = false) => {
    setRejectTargetId(id);
    setBulkRejectMode(isBulk);
    setRejectReason('');
    setRejectNotes('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      showToast('Rejection reason is required', 'error');
      return;
    }

    try {
      setActionLoading(true);
      if (bulkRejectMode) {
        const ids = Array.from(selectedIds);
        const response = await verificationsApi.bulkReject(ids, rejectReason.trim());
        if (response.success) {
          showToast(
            `${response.data.rejected?.length || 0} rejected, ${response.data.failed?.length || 0} failed`,
            'success'
          );
          setSelectedIds(new Set());
        }
      } else if (rejectTargetId) {
        const response = await verificationsApi.reject(rejectTargetId, rejectReason.trim(), rejectNotes.trim());
        if (response.success) {
          showToast('✅ Verification rejected', 'success');
          setShowModal(false);
          setSelectedVerification(null);
        }
      }
      setShowRejectModal(false);
      await Promise.all([fetchVerifications(true), fetchStats()]);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to reject', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openResubmitModal = (id: string) => {
    setResubmitTargetId(id);
    setResubmitReason('');
    setShowResubmitModal(true);
  };

  const handleResubmitSubmit = async () => {
    if (!resubmitReason.trim() || !resubmitTargetId) {
      showToast('Reason is required', 'error');
      return;
    }

    try {
      setActionLoading(true);
      const response = await verificationsApi.requestResubmission(resubmitTargetId, resubmitReason.trim());
      if (response.success) {
        showToast('✅ Resubmission requested', 'success');
        setShowResubmitModal(false);
        setShowModal(false);
        setSelectedVerification(null);
        await Promise.all([fetchVerifications(true), fetchStats()]);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to request resubmission', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkUnderReview = async (id: string) => {
    try {
      setActionLoading(true);
      const response = await verificationsApi.markUnderReview(id);
      if (response.success) {
        showToast('✅ Marked under review', 'success');
        await Promise.all([fetchVerifications(true), fetchStats()]);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to mark under review', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) {
      showToast('Select verifications first', 'error');
      return;
    }
    if (!window.confirm(`Approve ${selectedIds.size} verifications?`)) return;

    try {
      setBulkActionLoading(true);
      const ids = Array.from(selectedIds);
      const response = await verificationsApi.bulkApprove(ids);
      if (response.success) {
        showToast(
          `${response.data.approved?.length || 0} approved, ${response.data.failed?.length || 0} failed`,
          'success'
        );
        setSelectedIds(new Set());
        await Promise.all([fetchVerifications(true), fetchStats()]);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Bulk approve failed', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchVerifications(true), fetchStats()]);
  };

  // ==================== BULK SELECTION ====================
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pendingVerifications = verifications.filter((v) =>
      ['pending', 'under_review'].includes(v.status)
    );
    if (selectedIds.size === pendingVerifications.length && pendingVerifications.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingVerifications.map((v) => v._id)));
    }
  };

  // ==================== TOAST ====================
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ==================== RENDER ====================
  if (loading && verifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-gray-500 font-medium">Loading verifications...</p>
      </div>
    );
  }

  const selectablePendingCount = verifications.filter((v) =>
    ['pending', 'under_review'].includes(v.status)
  ).length;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              'fixed top-6 right-6 z-[300] px-6 py-4 rounded-xl shadow-2xl font-bold text-white',
              toast.type === 'success' && 'bg-green-600',
              toast.type === 'error' && 'bg-red-600',
              toast.type === 'info' && 'bg-indigo-600'
            )}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-gray-900">Provider Verifications</h1>
          <p className="text-gray-500 mt-1 font-medium">
            Review, approve or reject service provider documents
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold transition-all hover:bg-gray-50',
            refreshing && 'opacity-50 cursor-not-allowed'
          )}
        >
          <RefreshCw size={16} className={cn(refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={() => fetchVerifications()}
            className="ml-auto px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-bold hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={<FileText size={22} />} label="Total" value={stats.total} color="bg-blue-100 text-blue-600" />
        <StatCard
          icon={<Clock size={22} />}
          label="Pending"
          value={stats.pendingTotal}
          color="bg-amber-100 text-amber-600"
          highlight={stats.pendingTotal > 0}
        />
        <StatCard
          icon={<EyeIcon size={22} />}
          label="Under Review"
          value={stats.underReview}
          color="bg-cyan-100 text-cyan-600"
        />
        <StatCard
          icon={<CheckCircle2 size={22} />}
          label="Approved"
          value={stats.approved}
          color="bg-green-100 text-green-600"
        />
        <StatCard
          icon={<XCircle size={22} />}
          label="Rejected"
          value={stats.rejected}
          color="bg-red-100 text-red-600"
        />
        <StatCard
          icon={<RotateCcw size={22} />}
          label="Resubmission"
          value={stats.resubmission}
          color="bg-purple-100 text-purple-600"
        />
      </div>

      {/* Quick metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <TrendingUp size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Today</p>
            <p className="text-2xl font-black text-gray-900">{stats.todayCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Activity size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">This Week</p>
            <p className="text-2xl font-black text-gray-900">{stats.weekCount}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by name, email, phone, PPL ID, or verification ID..."
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select
              className="bg-gray-50 text-gray-700 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All ({stats.total})</option>
              <option value="pending">Pending ({stats.pending})</option>
              <option value="under_review">Under Review ({stats.underReview})</option>
              <option value="approved">Approved ({stats.approved})</option>
              <option value="rejected">Rejected ({stats.rejected})</option>
              <option value="resubmission_required">Resubmission ({stats.resubmission})</option>
            </select>
          </div>

          <select
            className="bg-gray-50 text-gray-700 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split(':');
              setSortBy(sb);
              setSortOrder(so as 'asc' | 'desc');
            }}
          >
            <option value="createdAt:desc">Newest First</option>
            <option value="createdAt:asc">Oldest First</option>
            <option value="submittedAt:desc">Recently Submitted</option>
            <option value="reviewedAt:desc">Recently Reviewed</option>
          </select>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between"
        >
          <p className="text-sm font-bold text-indigo-900">
            {selectedIds.size} verification(s) selected
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100"
            >
              Clear
            </button>
            <button
              onClick={() => openRejectModal(null, true)}
              disabled={bulkActionLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              <XCircle size={14} /> Bulk Reject
            </button>
            <button
              onClick={handleBulkApprove}
              disabled={bulkActionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {bulkActionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Bulk Approve
            </button>
          </div>
        </motion.div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 w-10">
                  {selectablePendingCount > 0 && (
                    <button onClick={toggleSelectAll} className="text-gray-500 hover:text-indigo-600">
                      {selectedIds.size === selectablePendingCount && selectablePendingCount > 0 ? (
                        <CheckSquare size={18} />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  )}
                </th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">ID</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Provider</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Documents</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Status</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Attempts</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Submitted</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {verifications.map((v) => (
                <VerificationRow
                  key={v._id}
                  verification={v}
                  isSelected={selectedIds.has(v._id)}
                  onToggleSelect={() => toggleSelect(v._id)}
                  onReview={() => {
                    setSelectedVerification(v);
                    setShowModal(true);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>

        {verifications.length === 0 && !loading && (
          <div className="text-center py-16">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-bold">No verifications found</p>
            <p className="text-gray-400 text-sm mt-1">
              {searchQuery ? `No results for "${searchQuery}"` : 'No verification requests yet'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-xl border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="px-4 py-2 text-sm font-bold">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-xl border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Review Modal */}
      <VerificationModal
        verification={selectedVerification}
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedVerification(null);
        }}
        onApprove={(id) => handleApprove(id)}
        onReject={(id) => openRejectModal(id, false)}
        onRequestResubmission={(id) => openResubmitModal(id)}
        onMarkUnderReview={(id) => handleMarkUnderReview(id)}
        actionLoading={actionLoading}
      />

      {/* Reject Modal */}
      <RejectModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onSubmit={handleRejectSubmit}
        reason={rejectReason}
        setReason={setRejectReason}
        notes={rejectNotes}
        setNotes={setRejectNotes}
        actionLoading={actionLoading}
        isBulk={bulkRejectMode}
        bulkCount={selectedIds.size}
      />

      {/* Resubmission Modal */}
      <ResubmissionModal
        isOpen={showResubmitModal}
        onClose={() => setShowResubmitModal(false)}
        onSubmit={handleResubmitSubmit}
        reason={resubmitReason}
        setReason={setResubmitReason}
        actionLoading={actionLoading}
      />
    </div>
  );
}

// ==================== STAT CARD ====================
function StatCard({ icon, label, value, color, highlight }: any) {
  return (
    <div
      className={cn(
        'bg-white p-4 rounded-2xl border shadow-sm flex items-center gap-3',
        highlight ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-200'
      )}
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">{label}</p>
        <h4 className="text-xl font-black text-gray-900">{value}</h4>
      </div>
    </div>
  );
}

// ==================== VERIFICATION ROW ====================
function VerificationRow({
  verification,
  isSelected,
  onToggleSelect,
  onReview,
}: {
  verification: ProviderVerification;
  isSelected: boolean;
  onToggleSelect: () => void;
  onReview: () => void;
}) {
  const isPending = ['pending', 'under_review'].includes(verification.status);
  const docs = verification.documents || {};
  const hasAnyDoc = docs.selfie?.url || docs.panCard?.url || docs.aadhaarFront?.url || docs.aadhaarBack?.url;

  return (
    <tr className={cn('hover:bg-gray-50 transition-colors', isSelected && 'bg-indigo-50/50')}>
      <td className="px-6 py-4">
        {isPending && (
          <button onClick={onToggleSelect} className="text-gray-400 hover:text-indigo-600">
            {isSelected ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} />}
          </button>
        )}
      </td>
      <td className="px-6 py-4">
        <p className="font-bold text-gray-900 text-xs font-mono">{verification.verificationId}</p>
      </td>

      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {verification.provider?.profilePicture ? (
            <img
              src={verification.provider.profilePicture}
              alt={verification.provider.name}
              className="w-10 h-10 rounded-xl object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
              {verification.provider?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          <div>
            <p className="font-bold text-gray-900">{verification.provider?.name || 'Unknown'}</p>
            <p className="text-xs text-gray-500">{verification.provider?.email || 'N/A'}</p>
            <p className="text-xs text-gray-500">
              {verification.provider?.phone || 'N/A'}
              {verification.provider?.providerId && (
                <span className="ml-2 font-mono text-indigo-600">#{verification.provider.providerId}</span>
              )}
            </p>
          </div>
        </div>
      </td>

      <td className="px-6 py-4">
        <div className="flex items-center gap-1.5">
          <DocBadge icon={<User size={14} />} present={!!docs.selfie?.url} title="Selfie" color="green" />
          <DocBadge icon={<FileText size={14} />} present={!!docs.panCard?.url} title="PAN" color="purple" />
          <DocBadge icon={<FileText size={14} />} present={!!docs.aadhaarFront?.url} title="Aadhaar Front" color="blue" />
          <DocBadge icon={<FileText size={14} />} present={!!docs.aadhaarBack?.url} title="Aadhaar Back" color="indigo" />
          {!hasAnyDoc && <span className="text-xs text-gray-400">No documents</span>}
        </div>
      </td>

      <td className="px-6 py-4">
        <StatusBadge status={verification.status} />
      </td>

      <td className="px-6 py-4">
        <span className="text-xs font-bold text-gray-600">#{verification.attempts || 1}</span>
      </td>

      <td className="px-6 py-4">
        <p className="text-xs text-gray-600">
          {verification.createdAt ? format(new Date(verification.createdAt), 'MMM dd, yyyy') : 'N/A'}
        </p>
        <p className="text-xs text-gray-400">
          {verification.createdAt ? format(new Date(verification.createdAt), 'hh:mm a') : ''}
        </p>
      </td>

      <td className="px-6 py-4 text-right">
        <button
          onClick={onReview}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all inline-flex items-center gap-1.5"
        >
          <Eye size={14} />
          Review
        </button>
      </td>
    </tr>
  );
}

// ==================== DOC BADGE ====================
function DocBadge({ icon, present, title, color }: any) {
  const colors: any = {
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    blue: 'bg-blue-100 text-blue-600',
    indigo: 'bg-indigo-100 text-indigo-600',
  };
  if (!present) {
    return (
      <div
        className="w-7 h-7 bg-gray-100 text-gray-300 rounded-lg flex items-center justify-center"
        title={`${title} (Missing)`}
      >
        {icon}
      </div>
    );
  }
  return (
    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', colors[color])} title={title}>
      {icon}
    </div>
  );
}

// ==================== STATUS BADGE ====================
function StatusBadge({ status }: { status: VerificationStatus }) {
  const config: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    under_review: { label: 'Under Review', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    approved: { label: 'Approved', cls: 'bg-green-50 text-green-700 border-green-200' },
    rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200' },
    resubmission_required: { label: 'Resubmit', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border', c.cls)}>
      {c.label}
    </span>
  );
}

// ==================== VERIFICATION MODAL ====================
function VerificationModal({
  verification,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onRequestResubmission,
  onMarkUnderReview,
  actionLoading,
}: {
  verification: ProviderVerification | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRequestResubmission: (id: string) => void;
  onMarkUnderReview: (id: string) => void;
  actionLoading: boolean;
}) {
  const [imagePreview, setImagePreview] = useState<{ url: string; title: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  if (!verification) return null;

  const isPending = ['pending', 'under_review'].includes(verification.status);
  const docs = verification.documents || {};

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50 sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="text-xl font-black text-gray-900">Review Verification</h3>
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    {verification.verificationId} · Attempt #{verification.attempts || 1}
                  </p>
                </div>
                <StatusBadge status={verification.status} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-2 hover:bg-gray-200 rounded-xl transition-colors"
                  title="View history"
                >
                  <History size={20} className="text-gray-600" />
                </button>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
                  <X size={24} className="text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Provider Info */}
              <div>
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Provider Information
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl">
                  <InfoField label="Name" value={verification.provider?.name} />
                  <InfoField label="Provider ID" value={verification.provider?.providerId} mono />
                  <InfoField label="Email" value={verification.provider?.email} />
                  <InfoField label="Phone" value={verification.provider?.phone} />
                  <InfoField label="Profession" value={verification.provider?.profession} />
                  <InfoField label="City" value={verification.provider?.city} />
                </div>
              </div>

              {/* History */}
              {showHistory && verification.statusHistory && verification.statusHistory.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                    Status History
                  </h4>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    {verification.statusHistory
                      .slice()
                      .reverse()
                      .map((h, idx) => (
                        <div key={idx} className="flex items-start gap-3 pb-3 border-b border-gray-200 last:border-0">
                          <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <StatusBadge status={h.status as VerificationStatus} />
                              <span className="text-xs text-gray-400">
                                {h.changedAt ? format(new Date(h.changedAt), 'MMM dd, yyyy hh:mm a') : ''}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">By: {h.changedByName || 'System'}</p>
                            {h.reason && <p className="text-xs text-red-600 mt-1">Reason: {h.reason}</p>}
                            {h.notes && <p className="text-xs text-gray-500 mt-1">Notes: {h.notes}</p>}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Documents */}
              <div>
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Submitted Documents
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {docs.selfie?.url && (
                    <DocumentCard
                      title="Selfie"
                      url={docs.selfie.url}
                      uploadedAt={docs.selfie.uploadedAt || verification.createdAt}
                      onZoom={() => setImagePreview({ url: docs.selfie!.url, title: 'Selfie' })}
                    />
                  )}
                  {docs.panCard?.url && (
                    <DocumentCard
                      title="PAN Card"
                      url={docs.panCard.url}
                      uploadedAt={docs.panCard.uploadedAt || verification.createdAt}
                      onZoom={() => setImagePreview({ url: docs.panCard!.url, title: 'PAN Card' })}
                    />
                  )}
                  {docs.aadhaarFront?.url && (
                    <DocumentCard
                      title="Aadhaar Front"
                      url={docs.aadhaarFront.url}
                      uploadedAt={docs.aadhaarFront.uploadedAt || verification.createdAt}
                      onZoom={() => setImagePreview({ url: docs.aadhaarFront!.url, title: 'Aadhaar Front' })}
                    />
                  )}
                  {docs.aadhaarBack?.url && (
                    <DocumentCard
                      title="Aadhaar Back"
                      url={docs.aadhaarBack.url}
                      uploadedAt={docs.aadhaarBack.uploadedAt || verification.createdAt}
                      onZoom={() => setImagePreview({ url: docs.aadhaarBack!.url, title: 'Aadhaar Back' })}
                    />
                  )}
                </div>

                {!docs.selfie?.url && !docs.panCard?.url && !docs.aadhaarFront?.url && !docs.aadhaarBack?.url && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-amber-700 font-medium">No documents uploaded</p>
                  </div>
                )}
              </div>

              {/* Document numbers */}
              {(verification.documentNumbers?.panNumber || verification.documentNumbers?.aadhaarNumber) && (
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                    Document Numbers
                  </h4>
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                    <InfoField label="PAN Number" value={verification.documentNumbers?.panNumber} mono />
                    <InfoField label="Aadhaar Number" value={verification.documentNumbers?.aadhaarNumber} mono />
                  </div>
                </div>
              )}

              {/* Rejection reason */}
              {verification.status === 'rejected' && verification.rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-red-700 uppercase mb-2 flex items-center gap-2">
                    <AlertTriangle size={16} /> Rejection Reason
                  </h4>
                  <p className="text-red-600">{verification.rejectionReason}</p>
                </div>
              )}

              {/* Notes */}
              {verification.notes && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-blue-700 uppercase mb-2">Admin Notes</h4>
                  <p className="text-blue-600">{verification.notes}</p>
                </div>
              )}

              {/* Reviewed info */}
              {verification.reviewedAt && (
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <Clock size={14} />
                  Reviewed on {format(new Date(verification.reviewedAt), 'MMM dd, yyyy hh:mm a')}
                </div>
              )}

              {/* Actions */}
              {isPending && (
                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                  {verification.status === 'pending' && (
                    <button
                      onClick={() => onMarkUnderReview(verification._id)}
                      disabled={actionLoading}
                      className="flex-1 py-3 bg-cyan-50 text-cyan-700 rounded-xl font-bold text-sm border border-cyan-200 hover:bg-cyan-100 disabled:opacity-50 flex items-center justify-center gap-2 min-w-[150px]"
                    >
                      <EyeIcon size={18} /> Mark Under Review
                    </button>
                  )}
                  <button
                    onClick={() => onRequestResubmission(verification._id)}
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-purple-50 text-purple-700 rounded-xl font-bold text-sm border border-purple-200 hover:bg-purple-100 disabled:opacity-50 flex items-center justify-center gap-2 min-w-[150px]"
                  >
                    <RotateCcw size={18} /> Request Resubmission
                  </button>
                  <button
                    onClick={() => onReject(verification._id)}
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm border border-red-200 hover:bg-red-100 disabled:opacity-50 flex items-center justify-center gap-2 min-w-[150px]"
                  >
                    <XCircle size={18} /> Reject
                  </button>
                  <button
                    onClick={() => onApprove(verification._id)}
                    disabled={actionLoading}
                    className="flex-[2] py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 min-w-[200px]"
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    Approve Verification
                  </button>
                </div>
              )}

              {!isPending && (
                <div
                  className={cn(
                    'p-4 rounded-xl text-center font-bold',
                    verification.status === 'approved' && 'bg-green-50 text-green-700',
                    verification.status === 'rejected' && 'bg-red-50 text-red-700',
                    verification.status === 'resubmission_required' && 'bg-purple-50 text-purple-700'
                  )}
                >
                  This verification is {verification.status.replace('_', ' ')}
                </div>
              )}
            </div>
          </motion.div>

          {/* Image Preview */}
          <AnimatePresence>
            {imagePreview && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90"
                onClick={() => setImagePreview(null)}
              >
                <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setImagePreview(null)}
                    className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white"
                  >
                    <X size={24} />
                  </button>
                  <p className="text-white text-center mb-4 font-bold">{imagePreview.title}</p>
                  <img
                    src={imagePreview.url}
                    alt={imagePreview.title}
                    className="max-w-full max-h-[80vh] object-contain rounded-xl"
                  />
                  <a
                    href={imagePreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-lg text-white"
                  >
                    <ExternalLink size={20} />
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
}

// ==================== INFO FIELD ====================
function InfoField({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase font-bold">{label}</p>
      <p className={cn('font-bold text-gray-900 text-sm break-words', mono && 'font-mono')}>{value || 'N/A'}</p>
    </div>
  );
}

// ==================== DOCUMENT CARD ====================
function DocumentCard({
  title,
  url,
  uploadedAt,
  onZoom,
}: {
  title: string;
  url: string;
  uploadedAt?: string;
  onZoom: () => void;
}) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-xs font-bold text-gray-700 uppercase">{title}</h5>
        <div className="flex gap-1">
          <button onClick={onZoom} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors" title="Zoom">
            <ZoomIn size={14} className="text-gray-500" />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
            title="Open in new tab"
          >
            <Download size={14} className="text-gray-500" />
          </a>
        </div>
      </div>

      <div className="relative cursor-pointer overflow-hidden rounded-lg bg-gray-100" onClick={onZoom}>
        {imageLoading && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}

        {!imageError ? (
          <img
            src={url}
            alt={title}
            className={cn('w-full h-40 object-cover transition-opacity', imageLoading ? 'opacity-0' : 'opacity-100')}
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
          />
        ) : (
          <div className="w-full h-40 flex flex-col items-center justify-center">
            <ImageIcon className="w-10 h-10 text-gray-300 mb-2" />
            <p className="text-xs text-gray-400">Failed to load</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-500 hover:underline mt-1"
            >
              Open in new tab
            </a>
          </div>
        )}
      </div>

      {uploadedAt && (
        <p className="text-xs text-gray-400 mt-2">
          Uploaded: {format(new Date(uploadedAt), 'MMM dd, yyyy')}
        </p>
      )}
    </div>
  );
}

// ==================== REJECT MODAL ====================
function RejectModal({
  isOpen,
  onClose,
  onSubmit,
  reason,
  setReason,
  notes,
  setNotes,
  actionLoading,
  isBulk,
  bulkCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  reason: string;
  setReason: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  actionLoading: boolean;
  isBulk: boolean;
  bulkCount: number;
}) {
  const presetReasons = [
    'Documents are blurry or unclear',
    'Selfie does not match ID',
    'PAN card not valid',
    'Aadhaar card not valid',
    'Information mismatch',
    'Documents expired',
    'Wrong document uploaded',
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-900">
                  {isBulk ? `Bulk Reject ${bulkCount}` : 'Reject Verification'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">Provide a reason to help the provider improve</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this verification is being rejected..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
                />
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Quick Select</p>
                <div className="flex flex-wrap gap-2">
                  {presetReasons.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {!isBulk && (
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                    Internal Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal notes (not shown to provider)"
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 resize-none"
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                disabled={actionLoading || !reason.trim()}
                className="flex-[2] py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />}
                {isBulk ? `Reject ${bulkCount} Verifications` : 'Reject Verification'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ==================== RESUBMISSION MODAL ====================
function ResubmissionModal({
  isOpen,
  onClose,
  onSubmit,
  reason,
  setReason,
  actionLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  reason: string;
  setReason: (v: string) => void;
  actionLoading: boolean;
}) {
  const presets = [
    'Please resubmit clearer selfie',
    'Please resubmit clearer PAN card',
    'Please resubmit clearer Aadhaar',
    'Please upload correct documents',
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-900">Request Resubmission</h3>
                <p className="text-sm text-gray-500 mt-1">The provider will be asked to resubmit documents</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain what needs to be resubmitted..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none"
                />
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Quick Select</p>
                <div className="flex flex-wrap gap-2">
                  {presets.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                disabled={actionLoading || !reason.trim()}
                className="flex-[2] py-3 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <RotateCcw size={18} />}
                Request Resubmission
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}