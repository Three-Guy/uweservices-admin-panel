// backend/src/models/AdminFcmToken.js
const mongoose = require('mongoose');

function getAdminConn() {
  const sources = [];
  try { sources.push(require('../config/multiDb')); } catch (_) {}
  try { sources.push(require('../config/database')); } catch (_) {}

  for (const src of sources) {
    if (!src) continue;
    const fns = [
      'getAdminConnection', 'getAdminPanelConnection', 'getAdminDb',
      'getAdminDB', 'getAdminPanelDb'
    ];
    for (const fn of fns) {
      if (typeof src[fn] === 'function') {
        try {
          const c = src[fn]();
          if (c && typeof c.model === 'function') return c;
        } catch (_) {}
      }
    }
    const props = [
      'adminConnection', 'adminDb', 'adminDB', 'admin',
      'adminPanelConnection', 'adminPanelDb'
    ];
    for (const p of props) {
      if (src[p] && typeof src[p].model === 'function') return src[p];
    }
  }
  return mongoose;
}

const conn = getAdminConn();

const schema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    adminEmail: { type: String, lowercase: true, trim: true, index: true },

    // ✅ FIXED: Field renamed to fcmToken (matches controller & service)
    fcmToken: { type: String, required: true },

    deviceInfo: { type: String, default: 'web-browser' },
    userAgent: { type: String, default: '' },

    isActive: { type: Boolean, default: true, index: true },

    // ✅ ADDED: Fields that controller & alert service write to
    lastUsedAt: { type: Date, default: Date.now },
    lastSuccessAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    lastErrorAt: { type: Date, default: null },
    failureCount: { type: Number, default: 0 },
  },
  {
    collection: 'adminfcmtokens',
    timestamps: true,
    strict: true,
  }
);

// ✅ FIXED: Index on fcmToken (not "token")
schema.index({ fcmToken: 1 }, { unique: true });
schema.index({ adminId: 1 });
schema.index({ adminEmail: 1, isActive: 1 });

let AdminFcmToken;
try {
  // Reuse if already compiled
  AdminFcmToken = conn.models.AdminFcmToken || conn.model('AdminFcmToken', schema);
} catch {
  AdminFcmToken = conn.model('AdminFcmToken', schema);
}

console.log(`[AdminFcmToken] ✅ Model ready on: ${conn.name || 'default'}`);

module.exports = AdminFcmToken;
module.exports.AdminFcmToken = AdminFcmToken;
module.exports.default = AdminFcmToken;