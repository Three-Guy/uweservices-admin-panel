// backend/src/controllers/directPush.controller.js
// Direct FCM Push Controller — with FCM token browser for users & providers
// v3.0 — Added listFcmUsers, listFcmProviders, auto-cleanup dead tokens

const mongoose = require('mongoose');
const DirectPushLog = require('../models/directPushLog.model');
const { getUserConnection, getProviderModel } = require('../config/database');
const {
  sendToSingleToken,
  sendToManyTokens,
  normalizeTokens
} = require('../services/directPushSender');

// ────────────────────────────────────────────────────────────────
// Safe model accessors
// ────────────────────────────────────────────────────────────────
function getProviderModelSafe() {
  try {
    return getProviderModel();
  } catch (err) {
    console.error('[DirectPush] Provider model unavailable:', err.message);
    return null;
  }
}

function getUserCollectionSafe() {
  try {
    const conn = getUserConnection();
    if (!conn) return null;
    return conn.collection('users');
  } catch (err) {
    console.error('[DirectPush] User collection unavailable:', err.message);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────
// Token collectors
// ────────────────────────────────────────────────────────────────
async function collectProviderTokens() {
  const Provider = getProviderModelSafe();
  if (!Provider) return [];

  const providers = await Provider.find(
    {
      fcmToken: { $exists: true, $ne: null, $ne: '' },
      isActive: true
    },
    { fcmToken: 1, _id: 1, providerId: 1, name: 1 }
  ).lean();

  return providers
    .map(p => p.fcmToken)
    .filter(Boolean);
}

async function collectUserTokens() {
  const users = getUserCollectionSafe();
  if (!users) return [];

  const docs = await users.find(
    {
      fcmTokens: {
        $elemMatch: {
          token: { $exists: true, $ne: null, $ne: '' },
          isActive: true
        }
      }
    },
    { projection: { fcmTokens: 1, _id: 1, email: 1 } }
  ).toArray();

  const allTokens = [];
  for (const doc of docs) {
    if (!Array.isArray(doc.fcmTokens)) continue;
    for (const entry of doc.fcmTokens) {
      if (entry && entry.token && entry.isActive !== false) {
        allTokens.push(entry.token);
      }
    }
  }

  return Array.from(new Set(allTokens));
}

async function collectSpecificProviderTokens(providerIdOrArray) {
  const Provider = getProviderModelSafe();
  if (!Provider) return [];

  const ids = Array.isArray(providerIdOrArray) ? providerIdOrArray : [providerIdOrArray];
  const objectIds = [];
  const codeIds = [];

  for (const id of ids) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      objectIds.push(new mongoose.Types.ObjectId(id));
    } else {
      codeIds.push(id);
    }
  }

  const query = { $or: [] };
  if (objectIds.length) query.$or.push({ _id: { $in: objectIds } });
  if (codeIds.length) query.$or.push({ providerId: { $in: codeIds } });

  if (!query.$or.length) return [];

  const providers = await Provider.find(
    { ...query, fcmToken: { $exists: true, $ne: null, $ne: '' } },
    { fcmToken: 1 }
  ).lean();

  return providers.map(p => p.fcmToken).filter(Boolean);
}

