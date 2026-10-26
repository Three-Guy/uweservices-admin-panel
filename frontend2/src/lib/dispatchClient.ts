// src/lib/dispatchClient.ts
// ══════════════════════════════════════════════════════════════
// STANDALONE API CLIENT for Dispatch + Admin Notifications
// Independent of api.ts — no naming conflicts, no missing methods
// ══════════════════════════════════════════════════════════════
import axios, { AxiosInstance, AxiosResponse } from 'axios';

/* ─────────────────────────────────────────────
   BASE URL
   ───────────────────────────────────────────── */
const RAW_BASE =
  (import.meta.env.VITE_API_URL as string) ||
  (import.meta.env.VITE_API_BASE_URL as string) ||
  'https://uweservices-admin-panel.onrender.com/api/v1';

// Remove trailing slash
const BASE_URL = RAW_BASE.replace(/\/+$/, '');

console.log('🔧 DispatchClient Base URL:', BASE_URL);

/* ─────────────────────────────────────────────
   TOKEN RESOLVER (checks every possible key)
   ───────────────────────────────────────────── */
function getAuthToken(): string | null {
  // ── 1. Direct localStorage keys (most common) ──
  const directKeys = [
    'admin_token',       // ← AuthContext now stores here explicitly
    'adminToken',
    'token',
    'access_token',
    'accessToken',
    'authToken',
    'auth_token',
    'jwt',
    'jwt_token',
    'admin_jwt',
    'admin_access_token',
  ];

  for (const key of directKeys) {
    const val = localStorage.getItem(key);
    if (val && val !== 'undefined' && val !== 'null' && val.length > 10) {
      const cleaned = val.replace(/^"|"$/g, '');
      if (cleaned.length > 10) return cleaned;
    }
  }

  // ── 2. Nested inside JSON objects in localStorage ──
  const objectKeys = [
    'admin_data',
    'admin',
    'user',
    'adminUser',
    'tokens',
    'auth_data',
    'credentials',
    'admin_credentials',
    'session',
    'auth',
  ];

  for (const key of objectKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') continue;

      // Direct token fields
      if (parsed.token && typeof parsed.token === 'string' && parsed.token.length > 10) return parsed.token;
      if (parsed.accessToken && typeof parsed.accessToken === 'string' && parsed.accessToken.length > 10) return parsed.accessToken;
      if (parsed.access_token && typeof parsed.access_token === 'string' && parsed.access_token.length > 10) return parsed.access_token;
      if (parsed.jwt && typeof parsed.jwt === 'string' && parsed.jwt.length > 10) return parsed.jwt;

      // Nested: data.token / data.accessToken
      if (parsed.data?.token && typeof parsed.data.token === 'string' && parsed.data.token.length > 10) return parsed.data.token;
      if (parsed.data?.accessToken && typeof parsed.data.accessToken === 'string' && parsed.data.accessToken.length > 10) return parsed.data.accessToken;

      // Nested: tokens.accessToken / tokens.token (login response shape)
      if (parsed.tokens?.accessToken && typeof parsed.tokens.accessToken === 'string' && parsed.tokens.accessToken.length > 10) return parsed.tokens.accessToken;
      if (parsed.tokens?.token && typeof parsed.tokens.token === 'string' && parsed.tokens.token.length > 10) return parsed.tokens.token;
    } catch {
      /* ignore parse error */
    }
  }

  // ── 3. Last resort: scan ALL localStorage for JWT-like strings ──
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key);
      if (val && val.startsWith('eyJ') && val.length > 20) {
        console.log(`[dispatchClient] 🔍 Found JWT in localStorage key "${key}"`);
        return val;
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}

/* ─────────────────────────────────────────────
   AXIOS INSTANCE
   ───────────────────────────────────────────── */
