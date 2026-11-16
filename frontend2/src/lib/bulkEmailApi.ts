// src/lib/bulkEmailApi.ts
// Bulk Email API client — complete with all types and methods
import apiClient from '../lib/api';

// ─── Types ───
export interface ParsedRecipient {
  email: string;
  name: string | null;
  isValid: boolean;
  invalidReason?: string;
  row?: number;
}

export interface PreviewUploadResult {
  fileName: string;
  fileSizeBytes: number;
  totalRows: number;
  totalLinesScanned?: number;
  totalEmailsFound?: number;
  validRecipients: number;
  invalidRecipients: number;
  duplicateRecipients: number;
  hasNameColumn: boolean;
  hasHeaderRow?: boolean;
  detectedFormat: string;
  detectedSeparator: string | null;
  separator?: string | null;
  headerRow: string | null;
  sampleRecipients: ParsedRecipient[];  // Backend now returns ALL
  allRecipients?: ParsedRecipient[];
  invalidSamples: ParsedRecipient[];
}

export interface BulkEmailJob {
  _id: string;
  fileName: string;
  fileSizeBytes: number;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  totalRecipients: number;
  validRecipients: number;
  invalidRecipients: number;
  duplicateRecipients: number;
  sent: number;
  failed: number;
  skipped: number;
  progress: number;
  status: string;
  hasNameColumn: boolean;
  detectedFormat: string;
  failures?: Array<{ email: string; errorMessage: string; errorCode?: string }>;
  durationMs?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  createdBy?: { email?: string; name?: string };
}

export interface JobProgress {
  jobId: string;
  status: string;
  progress: number;
  sent: number;
  failed: number;
  skipped?: number;
  validRecipients: number;
  totalRecipients: number;
  durationMs: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  errorMessage?: string;
}

const BASE = '/admin/bulk-email';

// Normalize backend response to frontend shape
function normalizePreview(raw: any, file: File): PreviewUploadResult {
  const d = raw || {};
  return {
    fileName: d.fileName || file.name,
    fileSizeBytes: d.fileSizeBytes || d.fileSize || file.size,
    totalRows: d.totalRows ?? 0,
    totalLinesScanned: d.totalLinesScanned,
    totalEmailsFound: d.totalEmailsFound,
    validRecipients: d.validRecipients ?? d.validCount ?? 0,
    invalidRecipients: d.invalidRecipients ?? d.invalidCount ?? 0,
    duplicateRecipients: d.duplicateRecipients ?? d.duplicateCount ?? 0,
    hasNameColumn: d.hasNameColumn ?? d.hasNames ?? false,
    hasHeaderRow: d.hasHeaderRow,
    detectedFormat: d.detectedFormat || d.format || 'unknown',
    detectedSeparator: d.detectedSeparator ?? d.separator ?? null,
    separator: d.separator,
    headerRow: d.headerRow ?? null,
    sampleRecipients: d.sampleRecipients || d.allRecipients || [],
    allRecipients: d.allRecipients || d.sampleRecipients || [],
    invalidSamples: d.invalidSamples || [],
  };
}

export const bulkEmailApi = {
  // Preview upload — parse file and return stats
  async previewUpload(file: File): Promise<{ success: boolean; data: PreviewUploadResult; message?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post(`${BASE}/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const body = res.data;
      const raw = body.data || body;
      return { success: true, data: normalizePreview(raw, file) };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Preview failed';
      console.error('[bulkEmailApi] previewUpload error:', msg);
      return {
        success: false,
        message: msg,
        data: normalizePreview({}, file),
      };
    }
  },

  // Start bulk send
  async startBulkSend(
    file: File,
    subject: string,
    htmlBody: string,
    textBody?: string
  ): Promise<{ success: boolean; data: any; message?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('subject', subject);
      formData.append('htmlBody', htmlBody);
      if (textBody) formData.append('textBody', textBody);

      const res = await apiClient.post(`${BASE}/send`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const body = res.data;
      const d = body.data || body;
      return {
        success: true,
        data: {
          jobId: d.jobId,
          validRecipients: d.validRecipients ?? d.validCount ?? 0,
          invalidRecipients: d.invalidRecipients ?? d.invalidCount ?? 0,
          duplicateRecipients: d.duplicateRecipients ?? d.duplicateCount ?? 0,
          totalRecipients: d.totalRecipients ?? d.validRecipients ?? 0,
          status: d.status,
          message: d.message,
        },
      };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Send failed';
      return { success: false, data: {}, message: msg };
    }
  },

  // Get job progress
  async getJobProgress(jobId: string): Promise<{ success: boolean; data: JobProgress }> {
    try {
      const res = await apiClient.get(`${BASE}/jobs/${jobId}/progress`);
      const body = res.data;
      const d = body.data || body;
      return {
        success: true,
        data: {
          jobId: d.jobId || jobId,
          status: d.status || 'unknown',
          progress: d.progress ?? 0,
          sent: d.sent ?? 0,
          failed: d.failed ?? 0,
          skipped: d.skipped ?? 0,
          validRecipients: d.validRecipients ?? d.totalRecipients ?? 0,
          totalRecipients: d.totalRecipients ?? 0,
          durationMs: d.durationMs ?? 0,
          startedAt: d.startedAt,
          completedAt: d.completedAt,
          error: d.error || d.errorMessage,
          errorMessage: d.errorMessage,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        data: {
          jobId,
          status: 'unknown',
          progress: 0,
          sent: 0,
          failed: 0,
          validRecipients: 0,
          totalRecipients: 0,
          durationMs: 0,
        },
      };
    }
  },

  // Get single job detail
  async getJob(jobId: string): Promise<{ success: boolean; data: { job: BulkEmailJob } }> {
    try {
      const res = await apiClient.get(`${BASE}/jobs/${jobId}`);
      const body = res.data;
      const d = body.data || body;
      const job = d.job || d;
      return { success: true, data: { job } };
    } catch (err: any) {
      return { success: false, data: { job: {} as any } };
    }
  },

  // List jobs
  async listJobs(params: { page?: number; limit?: number }): Promise<{
    success: boolean;
    data: { jobs: BulkEmailJob[]; total?: number; page?: number; pages?: number };
  }> {
    try {
      const res = await apiClient.get(`${BASE}/jobs`, { params });
      const body = res.data;
      const d = body.data || body;
      const jobs = Array.isArray(d) ? d : (d.jobs || []);
      const pagination = d.pagination || {};
      return {
        success: true,
        data: {
          jobs,
          total: pagination.total,
          page: pagination.page,
          pages: pagination.pages,
        },
      };
    } catch (err: any) {
      return { success: false, data: { jobs: [] } };
    }
  },

  // Cancel job
  async cancelJob(jobId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await apiClient.post(`${BASE}/jobs/${jobId}/cancel`);
      return { success: true, message: res.data?.message };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || err.message };
    }
  },
};

export default bulkEmailApi;