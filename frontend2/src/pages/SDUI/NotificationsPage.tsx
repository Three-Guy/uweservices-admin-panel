// src/pages/SDUI/NotificationsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Search,
  Filter,
  RefreshCw,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Copy,
  Trash2,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  Briefcase,
  Globe,
  Smartphone,
  Mail,
  MessageSquare,
  TrendingUp,
  Calendar,
  X,
  CheckSquare,
  Square,
  MinusSquare,
} from 'lucide-react';
import { apiClient } from '../../lib/api'; // ✅ Single source of truth

// ==================== TYPES ====================
interface Notification {
  _id: string;
  title: string;
  body: string;
  type: 'push' | 'sms' | 'email' | 'in_app' | 'all';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  targetAudience: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
  scheduledAt?: string;
  sentAt?: string;
  completedAt?: string;
  stats: {
    totalTargets: number;
    sent: number;
    delivered: number;
    read: number;
    clicked: number;
    failed: number;
  };
  createdBy?: { name: string; email: string };
  sentBy?: { name: string; email: string };
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface NotificationStats {
  overview: {
    total: number;
    sent: number;
    draft: number;
    scheduled: number;
    failed: number;
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
  };
  today: {
    count: number;
    sent: number;
  };
  byType: { _id: string; count: number }[];
  byStatus: { _id: string; count: number }[];
}

interface Filters {
  status: string;
  type: string;
  search: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // Filters
  const [filters, setFilters] = useState<Filters>({
    status: '',
    type: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // ==================== CLEAR SELECTION ON PAGE/FILTER CHANGE ====================
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, filters]);

  // ==================== AUTO-HIDE SUCCESS MESSAGE ====================
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // ==================== FETCH NOTIFICATIONS ====================
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {
        page: page.toString(),
        limit: limit.toString(),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      if (filters.status) params.status = filters.status;
      if (filters.type) params.type = filters.type;
      if (filters.search) params.search = filters.search;

      const response = await apiClient.get('/admin/notifications', { params });
      const data = response.data;

      if (data.success) {
        setNotifications(data.data.notifications);
        setTotalPages(data.data.pagination.pages);
        setTotal(data.data.pagination.total);
      } else {
        setError(data.message || 'Failed to fetch notifications');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  // ==================== FETCH STATS ====================
  const fetchStats = async () => {
    setStatsLoading(true);

    try {
      const response = await apiClient.get('/admin/notifications/stats');
      const data = response.data;

      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // ==================== INITIAL FETCH ====================
  useEffect(() => {
    fetchNotifications();
    fetchStats();
  }, [fetchNotifications]);

  // ==================== SELECTION HANDLERS ====================

  // Toggle select all
  const handleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map(n => n._id)));
    }
  };

  // Toggle single selection
  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Check if all selected
  const isAllSelected = notifications.length > 0 && selectedIds.size === notifications.length;

  // Check if some selected (for indeterminate state)
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < notifications.length;

