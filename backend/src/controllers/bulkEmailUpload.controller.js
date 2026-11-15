// backend/src/controllers/bulkEmailUpload.controller.js
// ============================================================
// 📧 BULK EMAIL UPLOAD CONTROLLER v4.0 — BULLETPROOF EMAIL EXTRACTOR
// Extracts EVERY email from file (CSV, TXT, mixed garbage, multi-per-line)
// Returns ALL recipients (not just sample)
// ============================================================

const mongoose = require('mongoose');

// ─── Safe emailService load ──────────────────────────────────
let sendNotificationEmail = null;
try {
  const svc = require('../utils/emailService');
  sendNotificationEmail = svc.sendNotificationEmail;
  console.log('[BulkEmail] ✅ emailService loaded');
} catch (err) {
  console.error('[BulkEmail] ❌ emailService load failed:', err.message);
}

// ─── Safe database load ──────────────────────────────────────
let getAdminConnection = null;
try {
  const dbModule = require('../config/database');
  getAdminConnection = dbModule.getAdminConnection;
  if (typeof getAdminConnection !== 'function') {
    throw new Error('getAdminConnection is not a function');
  }
  console.log('[BulkEmail] ✅ database module loaded');
} catch (err) {
  console.error('[BulkEmail] ❌ database module load failed:', err.message);
  try {
    const dbModule = require('../../config/database');
    getAdminConnection = dbModule.getAdminConnection;
    console.log('[BulkEmail] ✅ database loaded from alternate path');
  } catch {}
}

// ============================================================
// BULK EMAIL JOB MODEL (admin_panel DB)
// ============================================================
let BulkEmailJob = null;

function getJobModel() {
  if (BulkEmailJob) return BulkEmailJob;
  try {
    if (!getAdminConnection) throw new Error('getAdminConnection not available');
    const conn = getAdminConnection();
    if (!conn) throw new Error('admin_panel DB not connected');
    try {
      BulkEmailJob = conn.model('BulkEmailJob');
    } catch {
      // Try loading the proper model file
      try {
        BulkEmailJob = require('../models/BulkEmailJob');
      } catch {
        const schema = new mongoose.Schema(
          {
            adminId: { type: String, default: 'system' },
            adminEmail: { type: String, default: '' },
            fileName: { type: String, required: true },
            fileSizeBytes: { type: Number, default: 0 },
            subject: { type: String, required: true },
            htmlBody: { type: String, default: '' },
            textBody: { type: String, default: '' },
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
              enum: ['queued', 'running', 'processing', 'completed', 'completed_with_errors', 'failed', 'cancelled'],
              default: 'queued',
            },
            recipients: [
              {
                email: String,
                name: String,
                status: {
                  type: String,
                  enum: ['pending', 'sent', 'failed', 'skipped'],
                  default: 'pending',
                },
                errorMessage: String,
                sentAt: Date,
              },
            ],
            failures: [{ email: String, errorMessage: String }],
            createdBy: { adminId: String, email: String, name: String },
            startedAt: Date,
            completedAt: Date,
            durationMs: Number,
            errorMessage: String,
          },
          { timestamps: true, collection: 'bulkemailjobs' }
        );
        BulkEmailJob = conn.model('BulkEmailJob', schema);
      }
    }
    console.log('[BulkEmail] ✅ BulkEmailJob model ready');
    return BulkEmailJob;
  } catch (err) {
    console.error('[BulkEmail] ❌ Model init failed:', err.message);
    return null;
  }
}

// ============================================================
// BULLETPROOF EMAIL EXTRACTOR
// ============================================================

// Strict validator (RFC 5322 simplified but practical)
const EMAIL_VALIDATE_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,24}$/;

