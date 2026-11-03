// backend/src/utils/emailService.js
// ============================================================
// 📧 EMAIL SERVICE — Brevo SMTP Relay + Fake Filter + Retry
// ============================================================

const nodemailer = require('nodemailer');
const dns = require('dns').promises;
const https = require('https');

// ============================================================
// CONFIG
// ============================================================
const RAW_HOST = (process.env.EMAIL_HOST || '').trim().toLowerCase();
const IS_BREVO = RAW_HOST.includes('brevo') || RAW_HOST.includes('sendinblue');
const IS_GMAIL = RAW_HOST.includes('gmail') || RAW_HOST === '';
const USE_EXPLICIT_HOST = RAW_HOST.length > 0 && !IS_GMAIL;

const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587', 10);
const EMAIL_SECURE = String(process.env.EMAIL_SECURE || 'false').toLowerCase() === 'true';
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || '';
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || EMAIL_USER;
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'UWE Services';
const EMAIL_SERVICE = (process.env.EMAIL_SERVICE || '').trim().toLowerCase();

const BREVO_API_KEY = (process.env.BREVO_API_KEY || '').trim();
const USE_BREVO_HTTP = BREVO_API_KEY.length > 0;

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
const BULK_EMAIL_DELAY_MS = 600;
const BULK_BATCH_SIZE = 50;
const BULK_BATCH_PAUSE_MS = 5000;
const BREVO_DAILY_LIMIT = 290;
const MX_CACHE_TTL = 3600000; // 1h

// ============================================================
// PROVIDER LABEL
// ============================================================
const PROVIDER_LABEL = USE_BREVO_HTTP
  ? '🟢 Brevo HTTP API'
  : IS_BREVO
  ? '🟢 Brevo SMTP Relay'
  : IS_GMAIL
  ? '🔵 Gmail SMTP'
  : `⚙️  Custom SMTP (${EMAIL_HOST})`;

// ============================================================
// STARTUP BANNER (IIFE — prints immediately on require)
// ============================================================
(() => {
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  📧 EMAIL PROVIDER: ${pad(PROVIDER_LABEL, 40)} ║`);
  console.log(`║  📤 From:  ${pad(EMAIL_FROM_ADDRESS, 50)} ║`);
  console.log(`║  🏠 Host:  ${pad(`${EMAIL_HOST}:${EMAIL_PORT}`, 50)} ║`);
  console.log(`║  👤 User:  ${pad(EMAIL_USER || '(not set)', 50)} ║`);
  console.log(`║  🛡️  Fake email filter: ENABLED                              ║`);
  console.log(`║  🔁 Retry: ${MAX_RETRIES}x with exponential backoff                 ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  if (!EMAIL_USER || !EMAIL_PASSWORD) {
    console.warn('⚠️  [EmailService] EMAIL_USER or EMAIL_PASSWORD not set — emails will FAIL');
  }
  if (process.env.EMAIL_SERVICE && IS_BREVO) {
    console.warn('⚠️  [EmailService] EMAIL_SERVICE env var is set — DELETE IT. It overrides Brevo host!');
  }
})();

// ============================================================
// NODEMAILER TRANSPORT
// ============================================================
const transportConfig = USE_EXPLICIT_HOST
  ? {
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_SECURE,
      auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 60000,
      tls: { rejectUnauthorized: false },
    }
  : {
      service: EMAIL_SERVICE || 'gmail',
      host: EMAIL_HOST || 'smtp.gmail.com',
      port: EMAIL_PORT,
      secure: EMAIL_SECURE,
      auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 60000,
    };

const transporter = nodemailer.createTransport(transportConfig);

// ============================================================
// FAKE EMAIL FILTER
// ============================================================
const FAKE_DOMAINS = new Set([
  'test.com', 'example.com', 'example.org', 'example.net',
  'fake.com', 'fakemail.com', 'tempmail.com', 'temp-mail.org',
  'mailinator.com', 'guerrillamail.com', 'throwaway.email',
  'cloudtestlabaccounts.com', '10minutemail.com', 'yopmail.com',
  'trashmail.com', 'getnada.com', 'dispostable.com',
  'abc.com', 'xyz.com', '123.com', 'localhost', 'invalid.com',
]);

