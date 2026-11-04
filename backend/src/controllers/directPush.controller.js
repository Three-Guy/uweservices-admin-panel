// backend/src/controllers/directPush.controller.js
// Direct FCM Push Notification controller — SEPARATE from existing notification logic.

const logger = require('../utils/logger');
const DirectPushLog = require('../models/DirectPushLog');
const { sendToSingleToken, sendToManyTokens, normalizeTokens } = require('../services/directPushSender');

let dbConfig = null;
try { dbConfig = require('../config/database'); } catch (_) {}

function getProviderModelSafe() {
  if (dbConfig && typeof dbConfig.getProviderModel === 'function') {
    try { return dbConfig.getProviderModel(); } catch (_) {}
  }
  return null;
}

function getUserModelSafe() {
  if (dbConfig && typeof dbConfig.getUserModel === 'function') {
    try { return dbConfig.getUserModel(); } catch (_) {}
  }
  return null;
}

function getProviderConnectionSafe() {
  if (dbConfig && typeof dbConfig.getProviderConnection === 'function') {
    try { return dbConfig.getProviderConnection(); } catch (_) {}
  }
  return null;
}

function getUserConnectionSafe() {
  if (dbConfig && typeof dbConfig.getUserConnection === 'function') {
    try { return dbConfig.getUserConnection(); } catch (_) {}
  }
  return null;
}

/**
 * Normalize + validate request payload.
 */
function normalizePayload(body) {
  const title = (body.title || '').toString().trim();
  const bodyText = (body.body || '').toString().trim();
  const imageUrl = (body.imageUrl || '').toString().trim();
  const clickAction = (body.clickAction || '').toString().trim();

  let customData = {};
  if (body.customData) {
    if (typeof body.customData === 'string') {
      try {
        customData = JSON.parse(body.customData);
      } catch (e) {
        throw new Error('customData must be valid JSON');
      }
    } else if (typeof body.customData === 'object') {
      customData = body.customData;
    }
  }

  if (!title) throw new Error('title is required');
  if (!bodyText) throw new Error('body is required');
  if (title.length > 200) throw new Error('title too long (max 200)');
  if (bodyText.length > 2000) throw new Error('body too long (max 2000)');

  return { title, body: bodyText, imageUrl, clickAction, customData };
}

/**
 * Fetch tokens for a given target mode.
 * Returns { tokens: [...], metaMap: Map<token, {recipientId, recipientType, recipientLabel}> }
 */
