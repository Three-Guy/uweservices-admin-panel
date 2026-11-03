// src/utils/emailService.js
const nodemailer = require('nodemailer');
const https = require('https');
const dns = require('dns').promises;
const logger = require('./logger');

// ==================== EMAIL CONFIGURATION ====================
// CRITICAL: When EMAIL_HOST is Brevo (or any non-Gmail host), we MUST NOT
// use the "service" field, because nodemailer overrides host/port with
// the service's defaults when "service" is set.

const RAW_HOST = (process.env.EMAIL_HOST || '').trim().toLowerCase();
const IS_BREVO = RAW_HOST.includes('brevo') || RAW_HOST.includes('sendinblue');
const IS_GMAIL = RAW_HOST.includes('gmail') || !RAW_HOST;
const USE_EXPLICIT_HOST = RAW_HOST.length > 0 && !IS_GMAIL;

const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587');
const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true';

// Build config — never use "service" when explicit host is set
const EMAIL_CONFIG = USE_EXPLICIT_HOST
  ? {
      // Brevo / custom SMTP relay
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_SECURE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 60000,
      tls: {
        rejectUnauthorized: false,
      },
    }
  : {
      // Gmail or fallback — use service hint
      service: process.env.EMAIL_SERVICE || 'gmail',
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_SECURE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 60000,
      tls: {
        rejectUnauthorized: false,
      },
    };

const FROM_EMAIL = {
  name: process.env.EMAIL_FROM_NAME || 'UWE Services',
  address:
    process.env.EMAIL_FROM_ADDRESS ||
    process.env.EMAIL_USER ||
    'support@uweservices.com',
};

// ==================== BREVO HTTP API CONFIG (optional backup) ====================
const BREVO_API_KEY = (process.env.BREVO_API_KEY || '').trim();
const USE_BREVO_HTTP = BREVO_API_KEY.length > 0;
const BREVO_DAILY_LIMIT = 290;

// ==================== PROVIDER LABEL (shown everywhere) ====================
const PROVIDER_LABEL = USE_BREVO_HTTP
  ? '🟢 Brevo HTTP API'
  : IS_BREVO
    ? '🟢 Brevo SMTP Relay'
    : IS_GMAIL
      ? '🔵 Gmail SMTP'
      : `⚙️  Custom SMTP (${EMAIL_HOST})`;

// ==================== STARTUP BANNER ====================
// Print IMMEDIATELY on module load
(() => {
  const line1 = `📧 EMAIL PROVIDER: ${PROVIDER_LABEL}`;
  const line2 = `📤 From: ${FROM_EMAIL.address}`;
  const line3 = `🏠 Host: ${EMAIL_HOST}:${EMAIL_PORT}`;
  const line4 = `👤 User: ${process.env.EMAIL_USER || '(not set)'}`;
  const line5 = `🛡️  Fake email filter: ENABLED`;

  const pad = (s, len = 60) => s + ' '.repeat(Math.max(0, len - s.length));
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  ${pad(line1)}║`);
  console.log(`║  ${pad(line2)}║`);
  console.log(`║  ${pad(line3)}║`);
  console.log(`║  ${pad(line4)}║`);
  console.log(`║  ${pad(line5)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
})();

// ==================== RETRY CONFIG ====================
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
const BULK_EMAIL_DELAY_MS = 600;

// ==================== DAILY COUNTER ====================
let dailyEmailCount = 0;
let dailyResetDate = new Date().toDateString();

const checkDailyLimit = () => {
  const today = new Date().toDateString();
  if (today !== dailyResetDate) {
    dailyEmailCount = 0;
    dailyResetDate = today;
  }
  return dailyEmailCount < BREVO_DAILY_LIMIT;
};

const incrementDailyCount = () => {
  dailyEmailCount++;
};

// ==================== EMAIL VALIDATION (SKIP FAKE EMAILS) ====================

const FAKE_EMAIL_PATTERNS = [
  /^test\d*@/i,
  /^fake\d*@/i,
  /^demo\d*@/i,
  /^sample\d*@/i,
  /^example\d*@/i,
  /^dummy\d*@/i,
  /^abc\d*@/i,
  /^xyz\d*@/i,
  /^asdf+@/i,
  /^qwerty+@/i,
  /^user\d+@/i,
  /^temp\d*@/i,
  /^tmp\d*@/i,
  /^noreply@/i,
  /^no-reply@/i,
  /^donotreply@/i,
  /^(sam|naman|bhavuk|vickey|ved|heh|pranav|vijsag|maurya|rubi)\d*@gmail\.com$/i,
  /^(vaibhav|veduu|bhavuk\d+|bahvuk|kushal|anshul\d+)@gmail\.com$/i,
  /^(mayank|vrinda|mangala|great|muskan|nihanshu|komal)\d*@gmail\.com$/i,
  /^[a-z]{1,3}@/i,
  /^(.)\1{4,}@/i,
  /^[0-9]+@/i,
];

const FAKE_DOMAINS = new Set([
  'test.com', 'example.com', 'example.org', 'example.net',
  'fake.com', 'tempmail.com', 'temp-mail.org', 'mailinator.com',
  'guerrillamail.com', '10minutemail.com', 'throwaway.email',
  'yopmail.com', 'trashmail.com', 'dispostable.com', 'maildrop.cc',
  'getnada.com', 'cloudtestlabaccounts.com', 'localhost', 'local',
  'invalid', 'none.com', 'nothing.com', 'abc.com', 'xyz.com', '123.com',
]);

const mxCache = new Map();
const MX_CACHE_TTL = 60 * 60 * 1000;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const validateEmailFormat = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Empty email' };
  }
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length < 5 || trimmed.length > 254) {
    return { valid: false, reason: 'Invalid length' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, reason: 'Invalid format' };
  }
  const [localPart, domain] = trimmed.split('@');
  if (localPart.length < 2) {
    return { valid: false, reason: 'Local part too short' };
  }
  if (FAKE_DOMAINS.has(domain)) {
    return { valid: false, reason: `Fake domain: ${domain}` };
  }
  for (const pattern of FAKE_EMAIL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: 'Matches fake pattern' };
    }
  }
  return { valid: true, reason: 'Format OK' };
};