const FAKE_EMAIL_PATTERNS = [
  /^test\d*@/i,
  /^fake\d*@/i,
  /^demo\d*@/i,
  /^sample\d*@/i,
  /^dummy\d*@/i,
  /^abc\d*@/i,
  /^xyz\d*@/i,
  /^(sam|naman|bhavuk|vickey|ved|heh|pranav|vijsag|maurya|rubi)\d*@gmail\.com$/i,
  /^(vaibhav|veduu|bhavuk\d+|bahvuk|kushal|anshul\d+)@gmail\.com$/i,
  /^(mayank|vrinda|mangala|great|muskan|nihanshu|komal)\d*@gmail\.com$/i,
  /^[a-z0-9]{20,}@cloudtestlabaccounts\.com$/i,
  /^vijsag[a-z]*@gmail\.com$/i,
  /^heh@/i,
  /^qwe/i,
  /^asd/i,
  /^zxc/i,
  /^user\d+@/i,
  /^admin\d*@/i,
  /^noreply@/i,
  /^donotreply@/i,
];

const mxCache = new Map();

function validateEmailFormat(email) {
  if (!email || typeof email !== 'string') return { valid: false, reason: 'empty' };
  const trimmed = email.trim().toLowerCase();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(trimmed)) return { valid: false, reason: 'invalid-format' };

  const domain = trimmed.split('@')[1];
  if (FAKE_DOMAINS.has(domain)) return { valid: false, reason: 'fake-domain' };
  for (const pat of FAKE_EMAIL_PATTERNS) {
    if (pat.test(trimmed)) return { valid: false, reason: 'fake-pattern' };
  }
  return { valid: true, email: trimmed, domain };
}

async function checkDomainMX(domain) {
  if (!domain) return false;
  const now = Date.now();
  const cached = mxCache.get(domain);
  if (cached && (now - cached.ts) < MX_CACHE_TTL) return cached.ok;
  try {
    const records = await dns.resolveMx(domain);
    const ok = Array.isArray(records) && records.length > 0;
    mxCache.set(domain, { ok, ts: now });
    return ok;
  } catch (err) {
    mxCache.set(domain, { ok: false, ts: now });
    return false;
  }
}

async function isGenuineEmail(email) {
  const fmt = validateEmailFormat(email);
  if (!fmt.valid) return { genuine: false, reason: fmt.reason };
  const mxOk = await checkDomainMX(fmt.domain);
  if (!mxOk) return { genuine: false, reason: 'no-mx-record' };
  return { genuine: true, email: fmt.email };
}

// ============================================================
// HELPERS
// ============================================================
function sanitizeSubject(s) {
  if (!s || typeof s !== 'string') return 'Notification from UWE Services';
  return s.replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
}

function personalizeHtml(html, data = {}) {
  if (!html) return '';
  let out = String(html);
  const map = {
    '{{name}}': data.recipientName || data.name || 'there',
    '{{recipientName}}': data.recipientName || data.name || 'there',
    '{{email}}': data.to || data.email || '',
    '{{title}}': data.title || '',
    '{{body}}': data.body || '',
    '{{actionUrl}}': data.actionUrl || '#',
    '{{actionText}}': data.actionText || 'View',
    '{{year}}': String(new Date().getFullYear()),
    '{{company}}': EMAIL_FROM_NAME,
  };
  for (const [k, v] of Object.entries(map)) {
    out = out.split(k).join(v);
  }
  return out;
}

function htmlToPlainText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
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

