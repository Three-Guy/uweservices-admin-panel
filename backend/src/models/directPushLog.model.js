const mongoose = require('mongoose');
const { getAdminConnection } = require('../config/database');

const failureSchema = new mongoose.Schema({
  token: String,
  error: String,
  code: String,
  invalidToken: { type: Boolean, default: false },
  providerId: String,
  userId: String
}, { _id: false });

const successSchema = new mongoose.Schema({
  token: String,
  messageId: String,
  firebaseProject: String
}, { _id: false });

const directPushLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.Mixed, default: null },
  adminEmail: { type: String, default: 'unknown' },
  adminName: { type: String, default: 'unknown' },
  title: { type: String, required: true },
  body: { type: String, required: true },
  imageUrl: { type: String, default: null },
  clickAction: { type: String, default: null },
  customData: { type: mongoose.Schema.Types.Mixed, default: {} },
  targetMode: {
    type: String,
    enum: ['single', 'multiple', 'all_providers', 'all_users', 'specific_provider', 'specific_providers'],
    required: true
  },
  targetCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'sending', 'completed', 'partial', 'failed'],
    default: 'pending',
    index: true
  },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  invalidTokenCount: { type: Number, default: 0 },
  successes: { type: [successSchema], default: [] },
  failures: { type: [failureSchema], default: [] },
  cleanedUpUsers: { type: Number, default: 0 },
  cleanedUpProviders: { type: Number, default: 0 },
  durationMs: { type: Number, default: 0 },
  error: { type: String, default: null },
  completedAt: { type: Date, default: null }
}, {
  timestamps: true,
  collection: 'directpushlogs'
});

directPushLogSchema.index({ createdAt: -1 });
directPushLogSchema.index({ targetMode: 1, createdAt: -1 });
directPushLogSchema.index({ adminEmail: 1, createdAt: -1 });

let DirectPushLogModel = null;

function getModel() {
  if (DirectPushLogModel) return DirectPushLogModel;
  const conn = getAdminConnection();
  if (!conn) throw new Error('[DirectPushLog] Admin connection not available');
  DirectPushLogModel = conn.models.DirectPushLog || conn.model('DirectPushLog', directPushLogSchema);
  console.log('[DirectPushLog] ✅ Model ready on: admin_panel');
  return DirectPushLogModel;
}

module.exports = new Proxy({}, {
  get(_t, prop) {
    const m = getModel();
    const v = m[prop];
    return typeof v === 'function' ? v.bind(m) : v;
  }
});