// src/pages/NotificationCenter.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Filter,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { adminNotificationsApi, AdminNotification } from '../lib/api';
import { onEvent } from '../lib/socket';

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [readFilter, setReadFilter] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await adminNotificationsApi.list({
        page,
        limit: 25,
        type: typeFilter || undefined,
        severity: severityFilter || undefined,
        isRead: readFilter || undefined,
      });
      if (res.success) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
        setTotalPages(res.data.pagination.totalPages);
        setTotal(res.data.pagination.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [page, typeFilter, severityFilter, readFilter]);

  useEffect(() => {
    const off = onEvent('admin:notification', () => fetch());
    return off;
  }, []);

  const markRead = async (id: string) => {
    await adminNotificationsApi.markRead(id);
    fetch();
  };

  const markAllRead = async () => {
    await adminNotificationsApi.markAllRead();
    fetch();
  };

  const deleteOne = async (id: string) => {
    if (!confirm('Delete this notification?')) return;
    await adminNotificationsApi.delete(id);
    fetch();
  };

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error':
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-600" />
            Notification Center
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-sm rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{total} total notifications</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold"
            >
              <CheckCheck className="w-4 h-4" /> Mark All Read
            </button>
          )}
          <button onClick={fetch} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-500" />
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Types</option>
          <option value="new_booking">New Booking</option>
          <option value="booking_assigned">Booking Assigned</option>
          <option value="booking_rejected">Booking Rejected</option>
          <option value="booking_cancelled">Booking Cancelled</option>
          <option value="booking_completed">Booking Completed</option>
          <option value="no_provider_found">No Provider Found</option>
          <option value="dispatch_failed">Dispatch Failed</option>
          <option value="reassignment">Reassignment</option>
          <option value="payment_received">Payment Received</option>
          <option value="system">System</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => {
            setSeverityFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Severities</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>
        <select
          value={readFilter}
          onChange={(e) => {
            setReadFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading && (
          <div className="p-10 text-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
          </div>
        )}
        {!loading && notifications.length === 0 && (
          <div className="p-16 text-center text-gray-500">
            <Bell className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <p>No notifications</p>
          </div>
        )}
        {!loading &&
          notifications.map((n) => (
            <div
              key={n._id}
              className={`px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors group ${
                !n.isRead ? 'bg-blue-50/30' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="mt-0.5">{getIcon(n.severity)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-gray-900">{n.title}</h4>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded font-bold uppercase">
                          {n.type.replace(/_/g, ' ')}
                        </span>
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-gray-500">
                        <span>{new Date(n.createdAt).toLocaleString()}</span>
                        {n.bookingId && (
                          <span>
                            Booking:{' '}
                            <Link
                              to={`/bookings?open=${n.bookingId}`}
                              className="text-indigo-600 font-semibold hover:underline"
                            >
                              {n.bookingId}
                            </Link>
                          </span>
                        )}
                        {n.providerId && <span>Provider: {n.providerId}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {n.actionUrl && (
                        <Link
                          to={n.actionUrl}
                          onClick={() => markRead(n._id)}
                          className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700"
                        >
                          {n.actionLabel || 'View'}
                        </Link>
                      )}
                      {!n.isRead && (
                        <button
                          onClick={() => markRead(n._id)}
                          className="px-2 py-1 bg-white border border-gray-300 text-gray-700 rounded text-xs font-semibold hover:bg-gray-50"
                        >
                          Mark Read
                        </button>
                      )}
                      <button
                        onClick={() => deleteOne(n._id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-xs text-gray-600">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}