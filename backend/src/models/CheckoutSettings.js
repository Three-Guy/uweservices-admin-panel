// backend/src/models/CheckoutSettings.js
const mongoose = require('mongoose');

const checkoutSettingsSchema = new mongoose.Schema({
  // ==================== FEES ====================
  serviceFee: {
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed',
    },
    value: {
      type: Number,
      default: 2,
      min: [0, 'Service fee cannot be negative'],
    },
    maxAmount: {
      type: Number,
      default: null, // For percentage type
    },
  },

  platformFee: {
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed',
    },
    value: {
      type: Number,
      default: 0,
      min: [0, 'Platform fee cannot be negative'],
    },
    maxAmount: {
      type: Number,
      default: null,
    },
  },

  tax: {
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'percentage',
    },
    value: {
      type: Number,
      default: 18, // 18% GST
      min: [0, 'Tax cannot be negative'],
    },
    name: {
      type: String,
      default: 'GST',
    },
  },

  // ==================== PAYMENT METHODS ====================
  paymentMethods: {
    // Pay After Service
    payAfterService: {
      enabled: { type: Boolean, default: true },
      label: { type: String, default: 'Pay After Service' },
      description: { type: String, default: 'Cash or QR on completion' },
      icon: { type: String, default: 'clock' },
      sortOrder: { type: Number, default: 1 },
    },
    
    // Google Pay
    googlePay: {
      enabled: { type: Boolean, default: true },
      label: { type: String, default: 'Google Pay' },
      description: { type: String, default: 'Fast & secure UPI' },
      icon: { type: String, default: 'gpay' },
      sortOrder: { type: Number, default: 2 },
    },
    
    // PhonePe
    phonePe: {
      enabled: { type: Boolean, default: true },
      label: { type: String, default: 'PhonePe' },
      description: { type: String, default: 'UPI payment' },
      icon: { type: String, default: 'phonepe' },
      sortOrder: { type: Number, default: 3 },
    },
    
    // Paytm
    paytm: {
      enabled: { type: Boolean, default: true },
      label: { type: String, default: 'Paytm' },
      description: { type: String, default: 'Paytm UPI & Wallet' },
      icon: { type: String, default: 'paytm' },
      sortOrder: { type: Number, default: 4 },
    },
    
    // Amazon Pay
    amazonPay: {
      enabled: { type: Boolean, default: false },
      label: { type: String, default: 'Amazon Pay' },
      description: { type: String, default: 'Pay with Amazon' },
      icon: { type: String, default: 'amazon' },
      sortOrder: { type: Number, default: 5 },
    },
    
    // Credit/Debit Card
    card: {
      enabled: { type: Boolean, default: true },
      label: { type: String, default: 'Credit/Debit Card' },
      description: { type: String, default: 'Visa, Mastercard, RuPay' },
      icon: { type: String, default: 'card' },
      sortOrder: { type: Number, default: 6 },
    },
    
    // Net Banking
    netBanking: {
      enabled: { type: Boolean, default: true },
      label: { type: String, default: 'Net Banking' },
      description: { type: String, default: 'All major banks supported' },
      icon: { type: String, default: 'bank' },
      sortOrder: { type: Number, default: 7 },
    },
    
    // Wallet
    wallet: {
      enabled: { type: Boolean, default: false },
      label: { type: String, default: 'App Wallet' },
      description: { type: String, default: 'Pay using wallet balance' },
      icon: { type: String, default: 'wallet' },
      sortOrder: { type: Number, default: 8 },
    },
    
    // Cash on Delivery
    cashOnDelivery: {
      enabled: { type: Boolean, default: true },
      label: { type: String, default: 'Cash on Delivery' },
      description: { type: String, default: 'Pay cash when service is delivered' },
      icon: { type: String, default: 'cash' },
      sortOrder: { type: Number, default: 9 },
    },
    
    // Add New UPI
    newUpi: {
      enabled: { type: Boolean, default: true },
      label: { type: String, default: 'Add New UPI' },
      description: { type: String, default: 'Link another UPI ID' },
      icon: { type: String, default: 'plus' },
      sortOrder: { type: Number, default: 10 },
    },
  },

  // ==================== DISCOUNT SETTINGS ====================
  defaultDiscount: {
    enabled: {
      type: Boolean,
      default: false,
    },
    percentage: {
      type: Number,
      default: 15,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
    },
  },

  // ==================== GENERAL SETTINGS ====================
  currency: {
    type: String,
    default: 'INR',
    enum: ['USD', 'INR', 'EUR', 'GBP'],
  },
  currencySymbol: {
    type: String,
    default: '₹',
  },

  // Minimum order value
  minOrderValue: {
    type: Number,
    default: 0,
    min: [0, 'Minimum order value cannot be negative'],
  },

  // ==================== METADATA ====================
  isActive: {
    type: Boolean,
    default: true,
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

// ==================== METHODS ====================
checkoutSettingsSchema.methods.calculateFees = function(basePrice) {
  let serviceFee = 0;
  let platformFee = 0;
  let tax = 0;

  // Calculate service fee
  if (this.serviceFee.type === 'fixed') {
    serviceFee = this.serviceFee.value;
  } else {
    serviceFee = (basePrice * this.serviceFee.value) / 100;
    if (this.serviceFee.maxAmount && serviceFee > this.serviceFee.maxAmount) {
      serviceFee = this.serviceFee.maxAmount;
    }
  }

  // Calculate platform fee
  if (this.platformFee.type === 'fixed') {
    platformFee = this.platformFee.value;
  } else {
    platformFee = (basePrice * this.platformFee.value) / 100;
    if (this.platformFee.maxAmount && platformFee > this.platformFee.maxAmount) {
      platformFee = this.platformFee.maxAmount;
    }
  }

  // Calculate tax
  const subtotal = basePrice + serviceFee + platformFee;
  if (this.tax.type === 'fixed') {
    tax = this.tax.value;
  } else {
    tax = (subtotal * this.tax.value) / 100;
  }

  const total = subtotal + tax;

  return {
    basePrice: Math.round(basePrice * 100) / 100,
    serviceFee: Math.round(serviceFee * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
};

// ==================== STATICS ====================
checkoutSettingsSchema.statics.getActiveSettings = async function() {
  let settings = await this.findOne({ isActive: true });
  
  // Create default if doesn't exist
  if (!settings) {
    settings = await this.create({
      isActive: true,
    });
  }
  
  return settings;
};

// ==================== EXPORT ====================
module.exports = checkoutSettingsSchema;