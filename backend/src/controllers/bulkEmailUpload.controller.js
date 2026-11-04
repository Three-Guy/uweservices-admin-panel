// backend/src/controllers/bulkEmailUpload.controller.js
// Bulk Email Controller — FULL COMPLETE with robust CSV/TXT parser
// Handles: CSV (comma/semicolon/tab/pipe separated), TXT (one per line), with/without headers
// v2.1 — Fixed `name is not defined` bug

const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const { getAdminConnection } = require('../config/database');

// ════════════════════════════════════════════════════════════════
// EMAIL VALIDATION
// ════════════════════════════════════════════════════════════════
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

function extractEmailFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].trim().toLowerCase() : null;
}

function cleanName(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let n = raw.trim().replace(/^["']|["']$/g, '').trim();
  if (!n || n.length < 1 || n.length > 100) return null;
  if (isValidEmail(n)) return null; // Not a name — it's an email
  return n;
}

// ════════════════════════════════════════════════════════════════
// ROBUST CSV/TXT PARSER — handles ALL common formats
// ════════════════════════════════════════════════════════════════
function parseRecipientFile(fileContent, fileName) {
  console.log(`[BulkEmail] 📄 Parsing file: ${fileName}, size: ${fileContent.length} bytes`);

  const results = {
    recipients: [],
    invalidRows: [],
    totalRows: 0,
    hasNameColumn: false,
    detectedFormat: 'unknown',
    detectedSeparator: null,
    headerRow: null,
  };

  if (!fileContent || !fileContent.trim()) {
    console.log('[BulkEmail] ⚠️ File is empty');
    return results;
  }

  // Strip BOM if present
  let content = fileContent;
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
    console.log('[BulkEmail] 🧹 Stripped BOM');
  }

  // Normalize line endings + split
  const rawLines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  console.log(`[BulkEmail] 📝 Total non-empty lines: ${rawLines.length}`);
  if (rawLines.length > 0) {
    console.log(`[BulkEmail] 📝 First line: "${rawLines[0].substring(0, 150)}"`);
  }

  if (rawLines.length === 0) return results;

  // ─── Detect if first line is a header ───
  const firstLine = rawLines[0].toLowerCase();
  const firstLineHasEmail = firstLine.includes('@') && isValidEmail(extractEmailFromText(rawLines[0]) || '');
  const isHeader = !firstLineHasEmail && (
    firstLine.includes('email') ||
    firstLine.includes('e-mail') ||
    firstLine.includes('mail') ||
    firstLine.includes('name') ||
    firstLine.includes('first') ||
    firstLine.includes('last') ||
    firstLine.includes('phone') ||
    firstLine.includes('contact') ||
    firstLine.includes('subscriber') ||
    firstLine.includes('address') ||
    (rawLines.length > 1 && rawLines[1].includes('@'))
  );

  let dataLines = rawLines;
  if (isHeader) {
    results.headerRow = rawLines[0];
    dataLines = rawLines.slice(1);
    console.log(`[BulkEmail] 📋 Header detected: "${rawLines[0]}"`);
  } else {
    console.log(`[BulkEmail] 📋 No header — treating all lines as data`);
  }

  // ─── Detect separator ───
  const separators = [
    { char: ',', name: 'comma' },
    { char: ';', name: 'semicolon' },
    { char: '\t', name: 'tab' },
    { char: '|', name: 'pipe' },
  ];

  let bestSeparator = null;
  let bestScore = 0;

  const sampleLines = dataLines.slice(0, Math.min(10, dataLines.length));
  for (const sep of separators) {
    let score = 0;
    for (const line of sampleLines) {
      const count = line.split(sep.char).length;
      if (count > 1) score += count;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSeparator = sep;
    }
  }

  // ─── Detect column positions from header ───
  let emailColIndex = 0;
  let nameColIndex = -1;

  if (bestSeparator && results.headerRow) {
    const headerCols = results.headerRow
      .split(bestSeparator.char)
      .map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
    console.log(`[BulkEmail] 📊 Header columns: [${headerCols.join(', ')}]`);

    // Find email column
    emailColIndex = headerCols.findIndex(h =>
      h === 'email' || h === 'e-mail' || h === 'email_address' ||
      h === 'emailaddress' || h === 'mail' || h === 'email address' ||
      h === 'subscriber_email' || h === 'user_email' || h === 'contact_email'
    );
    if (emailColIndex === -1) {
      for (let i = 0; i < headerCols.length; i++) {
        if (headerCols[i].includes('email') || headerCols[i].includes('mail')) {
          emailColIndex = i;
          break;
        }
      }
    }
    if (emailColIndex === -1) emailColIndex = 0;

    // Find name column
    nameColIndex = headerCols.findIndex(h =>
      h === 'name' || h === 'full_name' || h === 'fullname' ||
      h === 'full name' || h === 'display_name' || h === 'displayname' ||
      h === 'first_name' || h === 'firstname' || h === 'first name' ||
      h === 'subscriber_name' || h === 'user_name' || h === 'contact_name'
    );

    if (nameColIndex >= 0) results.hasNameColumn = true;
    console.log(`[BulkEmail] 📊 Email col index: ${emailColIndex}, Name col index: ${nameColIndex}`);
  }

  results.detectedSeparator = bestSeparator?.name || 'none';
  results.detectedFormat = bestSeparator && bestScore > 0 ? `csv-${bestSeparator.name}` : 'txt-line';
  console.log(`[BulkEmail] 📊 Format: ${results.detectedFormat}, Separator: ${results.detectedSeparator}`);

  // ─── Parse each data line ───
  const seen = new Set();

  for (let i = 0; i < dataLines.length; i++) {
    const rawLine = dataLines[i];
    results.totalRows++;

    // Local variables scoped to this iteration — fixes "name is not defined"
    let currentEmail = null;
    let currentName = null;

    const useCsvMode = bestSeparator && bestScore > 0;

    if (useCsvMode) {
      // CSV mode
      const cols = rawLine.split(bestSeparator.char).map(c =>
        c.trim().replace(/^["']|["']$/g, '').trim()
      );

      // Get email from detected column first
      const rawEmail = cols[emailColIndex] || '';
      currentEmail = rawEmail.trim().toLowerCase();

      // If no valid email in detected col, scan ALL columns
      if (!isValidEmail(currentEmail)) {
        currentEmail = null;
        for (const col of cols) {
          const extracted = extractEmailFromText(col);
          if (extracted && isValidEmail(extracted)) {
            currentEmail = extracted;
            break;
          }
        }
      }

      // Get name from detected column
      if (nameColIndex >= 0 && cols[nameColIndex]) {
        currentName = cleanName(cols[nameColIndex]);
      }

      // If no name column, try to find a name in other columns
      if (!currentName && cols.length > 1) {
        for (let j = 0; j < cols.length; j++) {
          if (j === emailColIndex) continue;
          const val = cols[j].trim();
          if (val && !isValidEmail(val) && val.length > 1 && val.length < 100) {
            const cleaned = cleanName(val);
            if (cleaned) {
              currentName = cleaned;
              if (!results.hasNameColumn) results.hasNameColumn = true;
              break;
            }
          }
        }
      }
    } else {
      // TXT / single-column mode
      // Pattern 1: "Name <email@domain.com>"
      const angleBracketMatch = rawLine.match(/^(.+?)\s*<([^>]+)>/);
      if (angleBracketMatch) {
        currentName = cleanName(angleBracketMatch[1]);
        currentEmail = angleBracketMatch[2].trim().toLowerCase();
      } else {
        // Pattern 2: Just an email, or email with surrounding text
        currentEmail = extractEmailFromText(rawLine);

        if (currentEmail && rawLine.trim().toLowerCase() !== currentEmail) {
          // There might be a name in the remaining text
          const remaining = rawLine
            .replace(currentEmail, '')
            .trim()
            .replace(/^[,;|\t\s]+|[,;|\t\s]+$/g, '')
            .trim();
          if (remaining) {
            const cleaned = cleanName(remaining);
            if (cleaned) {
              currentName = cleaned;
              results.hasNameColumn = true;
            }
          }
        }
      }
    }

    // Clean email
    if (currentEmail) {
      currentEmail = currentEmail.trim().toLowerCase().replace(/^["'<]|["'>]$/g, '').trim();
    }

    // Validate email
    if (!currentEmail || !isValidEmail(currentEmail)) {
      results.invalidRows.push({
        row: i + 1 + (isHeader ? 1 : 0),
        rawLine: rawLine.substring(0, 200),
        email: currentEmail || rawLine.substring(0, 50),
        name: currentName || null,
        reason: !currentEmail ? 'No email found in this line' : `Invalid email format: ${currentEmail}`
      });
      continue;
    }

    // Deduplicate
    if (seen.has(currentEmail)) {
      results.invalidRows.push({
        row: i + 1 + (isHeader ? 1 : 0),
        rawLine: rawLine.substring(0, 200),
        email: currentEmail,
        name: currentName,
        reason: 'Duplicate email'
      });
      continue;
    }

    seen.add(currentEmail);
    results.recipients.push({
      email: currentEmail,
      name: currentName || null,
      row: i + 1 + (isHeader ? 1 : 0)
    });
  }

  const dupeCount = results.invalidRows.filter(r => r.reason === 'Duplicate email').length;
  const invalidCount = results.invalidRows.length - dupeCount;

  console.log(`[BulkEmail] ✅ Parse complete:`);
  console.log(`[BulkEmail]    Total data rows: ${results.totalRows}`);
  console.log(`[BulkEmail]    Valid: ${results.recipients.length}`);
  console.log(`[BulkEmail]    Invalid: ${invalidCount}`);
  console.log(`[BulkEmail]    Duplicates: ${dupeCount}`);
  console.log(`[BulkEmail]    Has names: ${results.hasNameColumn}`);
  console.log(`[BulkEmail]    Format: ${results.detectedFormat}`);

  if (results.recipients.length > 0) {
    console.log(`[BulkEmail]    Sample: ${results.recipients[0].email} (${results.recipients[0].name || 'no name'})`);
  }

  return results;
}

// ════════════════════════════════════════════════════════════════
// MONGOOSE MODEL — BulkEmailJob
// ════════════════════════════════════════════════════════════════
const failureSchema = new mongoose.Schema({
  email: String,
  errorMessage: String,
  errorCode: String,
  attemptedAt: Date
}, { _id: false });

const bulkEmailJobSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.Mixed, default: null },
  adminEmail: { type: String, default: 'unknown' },
  adminName: { type: String, default: 'unknown' },
  fileName: { type: String, required: true },
  fileSizeBytes: { type: Number, default: 0 },
  subject: { type: String, required: true },
  htmlBody: { type: String, required: true },
  textBody: { type: String, default: null },
  totalRecipients: { type: Number, default: 0 },
  validRecipients: { type: Number, default: 0 },
  invalidRecipients: { type: Number, default: 0 },
  duplicateRecipients: { type: Number, default: 0 },
  sent: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'completed_with_errors', 'failed', 'cancelled'],
    default: 'queued',
    index: true
  },
  hasNameColumn: { type: Boolean, default: false },
  detectedFormat: { type: String, default: 'unknown' },
  recipients: { type: Array, default: [] },
  failures: { type: [failureSchema], default: [] },
  durationMs: { type: Number, default: 0 },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  error: { type: String, default: null },
  createdBy: {
    adminId: { type: mongoose.Schema.Types.Mixed, default: null },
    email: { type: String, default: 'unknown' },
    name: { type: String, default: 'unknown' }
  }
}, {
  timestamps: true,
  collection: 'bulkemailjobs'
});