// ────────────────────────────────────────────────────────────────
// AUTO-CLEANUP: Remove dead tokens from database
// ────────────────────────────────────────────────────────────────
async function cleanupDeadTokens(failures) {
  if (!Array.isArray(failures) || failures.length === 0) return { users: 0, providers: 0 };

  const deadTokens = failures
    .filter(f => f && f.invalidToken && f.token)
    .map(f => f.token);

  if (deadTokens.length === 0) return { users: 0, providers: 0 };

  console.log(`[DirectPush] 🧹 Auto-cleaning ${deadTokens.length} dead token(s) from DB...`);

  let usersCleaned = 0;
  let providersCleaned = 0;

  // Clean from users.fcmTokens[] array
  try {
    const users = getUserCollectionSafe();
    if (users) {
      const result = await users.updateMany(
        { 'fcmTokens.token': { $in: deadTokens } },
        {
          $pull: {
            fcmTokens: { token: { $in: deadTokens } }
          }
        }
      );
      usersCleaned = result.modifiedCount || 0;
      if (usersCleaned > 0) {
        console.log(`[DirectPush] ✅ Removed dead tokens from ${usersCleaned} user(s)`);
      }
    }
  } catch (err) {
    console.error('[DirectPush] ❌ User cleanup error:', err.message);
  }

  // Clean from providers.fcmToken (single field)
  try {
    const Provider = getProviderModelSafe();
    if (Provider) {
      const result = await Provider.updateMany(
        { fcmToken: { $in: deadTokens } },
        { $unset: { fcmToken: 1 } }
      );
      providersCleaned = result.modifiedCount || 0;
      if (providersCleaned > 0) {
        console.log(`[DirectPush] ✅ Removed dead tokens from ${providersCleaned} provider(s)`);
      }
    }
  } catch (err) {
    console.error('[DirectPush] ❌ Provider cleanup error:', err.message);
  }

  return { users: usersCleaned, providers: providersCleaned };
}

