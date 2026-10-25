// src/models/DispatchJob.js
const mongoose = require('mongoose');
const { getBookingConnection } = require('../config/database');

const dispatchJobSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, index: true },
    bookingObjectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'no_provider_found', 'cancelled'],
      default: 'queued',
      index: true,
    },

    cycle: { type: Number, default: 1 },
    batchNumber: { type: Number, default: 0 },
    currentRadiusKm: { type: Number, default: 0 },

    totalProvidersConsidered: { type: Number, default: 0 },
    totalOffersSent: { type: Number, default: 0 },
    totalRejections: { type: Number, default: 0 },
    totalTimeouts: { type: Number, default: 0 },

    triedProviderIds: { type: [String], default: [] },

    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    nextRunAt: { type: Date, default: null },
    lastError: { type: String, default: null },

    isScheduled: { type: Boolean, default: false },
    scheduledFor: { type: Date, default: null },

    assignedProviderId: { type: String, default: null },

    source: { type: String, default: 'admin-backend' },
  },
  { timestamps: true }
);

dispatchJobSchema.index({ status: 1, nextRunAt: 1 });
dispatchJobSchema.index({ bookingId: 1, status: 1 });

let DispatchJobModel = null;

function getDispatchJobModel() {
  if (DispatchJobModel) return DispatchJobModel;
  const conn = getBookingConnection();
  if (!conn) throw new Error('Booking DB connection not ready');
  DispatchJobModel = conn.models.DispatchJob || conn.model('DispatchJob', dispatchJobSchema, 'dispatchjobs');
  return DispatchJobModel;
}

module.exports = { getDispatchJobModel, dispatchJobSchema };