bulkEmailJobSchema.index({ createdAt: -1 });
bulkEmailJobSchema.index({ status: 1, createdAt: -1 });

let BulkEmailJobModel = null;
function getBulkEmailJobModel() {
  if (BulkEmailJobModel) return BulkEmailJobModel;
  const conn = getAdminConnection();
  if (!conn) throw new Error('[BulkEmail] Admin DB connection not available');
  BulkEmailJobModel = conn.models.BulkEmailJob || conn.model('BulkEmailJob', bulkEmailJobSchema);
  console.log('[BulkEmail] ✅ BulkEmailJob model ready');
  return BulkEmailJobModel;
}

// ════════════════════════════════════════════════════════════════
// NODEMAILER TRANSPORTER
// ════════════════════════════════════════════════════════════════
function getTransporter() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587');
  const user = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM || process.env.EMAIL_FROM || user;
  const fromName = process.env.SMTP_FROM_NAME || process.env.EMAIL_FROM_NAME || 'UWE Services';

  if (!host || !user || !pass) {
    throw new Error('SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS env vars.');
  }

  console.log(`[BulkEmail] 📧 SMTP: ${host}:${port}, from: ${fromName} <${fromEmail}>`);

  const transporter = nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 10,
  });

  return { transporter, fromEmail, fromName };
}

