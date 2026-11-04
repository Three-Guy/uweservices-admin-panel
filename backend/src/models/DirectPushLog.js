// backend/src/models/DirectPushLog.js
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

const failureSchema = new mongoose.Schema({
  token: { type: String },
  tokenPreview: { type: String },
  recipientId: { type: mongoose.Schema.Types.ObjectId },
  recipientType: { type: String, enum: ['provider', 'user', 'unknown'], default: 'unknown' },
  recipientLabel: { type: String, default: '' },
  errorCode: { type: String, default: '' },
  errorMessage: { type: String, default: '' },
}, { _id: false });

const successEntrySchema = new mongoose.Schema({
  tokenPreview: { type: String },
  recipientId: { type: mongoose.Schema.Types.ObjectId },
  recipientType: { type: String, enum: ['provider', 'user', 'unknown'], default: 'unknown' },
  recipientLabel: { type: String, default: '' },
  messageId: { type: String, default: '' },
}, { _id: false });

const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  body: { type: String, required: true, trim: true },
  imageUrl: { type: String, default: '' },
  clickAction: { type: String, default: '' },
  customData: { type: mongoose.Schema.Types.Mixed, default: {} },

  targetMode: {
    type: String,
    enum: ['single', 'multiple', 'all_providers', 'all_users', 'specific_provider', 'specific_providers'],
    required: true,
  },
  targetCount: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  invalidTokenCount: { type: Number, default: 0 },

  failures: { type: [failureSchema], default: [] },
  successes: { type: [successEntrySchema], default: [] },

  status: {
    type: String,
    enum: ['queued', 'sending', 'completed', 'completed_with_errors', 'failed'],
    default: 'queued',
  },

  sentBy: {
    adminId: { type: mongoose.Schema.Types.ObjectId },
    email: { type: String, default: '' },
    name: { type: String, default: '' },
  },

  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  durationMs: { type: Number, default: 0 },
  errorMessage: { type: String, default: '' },
}, {
  collection: 'directpushlogs',
  timestamps: true,
  strict: true,
});

schema.index({ createdAt: -1 });
schema.index({ 'sentBy.adminId': 1, createdAt: -1 });
schema.index({ status: 1 });
schema.index({ targetMode: 1 });

let DirectPushLog;
try {
  DirectPushLog = conn.models.DirectPushLog || conn.model('DirectPushLog', schema);
} catch {
  DirectPushLog = conn.model('DirectPushLog', schema);
}

console.log(`[DirectPushLog] ✅ Model ready on: ${conn.name || 'default'}`);

module.exports = DirectPushLog;
module.exports.DirectPushLog = DirectPushLog;
module.exports.default = DirectPushLog;