// ============================================================
// EMAIL TEMPLATE (fallback)
// ============================================================
function getNotificationEmailTemplate(options = {}) {
  const {
    title = 'Notification',
    body = '',
    recipientName = 'there',
    actionUrl,
    actionText = 'View Details',
    imageUrl,
    priority = 'normal',
  } = options;

  const priorityColor = {
    high: '#ef4444',
    normal: '#3b82f6',
    low: '#6b7280',
  }[priority] || '#3b82f6';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
<tr><td style="background:${priorityColor};padding:20px 32px;color:#fff;">
<h1 style="margin:0;font-size:22px;font-weight:600;">${EMAIL_FROM_NAME}</h1>
</td></tr>
${imageUrl ? `<tr><td><img src="${imageUrl}" alt="" style="width:100%;display:block;"></td></tr>` : ''}
<tr><td style="padding:32px;">
<h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Hi ${recipientName},</h2>
<h3 style="margin:0 0 12px;color:#111827;font-size:18px;">${title}</h3>
<div style="color:#374151;font-size:15px;line-height:1.6;">${body}</div>
${actionUrl ? `<div style="margin-top:24px;"><a href="${actionUrl}" style="display:inline-block;padding:12px 28px;background:${priorityColor};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">${actionText}</a></div>` : ''}
</td></tr>
<tr><td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:center;">
<p style="margin:0;">© ${new Date().getFullYear()} ${EMAIL_FROM_NAME}. All rights reserved.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function getPlainTextVersion(options = {}) {
  const { title = '', body = '', recipientName = 'there', actionUrl, actionText = 'View' } = options;
  let txt = `Hi ${recipientName},\n\n${title}\n\n${htmlToPlainText(body)}`;
  if (actionUrl) txt += `\n\n${actionText}: ${actionUrl}`;
  txt += `\n\n—\n© ${new Date().getFullYear()} ${EMAIL_FROM_NAME}`;
  return txt;
}

// ============================================================
// BREVO HTTP API SENDER (fallback if SMTP blocked)
// ============================================================
function sendViaBrevoHttp({ to, subject, html, text, fromName, fromEmail }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    });

    const req = https.request({
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
        'accept': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve({ ok: true }); }
        } else {
          reject(new Error(`Brevo HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Brevo HTTP timeout')); });
    req.write(payload);
    req.end();
  });
}

// ============================================================
// RETRY WRAPPER
// ============================================================
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sendWithRetry(mailOptions) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      return info;
    } catch (err) {
      lastErr = err;
      console.warn(`⚠️  [EmailService] SMTP attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

// ============================================================
// MAIN: sendNotificationEmail
// ============================================================
async function sendNotificationEmail(options = {}) {
  const {
    to,
    subject: rawSubject,
    title = 'Notification',
    body = '',
    recipientName = 'there',
    actionUrl,
    actionText = 'View Details',
    imageUrl,
    priority = 'normal',
    customHtml,
    skipValidation = false,
  } = options;

  if (!to) {
    return { success: false, message: 'Recipient email required', recipient: null };
  }

  // Validate (unless skipped — bulk pre-validates)
  if (!skipValidation) {
    const check = await isGenuineEmail(to);
    if (!check.genuine) {
      console.log(`⏭️  [EmailService] SKIP fake email: ${to} (${check.reason})`);
      return { success: false, skipped: true, fake: true, recipient: to, message: `Skipped: ${check.reason}` };
    }
  }

  const subject = sanitizeSubject(rawSubject || title);
  const html = customHtml
    ? personalizeHtml(customHtml, { to, recipientName, title, body, actionUrl, actionText })
    : getNotificationEmailTemplate({ title, body, recipientName, actionUrl, actionText, imageUrl, priority });
  const text = customHtml
    ? htmlToPlainText(html)
    : getPlainTextVersion({ title, body, recipientName, actionUrl, actionText });

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM_ADDRESS}>`,
    to,
    subject,
    html,
    text,
  };

  // Try HTTP API first if configured
  if (USE_BREVO_HTTP) {
    try {
      const result = await sendViaBrevoHttp({
        to, subject, html, text,
        fromName: EMAIL_FROM_NAME,
        fromEmail: EMAIL_FROM_ADDRESS,
      });
      console.log(`✅ [EmailService] HTTP sent to ${to} (msgId: ${result.messageId || 'n/a'})`);
      return { success: true, messageId: result.messageId || null, recipient: to };
    } catch (err) {
      console.warn(`⚠️  [EmailService] Brevo HTTP failed, falling back to SMTP: ${err.message}`);
    }
  }

  // SMTP send
  try {
    const info = await sendWithRetry(mailOptions);
    console.log(`✅ [EmailService] SMTP sent to ${to} (msgId: ${info.messageId})`);
    return { success: true, messageId: info.messageId, recipient: to };
  } catch (err) {
    console.error(`❌ [EmailService] FAILED to send to ${to}: ${err.message}`);
    return { success: false, message: err.message, recipient: to };
  }
}

// ============================================================
// BULK SENDER
// ============================================================
async function sendBulkEmails(recipients = []) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { success: false, totalSent: 0, totalFailed: 0, totalSkipped: 0, failures: [], skipped: [] };
  }

  console.log(`📬 [EmailService] Bulk send starting: ${recipients.length} recipients`);
  console.log(`   Provider: ${PROVIDER_LABEL}`);

  // Pre-filter: validate all emails once
  const genuine = [];
  const skipped = [];
  for (const r of recipients) {
    const email = r.to || r.email;
    const check = await isGenuineEmail(email);
    if (check.genuine) {
      genuine.push(r);
    } else {
      skipped.push({ recipient: email, reason: check.reason });
    }
  }

  console.log(`   ✅ Genuine: ${genuine.length}`);
  console.log(`   ⏭️  Skipped (fake): ${skipped.length}`);

  if (skipped.length > 0) {
    console.log(`   Skipped list:`);
    skipped.slice(0, 10).forEach(s => console.log(`     - ${s.recipient} (${s.reason})`));
  }

  // Enforce Brevo daily limit
  if (!IS_GMAIL && genuine.length > BREVO_DAILY_LIMIT) {
    console.warn(`⚠️  [EmailService] ${genuine.length} > Brevo daily limit (${BREVO_DAILY_LIMIT}). Truncating.`);
    genuine.length = BREVO_DAILY_LIMIT;
  }

  let totalSent = 0;
  let totalFailed = 0;
  const failures = [];

  for (let i = 0; i < genuine.length; i++) {
    const r = genuine[i];
    const res = await sendNotificationEmail({ ...r, skipValidation: true });
    if (res.success) {
      totalSent++;
    } else {
      totalFailed++;
      failures.push({ recipient: r.to || r.email, error: res.message });
    }

    // Rate limit between emails
    if (i < genuine.length - 1) await sleep(BULK_EMAIL_DELAY_MS);

    // Batch pause
    if ((i + 1) % BULK_BATCH_SIZE === 0 && i < genuine.length - 1) {
      console.log(`   ⏸️  Batch pause (${BULK_BATCH_PAUSE_MS}ms) after ${i + 1} emails...`);
      await sleep(BULK_BATCH_PAUSE_MS);
    }
  }

  console.log(`📬 [EmailService] Bulk done: sent=${totalSent} failed=${totalFailed} skipped=${skipped.length}`);

  return {
    success: totalSent > 0,
    totalSent,
    totalFailed,
    totalSkipped: skipped.length,
    failures,
    skipped,
  };
}

// ============================================================
// VERIFY CONFIG
// ============================================================
async function verifyEmailConfig() {
  try {
    await transporter.verify();
    console.log(`✅ [EmailService] SMTP verified: ${EMAIL_HOST}:${EMAIL_PORT}`);
    return { success: true, provider: PROVIDER_LABEL };
  } catch (err) {
    console.error(`❌ [EmailService] SMTP verify failed: ${err.message}`);
    return { success: false, error: err.message, provider: PROVIDER_LABEL };
  }
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  sendNotificationEmail,
  sendBulkEmails,
  verifyEmailConfig,
  getNotificationEmailTemplate,
  getPlainTextVersion,
  personalizeHtml,
  htmlToPlainText,
  isGenuineEmail,
  validateEmailFormat,
  checkDomainMX,
};