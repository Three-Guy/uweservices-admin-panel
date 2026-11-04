// backend/src/controllers/directPush.controller.js
// 🚀 Direct Push Controller — full feature set with detailed error reporting

const DirectPushLog = require('../models/DirectPushLog');
const {
  sendToSingleToken,
  sendToManyTokens,
  normalizeTokens,
} = require('../services/directPushSender');

const database = require('../config/database');

/**
 * Safely get provider model
 */
function getProviderModelSafe() {
  try {
    if (typeof database.getProviderModel === 'function') {
      return database.getProviderModel();
    }
  } catch (e) {}
  return null;
}

/**
 * Safely get user collection (raw) — users schema may not have fcmToken field
 */
function getUserCollectionSafe() {
  try {
    if (typeof database.getUserConnection === 'function') {
      const conn = database.getUserConnection();
      if (conn && conn.collection) return conn.collection('users');
    }
  } catch (e) {}
  return null;
}

/**
 * Collect FCM tokens from all active providers
 */
async function collectProviderTokens() {
  const Provider = getProviderModelSafe();
  if (!Provider) {
    console.warn('[DirectPush] ⚠️  Provider model unavailable');
    return [];
  }
  try {
    const providers = await Provider.find({
      fcmToken: { $exists: true, $ne: null, $ne: '' },
      isActive: true,
    }).select('fcmToken providerId email name').lean();

    const tokens = providers
      .map(p => (p.fcmToken || '').trim())
      .filter(Boolean);

    console.log(`[DirectPush] 📱 Collected ${tokens.length} provider tokens (from ${providers.length} providers)`);
    return tokens;
  } catch (e) {
    console.error('[DirectPush] ❌ collectProviderTokens error:', e.message);
    return [];
  }
}

/**
 * Collect FCM tokens from all active users (raw collection query)
 */
async function collectUserTokens() {
  const coll = getUserCollectionSafe();
  if (!coll) {
    console.warn('[DirectPush] ⚠️  Users collection unavailable');
    return [];
  }
  try {
    const cursor = coll.find({
      fcmToken: { $exists: true, $ne: null, $ne: '' },
      $or: [{ isActive: { $exists: false } }, { isActive: true }],
    }, { projection: { fcmToken: 1 } });

    const tokens = [];
    await cursor.forEach(doc => {
      const t = (doc.fcmToken || '').toString().trim();
      if (t) tokens.push(t);
    });

    console.log(`[DirectPush] 📱 Collected ${tokens.length} user tokens`);
    return tokens;
  } catch (e) {
    console.error('[DirectPush] ❌ collectUserTokens error:', e.message);
    return [];
  }
}

/**
 * Collect token for a specific provider by _id or providerId
 */
async function collectSpecificProviderTokens(providerIds) {
  const Provider = getProviderModelSafe();
  if (!Provider) return [];
  if (!Array.isArray(providerIds)) providerIds = [providerIds];

  try {
    const mongoose = require('mongoose');
    const objectIds = [];
    const codes = [];
    for (const id of providerIds) {
      if (!id) continue;
      const s = String(id).trim();
      if (mongoose.Types.ObjectId.isValid(s) && s.length === 24) {
        objectIds.push(new mongoose.Types.ObjectId(s));
      } else {
        codes.push(s);
      }
    }

    const or = [];
    if (objectIds.length) or.push({ _id: { $in: objectIds } });
    if (codes.length) or.push({ providerId: { $in: codes } });
    if (or.length === 0) return [];

    const providers = await Provider.find({
      $or: or,
      fcmToken: { $exists: true, $ne: null, $ne: '' },
    }).select('fcmToken providerId').lean();

    return providers.map(p => (p.fcmToken || '').trim()).filter(Boolean);
  } catch (e) {
    console.error('[DirectPush] ❌ collectSpecificProviderTokens error:', e.message);
    return [];
  }
}

