import React, { useState, useEffect, useCallback, useRef } from 'react';
import { notificationsApi, fcmApi } from '../lib/dispatchClient';
import { getSocket } from '../lib/socket';

/* ══════════════════════════════════════════════
   WHITELIST — ONLY THESE TYPES SHOW NOTIFICATIONS
   ══════════════════════════════════════════════ */
const ALLOWED_NOTIFICATION_TYPES = new Set([
  'new_booking',
  'booking:created',
  'new:booking',
  'booking_assigned',
]);

function isAllowedNotification(type: string): boolean {
  if (!type) return false;
  return ALLOWED_NOTIFICATION_TYPES.has(type);
}

/* ══════════════════════════════════════════════
   DUPLICATE-INSTANCE GUARD
   ══════════════════════════════════════════════ */
declare global {
  interface Window {
    __UWE_BELL_PRIMARY_ID__?: number;
    __UWE_BELL_SEQ__?: number;
    __UWE_NOTIF_DEDUPE__?: Map<string, number>;
  }
}

if (typeof window !== 'undefined') {
  if (window.__UWE_BELL_SEQ__ === undefined) window.__UWE_BELL_SEQ__ = 0;
  if (!window.__UWE_NOTIF_DEDUPE__) window.__UWE_NOTIF_DEDUPE__ = new Map();
}

/* ─── Types ─── */
interface AdminNotification {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  bookingId?: string;
}

interface Toast {
  id: string;
  title: string;
  message: string;
  type: string;
  bookingId?: string;
}

/* ─── Helpers ─── */
const typeIcon = (type: string): string => {
  switch (type) {
    case 'new_booking':
    case 'booking:created':
    case 'new:booking':
      return '🆕';
    case 'booking_assigned':
    case 'booking_accepted':
      return '✅';
    default: return '🔔';
  }
};

const typeColor = (type: string): string => {
  switch (type) {
    case 'new_booking':
    case 'booking:created':
    case 'new:booking':
      return 'border-l-blue-500';
    case 'booking_assigned':
    case 'booking_accepted':
      return 'border-l-green-500';
    default: return 'border-l-gray-400';
  }
};

const toastGradient = (type: string): string => {
  switch (type) {
    case 'new_booking':
    case 'booking:created':
    case 'new:booking':
      return 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)';
    case 'booking_assigned':
    case 'booking_accepted':
      return 'linear-gradient(135deg, #047857 0%, #10b981 100%)';
    default: return 'linear-gradient(135deg, #374151 0%, #6b7280 100%)';
  }
};

const timeAgo = (dateStr: string): string => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff)) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const normalize = (data: any): AdminNotification => ({
  _id: data?._id || data?.id || `tmp_${Date.now()}_${Math.random()}`,
  title: data?.title || data?.heading || 'New Alert',
  message: data?.message || data?.body || data?.description || '',
  type:
    typeof data?.type === 'string'
      ? data.type
      : data?.type?.key || data?.type?.name || 'info',
  isRead: Boolean(data?.isRead),
  createdAt: data?.createdAt || new Date().toISOString(),
  bookingId: data?.bookingId || data?.booking?.bookingId,
});

function dedupeKey(n: AdminNotification): string {
  return `${n.type}::${n.bookingId || n.title}`;
}

function isDuplicate(n: AdminNotification): boolean {
  const map = window.__UWE_NOTIF_DEDUPE__!;
  const key = dedupeKey(n);
  const now = Date.now();
  const last = map.get(key);
  if (map.size > 100) {
    for (const [k, t] of map.entries()) {
      if (now - t > 60_000) map.delete(k);
    }
  }
  if (last && now - last < 15_000) return true;
  map.set(key, now);
  return false;
}

function playAlertSound() {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const playTone = (freq: number, startTime: number, duration: number, vol = 0.3) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(vol, ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };
    playTone(880, 0, 0.18);
    playTone(1174, 0.2, 0.3);
    setTimeout(() => { try { ctx.close(); } catch {} }, 1200);
  } catch {}
}

