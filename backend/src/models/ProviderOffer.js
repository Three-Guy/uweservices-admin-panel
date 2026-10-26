// backend/src/models/ProviderOffer.js
// ✅ Auto-detects admin connection
// ✅ Exports MODEL directly

const mongoose = require('mongoose');

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

  return mongoose;
}

const providerOfferSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, index: true },
    providerId: { type: String, required: true, index: true },
    providerName: { type: String },
    providerPhone: { type: String },

    status: {
      type: String,
      enum: [
        'pending', 'sent', 'delivered', 'viewed',
        'accepted', 'rejected', 'expired', 'timeout',
        'failed', 'superseded',
      ],
      default: 'pending',
      index: true,
    },

    cycle: { type: Number, default: 1 },
    batch: { type: Number, default: 1 },
    radiusKm: { type: Number, default: 0 },
    distanceKm: { type: Number, default: null },

    fcmSent: { type: Boolean, default: false },
    fcmError: { type: String, default: null },
    fcmResponse: { type: mongoose.Schema.Types.Mixed, default: null },

    sentAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },

    responseMessage: { type: String, default: null },
    rejectionReason: { type: String, default: null },
    reason: { type: String, default: null },

    isCurrentOffer: { type: Boolean, default: true },
    supersededBy: { type: String, default: null },
  },
  { timestamps: true, collection: 'provideroffers' }
);

providerOfferSchema.index({ bookingId: 1, providerId: 1 });
providerOfferSchema.index({ bookingId: 1, status: 1 });
providerOfferSchema.index({ status: 1, sentAt: -1 });
providerOfferSchema.index({ status: 1, expiresAt: 1 });

let ProviderOffer;
try {
  const conn = getAdminConn();
  ProviderOffer =
    (conn.models && conn.models.ProviderOffer) ||
    conn.model('ProviderOffer', providerOfferSchema);
  console.log('[ProviderOffer] ✅ Model registered on:', conn?.name || conn?.db?.databaseName || 'default');
} catch (err) {
  console.error('[ProviderOffer] ⚠️ Fallback to default mongoose:', err.message);
  ProviderOffer =
    mongoose.models.ProviderOffer ||
    mongoose.model('ProviderOffer', providerOfferSchema);
}

module.exports = ProviderOffer;