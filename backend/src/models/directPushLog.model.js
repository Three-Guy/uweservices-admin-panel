// backend/src/models/directPushLog.model.js
// Mongoose model for Direct Push send history — stored in admin_panel DB

const mongoose = require('mongoose');
const { getAdminConnection } = require('../config/database');

const failureSchema = new mongoose.Schema({
  token: { type: String },
  error: { type: String },
  code: { type: String },
  invalidToken: { type: Boolean, default: false },
  providerId: { type: String },
  userId: { type: String },
}, { _id: false });

const successSchema = new mongoose.Schema({
  token: { type: String },
  messageId: { type: String },
  firebaseProject: { type: String },
}, { _id: false });

const directPushLogSchema = new mongoose.Schema(
  {
    // Admin who sent
    adminId: { type: mongoose.Schema.Types.Mixed, default: null },
    adminEmail: { type: String, default: 'unknown' },
    adminName: { type: String, default: 'unknown' },

    // Notification content
    title: { type: String, required: true },
    body: { type: String, required: true },
    imageUrl: { type: String, default: null },
    clickAction: { type: String, default: null },
    customData: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Targeting
    targetMode: {
      type: String,
      enum: [
        'single',
        'multiple',
        'all_providers',
        'all_users',
        'specific_provider',
        'specific_providers',
      ],
      required: true,
    },
    targetCount: { type: Number, default: 0 },

    // Status
    status: {
      type: String,
      enum: ['pending', 'sending', 'completed', 'partial', 'failed'],
      default: 'pending',
      index: true,
    },

    // Results
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    invalidTokenCount: { type: Number, default: 0 },
    successes: { type: [successSchema], default: [] },
    failures: { type: [failureSchema], default: [] },

    // Cleanup
    cleanedUpUsers: { type: Number, default: 0 },
    cleanedUpProviders: { type: Number, default: 0 },

    // Timing
    durationMs: { type: Number, default: 0 },
    error: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'directpushlogs',
  }
);

// Indexes
directPushLogSchema.index({ createdAt: -1 });
directPushLogSchema.index({ targetMode: 1, createdAt: -1 });
directPushLogSchema.index({ adminEmail: 1, createdAt: -1 });

// Register on admin_panel connection
let DirectPushLogModel = null;

function getModel() {
  if (DirectPushLogModel) return DirectPushLogModel;

  try {
    const conn = getAdminConnection();
    if (!conn) {
      throw new Error('Admin connection not available');
    }

    // Check if already registered
    if (conn.models.DirectPushLog) {
      DirectPushLogModel = conn.models.DirectPushLog;
    } else {
      DirectPushLogModel = conn.model('DirectPushLog', directPushLogSchema);
    }

    console.log('[DirectPushLog] ✅ Model ready on: admin_panel');
    return DirectPushLogModel;
  } catch (err) {
    console.error('[DirectPushLog] ❌ Model init failed:', err.message);
    throw err;
  }
}

// Lazy-loading proxy so it works even if imported before DB connects
module.exports = new Proxy(
  {},
  {
    get(_target, prop) {
      const model = getModel();
      const value = model[prop];
      if (typeof value === 'function') {
        return value.bind(model);
      }
      return value;
    },
  }
);