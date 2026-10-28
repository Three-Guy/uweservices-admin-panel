const mongoose = require('mongoose');
const { getProviderConnection } = require('../config/database');

const providerVerificationSchema = new mongoose.Schema(
  {
    verificationId: {
      type: String,
      index: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      index: true,
    },
    documents: {
      selfie: { type: String, required: true },
      panCard: { type: String, required: true },
      aadhaarFront: { type: String, required: true },
      aadhaarBack: { type: String, required: true },
    },
    cloudinaryIds: {
      selfie: String,
      panCard: String,
      aadhaarFront: String,
      aadhaarBack: String,
    },
    documentNumbers: {
      panNumber: String,
      aadhaarNumber: String,
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
    statusHistory: [
      {
        status: String,
        changedBy: mongoose.Schema.Types.ObjectId,
        changedByName: String,
        reason: String,
        notes: String,
        changedAt: Date,
      },
    ],
    attempts: { type: Number, default: 1 },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: Date,
  },
  {
    timestamps: true,
    collection: 'provider_verifications',
  }
);

providerVerificationSchema.index({ provider: 1, status: 1 });
providerVerificationSchema.index({ status: 1, submittedAt: -1 });
providerVerificationSchema.index({ createdAt: -1 });

let ProviderVerification;
try {
  const connection = getProviderConnection();
  ProviderVerification = connection
    ? connection.model('ProviderVerification', providerVerificationSchema)
    : mongoose.model('ProviderVerification', providerVerificationSchema);
} catch (error) {
  ProviderVerification = mongoose.model('ProviderVerification', providerVerificationSchema);
}

module.exports = ProviderVerification;