// backend/src/models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // ==================== BOOKING INFO ====================
  bookingId: {
    type: String,
    unique: true,
    required: true,
  },

  // ==================== CUSTOMER INFO ====================
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  customerName: {
    type: String,
    required: true,
    trim: true,
  },
  customerEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  customerPhone: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    required: true,
  },

  // ==================== LOCATION INFO ====================
  customerLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    address: String,
    accuracy: Number,
  },
  latitude: Number,
  longitude: Number,

  // ==================== SERVICE INFO ====================
  serviceName: {
    type: String,
    required: true,
  },
  serviceIcon: {
    type: String,
    default: '🔧',
  },
  servicePrice: {
    type: Number,
    required: true,
  },

  // ==================== SCHEDULE ====================
  scheduledDate: {
    type: String,
    required: true,
  },
  scheduledTime: {
    type: String,
    required: true,
  },

  // ==================== PRICING ====================
  baseAmount: {
    type: Number,
    required: true,
  },
  serviceFee: {
    type: Number,
    default: 0,
  },
  platformFee: {
    type: Number,
    default: 0,
  },
  tax: {
    type: Number,
    default: 0,
  },
  
  // ==================== COUPON ====================
  coupon: {
    code: {
      type: String,
      default: null,
    },
    discount: {
      type: Number,
      default: 0,
    },
    couponRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null,
    },
  },

  subtotal: {
    type: Number,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },

  // ==================== PAYMENT ====================
  paymentMethod: {
    type: String,
    enum: ['pay-after', 'google-pay', 'phonepe', 'upi', 'card', 'wallet'],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  },
  transactionId: {
    type: String,
    default: null,
  },

  // ==================== STATUS ====================
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
  },

  // ==================== PROVIDER ====================
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    default: null,
  },

  // ==================== ADDITIONAL ====================
  specialRequirements: {
    type: String,
    default: '',
  },
  cancellationReason: {
    type: String,
    default: null,
  },
  cancelledAt: {
    type: Date,
    default: null,
  },

  // ==================== METADATA ====================
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ==================== INDEXES ====================
bookingSchema.index({ bookingId: 1 }, { unique: true });
bookingSchema.index({ user: 1 });
bookingSchema.index({ provider: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ scheduledDate: 1 });
bookingSchema.index({ customerLocation: '2dsphere' });

// ==================== PRE-SAVE HOOK ====================
bookingSchema.pre('save', function(next) {
  if (this.isNew && !this.bookingId) {
    this.bookingId = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

// ==================== EXPORT ====================
module.exports = bookingSchema;