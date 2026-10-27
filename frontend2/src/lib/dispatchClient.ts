// FILE: frontend2/src/lib/dispatchClient.ts
// COMPLETE WORKING API CLIENT

import axios, { AxiosInstance } from 'axios';

const ADMIN_SECRET = 'uwe_admin_super_secret_2026';

function getAuthToken(): string {
  const keys = ['admin_tokens', 'admin_token', 'token', 'auth_token', 'accessToken', 'access_token', 'jwt', 'adminToken'];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const tokenVal = parsed.accessToken || parsed.access_token || parsed.token || parsed.jwt;
          if (tokenVal && typeof tokenVal === 'string' && tokenVal.length > 20) return tokenVal;
        }
      } catch {}
      if (raw.length > 20 && !raw.startsWith('{')) return raw;
    } catch {}
  }
  return '';
}

function getBaseURL(): string {
  const envUrls = [
    (window as any).__RUNTIME_CONFIG__?.API_URL,
    import.meta.env?.VITE_API_URL,
    import.meta.env?.VITE_API_BASE_URL,
  ];
  for (const url of envUrls) {
    if (url && typeof url === 'string' && url.startsWith('http')) {
      return url.replace(/\/+$/, '');
    }
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5000/api/v1';
  }
  return 'https://uweservices-admin-panel.onrender.com/api/v1';
}

const apiClient: AxiosInstance = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'x-admin-secret': ADMIN_SECRET,
    'X-Admin-Secret': ADMIN_SECRET,
  }
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    config.headers['x-admin-secret'] = ADMIN_SECRET;
    config.headers['X-Admin-Secret'] = ADMIN_SECRET;
    console.log(`[DispatchClient] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[DispatchClient] Error:', error?.response?.status, error?.response?.data || error?.message);
    return Promise.reject(error);
  }
);

async function tryPaths(method: 'get' | 'post', paths: string[], dataOrParams?: any): Promise<any> {
  let lastError: any = null;
  for (const path of paths) {
    try {
      if (method === 'get') {
        return await apiClient.get(path, { params: dataOrParams });
      } else {
        return await apiClient.post(path, dataOrParams);
      }
    } catch (err: any) {
      lastError = err;
      if (err?.response?.status === 404) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export const manualDispatchApi = {
  getOnlineProviders: (params?: { all?: string; search?: string; category?: string }) => {
    const q: any = {};
    if (params?.all) q.all = params.all;
    if (params?.search) q.search = params.search;
    if (params?.category) q.category = params.category;
    return tryPaths('get', [
      '/admin/manual-dispatch/online-providers',
      '/manual-dispatch/online-providers',
    ], q);
  },

  getDispatchableBookings: (params?: { search?: string; status?: string }) => {
    const q: any = {};
    if (params?.search) q.search = params.search;
    if (params?.status) q.status = params.status;
    return tryPaths('get', [
      '/admin/manual-dispatch/dispatchable-bookings',
      '/manual-dispatch/dispatchable-bookings',
    ], q);
  },

  send: (data: { bookingId: string; providerId: string; adminNote?: string }) => {
    return tryPaths('post', [
      '/admin/manual-dispatch/send',
      '/admin/manual-dispatch/dispatch',
      '/admin/manual-dispatch/force-dispatch',
      '/manual-dispatch/send',
    ], data);
  },

  getOfferStatus: (offerId: string) => {
    return tryPaths('get', [
      `/admin/manual-dispatch/offer-status/${offerId}`,
      `/manual-dispatch/offer-status/${offerId}`,
    ]);
  },

  testFCM: (providerId: string) => {
    return tryPaths('post', [
      `/admin/manual-dispatch/test-fcm/${providerId}`,
      `/manual-dispatch/test-fcm/${providerId}`,
    ], {});
  },

  debug: () => tryPaths('get', ['/admin/manual-dispatch/debug', '/manual-dispatch/debug']),
  health: () => tryPaths('get', ['/admin/manual-dispatch/_health', '/manual-dispatch/_health']),
};

export const dispatchApi = manualDispatchApi;
export const fcmApi = manualDispatchApi;
export const notificationsApi = manualDispatchApi;
export const adminNotificationsApi = manualDispatchApi;

export default apiClient;