// src/lib/directPushApi.ts
// Direct Push API client — full version with FCM browser endpoints
import apiClient from '../lib/api';

// ─── Types ───
export type DirectPushTargetMode =
  | 'single'
  | 'multiple'
  | 'all_providers'
  | 'all_users'
  | 'specific_provider'
  | 'specific_providers';

export interface DirectPushPayload {
  title: string;
  body: string;
  targetMode: DirectPushTargetMode;
  token?: string;
  tokens?: string[];
  providerId?: string;
  providerIds?: string[];
  imageUrl?: string;
  clickAction?: string;
  customData?: Record<string, string>;
}

export interface DirectPushResult {
  success: boolean;
  status: string;
  logId: string | null;
  targetMode: string;
  targetCount: number;
  successCount: number;
  failureCount: number;
  invalidTokenCount: number;
  durationMs: number;
  message: string;
  failures: Array<{
    token?: string;
    error: string;
    code?: string;
    invalidToken?: boolean;
  }>;
  cleanedUp?: {
    users: number;
    providers: number;
  };
}

export interface PreviewCountResult {
  targetMode: string;
  totalCount: number;
  withTokenCount: number;
  withoutTokenCount: number;
}

export interface ProviderSearchResult {
  _id: string;
  providerId: string;
  name: string;
  email: string;
  phone: string;
  profession?: string;
  city?: string;
  hasToken: boolean;
}

export interface DirectPushLog {
  _id: string;
  title: string;
  body: string;
  targetMode: string;
  targetCount: number;
  successCount: number;
  failureCount: number;
  invalidTokenCount: number;
  status: string;
  durationMs?: number;
  createdAt?: string;
  completedAt?: string;
  startedAt?: string;
  sentBy?: { email?: string; name?: string };
  failures?: Array<{
    token?: string;
    error: string;
    code?: string;
    providerId?: string;
    invalidToken?: boolean;
  }>;
  successes?: Array<{
    token?: string;
    messageId?: string;
    firebaseProject?: string;
  }>;
}

export interface FcmUserRecord {
  _id: string;
  name: string;
  email: string;
  phone: string;
  profilePicture: string | null;
  isActive: boolean;
  lastLogin: string | null;
  tokenCount: number;
  tokens: Array<{
    token: string;
    platform: string;
    deviceId: string | null;
    deviceModel: string | null;
    appVersion: string | null;
    createdAt: string | null;
    lastUsedAt: string | null;
  }>;
}

export interface FcmProviderRecord {
  _id: string;
  providerId: string;
  name: string;
  email: string;
  phone: string;
  profession: string;
  city: string;
  profilePicture: string | null;
  isActive: boolean;
  isOnline: boolean;
  isAvailable: boolean;
  verificationStatus: string;
  lastLogin: string | null;
  token: string;
  tokenPreview: string | null;
}

// ─── API Methods ───
const BASE = '/admin/direct-push';

export const directPushApi = {
  // Send push notification
  async send(payload: DirectPushPayload): Promise<{ success: boolean; data: DirectPushResult; message?: string }> {
    try {
      const res = await apiClient.post(`${BASE}/send`, payload);
      return { success: true, data: res.data };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Send failed';
      return { success: false, data: err.response?.data || {} as any, message: msg };
    }
  },

  // Preview count
  async previewCount(
    targetMode: DirectPushTargetMode,
    extra?: { providerId?: string; providerIds?: string[] }
  ): Promise<{ success: boolean; data: PreviewCountResult }> {
    try {
      const res = await apiClient.post(`${BASE}/preview-count`, { targetMode, ...extra });
      const d = res.data;
      return {
        success: true,
        data: {
          targetMode: d.targetMode || targetMode,
          totalCount: d.count || 0,
          withTokenCount: d.count || 0,
          withoutTokenCount: 0,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        data: { targetMode, totalCount: 0, withTokenCount: 0, withoutTokenCount: 0 },
      };
    }
  },

  // Search providers
  async searchProviders(
    query: string,
    limit = 15
  ): Promise<{ success: boolean; data: { providers: ProviderSearchResult[] } }> {
    try {
      const res = await apiClient.get(`${BASE}/search-providers`, {
        params: { q: query, limit },
      });
      return { success: true, data: { providers: res.data.providers || [] } };
    } catch (err: any) {
      return { success: false, data: { providers: [] } };
    }
  },

  // List users with FCM tokens
  async listFcmUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    success: boolean;
    users: FcmUserRecord[];
    total: number;
    page: number;
    pages: number;
  }> {
    try {
      const res = await apiClient.get(`${BASE}/fcm-users`, { params });
      return {
        success: true,
        users: res.data.users || [],
        total: res.data.total || 0,
        page: res.data.page || 1,
        pages: res.data.pages || 1,
      };
    } catch (err: any) {
      return { success: false, users: [], total: 0, page: 1, pages: 1 };
    }
  },

  // List providers with FCM tokens
  async listFcmProviders(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    success: boolean;
    providers: FcmProviderRecord[];
    total: number;
    page: number;
    pages: number;
  }> {
    try {
      const res = await apiClient.get(`${BASE}/fcm-providers`, { params });
      return {
        success: true,
        providers: res.data.providers || [],
        total: res.data.total || 0,
        page: res.data.page || 1,
        pages: res.data.pages || 1,
      };
    } catch (err: any) {
      return { success: false, providers: [], total: 0, page: 1, pages: 1 };
    }
  },

  // Get history
  async getHistory(params: {
    page?: number;
    limit?: number;
  }): Promise<{
    success: boolean;
    data: { logs: DirectPushLog[]; total: number; page: number; pages: number };
  }> {
    try {
      const res = await apiClient.get(`${BASE}/history`, { params });
      return {
        success: true,
        data: {
          logs: res.data.items || [],
          total: res.data.pagination?.total || 0,
          page: res.data.pagination?.page || 1,
          pages: res.data.pagination?.pages || 1,
        },
      };
    } catch (err: any) {
      return { success: false, data: { logs: [], total: 0, page: 1, pages: 1 } };
    }
  },

  // Get history detail
  async getHistoryDetail(
    id: string
  ): Promise<{ success: boolean; data: { log: DirectPushLog } }> {
    try {
      const res = await apiClient.get(`${BASE}/history/${id}`);
      return { success: true, data: { log: res.data.log } };
    } catch (err: any) {
      return { success: false, data: { log: {} as any } };
    }
  },
};

export default directPushApi;