const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 45000, // Render cold start can be slow
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  } else {
    console.warn('[dispatchClient] ⚠️ No auth token found for request:', config.url);
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err?.config?.url || 'unknown';
    const status = err?.response?.status;
    console.warn(`⚠️ [dispatchClient] ${status || 'NETWORK'} on ${url}`);
    return Promise.reject(err);
  }
);

/* ─────────────────────────────────────────────
   RESPONSE HELPERS
   ───────────────────────────────────────────── */
function unwrap(res: AxiosResponse): any {
  const body = res?.data;
  if (body == null) return null;
  // { success: true, data: ... }
  if (typeof body === 'object' && 'data' in body && !Array.isArray(body)) {
    return (body as any).data;
  }
  return body;
}

function toList(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.docs)) return raw.docs;
  if (Array.isArray(raw.results)) return raw.results;
  if (Array.isArray(raw.bookings)) return raw.bookings;
  if (Array.isArray(raw.notifications)) return raw.notifications;
  if (Array.isArray(raw.offers)) return raw.offers;
  if (Array.isArray(raw.providers)) return raw.providers;
  if (Array.isArray(raw.dispatches)) return raw.dispatches;
  return [];
}

/** Try multiple endpoint paths until one succeeds */
async function tryPaths(
  method: 'get' | 'post' | 'patch' | 'put',
  paths: string[],
  payload?: any,
  params?: any
): Promise<any> {
  let lastErr: any = null;
  for (const path of paths) {
    try {
      const res =
        method === 'get'
          ? await client.get(path, { params })
          : method === 'post'
          ? await client.post(path, payload || {})
          : method === 'patch'
          ? await client.patch(path, payload || {})
          : await client.put(path, payload || {});
      return unwrap(res);
    } catch (e: any) {
      lastErr = e;
      // Only fall through on 404 (endpoint doesn't exist)
      if (e?.response?.status && e.response.status !== 404) throw e;
    }
  }
  throw lastErr || new Error('All endpoint paths failed');
}

/* ══════════════════════════════════════════════
   DISPATCH API
   ══════════════════════════════════════════════ */
export const dispatchApi = {
  /** Live dispatch engine stats */
  getStats: async (): Promise<any> => {
    return tryPaths('get', [
      '/admin/dispatch/stats',
      '/admin/dispatch-stats',
      '/dispatch/stats',
    ]);
  },

  /** Currently running dispatches */
  getActive: async (): Promise<any[]> => {
    const raw = await tryPaths('get', [
      '/admin/dispatch/active',
      '/dispatch/active',
    ]);
    return toList(raw);
  },

  /** Bookings where no provider was found */
  getNoProviderFound: async (): Promise<any[]> => {
    const raw = await tryPaths('get', [
      '/admin/dispatch/no-provider-found',
      '/dispatch/no-provider-found',
    ]);
    return toList(raw);
  },

  /** All unassigned bookings (confirmed / searching / no_provider_found) */
  getUnassignedBookings: async (): Promise<any[]> => {
    const raw = await tryPaths('get', [
      '/admin/dispatch/unassigned',
      '/admin/bookings/unassigned',
      '/dispatch/unassigned',
    ]);
    return toList(raw);
  },

  /** Eligible providers for a booking */
  getEligibleProviders: async (bookingId: string): Promise<any[]> => {
    const raw = await tryPaths('get', [
      `/admin/dispatch/eligible-providers/${bookingId}`,
      `/dispatch/eligible-providers/${bookingId}`,
    ]);
    return toList(raw);
  },

  /** Deep debug: why providers were filtered out */
  getEligibleProvidersDebug: async (bookingId: string): Promise<any> => {
    return tryPaths('get', [
      `/admin/dispatch/eligible-providers-debug/${bookingId}`,
      `/dispatch/eligible-providers-debug/${bookingId}`,
    ]);
  },

  /** Manually trigger dispatch */
  trigger: async (bookingId: string): Promise<any> => {
    return tryPaths('post', [
      `/admin/dispatch/trigger/${bookingId}`,
      `/dispatch/trigger/${bookingId}`,
    ]);
  },

  /** Reassign to a specific provider */
  reassign: async (bookingId: string, providerId?: string): Promise<any> => {
    return tryPaths(
      'post',
      [
        `/admin/dispatch/reassign/${bookingId}`,
        `/dispatch/reassign/${bookingId}`,
      ],
      providerId ? { providerId } : {}
    );
  },

  /** Clear cooldown + supersede offers + re-run dispatch */
  autoRedispatch: async (bookingId: string): Promise<any> => {
    return tryPaths('post', [
      `/admin/dispatch/auto-redispatch/${bookingId}`,
      `/dispatch/auto-redispatch/${bookingId}`,
    ]);
  },

  /** Force-assign a provider (no offer flow) */
  assignManual: async (bookingId: string, providerId: string): Promise<any> => {
    return tryPaths(
      'post',
      [
        `/admin/dispatch/assign-manual/${bookingId}`,
        `/dispatch/assign-manual/${bookingId}`,
      ],
      { providerId }
    );
  },
};