// ════════════════════════════════════════════════════════════════
// TEMPLATE RENDERER
// ════════════════════════════════════════════════════════════════
function renderTemplate(template, vars) {
  if (!template) return '';
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : '';
  });
}

// ════════════════════════════════════════════════════════════════
// CONTROLLERS
// ════════════════════════════════════════════════════════════════

// ─── Preview Upload ───
async function previewUpload(req, res) {
  console.log('[BulkEmail] 📤 Preview upload request');

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { originalname, buffer, size } = req.file;
    console.log(`[BulkEmail] 📄 File: ${originalname}, size: ${size} bytes`);

    const content = buffer.toString('utf-8');
    console.log(`[BulkEmail] 📝 Content preview (first 500 chars):\n${content.substring(0, 500)}`);

    const parsed = parseRecipientFile(content, originalname);

    const dupeCount = parsed.invalidRows.filter(r => r.reason === 'Duplicate email').length;
    const invalidOnly = parsed.invalidRows.filter(r => r.reason !== 'Duplicate email');

    const response = {
      success: true,
      data: {
        fileName: originalname,
        fileSizeBytes: size,
        totalRows: parsed.totalRows,
        validRecipients: parsed.recipients.length,
        invalidRecipients: invalidOnly.length,
        duplicateRecipients: dupeCount,
        hasNameColumn: parsed.hasNameColumn,
        detectedFormat: parsed.detectedFormat,
        detectedSeparator: parsed.detectedSeparator,
        headerRow: parsed.headerRow,
        sampleRecipients: parsed.recipients.slice(0, 10).map(r => ({
          email: r.email,
          name: r.name,
          isValid: true,
          row: r.row
        })),
        invalidSamples: invalidOnly.slice(0, 10).map(r => ({
          email: r.email || (r.rawLine ? r.rawLine.substring(0, 50) : ''),
          name: r.name,
          isValid: false,
          invalidReason: r.reason,
          row: r.row
        }))
      }
    };

    console.log(`[BulkEmail] ✅ Preview OK: ${parsed.recipients.length} valid, ${invalidOnly.length} invalid, ${dupeCount} dupes`);

    return res.json(response);
  } catch (err) {
    console.error('[BulkEmail] ❌ Preview error:', err);
    console.error('[BulkEmail] Stack:', err.stack);
    return res.status(500).json({ success: false, message: err.message || 'Preview failed' });
  }
}

