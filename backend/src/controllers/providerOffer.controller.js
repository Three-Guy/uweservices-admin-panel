// backend/src/controllers/providerOffer.controller.js
const logger = require('../utils/logger');

// ── Safe model loading ──
let getProviderOfferModel = null;
try {
  const offerModule = require('../models/ProviderOffer');
  getProviderOfferModel = offerModule.getProviderOfferModel;
  if (typeof getProviderOfferModel !== 'function') {
    // Direct model export fallback
    const DirectModel = offerModule;
    getProviderOfferModel = () => DirectModel;
  }
} catch (err) {
  logger.error('ProviderOffer model not available: ' + err.message);
  getProviderOfferModel = () => null;
}

/**
 * Helper to get the model safely
 */
function getModel() {
  try {
    const Model = getProviderOfferModel();
    if (!Model) {
      throw new Error('ProviderOffer model not initialized');
    }
    return Model;
  } catch (err) {
    logger.error('Failed to get ProviderOffer model: ' + err.message);
    return null;
  }
}

/**
 * GET /api/v1/admin/provider-offers/booking/:bookingId
 * Get all offers sent for a specific booking
 */
exports.getOffersByBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const Offer = getModel();

    if (!Offer) {
      return res.status(503).json({
        success: false,
        message: 'ProviderOffer model not available',
      });
    }

    const offers = await Offer.find({ bookingId })
      .sort({ offeredAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: {
        offers,
        count: offers.length,
      },
    });
  } catch (err) {
    logger.error(`getOffersByBooking: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * GET /api/v1/admin/provider-offers/provider/:providerId
 * Get all offers sent to a specific provider (paginated)
 */
exports.getOffersByProvider = async (req, res) => {
  try {
    const { providerId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const Offer = getModel();
    if (!Offer) {
      return res.status(503).json({
        success: false,
        message: 'ProviderOffer model not available',
      });
    }

    const [offers, total] = await Promise.all([
      Offer.find({ providerId })
        .sort({ offeredAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Offer.countDocuments({ providerId }),
    ]);

    return res.json({
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
    logger.error(`getOffersByProvider: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * GET /api/v1/admin/provider-offers/provider/:providerId/performance
 * Get provider performance stats (last 30 days)
 */
exports.getProviderPerformance = async (req, res) => {
  try {
    const { providerId } = req.params;
    const Offer = getModel();

    if (!Offer) {
      return res.status(503).json({
        success: false,
        message: 'ProviderOffer model not available',
      });
    }

    const since = new Date(Date.now() - 30 * 86400000); // last 30 days

    const [total, accepted, rejected, timeout, failed] = await Promise.all([
      Offer.countDocuments({ providerId, offeredAt: { $gte: since } }),
      Offer.countDocuments({ providerId, status: 'accepted', offeredAt: { $gte: since } }),
      Offer.countDocuments({ providerId, status: 'rejected', offeredAt: { $gte: since } }),
      Offer.countDocuments({ providerId, status: 'timeout', offeredAt: { $gte: since } }),
      Offer.countDocuments({ providerId, status: 'failed', offeredAt: { $gte: since } }),
    ]);

    return res.json({
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
    logger.error(`getProviderPerformance: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * GET /api/v1/admin/provider-offers
 * Get ALL offers (paginated, with filters)
 * Query: ?status=pending&bookingId=xxx&providerId=yyy&page=1&limit=20
 */
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

    const Offer = getModel();
    if (!Offer) {
      return res.status(503).json({
        success: false,
        message: 'ProviderOffer model not available',
      });
    }

    const [offers, total] = await Promise.all([
      Offer.find(filter)
        .sort({ offeredAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Offer.countDocuments(filter),
    ]);

    return res.json({
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
    logger.error(`getAllOffers: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};