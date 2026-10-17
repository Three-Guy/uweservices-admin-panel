import React, { useState, useEffect, useCallback } from 'react';
import { providersApi } from '../../lib/api';
import { Provider, ProviderStats } from '../../types';
import {
  Search,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Trash2,
  Eye,
  X,
  Clock,
  ArrowUpDown,
  Mail,
  Phone,
  Shield,
  ShieldOff,
  Loader2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  UserX,
  RotateCcw,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Star,
  Briefcase,
  IndianRupee,
  Ban,
  XCircle,
  FileCheck
} from 'lucide-react';
import { format } from 'date-fns';

// Pagination interface
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function ProvidersModule() {
  // State
  const [providers, setProviders] = useState<Provider[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ProviderStats | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [verificationFilter, setVerificationFilter] = useState<string>('all');
  const [blockedFilter, setBlockedFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modals
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<Provider | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [providerToBlock, setProviderToBlock] = useState<Provider | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Selected providers for bulk actions
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const itemsPerPage = 10;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch provider stats
  const fetchStats = async () => {
    try {
      const response = await providersApi.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  // Fetch providers from API
  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
        sortBy,
        sortOrder,
      };

      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active';
      if (verificationFilter !== 'all') params.verificationStatus = verificationFilter;
      if (blockedFilter !== 'all') params.isBlocked = blockedFilter === 'blocked';

      const response = await providersApi.getAll(params);

      if (response.success) {
        setProviders(response.data.providers.map(mapProviderToUI));
        setPagination(response.data.pagination);
      } else {
        throw new Error(response.message || 'Failed to fetch providers');
      }
    } catch (err: any) {
      console.error('Error fetching providers:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch providers';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, statusFilter, verificationFilter, blockedFilter, sortBy, sortOrder]);

  // Map provider data for UI
  const mapProviderToUI = (provider: Provider): Provider => {
    const nameParts = provider.name?.split(' ') || ['P'];
    const initials = nameParts.map(n => n[0]).join('').toUpperCase();
    
    const performance = provider.totalBookings > 0 
      ? Math.round((provider.completedBookings / provider.totalBookings) * 100)
      : 0;

    let status: 'Available' | 'Busy' | 'Offline' = 'Offline';
    if (provider.isActive && provider.isAvailable) {
      status = provider.isAcceptingJobs ? 'Available' : 'Busy';
    }

    return {
      ...provider,
      initials,
      performance,
      paymentReceived: provider.totalEarnings,
      status,
      contact: provider.phone,
      address: provider.location?.address || '',
      category: provider.profession || 'General',
    };
  };

  useEffect(() => {
    fetchProviders();
    fetchStats();
  }, [fetchProviders]);

  // Toggle provider status
  const handleToggleStatus = async (provider: Provider) => {
    if (provider.isBlocked) {
      alert('Cannot change status of a blocked provider. Unblock first.');
      return;
    }
    
    try {
      setActionLoading(provider._id);
      const newStatus = !provider.isActive;
      
      const response = await providersApi.toggleStatus(provider._id, newStatus);
      
      if (response.success) {
        setProviders(prev => prev.map(p => 
          p._id === provider._id ? { ...p, isActive: newStatus } : p
        ));
        fetchStats();
      }
    } catch (err: any) {
      console.error('Error toggling status:', err);
      alert(err.response?.data?.message || 'Failed to update provider status');
    } finally {
      setActionLoading(null);
    }
  };

  // Open block modal
  const openBlockModal = (provider: Provider) => {
    setProviderToBlock(provider);
    setBlockReason('');
    setShowBlockModal(true);
  };

  // Block/Unblock provider
  const handleBlockProvider = async () => {
    if (!providerToBlock) return;
    
    try {
      setActionLoading(providerToBlock._id);
      const newBlockStatus = !providerToBlock.isBlocked;
      
      const response = await providersApi.blockProvider(
        providerToBlock._id, 
        newBlockStatus, 
        blockReason
      );
      
      if (response.success) {
        setProviders(prev => prev.map(p => 
          p._id === providerToBlock._id ? { ...p, isBlocked: newBlockStatus } : p
        ));
        fetchStats();
        setShowBlockModal(false);
        setProviderToBlock(null);
        setBlockReason('');
      }
    } catch (err: any) {
      console.error('Error blocking provider:', err);
      alert(err.response?.data?.message || 'Failed to update block status');
    } finally {
      setActionLoading(null);
    }
  };

  // Open delete confirmation modal
  const openDeleteModal = (provider: Provider) => {
    setProviderToDelete(provider);
    setShowDeleteModal(true);
  };

  // Delete provider (with confirmation)
  const handleDeleteProvider = async (permanent: boolean) => {
    if (!providerToDelete) return;
    
    try {
      setActionLoading(providerToDelete._id);
      const response = await providersApi.deleteProvider(providerToDelete._id, permanent);
      
      if (response.success) {
        setProviders(prev => prev.filter(p => p._id !== providerToDelete._id));
        if (pagination) {
          setPagination({ ...pagination, total: pagination.total - 1 });
        }
        fetchStats();
        setShowDeleteModal(false);
        setProviderToDelete(null);
      }
    } catch (err: any) {
      console.error('Error deleting provider:', err);
      alert(err.response?.data?.message || 'Failed to delete provider');
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk delete providers
  const handleBulkDelete = async (permanent: boolean) => {
    if (selectedProviders.length === 0) return;
    
    try {
      setActionLoading('bulk');
      const response = await providersApi.deleteMultiple(selectedProviders, permanent);
      
      if (response.success) {
        setProviders(prev => prev.filter(p => !selectedProviders.includes(p._id)));
        if (pagination) {
          setPagination({ ...pagination, total: pagination.total - selectedProviders.length });
        }
        fetchStats();
        setShowBulkDeleteModal(false);
        setSelectedProviders([]);
      }
    } catch (err: any) {
      console.error('Error bulk deleting providers:', err);
      alert(err.response?.data?.message || 'Failed to delete providers');
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle provider selection
  const toggleProviderSelection = (providerId: string) => {
    setSelectedProviders(prev => 
      prev.includes(providerId) 
        ? prev.filter(id => id !== providerId)
        : [...prev, providerId]
    );
  };

  // Select all providers on current page
  const toggleSelectAll = () => {
    if (selectedProviders.length === providers.length) {
      setSelectedProviders([]);
    } else {
      setSelectedProviders(providers.map(p => p._id));
    }
  };

  // Export to CSV
  const exportToCSV = async () => {
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active';
      if (verificationFilter !== 'all') params.verificationStatus = verificationFilter;
      
      const response = await providersApi.getAll({ ...params, limit: 1000 });

      if (response.success && response.data.providers) {
        const csvProviders = response.data.providers;
        const headers = ['ID', 'Name', 'Email', 'Phone', 'Profession', 'Rating', 'Total Earnings', 'Verification Status', 'Status', 'Blocked', 'Created At'];
        
        const rows = csvProviders.map((p: Provider) => [
          p.providerId,
          `"${p.name || ''}"`,
          p.email,
          p.phone || '',
          p.profession || '',
          p.rating || 0,
          p.totalEarnings || 0,
          p.verificationStatus,
          p.isActive ? 'Active' : 'Inactive',
          p.isBlocked ? 'Yes' : 'No',
          p.createdAt,
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `providers_export_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      console.error('Export error:', err);
      alert('Failed to export providers');
    }
  };

  // Format date helper
  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), 'MMM dd, yyyy');
    } catch {
      return 'N/A';
    }
  };

  // Format rating helper
  const formatRating = (rating: number | null | undefined): string => {
    if (rating === null || rating === undefined) return '0.0';
    if (typeof rating === 'number') return rating.toFixed(1);
    const parsed = parseFloat(String(rating));
    return isNaN(parsed) ? '0.0' : parsed.toFixed(1);
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setVerificationFilter('all');
    setBlockedFilter('all');
    setRatingFilter('all');
    setSortBy('createdAt');
    setSortOrder('desc');
    setCurrentPage(1);
    setSelectedProviders([]);
  };

  // Get verification badge color
  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'verified':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Providers Management</h1>
          <p className="text-gray-600 mt-1">
            Manage service providers and their verifications
            {pagination && <span className="ml-2 text-green-600 font-semibold">({pagination.total} total)</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedProviders.length > 0 && (
            <button 
              onClick={() => setShowBulkDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <Trash2 size={16} />
              Delete ({selectedProviders.length})
            </button>
          )}
          <button 
            onClick={resetFilters}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Reset Filters"
          >
            <RotateCcw size={18} />
          </button>
          <button 
            onClick={() => { fetchProviders(); fetchStats(); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button 
            onClick={exportToCSV}
            disabled={loading || providers.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            icon={<Briefcase className="text-green-600" />}
            label="Total Providers"
            value={stats.totalProviders}
            bgColor="bg-green-50"
          />
          <StatCard
            icon={<UserCheck className="text-emerald-600" />}
            label="Active"
            value={stats.activeProviders}
            bgColor="bg-emerald-50"
          />
          <StatCard
            icon={<Clock className="text-amber-600" />}
            label="Pending"
            value={stats.pendingVerifications}
            bgColor="bg-amber-50"
            highlight={stats.pendingVerifications > 0}
          />
          <StatCard
            icon={<ShieldOff className="text-red-600" />}
            label="Blocked"
            value={stats.blockedProviders}
            bgColor="bg-red-50"
            highlight={stats.blockedProviders > 0}
          />
          <StatCard
            icon={<Star className="text-yellow-600" />}
            label="Avg Rating"
            value={formatRating(stats.avgRating)}
            bgColor="bg-yellow-50"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, email, or phone..." 
            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        {/* Filter Controls */}
        <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
          {/* Sort */}
          <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white shrink-0">
            <span className="text-xs font-medium text-gray-500">Sort:</span>
            <select 
              className="text-sm font-medium text-gray-700 outline-none cursor-pointer bg-transparent"
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
            >
              <option value="createdAt">Join Date</option>
              <option value="name">Name</option>
              <option value="rating">Rating</option>
              <option value="totalEarnings">Earnings</option>
            </select>
            <button 
              onClick={() => { setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); setCurrentPage(1); }}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              <ArrowUpDown size={14} className="text-gray-500" />
            </button>
          </div>

          {/* Status Filter */}
          <select 
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 outline-none cursor-pointer bg-white shrink-0"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Verification Filter */}
          <select 
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 outline-none cursor-pointer bg-white shrink-0"
            value={verificationFilter}
            onChange={(e) => { setVerificationFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All Verification</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Blocked Filter */}
          <select 
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 outline-none cursor-pointer bg-white shrink-0"
            value={blockedFilter}
            onChange={(e) => { setBlockedFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All Accounts</option>
            <option value="blocked">Blocked</option>
            <option value="unblocked">Active</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-red-500 shrink-0" size={20} />
          <span className="text-red-700 font-medium flex-1">{error}</span>
          <button 
            onClick={fetchProviders}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-green-600" />
            <p className="text-gray-500 font-medium">Loading providers...</p>
          </div>
        </div>
      )}

      {/* Providers Table */}
      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-4 text-left">
                    <input 
                      type="checkbox"
                      checked={selectedProviders.length === providers.length && providers.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Provider</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Contact</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Profession</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Rating</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Verification</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Earnings</th>
                  <th className="px-6 py-4 text-right font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {providers.length > 0 ? (
                  providers.map((provider) => (
                    <tr 
                      key={provider._id} 
                      className={`hover:bg-gray-50 transition-colors group ${
                        selectedProviders.includes(provider._id) ? 'bg-green-50' : ''
                      } ${provider.isBlocked ? 'bg-red-50/50' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-4">
                        <input 
                          type="checkbox"
                          checked={selectedProviders.includes(provider._id)}
                          onChange={() => toggleProviderSelection(provider._id)}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                      </td>

                      {/* Provider Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-semibold text-sm overflow-hidden shrink-0">
                            {provider.profileImage ? (
                              <img 
                                src={provider.profileImage} 
                                alt={provider.name} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              provider.initials || provider.name?.[0]?.toUpperCase() || 'P'
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900 truncate">{provider.name || 'N/A'}</p>
                              {provider.isBlocked && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-bold">
                                  BLOCKED
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">ID: {provider.providerId?.slice(-8) || provider._id?.slice(-8)}</p>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Mail size={12} className="text-gray-400" />
                            <a href={`mailto:${provider.email}`} className="text-sm text-green-600 hover:underline truncate max-w-[180px]">
                              {provider.email}
                            </a>
                          </div>
                          {provider.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone size={12} className="text-gray-400" />
                              <a href={`tel:${provider.phone}`} className="text-sm text-gray-600 hover:underline">
                                {provider.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Profession */}
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                          {provider.profession || 'General'}
                        </span>
                      </td>

                      {/* Rating */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Star size={14} className="fill-amber-400 text-amber-400" />
                            <span className="font-bold text-gray-900">{formatRating(provider.rating)}</span>
                            <span className="text-xs text-gray-500">({provider.totalRatings || 0})</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {provider.completedBookings || 0}/{provider.totalBookings || 0} completed
                          </p>
                        </div>
                      </td>

                      {/* Verification */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getVerificationBadge(provider.verificationStatus)}`}>
                          {provider.verificationStatus === 'approved' || provider.verificationStatus === 'verified' ? (
                            <CheckCircle size={12} />
                          ) : provider.verificationStatus === 'pending' ? (
                            <Clock size={12} />
                          ) : (
                            <XCircle size={12} />
                          )}
                          {provider.verificationStatus}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          provider.isBlocked 
                            ? 'bg-red-100 text-red-700'
                            : provider.isActive 
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}>
                          {provider.isBlocked ? (
                            <><ShieldOff size={12} /> Blocked</>
                          ) : provider.isActive ? (
                            <><UserCheck size={12} /> Active</>
                          ) : (
                            <><UserX size={12} /> Inactive</>
                          )}
                        </span>
                      </td>

                      {/* Earnings */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-bold text-gray-900 flex items-center gap-1">
                            <IndianRupee size={12} />
                            {(provider.totalEarnings || 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            Today: ₹{(provider.todayEarnings || 0).toLocaleString()}
                          </p>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* View */}
                          <button 
                            onClick={() => { setSelectedProvider(provider); setShowProviderModal(true); }}
                            className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>

                          {/* Toggle Status */}
                          <button 
                            onClick={() => handleToggleStatus(provider)}
                            disabled={actionLoading === provider._id || provider.isBlocked}
                            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                              provider.isActive 
                                ? 'text-amber-500 hover:bg-amber-50'
                                : 'text-green-500 hover:bg-green-50'
                            }`}
                            title={provider.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {actionLoading === provider._id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : provider.isActive ? (
                              <ToggleRight size={16} />
                            ) : (
                              <ToggleLeft size={16} />
                            )}
                          </button>

                          {/* Block/Unblock */}
                          <button 
                            onClick={() => openBlockModal(provider)}
                            disabled={actionLoading === provider._id}
                            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                              provider.isBlocked 
                                ? 'text-green-500 hover:bg-green-50'
                                : 'text-amber-500 hover:bg-amber-50'
                            }`}
                            title={provider.isBlocked ? 'Unblock' : 'Block'}
                          >
                            {provider.isBlocked ? <Shield size={16} /> : <Ban size={16} />}
                          </button>

                          {/* Delete */}
                          <button 
                            onClick={() => openDeleteModal(provider)}
                            disabled={actionLoading === provider._id}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete Provider"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Briefcase size={48} className="text-gray-300" />
                        <p className="text-gray-500 font-medium">No providers found</p>
                        <p className="text-sm text-gray-400">Try adjusting your search or filters</p>
                        <button 
                          onClick={resetFilters}
                          className="mt-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
                        >
                          Reset Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {pagination && pagination.total > 0 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-sm text-gray-600">
                Showing <span className="font-medium">{providers.length}</span> of{' '}
                <span className="font-medium">{pagination.total}</span> providers | 
                Page <span className="font-medium">{pagination.page}</span> of{' '}
                <span className="font-medium">{pagination.totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={!pagination.hasPrev}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                
                {/* Page Numbers */}
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          pageNum === pagination.page
                            ? 'bg-green-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button 
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={!pagination.hasNext}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && providerToDelete && (
        <DeleteConfirmationModal
          provider={providerToDelete}
          loading={actionLoading === providerToDelete._id}
          onClose={() => { setShowDeleteModal(false); setProviderToDelete(null); }}
          onDelete={handleDeleteProvider}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <BulkDeleteModal
          count={selectedProviders.length}
          loading={actionLoading === 'bulk'}
          onClose={() => setShowBulkDeleteModal(false)}
          onDelete={handleBulkDelete}
        />
      )}

      {/* Block Modal */}
      {showBlockModal && providerToBlock && (
        <BlockModal
          provider={providerToBlock}
          blockReason={blockReason}
          setBlockReason={setBlockReason}
          loading={actionLoading === providerToBlock._id}
          onClose={() => { setShowBlockModal(false); setProviderToBlock(null); setBlockReason(''); }}
          onBlock={handleBlockProvider}
        />
      )}

      {/* Provider Detail Modal */}
      {showProviderModal && selectedProvider && (
        <ProviderDetailModal 
          provider={selectedProvider}
          onClose={() => { setShowProviderModal(false); setSelectedProvider(null); }}
          onStatusChange={(providerId, isActive) => {
            setProviders(prev => prev.map(p => p._id === providerId ? { ...p, isActive } : p));
            fetchStats();
          }}
          onBlockChange={(providerId, isBlocked) => {
            setProviders(prev => prev.map(p => p._id === providerId ? { ...p, isBlocked } : p));
            fetchStats();
          }}
          onDelete={() => {
            setShowProviderModal(false);
            openDeleteModal(selectedProvider);
          }}
        />
      )}
    </div>
  );
}

// ==================== DELETE CONFIRMATION MODAL ====================
function DeleteConfirmationModal({ provider, loading, onClose, onDelete }: {
  provider: Provider;
  loading: boolean;
  onClose: () => void;
  onDelete: (permanent: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-red-50 border-b border-red-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Delete Provider</h3>
              <p className="text-sm text-gray-600">Choose how to delete this provider</p>
            </div>
          </div>
        </div>

        {/* Provider Info */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold">
              {provider.name?.[0]?.toUpperCase() || 'P'}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{provider.name}</p>
              <p className="text-sm text-gray-500">{provider.email}</p>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="p-6 space-y-4">
          {/* Soft Delete Option */}
          <button
            onClick={() => onDelete(false)}
            disabled={loading}
            className="w-full p-4 border-2 border-amber-200 bg-amber-50 rounded-xl text-left hover:border-amber-400 transition-colors disabled:opacity-50 group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <UserX className="text-amber-600" size={20} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Soft Delete (Deactivate)</p>
                <p className="text-sm text-gray-600 mt-1">
                  Mark provider as deleted but keep data in database. Can be restored later.
                </p>
              </div>
            </div>
          </button>

          {/* Permanent Delete Option */}
          <button
            onClick={() => onDelete(true)}
            disabled={loading}
            className="w-full p-4 border-2 border-red-200 bg-red-50 rounded-xl text-left hover:border-red-400 transition-colors disabled:opacity-50 group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="text-red-600" size={20} />
              </div>
              <div>
                <p className="font-semibold text-red-700">Permanent Delete</p>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="text-red-600 font-medium">⚠️ This action cannot be undone!</span><br />
                  Provider data will be permanently removed from database.
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== BULK DELETE MODAL ====================
function BulkDeleteModal({ count, loading, onClose, onDelete }: {
  count: number;
  loading: boolean;
  onClose: () => void;
  onDelete: (permanent: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-red-50 border-b border-red-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Delete {count} Providers</h3>
              <p className="text-sm text-gray-600">Choose how to delete selected providers</p>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="p-6 space-y-4">
          {/* Soft Delete Option */}
          <button
            onClick={() => onDelete(false)}
            disabled={loading}
            className="w-full p-4 border-2 border-amber-200 bg-amber-50 rounded-xl text-left hover:border-amber-400 transition-colors disabled:opacity-50"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <UserX className="text-amber-600" size={20} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Soft Delete (Deactivate)</p>
                <p className="text-sm text-gray-600 mt-1">
                  Mark {count} providers as deleted. Can be restored later.
                </p>
              </div>
            </div>
          </button>

          {/* Permanent Delete Option */}
          <button
            onClick={() => onDelete(true)}
            disabled={loading}
            className="w-full p-4 border-2 border-red-200 bg-red-50 rounded-xl text-left hover:border-red-400 transition-colors disabled:opacity-50"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="text-red-600" size={20} />
              </div>
              <div>
                <p className="font-semibold text-red-700">Permanent Delete</p>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="text-red-600 font-medium">⚠️ Cannot be undone!</span><br />
                  Permanently remove {count} providers from database.
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== BLOCK MODAL ====================
function BlockModal({ provider, blockReason, setBlockReason, loading, onClose, onBlock }: {
  provider: Provider;
  blockReason: string;
  setBlockReason: (reason: string) => void;
  loading: boolean;
  onClose: () => void;
  onBlock: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`p-6 border-b ${provider.isBlocked ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              provider.isBlocked ? 'bg-green-100' : 'bg-amber-100'
            }`}>
              {provider.isBlocked ? (
                <Shield className="text-green-600" size={24} />
              ) : (
                <ShieldOff className="text-amber-600" size={24} />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {provider.isBlocked ? 'Unblock Provider' : 'Block Provider'}
              </h3>
              <p className="text-sm text-gray-600">{provider.name}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!provider.isBlocked && (
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Reason for blocking
              </label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Enter reason for blocking this provider..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none h-24"
              />
            </div>
          )}

          {provider.isBlocked && provider.blockReason && (
            <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-xs font-bold text-amber-700 uppercase mb-1">Block Reason</p>
              <p className="text-sm text-amber-800">{provider.blockReason}</p>
            </div>
          )}

          <p className="text-sm text-gray-600">
            {provider.isBlocked 
              ? 'This provider will be able to access the platform again after unblocking.'
              : 'Blocked providers cannot log in or receive new bookings.'}
          </p>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onBlock}
            disabled={loading}
            className={`flex-1 py-3 rounded-xl font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
              provider.isBlocked 
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : provider.isBlocked ? (
              <>
                <Shield size={16} />
                Unblock
              </>
            ) : (
              <>
                <ShieldOff size={16} />
                Block
              </>
            )}
          </button>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== STAT CARD ====================
function StatCard({ icon, label, value, bgColor, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  bgColor: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-4 rounded-xl border ${highlight ? 'ring-2 ring-green-500 ring-offset-2' : 'border-gray-200'} ${bgColor}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

// ==================== PROVIDER DETAIL MODAL ====================
function ProviderDetailModal({ provider, onClose, onStatusChange, onBlockChange, onDelete }: {
  provider: Provider;
  onClose: () => void;
  onStatusChange?: (providerId: string, isActive: boolean) => void;
  onBlockChange?: (providerId: string, isBlocked: boolean) => void;
  onDelete?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), 'MMMM dd, yyyy');
    } catch {
      return 'N/A';
    }
  };

  const formatRating = (rating: number | null | undefined): string => {
    if (rating === null || rating === undefined) return '0.0';
    if (typeof rating === 'number') return rating.toFixed(1);
    return '0.0';
  };

  const handleToggleStatus = async () => {
    if (provider.isBlocked) {
      alert('Cannot change status of a blocked provider');
      return;
    }
    
    try {
      setLoading(true);
      const newStatus = !provider.isActive;
      const response = await providersApi.toggleStatus(provider._id, newStatus);
      
      if (response.success) {
        onStatusChange?.(provider._id, newStatus);
        onClose();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-xl overflow-hidden">
              {provider.profileImage ? (
                <img src={provider.profileImage} alt={provider.name} className="w-full h-full object-cover" />
              ) : (
                provider.name?.[0]?.toUpperCase() || 'P'
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-gray-900">{provider.name || 'N/A'}</h3>
                {provider.isBlocked && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">BLOCKED</span>
                )}
              </div>
              <p className="text-sm text-gray-500">{provider.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
              provider.isBlocked 
                ? 'bg-red-100 text-red-700'
                : provider.isActive 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-700'
            }`}>
              {provider.isBlocked ? <ShieldOff size={14} /> : provider.isActive ? <UserCheck size={14} /> : <UserX size={14} />}
              {provider.isBlocked ? 'Blocked' : provider.isActive ? 'Active' : 'Inactive'}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
              provider.verificationStatus === 'approved' || provider.verificationStatus === 'verified'
                ? 'bg-green-100 text-green-700'
                : provider.verificationStatus === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
            }`}>
              <FileCheck size={14} />
              {provider.verificationStatus}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
              <Briefcase size={14} />
              {provider.profession || 'General'}
            </span>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl">
            <Star size={32} className="fill-amber-400 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatRating(provider.rating)}</p>
              <p className="text-sm text-gray-600">{provider.totalRatings || 0} ratings • {provider.completedBookings || 0}/{provider.totalBookings || 0} completed</p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <DetailItem label="Phone" value={provider.phone || 'Not provided'} icon={<Phone size={14} />} />
            <DetailItem label="Gender" value={provider.gender || 'Not specified'} icon={<Users size={14} />} />
            <DetailItem label="Joined" value={formatDate(provider.createdAt)} icon={<Calendar size={14} />} />
            <DetailItem label="Service Radius" value={`${provider.serviceRadius || 0} km`} icon={<MapPin size={14} />} />
          </div>

          {/* Earnings */}
          <div className="p-4 bg-green-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <IndianRupee size={16} className="text-green-600" />
              <span className="text-sm font-bold text-gray-700 uppercase">Earnings</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Total Earnings</p>
                <p className="text-xl font-bold text-green-700">₹{(provider.totalEarnings || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Today's Earnings</p>
                <p className="text-xl font-bold text-green-700">₹{(provider.todayEarnings || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Location */}
          {provider.location?.address && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <MapPin size={12} />
                Address
              </p>
              <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">{provider.location.address}</p>
            </div>
          )}

          {/* Block Reason */}
          {provider.isBlocked && provider.blockReason && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200">
              <p className="text-xs font-bold text-red-700 uppercase mb-1">Block Reason</p>
              <p className="text-sm text-red-800">{provider.blockReason}</p>
            </div>
          )}

          {/* Provider ID */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Provider ID</p>
            <p className="text-sm text-gray-900 font-mono mt-1">{provider.providerId || provider._id}</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3">
          <button 
            onClick={handleToggleStatus}
            disabled={loading || provider.isBlocked}
            className={`flex-1 py-3 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
              provider.isActive 
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : provider.isActive ? (
              <>
                <ToggleLeft size={16} />
                Deactivate
              </>
            ) : (
              <>
                <ToggleRight size={16} />
                Activate
              </>
            )}
          </button>
          <button 
            onClick={onDelete}
            className="px-4 py-3 bg-red-100 text-red-700 rounded-xl font-medium text-sm hover:bg-red-200 transition-colors flex items-center gap-2"
          >
            <Trash2 size={16} />
            Delete
          </button>
          <button 
            onClick={onClose}
            className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== DETAIL ITEM COMPONENT ====================
function DetailItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className="text-sm font-medium text-gray-900 mt-1">{value}</p>
    </div>
  );
}