// ─── Start Bulk Send ───
async function startBulkSend(req, res) {
  console.log('[BulkEmail] 🚀 Start bulk send request');

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { subject, htmlBody, textBody } = req.body;
    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: 'Subject is required' });
    }
    if (!htmlBody || !htmlBody.trim()) {
      return res.status(400).json({ success: false, message: 'HTML body is required' });
    }

    const { originalname, buffer, size } = req.file;
    const content = buffer.toString('utf-8');
    const parsed = parseRecipientFile(content, originalname);

    if (parsed.recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid email addresses found in the file'
      });
    }

    const dupeCount = parsed.invalidRows.filter(r => r.reason === 'Duplicate email').length;
    const invalidCount = parsed.invalidRows.filter(r => r.reason !== 'Duplicate email').length;

    const BulkEmailJob = getBulkEmailJobModel();

    const job = await BulkEmailJob.create({
      adminId: req.admin?.adminId || req.admin?._id || null,
      adminEmail: req.admin?.email || 'unknown',
      adminName: req.admin?.name || 'unknown',
      fileName: originalname,
      fileSizeBytes: size,
      subject: subject.trim(),
      htmlBody: htmlBody.trim(),
      textBody: textBody?.trim() || null,
      totalRecipients: parsed.totalRows,
      validRecipients: parsed.recipients.length,
      invalidRecipients: invalidCount,
      duplicateRecipients: dupeCount,
      hasNameColumn: parsed.hasNameColumn,
      detectedFormat: parsed.detectedFormat,
      recipients: parsed.recipients,
      status: 'queued',
      createdBy: {
        adminId: req.admin?.adminId || req.admin?._id || null,
        email: req.admin?.email || 'unknown',
        name: req.admin?.name || 'unknown'
      }
    });

    console.log(`[BulkEmail] ✅ Job created: ${job._id}, ${parsed.recipients.length} recipients`);

    // Start sending in background (non-blocking)
    processJobInBackground(job._id).catch(err => {
      console.error('[BulkEmail] ❌ Background job error:', err);
    });

    return res.json({
      success: true,
      data: {
        jobId: job._id.toString(),
        status: 'queued',
        validRecipients: parsed.recipients.length,
        invalidRecipients: invalidCount,
        duplicateRecipients: dupeCount,
        message: `Job queued: sending to ${parsed.recipients.length} recipients`
      }
    });
  } catch (err) {
    console.error('[BulkEmail] ❌ Start send error:', err);
    console.error('[BulkEmail] Stack:', err.stack);
    return res.status(500).json({ success: false, message: err.message || 'Send failed' });
  }
}