// ────────────────────────────────────────────────────────────────
// LIST USERS WITH FCM TOKENS
// ────────────────────────────────────────────────────────────────
async function listFcmUsers(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    const users = getUserCollectionSafe();
    if (!users) {
      return res.json({ success: true, users: [], total: 0, page, limit });
    }

    // Build query — users who have at least one active FCM token
    const matchQuery = {
      fcmTokens: {
        $elemMatch: {
          token: { $exists: true, $ne: null, $ne: '' },
          isActive: true
        }
      }
    };

    // Add search filter
    if (search.length >= 2) {
      const regex = new RegExp(search, 'i');
      matchQuery.$or = [
        { name: regex },
        { email: regex },
        { phone: regex }
      ];
    }

    const [docs, total] = await Promise.all([
      users.find(matchQuery, {
        projection: {
          name: 1,
          email: 1,
          phone: 1,
          profilePicture: 1,
          isActive: 1,
          lastLogin: 1,
          createdAt: 1,
          fcmTokens: 1
        }
      })
        .sort({ lastLogin: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      users.countDocuments(matchQuery)
    ]);

    const result = docs.map(doc => {
      const activeTokens = (doc.fcmTokens || []).filter(
        t => t && t.token && t.isActive !== false
      );
      return {
        _id: doc._id.toString(),
        name: doc.name || 'Unknown',
        email: doc.email || '',
        phone: doc.phone || '',
        profilePicture: doc.profilePicture || null,
        isActive: doc.isActive !== false,
        lastLogin: doc.lastLogin || doc.createdAt || null,
        tokenCount: activeTokens.length,
        tokens: activeTokens.map(t => ({
          token: t.token,
          platform: t.platform || 'unknown',
          deviceId: t.deviceId || null,
          deviceModel: t.deviceInfo?.model || null,
          appVersion: t.deviceInfo?.appVersion || null,
          createdAt: t.createdAt || null,
          lastUsedAt: t.lastUsedAt || null
        }))
      };
    });

    return res.json({
      success: true,
      users: result,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('[DirectPush] listFcmUsers error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ────────────────────────────────────────────────────────────────
// LIST PROVIDERS WITH FCM TOKENS
// ────────────────────────────────────────────────────────────────
async function listFcmProviders(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    const Provider = getProviderModelSafe();
    if (!Provider) {
      return res.json({ success: true, providers: [], total: 0, page, limit });
    }

    // Build query — providers who have an fcmToken
    const matchQuery = {
      fcmToken: { $exists: true, $ne: null, $ne: '' }
    };

    // Add search filter
    if (search.length >= 2) {
      const regex = new RegExp(search, 'i');
      matchQuery.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { providerId: regex },
        { profession: regex },
        { city: regex }
      ];
    }

    const [docs, total] = await Promise.all([
      Provider.find(matchQuery, {
        name: 1,
        email: 1,
        phone: 1,
        providerId: 1,
        profession: 1,
        city: 1,
        profilePicture: 1,
        isActive: 1,
        isOnline: 1,
        isAvailable: 1,
        lastLogin: 1,
        lastOnlineAt: 1,
        createdAt: 1,
        fcmToken: 1,
        verificationStatus: 1
      })
        .sort({ lastLogin: -1, lastOnlineAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Provider.countDocuments(matchQuery)
    ]);

    const result = docs.map(doc => ({
      _id: doc._id.toString(),
      providerId: doc.providerId || '',
      name: doc.name || 'Unknown',
      email: doc.email || '',
      phone: doc.phone || '',
      profession: doc.profession || '',
      city: doc.city || '',
      profilePicture: doc.profilePicture || null,
      isActive: doc.isActive !== false,
      isOnline: !!doc.isOnline,
      isAvailable: !!doc.isAvailable,
      verificationStatus: doc.verificationStatus || 'pending',
      lastLogin: doc.lastLogin || doc.lastOnlineAt || doc.createdAt || null,
      token: doc.fcmToken,
      tokenPreview: doc.fcmToken ? doc.fcmToken.substring(0, 20) + '...' : null
    }));

    return res.json({
      success: true,
      providers: result,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('[DirectPush] listFcmProviders error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ────────────────────────────────────────────────────────────────
// Main send controller
// ────────────────────────────────────────────────────────────────
async function sendDirectPush(req, res) {
  const startTime = Date.now();
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
    providerIds
  } = req.body;

  console.log('\n[DirectPush] 🚀 NEW SEND REQUEST');
  console.log(`[DirectPush]   Mode: ${targetMode}`);
  console.log(`[DirectPush]   Title: ${title}`);
  console.log(`[DirectPush]   Body: ${body}`);
  if (customData && Object.keys(customData).length > 0) {
    console.log(`[DirectPush]   CustomData keys: ${Object.keys(customData).join(', ')}`);
  }

  // Validation
  if (!title || !body) {
    return res.status(400).json({
      success: false,
      message: 'title and body are required'
    });
  }

  if (!targetMode) {
    return res.status(400).json({
      success: false,
      message: 'targetMode is required (single/multiple/all_providers/all_users/specific_provider/specific_providers)'
    });
  }

  // Parse customData — accept both string and object
  let parsedCustomData = {};
  if (customData) {
    try {
      if (typeof customData === 'string') {
        parsedCustomData = JSON.parse(customData);
      } else if (typeof customData === 'object' && !Array.isArray(customData)) {
        parsedCustomData = customData;
      }
      // Ensure all values are strings (FCM requirement)
      const stringified = {};
      for (const [key, val] of Object.entries(parsedCustomData)) {
        if (val === null || val === undefined) continue;
        stringified[key] = typeof val === 'string' ? val : JSON.stringify(val);
      }
      parsedCustomData = stringified;
    } catch (err) {
      console.error('[DirectPush] ⚠️ customData parse error:', err.message);
      return res.status(400).json({
        success: false,
        message: 'customData must be a valid JSON object: ' + err.message
      });
    }
  }

  // Collect target tokens
  let targetTokens = [];

  try {
    switch (targetMode) {
      case 'single':
        if (!token) {
          return res.status(400).json({ success: false, message: 'token is required for single mode' });
        }
        targetTokens = [token];
        break;

      case 'multiple':
        if (!Array.isArray(tokens) || tokens.length === 0) {
          return res.status(400).json({ success: false, message: 'tokens array is required for multiple mode' });
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
          return res.status(400).json({ success: false, message: 'providerId is required for specific_provider mode' });
        }
        targetTokens = await collectSpecificProviderTokens(providerId);
        break;

      case 'specific_providers':
        if (!Array.isArray(providerIds) || providerIds.length === 0) {
          return res.status(400).json({ success: false, message: 'providerIds array is required for specific_providers mode' });
        }
        targetTokens = await collectSpecificProviderTokens(providerIds);
        break;

      default:
        return res.status(400).json({ success: false, message: `Unknown targetMode: ${targetMode}` });
    }
  } catch (err) {
    console.error('[DirectPush] ❌ Token collection error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to collect target tokens',
      error: err.message
    });
  }

  console.log(`[DirectPush] 🎯 Final target count: ${targetTokens.length}`);

  if (targetTokens.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid tokens found for the selected target'
    });
  }

  // Create pending log
  const adminId = req.admin?.adminId || req.admin?._id || null;
  const adminEmail = req.admin?.email || 'unknown';
  const adminName = req.admin?.name || 'unknown';

  let logDoc;
  try {
    logDoc = await DirectPushLog.create({
      adminId,
      adminEmail,
      adminName,
      title,
      body,
      imageUrl: imageUrl || null,
      clickAction: clickAction || null,
      customData: parsedCustomData,
      targetMode,
      targetCount: targetTokens.length,
      status: 'pending',
      createdAt: new Date()
    });
  } catch (err) {
    console.error('[DirectPush] ❌ Log creation failed:', err);
  }

  // Send notifications
  let result;
  try {
    if (targetTokens.length === 1) {
      result = await sendToSingleToken(targetTokens[0], {
        title,
        body,
        imageUrl,
        clickAction,
        data: parsedCustomData
      });

      // Normalize single-token result into bulk format
      if (result.success) {
        result = {
          successCount: 1,
          failureCount: 0,
          invalidTokenCount: 0,
          successes: [{ token: targetTokens[0], messageId: result.messageId, firebaseProject: result.firebaseProject }],
          failures: []
        };
      } else {
        result = {
          successCount: 0,
          failureCount: 1,
          invalidTokenCount: result.invalidToken ? 1 : 0,
          successes: [],
          failures: [{
            token: targetTokens[0],
            error: result.errors?.[0]?.message || result.error || 'Unknown error',
            code: result.errors?.[0]?.code || result.code || 'unknown',
            invalidToken: !!result.invalidToken
          }]
        };
      }
    } else {
      result = await sendToManyTokens(targetTokens, {
        title,
        body,
        imageUrl,
        clickAction,
        data: parsedCustomData
      });
    }
  } catch (err) {
    console.error('[DirectPush] ❌ Send failed:', err);
    if (logDoc) {
      await DirectPushLog.findByIdAndUpdate(logDoc._id, {
        status: 'failed',
        error: err.message,
        durationMs: Date.now() - startTime,
        completedAt: new Date()
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Send failed',
      error: err.message
    });
  }

  const durationMs = Date.now() - startTime;
  const finalStatus =
    result.successCount > 0 && result.failureCount === 0 ? 'completed'
    : result.successCount > 0 ? 'partial'
    : 'failed';

  // AUTO-CLEANUP dead tokens
  const cleanupResult = await cleanupDeadTokens(result.failures || []);

  // Update log
  if (logDoc) {
    try {
      await DirectPushLog.findByIdAndUpdate(logDoc._id, {
        status: finalStatus,
        successCount: result.successCount || 0,
        failureCount: result.failureCount || 0,
        invalidTokenCount: result.invalidTokenCount || 0,
        successes: (result.successes || []).slice(0, 100),
        failures: (result.failures || []).slice(0, 100),
        durationMs,
        cleanedUpUsers: cleanupResult.users,
        cleanedUpProviders: cleanupResult.providers,
        completedAt: new Date()
      });
    } catch (err) {
      console.error('[DirectPush] ❌ Log update failed:', err);
    }
  }

  console.log(`[DirectPush] ✅ DONE in ${durationMs}ms — status: ${finalStatus}`);
  console.log(`[DirectPush]    Success: ${result.successCount}, Failed: ${result.failureCount}, Invalid: ${result.invalidTokenCount}`);
  if (cleanupResult.users + cleanupResult.providers > 0) {
    console.log(`[DirectPush]    🧹 Cleaned ${cleanupResult.users} user(s) + ${cleanupResult.providers} provider(s)`);
  }

  return res.json({
    success: finalStatus !== 'failed',
    status: finalStatus,
    logId: logDoc?._id || null,
    targetMode,
    targetCount: targetTokens.length,
    successCount: result.successCount || 0,
    failureCount: result.failureCount || 0,
    invalidTokenCount: result.invalidTokenCount || 0,
    cleanedUp: cleanupResult,
    durationMs,
    failures: (result.failures || []).slice(0, 20),
    message: finalStatus === 'completed'
      ? `✅ Delivered to all ${result.successCount} device(s)`
      : finalStatus === 'partial'
      ? `⚠️ Delivered to ${result.successCount}/${targetTokens.length} device(s)`
      : result.invalidTokenCount === targetTokens.length
      ? `❌ All ${targetTokens.length} token(s) are dead/expired. User must re-login to generate new tokens.`
      : `❌ Failed to deliver to any device`
  });
}

// ────────────────────────────────────────────────────────────────
// Preview count (no actual sending)
// ────────────────────────────────────────────────────────────────
async function previewCount(req, res) {
  const { targetMode, providerId, providerIds } = req.body;

  try {
    let count = 0;
    switch (targetMode) {
      case 'all_providers':
        count = (await collectProviderTokens()).length;
        break;
      case 'all_users':
        count = (await collectUserTokens()).length;
        break;
      case 'specific_provider':
        count = (await collectSpecificProviderTokens(providerId)).length;
        break;
      case 'specific_providers':
        count = (await collectSpecificProviderTokens(providerIds || [])).length;
        break;
      default:
        count = 0;
    }

    return res.json({ success: true, count, targetMode });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ────────────────────────────────────────────────────────────────
// Search providers for autocomplete
// ────────────────────────────────────────────────────────────────
async function searchProviders(req, res) {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json({ success: true, providers: [] });
  }

  const Provider = getProviderModelSafe();
  if (!Provider) return res.json({ success: true, providers: [] });

  try {
    const regex = new RegExp(q, 'i');
    const providers = await Provider.find(
      {
        $or: [
          { name: regex },
          { email: regex },
          { phone: regex },
          { providerId: regex }
        ]
      },
      { name: 1, email: 1, phone: 1, providerId: 1, fcmToken: 1, profession: 1, city: 1 }
    )
      .limit(20)
      .lean();

    return res.json({
      success: true,
      providers: providers.map(p => ({
        _id: p._id,
        providerId: p.providerId,
        name: p.name,
        email: p.email,
        phone: p.phone,
        profession: p.profession,
        city: p.city,
        hasToken: !!p.fcmToken
      }))
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ────────────────────────────────────────────────────────────────
// History list (paginated)
// ────────────────────────────────────────────────────────────────
async function getHistory(req, res) {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const skip = (page - 1) * limit;

  try {
    const [items, total] = await Promise.all([
      DirectPushLog.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-successes -failures')
        .lean(),
      DirectPushLog.countDocuments({})
    ]);

    return res.json({
      success: true,
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ────────────────────────────────────────────────────────────────
// History detail (full failures/successes)
// ────────────────────────────────────────────────────────────────
async function getHistoryDetail(req, res) {
  try {
    const log = await DirectPushLog.findById(req.params.id).lean();
    if (!log) {
      return res.status(404).json({ success: false, message: 'Log not found' });
    }
    return res.json({ success: true, log });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  sendDirectPush,
  previewCount,
  searchProviders,
  getHistory,
  getHistoryDetail,
  listFcmUsers,
  listFcmProviders
};