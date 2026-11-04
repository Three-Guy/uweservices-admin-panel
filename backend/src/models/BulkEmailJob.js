// backend/src/models/BulkEmailJob.js
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
  email: { type: String },
  name: { type: String, default: '' },
  errorMessage: { type: String, default: '' },
  attemptedAt: { type: Date, default: Date.now },
}, { _id: false });

const recipientSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  name: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'skipped'],
    default: 'pending',
  },
  errorMessage: { type: String, default: '' },
  sentAt: { type: Date, default: null },
}, { _id: false });

const schema = new mongoose.Schema({
  fileName: { type: String, default: '' },
  fileSizeBytes: { type: Number, default: 0 },

  subject: { type: String, required: true, trim: true },
  htmlBody: { type: String, required: true },
  textBody: { type: String, default: '' },

  totalRecipients: { type: Number, default: 0 },
  validRecipients: { type: Number, default: 0 },
  invalidRecipients: { type: Number, default: 0 },
  duplicateRecipients: { type: Number, default: 0 },

  sent: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'completed_with_errors', 'failed', 'cancelled'],
    default: 'queued',
    index: true,
  },

  progress: { type: Number, default: 0, min: 0, max: 100 },

  recipients: { type: [recipientSchema], default: [] },
  failures: { type: [failureSchema], default: [] },

  createdBy: {
    adminId: { type: mongoose.Schema.Types.ObjectId },
    email: { type: String, default: '' },
    name: { type: String, default: '' },
  },

  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  durationMs: { type: Number, default: 0 },
  errorMessage: { type: String, default: '' },
}, {
  collection: 'bulkemailjobs',
  timestamps: true,
  strict: true,
});

schema.index({ createdAt: -1 });
schema.index({ 'createdBy.adminId': 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });

let BulkEmailJob;
try {
  BulkEmailJob = conn.models.BulkEmailJob || conn.model('BulkEmailJob', schema);
} catch {
  BulkEmailJob = conn.model('BulkEmailJob', schema);
}

console.log(`[BulkEmailJob] ✅ Model ready on: ${conn.name || 'default'}`);

module.exports = BulkEmailJob;
module.exports.BulkEmailJob = BulkEmailJob;
module.exports.default = BulkEmailJob;