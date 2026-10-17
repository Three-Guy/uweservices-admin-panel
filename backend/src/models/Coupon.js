// backend/src/models/Coupon.js
const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  // ==================== BASIC INFO ====================
  code: {
    type: String,
    required: [true, 'Coupon code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [3, 'Coupon code must be at least 3 characters'],
    maxlength: [20, 'Coupon code cannot exceed 20 characters'],
    match: [/^[A-Z0-9_-]+$/, 'Coupon code can only contain letters, numbers, hyphens, and underscores'],
  },
  name: {
    type: String,
    required: [true, 'Coupon name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: '',
  },

  // ==================== DISCOUNT TYPE ====================
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: [true, 'Discount type is required'],
  },
  discountValue: {
    type: Number,
    required: [true, 'Discount value is required'],
    min: [0, 'Discount value cannot be negative'],
  },

  // ==================== DISCOUNT LIMITS ====================
  // For percentage discounts
  maxDiscountAmount: {
    type: Number,
    default: null, // null = no limit
    min: [0, 'Max discount amount cannot be negative'],
  },
  // Minimum order value to apply coupon
  minOrderValue: {
    type: Number,
    default: 0,
    min: [0, 'Minimum order value cannot be negative'],
  },

  // ==================== VALIDITY ====================
  validFrom: {
    type: Date,
    required: [true, 'Valid from date is required'],
    default: Date.now,
  },
  validUntil: {
    type: Date,
    required: [true, 'Valid until date is required'],
  },

  // ==================== USAGE LIMITS ====================
  usageLimit: {
    totalUses: {
      type: Number,
      default: null, // null = unlimited
      min: [0, 'Total uses cannot be negative'],
    },
    perUser: {
      type: Number,
      default: 1,
      min: [1, 'Per user limit must be at least 1'],
    },
  },
  currentUsageCount: {
    type: Number,
    default: 0,
  },
  usedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    usedAt: {
      type: Date,
      default: Date.now,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    discountApplied: {
      type: Number,
    },
  }],

  // ==================== TARGETING ====================
  applicableFor: {
    type: String,
    enum: ['all', 'new_users', 'specific_users', 'first_booking'],
    default: 'all',
  },
  specificUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  
  // Service/Category targeting
  applicableServices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
  }],
  applicableCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  }],

  // ==================== STATUS ====================
  isActive: {
    type: Boolean,
    default: true,
  },
  isAutoApply: {
    type: Boolean,
    default: false, // If true, auto-apply when conditions met
  },

  // ==================== METADATA ====================
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ==================== INDEXES ====================
couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ isActive: 1 });
couponSchema.index({ validFrom: 1, validUntil: 1 });
couponSchema.index({ 'usedBy.user': 1 });

// ==================== VIRTUALS ====================
couponSchema.virtual('isExpired').get(function() {
  return new Date() > this.validUntil;
});

couponSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.isActive && now >= this.validFrom && now <= this.validUntil;
});

couponSchema.virtual('remainingUses').get(function() {
  if (!this.usageLimit.totalUses) return Infinity;
  return Math.max(0, this.usageLimit.totalUses - this.currentUsageCount);
});

// ==================== METHODS ====================
couponSchema.methods.canBeUsedBy = function(userId) {
  // Check if coupon is valid
  if (!this.isValid) return { valid: false, reason: 'Coupon is expired or inactive' };

  // Check total usage limit
  if (this.usageLimit.totalUses && this.currentUsageCount >= this.usageLimit.totalUses) {
    return { valid: false, reason: 'Coupon usage limit reached' };
  }

  // Check user-specific usage
  const userUsage = this.usedBy.filter(u => u.user.toString() === userId.toString()).length;
  if (userUsage >= this.usageLimit.perUser) {
    return { valid: false, reason: 'You have already used this coupon maximum times' };
  }

  // Check applicability
  if (this.applicableFor === 'specific_users' && !this.specificUsers.includes(userId)) {
    return { valid: false, reason: 'This coupon is not applicable for your account' };
  }

  return { valid: true };
};

couponSchema.methods.calculateDiscount = function(orderAmount) {
  if (orderAmount < this.minOrderValue) {
    return {
      applicable: false,
      reason: `Minimum order value of ₹${this.minOrderValue} required`,
      discount: 0,
    };
  }

  let discount = 0;
  
  if (this.discountType === 'percentage') {
    discount = (orderAmount * this.discountValue) / 100;
    if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
      discount = this.maxDiscountAmount;
    }
  } else {
    discount = this.discountValue;
  }

  // Ensure discount doesn't exceed order amount
  discount = Math.min(discount, orderAmount);

  return {
    applicable: true,
    discount: Math.round(discount * 100) / 100,
    finalAmount: Math.round((orderAmount - discount) * 100) / 100,
  };
};

couponSchema.methods.markAsUsed = async function(userId, orderId, discountApplied) {
  this.usedBy.push({
    user: userId,
    usedAt: new Date(),
    orderId: orderId,
    discountApplied: discountApplied,
  });
  this.currentUsageCount += 1;
  await this.save();
};

// ==================== STATICS ====================
couponSchema.statics.validateCoupon = async function(code, userId, orderAmount) {
  const coupon = await this.findOne({ 
    code: code.toUpperCase(), 
    isActive: true 
  });

  if (!coupon) {
    return { valid: false, message: 'Invalid coupon code' };
  }

  const canUse = coupon.canBeUsedBy(userId);
  if (!canUse.valid) {
    return { valid: false, message: canUse.reason };
  }

  const discountInfo = coupon.calculateDiscount(orderAmount);
  if (!discountInfo.applicable) {
    return { valid: false, message: discountInfo.reason };
  }

  return {
    valid: true,
    coupon: coupon,
    discount: discountInfo.discount,
    finalAmount: discountInfo.finalAmount,
  };
};

// ==================== PRE-SAVE HOOK ====================
couponSchema.pre('save', function(next) {
  // Auto-uppercase code
  if (this.code) {
    this.code = this.code.toUpperCase().trim();
  }

  // Validate dates
  if (this.validFrom && this.validUntil && this.validFrom >= this.validUntil) {
    return next(new Error('Valid until date must be after valid from date'));
  }

  // Validate percentage
  if (this.discountType === 'percentage' && this.discountValue > 100) {
    return next(new Error('Percentage discount cannot exceed 100%'));
  }

  next();
});

// ==================== EXPORT ====================
module.exports = couponSchema;