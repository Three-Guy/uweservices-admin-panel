const mongoose = require('mongoose');
const { getProviderConnection } = require('../config/database');

const providerVerificationSchema = new mongoose.Schema(
  {
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
      aadhaarCard: {
        type: String,
        required: true,
      },
    },
    cloudinaryIds: {
      selfie: String,
      panCard: String,
      aadhaarCard: String,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
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

// Indexes
providerVerificationSchema.index({ provider: 1, status: 1 });
providerVerificationSchema.index({ status: 1, submittedAt: -1 });
providerVerificationSchema.index({ createdAt: -1 });

// Use provider connection
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