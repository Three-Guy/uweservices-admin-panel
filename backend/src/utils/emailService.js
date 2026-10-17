// src/utils/emailService.js
const nodemailer = require('nodemailer');
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
};

const FROM_EMAIL = {
  name: process.env.EMAIL_FROM_NAME || 'Service Marketplace',
  address: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER,
};

// ==================== CREATE TRANSPORTER ====================
let transporter = null;

const createTransporter = () => {
  if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
    console.warn('⚠️ Email credentials not configured. Email functionality disabled.');
    return null;
  }

  try {
    transporter = nodemailer.createTransport(EMAIL_CONFIG);
    console.log('✅ Email transporter created successfully');
    return transporter;
  } catch (error) {
    console.error('❌ Failed to create email transporter:', error.message);
    logger.error('Email transporter creation failed:', error);
    return null;
  }
};

// Initialize transporter
createTransporter();

// ==================== EMAIL TEMPLATES ====================

/**
 * Professional Notification Email Template
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

  const logoUrl = process.env.EMAIL_LOGO_URL || 'https://via.placeholder.com/150x50?text=Logo';
  const companyName = process.env.EMAIL_COMPANY_NAME || 'Service Marketplace';
  const websiteUrl = process.env.EMAIL_WEBSITE_URL || '#';
  const supportEmail = process.env.EMAIL_SUPPORT_EMAIL || 'support@example.com';
  const currentYear = new Date().getFullYear();

  // Priority colors
  const priorityColors = {
    urgent: '#DC2626',
    high: '#EA580C',
    normal: '#4F46E5',
    low: '#6B7280',
  };

  const priorityColor = priorityColors[priority] || priorityColors.normal;

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
          ${imageUrl ? `
          <tr>
            <td align="center" style="padding: 0 40px 24px 40px;">
              <img src="${imageUrl}" alt="Notification Image" style="max-width: 100%; height: auto; border-radius: 8px; display: block;" />
            </td>
          </tr>
          ` : ''}
          
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
          ${actionUrl ? `
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
          ` : ''}
          
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
  const { title, body, recipientName = 'Valued User', actionUrl, actionText = 'View Details' } = data;
  const companyName = process.env.EMAIL_COMPANY_NAME || 'Service Marketplace';
  const supportEmail = process.env.EMAIL_SUPPORT_EMAIL || 'support@example.com';

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
 * @param {string} options.subject - Email subject
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {string} options.recipientName - Recipient's name
 * @param {string} options.actionUrl - Optional action URL
 * @param {string} options.actionText - Optional action button text
 * @param {string} options.imageUrl - Optional image URL
 * @param {string} options.priority - Email priority (urgent, high, normal, low)
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
  } = options;

  console.log('\n📧 ===== SENDING EMAIL =====');
  console.log('   To:', to);
  console.log('   Subject:', subject);
  console.log('   Priority:', priority);

  // Check if transporter is available
  if (!transporter) {
    console.warn('⚠️ Email transporter not available. Skipping email send.');
    logger.warn('Email send skipped - transporter not configured', { to, subject });
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

    // Generate HTML and plain text
    const html = getNotificationEmailTemplate(templateData);
    const text = getPlainTextVersion(templateData);

    // Email options
    const mailOptions = {
      from: `${FROM_EMAIL.name} <${FROM_EMAIL.address}>`,
      to,
      subject,
      text,
      html,
      priority: priority === 'urgent' ? 'high' : 'normal',
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email sent successfully');
    console.log('   Message ID:', info.messageId);

    logger.info('Email sent successfully', {
      to,
      subject,
      messageId: info.messageId,
      priority,
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
      subject,
      stack: error.stack,
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
  console.log(`\n📧 ===== SENDING BULK EMAILS (${recipients.length}) =====`);

  if (!transporter) {
    console.warn('⚠️ Email transporter not available. Skipping bulk email send.');
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

  for (const recipient of recipients) {
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

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      results.totalFailed++;
      results.failures.push({
        email: recipient.to,
        error: error.message,
      });
    }
  }

  console.log(`✅ Bulk email complete: ${results.totalSent} sent, ${results.totalFailed} failed`);

  return results;
};

/**
 * Verify email configuration
 */
const verifyEmailConfig = async () => {
  if (!transporter) {
    return {
      success: false,
      message: 'Email transporter not configured',
    };
  }

  try {
    await transporter.verify();
    console.log('✅ Email configuration verified');
    return {
      success: true,
      message: 'Email configuration is valid',
    };
  } catch (error) {
    console.error('❌ Email configuration invalid:', error.message);
    return {
      success: false,
      message: error.message,
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
};