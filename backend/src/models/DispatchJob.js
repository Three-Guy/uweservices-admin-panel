// backend/src/models/DispatchJob.js
// ✅ Auto-detects admin connection from multiple possible helpers
// ✅ Exports MODEL directly (not wrapped in object)

const mongoose = require('mongoose');

/* ─── Try to get admin connection from ANY possible helper ─── */
function getAdminConn() {
  try {
    const multiDb = require('../config/multiDb');
    if (typeof multiDb.getAdminConnection === 'function') return multiDb.getAdminConnection();
    if (typeof multiDb.getAdminPanelConnection === 'function') return multiDb.getAdminPanelConnection();
    if (typeof multiDb.adminConnection === 'function') return multiDb.adminConnection();
    if (multiDb.adminConnection && typeof multiDb.adminConnection.model === 'function') return multiDb.adminConnection;
    if (multiDb.adminDb && typeof multiDb.adminDb.model === 'function') return multiDb.adminDb;
    if (multiDb.admin && typeof multiDb.admin.model === 'function') return multiDb.admin;
  } catch (_) { /* ignore */ }

  try {
    const db = require('../config/database');
    if (typeof db.getAdminConnection === 'function') return db.getAdminConnection();
    if (typeof db.getAdminPanelConnection === 'function') return db.getAdminPanelConnection();
    if (db.adminConnection && typeof db.adminConnection.model === 'function') return db.adminConnection;
    if (db.adminDb && typeof db.adminDb.model === 'function') return db.adminDb;
  } catch (_) { /* ignore */ }

  // Last resort: default mongoose
  return mongoose;
}

const dispatchJobSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, index: true },

    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'no_provider_found', 'cancelled', 'superseded'],
      default: 'queued',
      index: true,
    },

    reason: { type: String, default: 'manual' },
    manual: { type: Boolean, default: false },

    currentCycle: { type: Number, default: 0 },
    currentBatch: { type: Number, default: 0 },
    currentRadiusKm: { type: Number, default: 0 },

    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 10 },

    attemptedProviderIds: [{ type: String }],
    acceptedProviderId: { type: String, default: null },

    lastError: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    nextRunAt: { type: Date, default: null },

    heartbeatAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'dispatchjobs' }
);

dispatchJobSchema.index({ status: 1, createdAt: -1 });
dispatchJobSchema.index({ bookingId: 1, createdAt: -1 });
dispatchJobSchema.index({ status: 1, nextRunAt: 1 });

/* ─── Register on admin connection ─── */
let DispatchJob;
try {
  const conn = getAdminConn();
  DispatchJob =
    (conn.models && conn.models.DispatchJob) ||
    conn.model('DispatchJob', dispatchJobSchema);
  console.log('[DispatchJob] ✅ Model registered on:', conn?.name || conn?.db?.databaseName || 'default');
} catch (err) {
  console.error('[DispatchJob] ⚠️ Fallback to default mongoose:', err.message);
  DispatchJob =
    mongoose.models.DispatchJob ||
    mongoose.model('DispatchJob', dispatchJobSchema);
}

// ✅ Export MODEL directly
module.exports = DispatchJob;