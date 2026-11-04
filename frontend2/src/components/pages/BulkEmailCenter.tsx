// src/pages/BulkEmailCenter.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mail,
  Upload,
  FileText,
  RefreshCw,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  History,
  Users,
  Download,
  Code2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../lib/api';

interface PreviewData {
  fileName: string;
  fileSizeBytes: number;
  totalLines: number;
  validCount: number;
  invalidCount: number;
  duplicatesCount: number;
  sampleValid: Array<{ email: string; name: string }>;
  sampleInvalid: Array<{ line: number; raw: string; reason: string }>;
}

interface JobItem {
  _id: string;
  fileName: string;
  subject: string;
  status: string;
  progress: number;
  totalRecipients: number;
  validRecipients: number;
  sent: number;
  failed: number;
  skipped: number;
  createdAt: string;
  completedAt: string | null;
  durationMs: number;
}

interface JobProgress {
  status: string;
  progress: number;
  sent: number;
  failed: number;
  skipped: number;
  totalRecipients: number;
  validRecipients: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export default function BulkEmailCenter() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState(
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #4f46e5;">Hello {{name}},</h2>
  <p>Your message here...</p>
  <p>Best regards,<br/>The Team</p>
</div>`
  );

  // Preview/upload state
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);

  // Active job tracking
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null);

  // History
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);

  // --------------- File handling ---------------
  const handleFile = (f: File | null) => {
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'txt') {
      toast.error('Only .csv or .txt files allowed');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('File too large (max 10 MB)');
      return;
    }
    setFile(f);
    setPreview(null);
  };

  const uploadPreview = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post('/v1/admin/bulk-email/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        setPreview(res.data.data);
        toast.success(`Parsed ${res.data.data.validCount} valid emails`);
      } else {
        toast.error(res.data?.message || 'Preview failed');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Preview failed');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (file) uploadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // --------------- Start sending ---------------
  const canSend = useMemo(() => {
    if (!file || !preview) return false;
    if (preview.validCount === 0) return false;
    if (!subject.trim() || !htmlBody.trim()) return false;
    return true;
  }, [file, preview, subject, htmlBody]);

  const handleStart = async () => {
    if (!canSend || !file || !preview) return;
    if (
      !confirm(
        `Send email to ${preview.validCount} recipients?\n\nThis cannot be undone once started.`
      )
    )
      return;

    setStarting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('subject', subject.trim());
      fd.append('htmlBody', htmlBody);

      const res = await apiClient.post('/v1/admin/bulk-email/send', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        setActiveJobId(res.data.data.jobId);
        toast.success(`Job queued: ${res.data.data.validRecipients} recipients`);
      } else {
        toast.error(res.data?.message || 'Failed to start');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to start job');
    } finally {
      setStarting(false);
    }
  };

  // --------------- Progress polling ---------------
  useEffect(() => {
    if (!activeJobId) return;
    let stopped = false;

    const poll = async () => {
      try {
        const res = await apiClient.get(`/v1/admin/bulk-email/jobs/${activeJobId}/progress`);
        if (res.data?.success && !stopped) {
          setJobProgress(res.data.data);
          const terminal = ['completed', 'completed_with_errors', 'failed', 'cancelled'];
          if (terminal.includes(res.data.data.status)) {
            return;
          }
        }
      } catch {
        /* noop */
      }
      if (!stopped) setTimeout(poll, 2500);
    };
    poll();

    return () => {
      stopped = true;
    };
  }, [activeJobId]);

  // --------------- History ---------------
  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
      const res = await apiClient.get('/v1/admin/bulk-email/jobs', {
        params: { page: 1, limit: 25 },
      });
      if (res.data?.success) setJobs(res.data.data.items);
    } catch {
      /* noop */
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    if (showHistory) fetchJobs();
  }, [showHistory]);

  const openJob = async (id: string) => {
    try {
      const res = await apiClient.get(`/v1/admin/bulk-email/jobs/${id}`);
      if (res.data?.success) setSelectedJob(res.data.data);
    } catch {
      toast.error('Failed to load job');
    }
  };

  // --------------- UI helpers ---------------
  const formatBytes = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatMs = (ms?: number) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const renderedPreviewHtml = useMemo(() => {
    const sample = preview?.sampleValid?.[0];
    const name = sample?.name || 'John Doe';
    const email = sample?.email || 'john@example.com';
    return htmlBody
      .replace(/\{\{\s*name\s*\}\}/g, name)
      .replace(/\{\{\s*email\s*\}\}/g, email);
  }, [htmlBody, preview]);

  const renderedSubject = useMemo(() => {
    const sample = preview?.sampleValid?.[0];
    const name = sample?.name || 'John Doe';
    const email = sample?.email || 'john@example.com';
    return subject
      .replace(/\{\{\s*name\s*\}\}/g, name)
      .replace(/\{\{\s*email\s*\}\}/g, email);
  }, [subject, preview]);

  // --------------- Render ---------------
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-indigo-600" />
            Bulk Email Upload
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload CSV/TXT to send personalized emails in bulk
          </p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-semibold text-gray-700"
        >
          <History className="w-4 h-4" /> History
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ============ LEFT: FORM ============ */}
        <div className="lg:col-span-2 space-y-5">
          {/* Step 1: Upload */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">1. Upload Recipient File</h3>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer transition-colors"
            >
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">
                {file ? file.name : 'Click or drag file here'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                .csv or .txt — max 10 MB
              </p>
              {file && (
                <p className="text-[11px] text-indigo-600 font-semibold mt-2">
                  {formatBytes(file.size)}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
              <p className="font-bold mb-1">Supported formats:</p>
              <ul className="space-y-0.5 pl-4 list-disc">
                <li><b>TXT:</b> one email per line</li>
                <li><b>CSV with header:</b> <code className="bg-white px-1 rounded">email,name</code></li>
                <li><b>CSV no header:</b> first column = email, optional second = name</li>
              </ul>
            </div>

            {uploading && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg text-center text-xs text-gray-600">
                <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                Parsing file...
              </div>
            )}

            {preview && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  <div className="p-2 bg-gray-50 rounded text-center">
                    <p className="text-lg font-black text-gray-900">{preview.totalLines}</p>
                    <p className="text-[9px] text-gray-600 font-semibold uppercase">Lines</p>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded text-center">
                    <p className="text-lg font-black text-emerald-700">{preview.validCount}</p>
                    <p className="text-[9px] text-emerald-800 font-semibold uppercase">Valid</p>
                  </div>
                  <div className="p-2 bg-red-50 rounded text-center">
                    <p className="text-lg font-black text-red-700">{preview.invalidCount}</p>
                    <p className="text-[9px] text-red-800 font-semibold uppercase">Invalid</p>
                  </div>
                  <div className="p-2 bg-amber-50 rounded text-center">
                    <p className="text-lg font-black text-amber-700">{preview.duplicatesCount}</p>
                    <p className="text-[9px] text-amber-800 font-semibold uppercase">Dupes</p>
                  </div>
                </div>

                {preview.sampleValid.length > 0 && (
                  <details className="group" open>
                    <summary className="cursor-pointer text-xs font-bold text-gray-700 py-1">
                      Sample Valid ({preview.sampleValid.length})
                    </summary>
                    <div className="max-h-32 overflow-y-auto border border-gray-200 rounded p-2 bg-white text-[11px] font-mono">
                      {preview.sampleValid.map((r, i) => (
                        <div key={i} className="py-0.5 text-gray-700 flex justify-between">
                          <span>{r.email}</span>
                          <span className="text-gray-500">{r.name || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {preview.sampleInvalid.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-bold text-red-700 py-1">
                      Sample Invalid ({preview.sampleInvalid.length})
                    </summary>
                    <div className="max-h-32 overflow-y-auto border border-red-200 rounded p-2 bg-red-50 text-[11px] font-mono">
                      {preview.sampleInvalid.map((r, i) => (
                        <div key={i} className="py-0.5">
                          <span className="text-gray-600">L{r.line}:</span>{' '}
                          <span className="text-red-700">{r.raw}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Compose */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">2. Compose Email</h3>

            <div className="mb-2 p-2 bg-indigo-50 border border-indigo-200 rounded text-[11px] text-indigo-900 flex items-start gap-2">
              <Code2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Use <code className="bg-white px-1 rounded">{'{{name}}'}</code> and{' '}
                <code className="bg-white px-1 rounded">{'{{email}}'}</code> as template
                variables.
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Subject *</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={300}
                  placeholder="e.g. Hello {{name}}, special offer inside!"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-[10px] text-gray-500 mt-0.5">{subject.length}/300</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">HTML Body *</label>
                <textarea
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono"
                  placeholder="<div>Hello {{name}}...</div>"
                />
              </div>

              <button
                onClick={() => setShowHtmlPreview(true)}
                disabled={!htmlBody.trim()}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-xs font-semibold text-gray-700 disabled:opacity-40"
              >
                <Eye className="w-3.5 h-3.5" /> Preview Rendered HTML
              </button>
            </div>
          </div>

          {/* Step 3: Send */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Recipients ready to send</p>
              <p className="text-2xl font-black text-gray-900">
                {preview?.validCount ?? 0}
              </p>
            </div>
            <button
              onClick={handleStart}
              disabled={!canSend || starting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-md disabled:opacity-40"
            >
              {starting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Queuing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Start Sending
                </>
              )}
            </button>
          </div>

          {/* Active job progress */}
          {activeJobId && jobProgress && (
            <div className="bg-white rounded-xl border-2 border-indigo-300 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <RefreshCw
                  className={`w-4 h-4 text-indigo-600 ${
                    ['running', 'queued'].includes(jobProgress.status) ? 'animate-spin' : ''
                  }`}
                />
                Active Job
                <span
                  className={`ml-auto px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                    jobProgress.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-700'
                      : jobProgress.status === 'completed_with_errors'
                      ? 'bg-amber-100 text-amber-700'
                      : jobProgress.status === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-indigo-100 text-indigo-700'
                  }`}
                >
                  {jobProgress.status}
                </span>
              </h3>

              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${jobProgress.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600 mb-3">
                <span className="font-semibold">{jobProgress.progress}% complete</span>
                <span>
                  {jobProgress.sent + jobProgress.failed + jobProgress.skipped} /{' '}
                  {jobProgress.validRecipients}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-emerald-50 rounded text-center">
                  <p className="text-lg font-black text-emerald-700">{jobProgress.sent}</p>
                  <p className="text-[9px] text-emerald-800 font-semibold uppercase">Sent</p>
                </div>
                <div className="p-2 bg-red-50 rounded text-center">
                  <p className="text-lg font-black text-red-700">{jobProgress.failed}</p>
                  <p className="text-[9px] text-red-800 font-semibold uppercase">Failed</p>
                </div>
                <div className="p-2 bg-gray-50 rounded text-center">
                  <p className="text-lg font-black text-gray-700">{jobProgress.skipped}</p>
                  <p className="text-[9px] text-gray-800 font-semibold uppercase">Skipped</p>
                </div>
              </div>

              {jobProgress.completedAt && (
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-600">
                  <span>Duration: {formatMs(jobProgress.durationMs)}</span>
                  <button
                    onClick={() => openJob(activeJobId)}
                    className="text-indigo-600 font-semibold hover:underline"
                  >
                    View full report →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============ RIGHT: PREVIEW ============ */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-600" /> Email Preview
            </h3>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
                <p className="text-[10px] text-gray-500">Subject:</p>
                <p className="text-sm font-bold text-gray-900 truncate">
                  {renderedSubject || '(no subject)'}
                </p>
              </div>
              <div className="bg-white p-3 max-h-96 overflow-y-auto">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderedPreviewHtml }}
                />
              </div>
            </div>

            <p className="text-[10px] text-gray-500 mt-2">
              Preview uses first valid recipient's data.
            </p>
          </div>
        </div>
      </div>

      {/* ============ HISTORY DRAWER ============ */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowHistory(false)} />
          <div className="relative w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" /> Email Job History
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {loadingJobs && (
                <div className="p-10 text-center text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
                </div>
              )}
              {!loadingJobs && jobs.length === 0 && (
                <div className="p-10 text-center text-gray-500">
                  <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p>No email jobs yet</p>
                </div>
              )}
              {!loadingJobs &&
                jobs.map((j) => (
                  <button
                    key={j._id}
                    onClick={() => openJob(j._id)}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg mb-2 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-bold text-gray-900 truncate">{j.subject}</p>
                      <span
                        className={`flex-shrink-0 px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          j.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : j.status === 'completed_with_errors'
                            ? 'bg-amber-100 text-amber-700'
                            : j.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {j.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
                      <FileText className="w-3 h-3" />
                      <span className="truncate">{j.fileName}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden mb-1">
                      <div
                        className="h-full bg-indigo-500 transition-all"
                        style={{ width: `${j.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-700 font-bold">✓ {j.sent}</span>
                        <span className="text-red-700 font-bold">✗ {j.failed}</span>
                        <span className="text-gray-600 font-bold">⊘ {j.skipped}</span>
                        <span>/{j.validRecipients}</span>
                      </div>
                      <span>{new Date(j.createdAt).toLocaleString()}</span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ============ JOB DETAIL MODAL ============ */}
      {selectedJob && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold">Job Report</h3>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <p className="text-sm font-bold text-gray-900">{selectedJob.subject}</p>
              <p className="text-xs text-gray-500 mb-3">{selectedJob.fileName}</p>

              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="p-2 bg-gray-50 rounded text-center">
                  <p className="text-lg font-black text-gray-900">
                    {selectedJob.validRecipients}
                  </p>
                  <p className="text-[9px] text-gray-600 font-semibold uppercase">Total</p>
                </div>
                <div className="p-2 bg-emerald-50 rounded text-center">
                  <p className="text-lg font-black text-emerald-700">{selectedJob.sent}</p>
                  <p className="text-[9px] text-emerald-800 font-semibold uppercase">Sent</p>
                </div>
                <div className="p-2 bg-red-50 rounded text-center">
                  <p className="text-lg font-black text-red-700">{selectedJob.failed}</p>
                  <p className="text-[9px] text-red-800 font-semibold uppercase">Failed</p>
                </div>
                <div className="p-2 bg-gray-50 rounded text-center">
                  <p className="text-lg font-black text-gray-700">{selectedJob.skipped}</p>
                  <p className="text-[9px] text-gray-800 font-semibold uppercase">Skipped</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-600 mb-3">
                <span>Started: {selectedJob.startedAt ? new Date(selectedJob.startedAt).toLocaleString() : '—'}</span>
                <span>Duration: {formatMs(selectedJob.durationMs)}</span>
              </div>

              {selectedJob.failures && selectedJob.failures.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-700 mb-2">
                    Failures ({selectedJob.failures.length})
                  </p>
                  <div className="max-h-64 overflow-y-auto border border-red-200 rounded">
                    {selectedJob.failures.map((f: any, i: number) => (
                      <div
                        key={i}
                        className="p-2 border-b border-red-100 bg-red-50 text-[11px]"
                      >
                        <p className="font-semibold text-gray-900">
                          {f.email} {f.name && <span className="text-gray-500">({f.name})</span>}
                        </p>
                        <p className="text-red-700">{f.errorMessage}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ HTML PREVIEW MODAL ============ */}
      {showHtmlPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold">Rendered Preview</h3>
              <button
                onClick={() => setShowHtmlPreview(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <p className="text-xs text-gray-500 mb-1">Subject:</p>
              <p className="text-sm font-bold mb-3">{renderedSubject}</p>
              <div
                className="border border-gray-200 rounded p-3"
                dangerouslySetInnerHTML={{ __html: renderedPreviewHtml }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

# 🔧 PART 3 — INTEGRATION SNIPPETS

## ⚙️ Snippet A: `backend/src/server.js` — Add inside `startServer()`

**Find this block:**
```javascript
if (adminFcmTokenRoutes) {
  app.use('/api/v1/admin/fcm', adminFcmTokenRoutes);
  console.log('✓ /api/v1/admin/fcm routes mounted');
} else {
  console.warn('⚠️  /api/v1/admin/fcm routes NOT mounted (file missing)');
}
```

**Add RIGHT AFTER it:**
```javascript
// ═══════════════════════════════════════════════════════════════
// 🆕 DIRECT PUSH + BULK EMAIL (isolated — NEW features)
// ═══════════════════════════════════════════════════════════════
try {
  const directPushRoutes = require('./routes/directPush.routes');
  app.use('/api/v1/admin/direct-push', directPushRoutes);
  console.log('✅ [Routes] Direct Push mounted at /api/v1/admin/direct-push');
} catch (e) {
  console.error('❌ [Routes] Direct Push failed to load:', e.message);
  console.error(e.stack);
}

try {
  const bulkEmailUploadRoutes = require('./routes/bulkEmailUpload.routes');
  app.use('/api/v1/admin/bulk-email', bulkEmailUploadRoutes);
  console.log('✅ [Routes] Bulk Email Upload mounted at /api/v1/admin/bulk-email');
} catch (e) {
  console.error('❌ [Routes] Bulk Email Upload failed to load:', e.message);
  console.error(e.stack);
}