// ============================================================
// POST /api/v1/admin/direct-push/send
// ============================================================
exports.sendDirectPush = async (req, res) => {
  const startedAt = Date.now();
  const {
    title,
    body,
    imageUrl,
    clickAction,
    customData,
    targetMode,
    token,
    tokens,
    providerId,
    providerIds,
  } = req.body || {};

  // ---- Validation ----
  if (!title || !String(title).trim()) {
    return res.status(400).json({ success: false, message: 'Title is required' });
  }
  if (!body || !String(body).trim()) {
    return res.status(400).json({ success: false, message: 'Body is required' });
  }
  if (!targetMode) {
    return res.status(400).json({ success: false, message: 'targetMode is required' });
  }

  console.log(`\n[DirectPush] 🚀 NEW SEND REQUEST`);
  console.log(`[DirectPush]   Mode: ${targetMode}`);
  console.log(`[DirectPush]   Title: ${title}`);
  console.log(`[DirectPush]   Body: ${body}`);

  // ---- Collect target tokens ----
  let targetTokens = [];
  try {
    switch (targetMode) {
      case 'single':
        if (!token) {
          return res.status(400).json({ success: false, message: 'token required for single mode' });
        }
        targetTokens = [String(token).trim()];
        break;

      case 'multiple':
        if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
          return res.status(400).json({ success: false, message: 'tokens array required for multiple mode' });
        }
        targetTokens = normalizeTokens(tokens);
        break;

      case 'all_providers':
        targetTokens = await collectProviderTokens();
        break;

      case 'all_users':
        targetTokens = await collectUserTokens();
        break;

      case 'specific_provider':
        if (!providerId) {
          return res.status(400).json({ success: false, message: 'providerId required' });
        }
        targetTokens = await collectSpecificProviderTokens([providerId]);
        break;

      case 'specific_providers':
        if (!providerIds || !Array.isArray(providerIds) || providerIds.length === 0) {
          return res.status(400).json({ success: false, message: 'providerIds array required' });
        }
        targetTokens = await collectSpecificProviderTokens(providerIds);
        break;

      default:
        return res.status(400).json({ success: false, message: `Invalid targetMode: ${targetMode}` });
    }
  } catch (e) {
    console.error('[DirectPush] ❌ Token collection failed:', e);
    return res.status(500).json({
      success: false,
      message: 'Failed to collect target tokens',
      error: e.message,
    });
  }

  targetTokens = normalizeTokens(targetTokens);
  console.log(`[DirectPush] 🎯 Final target count: ${targetTokens.length}`);

  if (targetTokens.length === 0) {
    const durationMs = Date.now() - startedAt;
    // Still log it
    try {
      await DirectPushLog.create({
        title, body, imageUrl: imageUrl || null, clickAction: clickAction || null,
        customData: customData || {},
        targetMode, targetCount: 0, successCount: 0, failureCount: 0, invalidTokenCount: 0,
        failures: [], successes: [],
        status: 'failed',
        sentBy: {
          adminId: req.admin?.adminId,
          email: req.admin?.email,
          name: req.admin?.name,
        },
        startedAt: new Date(startedAt),
        completedAt: new Date(),
        durationMs,
        errorMessage: 'No valid FCM tokens found for target',
      });
    } catch (e) { console.error('[DirectPush] log save error:', e.message); }

    return res.status(400).json({
      success: false,
      message: 'No valid FCM tokens found for the selected target',
      data: { targetCount: 0, successCount: 0, failureCount: 0 },
    });
  }

  // ---- Create pending log ----
  let logDoc;
  try {
    logDoc = await DirectPushLog.create({
      title, body, imageUrl: imageUrl || null, clickAction: clickAction || null,
      customData: customData || {},
      targetMode,
      targetCount: targetTokens.length,
      successCount: 0, failureCount: 0, invalidTokenCount: 0,
      failures: [], successes: [],
      status: 'sending',
      sentBy: {
        adminId: req.admin?.adminId,
        email: req.admin?.email,
        name: req.admin?.name,
      },
      startedAt: new Date(startedAt),
    });
  } catch (e) {
    console.error('[DirectPush] ⚠️  Could not create log (continuing):', e.message);
  }

  // ---- Send ----
  let result;
  try {
    if (targetTokens.length === 1) {
      const r = await sendToSingleToken(targetTokens[0], {
        title, body, imageUrl, clickAction, customData,
      });
      result = {
        total: 1,
        successCount: r.success ? 1 : 0,
        failureCount: r.success ? 0 : 1,
        invalidTokenCount: r.invalidToken ? 1 : 0,
        successes: r.success ? [{ token: r.token, messageId: r.messageId }] : [],
        failures: r.success ? [] : [{ token: r.token, error: r.error, invalidToken: r.invalidToken }],
      };
    } else {
      result = await sendToManyTokens(targetTokens, {
        title, body, imageUrl, clickAction, customData,
      });
    }
  } catch (e) {
    console.error('[DirectPush] ❌ FATAL send error:', e);
    if (logDoc) {
      try {
        logDoc.status = 'failed';
        logDoc.errorMessage = e.message;
        logDoc.completedAt = new Date();
        logDoc.durationMs = Date.now() - startedAt;
        await logDoc.save();
      } catch {}
    }
    return res.status(500).json({
      success: false,
      message: 'Send failed catastrophically',
      error: e.message,
      stack: process.env.NODE_ENV !== 'production' ? e.stack : undefined,
    });
  }

  const durationMs = Date.now() - startedAt;
  const finalStatus =
    result.failureCount === 0
      ? 'completed'
      : result.successCount === 0
        ? 'failed'
        : 'completed_with_errors';

  // ---- Update log ----
  if (logDoc) {
    try {
      logDoc.successCount = result.successCount;
      logDoc.failureCount = result.failureCount;
      logDoc.invalidTokenCount = result.invalidTokenCount || 0;
      logDoc.failures = (result.failures || []).slice(0, 100).map(f => ({
        token: f.token,
        errorCode: f.error?.code || 'unknown',
        errorMessage: f.error?.message || 'Unknown',
        invalidToken: !!f.invalidToken,
      }));
      logDoc.successes = (result.successes || []).slice(0, 100).map(s => ({
        token: s.token,
        messageId: s.messageId,
      }));
      logDoc.status = finalStatus;
      logDoc.completedAt = new Date();
      logDoc.durationMs = durationMs;
      await logDoc.save();
    } catch (e) {
      console.error('[DirectPush] ⚠️  log update error:', e.message);
    }
  }

  console.log(`[DirectPush] ✅ DONE in ${durationMs}ms — status: ${finalStatus}`);
  console.log(`[DirectPush]    Success: ${result.successCount}, Failed: ${result.failureCount}, Invalid: ${result.invalidTokenCount}`);

  return res.json({
    success: finalStatus !== 'failed',
    message:
      finalStatus === 'completed' ? '✅ Notification sent successfully!' :
      finalStatus === 'completed_with_errors' ? `⚠️ Sent with ${result.failureCount} failures` :
      `❌ All ${result.failureCount} sends failed`,
    data: {
      logId: logDoc?._id,
      targetMode,
      targetCount: targetTokens.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      invalidTokenCount: result.invalidTokenCount || 0,
      durationMs,
      status: finalStatus,
      successes: result.successes || [],
      failures: result.failures || [],
    },
  });
};

