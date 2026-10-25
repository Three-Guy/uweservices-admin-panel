// src/models/ProviderOffer.js
const mongoose = require('mongoose');
const { getBookingConnection } = require('../config/database');

const providerOfferSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, index: true },
    bookingObjectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

    providerId: { type: String, required: true, index: true },
    providerObjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
    providerName: { type: String, default: '' },
    providerPhone: { type: String, default: '' },
    providerCategory: { type: String, default: '' },
    providerCity: { type: String, default: '' },

    // Offer lifecycle
    status: {
      type: String,
      enum: ['sent', 'delivered', 'viewed', 'accepted', 'rejected', 'cancelled', 'timeout', 'failed', 'superseded'],
      default: 'sent',
      index: true,
    },

    // Timings
    offeredAt: { type: Date, default: Date.now, index: true },
    deliveredAt: { type: Date, default: null },
    viewedAt: { type: Date, default: null },
    respondedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },

    // Dispatch metadata
    dispatchCycle: { type: Number, default: 1 },
    batchNumber: { type: Number, default: 1 },
    radiusKm: { type: Number, default: 0 },
    distanceKm: { type: Number, default: 0 },

    // FCM
    fcmSent: { type: Boolean, default: false },
    fcmMessageId: { type: String, default: null },
    fcmError: { type: String, default: null },
    fcmToken: { type: String, default: null },

    // Context
    reason: { type: String, default: null },
    isCurrentOffer: { type: Boolean, default: true, index: true },
    isScheduled: { type: Boolean, default: false },

    // Snapshot of booking at offer time
    bookingSnapshot: {
      serviceName: String,
      totalAmount: Number,
      address: String,
      scheduledDate: String,
      scheduledTime: String,
    },
  },
  { timestamps: true }
);

providerOfferSchema.index({ bookingId: 1, providerId: 1, offeredAt: -1 });
providerOfferSchema.index({ status: 1, offeredAt: -1 });
providerOfferSchema.index({ bookingId: 1, isCurrentOffer: 1 });

let ProviderOfferModel = null;

function getProviderOfferModel() {
  if (ProviderOfferModel) return ProviderOfferModel;
  const conn = getBookingConnection();
  if (!conn) throw new Error('Booking DB connection not ready');
  ProviderOfferModel = conn.models.ProviderOffer || conn.model('ProviderOffer', providerOfferSchema, 'provideroffers');
  return ProviderOfferModel;
}

module.exports = { getProviderOfferModel, providerOfferSchema };