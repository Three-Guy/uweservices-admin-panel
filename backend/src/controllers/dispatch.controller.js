// src/controllers/dispatch.controller.js
const { getBookingModel } = require('../config/database');
const { getDispatchJobModel } = require('../models/DispatchJob');
const { getProviderOfferModel } = require('../models/ProviderOffer');
const { dispatchBooking, manualReassign } = require('../services/dispatchService');
const { findEligibleProviders } = require('../services/eligibilityService');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

exports.getDispatchStats = async (req, res) => {
  try {
    const Booking = getBookingModel();
    const DispatchJob = getDispatchJobModel();
    const Offer = getProviderOfferModel();

    const [
      searching,
      noProvider,
      confirmedNoProvider,
      failed,
      runningJobs,
      totalOffers24h,
      acceptedOffers24h,
      rejectedOffers24h,
      timeoutOffers24h,
    ] = await Promise.all([
      Booking.countDocuments({ status: 'searching', isDeleted: { $ne: true } }),
      Booking.countDocuments({ status: 'no_provider_found', isDeleted: { $ne: true } }),
      Booking.countDocuments({
        status: { $in: ['confirmed', 'pending'] },
        $or: [{ providerId: null }, { providerId: { $exists: false } }, { providerId: '' }],
        isDeleted: { $ne: true },
      }),
      DispatchJob.countDocuments({ status: 'failed' }),
      DispatchJob.countDocuments({ status: 'running' }),
      Offer.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86400000) } }),
      Offer.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 86400000) },
        status: 'accepted',
      }),
      Offer.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 86400000) },
        status: 'rejected',
      }),
      Offer.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 86400000) },
        status: 'timeout',
      }),
    ]);

    res.json({
      success: true,
      data: {
        liveState: {
          searching,
          confirmedWaitingDispatch: confirmedNoProvider,
          noProviderFound: noProvider,
          failedJobs: failed,
          runningJobs,
        },
        last24h: {
          totalOffers: totalOffers24h,
          accepted: acceptedOffers24h,
          rejected: rejectedOffers24h,
          timeout: timeoutOffers24h,
          acceptanceRate:
            totalOffers24h > 0
              ? Number(((acceptedOffers24h / totalOffers24h) * 100).toFixed(2))
              : 0,
        },
      },
    });
  } catch (err) {
    logger.error(`getDispatchStats: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getActiveDispatches = async (req, res) => {
  try {
    const DispatchJob = getDispatchJobModel();
    const jobs = await DispatchJob.find({ status: { $in: ['queued', 'running'] } })
      .sort({ startedAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data: { jobs } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNoProviderBookings = async (req, res) => {
  try {
    const Booking = getBookingModel();
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      Booking.find({ status: 'no_provider_found', isDeleted: { $ne: true } })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments({ status: 'no_provider_found', isDeleted: { $ne: true } }),
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
          hasNext: skip + bookings.length < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.triggerDispatch = async (req, res) => {
  try {
    const { id } = req.params;
    const Booking = getBookingModel();
    let booking;
    if (mongoose.Types.ObjectId.isValid(id)) {
      booking = await Booking.findById(id);
    }
    if (!booking) booking = await Booking.findOne({ bookingId: id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    dispatchBooking(booking.toObject ? booking.toObject() : booking).catch((e) =>
      logger.error(`Trigger dispatch error: ${e.message}`)
    );

    res.json({
      success: true,
      message: 'Dispatch triggered',
      data: { bookingId: booking.bookingId || String(booking._id) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.reassignBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const actorEmail = req.admin?.email || req.user?.email || 'admin';

    const booking = await manualReassign(id, { reason, actorEmail });
    res.json({
      success: true,
      message: 'Reassignment triggered',
      data: { booking },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEligibleProviders = async (req, res) => {
  try {
    const { id } = req.params;
    const radiusKm = Number(req.query.radiusKm) || 12;
    const Booking = getBookingModel();
    let booking;
    if (mongoose.Types.ObjectId.isValid(id)) booking = await Booking.findById(id).lean();
    if (!booking) booking = await Booking.findOne({ bookingId: id }).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const providers = await findEligibleProviders({ booking, radiusKm, limit: 50 });
    // Sanitize
    const sanitized = providers.map((p) => ({
      _id: p._id,
      providerId: p.providerId,
      name: p.name,
      phone: p.phone,
      categoryName: p.categoryName || p.profession,
      city: p.city,
      distanceKm: p._distanceKm,
      rating: p.rating?.average || 0,
      completedJobs: p.completedJobs || 0,
      isOnline: p.isOnline,
      isAvailable: p.isAvailable,
      hasFcmToken: !!p.fcmToken,
    }));
    res.json({ success: true, data: { providers: sanitized, count: sanitized.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.assignProviderManually = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerId } = req.body;
    if (!providerId) return res.status(400).json({ success: false, message: 'providerId required' });

    const Booking = getBookingModel();
    const { getProviderConnection } = require('../config/database');
    const providersCol = getProviderConnection().collection('providers');

    const providerFilter = { $or: [{ providerId: String(providerId) }] };
    if (mongoose.Types.ObjectId.isValid(providerId)) {
      providerFilter.$or.push({ _id: new mongoose.Types.ObjectId(String(providerId)) });
    }
    const provider = await providersCol.findOne(providerFilter);
    if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

    let booking;
    if (mongoose.Types.ObjectId.isValid(id)) booking = await Booking.findById(id);
    if (!booking) booking = await Booking.findOne({ bookingId: id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const actorEmail = req.admin?.email || req.user?.email || 'admin';
    booking.providerId = String(provider.providerId || provider._id);
    booking.providerName = provider.name;
    booking.providerPhone = provider.phone;
    booking.status = 'assigned';
    booking.assignedAt = new Date();
    booking.assignmentMethod = 'admin-manual';
    booking.statusHistory = booking.statusHistory || [];
    booking.statusHistory.push({
      status: 'assigned',
      changedAt: new Date(),
      changedBy: actorEmail,
      reason: 'Manual admin assignment',
    });
    await booking.save();

    res.json({ success: true, message: 'Provider assigned manually', data: { booking } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};