/* ══════════════════════════════════════════════════════════════════
   ✅ SHOW SYSTEM NOTIFICATION (PC notification bar + Mobile)
   Uses Service Worker so it works even when tab is hidden/minimized
   ══════════════════════════════════════════════════════════════════ */
async function showSystemNotification(n: AdminNotification): Promise<void> {
  console.log('[Bell] 🔔 Attempting system notification:', n.title);

  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('[Bell] ❌ Notifications not supported');
    return;
  }

  if (Notification.permission !== 'granted') {
    console.warn('[Bell] ❌ Permission not granted:', Notification.permission);
    return;
  }

  const title = `${typeIcon(n.type)} ${n.title}`;
  const options: NotificationOptions = {
    body: n.message || 'New notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `${n.type}-${n.bookingId || n._id}`,
    requireInteraction: true,
    silent: false,
    data: {
      bookingId: n.bookingId,
      type: n.type,
      url: n.bookingId ? `/bookings?open=${n.bookingId}` : '/',
    },
  };

  (options as any).vibrate = [200, 100, 200];
  (options as any).renotify = true;

  // Try Service Worker first (works when tab hidden)
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js') ||
                  await navigator.serviceWorker.ready;
      if (reg) {
        await reg.showNotification(title, options);
        console.log('[Bell] ✅ System notification shown via SW');
        return;
      }
    }
  } catch (err: any) {
    console.warn('[Bell] ⚠️ SW notification failed, trying direct:', err?.message);
  }

  // Fallback: direct Notification constructor
  try {
    const notif = new Notification(title, options);
    notif.onclick = () => {
      window.focus();
      if (n.bookingId) {
        window.location.href = `/bookings?open=${n.bookingId}`;
      }
      notif.close();
    };
    console.log('[Bell] ✅ System notification shown directly');
  } catch (err: any) {
    console.error('[Bell] ❌ Direct notification failed:', err?.message);
  }
}

