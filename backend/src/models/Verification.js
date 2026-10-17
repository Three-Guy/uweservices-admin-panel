const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  verificationId: {
    type: String,
    required: true,
    unique: true,
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: true,
  },
  documents: {
    selfie: {
      url: String,
      publicId: String,
      uploadedAt: Date,
    },
    aadhaarCard: {
      url: String,
      publicId: String,
      uploadedAt: Date,
    },
    panCard: {
      url: String,
      publicId: String,
      uploadedAt: Date,
    },
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  reviewedAt: {
    type: Date,
  },
  rejectionReason: {
    type: String,
  },
  notes: {
    type: String,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Verification', verificationSchema);