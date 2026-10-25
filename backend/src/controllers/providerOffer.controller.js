// src/controllers/providerOffer.controller.js
const { getProviderOfferModel } = require('../models/ProviderOffer');
const logger = require('../utils/logger');

exports.getOffersByBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const Offer = getProviderOfferModel();
    const offers = await Offer.find({ bookingId })
      .sort({ offeredAt: -1 })
      .lean();
    res.json({ success: true, data: { offers, count: offers.length } });
  } catch (err) {
    logger.error(`getOffersByBooking: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOffersByProvider = async (req, res) => {
  try {
    const { providerId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const Offer = getProviderOfferModel();
    const [offers, total] = await Promise.all([
      Offer.find({ providerId }).sort({ offeredAt: -1 }).skip(skip).limit(limit).lean(),
      Offer.countDocuments({ providerId }),
    ]);
    res.json({
      success: true,
      data: {
        offers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: skip + offers.length < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getProviderPerformance = async (req, res) => {
  try {
    const { providerId } = req.params;
    const Offer = getProviderOfferModel();
    const since = new Date(Date.now() - 30 * 86400000); // last 30 days
    const [total, accepted, rejected, timeout, failed] = await Promise.all([
      Offer.countDocuments({ providerId, offeredAt: { $gte: since } }),
      Offer.countDocuments({ providerId, status: 'accepted', offeredAt: { $gte: since } }),
      Offer.countDocuments({ providerId, status: 'rejected', offeredAt: { $gte: since } }),
      Offer.countDocuments({ providerId, status: 'timeout', offeredAt: { $gte: since } }),
      Offer.countDocuments({ providerId, status: 'failed', offeredAt: { $gte: since } }),
    ]);
    res.json({
      success: true,
      data: {
        providerId,
        last30Days: {
          totalOffers: total,
          accepted,
          rejected,
          timeout,
          failed,
          acceptanceRate: total > 0 ? Number(((accepted / total) * 100).toFixed(2)) : 0,
          rejectionRate: total > 0 ? Number(((rejected / total) * 100).toFixed(2)) : 0,
          timeoutRate: total > 0 ? Number(((timeout / total) * 100).toFixed(2)) : 0,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllOffers = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const { status, bookingId, providerId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (bookingId) filter.bookingId = bookingId;
    if (providerId) filter.providerId = providerId;
    const Offer = getProviderOfferModel();
    const [offers, total] = await Promise.all([
      Offer.find(filter).sort({ offeredAt: -1 }).skip(skip).limit(limit).lean(),
      Offer.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: {
        offers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: skip + offers.length < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};