// Global extractor — finds ALL email-looking substrings in any text
const EMAIL_EXTRACT_REGEX = /[a-zA-Z0-9._%+\-!#$&'*+/=?^`{|}~]+@[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,24}/g;

function cleanName(raw) {
  if (!raw) return '';
  let n = String(raw).replace(/^["'<(\[]+|["'>)\]]+$/g, '').trim();
  n = n.replace(/<[^>]+>/g, '').trim();
  n = n.replace(/\([^)]*\)/g, '').trim();
  n = n.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ');
  // If the "name" is actually an email, discard it
  if (EMAIL_VALIDATE_REGEX.test(n)) return '';
  // If it contains @, it's probably email garbage
  if (n.includes('@')) return '';
  return n.substring(0, 100).trim();
}

/**
 * MAIN PARSER — Uses a 2-pass approach:
 * PASS 1: Try structured parsing (CSV/TSV) to capture name+email pairs
 * PASS 2: Scan EVERY line with regex to catch any email missed by pass 1
 * This guarantees no email is lost.
 */
function parseEmailFile(buffer, originalName = 'file.txt') {
  let raw;
  try {
    raw = buffer.toString('utf-8');
  } catch {
    raw = buffer.toString('latin1');
  }

  // Remove BOM
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);

  // Normalize all line endings
  raw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Pre-process: unescape quoted content and normalize unicode
  raw = raw.normalize('NFKC');

  const allLines = raw.split('\n');
  const nonEmptyLines = allLines.map(l => l.trim()).filter(l => l.length > 0);

  if (nonEmptyLines.length === 0) {
    return {
      valid: [],
      invalid: [],
      duplicates: 0,
      hasNames: false,
      format: 'empty',
      separator: null,
      hasHeader: false,
      totalLinesScanned: 0,
      totalEmailsFound: 0,
      error: 'File is empty',
    };
  }

  console.log(`[BulkEmail] 📝 Total non-empty lines: ${nonEmptyLines.length}`);
  console.log(`[BulkEmail] 📝 First line sample: "${nonEmptyLines[0].substring(0, 150)}"`);

  // ─── DETECT SEPARATOR ───
  const firstLine = nonEmptyLines[0];
  const separators = [
    { char: '\t', name: 'tab' },
    { char: ';', name: 'semicolon' },
    { char: '|', name: 'pipe' },
    { char: ',', name: 'comma' },
  ];
  let separator = ',';
  let sepName = 'comma';
  let maxCount = 0;
  for (const s of separators) {
    const count = (firstLine.match(new RegExp(`\\${s.char}`, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      separator = s.char;
      sepName = s.name;
    }
  }

  // ─── DETECT HEADER ───
  const firstCols = firstLine.split(separator).map(c => c.trim().replace(/^["']|["']$/g, ''));
  const firstColHasEmail = firstCols.some(c => EMAIL_VALIDATE_REGEX.test(c) || EMAIL_EXTRACT_REGEX.test(c));
  EMAIL_EXTRACT_REGEX.lastIndex = 0; // reset global regex

  let hasHeader = false;
  if (!firstColHasEmail) {
    const headerKeywords = ['email', 'e-mail', 'mail', 'name', 'first', 'last', 'contact', 'address'];
    hasHeader = firstCols.some(c => headerKeywords.includes(c.toLowerCase().trim()));
  }

  if (hasHeader) {
    console.log(`[BulkEmail] 📋 Header detected: "${firstLine.substring(0, 100)}"`);
  } else {
    console.log('[BulkEmail] 📋 No header — all lines treated as data');
  }

  const dataLines = hasHeader ? nonEmptyLines.slice(1) : nonEmptyLines;

  // ─── DETECT EMAIL/NAME COLUMNS (from header or by scanning) ───
  let emailColIdx = -1;
  let nameColIdx = -1;

  if (hasHeader) {
    for (let i = 0; i < firstCols.length; i++) {
      const lc = firstCols[i].toLowerCase().trim();
      if (emailColIdx === -1 && (lc === 'email' || lc === 'e-mail' || lc === 'mail' || lc.includes('email'))) {
        emailColIdx = i;
      }
      if (nameColIdx === -1 && (lc === 'name' || lc.includes('name') || lc === 'first' || lc === 'contact')) {
        nameColIdx = i;
      }
    }
  } else {
    // Scan first 10 data lines to detect which column holds emails
    const sampleCount = Math.min(10, dataLines.length);
    const colEmailHits = {};
    for (let li = 0; li < sampleCount; li++) {
      const cols = dataLines[li].split(separator);
      for (let ci = 0; ci < cols.length; ci++) {
        const cell = cols[ci].trim().replace(/^["']|["']$/g, '');
        if (EMAIL_VALIDATE_REGEX.test(cell)) {
          colEmailHits[ci] = (colEmailHits[ci] || 0) + 1;
        }
      }
    }
    // Pick column with most email hits
    let bestCol = -1, bestHits = 0;
    for (const [ci, hits] of Object.entries(colEmailHits)) {
      if (hits > bestHits) {
        bestHits = hits;
        bestCol = parseInt(ci);
      }
    }
    if (bestCol >= 0) {
      emailColIdx = bestCol;
      // Name column = adjacent column
      if (emailColIdx === 0 && firstCols.length > 1) nameColIdx = 1;
      else if (emailColIdx > 0) nameColIdx = 0;
    }
  }

  console.log(`[BulkEmail] 📊 Separator: ${sepName}, EmailCol: ${emailColIdx}, NameCol: ${nameColIdx}`);

  // ============================================================
  // PASS 1 + PASS 2 COMBINED: Extract every email from every line
  // ============================================================
  const emailMap = new Map(); // email(lower) -> { email, name, firstSeenRow }
  const invalid = [];
  let duplicatesSkipped = 0;
  let totalEmailsExtracted = 0;

  dataLines.forEach((line, rowIdx) => {
    // ─── PASS 1: Structured column extraction (preserves name) ───
    let structuredEmail = null;
    let structuredName = '';

    if (emailColIdx >= 0) {
      const cols = line.split(separator);
      const rawEmailCell = (cols[emailColIdx] || '').trim().replace(/^["']|["']$/g, '');

      // Handle "Name <email@x.com>" format
      const angleMatch = rawEmailCell.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/);
      if (angleMatch) {
        const candidate = angleMatch[1].toLowerCase().trim();
        if (EMAIL_VALIDATE_REGEX.test(candidate)) {
          structuredEmail = candidate;
          const namePart = rawEmailCell.replace(/<[^>]+>/, '').trim().replace(/^["']|["']$/g, '');
          if (namePart) structuredName = cleanName(namePart);
        }
      } else if (EMAIL_VALIDATE_REGEX.test(rawEmailCell)) {
        structuredEmail = rawEmailCell.toLowerCase().trim();
      }

      // Name from name column
      if (!structuredName && nameColIdx >= 0 && cols[nameColIdx]) {
        structuredName = cleanName(cols[nameColIdx]);
      }
    }

    // ─── PASS 2: Regex scan of ENTIRE line (catches anything missed) ───
    const matches = line.match(EMAIL_EXTRACT_REGEX) || [];

    if (matches.length === 0 && !structuredEmail) {
      // Line has no email at all
      invalid.push({
        email: line.substring(0, 80),
        name: '',
        isValid: false,
        invalidReason: 'no-email-found',
        row: rowIdx + (hasHeader ? 2 : 1),
      });
      return;
    }

    // Process structured email first (has name context)
    if (structuredEmail) {
      totalEmailsExtracted++;
      if (!EMAIL_VALIDATE_REGEX.test(structuredEmail)) {
        invalid.push({
          email: structuredEmail,
          name: structuredName,
          isValid: false,
          invalidReason: 'invalid-format',
          row: rowIdx + (hasHeader ? 2 : 1),
        });
      } else if (emailMap.has(structuredEmail)) {
        duplicatesSkipped++;
      } else {
        emailMap.set(structuredEmail, {
          email: structuredEmail,
          name: structuredName,
          row: rowIdx + (hasHeader ? 2 : 1),
        });
      }
    }

    // Process ALL other emails found in this line (via regex)
    for (const match of matches) {
      const emailLower = match.toLowerCase().trim();
      totalEmailsExtracted++;

      // Skip if this is the structured email we already processed
      if (structuredEmail && emailLower === structuredEmail) continue;

      if (!EMAIL_VALIDATE_REGEX.test(emailLower)) {
        invalid.push({
          email: match,
          name: '',
          isValid: false,
          invalidReason: 'invalid-format',
          row: rowIdx + (hasHeader ? 2 : 1),
        });
        continue;
      }

      if (emailMap.has(emailLower)) {
        duplicatesSkipped++;
        continue;
      }

      // Try to infer a name from the line context for this additional email
      let inferredName = '';
      // Look for "Name <email>" pattern around this email
      const contextRegex = new RegExp(
        `([^,;|\\t<]+)<\\s*${emailLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*>`,
        'i'
      );
      const ctxMatch = line.match(contextRegex);
      if (ctxMatch && ctxMatch[1]) {
        inferredName = cleanName(ctxMatch[1]);
      }

      emailMap.set(emailLower, {
        email: emailLower,
        name: inferredName,
        row: rowIdx + (hasHeader ? 2 : 1),
      });
    }

    EMAIL_EXTRACT_REGEX.lastIndex = 0; // reset global regex each iteration
  });

  // Convert map to array
  const valid = Array.from(emailMap.values()).map(r => ({
    email: r.email,
    name: r.name || '',
    isValid: true,
    row: r.row,
  }));

  const hasNames = valid.some(r => r.name && r.name.length > 0);

  console.log(`[BulkEmail] ✅ PARSE COMPLETE:`);
  console.log(`[BulkEmail]    Total data lines: ${dataLines.length}`);
  console.log(`[BulkEmail]    Total emails extracted (raw): ${totalEmailsExtracted}`);
  console.log(`[BulkEmail]    ✅ Valid unique emails: ${valid.length}`);
  console.log(`[BulkEmail]    ❌ Invalid entries: ${invalid.length}`);
  console.log(`[BulkEmail]    🔁 Duplicates skipped: ${duplicatesSkipped}`);
  console.log(`[BulkEmail]    👤 Has names: ${hasNames}`);
  console.log(`[BulkEmail]    📊 Format: csv-${sepName}`);
  if (valid.length > 0) {
    console.log(`[BulkEmail]    📧 First valid: ${valid[0].email} (${valid[0].name || 'no name'})`);
    console.log(`[BulkEmail]    📧 Last valid: ${valid[valid.length - 1].email}`);
  }

  return {
    valid,
    invalid,
    duplicates: duplicatesSkipped,
    hasNames,
    format: `csv-${sepName}`,
    separator: sepName,
    hasHeader,
    totalLinesScanned: dataLines.length,
    totalEmailsFound: totalEmailsExtracted,
    error: null,
  };
}

// ============================================================
// BACKGROUND JOB PROCESSOR
// ============================================================
const activeJobs = new Map();

async function processJob(jobId) {
  const Model = getJobModel();
  if (!Model) {
    console.error(`[BulkEmail] ❌ Cannot process job ${jobId}: model not ready`);
    return;
  }

  if (!sendNotificationEmail) {
    console.error(`[BulkEmail] ❌ Cannot process job ${jobId}: emailService not loaded`);
    try {
      await Model.findByIdAndUpdate(jobId, {
        status: 'failed',
        errorMessage: 'Email service not available',
        completedAt: new Date(),
      });
    } catch {}
    return;
  }

  try {
    const job = await Model.findById(jobId);
    if (!job) {
      console.error(`[BulkEmail] ❌ Job ${jobId} not found`);
      return;
    }

    if (job.status === 'cancelled') return;

    job.status = 'running';
    job.startedAt = new Date();
    await job.save();

    console.log(`[BulkEmail] 🏃 Processing job ${jobId}, ${job.totalRecipients} recipients`);
    activeJobs.set(jobId.toString(), true);

    const BATCH_SIZE = 50;
    const BATCH_DELAY_MS = 2000;
    const EMAIL_DELAY_MS = 300;

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < job.recipients.length; i++) {
      if (!activeJobs.get(jobId.toString())) {
        console.log(`[BulkEmail] ⛔ Job ${jobId} cancelled at ${i}/${job.recipients.length}`);
        job.status = 'cancelled';
        job.completedAt = new Date();
        job.durationMs = job.startedAt ? Date.now() - job.startedAt.getTime() : 0;
        await job.save();
        return;
      }

      const recipient = job.recipients[i];
      if (recipient.status !== 'pending') continue;

      try {
        const result = await sendNotificationEmail({
          to: recipient.email,
          subject: job.subject,
          customHtml: job.htmlBody,
          recipientName: recipient.name || '',
          skipValidation: false,
        });

        if (result.success) {
          recipient.status = 'sent';
          recipient.sentAt = new Date();
          sentCount++;
        } else if (result.skipped || result.fake) {
          recipient.status = 'skipped';
          recipient.errorMessage = result.message || 'filtered';
          skippedCount++;
        } else {
          recipient.status = 'failed';
          recipient.errorMessage = result.message || 'unknown error';
          failedCount++;
          if (!job.failures) job.failures = [];
          job.failures.push({ email: recipient.email, errorMessage: recipient.errorMessage });
        }
      } catch (err) {
        recipient.status = 'failed';
        recipient.errorMessage = err.message;
        failedCount++;
        if (!job.failures) job.failures = [];
        job.failures.push({ email: recipient.email, errorMessage: err.message });
      }

      job.sent = sentCount;
      job.failed = failedCount;
      job.skipped = skippedCount;
      job.progress = Math.round(((sentCount + failedCount + skippedCount) / job.totalRecipients) * 100);

      if ((i + 1) % 5 === 0 || i === job.recipients.length - 1) {
        await job.save();
      }

      if (i < job.recipients.length - 1) {
        await new Promise(r => setTimeout(r, EMAIL_DELAY_MS));
      }

      if ((i + 1) % BATCH_SIZE === 0 && i < job.recipients.length - 1) {
        console.log(`[BulkEmail] ⏸️ Batch pause after ${i + 1} emails...`);
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    job.status = failedCount > 0 ? 'completed_with_errors' : 'completed';
    job.completedAt = new Date();
    job.durationMs = job.startedAt ? Date.now() - job.startedAt.getTime() : 0;
    job.sent = sentCount;
    job.failed = failedCount;
    job.skipped = skippedCount;
    job.progress = 100;
    await job.save();

    activeJobs.delete(jobId.toString());
    console.log(`[BulkEmail] ✅ Job ${jobId} complete: ${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped`);
  } catch (err) {
    console.error(`[BulkEmail] ❌ Job ${jobId} error:`, err.message);
    try {
      const Model2 = getJobModel();
      if (Model2) {
        await Model2.findByIdAndUpdate(jobId, {
          status: 'failed',
          errorMessage: err.message,
          completedAt: new Date(),
        });
      }
    } catch {}
    activeJobs.delete(jobId.toString());
  }
}

// ============================================================
// CONTROLLERS
// ============================================================

// POST /preview
exports.previewUpload = async (req, res) => {
  try {
    console.log('[BulkEmail] 📤 Preview upload request');

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded. Attach a .csv or .txt file.' });
    }

    console.log(`[BulkEmail] 📄 File: ${req.file.originalname}, size: ${req.file.size} bytes`);
    const preview500 = req.file.buffer.toString('utf-8').substring(0, 500);
    console.log(`[BulkEmail] 📝 Content preview (first 500 chars):\n${preview500}`);

    const parsed = parseEmailFile(req.file.buffer, req.file.originalname);

    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    // Build normalized recipients list — ALL recipients, not sample
    const allRecipients = [
      ...parsed.valid.map(r => ({
        email: r.email,
        name: r.name || null,
        isValid: true,
        row: r.row,
      })),
      ...parsed.invalid.map(r => ({
        email: r.email,
        name: r.name || null,
        isValid: false,
        invalidReason: r.invalidReason,
        row: r.row,
      })),
    ];

    const totalRows = parsed.valid.length + parsed.invalid.length + parsed.duplicates;

    return res.json({
      success: true,
      data: {
        fileName: req.file.originalname,
        fileSizeBytes: req.file.size,
        fileSize: req.file.size, // alias
        format: parsed.format,
        detectedFormat: parsed.format,
        detectedSeparator: parsed.separator,
        separator: parsed.separator,
        hasHeaderRow: parsed.hasHeader,
        headerRow: parsed.hasHeader ? 'detected' : null,
        totalRows,
        totalLinesScanned: parsed.totalLinesScanned,
        totalEmailsFound: parsed.totalEmailsFound,

        // Both naming conventions for frontend compatibility
        validRecipients: parsed.valid.length,
        invalidRecipients: parsed.invalid.length,
        duplicateRecipients: parsed.duplicates,
        validCount: parsed.valid.length,
        invalidCount: parsed.invalid.length,
        duplicateCount: parsed.duplicates,

        hasNames: parsed.hasNames,
        hasNameColumn: parsed.hasNames,

        // ✅ RETURN ALL RECIPIENTS (not just sample)
        sampleRecipients: allRecipients,
        allRecipients,
        invalidSamples: parsed.invalid.slice(0, 20),
      },
    });
  } catch (err) {
    console.error('[BulkEmail] ❌ Preview error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /send
exports.startBulkSend = async (req, res) => {
  try {
    console.log('[BulkEmail] 🚀 Start bulk send request');
    console.log(`[BulkEmail] 📦 Body keys: ${Object.keys(req.body).join(', ')}`);

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { subject, htmlBody, textBody } = req.body;
    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: 'Subject is required' });
    }
    if (!htmlBody || !htmlBody.trim()) {
      return res.status(400).json({ success: false, message: 'Email body (HTML) is required' });
    }

    console.log(`[BulkEmail] 📄 Parsing file: ${req.file.originalname}, size: ${req.file.size} bytes`);

    const parsed = parseEmailFile(req.file.buffer, req.file.originalname);

    if (parsed.error || parsed.valid.length === 0) {
      return res.status(400).json({
        success: false,
        message: parsed.error || 'No valid emails found in file',
      });
    }

    const Model = getJobModel();
    if (!Model) {
      return res.status(500).json({ success: false, message: 'Database not ready' });
    }

    const job = new Model({
      adminId: req.admin?.adminId || req.admin?._id || 'system',
      adminEmail: req.admin?.email || '',
      fileName: req.file.originalname,
      fileSizeBytes: req.file.size,
      subject: subject.trim(),
      htmlBody: htmlBody,
      textBody: textBody || '',
      totalRecipients: parsed.valid.length,
      validRecipients: parsed.valid.length,
      invalidRecipients: parsed.invalid.length,
      duplicateRecipients: parsed.duplicates,
      status: 'queued',
      progress: 0,
      createdBy: {
        adminId: req.admin?._id || null,
        email: req.admin?.email || '',
        name: req.admin?.name || '',
      },
      recipients: parsed.valid.map(r => ({
        email: r.email,
        name: r.name || '',
        status: 'pending',
      })),
    });

    await job.save();
    console.log(`[BulkEmail] ✅ Job created: ${job._id}, ${parsed.valid.length} recipients`);

    processJob(job._id).catch(err => {
      console.error(`[BulkEmail] ❌ Background process error:`, err.message);
    });

    return res.json({
      success: true,
      data: {
        jobId: job._id,
        totalRecipients: parsed.valid.length,
        validRecipients: parsed.valid.length,
        validCount: parsed.valid.length,
        invalidRecipients: parsed.invalid.length,
        invalidCount: parsed.invalid.length,
        duplicateRecipients: parsed.duplicates,
        duplicateCount: parsed.duplicates,
        status: 'queued',
        message: `Job queued. ${parsed.valid.length} emails will be sent shortly.`,
      },
    });
  } catch (err) {
    console.error('[BulkEmail] ❌ Send error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /jobs
exports.listJobs = async (req, res) => {
  try {
    const Model = getJobModel();
    if (!Model) return res.json({ success: true, data: { jobs: [] } });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      Model.find({})
        .select('-recipients -failures')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Model.countDocuments({}),
    ]);

    return res.json({
      success: true,
      data: {
        jobs,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (err) {
    console.error('[BulkEmail] listJobs error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /jobs/:id
exports.getJob = async (req, res) => {
  try {
    const Model = getJobModel();
    if (!Model) return res.status(404).json({ success: false, message: 'DB not ready' });

    const job = await Model.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    return res.json({ success: true, data: { job } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /jobs/:id/progress
exports.getJobProgress = async (req, res) => {
  try {
    const Model = getJobModel();
    if (!Model) return res.status(404).json({ success: false, message: 'DB not ready' });

    const job = await Model.findById(req.params.id)
      .select('status totalRecipients validRecipients sent failed skipped progress startedAt completedAt durationMs errorMessage')
      .lean();

    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    const sent = job.sent || 0;
    const failed = job.failed || 0;
    const skipped = job.skipped || 0;
    const total = job.totalRecipients || job.validRecipients || 0;
    const progress = job.progress || (total > 0 ? Math.round(((sent + failed + skipped) / total) * 100) : 0);

    return res.json({
      success: true,
      data: {
        jobId: job._id || req.params.id,
        status: job.status,
        totalRecipients: total,
        validRecipients: job.validRecipients || total,
        sent,
        failed,
        skipped,
        progress,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        durationMs: job.durationMs || 0,
        error: job.errorMessage,
        errorMessage: job.errorMessage,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /jobs/:id/cancel
exports.cancelJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    activeJobs.delete(jobId.toString());

    const Model = getJobModel();
    if (Model) {
      await Model.findByIdAndUpdate(jobId, {
        status: 'cancelled',
        completedAt: new Date(),
      });
    }

    return res.json({ success: true, message: 'Job cancelled' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};