// ─── Background sender ───
async function processJobInBackground(jobId) {
  const BulkEmailJob = getBulkEmailJobModel();
  const job = await BulkEmailJob.findById(jobId);
  if (!job) throw new Error('Job not found');

  const startTime = Date.now();
  console.log(`[BulkEmail] 🏃 Processing job ${jobId}, ${job.recipients.length} recipients`);

  let transporter, fromEmail, fromName;
  try {
    const smtp = getTransporter();
    transporter = smtp.transporter;
    fromEmail = smtp.fromEmail;
    fromName = smtp.fromName;
  } catch (err) {
    await BulkEmailJob.findByIdAndUpdate(jobId, {
      status: 'failed',
      error: err.message,
      durationMs: Date.now() - startTime,
      completedAt: new Date()
    });
    console.error(`[BulkEmail] ❌ SMTP setup failed:`, err.message);
    return;
  }

  await BulkEmailJob.findByIdAndUpdate(jobId, {
    status: 'running',
    startedAt: new Date()
  });

  let sent = 0;
  let failed = 0;
  const failures = [];
  const BATCH_SIZE = 50;
  const BATCH_DELAY = 2000;

  for (let i = 0; i < job.recipients.length; i += BATCH_SIZE) {
    const batch = job.recipients.slice(i, i + BATCH_SIZE);
    console.log(`[BulkEmail] 📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} emails`);

    for (const recipient of batch) {
      try {
        const vars = {
          name: recipient.name || 'Valued Customer',
          email: recipient.email
        };

        const renderedSubject = renderTemplate(job.subject, vars);
        const renderedHtml = renderTemplate(job.htmlBody, vars);
        const renderedText = job.textBody ? renderTemplate(job.textBody, vars) : null;

        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: recipient.email,
          subject: renderedSubject,
          html: renderedHtml,
          ...(renderedText ? { text: renderedText } : {})
        });

        sent++;
      } catch (err) {
        failed++;
        failures.push({
          email: recipient.email,
          errorMessage: err.message || 'Send failed',
          errorCode: err.code || 'unknown',
          attemptedAt: new Date()
        });
        console.error(`[BulkEmail] ❌ Failed: ${recipient.email}: ${err.message}`);
      }
    }

    const progress = Math.round(((i + batch.length) / job.recipients.length) * 100);
    await BulkEmailJob.findByIdAndUpdate(jobId, {
      sent, failed, progress,
      failures: failures.slice(-100)
    });

    console.log(`[BulkEmail] 📊 Progress: ${progress}% (${sent} sent, ${failed} failed)`);

    if (i + BATCH_SIZE < job.recipients.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  const durationMs = Date.now() - startTime;
  const finalStatus = failed === 0 ? 'completed'
    : sent === 0 ? 'failed'
    : 'completed_with_errors';

  await BulkEmailJob.findByIdAndUpdate(jobId, {
    sent, failed,
    progress: 100,
    status: finalStatus,
    failures: failures.slice(-200),
    durationMs,
    completedAt: new Date()
  });

  console.log(`[BulkEmail] ✅ Job ${jobId} done in ${durationMs}ms — ${finalStatus}: ${sent} sent, ${failed} failed`);

  try { transporter.close(); } catch (e) {}
}

