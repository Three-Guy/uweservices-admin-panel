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
  validRecipients: number;
  invalidRecipients: number;
  duplicateRecipients: number;
  hasNameColumn: boolean;
  detectedFormat: string;
  detectedSeparator: string | null;
  headerRow: string | null;
  sampleRecipients: ParsedRecipient[];
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
  validRecipients: number;
  totalRecipients: number;
  durationMs: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

const BASE = '/admin/bulk-email';

export const bulkEmailApi = {
  // Preview upload — parse file and return stats
  async previewUpload(file: File): Promise<{ success: boolean; data: PreviewUploadResult; message?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post(`${BASE}/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Handle both { success, data: {...} } and { success, ...fields }
      const body = res.data;
      if (body.data) {
        return { success: true, data: body.data };
      }
      // Fallback: body IS the data
      return { success: true, data: body };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Preview failed';
      console.error('[bulkEmailApi] previewUpload error:', msg);
      return {
        success: false,
        message: msg,
        data: {
          fileName: file.name,
          fileSizeBytes: file.size,
          totalRows: 0,
          validRecipients: 0,
          invalidRecipients: 0,
          duplicateRecipients: 0,
          hasNameColumn: false,
          detectedFormat: 'unknown',
          detectedSeparator: null,
          headerRow: null,
          sampleRecipients: [],
          invalidSamples: [],
        },
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
      return { success: true, data: body.data || body };
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
      return { success: true, data: body.data || body };
    } catch (err: any) {
      return {
        success: false,
        data: { jobId, status: 'unknown', progress: 0, sent: 0, failed: 0, validRecipients: 0, totalRecipients: 0, durationMs: 0 },
      };
    }
  },

  // Get single job detail
  async getJob(jobId: string): Promise<{ success: boolean; data: { job: BulkEmailJob } }> {
    try {
      const res = await apiClient.get(`${BASE}/jobs/${jobId}`);
      const body = res.data;
      return { success: true, data: body.data || { job: body } };
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
      return { success: true, data: { jobs: d.jobs || [], ...d.pagination } };
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