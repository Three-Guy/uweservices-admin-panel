// backend/src/models/Booking.js
// ✅ Defensive model loader — works with ANY connection export pattern
const mongoose = require('mongoose');

/* ─── Try every possible way to get the bookings connection ─── */
function getBookingsConnection() {
  const sources = [];
  try { sources.push(require('../config/database')); } catch (_) {}
  try { sources.push(require('../config/multiDb')); } catch (_) {}

  for (const src of sources) {
    if (!src) continue;

    // Try function-style getters
    const fnNames = [
      'getBookingsConnection',
      'getBookingConnection',
      'getBookingsDb',
      'getBookingsDB',
      'getBookingDb',
    ];
    for (const fn of fnNames) {
      if (typeof src[fn] === 'function') {
        try {
          const c = src[fn]();
          if (c && typeof c.model === 'function') {
            return c;
          }
        } catch (_) {}
      }
    }

    // Try property-style
    const propNames = [
      'bookingsConnection',
      'bookingsDb',
      'bookingsDB',
      'bookings',
      'bookingConnection',
      'bookingDb',
    ];
    for (const p of propNames) {
      if (src[p] && typeof src[p].model === 'function') {
        return src[p];
      }
    }
  }

  console.warn('[Booking] ⚠️ No dedicated bookings connection found, using default mongoose');
  return mongoose;
}

/* ─── Schema (flexible, all fields optional) ─── */
const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, index: true },
    bookingType: String,
    status: { type: String, index: true },
    customerName: String,
    customerPhone: String,
    customerEmail: String,
    userId: mongoose.Schema.Types.Mixed,

    serviceId: mongoose.Schema.Types.Mixed,
    serviceName: String,
    subserviceId: mongoose.Schema.Types.Mixed,
    subserviceName: String,
    categoryId: mongoose.Schema.Types.Mixed,
    categoryName: String,

    providerId: { type: mongoose.Schema.Types.Mixed, default: null, index: true },
    providerName: String,

    city: mongoose.Schema.Types.Mixed,
    cityId: mongoose.Schema.Types.Mixed,
    cityName: String,
    address: String,
    latitude: Number,
    longitude: Number,

    amount: Number,
    totalAmount: Number,
    scheduledDate: Date,
    scheduledTime: String,
    scheduledDateTime: Date,

    isDeleted: { type: Boolean, default: false },
  },
  {
    collection: 'bookings',
    strict: false,
    timestamps: true,
  }
);

/* ─── Build model on correct connection ─── */
const conn = getBookingsConnection();

let Booking;
try {
  Booking = conn.model('Booking');
} catch (_) {
  Booking = conn.model('Booking', bookingSchema);
}

console.log(
  `[Booking] ✅ Model ready — connection: ${conn.name || 'default'}, find: ${typeof Booking.find}, count: ${typeof Booking.countDocuments}`
);

/* ─── Helper getter (backward compat) ─── */
function getBookingModel() {
  return Booking;
}

/* ─── Multi-shape export (so EVERY import style works) ─── */
module.exports = Booking;
module.exports.Booking = Booking;
module.exports.default = Booking;
module.exports.getBookingModel = getBookingModel;