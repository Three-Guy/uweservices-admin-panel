// backend/src/controllers/tracking.controller.js
// ✅ NEW FILE — Live Tracking & Heatmap Controller
// Reads from tracking_db (customer devices + leads) and trackingprovider_db (provider devices)
// All timestamps in these DBs are stored as Double (epoch ms)

const {
  getTrackingDeviceModel,
  getTrackingLeadModel,
  getTrackingProviderDeviceModel,
  getTrackingConnection,
  getTrackingProviderConnection,
} = require('../config/database');

// ─── Constants ────────────────────────────────────────────────────────────────
const ACTIVE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes in milliseconds
const MAX_HEATMAP_POINTS = 5000;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Mask FCM token for security — show first 6 + last 4 chars
 */
const maskFcmToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  if (token.length <= 10) return '****';
  return token.substring(0, 6) + '****' + token.substring(token.length - 4);
};

/**
 * Check if a device is currently active (lastSeenAt within 15 min)
 * lastSeenAt is stored as Double epoch ms
 */
const isDeviceActive = (lastSeenAt) => {
  if (!lastSeenAt) return false;
  const lastSeen = typeof lastSeenAt === 'number' ? lastSeenAt : Number(lastSeenAt);
  if (isNaN(lastSeen)) return false;
  return (Date.now() - lastSeen) <= ACTIVE_THRESHOLD_MS;
};

/**
 * Safely get a Mongoose model — returns null if DB not connected
 */
const safeGetModel = (getterFn) => {
  try {
    return getterFn();
  } catch (e) {
    return null;
  }
};

/**
 * Build a MongoDB query from common filter params
 * Uses $and to avoid $or conflicts
 */
const buildFilterQuery = ({ city, platform, active, search, searchFields }) => {
  const conditions = [];

  if (city) {
    conditions.push({ city: { $regex: city, $options: 'i' } });
  }

  if (platform) {
    conditions.push({ platform: { $regex: platform, $options: 'i' } });
  }

  if (active === 'true') {
    const threshold = Date.now() - ACTIVE_THRESHOLD_MS;
    conditions.push({ lastSeenAt: { $gte: threshold } });
  } else if (active === 'false') {
    const threshold = Date.now() - ACTIVE_THRESHOLD_MS;
    conditions.push({
      $or: [
        { lastSeenAt: { $lt: threshold } },
        { lastSeenAt: { $exists: false } },
        { lastSeenAt: null },
      ],
    });
  }

  if (search && searchFields && searchFields.length > 0) {
    const orConditions = searchFields.map((field) => ({
      [field]: { $regex: search, $options: 'i' },
    }));
    conditions.push({ $or: orConditions });
  }

  return conditions.length > 0 ? { $and: conditions } : {};
};

/**
 * Process a device document for API response
 */
