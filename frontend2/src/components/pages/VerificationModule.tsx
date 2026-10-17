import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { verificationsApi } from '../../lib/api';
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle2, 
  XCircle,
  Clock,
  User,
  Mail,
  Phone,
  FileText,
  Image as ImageIcon,
  Calendar,
  AlertCircle,
  Download,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ExternalLink,
  X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

// ==================== TYPES ====================
interface Document {
  url: string;
  publicId?: string;
  uploadedAt?: string;
}

interface ProviderInfo {
  _id: string;
  providerId?: string;
  name: string;
  email: string;
  phone: string;
  profession?: string;
  profileImage?: string;
}

interface ProviderVerification {
  _id: string;
  verificationId: string;
  provider: ProviderInfo;
  documents: {
    selfie?: Document;
    aadhaarCard?: Document;
    panCard?: Document;
  };
  status: 'pending' | 'approved' | 'rejected' | 'submitted' | 'under_review';
  reviewedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  reviewedAt?: string;
  rejectionReason?: string;
  notes?: string;
  attempts?: number;
  createdAt: string;
  updatedAt?: string;
}

interface VerificationStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

// ==================== MAIN COMPONENT ====================
export default function VerificationModule() {
  const [verifications, setVerifications] = useState<ProviderVerification[]>([]);
  const [stats, setStats] = useState<VerificationStats>({ 
    pending: 0, 
    approved: 0, 
    rejected: 0, 
    total: 0 
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedVerification, setSelectedVerification] = useState<ProviderVerification | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ==================== FETCH DATA ====================
  const fetchVerifications = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      console.log('📋 Fetching verifications...');

      const params: any = {
        page,
        limit: 20,
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const response = await verificationsApi.getAll(params);
      
      console.log('📥 Verifications response:', response);

      if (response.success) {
        const fetchedVerifications = response.data.verifications || [];
        setVerifications(fetchedVerifications);
        
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.totalPages || 1);
        }
        
        // Calculate stats
        const all = fetchedVerifications;
        setStats({
          total: all.length,
          pending: all.filter((v: ProviderVerification) => 
            ['pending', 'submitted', 'under_review'].includes(v.status)
          ).length,
          approved: all.filter((v: ProviderVerification) => v.status === 'approved').length,
          rejected: all.filter((v: ProviderVerification) => v.status === 'rejected').length,
        });

        console.log('✅ Loaded', fetchedVerifications.length, 'verifications');
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
  }, [statusFilter, searchQuery, page]);

  // Fetch stats separately
  const fetchStats = useCallback(async () => {
    try {
      const response = await verificationsApi.getStats();
      if (response.success) {
        setStats(response.data);
      }
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
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQuery]);

  // ==================== FILTERED DATA ====================
  const filteredVerifications = useMemo(() => {
    if (!searchQuery.trim()) return verifications;
    
    const query = searchQuery.toLowerCase();
    return verifications.filter(v => {
      const matchesSearch = 
        v.provider?.name?.toLowerCase().includes(query) ||
        v.provider?.email?.toLowerCase().includes(query) ||
        v.provider?.phone?.includes(query) ||
        v.verificationId?.toLowerCase().includes(query);
      
      return matchesSearch;
    });
  }, [verifications, searchQuery]);

  // ==================== ACTIONS ====================
  const handleApprove = async (id: string) => {
    try {
      setActionLoading(true);
      const response = await verificationsApi.approve(id);
      
      if (response.success) {
        setShowModal(false);
        setSelectedVerification(null);
        fetchVerifications(true);
        fetchStats();
        alert('✅ Verification approved successfully!');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve verification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason || !reason.trim()) {
      alert('Rejection reason is required');
      return;
    }

    try {
      setActionLoading(true);
      const response = await verificationsApi.reject(id, reason.trim());
      
      if (response.success) {
        setShowModal(false);
        setSelectedVerification(null);
        fetchVerifications(true);
        fetchStats();
        alert('✅ Verification rejected successfully!');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reject verification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchVerifications(true);
    fetchStats();
  };

  // ==================== RENDER ====================
  if (loading && verifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-text-secondary font-medium">Loading verifications...</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-text-primary">
            Provider Verifications
          </h1>
          <p className="text-text-secondary mt-1 font-medium">
            Review and verify service provider documents
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold transition-all hover:bg-gray-50",
            refreshing && "opacity-50 cursor-not-allowed"
          )}
        >
          <RefreshCw size={16} className={cn(refreshing && "animate-spin")} />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={<FileText size={24} />} label="Total" value={stats.total} color="bg-blue-100 text-blue-600" />
        <StatCard icon={<Clock size={24} />} label="Pending" value={stats.pending} color="bg-amber-100 text-amber-600" highlight={stats.pending > 0} />
        <StatCard icon={<CheckCircle2 size={24} />} label="Approved" value={stats.approved} color="bg-green-100 text-green-600" />
        <StatCard icon={<XCircle size={24} />} label="Rejected" value={stats.rejected} color="bg-red-100 text-red-600" />
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, email, phone, or ID..." 
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <Filter size={14} className="text-gray-400" />
          <select 
            className="bg-gray-50 text-gray-700 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status ({stats.total})</option>
            <option value="pending">Pending ({stats.pending})</option>
            <option value="approved">Approved ({stats.approved})</option>
            <option value="rejected">Rejected ({stats.rejected})</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">ID</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Provider</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Documents</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Status</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Submitted</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVerifications.map((verification) => (
                <VerificationRow 
                  key={verification._id}
                  verification={verification}
                  onReview={() => {
                    setSelectedVerification(verification);
                    setShowModal(true);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>

        {filteredVerifications.length === 0 && !loading && (
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
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-xl border border-gray-200 disabled:opacity-50"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="px-4 py-2 text-sm font-bold">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-xl border border-gray-200 disabled:opacity-50"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Modal */}
      <VerificationModal 
        verification={selectedVerification}
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedVerification(null);
        }}
        onApprove={handleApprove}
        onReject={handleReject}
        actionLoading={actionLoading}
      />
    </div>
  );
}

// ==================== STAT CARD ====================
function StatCard({ icon, label, value, color, highlight }: any) {
  return (
    <div className={cn(
      "bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4",
      highlight ? "border-amber-200 ring-2 ring-amber-100" : "border-gray-200"
    )}>
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <h4 className="text-2xl font-black text-gray-900">{value}</h4>
      </div>
    </div>
  );
}

// ==================== VERIFICATION ROW ====================
function VerificationRow({ verification, onReview }: { verification: ProviderVerification; onReview: () => void }) {
  const hasDocuments = verification.documents?.selfie?.url || 
                       verification.documents?.aadhaarCard?.url || 
                       verification.documents?.panCard?.url;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4">
        <p className="font-bold text-gray-900 text-xs font-mono">
          {verification.verificationId}
        </p>
      </td>
      
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {verification.provider?.profileImage ? (
            <img 
              src={verification.provider.profileImage} 
              alt={verification.provider.name}
              className="w-10 h-10 rounded-xl object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
              {verification.provider?.name?.charAt(0) || '?'}
            </div>
          )}
          <div>
            <p className="font-bold text-gray-900">{verification.provider?.name || 'Unknown'}</p>
            <p className="text-xs text-gray-500">{verification.provider?.email || 'N/A'}</p>
            <p className="text-xs text-gray-500">{verification.provider?.phone || 'N/A'}</p>
          </div>
        </div>
      </td>

      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {verification.documents?.selfie?.url && (
            <div className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center" title="Selfie">
              <User size={16} />
            </div>
          )}
          {verification.documents?.aadhaarCard?.url && (
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center" title="Aadhaar">
              <FileText size={16} />
            </div>
          )}
          {verification.documents?.panCard?.url && (
            <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center" title="PAN">
              <FileText size={16} />
            </div>
          )}
          {!hasDocuments && (
            <span className="text-xs text-gray-400">No documents</span>
          )}
        </div>
      </td>

      <td className="px-6 py-4">
        <span className={cn(
          "px-3 py-1.5 rounded-full text-xs font-bold uppercase",
          ['pending', 'submitted', 'under_review'].includes(verification.status) && "bg-amber-50 text-amber-700",
          verification.status === 'approved' && "bg-green-50 text-green-700",
          verification.status === 'rejected' && "bg-red-50 text-red-700"
        )}>
          {verification.status}
        </span>
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

// ==================== MODAL ====================
function VerificationModal({ 
  verification, 
  isOpen, 
  onClose, 
  onApprove, 
  onReject,
  actionLoading 
}: {
  verification: ProviderVerification | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  actionLoading: boolean;
}) {
  const [imagePreview, setImagePreview] = useState<{ url: string; title: string } | null>(null);

  if (!verification) return null;

  const isPending = ['pending', 'submitted', 'under_review'].includes(verification.status);

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
            className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50 sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-black text-gray-900">Review Verification</h3>
                <p className="text-xs text-gray-500 font-mono mt-1">{verification.verificationId}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
                <X size={24} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Provider Info */}
              <div>
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Provider Information
                </h4>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Name</p>
                    <p className="font-bold text-gray-900">{verification.provider?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Email</p>
                    <p className="font-bold text-gray-900">{verification.provider?.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Phone</p>
                    <p className="font-bold text-gray-900">{verification.provider?.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Profession</p>
                    <p className="font-bold text-gray-900">{verification.provider?.profession || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Submitted Documents
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {verification.documents?.selfie?.url && (
                    <DocumentCard 
                      title="Selfie"
                      url={verification.documents.selfie.url}
                      uploadedAt={verification.documents.selfie.uploadedAt || verification.createdAt}
                      onZoom={() => setImagePreview({ url: verification.documents.selfie!.url, title: 'Selfie' })}
                    />
                  )}
                  {verification.documents?.aadhaarCard?.url && (
                    <DocumentCard 
                      title="Aadhaar Card"
                      url={verification.documents.aadhaarCard.url}
                      uploadedAt={verification.documents.aadhaarCard.uploadedAt || verification.createdAt}
                      onZoom={() => setImagePreview({ url: verification.documents.aadhaarCard!.url, title: 'Aadhaar Card' })}
                    />
                  )}
                  {verification.documents?.panCard?.url && (
                    <DocumentCard 
                      title="PAN Card"
                      url={verification.documents.panCard.url}
                      uploadedAt={verification.documents.panCard.uploadedAt || verification.createdAt}
                      onZoom={() => setImagePreview({ url: verification.documents.panCard!.url, title: 'PAN Card' })}
                    />
                  )}
                </div>
                
                {!verification.documents?.selfie?.url && 
                 !verification.documents?.aadhaarCard?.url && 
                 !verification.documents?.panCard?.url && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-amber-700 font-medium">No documents uploaded</p>
                  </div>
                )}
              </div>

              {/* Rejection Reason */}
              {verification.status === 'rejected' && verification.rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-red-700 uppercase mb-2">Rejection Reason</h4>
                  <p className="text-red-600">{verification.rejectionReason}</p>
                </div>
              )}

              {/* Actions */}
              {isPending && (
                <div className="flex gap-4 pt-4 border-t border-gray-200">
                  <button 
                    onClick={() => onReject(verification._id)}
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm border border-red-200 hover:bg-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />}
                    Reject
                  </button>
                  <button 
                    onClick={() => onApprove(verification._id)}
                    disabled={actionLoading}
                    className="flex-[2] py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    Approve Verification
                  </button>
                </div>
              )}

              {!isPending && (
                <div className={cn(
                  "p-4 rounded-xl text-center font-bold",
                  verification.status === 'approved' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                )}>
                  This verification has been {verification.status}
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

// ==================== DOCUMENT CARD ====================
function DocumentCard({ title, url, uploadedAt, onZoom }: { 
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
        <h5 className="text-xs font-bold text-gray-500 uppercase">{title}</h5>
        <div className="flex gap-1">
          <button onClick={onZoom} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors" title="Zoom">
            <ZoomIn size={14} className="text-gray-500" />
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors" title="Download">
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
            className={cn(
              "w-full h-40 object-cover transition-opacity",
              imageLoading ? "opacity-0" : "opacity-100"
            )}
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
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline mt-1">
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