// backend/src/controllers/bulkEmailUpload.controller.js
// ============================================================
// 📧 BULK EMAIL UPLOAD CONTROLLER v3.2
// Uses existing emailService.js (Brevo SMTP/HTTP + Fake Filter + Retry)
// FIXED: database import path (../config not ../../config)
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
  // Try alternate paths
  try {
    const dbModule = require('../../config/database');
    getAdminConnection = dbModule.getAdminConnection;
    console.log('[BulkEmail] ✅ database loaded from alternate path (../../config/database)');
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
      const schema = new mongoose.Schema(
        {
          adminId: { type: String, default: 'system' },
          adminEmail: { type: String, default: '' },
          fileName: { type: String, required: true },
          subject: { type: String, required: true },
          htmlBody: { type: String, default: '' },
          totalRecipients: { type: Number, default: 0 },
          validCount: { type: Number, default: 0 },
          invalidCount: { type: Number, default: 0 },
          duplicateCount: { type: Number, default: 0 },
          sentCount: { type: Number, default: 0 },
          failedCount: { type: Number, default: 0 },
          skippedCount: { type: Number, default: 0 },
          status: {
            type: String,
            enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'],
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
              error: String,
              sentAt: Date,
            },
          ],
          startedAt: Date,
          completedAt: Date,
          errorMessage: String,
        },
        { timestamps: true, collection: 'bulkemailjobs' }
      );
      BulkEmailJob = conn.model('BulkEmailJob', schema);
    }
    console.log('[BulkEmail] ✅ BulkEmailJob model ready');
    return BulkEmailJob;
  } catch (err) {
    console.error('[BulkEmail] ❌ Model init failed:', err.message);
    return null;
  }
}

