// backend/src/controllers/bulkEmailUpload.controller.js
// Bulk Email via CSV/TXT upload — SEPARATE from existing notification logic.

const logger = require('../utils/logger');
const BulkEmailJob = require('../models/BulkEmailJob');

let emailService = null;
try {
  emailService = require('../utils/emailService');
} catch (e) {
  console.warn('[bulkEmailUpload] emailService not loadable:', e.message);
}

// ---------------- CSV / TXT PARSER (inline, no npm dep) ----------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(e) {
  if (!e || typeof e !== 'string') return false;
  const trimmed = e.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Parse one CSV line respecting quotes.
 */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

/**
 * Parse CSV or TXT buffer into recipient list.
 * Supports:
 *   - TXT: one email per line
 *   - CSV with header: email,name (any order; extras ignored)
 *   - CSV without header: first col = email, second col (optional) = name
 */
function parseRecipientsFromBuffer(buffer, fileName = '') {
  const raw = buffer.toString('utf8').replace(/^\uFEFF/, ''); // strip BOM
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const result = {
    valid: [],
    invalid: [],
    duplicates: 0,
    totalLines: lines.length,
  };

  if (lines.length === 0) return result;

  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const seen = new Set();

  // Detect header
  let headerIdx = { email: 0, name: -1 };
  let hasHeader = false;
  const firstCols = parseCsvLine(lines[0]).map(c => c.toLowerCase());
  if (firstCols.some(c => c === 'email' || c === 'e-mail' || c === 'mail')) {
    hasHeader = true;
    headerIdx.email = firstCols.findIndex(c => c === 'email' || c === 'e-mail' || c === 'mail');
    const nameIdx = firstCols.findIndex(c => c === 'name' || c === 'fullname' || c === 'full_name' || c === 'full name');
    headerIdx.name = nameIdx;
  } else if (ext === 'csv' && firstCols.length > 1 && !isValidEmail(firstCols[0])) {
    // First row looks like header but no "email" column found — assume col 0
    hasHeader = true;
    headerIdx.email = 0;
    headerIdx.name = firstCols.length > 1 ? 1 : -1;
  }

  const startIdx = hasHeader ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    let email = '';
    let name = '';

    if (ext === 'csv' || line.includes(',') || line.includes(';') || line.includes('\t')) {
      const cols = parseCsvLine(line);
      email = (cols[headerIdx.email] || '').trim().toLowerCase();
      if (headerIdx.name >= 0) {
        name = (cols[headerIdx.name] || '').trim();
      } else if (cols.length > 1) {
        name = (cols[1] || '').trim();
      }
    } else {
      email = line.trim().toLowerCase();
    }

    // Strip surrounding quotes
    email = email.replace(/^["']|["']$/g, '');
    name = name.replace(/^["']|["']$/g, '');

    if (!email) continue;

    if (!isValidEmail(email)) {
      result.invalid.push({ line: i + 1, raw: line, reason: 'Invalid email format' });
      continue;
    }

    if (seen.has(email)) {
      result.duplicates++;
      continue;
    }
    seen.add(email);

    result.valid.push({ email, name });
  }

  return result;
}

// ---------------- TEMPLATE RENDERING ----------------

function renderTemplate(tpl, vars) {
  if (!tpl) return '';
  let out = String(tpl);
  const safeVars = {
    name: vars.name || '',
    email: vars.email || '',
    ...vars,
  };
  // Replace {{key}} and {{ key }}
  out = out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = safeVars[key];
    return (v === null || v === undefined) ? '' : String(v);
  });
  return out;
}

function htmlToPlainText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------- EMAIL SEND WRAPPER ----------------

async function sendOneEmail({ to, name, subject, html, text }) {
  if (!emailService) {
    throw new Error('Email service not available');
  }

  // Prefer sendNotificationEmail, fallback to sendBulkEmails single-item
  if (typeof emailService.sendNotificationEmail === 'function') {
    return await emailService.sendNotificationEmail({
      to,
      name: name || '',
      subject,
      html,
      text: text || htmlToPlainText(html),
    });
  }

  if (typeof emailService.sendBulkEmails === 'function') {
    const r = await emailService.sendBulkEmails([{
      to, name: name || '', subject, html, text: text || htmlToPlainText(html),
    }]);
    if (r && r.results && r.results[0]) {
      const first = r.results[0];
      return { success: !!first.success, error: first.error || null, messageId: first.messageId };
    }
    return { success: !!r?.success };
  }

  throw new Error('No compatible email send function found');
}

// ---------------- ASYNC JOB RUNNER ----------------

const BATCH_SIZE = 50;
const PER_EMAIL_DELAY_MS = 600;
const BATCH_PAUSE_MS = 5000;

async function runBulkEmailJob(jobId) {
  const job = await BulkEmailJob.findById(jobId);
  if (!job) {
    logger.error(`[bulkEmail runner] Job ${jobId} not found`);
    return;
  }

  const startedAt = new Date();
  job.status = 'running';
  job.startedAt = startedAt;
  job.progress = 0;
  await job.save();

  logger.info(`[bulkEmail runner] Starting job ${jobId} — ${job.recipients.length} recipients`);

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  try {
    const total = job.recipients.length;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = job.recipients.slice(i, i + BATCH_SIZE);

      for (let j = 0; j < batch.length; j++) {
        const rec = batch[j];
        const absoluteIdx = i + j;

        if (rec.status !== 'pending') {
          continue;
        }

        const vars = { name: rec.name || '', email: rec.email };
        const renderedSubject = renderTemplate(job.subject, vars);
        const renderedHtml = renderTemplate(job.htmlBody, vars);
        const renderedText = job.textBody ? renderTemplate(job.textBody, vars) : htmlToPlainText(renderedHtml);

        try {
          const result = await sendOneEmail({
            to: rec.email,
            name: rec.name,
            subject: renderedSubject,
            html: renderedHtml,
            text: renderedText,
          });

          if (result && result.success) {
            job.recipients[absoluteIdx].status = 'sent';
            job.recipients[absoluteIdx].sentAt = new Date();
            sentCount++;
          } else if (result && result.skipped) {
            job.recipients[absoluteIdx].status = 'skipped';
            job.recipients[absoluteIdx].errorMessage = result.reason || 'skipped';
            skippedCount++;
          } else {
            job.recipients[absoluteIdx].status = 'failed';
            job.recipients[absoluteIdx].errorMessage = (result && result.error) || 'Unknown error';
            failedCount++;
            job.failures.push({
              email: rec.email,
              name: rec.name,
              errorMessage: (result && result.error) || 'Unknown error',
              attemptedAt: new Date(),
            });
          }
        } catch (err) {
          job.recipients[absoluteIdx].status = 'failed';
          job.recipients[absoluteIdx].errorMessage = err.message || String(err);
          failedCount++;
          job.failures.push({
            email: rec.email,
            name: rec.name,
            errorMessage: err.message || String(err),
            attemptedAt: new Date(),
          });
        }

        // Per-email delay
        if (j < batch.length - 1) {
          await new Promise(r => setTimeout(r, PER_EMAIL_DELAY_MS));
        }
      }

      // Persist progress after each batch
      job.sent = sentCount;
      job.failed = failedCount;
      job.skipped = skippedCount;
      const processed = sentCount + failedCount + skippedCount;
      job.progress = total > 0 ? Math.round((processed / total) * 100) : 100;
      await job.save();

      logger.info(`[bulkEmail runner] Job ${jobId} — batch done: ${processed}/${total} (${job.progress}%)`);

      // Pause between batches
      if (i + BATCH_SIZE < total) {
        await new Promise(r => setTimeout(r, BATCH_PAUSE_MS));
      }
    }

    const completedAt = new Date();
    job.completedAt = completedAt;
    job.durationMs = completedAt - startedAt;
    job.sent = sentCount;
    job.failed = failedCount;
    job.skipped = skippedCount;
    job.progress = 100;
    job.status = failedCount === 0 ? 'completed' : 'completed_with_errors';
    await job.save();

    logger.info(`[bulkEmail runner] Job ${jobId} finished — sent=${sentCount} failed=${failedCount} skipped=${skippedCount}`);
  } catch (err) {
    logger.error(`[bulkEmail runner] Job ${jobId} crashed: ${err.message}`);
    try {
      job.status = 'failed';
      job.errorMessage = err.message;
      job.completedAt = new Date();
      job.durationMs = new Date() - startedAt;
      await job.save();
    } catch (_) {}
  }
}

