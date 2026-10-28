const mongoose = require('mongoose');
const { getProviderConnection } = require('../config/database');

const verificationSchema = new mongoose.Schema(
  {
    verificationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      index: true,
    },
    documents: {
      selfie: {
        type: String,
        required: true,
      },
      panCard: {
        type: String,
        required: true,
      },
      aadhaarFront: {
        type: String,
        required: true,
      },
      aadhaarBack: {
        type: String,
        required: true,
      },
    },
    cloudinaryIds: {
      selfie: String,
      panCard: String,
      aadhaarFront: String,
      aadhaarBack: String,
    },
    // Optional document numbers (future feature)
    documentNumbers: {
      panNumber: { type: String, default: '' },
      aadhaarNumber: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected', 'resubmission_required'],
      default: 'pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    // History of status changes (audit)
    statusHistory: [
      {
        status: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
        changedByName: String,
        reason: String,
        notes: String,
        changedAt: { type: Date, default: Date.now },
      },
    ],
    // Resubmission tracking
    attempts: {
      type: Number,
      default: 1,
    },
    previousVerifications: [
      {
        verificationId: String,
        status: String,
        rejectionReason: String,
        submittedAt: Date,
        reviewedAt: Date,
      },
    ],
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'provider_verifications',
  }
);

// Compound indexes for performance
verificationSchema.index({ provider: 1, status: 1 });
verificationSchema.index({ status: 1, submittedAt: -1 });
verificationSchema.index({ createdAt: -1 });
verificationSchema.index({ verificationId: 1 }, { unique: true });

let Verification;
try {
  const connection = getProviderConnection();
  Verification = connection
    ? connection.model('Verification', verificationSchema)
    : mongoose.model('Verification', verificationSchema);
} catch (error) {
  Verification = mongoose.model('Verification', verificationSchema);
}

module.exports = Verification;