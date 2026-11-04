// src/pages/BulkEmailCenter.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Mail,
  Upload,
  FileText,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Send,
  History,
  RefreshCw,
  Eye,
  ChevronRight,
  Clock,
  Users,
  TrendingUp,
  Code,
  FileUp,
  Trash2,
  Play,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  List,
  Filter,
  Copy,
  Check,
  Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  bulkEmailApi,
  PreviewUploadResult,
  BulkEmailJob,
  JobProgress,
  ParsedRecipient,
} from '../lib/bulkEmailApi';

// ==================== HELPERS ====================
const formatDate = (iso?: string) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const formatDuration = (ms?: number) => {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const statusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'completed_with_errors':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'failed':
    case 'cancelled':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'running':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'queued':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

// Render template {{name}} and {{email}}
const renderTemplate = (template: string, vars: Record<string, string>) => {
  if (!template) return '';
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '');
};

// ==================== RECIPIENTS PER PAGE ====================
const RECIPIENTS_PER_PAGE = 25;

// ==================== COMPONENT ====================
export default function BulkEmailCenter() {
  // File + Preview
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewUploadResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email content
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState(
    '<p>Hi {{name}},</p>\n<p>Your personalized message goes here.</p>\n<p>Best regards,<br/>The Team</p>'
  );
  const [textBody, setTextBody] = useState('');

  // Send + Progress
  const [sending, setSending] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeProgress, setActiveProgress] = useState<JobProgress | null>(null);

  // History
  const [showHistory, setShowHistory] = useState(false);
  const [jobs, setJobs] = useState<BulkEmailJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobDetailId, setJobDetailId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<BulkEmailJob | null>(null);

  // Preview rendered HTML
  const [showRenderedPreview, setShowRenderedPreview] = useState(false);

  // ALL recipients view
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [recipientPage, setRecipientPage] = useState(1);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Expand/collapse sample in upload card
  const [showSampleExpanded, setShowSampleExpanded] = useState(false);

  // HTML preview iframe ref
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ─── File handlers ───
  const handleFileSelect = (f: File | null) => {
    setPreview(null);
    setShowAllRecipients(false);
    setRecipientSearch('');
    setRecipientFilter('all');
    setRecipientPage(1);
    if (!f) {
      setFile(null);
      return;
    }
    const nameLower = f.name.toLowerCase();
    if (!nameLower.endsWith('.csv') && !nameLower.endsWith('.txt')) {
      toast.error('Only .csv or .txt files allowed');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('File too large (max 10 MB)');
      return;
    }
    setFile(f);
    doPreview(f);
  };

  const doPreview = async (f: File) => {
    setPreviewing(true);
    try {
      const res = await bulkEmailApi.previewUpload(f);
      if (res.success) {
        setPreview(res.data);
        toast.success(`Parsed ${res.data.validRecipients} valid recipients`);
      } else {
        toast.error(res.message || 'Preview failed');
      }
    } catch (e: any) {
      console.error('Preview error:', e);
      toast.error(e.response?.data?.message || e.message || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
    setShowAllRecipients(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Filtered + searched recipients ───
  const allRecipients: ParsedRecipient[] = preview?.sampleRecipients || [];

  const filteredRecipients = useMemo(() => {
    let list = allRecipients;

    // Filter by valid/invalid
    if (recipientFilter === 'valid') {
      list = list.filter((r) => r.isValid);
    } else if (recipientFilter === 'invalid') {
      list = list.filter((r) => !r.isValid);
    }

    // Search
    if (recipientSearch.trim()) {
      const q = recipientSearch.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.email.toLowerCase().includes(q) ||
          (r.name && r.name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allRecipients, recipientFilter, recipientSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredRecipients.length / RECIPIENTS_PER_PAGE));
  const paginatedRecipients = filteredRecipients.slice(
    (recipientPage - 1) * RECIPIENTS_PER_PAGE,
    recipientPage * RECIPIENTS_PER_PAGE
  );

  // Reset page when filter/search changes
  useEffect(() => {
    setRecipientPage(1);
  }, [recipientSearch, recipientFilter]);

  // Copy email
  const copyEmail = (email: string, idx: number) => {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  };

  // Copy all valid emails
  const copyAllValidEmails = () => {
    const validEmails = allRecipients
      .filter((r) => r.isValid)
      .map((r) => r.email)
      .join(', ');
    if (!validEmails) {
      toast.error('No valid emails to copy');
      return;
    }
    navigator.clipboard.writeText(validEmails).then(() => {
      toast.success(`Copied ${allRecipients.filter((r) => r.isValid).length} valid emails`);
    });
  };

  // ─── Start Send ───
  const handleStartSend = async () => {
    if (!file) return toast.error('Please upload a file first');
    if (!preview) return toast.error('Please wait for preview to load');
    if (preview.validRecipients === 0) return toast.error('No valid recipients to send to');
    if (!subject.trim()) return toast.error('Subject is required');
    if (!htmlBody.trim()) return toast.error('Email body is required');

    const confirm = window.confirm(
      `You are about to send bulk email to ${preview.validRecipients} recipients.\n\n` +
        `Subject: ${subject}\n\n` +
        `Proceed?`
    );
    if (!confirm) return;

    setSending(true);
    try {
      const res = await bulkEmailApi.startBulkSend(file, subject.trim(), htmlBody, textBody.trim() || undefined);
      if (res.success) {
        toast.success(`Job started! Sending to ${res.data.validRecipients} recipients...`);
        setActiveJobId(res.data.jobId);
      } else {
        toast.error(res.message || 'Failed to start job');
      }
    } catch (e: any) {
      console.error('Start send error:', e);
      toast.error(e.response?.data?.message || e.message || 'Failed to start job');
    } finally {
      setSending(false);
    }
  };

  // ─── Cancel active job ───
  const handleCancelJob = async () => {
    if (!activeJobId) return;
    const ok = window.confirm('Cancel this bulk email job? Emails already sent cannot be undone.');
    if (!ok) return;
    try {
      const res = await bulkEmailApi.cancelJob(activeJobId);
      if (res.success) {
        toast.success('Job cancelled');
      } else {
        toast.error(res.message || 'Failed to cancel');
      }
    } catch (e: any) {
      toast.error('Failed to cancel job');
    }
  };

  // ─── Poll progress for active job ───
  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await bulkEmailApi.getJobProgress(activeJobId);
        if (!cancelled && res.success) {
          setActiveProgress(res.data);
          if (
            res.data.status === 'completed' ||
            res.data.status === 'completed_with_errors' ||
            res.data.status === 'failed' ||
            res.data.status === 'cancelled'
          ) {
            if (res.data.status === 'completed') {
              toast.success(`✅ Job completed: ${res.data.sent} sent`);
            } else if (res.data.status === 'completed_with_errors') {
              toast(`⚠️ Completed with errors: ${res.data.sent} sent, ${res.data.failed} failed`, {
                icon: '⚠️',
              });
            } else if (res.data.status === 'cancelled') {
              toast.error(`Job cancelled: ${res.data.sent} sent before cancel`);
            } else {
              toast.error(`Job failed: ${res.data.failed} failures`);
            }
            return; // stop polling
          }
          setTimeout(poll, 2500);
        }
      } catch (e: any) {
        if (!cancelled) setTimeout(poll, 5000);
      }
    };
    poll();

    return () => {
      cancelled = true;
    };
  }, [activeJobId]);

  // ─── History ───
  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await bulkEmailApi.listJobs({ page: 1, limit: 50 });
      if (res.success) setJobs(res.data.jobs);
    } catch (e: any) {
      toast.error('Failed to load jobs');
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    if (showHistory) loadJobs();
  }, [showHistory, loadJobs]);

  const loadJobDetail = async (id: string) => {
    setJobDetailId(id);
    setJobDetail(null);
    try {
      const res = await bulkEmailApi.getJob(id);
      if (res.success) setJobDetail(res.data.job);
    } catch (e: any) {
      toast.error('Failed to load job detail');
    }
  };

  // ─── Rendered preview (uses first valid recipient as sample) ───
  const sampleRecipient: ParsedRecipient | null =
    preview?.sampleRecipients?.find((r) => r.isValid) || null;

  const renderedSubject = sampleRecipient
    ? renderTemplate(subject, { name: sampleRecipient.name || 'Friend', email: sampleRecipient.email })
    : subject;

  const renderedHtml = sampleRecipient
    ? renderTemplate(htmlBody, { name: sampleRecipient.name || 'Friend', email: sampleRecipient.email })
    : htmlBody;

  // Write HTML to iframe when preview modal opens
  useEffect(() => {
    if (showRenderedPreview && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(renderedHtml);
        doc.close();
      }
    }
  }, [showRenderedPreview, renderedHtml]);

  // Count helpers
  const validCount = allRecipients.filter((r) => r.isValid).length;
  const invalidCount = allRecipients.filter((r) => !r.isValid).length;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* ─── Header ─── */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bulk Email Center</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Upload CSV/TXT, compose email, and send to thousands at once
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {preview && allRecipients.length > 0 && (
            <button
              onClick={() => setShowAllRecipients(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
            >
              <List className="w-4 h-4" />
              All Recipients ({allRecipients.length})
            </button>
          )}
          {preview && sampleRecipient && (
            <button
              onClick={() => setShowRenderedPreview(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
            >
              <Eye className="w-4 h-4" />
              Preview Email
            </button>
          )}
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
          >
            <History className="w-4 h-4" />
            Job History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── LEFT: Upload + Compose ─── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                <FileUp className="w-4 h-4 text-purple-600" />
              </div>
              <h2 className="text-base font-bold text-gray-900">Upload Recipient List</h2>
            </div>

            {!file ? (
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                  dragActive
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-300 bg-gray-50 hover:border-purple-400 hover:bg-purple-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                />
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700">
                  Drop CSV or TXT file here, or <span className="text-purple-600">click to browse</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Supports .csv (email,name columns) or .txt (one email per line) · Max 10 MB
                </p>
              </div>
            ) : (
              <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <FileText className="w-8 h-8 text-purple-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatBytes(file.size)}</p>
                      {previewing && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-purple-600">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Parsing file...
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={removeFile}
                    className="p-1.5 text-red-500 hover:bg-red-100 rounded transition"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {preview && (
                  <>
                    {/* Stats row */}
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      <div className="p-2 bg-white rounded-lg text-center border border-gray-100">
                        <p className="text-[10px] font-bold uppercase text-gray-500">Total</p>
                        <p className="text-lg font-black text-gray-900">{preview.totalRows}</p>
                      </div>
                      <div className="p-2 bg-white rounded-lg text-center border border-emerald-100">
                        <p className="text-[10px] font-bold uppercase text-emerald-600">Valid</p>
                        <p className="text-lg font-black text-emerald-700">{preview.validRecipients}</p>
                      </div>
                      <div className="p-2 bg-white rounded-lg text-center border border-red-100">
                        <p className="text-[10px] font-bold uppercase text-red-600">Invalid</p>
                        <p className="text-lg font-black text-red-700">{preview.invalidRecipients}</p>
                      </div>
                      <div className="p-2 bg-white rounded-lg text-center border border-amber-100">
                        <p className="text-[10px] font-bold uppercase text-amber-600">Dupes</p>
                        <p className="text-lg font-black text-amber-700">{preview.duplicateRecipients}</p>
                      </div>
                    </div>

                    {/* Name column detected */}
                    {preview.hasNameColumn && (
                      <div className="mt-3 p-2 bg-emerald-100 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Name column detected — <code className="bg-white px-1 rounded">{'{{name}}'}</code> will be personalized
                      </div>
                    )}

                    {/* Quick sample: first 5 + expand button */}
                    {preview.sampleRecipients && preview.sampleRecipients.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-bold text-gray-700">
                            Recipients Preview ({preview.sampleRecipients.length} total)
                          </p>
                          <div className="flex gap-1">
                            <button
                              onClick={copyAllValidEmails}
                              className="text-[10px] px-2 py-0.5 bg-white border border-gray-200 rounded text-gray-600 hover:bg-gray-50 flex items-center gap-1"
                            >
                              <Copy className="w-2.5 h-2.5" />
                              Copy All Valid
                            </button>
                            <button
                              onClick={() => setShowAllRecipients(true)}
                              className="text-[10px] px-2 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
                            >
                              <List className="w-2.5 h-2.5" />
                              View All
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {preview.sampleRecipients
                            .slice(0, showSampleExpanded ? 20 : 5)
                            .map((r, idx) => (
                              <div
                                key={idx}
                                className={`flex items-center gap-2 p-1.5 bg-white rounded border text-xs ${
                                  r.isValid ? 'border-gray-100' : 'border-red-200 bg-red-50'
                                }`}
                              >
                                <span className="text-[10px] text-gray-400 w-5 text-right font-mono">
                                  {idx + 1}
                                </span>
                                {r.isValid ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                                )}
                                <span className="font-mono text-gray-700 truncate flex-1">{r.email}</span>
                                {r.name && (
                                  <span className="text-gray-500 truncate max-w-[120px]">· {r.name}</span>
                                )}
                                {!r.isValid && r.invalidReason && (
                                  <span className="text-[9px] text-red-500 truncate max-w-[100px]">
                                    ({r.invalidReason})
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>

                        {preview.sampleRecipients.length > 5 && (
                          <button
                            onClick={() => setShowSampleExpanded(!showSampleExpanded)}
                            className="mt-1.5 text-[10px] text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1"
                          >
                            {showSampleExpanded ? (
                              <>
                                <ChevronUp className="w-3 h-3" />
                                Show Less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3" />
                                Show More ({preview.sampleRecipients.length - 5} more)
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Invalid samples */}
                    {preview.invalidSamples && preview.invalidSamples.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-xs font-bold text-red-700 cursor-pointer hover:text-red-800">
                          ⚠️ Invalid Email Samples ({preview.invalidSamples.length})
                        </summary>
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                          {preview.invalidSamples.slice(0, 10).map((r, idx) => (
                            <div key={idx} className="p-1.5 bg-red-50 border border-red-100 rounded text-[10px]">
                              <p className="font-mono text-red-700 truncate">{r.email || '(empty)'}</p>
                              <p className="text-red-600">{r.invalidReason}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Compose */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-600" />
              </div>
              <h2 className="text-base font-bold text-gray-900">Compose Email</h2>
              <span className="ml-auto text-[11px] text-gray-500">
                Use <code className="bg-gray-100 px-1 rounded">{'{{name}}'}</code> and{' '}
                <code className="bg-gray-100 px-1 rounded">{'{{email}}'}</code> for personalization
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Welcome {{name}}! Your exclusive offer inside"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-[11px] text-gray-500 mt-1">{subject.length}/200</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-gray-900">
                    HTML Body <span className="text-red-500">*</span>
                  </label>
                  {sampleRecipient && (
                    <button
                      onClick={() => setShowRenderedPreview(true)}
                      className="text-[11px] text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Live Preview
                    </button>
                  )}
                </div>
                <textarea
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  rows={12}
                  placeholder="<p>Hi {{name}},</p>..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
                />
                <p className="text-[11px] text-gray-500 mt-1">{htmlBody.length} chars</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                  Plain Text Body (optional, auto-generated from HTML if blank)
                </label>
                <textarea
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  rows={3}
                  placeholder="Plain text version for email clients that don't support HTML..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
                />
              </div>
            </div>
          </div>

          {/* Inline HTML Preview (below compose) */}
          {htmlBody.trim() && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-gray-900">HTML Preview</h3>
                  {sampleRecipient && (
                    <span className="text-[10px] text-gray-500 ml-2">
                      Using: {sampleRecipient.name || 'Friend'} &lt;{sampleRecipient.email}&gt;
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowRenderedPreview(true)}
                  className="text-[10px] px-2 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
                >
                  <Eye className="w-2.5 h-2.5" />
                  Full Preview
                </button>
              </div>
              <div className="p-4 bg-gray-50">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  {/* Subject bar */}
                  <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                    <p className="text-[10px] font-bold uppercase text-gray-400">Subject</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{renderedSubject || '(no subject)'}</p>
                  </div>
                  {/* Rendered HTML */}
                  <div
                    className="p-4 text-sm text-gray-800 overflow-auto max-h-[400px]"
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT: Actions + Live Job ─── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Action card */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-4">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-br from-purple-50 to-pink-50">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-gray-900">Ready to Send</h3>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Checklist */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  {file ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-gray-300" />
                  )}
                  <span className={file ? 'text-gray-700' : 'text-gray-400'}>File uploaded</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {preview && preview.validRecipients > 0 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-gray-300" />
                  )}
                  <span className={preview && preview.validRecipients > 0 ? 'text-gray-700' : 'text-gray-400'}>
                    Valid recipients found
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {subject.trim() ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-gray-300" />
                  )}
                  <span className={subject.trim() ? 'text-gray-700' : 'text-gray-400'}>Subject entered</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {htmlBody.trim() ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-gray-300" />
                  )}
                  <span className={htmlBody.trim() ? 'text-gray-700' : 'text-gray-400'}>HTML body written</span>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Recipients</span>
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <p className="text-2xl font-black text-gray-900 mt-1">
                  {preview?.validRecipients?.toLocaleString() || 0}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {preview
                    ? `${preview.invalidRecipients} invalid, ${preview.duplicateRecipients} duplicates skipped`
                    : 'Upload file to begin'}
                </p>
              </div>

              <button
                onClick={handleStartSend}
                disabled={sending || !preview || preview.validRecipients === 0 || !subject.trim() || !htmlBody.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition shadow-md"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting Job...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Start Bulk Send
                  </>
                )}
              </button>

              <p className="text-[10px] text-gray-500 text-center">
                Emails are queued and sent in batches of 50 with rate limiting
              </p>
            </div>
          </div>

          {/* Live progress */}
          {activeProgress && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-gray-900">Active Job</h3>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusColor(activeProgress.status)}`}
                >
                  {activeProgress.status}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-gray-700">Progress</span>
                  <span className="font-mono text-gray-600">{activeProgress.progress}%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      activeProgress.status === 'failed' || activeProgress.status === 'cancelled'
                        ? 'bg-red-500'
                        : activeProgress.status === 'completed'
                        ? 'bg-emerald-500'
                        : activeProgress.status === 'completed_with_errors'
                        ? 'bg-amber-500'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500'
                    }`}
                    style={{ width: `${activeProgress.progress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-center">
                  <p className="text-[10px] font-bold uppercase text-emerald-600">Sent</p>
                  <p className="text-xl font-black text-emerald-700">{activeProgress.sent}</p>
                </div>
                <div className="p-2 bg-red-50 border border-red-200 rounded text-center">
                  <p className="text-[10px] font-bold uppercase text-red-600">Failed</p>
                  <p className="text-xl font-black text-red-700">{activeProgress.failed}</p>
                </div>
                <div className="p-2 bg-gray-50 border border-gray-200 rounded text-center">
                  <p className="text-[10px] font-bold uppercase text-gray-600">Total</p>
                  <p className="text-xl font-black text-gray-700">{activeProgress.validRecipients}</p>
                </div>
              </div>

              {/* Cancel button for running jobs */}
              {(activeProgress.status === 'running' || activeProgress.status === 'queued') && (
                <button
                  onClick={handleCancelJob}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-red-50 border border-red-200 text-red-700 font-semibold text-xs rounded-lg hover:bg-red-100 transition"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Cancel Job
                </button>
              )}

              <p className="text-[10px] text-gray-500 mt-2 text-center">
                {activeProgress.status === 'running' || activeProgress.status === 'queued' ? (
                  <>Polling every 2.5s · </>
                ) : (
                  <>Final result · </>
                )}
                Job ID: <span className="font-mono">{activeProgress.jobId?.substring(0, 12) || '—'}...</span>
              </p>

              {/* Clear completed job */}
              {(activeProgress.status === 'completed' ||
                activeProgress.status === 'completed_with_errors' ||
                activeProgress.status === 'failed' ||
                activeProgress.status === 'cancelled') && (
                <button
                  onClick={() => {
                    setActiveJobId(null);
                    setActiveProgress(null);
                  }}
                  className="w-full mt-2 text-[10px] text-gray-500 hover:text-gray-700 underline"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          {/* Quick stats card */}
          {preview && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">File Summary</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">File Name</span>
                  <span className="font-mono text-gray-900 truncate max-w-[160px]">{file?.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">File Size</span>
                  <span className="font-mono text-gray-900">{file ? formatBytes(file.size) : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Total Rows</span>
                  <span className="font-mono text-gray-900">{preview.totalRows}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Separator</span>
                  <span className="font-mono text-gray-900">{preview.separator || 'auto'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Has Name Column</span>
                  <span className={`font-semibold ${preview.hasNameColumn ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {preview.hasNameColumn ? 'Yes' : 'No'}
                  </span>
                </div>
                {preview.hasHeaderRow !== undefined && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Header Row</span>
                    <span className={`font-semibold ${preview.hasHeaderRow ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {preview.hasHeaderRow ? 'Detected' : 'None'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── ALL RECIPIENTS MODAL ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      {showAllRecipients && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowAllRecipients(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-3xl bg-white shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-900">All Recipients</h2>
                  <span className="text-sm text-gray-500">({allRecipients.length} total)</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyAllValidEmails}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Copy className="w-3 h-3" />
                    Copy All Valid
                  </button>
                  <button
                    onClick={() => setShowAllRecipients(false)}
                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search + Filter */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder="Search by email or name..."
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {recipientSearch && (
                    <button
                      onClick={() => setRecipientSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  {(['all', 'valid', 'invalid'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setRecipientFilter(f)}
                      className={`px-3 py-2 text-xs font-semibold transition ${
                        recipientFilter === f
                          ? f === 'valid'
                            ? 'bg-emerald-500 text-white'
                            : f === 'invalid'
                            ? 'bg-red-500 text-white'
                            : 'bg-purple-500 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {f === 'all' && `All (${allRecipients.length})`}
                      {f === 'valid' && `Valid (${validCount})`}
                      {f === 'invalid' && `Invalid (${invalidCount})`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recipients list */}
            <div className="flex-1 overflow-y-auto">
              {filteredRecipients.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  {recipientSearch ? 'No recipients match your search' : 'No recipients found'}
                </div>
              ) : (
                <>
                  {/* Table header */}
                  <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-4 py-2 grid grid-cols-[40px_40px_1fr_180px_80px] gap-2 text-[10px] font-bold uppercase text-gray-500">
                    <span>#</span>
                    <span>✓</span>
                    <span>Email</span>
                    <span>Name</span>
                    <span className="text-right">Actions</span>
                  </div>

                  {/* Rows */}
                  {paginatedRecipients.map((r, idx) => {
                    const globalIdx = (recipientPage - 1) * RECIPIENTS_PER_PAGE + idx;
                    return (
                      <div
                        key={globalIdx}
                        className={`px-4 py-2 grid grid-cols-[40px_40px_1fr_180px_80px] gap-2 items-center border-b border-gray-50 text-xs hover:bg-gray-50 transition ${
                          !r.isValid ? 'bg-red-50/50' : ''
                        }`}
                      >
                        <span className="text-gray-400 font-mono">{globalIdx + 1}</span>
                        <span>
                          {r.isValid ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="font-mono text-gray-800 truncate">{r.email}</p>
                          {!r.isValid && r.invalidReason && (
                            <p className="text-[9px] text-red-500 mt-0.5">{r.invalidReason}</p>
                          )}
                        </div>
                        <span className="text-gray-600 truncate">{r.name || '—'}</span>
                        <div className="flex justify-end">
                          <button
                            onClick={() => copyEmail(r.email, globalIdx)}
                            className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition"
                            title="Copy email"
                          >
                            {copiedIdx === globalIdx ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                <p className="text-[10px] text-gray-500">
                  Showing {(recipientPage - 1) * RECIPIENTS_PER_PAGE + 1}–
                  {Math.min(recipientPage * RECIPIENTS_PER_PAGE, filteredRecipients.length)} of{' '}
                  {filteredRecipients.length}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setRecipientPage((p) => Math.max(1, p - 1))}
                    disabled={recipientPage === 1}
                    className="px-2 py-1 text-xs bg-white border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50"
                  >
                    Prev
                  </button>
                  {/* Page numbers (show max 7) */}
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 7) {
                      page = i + 1;
                    } else if (recipientPage <= 4) {
                      page = i + 1;
                    } else if (recipientPage >= totalPages - 3) {
                      page = totalPages - 6 + i;
                    } else {
                      page = recipientPage - 3 + i;
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setRecipientPage(page)}
                        className={`px-2 py-1 text-xs rounded border ${
                          recipientPage === page
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setRecipientPage((p) => Math.min(totalPages, p + 1))}
                    disabled={recipientPage === totalPages}
                    className="px-2 py-1 text-xs bg-white border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Job History Drawer ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowHistory(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-bold text-gray-900">Email Job History</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadJobs}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingJobs ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingJobs ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No email jobs yet</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {jobs.map((j) => (
                    <button
                      key={j._id}
                      onClick={() => loadJobDetail(j._id)}
                      className="w-full p-4 hover:bg-gray-50 text-left transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{j.subject}</p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{j.fileName}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${statusColor(j.status)}`}
                            >
                              {j.status}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              <span className="font-bold text-emerald-600">{j.sent}</span> /{' '}
                              <span className="font-bold text-red-600">{j.failed}</span> /{' '}
                              <span className="font-bold text-gray-700">{j.validRecipients}</span>
                            </span>
                            {j.status === 'running' && (
                              <span className="text-[10px] text-blue-600 font-bold">{j.progress}%</span>
                            )}
                            <span className="text-[10px] text-gray-400">
                              <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                              {formatDate(j.createdAt)}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Job Detail Modal ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      {jobDetailId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={() => {
            setJobDetailId(null);
            setJobDetail(null);
          }}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-4xl max-h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Email Job Detail</h2>
              <button
                onClick={() => {
                  setJobDetailId(null);
                  setJobDetail(null);
                }}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {!jobDetail ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-gray-500">Subject</p>
                    <p className="text-sm text-gray-900 mt-0.5">{jobDetail.subject}</p>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    <div className="p-2 bg-gray-50 rounded text-center">
                      <p className="text-[10px] uppercase font-bold text-gray-500">Total</p>
                      <p className="text-lg font-black text-gray-900">{jobDetail.totalRecipients}</p>
                    </div>
                    <div className="p-2 bg-blue-50 rounded text-center">
                      <p className="text-[10px] uppercase font-bold text-blue-600">Valid</p>
                      <p className="text-lg font-black text-blue-700">{jobDetail.validRecipients}</p>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded text-center">
                      <p className="text-[10px] uppercase font-bold text-emerald-600">Sent</p>
                      <p className="text-lg font-black text-emerald-700">{jobDetail.sent}</p>
                    </div>
                    <div className="p-2 bg-red-50 rounded text-center">
                      <p className="text-[10px] uppercase font-bold text-red-600">Failed</p>
                      <p className="text-lg font-black text-red-700">{jobDetail.failed}</p>
                    </div>
                    <div className="p-2 bg-amber-50 rounded text-center">
                      <p className="text-[10px] uppercase font-bold text-amber-600">Skipped</p>
                      <p className="text-lg font-black text-amber-700">{jobDetail.skipped}</p>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 space-y-1">
                    <p>
                      File:{' '}
                      <span className="font-semibold text-gray-700">{jobDetail.fileName}</span>{' '}
                      ({formatBytes(jobDetail.fileSizeBytes)})
                    </p>
                    <p>
                      Status:{' '}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${statusColor(
                          jobDetail.status
                        )}`}
                      >
                        {jobDetail.status}
                      </span>
                    </p>
                    <p>Started: {formatDate(jobDetail.startedAt)}</p>
                    <p>Completed: {formatDate(jobDetail.completedAt)}</p>
                    <p>Duration: {formatDuration(jobDetail.durationMs)}</p>
                    <p>Created By: {jobDetail.createdBy?.email || '—'}</p>
                  </div>

                  {/* HTML preview in job detail */}
                  {jobDetail.htmlBody && (
                    <details>
                      <summary className="text-xs font-bold text-purple-700 cursor-pointer hover:text-purple-800">
                        📧 View Email HTML Template
                      </summary>
                      <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase">
                          HTML Body
                        </div>
                        <div
                          className="p-4 text-sm text-gray-800 max-h-[300px] overflow-auto bg-white"
                          dangerouslySetInnerHTML={{ __html: jobDetail.htmlBody }}
                        />
                      </div>
                    </details>
                  )}

                  {jobDetail.failures && jobDetail.failures.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-red-700 mb-2">
                        Failures ({jobDetail.failures.length})
                      </h4>
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {jobDetail.failures.map((f, idx) => (
                          <div key={idx} className="p-2 bg-red-50 border border-red-100 rounded text-[10px]">
                            <p className="font-mono text-red-700">{f.email}</p>
                            <p className="text-red-600">{f.errorMessage}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Rendered Preview Modal (Full Iframe) ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      {showRenderedPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowRenderedPreview(false)}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-bold text-gray-900">Email Preview</h2>
              </div>
              <div className="flex gap-2">
                {/* Device toggles - future enhancement */}
                <button
                  onClick={() => setShowRenderedPreview(false)}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sample recipient info */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase text-gray-500">Preview using first valid recipient</p>
                <p className="text-xs font-mono text-gray-700 mt-0.5">
                  {sampleRecipient?.email || 'test@example.com'}
                  {sampleRecipient?.name && <span className="text-gray-500"> · {sampleRecipient.name}</span>}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-gray-500">Variables</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  <code className="bg-white px-1 rounded border border-gray-200">{'{{name}}'}</code> ={' '}
                  <span className="text-purple-600 font-semibold">{sampleRecipient?.name || 'Friend'}</span>
                </p>
              </div>
            </div>

            {/* Subject */}
            <div className="px-4 py-3 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{renderedSubject || '(no subject)'}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    From: support@uweservices.com · To: {sampleRecipient?.email || 'test@example.com'}
                  </p>
                </div>
              </div>
            </div>

            {/* Iframe with rendered HTML */}
            <div className="flex-1 overflow-hidden bg-gray-100 p-4">
              <div className="w-full h-full bg-white rounded-lg border border-gray-200 shadow-inner overflow-hidden">
                <iframe
                  ref={iframeRef}
                  title="Email Preview"
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin"
                  style={{ minHeight: '400px' }}
                />
              </div>
            </div>

            {/* Footer with raw HTML toggle */}
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <p className="text-[10px] text-gray-500">
                This preview renders the HTML exactly as email clients would see it
              </p>
              <details>
                <summary className="text-[10px] text-purple-600 cursor-pointer hover:text-purple-700 font-semibold">
                  View Raw HTML
                </summary>
                <div className="absolute bottom-10 right-4 w-[500px] max-h-[300px] bg-gray-900 text-green-400 p-3 rounded-lg shadow-2xl overflow-auto text-[10px] font-mono z-10 border border-gray-700">
                  <pre className="whitespace-pre-wrap break-all">{renderedHtml}</pre>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}