const RealtimeAlertBell: React.FC = () => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [permStatus, setPermStatus] =
    useState<NotificationPermission | 'unsupported'>('default');
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isPrimary, setIsPrimary] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const myIdRef = useRef<number>(0);
  const toastIdRef = useRef(0);

  useEffect(() => {
    const myId = ++window.__UWE_BELL_SEQ__!;
    myIdRef.current = myId;

    if (window.__UWE_BELL_PRIMARY_ID__ === undefined || window.__UWE_BELL_PRIMARY_ID__ === null) {
      window.__UWE_BELL_PRIMARY_ID__ = myId;
      setIsPrimary(true);
      console.log('[Bell] 👑 I am PRIMARY instance (id:', myId, ')');
    } else {
      setIsPrimary(false);
      console.log('[Bell] 👥 I am SECONDARY instance (id:', myId, ')');
      setTimeout(() => {
        if (window.__UWE_BELL_PRIMARY_ID__ === undefined) {
          window.__UWE_BELL_PRIMARY_ID__ = myId;
          setIsPrimary(true);
        }
      }, 500);
    }

    return () => {
      if (window.__UWE_BELL_PRIMARY_ID__ === myId) {
        window.__UWE_BELL_PRIMARY_ID__ = undefined;
      }
    };
  }, []);

  const syncPermission = useCallback(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermStatus('unsupported');
      return;
    }
    setPermStatus(Notification.permission);
  }, []);

  useEffect(() => {
    syncPermission();
    const onFocus = () => syncPermission();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [syncPermission]);

  const getAdminEmail = (): string => {
    try {
      for (const k of ['admin_data', 'admin', 'user', 'adminUser']) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const o = JSON.parse(raw);
        if (o?.email) return o.email;
        if (o?.data?.email) return o.data.email;
      }
    } catch {}
    return '';
  };

  const registerFcmWithBackend = useCallback(async (): Promise<boolean> => {
    try {
      const fb = await import('../lib/firebase');
      const anyFb = fb as any;
      let token: string | null = null;

      if (typeof anyFb.registerAdminPush === 'function') {
        token = await anyFb.registerAdminPush();
      } else if (typeof anyFb.getAdminFcmToken === 'function') {
        token = await anyFb.getAdminFcmToken();
      }

      if (!token || typeof token !== 'string') {
        console.warn('[Bell] ⚠️ No FCM token obtained');
        return false;
      }

      const email = getAdminEmail();
      console.log('[Bell] 📤 Registering FCM token with backend. Email:', email || '(none)');
      const result = await fcmApi.register(token, email);
      console.log('[Bell] ✅ FCM token registered:', result);
      return true;
    } catch (err: any) {
      console.error('[Bell] ❌ FCM register failed:', err?.message || err);
      return false;
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      setRequestError('This browser does not support notifications.');
      return;
    }

    if (Notification.permission === 'denied') {
      setRequestError(
        'Blocked by browser. Click 🔒/ⓘ icon left of URL → Notifications → Allow → reload.'
      );
      setPermStatus('denied');
      return;
    }

    setRequesting(true);
    setRequestError(null);
    try {
      const result = await Notification.requestPermission();
      setPermStatus(result);

      if (result === 'granted') {
        try {
          await showSystemNotification({
            _id: 'test-' + Date.now(),
            title: 'Notifications Enabled!',
            message: 'You will now receive alerts in your notification bar.',
            type: 'new_booking',
            isRead: false,
            createdAt: new Date().toISOString(),
          });
        } catch {}
        await registerFcmWithBackend();
      } else if (result === 'denied') {
        setRequestError('Permission denied. Click 🔒 icon → Notifications → Allow.');
      }
    } catch (err: any) {
      setRequestError(err?.message || 'Failed to request permission');
    } finally {
      setRequesting(false);
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const list = await notificationsApi.getRecent(25);
      const mapped = (Array.isArray(list) ? list : [])
        .map(normalize)
        .filter((n) => isAllowedNotification(n.type));
      setNotifications(mapped);
      setUnreadCount(mapped.filter((n) => !n.isRead).length);
    } catch (err) {
      console.warn('⚠️ Notification fetch skipped:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!isPrimary) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    (async () => {
      await registerFcmWithBackend();
    })();
  }, [isPrimary, registerFcmWithBackend]);

  const addToast = useCallback((n: AdminNotification) => {
    const id = `toast_${++toastIdRef.current}_${Date.now()}`;
    const toast: Toast = {
      id, title: n.title, message: n.message, type: n.type, bookingId: n.bookingId,
    };
    setToasts((prev) => [toast, ...prev].slice(0, 5));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 8000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const pushNotification = useCallback(
    (raw: any) => {
      const n = normalize(raw);

      console.log('[Bell] 📨 pushNotification called:', { type: n.type, bookingId: n.bookingId, title: n.title });

      // WHITELIST FILTER
      if (!isAllowedNotification(n.type)) {
        console.log('[Bell] 🔕 Filtered out (not whitelisted):', n.type);
        return;
      }

      if (isDuplicate(n)) {
        console.log('[Bell] 🚫 Duplicate blocked:', n.type, n.bookingId || n.title);
        return;
      }

      console.log('[Bell] ✅ Showing notification:', n.title);

      // In-app updates
      setNotifications((prev) => {
        if (prev.some((p) => p._id === n._id)) return prev;
        return [n, ...prev].slice(0, 50);
      });
      setUnreadCount((c) => c + 1);
      addToast(n);
      playAlertSound();

      // ✅ ALWAYS show system notification (works even when tab hidden/minimized)
      showSystemNotification(n).catch((err) => {
        console.error('[Bell] System notification error:', err);
      });
    },
    [addToast]
  );

  useEffect(() => {
    if (!isPrimary) return;

    let socket: any;
    try {
      socket = getSocket();
      console.log('[Bell] 🔌 Socket obtained. Connected:', socket.connected, 'ID:', socket.id);
    } catch (err) {
      console.warn('⚠️ Socket unavailable:', err);
      return;
    }

    const onNotification = (data: any) => {
      console.log('[Bell] 📬 admin:notification received:', data);
      pushNotification(data);
    };

    const onNewBooking = (data: any) => {
      console.log('[Bell] 🆕 new booking event received:', data);
      pushNotification({
        _id: `booking_${data?.bookingId || Date.now()}`,
        title: '🆕 New Booking Received',
        message: `${data?.bookingId || ''} · ${data?.serviceName || data?.customerName || 'New service request'}`,
        type: 'new_booking',
        bookingId: data?.bookingId,
      });
    };

    socket.on('admin:notification', onNotification);
    socket.on('new:booking', onNewBooking);
    socket.on('new_booking', onNewBooking);
    socket.on('booking:created', onNewBooking);

    const onFcmForeground = (e: any) => {
      const p = e?.detail || {};
      console.log('[Bell] 📨 FCM foreground message:', p);
      pushNotification({
        title: p?.notification?.title || p?.data?.title || 'New Alert',
        message: p?.notification?.body || p?.data?.body || '',
        type: p?.data?.type || 'new_booking',
        bookingId: p?.data?.bookingId,
      });
    };
    window.addEventListener('fcm-foreground-message', onFcmForeground);

    console.log('[Bell] ✅ All socket listeners attached');

    return () => {
      socket.off('admin:notification', onNotification);
      socket.off('new:booking', onNewBooking);
      socket.off('new_booking', onNewBooking);
      socket.off('booking:created', onNewBooking);
      window.removeEventListener('fcm-foreground-message', onFcmForeground);
    };
  }, [pushNotification, isPrimary]);

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await notificationsApi.markAllRead();
    } catch {}
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const showDefaultBanner = isPrimary && permStatus === 'default' && !bannerDismissed;
  const showDeniedBanner = isPrimary && permStatus === 'denied' && !bannerDismissed;

  return (
    <>
      {isPrimary && toasts.length > 0 && (
        <div
          style={{
            position: 'fixed', top: 80, right: 20, zIndex: 100000,
            display: 'flex', flexDirection: 'column', gap: 10,
            maxWidth: 380, pointerEvents: 'none',
          }}
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              style={{
                pointerEvents: 'auto',
                background: toastGradient(toast.type),
                color: '#fff', borderRadius: 12, padding: '14px 16px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
                animation: 'slideInRightBell 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                border: '1px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <span style={{ fontSize: 24, flexShrink: 0, lineHeight: 1 }}>
                {typeIcon(toast.type)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
                  {toast.title}
                </div>
                <div style={{ fontSize: 12, opacity: 0.95, lineHeight: 1.4 }}>
                  {toast.message}
                </div>
                {toast.bookingId && (
                  <div style={{
                    fontSize: 10, marginTop: 4, opacity: 0.8,
                    fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)',
                    padding: '2px 6px', borderRadius: 4, display: 'inline-block',
                  }}>
                    {toast.bookingId}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none',
                  color: '#fff', borderRadius: '50%', width: 24, height: 24,
                  cursor: 'pointer', fontSize: 14, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, padding: 0, lineHeight: 1,
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes slideInRightBell {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pulseBell {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.18); }
        }
      `}</style>

      <div className="relative" ref={dropdownRef}>
        {showDefaultBanner && (
          <div className="fixed top-20 right-6 z-[9999] bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-2xl p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔔</div>
              <div className="flex-1">
                <div className="font-bold text-sm">Enable Notifications</div>
                <div className="text-xs text-blue-100 mt-1">
                  Get instant browser alerts when a new booking arrives.
                </div>
                {requestError && (
                  <div className="text-xs text-red-200 mt-1">⚠️ {requestError}</div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={requestPermission}
                    disabled={requesting}
                    className="px-3 py-1.5 bg-white text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-50 transition disabled:opacity-50"
                  >
                    {requesting ? '⏳ Requesting...' : '✅ Allow Notifications'}
                  </button>
                  <button
                    onClick={() => setBannerDismissed(true)}
                    className="px-3 py-1.5 bg-blue-800/50 text-blue-100 rounded-lg text-xs hover:bg-blue-800 transition"
                  >
                    Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDeniedBanner && (
          <div className="fixed top-20 right-6 z-[9999] bg-white border-2 border-red-400 text-red-900 rounded-xl shadow-2xl p-4 max-w-md">
            <div className="flex items-start gap-3">
              <div className="text-3xl">🚫</div>
              <div className="flex-1">
                <div className="font-bold text-sm text-red-700">
                  Browser Notifications BLOCKED
                </div>
                <div className="text-xs text-gray-700 mt-1">
                  You previously clicked "Block". To get FCM push notifications and register your device token, you must manually unblock:
                </div>
                <ol className="text-xs text-gray-800 mt-2 space-y-1 list-decimal list-inside bg-red-50 p-2 rounded">
                  <li>Look at the URL bar — click the <strong>🔒 lock icon</strong> (left of URL)</li>
                  <li>Click <strong>"Site settings"</strong></li>
                  <li>Find <strong>"Notifications"</strong> → change from <strong>Block</strong> to <strong>Allow</strong></li>
                  <li>Return to this tab and click <strong>🔄 Reload</strong> below</li>
                </ol>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition"
                  >
                    🔄 Reload Page
                  </button>
                  <button
                    onClick={() => setBannerDismissed(true)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 transition"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="text-[10px] text-gray-500 mt-2 italic">
                  💡 In-app toast + sound still work without browser permission.
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setIsOpen((o) => !o)}
          className="relative p-2 rounded-full hover:bg-gray-100 transition"
          title="Notifications"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center"
              style={{ animation: 'pulseBell 1.5s ease-in-out infinite' }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 top-12 w-96 bg-white rounded-xl shadow-2xl border z-[9998] overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                🔔 Notifications
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchNotifications}
                  className="text-xs text-gray-500 hover:text-gray-800"
                  title="Refresh"
                >
                  🔄
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            {permStatus !== 'granted' && permStatus !== 'unsupported' && (
              <div className="px-3 py-2 bg-yellow-50 border-b text-xs text-yellow-800 flex items-center justify-between gap-2">
                <span>⚠️ Browser push off (in-app alerts work)</span>
                <button
                  onClick={requestPermission}
                  className="text-blue-600 font-bold hover:underline whitespace-nowrap"
                >
                  {permStatus === 'denied' ? 'How to fix' : 'Enable'}
                </button>
              </div>
            )}

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  <div className="text-3xl mb-2">🔕</div>
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n._id}
                    onClick={() => {
                      if (!n.isRead) {
                        notificationsApi.markRead(n._id).catch(() => {});
                        setNotifications((prev) =>
                          prev.map((x) => (x._id === n._id ? { ...x, isRead: true } : x))
                        );
                        setUnreadCount((c) => Math.max(0, c - 1));
                      }
                    }}
                    className={`px-3 py-2.5 border-b border-l-4 hover:bg-gray-50 transition cursor-pointer ${typeColor(
                      n.type
                    )} ${!n.isRead ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg leading-none mt-0.5">{typeIcon(n.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium truncate ${
                              !n.isRead ? 'text-gray-900' : 'text-gray-600'
                            }`}
                          >
                            {n.title}
                          </span>
                          {!n.isRead && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-400">{timeAgo(n.createdAt)}</span>
                          {n.bookingId && (
                            <span className="text-[10px] font-mono text-blue-500">{n.bookingId}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default RealtimeAlertBell;