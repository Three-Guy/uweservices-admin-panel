const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  providerId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
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
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'incomplete'],
    default: 'incomplete',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  verifiedAt: Date,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  verificationNotes: String,
  rejectedAt: Date,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  rejectionReason: String,
}, {
  timestamps: true,
});

module.exports = mongoose.model('Provider', providerSchema);