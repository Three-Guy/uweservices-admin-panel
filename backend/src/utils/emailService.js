// src/utils/emailService.js
const nodemailer = require('nodemailer');
const https = require('https');
const logger = require('./logger');

// ==================== EMAIL CONFIGURATION ====================
const EMAIL_CONFIG = {
  service: process.env.EMAIL_SERVICE || 'gmail',
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
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
    ciphers: 'SSLv3',
  },
};

const FROM_EMAIL = {
  name: process.env.EMAIL_FROM_NAME || 'Service Marketplace',
  address: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER,
};

// ==================== BREVO CONFIG ====================
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const USE_BREVO = BREVO_API_KEY.length > 0;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_DAILY_LIMIT = 290; // safe margin (Brevo free = 300/day)

// ==================== RETRY CONFIG ====================
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
const BULK_EMAIL_DELAY_MS = 600;

// ==================== DAILY COUNTER (Brevo 300/day) ====================
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

// ==================== BREVO HTTP CLIENT ====================
// Uses Node built-in https (port 443) — works on Render free tier
// No external dependencies needed (no axios, no node-fetch)

const sendViaBrevo = (mailOptions) => {
  return new Promise((resolve, reject) => {
    const payload = {
      sender: {
        name: FROM_EMAIL.name,
        email: FROM_EMAIL.address,
      },
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
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              messageId: parsed.messageId || `brevo-${Date.now()}`,
              response: 'OK',
            });
          } else {
            const errMsg =
              parsed.message || parsed.code || `HTTP ${res.statusCode}`;
            reject(new Error(`Brevo API error: ${errMsg}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ messageId: `brevo-${Date.now()}`, response: 'OK' });
          } else {
            reject(
              new Error(`Brevo API ${res.statusCode}: ${responseData}`)
            );
          }
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Brevo network error: ${err.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Brevo API timeout (30s)'));
    });

    req.write(data);
    req.end();
  });
};

// ==================== CREATE TRANSPORTER (SMTP FALLBACK) ====================
let transporter = null;
let transporterHealthy = false;

const createTransporter = () => {
  if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
    console.warn(
      '⚠️ Email credentials not configured. SMTP fallback disabled.'
    );
    transporterHealthy = false;
    return null;
  }

  try {
    if (transporter) {
      try {
        transporter.close();
      } catch (e) {
        // ignore
      }
    }

    transporter = nodemailer.createTransport(EMAIL_CONFIG);

    transporter.on('idle', () => {
      transporterHealthy = true;
    });

    console.log(
      '✅ SMTP transporter created (fallback for local dev)'
    );
    transporterHealthy = true;
    return transporter;
  } catch (error) {
    console.error(
      '❌ Failed to create SMTP transporter:',
      error.message
    );
    logger.error('SMTP transporter creation failed:', error);
    transporterHealthy = false;
    return null;
  }
};

const ensureTransporter = async () => {
  if (!transporter) {
    return createTransporter();
  }
  try {
    await transporter.verify();
    transporterHealthy = true;
    return transporter;
  } catch (err) {
    console.warn(
      '⚠️ SMTP transporter unhealthy, recreating...',
      err.message
    );
    return createTransporter();
  }
};

// Initialize
if (USE_BREVO) {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  📧 EMAIL MODE: Brevo HTTP API (port 443)       ║');
  console.log('║  ✅ Works on Render / Railway / Vercel           ║');
  console.log('║  📊 Daily limit: 300 emails (free tier)          ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  // Also create SMTP transporter as backup
  createTransporter();
} else {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  📧 EMAIL MODE: Gmail SMTP (port 587)            ║');
  console.log('║  ⚠️  Will NOT work on Render free tier!          ║');
  console.log('║  💡 Set BREVO_API_KEY env var to fix             ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  createTransporter();
}

// ==================== HELPERS ====================

/**
 * Simple personalization: replace {{name}} tokens in HTML with recipient name
 */
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

/**
 * Strip HTML tags → plain text fallback
 */
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

/**
 * Sleep helper
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Subject sanitizer — replaces template names with actual title
 */
const TEMPLATE_NAMES = [
  'welcome',
  'promo',
  'announcement',
  'alert',
  'newsletter',
  'invoice',
  'custom',
];

const sanitizeSubject = (subject, title) => {
  if (!subject) return title || '(No Subject)';
  const lower = subject.trim().toLowerCase();
  if (TEMPLATE_NAMES.includes(lower)) {
    return title || subject;
  }
  return subject;
};

// ==================== SMTP RETRY (for local dev fallback) ====================

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
        nextRetryIn: `${delay}ms`,
      });
      await ensureTransporter();
      await sleep(delay);
      return sendViaSmtpWithRetry(mailOptions, attempt + 1);
    }
    throw error;
  }
};

// ==================== EMAIL TEMPLATES ====================

/**
 * Professional Notification Email Template (DEFAULT FALLBACK)
 * Used when no custom emailHtml is provided from frontend
 */
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
    process.env.EMAIL_SUPPORT_EMAIL || 'support@example.com';
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
  
  <!-- Email Container -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F3F4F6; padding: 40px 0;">
    <tr>
      <td align="center">
        
        <!-- Main Content Table -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden; max-width: 600px;">
          
          <!-- Header with Priority Band -->
          <tr>
            <td style="background: linear-gradient(135deg, ${priorityColor} 0%, ${priorityColor}DD 100%); padding: 3px 0;">
            </td>
          </tr>
          
          <!-- Logo Section -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px 40px;">
              <img src="${logoUrl}" alt="${companyName}" style="height: 50px; max-width: 200px; display: block;" />
            </td>
          </tr>
          
          <!-- Image Section (if provided) -->
          ${
            imageUrl
              ? `
          <tr>
            <td align="center" style="padding: 0 40px 24px 40px;">
              <img src="${imageUrl}" alt="Notification Image" style="max-width: 100%; height: auto; border-radius: 8px; display: block;" />
            </td>
          </tr>
          `
              : ''
          }
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 0 40px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.5; color: #374151;">
                Hello <strong>${recipientName}</strong>,
              </p>
            </td>
          </tr>
          
          <!-- Title -->
          <tr>
            <td style="padding: 0 40px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3;">
                ${title}
              </h1>
            </td>
          </tr>
          
          <!-- Body Content -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #4B5563; white-space: pre-wrap;">
                ${body}
              </p>
            </td>
          </tr>
          
          <!-- Action Button (if actionUrl provided) -->
          ${
            actionUrl
              ? `
          <tr>
            <td align="center" style="padding: 0 40px 40px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, ${priorityColor} 0%, ${priorityColor}DD 100%); padding: 0;">
                    <a href="${actionUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 8px;">
                      ${actionText}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `
              : ''
          }
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #E5E7EB;"></div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background-color: #F9FAFB;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #6B7280; line-height: 1.5;">
                      Need help? Contact us at 
                      <a href="mailto:${supportEmail}" style="color: ${priorityColor}; text-decoration: none; font-weight: 500;">
                        ${supportEmail}
                      </a>
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #6B7280; line-height: 1.5;">
                      Visit our website: 
                      <a href="${websiteUrl}" target="_blank" style="color: ${priorityColor}; text-decoration: none; font-weight: 500;">
                        ${companyName}
                      </a>
                    </p>
                  </td>
                </tr>
                
                <!-- Social Links (Optional) -->
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
                
                <!-- Copyright -->
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
</html>
  `;
};

/**
 * Plain text version for email clients that don't support HTML
 */
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
    process.env.EMAIL_SUPPORT_EMAIL || 'support@example.com';

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

// ==================== SEND EMAIL FUNCTION ====================

/**
 * Send email notification
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject (optional, falls back to title)
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {string} options.recipientName - Recipient's name
 * @param {string} options.actionUrl - Optional action URL
 * @param {string} options.actionText - Optional action button text
 * @param {string} options.imageUrl - Optional image URL
 * @param {string} options.priority - Email priority (urgent, high, normal, low)
 * @param {string} options.customHtml - Optional pre-built HTML (from frontend builder)
 * @returns {Promise<Object>} - Email send result
 */
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
  console.log(
    '   Provider:',
    USE_BREVO ? '🟢 Brevo HTTP API' : '🔵 Gmail SMTP'
  );

  // ===== CHECK DAILY LIMIT (Brevo) =====
  if (USE_BREVO && !checkDailyLimit()) {
    console.warn(
      '⚠️ Brevo daily limit reached (300/day). Email skipped.'
    );
    logger.warn('Brevo daily limit reached', { to, subject: finalSubject });
    return {
      success: false,
      message: 'Daily email limit reached (300/day)',
      skipped: true,
    };
  }

  // ===== CHECK TRANSPORTER (SMTP fallback) =====
  if (!USE_BREVO && !transporter) {
    console.warn(
      '⚠️ No email provider available. Set BREVO_API_KEY or SMTP credentials.'
    );
    logger.warn('Email send skipped - no provider configured', {
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
    // Prepare template data
    const templateData = {
      title,
      body,
      recipientName,
      actionUrl,
      actionText,
      imageUrl,
      priority,
    };

    // ===== DECIDE HTML SOURCE =====
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

    // Plain text version
    const text = customHtml
      ? htmlToPlainText(personalizeHtml(customHtml, recipientName))
      : getPlainTextVersion(templateData);

    // Build mail options object (used by both Brevo and SMTP)
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
          priority === 'urgent'
            ? '1'
            : priority === 'high'
              ? '2'
              : '3',
        'List-Unsubscribe': `<mailto:${process.env.EMAIL_SUPPORT_EMAIL || 'support@uweservices.com'}?subject=unsubscribe>`,
        Precedence: 'bulk',
      },
    };

    // ===== SEND VIA BREVO OR SMTP =====
    let info;

    if (USE_BREVO) {
      // ---- BREVO HTTP API (port 443 — works on Render!) ----
      info = await sendViaBrevo(mailOptions);
      incrementDailyCount();
      console.log(
        `   📊 Brevo daily usage: ${dailyEmailCount}/${BREVO_DAILY_LIMIT}`
      );
    } else {
      // ---- SMTP FALLBACK (local dev only) ----
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
      provider: USE_BREVO ? 'brevo' : 'smtp',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
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
      provider: USE_BREVO ? 'brevo' : 'smtp',
      stack: error.stack,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    });

    return {
      success: false,
      message: error.message,
      error: error.message,
    };
  }
};

/**
 * Send bulk emails
 * @param {Array} recipients - Array of recipient objects
 * @returns {Promise<Object>} - Bulk send results
 */
const sendBulkEmails = async (recipients) => {
  console.log(
    `\n📧 ===== SENDING BULK EMAILS (${recipients.length}) =====`
  );
  console.log(
    `   Provider: ${USE_BREVO ? '🟢 Brevo HTTP API' : '🔵 Gmail SMTP'}`
  );

  if (USE_BREVO) {
    const remaining = BREVO_DAILY_LIMIT - dailyEmailCount;
    console.log(
      `   📊 Brevo daily remaining: ${remaining}/${BREVO_DAILY_LIMIT}`
    );
    if (recipients.length > remaining) {
      console.warn(
        `   ⚠️ Requested ${recipients.length} but only ${remaining} remaining today!`
      );
      console.warn(
        `   ⚠️ Will send ${remaining} and skip the rest.`
      );
    }
  }

  if (!USE_BREVO && !transporter) {
    console.warn(
      '⚠️ No email provider available. Skipping bulk send.'
    );
    return {
      success: false,
      message: 'Email service not configured',
      totalSent: 0,
      totalFailed: recipients.length,
    };
  }

  const results = {
    success: true,
    totalSent: 0,
    totalFailed: 0,
    failures: [],
  };

  const totalBatches = Math.ceil(recipients.length / 50);

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const batchNum = Math.floor(i / 50) + 1;

    // Check daily limit mid-bulk
    if (USE_BREVO && !checkDailyLimit()) {
      console.warn(
        `\n⚠️ Brevo daily limit hit at email ${i + 1}/${recipients.length}. Stopping.`
      );
      const skipped = recipients.length - i;
      results.totalFailed += skipped;
      results.failures.push({
        email: `${skipped} remaining`,
        error: 'Daily limit reached (300/day)',
      });
      break;
    }

    if (i % 50 === 0) {
      console.log(`\n📧 Sending batch ${batchNum}/${totalBatches}`);
    }

    try {
      const result = await sendNotificationEmail(recipient);

      if (result.success) {
        results.totalSent++;
      } else {
        results.totalFailed++;
        results.failures.push({
          email: recipient.to,
          error: result.message,
        });
      }

      // Rate limiting delay
      if (i < recipients.length - 1) {
        await sleep(BULK_EMAIL_DELAY_MS);
      }

      // Pause every 50 emails
      if ((i + 1) % 50 === 0 && i < recipients.length - 1) {
        console.log(
          `   ⏸️ Pausing 5s after batch ${batchNum}...`
        );
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

  console.log(
    `\n✅ Bulk email complete: ${results.totalSent} sent, ${results.totalFailed} failed`
  );

  if (results.failures.length > 0) {
    console.log(`⚠️ Failed emails:`);
    results.failures.forEach((f) => {
      console.log(`   ❌ ${f.email}: ${f.error}`);
    });
  }

  return results;
};

/**
 * Verify email configuration
 */
const verifyEmailConfig = async () => {
  if (USE_BREVO) {
    // Test Brevo API key with a lightweight call
    try {
      const result = await new Promise((resolve, reject) => {
        const reqOptions = {
          hostname: 'api.brevo.com',
          port: 443,
          path: '/v3/account',
          method: 'GET',
          headers: {
            'api-key': BREVO_API_KEY,
            Accept: 'application/json',
          },
        };
        const req = https.request(reqOptions, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`Brevo API ${res.statusCode}`));
            }
          });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Brevo verify timeout'));
        });
        req.end();
      });

      console.log('✅ Brevo API key verified');
      console.log(
        `   Account: ${result.email || 'verified'}`
      );
      return {
        success: true,
        message: 'Brevo API configuration is valid',
        provider: 'brevo',
      };
    } catch (error) {
      console.error(
        '❌ Brevo API key invalid:',
        error.message
      );
      return {
        success: false,
        message: error.message,
        provider: 'brevo',
      };
    }
  }

  // SMTP fallback verify
  if (!transporter) {
    return {
      success: false,
      message: 'Email transporter not configured',
    };
  }

  try {
    await transporter.verify();
    console.log('✅ SMTP configuration verified');
    transporterHealthy = true;
    return {
      success: true,
      message: 'SMTP configuration is valid',
      provider: 'smtp',
    };
  } catch (error) {
    console.error(
      '❌ SMTP configuration invalid:',
      error.message
    );
    transporterHealthy = false;
    return {
      success: false,
      message: error.message,
      provider: 'smtp',
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
};