const processDeviceDoc = (doc, deviceType) => {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.type = deviceType;
  obj.fcmToken = maskFcmToken(obj.fcmToken);
  obj.active = isDeviceActive(obj.lastSeenAt);
  return obj;
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/tracking/stats
 * Returns aggregate statistics across all tracking databases
 */
const getStats = async (req, res) => {
  try {
    const DeviceModel = safeGetModel(getTrackingDeviceModel);
    const LeadModel = safeGetModel(getTrackingLeadModel);
    const ProviderDeviceModel = safeGetModel(getTrackingProviderDeviceModel);

    const now = Date.now();
    const activeThreshold = now - ACTIVE_THRESHOLD_MS;

    let totalCustomers = 0;
    let totalProviders = 0;
    let totalLeads = 0;
    let activeCustomers = 0;
    let activeProviders = 0;
    const byCity = {};
    const byPlatform = {};

    // ── Customer Devices ──
    if (DeviceModel) {
      totalCustomers = await DeviceModel.countDocuments({});
      activeCustomers = await DeviceModel.countDocuments({
        lastSeenAt: { $gte: activeThreshold },
      });

      const cityAgg = await DeviceModel.aggregate([
        { $match: { city: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ]);
      cityAgg.forEach((c) => {
        byCity[c._id] = (byCity[c._id] || 0) + c.count;
      });

      const platAgg = await DeviceModel.aggregate([
        { $match: { platform: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$platform', count: { $sum: 1 } } },
      ]);
      platAgg.forEach((p) => {
        byPlatform[p._id] = (byPlatform[p._id] || 0) + p.count;
      });
    }

    // ── Provider Devices ──
    if (ProviderDeviceModel) {
      totalProviders = await ProviderDeviceModel.countDocuments({});
      activeProviders = await ProviderDeviceModel.countDocuments({
        lastSeenAt: { $gte: activeThreshold },
      });

      const cityAgg = await ProviderDeviceModel.aggregate([
        { $match: { city: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ]);
      cityAgg.forEach((c) => {
        byCity[c._id] = (byCity[c._id] || 0) + c.count;
      });

      const platAgg = await ProviderDeviceModel.aggregate([
        { $match: { platform: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$platform', count: { $sum: 1 } } },
      ]);
      platAgg.forEach((p) => {
        byPlatform[p._id] = (byPlatform[p._id] || 0) + p.count;
      });
    }

    // ── Leads ──
    if (LeadModel) {
      totalLeads = await LeadModel.countDocuments({});

      const cityAgg = await LeadModel.aggregate([
        { $match: { city: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ]);
      cityAgg.forEach((c) => {
        byCity[c._id] = (byCity[c._id] || 0) + c.count;
      });
    }

    const totalDevices = totalCustomers + totalProviders;
    const activeNow = activeCustomers + activeProviders;

    res.json({
      success: true,
      data: {
        totalDevices,
        totalCustomers,
        totalProviders,
        totalLeads,
        activeNow,
        activeCustomers,
        activeProviders,
        byCity,
        byPlatform,
        activeThresholdMinutes: 15,
      },
    });
  } catch (error) {
    console.error('❌ Tracking stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tracking stats',
      error: error.message,
    });
  }
};

/**
 * GET /api/v1/admin/tracking/devices
 * Query params: type (customer|provider|all), city, platform, active, search, page, limit
 */
const getDevices = async (req, res) => {
  try {
    const {
      type = 'all',
      city,
      platform,
      active,
      search,
      page = DEFAULT_PAGE,
      limit = DEFAULT_LIMIT,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || DEFAULT_PAGE);
    const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || DEFAULT_LIMIT));

    const DeviceModel = safeGetModel(getTrackingDeviceModel);
    const ProviderDeviceModel = safeGetModel(getTrackingProviderDeviceModel);

    let devices = [];
    let total = 0;

    // ── Customer Devices ──
    if (type === 'customer' || type === 'all') {
      if (DeviceModel) {
        const query = buildFilterQuery({
          city,
          platform,
          active,
          search,
          searchFields: ['deviceId', 'userId', 'city'],
        });

        const count = await DeviceModel.countDocuments(query);
        total += count;

        if (type === 'customer') {
          // Single-collection: DB-level pagination
          const docs = await DeviceModel.find(query)
            .sort({ lastSeenAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean();
          devices = docs.map((d) => processDeviceDoc(d, 'customer'));
        } else {
          // Merged: fetch enough for in-memory pagination
          const docs = await DeviceModel.find(query)
            .sort({ lastSeenAt: -1 })
            .limit(pageNum * limitNum)
            .lean();
          devices.push(...docs.map((d) => processDeviceDoc(d, 'customer')));
        }
      }
    }

    // ── Provider Devices ──
    if (type === 'provider' || type === 'all') {
      if (ProviderDeviceModel) {
        const query = buildFilterQuery({
          city,
          platform,
          active,
          search,
          searchFields: ['deviceId', 'providerId', 'city'],
        });

        const count = await ProviderDeviceModel.countDocuments(query);
        total += count;

        if (type === 'provider') {
          const docs = await ProviderDeviceModel.find(query)
            .sort({ lastSeenAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean();
          devices = docs.map((d) => processDeviceDoc(d, 'provider'));
        } else {
          const docs = await ProviderDeviceModel.find(query)
            .sort({ lastSeenAt: -1 })
            .limit(pageNum * limitNum)
            .lean();
          devices.push(...docs.map((d) => processDeviceDoc(d, 'provider')));
        }
      }
    }

    // ── Merge & paginate for type=all ──
    if (type === 'all') {
      devices.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
      const start = (pageNum - 1) * limitNum;
      devices = devices.slice(start, start + limitNum);
    }

    res.json({
      success: true,
      data: {
        devices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('❌ Get devices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch devices',
      error: error.message,
    });
  }
};

/**
 * GET /api/v1/admin/tracking/leads
 * Query params: city, search, page, limit
 */
const getLeads = async (req, res) => {
  try {
    const {
      city,
      search,
      page = DEFAULT_PAGE,
      limit = DEFAULT_LIMIT,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || DEFAULT_PAGE);
    const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || DEFAULT_LIMIT));

    const LeadModel = safeGetModel(getTrackingLeadModel);

    if (!LeadModel) {
      return res.json({
        success: true,
        data: {
          leads: [],
          pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 },
        },
      });
    }

    const query = buildFilterQuery({
      city,
      search,
      searchFields: ['email', 'deviceId', 'city'],
    });

    const total = await LeadModel.countDocuments(query);

    const docs = await LeadModel.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const leads = docs.map((doc) => ({
      ...doc,
      type: 'lead',
    }));

    res.json({
      success: true,
      data: {
        leads,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('❌ Get leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leads',
      error: error.message,
    });
  }
};

/**
 * GET /api/v1/admin/tracking/heatmap
 * Query params: type (all|customer|provider|lead), city, activeOnly
 * Returns geo points for Leaflet heatmap visualization
 */
const getHeatmap = async (req, res) => {
  try {
    const { type = 'all', city, activeOnly } = req.query;
    const now = Date.now();
    const activeThreshold = now - ACTIVE_THRESHOLD_MS;

    const DeviceModel = safeGetModel(getTrackingDeviceModel);
    const LeadModel = safeGetModel(getTrackingLeadModel);
    const ProviderDeviceModel = safeGetModel(getTrackingProviderDeviceModel);

    const points = [];
    let leadCityCounts = [];

    // Base geo filter — only docs with valid lat/lng
    const geoFilter = {
      lat: { $exists: true, $ne: null, $ne: 0 },
      lng: { $exists: true, $ne: null, $ne: 0 },
    };
    if (city) geoFilter.city = { $regex: city, $options: 'i' };

    // ── Customer device points ──
    if ((type === 'all' || type === 'customer') && DeviceModel) {
      const query = { ...geoFilter };
      if (activeOnly === 'true') {
        query.lastSeenAt = { $gte: activeThreshold };
      }

      const docs = await DeviceModel.find(query)
        .select('lat lng city deviceId lastSeenAt')
        .limit(MAX_HEATMAP_POINTS)
        .lean();

      docs.forEach((d) => {
        points.push({
          lat: Number(d.lat),
          lng: Number(d.lng),
          type: 'customer',
          weight: 1,
          city: d.city || 'Unknown',
          deviceId: d.deviceId,
          lastSeenAt: d.lastSeenAt,
          active: isDeviceActive(d.lastSeenAt),
        });
      });
    }

    // ── Provider device points ──
    if ((type === 'all' || type === 'provider') && ProviderDeviceModel) {
      const query = { ...geoFilter };
      if (activeOnly === 'true') {
        query.lastSeenAt = { $gte: activeThreshold };
      }

      const docs = await ProviderDeviceModel.find(query)
        .select('lat lng city deviceId providerId lastSeenAt')
        .limit(MAX_HEATMAP_POINTS)
        .lean();

      docs.forEach((d) => {
        points.push({
          lat: Number(d.lat),
          lng: Number(d.lng),
          type: 'provider',
          weight: 1,
          city: d.city || 'Unknown',
          deviceId: d.deviceId,
          providerId: d.providerId,
          lastSeenAt: d.lastSeenAt,
          active: isDeviceActive(d.lastSeenAt),
        });
      });
    }

    // ── Lead points + city aggregation ──
    if ((type === 'all' || type === 'lead') && LeadModel) {
      // Aggregate leads by city (for sidebar/tooltip even without geo coords)
      leadCityCounts = await LeadModel.aggregate([
        { $match: { city: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ]);

      // If leads have lat/lng, include as heatmap points
      const query = { ...geoFilter };
      const docs = await LeadModel.find(query)
        .select('lat lng city deviceId email')
        .limit(MAX_HEATMAP_POINTS)
        .lean();

      docs.forEach((d) => {
        points.push({
          lat: Number(d.lat),
          lng: Number(d.lng),
          type: 'lead',
          weight: 0.5,
          city: d.city || 'Unknown',
          deviceId: d.deviceId,
          lastSeenAt: null,
          active: false,
        });
      });
    }

    res.json({
      success: true,
      data: {
        points: points.slice(0, MAX_HEATMAP_POINTS),
        total: points.length,
        leadCityCounts,
      },
    });
  } catch (error) {
    console.error('❌ Heatmap error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch heatmap data',
      error: error.message,
    });
  }
};

/**
 * GET /api/v1/admin/tracking/device/:deviceId
 * Returns full details for a single device (searches both customer & provider collections)
 */
const getDeviceById = async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'deviceId is required',
      });
    }

    const DeviceModel = safeGetModel(getTrackingDeviceModel);
    const ProviderDeviceModel = safeGetModel(getTrackingProviderDeviceModel);

    let device = null;
    let deviceType = null;

    // Search customer devices first
    if (DeviceModel) {
      const doc = await DeviceModel.findOne({ deviceId }).lean();
      if (doc) {
        device = doc;
        deviceType = 'customer';
      }
    }

    // If not found, search provider devices
    if (!device && ProviderDeviceModel) {
      const doc = await ProviderDeviceModel.findOne({ deviceId }).lean();
      if (doc) {
        device = doc;
        deviceType = 'provider';
      }
    }

    if (!device) {
      return res.status(404).json({
        success: false,
        message: `Device "${deviceId}" not found in any tracking database`,
      });
    }

    const result = {
      ...device,
      type: deviceType,
      fcmToken: maskFcmToken(device.fcmToken),
      active: isDeviceActive(device.lastSeenAt),
    };

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('❌ Get device by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device details',
      error: error.message,
    });
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  getStats,
  getDevices,
  getLeads,
  getHeatmap,
  getDeviceById,
};