/* ══════════════════════════════════════════════
   ADMIN NOTIFICATIONS API
   ══════════════════════════════════════════════ */
export const notificationsApi = {
  /** Recent notifications — ALWAYS returns an array */
  getRecent: async (limit = 20): Promise<any[]> => {
    try {
      const raw = await tryPaths(
        'get',
        [
          '/admin/admin-notifications',
          '/admin/notifications',
          '/admin/alerts',
        ],
        undefined,
        { limit, page: 1 }
      );
      return toList(raw);
    } catch (err) {
      console.warn('⚠️ getRecent failed, returning empty list');
      return [];
    }
  },

  /** Unread count */
  getUnreadCount: async (): Promise<number> => {
    try {
      const raw = await tryPaths('get', [
        '/admin/admin-notifications/unread-count',
        '/admin/notifications/unread-count',
      ]);
      if (typeof raw === 'number') return raw;
      return raw?.count ?? raw?.unread ?? raw?.unreadCount ?? 0;
    } catch {
      return 0;
    }
  },

  /** Mark one as read */
  markRead: async (id: string): Promise<void> => {
    try {
      await tryPaths('patch', [
        `/admin/admin-notifications/${id}/read`,
        `/admin/notifications/${id}/read`,
      ]);
    } catch {
      try {
        await tryPaths('post', [
          `/admin/admin-notifications/${id}/read`,
          `/admin/notifications/${id}/read`,
        ]);
      } catch {
        /* non-critical */
      }
    }
  },

  /** Mark all as read */
  markAllRead: async (): Promise<void> => {
    const paths = [
      '/admin/admin-notifications/mark-all-read',
      '/admin/admin-notifications/read-all',
      '/admin/notifications/mark-all-read',
      '/admin/notifications/read-all',
    ];
    try {
      await tryPaths('patch', paths);
    } catch {
      try {
        await tryPaths('post', paths);
      } catch {
        console.warn('⚠️ markAllRead endpoint not found (non-critical)');
      }
    }
  },
};

/* ══════════════════════════════════════════════
   FCM TOKEN REGISTRATION
   ══════════════════════════════════════════════ */
export const fcmApi = {
  register: async (fcmToken: string, adminEmail?: string): Promise<any> => {
    let email = adminEmail || '';
    if (!email) {
      try {
        const raw = localStorage.getItem('admin_data');
        if (raw) email = JSON.parse(raw)?.email || '';
      } catch {
        /* ignore */
      }
    }
    return tryPaths(
      'post',
      ['/admin/fcm/register', '/admin/fcm-token/register'],
      { fcmToken, token: fcmToken, adminEmail: email, email }
    );
  },

  unregister: async (fcmToken: string): Promise<any> => {
    return tryPaths(
      'post',
      ['/admin/fcm/unregister', '/admin/fcm-token/unregister'],
      { fcmToken, token: fcmToken }
    );
  },
};

export default client;