async function resolveTokensForTarget(targetMode, body) {
  const metaMap = new Map();
  let tokens = [];

  if (targetMode === 'single') {
    const raw = (body.token || '').toString().trim();
    if (!raw) throw new Error('token is required for single mode');
    tokens = [raw];
  }

  else if (targetMode === 'multiple') {
    let arr = [];
    if (Array.isArray(body.tokens)) {
      arr = body.tokens;
    } else if (typeof body.tokens === 'string') {
      arr = body.tokens.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean);
    }
    if (arr.length === 0) throw new Error('tokens list is empty');
    tokens = normalizeTokens(arr);
  }

  else if (targetMode === 'all_providers') {
    const Provider = getProviderModelSafe();
    if (!Provider) {
      // Direct connection fallback
      const conn = getProviderConnectionSafe();
      if (!conn) throw new Error('Provider database not available');
      const docs = await conn.collection('providers')
        .find(
          { fcmToken: { $exists: true, $ne: null, $ne: '' }, isActive: { $ne: false } },
          { projection: { _id: 1, fcmToken: 1, name: 1, email: 1 } }
        ).toArray();
      for (const d of docs) {
        if (d.fcmToken) {
          tokens.push(d.fcmToken);
          metaMap.set(d.fcmToken, {
            recipientId: d._id,
            recipientType: 'provider',
            recipientLabel: d.name || d.email || String(d._id),
          });
        }
      }
    } else {
      const docs = await Provider.find(
        { fcmToken: { $exists: true, $ne: null, $ne: '' }, isActive: { $ne: false } },
        { _id: 1, fcmToken: 1, name: 1, email: 1 }
      ).lean();
      for (const d of docs) {
        if (d.fcmToken) {
          tokens.push(d.fcmToken);
          metaMap.set(d.fcmToken, {
            recipientId: d._id,
            recipientType: 'provider',
            recipientLabel: d.name || d.email || String(d._id),
          });
        }
      }
    }
  }

  else if (targetMode === 'all_users') {
    const User = getUserModelSafe();
    if (!User) {
      const conn = getUserConnectionSafe();
      if (!conn) throw new Error('User database not available');
      const docs = await conn.collection('users')
        .find(
          { fcmToken: { $exists: true, $ne: null, $ne: '' }, isActive: { $ne: false } },
          { projection: { _id: 1, fcmToken: 1, name: 1, email: 1 } }
        ).toArray();
      for (const d of docs) {
        if (d.fcmToken) {
          tokens.push(d.fcmToken);
          metaMap.set(d.fcmToken, {
            recipientId: d._id,
            recipientType: 'user',
            recipientLabel: d.name || d.email || String(d._id),
          });
        }
      }
    } else {
      // Users schema may not declare fcmToken — query raw collection
      const conn = getUserConnectionSafe();
      if (conn) {
        const docs = await conn.collection('users')
          .find(
            { fcmToken: { $exists: true, $ne: null, $ne: '' }, isActive: { $ne: false } },
            { projection: { _id: 1, fcmToken: 1, name: 1, email: 1 } }
          ).toArray();
        for (const d of docs) {
          if (d.fcmToken) {
            tokens.push(d.fcmToken);
            metaMap.set(d.fcmToken, {
              recipientId: d._id,
              recipientType: 'user',
              recipientLabel: d.name || d.email || String(d._id),
            });
          }
        }
      }
    }
  }

  else if (targetMode === 'specific_provider' || targetMode === 'specific_providers') {
    let ids = [];
    if (Array.isArray(body.providerIds)) {
      ids = body.providerIds.filter(Boolean);
    } else if (body.providerId) {
      ids = [body.providerId];
    }
    if (ids.length === 0) throw new Error('providerId or providerIds required');

    const Provider = getProviderModelSafe();
    if (!Provider) throw new Error('Provider model not available');

    const docs = await Provider.find(
      { _id: { $in: ids } },
      { _id: 1, fcmToken: 1, name: 1, email: 1 }
    ).lean();

    for (const d of docs) {
      if (d.fcmToken) {
        tokens.push(d.fcmToken);
        metaMap.set(d.fcmToken, {
          recipientId: d._id,
          recipientType: 'provider',
          recipientLabel: d.name || d.email || String(d._id),
        });
      }
    }
  }

  else {
    throw new Error(`Unknown targetMode: ${targetMode}`);
  }

  tokens = normalizeTokens(tokens);
  return { tokens, metaMap };
}

// =====================================================================
// ENDPOINTS
// =====================================================================

/**
 * POST /api/v1/admin/direct-push/send
 */