const checkDomainMX = async (email) => {
  const domain = email.split('@')[1].toLowerCase();
  const cached = mxCache.get(domain);
  if (cached && Date.now() - cached.timestamp < MX_CACHE_TTL) {
    return cached.result;
  }
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      const result = { valid: false, reason: `No MX for ${domain}` };
      mxCache.set(domain, { result, timestamp: Date.now() });
      return result;
    }
    const result = { valid: true, reason: `${mxRecords.length} MX records` };
    mxCache.set(domain, { result, timestamp: Date.now() });
    return result;
  } catch (err) {
    const result = {
      valid: false,
      reason: `MX lookup failed: ${err.code || err.message}`,
    };
    mxCache.set(domain, { result, timestamp: Date.now() });
    return result;
  }
};

const isGenuineEmail = async (email) => {
  const formatCheck = validateEmailFormat(email);
  if (!formatCheck.valid) {
    return { valid: false, reason: formatCheck.reason, skipped: true };
  }
  const mxCheck = await checkDomainMX(email);
  if (!mxCheck.valid) {
    return { valid: false, reason: mxCheck.reason, skipped: true };
  }
  return { valid: true, reason: 'Genuine', skipped: false };
};

// ==================== BREVO HTTP CLIENT (backup only) ====================

const sendViaBrevoHttp = (mailOptions) => {
  return new Promise((resolve, reject) => {
    const payload = {
      sender: { name: FROM_EMAIL.name, email: FROM_EMAIL.address },
      to: [
        {
          email: mailOptions.to,
          name: mailOptions.recipientName || mailOptions.to.split('@')[0],
        },
      ],
      subject: mailOptions.subject,
      htmlContent: mailOptions.html,
      textContent: mailOptions.text,
      headers: {
        'X-Mailer': 'UWE-Services-Admin',
        'X-Priority': mailOptions.priority === 'high' ? '1' : '3',
        'List-Unsubscribe': `<mailto:${process.env.EMAIL_SUPPORT_EMAIL || 'support@uweservices.com'}?subject=unsubscribe>`,
        ...(mailOptions.headers || {}),
      },
    };
    const data = JSON.stringify(payload);
    const reqOptions = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(reqOptions, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              messageId: parsed.messageId || `brevo-${Date.now()}`,
              response: 'OK',
            });
          } else {
            reject(new Error(`Brevo API: ${parsed.message || parsed.code || res.statusCode}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ messageId: `brevo-${Date.now()}`, response: 'OK' });
          } else {
            reject(new Error(`Brevo API ${res.statusCode}: ${responseData}`));
          }
        }
      });
    });
    req.on('error', (err) => reject(new Error(`Brevo network: ${err.message}`)));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Brevo API timeout'));
    });
    req.write(data);
    req.end();
  });
};

// ==================== CREATE TRANSPORTER ====================
let transporter = null;
let transporterHealthy = false;

const createTransporter = () => {
  if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
    console.warn('⚠️ Email credentials not set. Email disabled.');
    transporterHealthy = false;
    return null;
  }
  try {
    if (transporter) {
      try { transporter.close(); } catch (e) { /* ignore */ }
    }
    transporter = nodemailer.createTransport(EMAIL_CONFIG);
    transporter.on('idle', () => { transporterHealthy = true; });
    console.log(`✅ SMTP transporter created — ${PROVIDER_LABEL}`);
    transporterHealthy = true;
    return transporter;
  } catch (error) {
    console.error('❌ Transporter creation failed:', error.message);
    logger.error('SMTP transporter creation failed:', error);
    transporterHealthy = false;
    return null;
  }
};

const ensureTransporter = async () => {
  if (!transporter) return createTransporter();
  try {
    await transporter.verify();
    transporterHealthy = true;
    return transporter;
  } catch (err) {
    console.warn('⚠️ Transporter unhealthy, recreating...', err.message);
    return createTransporter();
  }
};

// Initialize transporter on module load
createTransporter();

// ==================== HELPERS ====================

const personalizeHtml = (html, recipientName) => {
  if (!html) return html;
  const safeName = String(recipientName || 'Valued User')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return html
    .replace(/\{\{\s*name\s*\}\}/gi, safeName)
    .replace(/\{\{\s*recipient_name\s*\}\}/gi, safeName)
    .replace(/\{\{\s*recipientName\s*\}\}/gi, safeName);
};

const htmlToPlainText = (html) => {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const TEMPLATE_NAMES = [
  'welcome', 'promo', 'announcement', 'alert',
  'newsletter', 'invoice', 'custom',
];

const sanitizeSubject = (subject, title) => {
  if (!subject) return title || '(No Subject)';
  const lower = subject.trim().toLowerCase();
  if (TEMPLATE_NAMES.includes(lower)) return title || subject;
  return subject;
};

// ==================== SMTP RETRY ====================

const sendViaSmtpWithRetry = async (mailOptions, attempt = 1) => {
  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    const isRetryable =
      error.message.includes('timeout') ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('socket hang up') ||
      error.message.includes('Connection closed') ||
      error.message.includes('Greeting never received') ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ESOCKET';

    if (isRetryable && attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `⚠️ SMTP to ${mailOptions.to} failed (attempt ${attempt}/${MAX_RETRIES}): ${error.message}. Retrying in ${delay / 1000}s...`
      );
      logger.warn('SMTP retry', {
        to: mailOptions.to,
        attempt,
        error: error.message,
      });
      await ensureTransporter();
      await sleep(delay);
      return sendViaSmtpWithRetry(mailOptions, attempt + 1);
    }
    throw error;
  }
};

// ==================== EMAIL TEMPLATES ====================

const getNotificationEmailTemplate = (data) => {
  const {
    title,
    body,
    recipientName = 'Valued User',
    actionUrl,
    actionText = 'View Details',
    imageUrl,
    priority = 'normal',
  } = data;

  const logoUrl =
    process.env.EMAIL_LOGO_URL ||
    'https://via.placeholder.com/150x50?text=Logo';
  const companyName =
    process.env.EMAIL_COMPANY_NAME || 'Service Marketplace';
  const websiteUrl = process.env.EMAIL_WEBSITE_URL || '#';
  const supportEmail =
    process.env.EMAIL_SUPPORT_EMAIL || 'support@uweservices.com';
  const currentYear = new Date().getFullYear();

  const priorityColors = {
    urgent: '#DC2626',
    high: '#EA580C',
    normal: '#4F46E5',
    low: '#6B7280',
  };
  const priorityColor =
    priorityColors[priority] || priorityColors.normal;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F3F4F6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden; max-width: 600px;">
          <tr>
            <td style="background: linear-gradient(135deg, ${priorityColor} 0%, ${priorityColor}DD 100%); padding: 3px 0;"></td>
          </tr>
          <tr>
            <td align="center" style="padding: 32px 40px 24px 40px;">
              <img src="${logoUrl}" alt="${companyName}" style="height: 50px; max-width: 200px; display: block;" />
            </td>
          </tr>
          ${imageUrl ? `
          <tr>
            <td align="center" style="padding: 0 40px 24px 40px;">
              <img src="${imageUrl}" alt="Notification Image" style="max-width: 100%; height: auto; border-radius: 8px; display: block;" />
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 0 40px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.5; color: #374151;">
                Hello <strong>${recipientName}</strong>,
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #4B5563; white-space: pre-wrap;">${body}</p>
            </td>
          </tr>
          ${actionUrl ? `
          <tr>
            <td align="center" style="padding: 0 40px 40px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, ${priorityColor} 0%, ${priorityColor}DD 100%); padding: 0;">
                    <a href="${actionUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 8px;">${actionText}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #E5E7EB;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px; background-color: #F9FAFB;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #6B7280; line-height: 1.5;">
                      Need help? Contact us at 
                      <a href="mailto:${supportEmail}" style="color: ${priorityColor}; text-decoration: none; font-weight: 500;">${supportEmail}</a>
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #6B7280; line-height: 1.5;">
                      Visit our website: 
                      <a href="${websiteUrl}" target="_blank" style="color: ${priorityColor}; text-decoration: none; font-weight: 500;">${companyName}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 16px 0 0 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 0 8px;">
                          <a href="${websiteUrl}" target="_blank" style="color: #6B7280; text-decoration: none;">
                            <img src="https://img.icons8.com/ios-filled/24/6B7280/facebook-new.png" alt="Facebook" style="width: 24px; height: 24px; display: block;" />
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="${websiteUrl}" target="_blank" style="color: #6B7280; text-decoration: none;">
                            <img src="https://img.icons8.com/ios-filled/24/6B7280/twitter.png" alt="Twitter" style="width: 24px; height: 24px; display: block;" />
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="${websiteUrl}" target="_blank" style="color: #6B7280; text-decoration: none;">
                            <img src="https://img.icons8.com/ios-filled/24/6B7280/instagram-new.png" alt="Instagram" style="width: 24px; height: 24px; display: block;" />
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 24px 0 0 0;">
                    <p style="margin: 0; font-size: 12px; color: #9CA3AF; line-height: 1.5;">
                      © ${currentYear} ${companyName}. All rights reserved.
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #9CA3AF; line-height: 1.5;">
                      This email was sent to you as a notification. If you believe this was sent in error, please contact us.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const getPlainTextVersion = (data) => {
  const {
    title,
    body,
    recipientName = 'Valued User',
    actionUrl,
    actionText = 'View Details',
  } = data;
  const companyName =
    process.env.EMAIL_COMPANY_NAME || 'Service Marketplace';
  const supportEmail =
    process.env.EMAIL_SUPPORT_EMAIL || 'support@uweservices.com';

  return `
Hello ${recipientName},

${title}

${body}

${actionUrl ? `${actionText}: ${actionUrl}\n` : ''}

---

Need help? Contact us at ${supportEmail}

© ${new Date().getFullYear()} ${companyName}. All rights reserved.
  `.trim();
};

// ==================== SEND EMAIL ====================

const sendNotificationEmail = async (options) => {
  const {
    to,
    subject,
    title,
    body,
    recipientName,
    actionUrl,
    actionText,
    imageUrl,
    priority = 'normal',
    customHtml,
    skipValidation = false,
  } = options;

  const finalSubject = sanitizeSubject(subject, title);

  console.log('\n📧 ===== SENDING EMAIL =====');
  console.log('   To:', to);
  console.log('   Subject:', finalSubject);
  console.log('   Priority:', priority);
  console.log(
    '   Mode:',
    customHtml ? '🎨 Custom HTML (from builder)' : '📋 Default Template'
  );
  console.log('   Provider:', PROVIDER_LABEL);

  // ===== VALIDATE EMAIL =====
  if (!skipValidation) {
    const validation = await isGenuineEmail(to);
    if (!validation.valid) {
      console.log(`   ⏭️  SKIPPED (fake/invalid): ${validation.reason}`);
      logger.info('Email skipped - fake/invalid', {
        to,
        reason: validation.reason,
      });
      return {
        success: false,
        message: `Skipped: ${validation.reason}`,
        skipped: true,
        fake: true,
      };
    }
    console.log(`   ✅ Validated: ${validation.reason}`);
  }

  // ===== CHECK DAILY LIMIT =====
  if (USE_BREVO_HTTP && !checkDailyLimit()) {
    console.warn('⚠️ Brevo daily limit reached (300/day).');
    logger.warn('Brevo daily limit reached', {
      to,
      subject: finalSubject,
    });
    return {
      success: false,
      message: 'Daily email limit reached (300/day)',
      skipped: true,
    };
  }

  // ===== CHECK TRANSPORTER =====
  if (!USE_BREVO_HTTP && !transporter) {
    console.warn('⚠️ No email provider available.');
    logger.warn('Email send skipped - no provider', {
      to,
      subject: finalSubject,
    });
    return {
      success: false,
      message: 'Email service not configured',
      skipped: true,
    };
  }

  try {
    const templateData = {
      title,
      body,
      recipientName,
      actionUrl,
      actionText,
      imageUrl,
      priority,
    };

    let html;
    if (
      customHtml &&
      typeof customHtml === 'string' &&
      customHtml.trim().length > 0
    ) {
      html = personalizeHtml(customHtml, recipientName);
      console.log('   ✨ Using custom HTML from builder');
    } else {
      html = getNotificationEmailTemplate(templateData);
      console.log('   📋 Using default template');
    }

    const text = customHtml
      ? htmlToPlainText(personalizeHtml(customHtml, recipientName))
      : getPlainTextVersion(templateData);

    const mailOptions = {
      from: `${FROM_EMAIL.name} <${FROM_EMAIL.address}>`,
      to,
      subject: finalSubject,
      text,
      html,
      priority: priority === 'urgent' ? 'high' : 'normal',
      recipientName: recipientName || to.split('@')[0],
      headers: {
        'X-Mailer': 'UWE-Services-Admin',
        'X-Priority':
          priority === 'urgent' ? '1' : priority === 'high' ? '2' : '3',
        'List-Unsubscribe': `<mailto:${process.env.EMAIL_SUPPORT_EMAIL || 'support@uweservices.com'}?subject=unsubscribe>`,
        Precedence: 'bulk',
      },
    };

    let info;

    if (USE_BREVO_HTTP) {
      info = await sendViaBrevoHttp(mailOptions);
      incrementDailyCount();
      console.log(
        `   📊 Brevo daily: ${dailyEmailCount}/${BREVO_DAILY_LIMIT}`
      );
    } else {
      info = await sendViaSmtpWithRetry(mailOptions);
    }

    console.log('✅ Email sent successfully');
    console.log('   Message ID:', info.messageId);

    logger.info('Email sent successfully', {
      to,
      subject: finalSubject,
      messageId: info.messageId,
      priority,
      mode: customHtml ? 'custom' : 'template',
      provider: PROVIDER_LABEL,
      timestamp: new Date()
        .toISOString()
        .replace('T', ' ')
        .substring(0, 19),
    });

    return {
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId,
      recipient: to,
    };
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    logger.error('Email send failed:', {
      error: error.message,
      to,
      subject: finalSubject,
      provider: PROVIDER_LABEL,
      stack: error.stack,
      timestamp: new Date()
        .toISOString()
        .replace('T', ' ')
        .substring(0, 19),
    });
    return {
      success: false,
      message: error.message,
      error: error.message,
    };
  }
};

// ==================== BULK EMAIL ====================

const sendBulkEmails = async (recipients) => {
  console.log(
    `\n📧 ===== SENDING BULK EMAILS (${recipients.length}) =====`
  );
  console.log(`   Provider: ${PROVIDER_LABEL}`);

  // ===== PRE-FILTER FAKE EMAILS =====
  console.log(`\n🛡️  Pre-filtering fake/invalid emails...`);
  const genuine = [];
  const skipped = [];

  for (const recipient of recipients) {
    const validation = await isGenuineEmail(recipient.to);
    if (validation.valid) {
      genuine.push(recipient);
    } else {
      skipped.push({ email: recipient.to, reason: validation.reason });
    }
  }

  console.log(`   ✅ Genuine: ${genuine.length}`);
  console.log(`   ⏭️  Fake/invalid skipped: ${skipped.length}`);

  if (skipped.length > 0) {
    console.log(`\n⏭️  Skipped (first 20):`);
    skipped.slice(0, 20).forEach((s) => {
      console.log(`      ⏭️  ${s.email} — ${s.reason}`);
    });
    if (skipped.length > 20) {
      console.log(`      ... and ${skipped.length - 20} more`);
    }
  }

  if (genuine.length === 0) {
    console.warn('⚠️ No genuine emails to send!');
    return {
      success: true,
      totalSent: 0,
      totalFailed: 0,
      totalSkipped: skipped.length,
      failures: [],
      skipped,
    };
  }

  if (USE_BREVO_HTTP) {
    const remaining = BREVO_DAILY_LIMIT - dailyEmailCount;
    console.log(
      `\n   📊 Brevo daily remaining: ${remaining}/${BREVO_DAILY_LIMIT}`
    );
    if (genuine.length > remaining) {
      console.warn(
        `   ⚠️ Requested ${genuine.length} but only ${remaining} remaining!`
      );
    }
  }

  if (!USE_BREVO_HTTP && !transporter) {
    console.warn('⚠️ No email provider available.');
    return {
      success: false,
      message: 'Email service not configured',
      totalSent: 0,
      totalFailed: genuine.length,
      totalSkipped: skipped.length,
    };
  }

  const results = {
    success: true,
    totalSent: 0,
    totalFailed: 0,
    totalSkipped: skipped.length,
    failures: [],
    skipped,
  };

  const totalBatches = Math.ceil(genuine.length / 50);

  console.log(
    `\n📤 Sending ${genuine.length} genuine emails in ${totalBatches} batch(es)...`
  );

  for (let i = 0; i < genuine.length; i++) {
    const recipient = genuine[i];
    const batchNum = Math.floor(i / 50) + 1;

    if (USE_BREVO_HTTP && !checkDailyLimit()) {
      console.warn(
        `\n⚠️ Daily limit hit at ${i + 1}/${genuine.length}. Stopping.`
      );
      const remaining = genuine.length - i;
      results.totalFailed += remaining;
      results.failures.push({
        email: `${remaining} remaining`,
        error: 'Daily limit reached',
      });
      break;
    }

    if (i % 50 === 0) {
      console.log(`\n📧 Batch ${batchNum}/${totalBatches}`);
    }

    try {
      const result = await sendNotificationEmail({
        ...recipient,
        skipValidation: true,
      });
      if (result.success) {
        results.totalSent++;
      } else {
        results.totalFailed++;
        results.failures.push({
          email: recipient.to,
          error: result.message,
        });
      }
      if (i < genuine.length - 1) {
        await sleep(BULK_EMAIL_DELAY_MS);
      }
      if ((i + 1) % 50 === 0 && i < genuine.length - 1) {
        console.log(`   ⏸️ Pausing 5s after batch ${batchNum}...`);
        await sleep(5000);
      }
    } catch (error) {
      results.totalFailed++;
      results.failures.push({
        email: recipient.to,
        error: error.message,
      });
    }
  }

  console.log(`\n✅ Bulk complete:`);
  console.log(`   📤 Sent: ${results.totalSent}`);
  console.log(`   ❌ Failed: ${results.totalFailed}`);
  console.log(`   ⏭️  Skipped (fake): ${results.totalSkipped}`);

  if (results.failures.length > 0) {
    console.log(`\n⚠️ Failed:`);
    results.failures.forEach((f) => {
      console.log(`   ❌ ${f.email}: ${f.error}`);
    });
  }

  return results;
};

// ==================== VERIFY ====================

const verifyEmailConfig = async () => {
  if (USE_BREVO_HTTP) {
    try {
      const result = await new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: 'api.brevo.com',
            port: 443,
            path: '/v3/account',
            method: 'GET',
            headers: {
              'api-key': BREVO_API_KEY,
              Accept: 'application/json',
            },
          },
          (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => {
              if (res.statusCode === 200) {
                resolve(JSON.parse(data));
              } else {
                reject(new Error(`Brevo API ${res.statusCode}`));
              }
            });
          }
        );
        req.on('error', reject);
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Brevo verify timeout'));
        });
        req.end();
      });
      console.log('✅ Brevo API verified');
      console.log(`   Account: ${result.email || 'verified'}`);
      return {
        success: true,
        message: 'Brevo API valid',
        provider: 'brevo-http',
      };
    } catch (error) {
      console.error('❌ Brevo API invalid:', error.message);
      return {
        success: false,
        message: error.message,
        provider: 'brevo-http',
      };
    }
  }

  if (!transporter) {
    return { success: false, message: 'Transporter not configured' };
  }

  try {
    await transporter.verify();
    console.log('✅ SMTP verified');
    transporterHealthy = true;
    return {
      success: true,
      message: 'SMTP valid',
      provider: PROVIDER_LABEL,
    };
  } catch (error) {
    console.error('❌ SMTP invalid:', error.message);
    transporterHealthy = false;
    return {
      success: false,
      message: error.message,
      provider: PROVIDER_LABEL,
    };
  }
};

// ==================== EXPORTS ====================

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