// ============================================================
// GET /api/v1/admin/direct-push/preview-count?targetMode=xxx
// ============================================================
exports.previewCount = async (req, res) => {
  const { targetMode, providerId } = req.query;
  try {
    let count = 0;
    let tokens = [];
    switch (targetMode) {
      case 'all_providers':
        tokens = await collectProviderTokens();
        count = tokens.length;
        break;
      case 'all_users':
        tokens = await collectUserTokens();
        count = tokens.length;
        break;
      case 'specific_provider':
        if (providerId) {
          tokens = await collectSpecificProviderTokens([providerId]);
          count = tokens.length;
        }
        break;
      default:
        return res.json({ success: true, data: { count: 0, message: 'Count applies only to bulk modes' } });
    }
    return res.json({ success: true, data: { count, tokensAvailable: count } });
  } catch (e) {
    console.error('[DirectPush] previewCount error:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
};

// ============================================================
// GET /api/v1/admin/direct-push/search-providers?q=xxx
// ============================================================
exports.searchProviders = async (req, res) => {
  const { q = '' } = req.query;
  const query = String(q).trim();
  if (query.length < 2) {
    return res.json({ success: true, data: { providers: [] } });
  }

  const Provider = getProviderModelSafe();
  if (!Provider) {
    return res.json({ success: true, data: { providers: [] } });
  }

  try {
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const providers = await Provider.find({
      $or: [
        { name: regex },
        { email: regex },
        { phone: regex },
        { providerId: regex },
      ],
    })
      .select('name email phone providerId fcmToken categoryName isActive isAvailable')
      .limit(20)
      .lean();

    const mapped = providers.map(p => ({
      _id: p._id,
      providerId: p.providerId,
      name: p.name,
      email: p.email,
      phone: p.phone,
      categoryName: p.categoryName,
      hasFcmToken: !!(p.fcmToken && p.fcmToken.trim()),
      isActive: p.isActive,
      isAvailable: p.isAvailable,
    }));

    return res.json({ success: true, data: { providers: mapped } });
  } catch (e) {
    console.error('[DirectPush] searchProviders error:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
};

// ============================================================
// GET /api/v1/admin/direct-push/history
// ============================================================
exports.getHistory = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  try {
    const [items, total] = await Promise.all([
      DirectPushLog.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-failures -successes')
        .lean(),
      DirectPushLog.countDocuments({}),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: {
        page, limit, total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (e) {
    console.error('[DirectPush] getHistory error:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
};

// ============================================================
// GET /api/v1/admin/direct-push/history/:id
// ============================================================
exports.getHistoryDetail = async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await DirectPushLog.findById(id).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: doc });
  } catch (e) {
    console.error('[DirectPush] getHistoryDetail error:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
};