// ============================================================
// CSV / TXT PARSER
// ============================================================
function cleanName(raw) {
  if (!raw) return '';
  let n = raw.replace(/^["']|["']$/g, '').trim();
  n = n.replace(/<[^>]+>/g, '').trim();
  n = n.replace(/\s+/g, ' ');
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(n)) return '';
  return n.substring(0, 100);
}

function parseEmailFile(buffer, originalName) {
  let raw = buffer.toString('utf-8');

  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  raw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const allLines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (allLines.length === 0) {
    return { valid: [], invalid: [], duplicates: 0, hasNames: false, format: 'empty', error: 'File is empty' };
  }

  console.log(`[BulkEmail] 📝 Total non-empty lines: ${allLines.length}`);
  console.log(`[BulkEmail] 📝 First line: "${allLines[0].substring(0, 120)}"`);

  const firstLine = allLines[0];
  let separator = ',';
  if (firstLine.includes('\t')) separator = '\t';
  else if (firstLine.includes(';')) separator = ';';
  else if (firstLine.includes('|')) separator = '|';
  else if (firstLine.includes(',')) separator = ',';

  const sepName = separator === '\t' ? 'tab' : separator === ';' ? 'semicolon' : separator === '|' ? 'pipe' : 'comma';

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  const angleBracketRegex = /<?([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/;

  let hasHeader = false;
  const firstCols = firstLine.split(separator).map(c => c.trim().replace(/^["']|["']$/g, ''));
  const firstColHasEmail = emailRegex.test(firstCols[0]) || angleBracketRegex.test(firstCols[0]);

  if (!firstColHasEmail && firstCols.length >= 1) {
    const headerKeywords = ['email', 'e-mail', 'mail', 'name', 'first', 'last', 'contact'];
    const isHeader = firstCols.some(c => headerKeywords.includes(c.toLowerCase()));
    if (isHeader) {
      hasHeader = true;
      console.log(`[BulkEmail] 📋 Header detected: "${firstLine}"`);
    }
  }

  if (!hasHeader) {
    console.log('[BulkEmail] 📋 No header — treating all lines as data');
  }

  const dataLines = hasHeader ? allLines.slice(1) : allLines;

  let emailColIdx = 0;
  let nameColIdx = -1;

  if (hasHeader) {
    for (let i = 0; i < firstCols.length; i++) {
      const lc = firstCols[i].toLowerCase();
      if (lc.includes('email') || lc.includes('mail')) emailColIdx = i;
      if (lc.includes('name') || lc.includes('first')) nameColIdx = i;
    }
  } else {
    const sampleLines = dataLines.slice(0, Math.min(5, dataLines.length));
    for (let col = 0; col < 5; col++) {
      let emailHits = 0;
      for (const line of sampleLines) {
        const cols = line.split(separator).map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols[col] && emailRegex.test(cols[col])) emailHits++;
        else if (cols[col] && angleBracketRegex.test(cols[col])) emailHits++;
      }
      if (emailHits >= Math.ceil(sampleLines.length * 0.5)) {
        emailColIdx = col;
        break;
      }
    }
    if (emailColIdx === 0 && firstCols.length > 1) {
      nameColIdx = 1;
    } else if (emailColIdx === 1) {
      nameColIdx = 0;
    }
  }

  console.log(`[BulkEmail] 📊 Format: csv-${sepName}, Separator: ${sepName}`);

  const valid = [];
  const invalid = [];
  const seenEmails = new Set();
  let duplicates = 0;
  let hasNames = false;

  for (const line of dataLines) {
    const cols = line.split(separator).map(c => c.trim().replace(/^["']|["']$/g, ''));

    let currentEmail = '';
    let currentName = '';

    const rawEmail = cols[emailColIdx] || '';
    const angleMatch = rawEmail.match(angleBracketRegex);
    if (angleMatch) {
      currentEmail = angleMatch[1].toLowerCase().trim();
    } else if (emailRegex.test(rawEmail)) {
      currentEmail = rawEmail.toLowerCase().trim();
    }

    if (nameColIdx >= 0 && cols[nameColIdx]) {
      currentName = cleanName(cols[nameColIdx]);
    } else if (angleBracketRegex.test(rawEmail)) {
      const namePart = rawEmail.replace(/<[^>]+>/, '').trim().replace(/^["']|["']$/g, '');
      if (namePart) currentName = cleanName(namePart);
    }

    if (currentName) hasNames = true;

    if (!currentEmail || !emailRegex.test(currentEmail)) {
      invalid.push({ email: rawEmail || line.substring(0, 50), reason: 'invalid-email' });
      continue;
    }

    if (seenEmails.has(currentEmail)) {
      duplicates++;
      continue;
    }
    seenEmails.add(currentEmail);

    valid.push({ email: currentEmail, name: currentName });
  }

  console.log(`[BulkEmail] ✅ Parse complete:`);
  console.log(`[BulkEmail]    Total data rows: ${dataLines.length}`);
  console.log(`[BulkEmail]    Valid: ${valid.length}`);
  console.log(`[BulkEmail]    Invalid: ${invalid.length}`);
  console.log(`[BulkEmail]    Duplicates: ${duplicates}`);
  console.log(`[BulkEmail]    Has names: ${hasNames}`);
  console.log(`[BulkEmail]    Format: csv-${sepName}`);
  if (valid.length > 0) {
    console.log(`[BulkEmail]    Sample: ${valid[0].email} (${valid[0].name || 'no name'})`);
  }

  return {
    valid,
    invalid,
    duplicates,
    hasNames,
    format: `csv-${sepName}`,
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

    job.status = 'processing';
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
          recipient.error = result.message || 'filtered';
          skippedCount++;
        } else {
          recipient.status = 'failed';
          recipient.error = result.message || 'unknown error';
          failedCount++;
        }
      } catch (err) {
        recipient.status = 'failed';
        recipient.error = err.message;
        failedCount++;
      }

      job.sentCount = sentCount;
      job.failedCount = failedCount;
      job.skippedCount = skippedCount;

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

    job.status = 'completed';
    job.completedAt = new Date();
    job.sentCount = sentCount;
    job.failedCount = failedCount;
    job.skippedCount = skippedCount;
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
// CONTROLLERS — Export names MUST match route file
// ============================================================

// POST /preview
exports.previewUpload = async (req, res) => {
  try {
    console.log('[BulkEmail] 📤 Preview upload request');

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded. Attach a .csv or .txt file.' });
    }

    console.log(`[BulkEmail] 📄 File: ${req.file.originalname}, size: ${req.file.size} bytes`);
    console.log(`[BulkEmail] 📝 Content preview (first 500 chars):\n${req.file.buffer.toString('utf-8').substring(0, 500)}`);

    const parsed = parseEmailFile(req.file.buffer, req.file.originalname);

    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    return res.json({
      success: true,
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        format: parsed.format,
        totalRows: parsed.valid.length + parsed.invalid.length + parsed.duplicates,
        validCount: parsed.valid.length,
        invalidCount: parsed.invalid.length,
        duplicateCount: parsed.duplicates,
        hasNames: parsed.hasNames,
        sampleRecipients: parsed.valid.slice(0, 10),
        sampleInvalid: parsed.invalid.slice(0, 5),
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

    const { subject, htmlBody } = req.body;
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
      subject: subject.trim(),
      htmlBody: htmlBody,
      totalRecipients: parsed.valid.length,
      validCount: parsed.valid.length,
      invalidCount: parsed.invalid.length,
      duplicateCount: parsed.duplicates,
      status: 'queued',
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
        validCount: parsed.valid.length,
        invalidCount: parsed.invalid.length,
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
    if (!Model) return res.json({ success: true, data: [] });

    const jobs = await Model.find({})
      .select('-recipients')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({ success: true, data: jobs });
  } catch (err) {
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

    return res.json({ success: true, data: job });
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
      .select('status totalRecipients sentCount failedCount skippedCount startedAt completedAt errorMessage')
      .lean();

    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    return res.json({
      success: true,
      data: {
        jobId: job._id || req.params.id,
        status: job.status,
        totalRecipients: job.totalRecipients,
        sentCount: job.sentCount || 0,
        failedCount: job.failedCount || 0,
        skippedCount: job.skippedCount || 0,
        progress: job.totalRecipients > 0
          ? Math.round(((job.sentCount + job.failedCount + job.skippedCount) / job.totalRecipients) * 100)
          : 0,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
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