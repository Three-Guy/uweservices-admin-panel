const mongoose = require('mongoose');
const { getProviderConnection } = require('../config/database');

const providerSchema = new mongoose.Schema(
  {
    providerId: {
      type: String,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
    },
    profession: {
      type: String,
      required: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    businessName: {
      type: String,
    },
    profilePicture: {
      type: String,
    },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    services: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
      },
    ],
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'not_submitted'],
      default: 'not_submitted',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    rating: {
      average: {
        type: Number,
        default: 0,
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    completedJobs: {
      type: Number,
      default: 0,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: Date,
  },
  {
    timestamps: true,
    collection: 'providers', // Explicit collection name
  }
);

// Indexes
providerSchema.index({ providerId: 1 });
providerSchema.index({ verificationStatus: 1 });
providerSchema.index({ createdAt: -1 });

// Use provider connection
let Provider;
try {
  const connection = getProviderConnection();
  Provider = connection ? connection.model('Provider', providerSchema) : mongoose.model('Provider', providerSchema);
} catch (error) {
  Provider = mongoose.model('Provider', providerSchema);
}

module.exports = Provider;