// ─── Get Job Progress ───
async function getJobProgress(req, res) {
  try {
    const BulkEmailJob = getBulkEmailJobModel();
    const job = await BulkEmailJob.findById(req.params.id)
      .select('status progress sent failed validRecipients totalRecipients durationMs startedAt completedAt error')
      .lean();

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    return res.json({
      success: true,
      data: {
        jobId: job._id.toString(),
        status: job.status,
        progress: job.progress || 0,
        sent: job.sent || 0,
        failed: job.failed || 0,
        validRecipients: job.validRecipients || 0,
        totalRecipients: job.totalRecipients || 0,
        durationMs: job.durationMs || 0,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── Get Single Job Detail ───
async function getJob(req, res) {
  try {
    const BulkEmailJob = getBulkEmailJobModel();
    const job = await BulkEmailJob.findById(req.params.id)
      .select('-recipients')
      .lean();

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    return res.json({ success: true, data: { job } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── List Jobs ───
async function listJobs(req, res) {
  try {
    const BulkEmailJob = getBulkEmailJobModel();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    const [jobs, total] = await Promise.all([
      BulkEmailJob.find({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-recipients -failures -htmlBody -textBody')
        .lean(),
      BulkEmailJob.countDocuments({})
    ]);

    return res.json({
      success: true,
      data: {
        jobs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── Cancel Job ───
async function cancelJob(req, res) {
  try {
    const BulkEmailJob = getBulkEmailJobModel();
    const job = await BulkEmailJob.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (job.status !== 'queued' && job.status !== 'running') {
      return res.status(400).json({ success: false, message: 'Job cannot be cancelled — already ' + job.status });
    }
    job.status = 'cancelled';
    job.completedAt = new Date();
    await job.save();
    return res.json({ success: true, message: 'Job cancelled' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  previewUpload,
  startBulkSend,
  getJobProgress,
  getJob,
  listJobs,
  cancelJob
};