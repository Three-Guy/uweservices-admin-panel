// backend/src/controllers/dispatch.controller.js
// ✅ All dispatch endpoints for admin panel

const mongoose = require('mongoose');
const { getBookingModel } = require('../config/database');
const DispatchJob = require('../models/DispatchJob');
const ProviderOffer = require('../models/ProviderOffer');
const {
  dispatchBooking,
  manualReassign,
  manualAssignProvider,
  clearCooldown,
} = require('../services/dispatchService');
const { findEligibleProviders, debugEligibility } = require('../services/eligibilityService');

// ─── GET /admin/dispatch/stats ───
exports.getStats = async (req, res) => {
  try {
    const Booking = getBookingModel();

    const [
      searching,
      confirmedWaiting,
      noProviderFound,
      failedJobs,
      runningJobs,
    ] = await Promise.all([
      Booking.countDocuments({ status: 'searching', isDeleted: { $ne: true } }),
      Booking.countDocuments({
        status: 'confirmed',
        providerId: { $in: [null, undefined] },
        isDeleted: { $ne: true },
      }),
      Booking.countDocuments({ status: 'no_provider_found', isDeleted: { $ne: true } }),
      DispatchJob.countDocuments({ status: 'failed' }),
      DispatchJob.countDocuments({ status: 'running' }),
    ]);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalOffers, accepted, rejected, timeout] = await Promise.all([
      ProviderOffer.countDocuments({ createdAt: { $gte: since } }),
      ProviderOffer.countDocuments({ createdAt: { $gte: since }, status: 'accepted' }),
      ProviderOffer.countDocuments({ createdAt: { $gte: since }, status: 'rejected' }),
      ProviderOffer.countDocuments({ createdAt: { $gte: since }, status: 'timeout' }),
    ]);

    const acceptanceRate = totalOffers > 0 ? Math.round((accepted / totalOffers) * 100) : 0;

    res.json({
      success: true,
      data: {
        liveState: {
          searching,
          confirmedWaitingDispatch: confirmedWaiting,
          noProviderFound,
          failedJobs,
          runningJobs,
        },
        last24h: {
          totalOffers,
          accepted,
          rejected,
          timeout,
          acceptanceRate,
        },
      },
    });
  } catch (e) {
    console.error('[DispatchController] getStats error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GET /admin/dispatch/active ───
exports.getActiveDispatches = async (req, res) => {
  try {
    const jobs = await DispatchJob.find({
      status: { $in: ['running', 'queued'] },
    })
      .sort({ startedAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, data: { jobs } });
  } catch (e) {
    console.error('[DispatchController] getActiveDispatches error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GET /admin/dispatch/no-provider-found ───
exports.getNoProviderBookings = async (req, res) => {
  try {
    const Booking = getBookingModel();
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      Booking.find({
        status: 'no_provider_found',
        isDeleted: { $ne: true },
      })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments({
        status: 'no_provider_found',
        isDeleted: { $ne: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (e) {
    console.error('[DispatchController] getNoProviderBookings error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GET /admin/dispatch/unassigned ───
// ALL bookings waiting for provider (confirmed + searching + no_provider_found)
exports.getUnassignedBookings = async (req, res) => {
  try {
    const Booking = getBookingModel();
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const filter = {
      status: { $in: ['confirmed', 'searching', 'no_provider_found'] },
      providerId: { $in: [null, undefined] },
      isDeleted: { $ne: true },
    };

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          page, limit, total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (e) {
    console.error('[DispatchController] getUnassignedBookings error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GET /admin/dispatch/eligible-providers/:bookingId ───
exports.getEligibleProviders = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const radiusKm = parseInt(req.query.radiusKm || '12', 10);
    const strict = req.query.strict !== 'false';

    const Booking = getBookingModel();
    const booking = await Booking.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(bookingId) ? new mongoose.Types.ObjectId(bookingId) : null },
        { bookingId: bookingId },
      ],
    }).lean();

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const providers = await findEligibleProviders(booking, { radiusKm, strict, debug: false });

    const bookingLat = booking.latitude ?? booking.customerLocation?.coordinates?.[1];
    const bookingLng = booking.longitude ?? booking.customerLocation?.coordinates?.[0];

    const formatted = providers.map((p) => ({
      _id: String(p._id),
      providerId: p.providerId || String(p._id),
      name: p.name || 'Unknown',
      phone: p.phone || '',
      categoryName: p.categoryName || p.profession || '',
      city: p.city || '',
      distanceKm: p._distanceKm,
      rating: typeof p.rating === 'object' ? (p.rating?.average || 0) : (p.rating || 0),
      completedJobs: p.completedJobs || 0,
      isOnline: !!p.isOnline,
      isAvailable: !!p.isAvailable,
      isAcceptingJobs: !!p.isAcceptingJobs,
      isBusy: !!p.isBusy,
      hasFcmToken: !!p.fcmToken,
    }));

    res.json({ success: true, data: { providers: formatted, count: formatted.length, bookingLat, bookingLng } });
  } catch (e) {
    console.error('[DispatchController] getEligibleProviders error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GET /admin/dispatch/eligible-providers-debug/:bookingId ───
exports.getEligibleProvidersDebug = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const Booking = getBookingModel();
    const booking = await Booking.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(bookingId) ? new mongoose.Types.ObjectId(bookingId) : null },
        { bookingId: bookingId },
      ],
    }).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const debug = await debugEligibility(booking);
    res.json({ success: true, data: debug });
  } catch (e) {
    console.error('[DispatchController] debug error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── POST /admin/dispatch/trigger/:bookingId ───
exports.triggerDispatch = async (req, res) => {
  try {
    const { bookingId } = req.params;
    clearCooldown(bookingId);
    // Fire-and-forget
    setImmediate(() => {
      dispatchBooking(bookingId, { manual: true }).catch((e) => {
        console.error('[Trigger] error:', e.message);
      });
    });
    res.json({ success: true, message: 'Dispatch triggered' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── POST /admin/dispatch/reassign/:bookingId ───
exports.reassignBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body || {};
    const result = await manualReassign(bookingId, reason);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    // Fetch updated booking to return
    const Booking = getBookingModel();
    const booking = await Booking.findOne({ bookingId: result.bookingId }).lean();
    res.json({ success: true, data: { booking }, message: 'Reassignment triggered' });
  } catch (e) {
    console.error('[DispatchController] reassign error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── POST /admin/dispatch/auto-redispatch/:bookingId ───
// Simpler alias for reassign — admin-friendly label
exports.autoRedispatch = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const result = await manualReassign(bookingId, 'Admin auto-redispatch');
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }
    const Booking = getBookingModel();
    const booking = await Booking.findOne({ bookingId: result.bookingId }).lean();
    res.json({ success: true, data: { booking }, message: 'Auto-redispatch triggered' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── POST /admin/dispatch/assign-manual/:bookingId ───
exports.assignProviderManually = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { providerId } = req.body || {};
    if (!providerId) return res.status(400).json({ success: false, message: 'providerId required' });

    const result = await manualAssignProvider(bookingId, providerId);
    if (!result.success) return res.status(400).json({ success: false, message: result.error });

    const Booking = getBookingModel();
    const booking = await Booking.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(bookingId) ? new mongoose.Types.ObjectId(bookingId) : null },
        { bookingId: bookingId },
      ],
    }).lean();

    res.json({ success: true, data: { booking }, message: `Assigned to ${result.provider.name}` });
  } catch (e) {
    console.error('[DispatchController] assignManual error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};