exports.sendDirectPush = async (req, res) => {
  const startedAt = new Date();
  let logDoc = null;

  try {
    const targetMode = (req.body.targetMode || '').toString().trim();
    if (!targetMode) {
      return res.status(400).json({ success: false, message: 'targetMode is required' });
    }

    let payload;
    try {
      payload = normalizePayload(req.body);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    const { tokens, metaMap } = await resolveTokensForTarget(targetMode, req.body);

    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid FCM tokens found for the selected target',
      });
    }

    // Create log entry
    logDoc = await DirectPushLog.create({
      title: payload.title,
      body: payload.body,
      imageUrl: payload.imageUrl,
      clickAction: payload.clickAction,
      customData: payload.customData,
      targetMode,
      targetCount: tokens.length,
      status: 'sending',
      startedAt,
      sentBy: {
        adminId: req.admin?.adminId || req.admin?._id || null,
        email: req.admin?.email || '',
        name: req.admin?.name || '',
      },
    });

    // Send
    let results;
    if (tokens.length === 1) {
      const single = await sendToSingleToken(tokens[0], payload);
      const meta = metaMap.get(tokens[0]) || {};
      results = {
        total: 1,
        success: single.success ? 1 : 0,
        failure: single.success ? 0 : 1,
        invalidTokens: 0,
        successes: single.success ? [{
          tokenPreview: tokens[0].substring(0, 20) + '...',
          recipientId: meta.recipientId || null,
          recipientType: meta.recipientType || 'unknown',
          recipientLabel: meta.recipientLabel || '',
          messageId: single.messageId || '',
        }] : [],
        failures: single.success ? [] : [{
          token: tokens[0],
          tokenPreview: tokens[0].substring(0, 20) + '...',
          recipientId: meta.recipientId || null,
          recipientType: meta.recipientType || 'unknown',
          recipientLabel: meta.recipientLabel || '',
          errorCode: single.errorCode || 'unknown',
          errorMessage: single.errorMessage || '',
        }],
      };
    } else {
      results = await sendToManyTokens(tokens, payload, metaMap);
    }

    const completedAt = new Date();
    const durationMs = completedAt - startedAt;
    const finalStatus = results.failure === 0
      ? 'completed'
      : (results.success === 0 ? 'failed' : 'completed_with_errors');

    logDoc.successCount = results.success;
    logDoc.failureCount = results.failure;
    logDoc.invalidTokenCount = results.invalidTokens;
    logDoc.successes = results.successes.slice(0, 500);
    logDoc.failures = results.failures.slice(0, 500);
    logDoc.status = finalStatus;
    logDoc.completedAt = completedAt;
    logDoc.durationMs = durationMs;
    await logDoc.save();

    return res.json({
      success: true,
      message: `Push sent: ${results.success} succeeded, ${results.failure} failed`,
      data: {
        logId: logDoc._id,
        targetMode,
        targetCount: results.total,
        successCount: results.success,
        failureCount: results.failure,
        invalidTokenCount: results.invalidTokens,
        durationMs,
        status: finalStatus,
        failures: results.failures.slice(0, 50),
        successes: results.successes.slice(0, 50),
      },
    });

  } catch (err) {
    logger.error(`[directPush.sendDirectPush] ${err.message}`);
    console.error(err);

    if (logDoc) {
      try {
        logDoc.status = 'failed';
        logDoc.errorMessage = err.message;
        logDoc.completedAt = new Date();
        logDoc.durationMs = new Date() - startedAt;
        await logDoc.save();
      } catch (_) {}
    }

    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to send push notification',
    });
  }
};

/**
 * GET /api/v1/admin/direct-push/preview-count?targetMode=xxx[&providerId=yyy]
 */
exports.previewCount = async (req, res) => {
  try {
    const targetMode = (req.query.targetMode || '').toString().trim();
    if (!targetMode) {
      return res.status(400).json({ success: false, message: 'targetMode is required' });
    }

    const body = {
      ...req.query,
      providerIds: req.query.providerIds
        ? (Array.isArray(req.query.providerIds) ? req.query.providerIds : String(req.query.providerIds).split(','))
        : undefined,
    };

    const { tokens } = await resolveTokensForTarget(targetMode, body);
    return res.json({
      success: true,
      data: {
        targetMode,
        tokenCount: tokens.length,
      },
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/direct-push/search-providers?q=xxx
 */
exports.searchProviders = async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const Provider = getProviderModelSafe();
    if (!Provider) {
      return res.status(500).json({ success: false, message: 'Provider model not available' });
    }

    const query = { fcmToken: { $exists: true, $ne: null, $ne: '' } };
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { providerId: regex },
      ];
    }

    const docs = await Provider.find(query, {
      _id: 1, name: 1, email: 1, phone: 1, providerId: 1,
      fcmToken: 1, isActive: 1, profession: 1,
    }).limit(limit).lean();

    const results = docs.map(d => ({
      _id: d._id,
      name: d.name || '',
      email: d.email || '',
      phone: d.phone || '',
      providerId: d.providerId || '',
      profession: d.profession || '',
      isActive: d.isActive !== false,
      hasFcmToken: !!d.fcmToken,
      tokenPreview: d.fcmToken ? d.fcmToken.substring(0, 20) + '...' : '',
    }));

    return res.json({ success: true, data: { providers: results, total: results.length } });
  } catch (err) {
    logger.error(`[directPush.searchProviders] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/direct-push/history?page=1&limit=25
 */
exports.getHistory = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.targetMode) query.targetMode = req.query.targetMode;

    const [items, total] = await Promise.all([
      DirectPushLog.find(query, {
        failures: 0, successes: 0, customData: 0,
      }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      DirectPushLog.countDocuments(query),
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
    logger.error(`[directPush.getHistory] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/direct-push/history/:id
 */
exports.getHistoryDetail = async (req, res) => {
  try {
    const doc = await DirectPushLog.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Log not found' });
    return res.json({ success: true, data: doc });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};