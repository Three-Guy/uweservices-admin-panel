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

const schema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  adminEmail: String,
  token: { type: String, required: true },
  deviceInfo: String,
  userAgent: String,
  isActive: { type: Boolean, default: true },
  lastUsed: { type: Date, default: Date.now },
}, {
  collection: 'adminfcmtokens',
  timestamps: true
});

schema.index({ token: 1 }, { unique: true });
schema.index({ adminId: 1 });

let AdminFcmToken;
try {
  AdminFcmToken = conn.model('AdminFcmToken');
} catch {
  AdminFcmToken = conn.model('AdminFcmToken', schema);
}

console.log(`[AdminFcmToken] ✅ Model ready on: ${conn.name || 'default'}`);

module.exports = AdminFcmToken;
module.exports.AdminFcmToken = AdminFcmToken;
module.exports.default = AdminFcmToken;