// =====================================================================
// ENDPOINTS
// =====================================================================

/**
 * POST /api/v1/admin/bulk-email/preview
 * Multipart: file (csv/txt)
 * Returns parsed recipient preview — DOES NOT create a job.
 */
exports.previewUpload = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const parsed = parseRecipientsFromBuffer(req.file.buffer, req.file.originalname);

    return res.json({
      success: true,
      data: {
        fileName: req.file.originalname,
        fileSizeBytes: req.file.size,
        totalLines: parsed.totalLines,
        validCount: parsed.valid.length,
        invalidCount: parsed.invalid.length,
        duplicatesCount: parsed.duplicates,
        sampleValid: parsed.valid.slice(0, 20),
        sampleInvalid: parsed.invalid.slice(0, 20),
      },
    });
  } catch (err) {
    logger.error(`[bulkEmail.previewUpload] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/v1/admin/bulk-email/send
 * Multipart: file (csv/txt) + fields: subject, htmlBody, textBody (optional)
 * Creates job, returns immediately, runs async in background.
 */
exports.startBulkSend = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const subject = (req.body.subject || '').toString().trim();
    const htmlBody = (req.body.htmlBody || '').toString();
    const textBody = (req.body.textBody || '').toString();

    if (!subject) return res.status(400).json({ success: false, message: 'subject is required' });
    if (!htmlBody.trim()) return res.status(400).json({ success: false, message: 'htmlBody is required' });
    if (subject.length > 300) return res.status(400).json({ success: false, message: 'subject too long' });

    const parsed = parseRecipientsFromBuffer(req.file.buffer, req.file.originalname);

    if (parsed.valid.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid email addresses found in the file',
        data: {
          totalLines: parsed.totalLines,
          invalidCount: parsed.invalid.length,
          sampleInvalid: parsed.invalid.slice(0, 10),
        },
      });
    }

    const recipients = parsed.valid.map(r => ({
      email: r.email,
      name: r.name || '',
      status: 'pending',
      errorMessage: '',
      sentAt: null,
    }));

    const job = await BulkEmailJob.create({
      fileName: req.file.originalname,
      fileSizeBytes: req.file.size,
      subject,
      htmlBody,
      textBody,
      totalRecipients: parsed.totalLines,
      validRecipients: parsed.valid.length,
      invalidRecipients: parsed.invalid.length,
      duplicateRecipients: parsed.duplicates,
      recipients,
      status: 'queued',
      createdBy: {
        adminId: req.admin?.adminId || req.admin?._id || null,
        email: req.admin?.email || '',
        name: req.admin?.name || '',
      },
    });

    // Kick off async runner (do NOT await)
    setImmediate(() => {
      runBulkEmailJob(job._id).catch(err =>
        logger.error(`[bulkEmail] runner uncaught: ${err.message}`)
      );
    });

    return res.json({
      success: true,
      message: `Bulk email job queued with ${recipients.length} recipients`,
      data: {
        jobId: job._id,
        validRecipients: recipients.length,
        invalidRecipients: parsed.invalid.length,
        duplicatesSkipped: parsed.duplicates,
        status: 'queued',
      },
    });
  } catch (err) {
    logger.error(`[bulkEmail.startBulkSend] ${err.message}`);
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/bulk-email/jobs?page=1&limit=25
 */
exports.listJobs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status) query.status = req.query.status;

    const [items, total] = await Promise.all([
      BulkEmailJob.find(query, {
        recipients: 0, failures: 0, htmlBody: 0, textBody: 0,
      }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      BulkEmailJob.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: {
        items,
        pagination: {
          page, limit, total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/bulk-email/jobs/:id
 */
exports.getJob = async (req, res) => {
  try {
    const doc = await BulkEmailJob.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Job not found' });

    // Trim recipients/failures to avoid huge payloads
    const recipientsTrimmed = (doc.recipients || []).slice(0, 500);
    const failuresTrimmed = (doc.failures || []).slice(0, 200);

    return res.json({
      success: true,
      data: {
        ...doc,
        recipients: recipientsTrimmed,
        recipientsShown: recipientsTrimmed.length,
        recipientsTotal: (doc.recipients || []).length,
        failures: failuresTrimmed,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/bulk-email/jobs/:id/progress
 * Lightweight polling endpoint.
 */
exports.getJobProgress = async (req, res) => {
  try {
    const doc = await BulkEmailJob.findById(req.params.id, {
      status: 1, progress: 1, sent: 1, failed: 1, skipped: 1,
      totalRecipients: 1, validRecipients: 1,
      startedAt: 1, completedAt: 1, durationMs: 1,
    }).lean();

    if (!doc) return res.status(404).json({ success: false, message: 'Job not found' });

    return res.json({ success: true, data: doc });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};