  // ==================== BULK DELETE ====================
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedIds.size} notification${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    setBulkActionLoading(true);
    setError(null);

    try {
      const idsToDelete = Array.from(selectedIds);

      let successCount = 0;
      let failCount = 0;

      for (const id of idsToDelete) {
        try {
          const response = await apiClient.delete(`/admin/notifications/${id}`);
          const data = response.data;

          if (data.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      // Clear selection
      setSelectedIds(new Set());

      // Show result message
      if (failCount === 0) {
        setSuccessMessage(`Successfully deleted ${successCount} notification${successCount > 1 ? 's' : ''}`);
      } else {
        setError(`Deleted ${successCount}, failed to delete ${failCount} notification${failCount > 1 ? 's' : ''}`);
      }

      // Refresh data
      fetchNotifications();
      fetchStats();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to delete notifications');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // ==================== BULK SEND ====================
  const handleBulkSend = async () => {
    // Filter only draft/scheduled notifications
    const sendableIds = Array.from(selectedIds).filter(id => {
      const notification = notifications.find(n => n._id === id);
      return notification && ['draft', 'scheduled'].includes(notification.status);
    });

    if (sendableIds.length === 0) {
      alert('No draft or scheduled notifications selected to send.');
      return;
    }

    const confirmMessage = `Are you sure you want to send ${sendableIds.length} notification${sendableIds.length > 1 ? 's' : ''}?`;
    if (!confirm(confirmMessage)) return;

    setBulkActionLoading(true);
    setError(null);

    try {
      let successCount = 0;
      let failCount = 0;

      for (const id of sendableIds) {
        try {
          const response = await apiClient.post(`/admin/notifications/${id}/send`);
          const data = response.data;

          if (data.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      // Clear selection
      setSelectedIds(new Set());

      // Show result message
      if (failCount === 0) {
        setSuccessMessage(`Successfully sent ${successCount} notification${successCount > 1 ? 's' : ''}`);
      } else {
        setError(`Sent ${successCount}, failed to send ${failCount} notification${failCount > 1 ? 's' : ''}`);
      }

      // Refresh data
      fetchNotifications();
      fetchStats();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to send notifications');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // ==================== SEND NOTIFICATION ====================
  const handleSend = async (id: string) => {
    if (!confirm('Are you sure you want to send this notification?')) return;

    setActionLoading(id);

    try {
      const response = await apiClient.post(`/admin/notifications/${id}/send`);
      const data = response.data;

      if (data.success) {
        setSuccessMessage('Notification sent successfully!');
        fetchNotifications();
        fetchStats();
      } else {
        alert(data.message || 'Failed to send notification');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to send notification');
    } finally {
      setActionLoading(null);
    }
  };

  // ==================== CANCEL NOTIFICATION ====================
  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this notification?')) return;

    setActionLoading(id);

    try {
      const response = await apiClient.post(`/admin/notifications/${id}/cancel`);
      const data = response.data;

      if (data.success) {
        setSuccessMessage('Notification cancelled successfully!');
        fetchNotifications();
        fetchStats();
      } else {
        alert(data.message || 'Failed to cancel notification');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to cancel notification');
    } finally {
      setActionLoading(null);
    }
  };

  // ==================== DUPLICATE NOTIFICATION ====================
  const handleDuplicate = async (id: string) => {
    setActionLoading(id);

    try {
      const response = await apiClient.post(`/admin/notifications/${id}/duplicate`);
      const data = response.data;

      if (data.success) {
        fetchNotifications();
        setSuccessMessage('Notification duplicated successfully!');
      } else {
        alert(data.message || 'Failed to duplicate notification');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to duplicate notification');
    } finally {
      setActionLoading(null);
    }
  };

  // ==================== DELETE NOTIFICATION ====================
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;

    setActionLoading(id);

    try {
      const response = await apiClient.delete(`/admin/notifications/${id}`);
      const data = response.data;

      if (data.success) {
        setSuccessMessage('Notification deleted successfully!');
        fetchNotifications();
        fetchStats();
      } else {
        alert(data.message || 'Failed to delete notification');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to delete notification');
    } finally {
      setActionLoading(null);
    }
  };

  // ==================== UI HELPERS ====================

  // Get status badge
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      scheduled: 'bg-amber-100 text-amber-700',
      sending: 'bg-blue-100 text-blue-700',
      sent: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-500',
    };

    const icons: Record<string, React.ReactNode> = {
      draft: <Clock size={14} />,
      scheduled: <Calendar size={14} />,
      sending: <Loader2 size={14} className="animate-spin" />,
      sent: <CheckCircle size={14} />,
      failed: <XCircle size={14} />,
      cancelled: <XCircle size={14} />,
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {icons[status]}
        {status}
      </span>
    );
  };

  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'push': return <Smartphone size={16} className="text-indigo-600" />;
      case 'sms': return <MessageSquare size={16} className="text-green-600" />;
      case 'email': return <Mail size={16} className="text-blue-600" />;
      case 'in_app': return <Bell size={16} className="text-purple-600" />;
      case 'all': return <Globe size={16} className="text-orange-600" />;
      default: return <Bell size={16} className="text-gray-600" />;
    }
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get checkbox icon based on state
  const getCheckboxIcon = () => {
    if (isAllSelected) {
      return <CheckSquare size={20} className="text-indigo-600" />;
    } else if (isSomeSelected) {
      return <MinusSquare size={20} className="text-indigo-600" />;
    } else {
      return <Square size={20} className="text-gray-400" />;
    }
  };

  // ==================== RENDER ====================
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white">
              <Bell size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
              <p className="text-gray-500">Manage and track all notifications</p>
            </div>
          </div>

          <a
            href="/sdui/notifications/send"
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all"
          >
            <Send size={18} />
            Send Notification
          </a>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Notifications</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {statsLoading ? '...' : stats?.overview.total || 0}
              </p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Bell size={24} className="text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Sent Today</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {statsLoading ? '...' : stats?.today.sent || 0}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Send size={24} className="text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Delivered</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {statsLoading ? '...' : stats?.overview.totalDelivered?.toLocaleString() || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <CheckCircle size={24} className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Scheduled</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {statsLoading ? '...' : stats?.overview.scheduled || 0}
              </p>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <Clock size={24} className="text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="p-4 flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Type Filter */}
          <select
            value={filters.type}
            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Types</option>
            <option value="push">Push</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="in_app">In-App</option>
            <option value="all">All Channels</option>
          </select>

          {/* Refresh */}
          <button
            onClick={() => { fetchNotifications(); fetchStats(); }}
            className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare size={20} className="text-indigo-600" />
            <span className="font-medium text-indigo-900">
              {selectedIds.size} notification{selectedIds.size > 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk Send Button */}
            <button
              onClick={handleBulkSend}
              disabled={bulkActionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkActionLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Send Selected
            </button>

            {/* Bulk Delete Button */}
            <button
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkActionLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              Delete Selected
            </button>

            {/* Clear Selection */}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              <X size={16} />
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700">
          <CheckCircle size={20} />
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="ml-auto p-1 hover:bg-green-100 rounded">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Notifications Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-indigo-600" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Bell size={48} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">No notifications found</p>
            <p className="text-sm mt-1">Create your first notification to get started</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {/* Select All Checkbox */}
                    <th className="w-12 px-4 py-4">
                      <button
                        onClick={handleSelectAll}
                        className="flex items-center justify-center hover:bg-gray-100 rounded p-1 transition-colors"
                        title={isAllSelected ? "Deselect all" : "Select all"}
                      >
                        {getCheckboxIcon()}
                      </button>
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Notification</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Audience</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Stats</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <tr
                      key={notification._id}
                      className={`hover:bg-gray-50 transition-colors ${selectedIds.has(notification._id) ? 'bg-indigo-50' : ''}`}
                    >
                      {/* Row Checkbox */}
                      <td className="w-12 px-4 py-4">
                        <button
                          onClick={() => handleSelectOne(notification._id)}
                          className="flex items-center justify-center hover:bg-gray-100 rounded p-1 transition-colors"
                        >
                          {selectedIds.has(notification._id) ? (
                            <CheckSquare size={20} className="text-indigo-600" />
                          ) : (
                            <Square size={20} className="text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          <p className="font-semibold text-gray-900 truncate">{notification.title}</p>
                          <p className="text-sm text-gray-500 truncate mt-1">{notification.body}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(notification.type)}
                          <span className="text-sm capitalize">{notification.type.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 capitalize">
                          {notification.targetAudience.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(notification.status)}
                      </td>
                      <td className="px-6 py-4">
                        {notification.status === 'sent' ? (
                          <div className="text-sm">
                            <p className="text-gray-900">
                              <span className="font-medium">{notification.stats.delivered.toLocaleString()}</span>
                              <span className="text-gray-500"> delivered</span>
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {notification.stats.read} read · {notification.stats.clicked} clicked
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="text-gray-900">{formatDate(notification.createdAt)}</p>
                          {notification.scheduledAt && notification.status === 'scheduled' && (
                            <p className="text-xs text-amber-600 mt-0.5">
                              Scheduled: {formatDate(notification.scheduledAt)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* View */}
                          <button
                            onClick={() => {
                              setSelectedNotification(notification);
                              setShowDetailsModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>

                          {/* Send (only for draft/scheduled) */}
                          {['draft', 'scheduled'].includes(notification.status) && (
                            <button
                              onClick={() => handleSend(notification._id)}
                              disabled={actionLoading === notification._id}
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Send Now"
                            >
                              {actionLoading === notification._id ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <Send size={18} />
                              )}
                            </button>
                          )}

                          {/* Duplicate */}
                          <button
                            onClick={() => handleDuplicate(notification._id)}
                            disabled={actionLoading === notification._id}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Duplicate"
                          >
                            <Copy size={18} />
                          </button>

                          {/* Cancel (only for scheduled) */}
                          {notification.status === 'scheduled' && (
                            <button
                              onClick={() => handleCancel(notification._id)}
                              disabled={actionLoading === notification._id}
                              className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Cancel"
                            >
                              <XCircle size={18} />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(notification._id)}
                            disabled={actionLoading === notification._id}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} notifications
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="px-4 py-2 text-sm font-medium">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedNotification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Notification Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedNotification.title}</h3>
                  <p className="text-gray-600 mt-2">{selectedNotification.body}</p>
                </div>
                {getStatusBadge(selectedNotification.status)}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Type</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getTypeIcon(selectedNotification.type)}
                    <span className="font-medium capitalize">{selectedNotification.type.replace('_', ' ')}</span>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Priority</p>
                  <p className="font-medium capitalize mt-1">{selectedNotification.priority}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Target Audience</p>
                  <p className="font-medium capitalize mt-1">{selectedNotification.targetAudience.replace(/_/g, ' ')}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="font-medium mt-1">{formatDate(selectedNotification.createdAt)}</p>
                </div>
              </div>

              {/* Stats */}
              {selectedNotification.status === 'sent' && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Delivery Statistics</h4>
                  <div className="grid grid-cols-5 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-gray-600">{selectedNotification.stats.totalTargets}</p>
                      <p className="text-xs text-gray-500 mt-1">Targets</p>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-indigo-600">{selectedNotification.stats.sent}</p>
                      <p className="text-xs text-indigo-600 mt-1">Sent</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600">{selectedNotification.stats.delivered}</p>
                      <p className="text-xs text-green-600 mt-1">Delivered</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-600">{selectedNotification.stats.read}</p>
                      <p className="text-xs text-blue-600 mt-1">Read</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-red-600">{selectedNotification.stats.failed}</p>
                      <p className="text-xs text-red-600 mt-1">Failed</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedNotification.tags.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedNotification.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Created By */}
              {selectedNotification.createdBy && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    Created by: <span className="font-medium text-gray-700">{selectedNotification.createdBy.name}</span>
                  </p>
                </div>
              )}

              {/* Action Buttons in Modal */}
              <div className="pt-4 border-t border-gray-200 flex items-center gap-3">
                {['draft', 'scheduled'].includes(selectedNotification.status) && (
                  <button
                    onClick={() => {
                      handleSend(selectedNotification._id);
                      setShowDetailsModal(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    <Send size={16} />
                    Send Now
                  </button>
                )}
                <button
                  onClick={() => {
                    handleDuplicate(selectedNotification._id);
                    setShowDetailsModal(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <Copy size={16} />
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    handleDelete(selectedNotification._id);
                    setShowDetailsModal(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}