// src/services/eligibilityService.js
const mongoose = require('mongoose');
const { getProviderConnection } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Haversine distance in km
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find eligible providers for a booking.
 * Returns providers sorted by distance (nearest first), excluding tried list.
 */
async function findEligibleProviders({ booking, radiusKm, excludeProviderIds = [], limit = 50 }) {
  const conn = getProviderConnection();
  if (!conn) throw new Error('Provider DB not connected');

  const ProvidersCol = conn.collection('providers');

  // Build base eligibility
  const baseQuery = {
    isActive: true,
    isAvailable: true,
    isAcceptingJobs: true,
    isBusy: false,
    isOnline: true,
    verificationStatus: { $in: ['approved', 'verified'] },
    fcmToken: { $exists: true, $ne: null, $ne: '' },
    isBlocked: { $ne: true },
    isDeleted: { $ne: true },
  };

  // Category filter — try categoryId first, fallback to categoryName
  const categoryConditions = [];
  if (booking.categoryId) {
    try {
      categoryConditions.push({ categoryId: new mongoose.Types.ObjectId(String(booking.categoryId)) });
    } catch (e) {
      categoryConditions.push({ categoryId: booking.categoryId });
    }
    categoryConditions.push({ categoryId: String(booking.categoryId) });
  }
  if (booking.categoryName) {
    categoryConditions.push({
      categoryName: { $regex: `^${escapeRegex(booking.categoryName)}$`, $options: 'i' },
    });
    categoryConditions.push({
      profession: { $regex: `^${escapeRegex(booking.categoryName)}$`, $options: 'i' },
    });
  }
  if (categoryConditions.length > 0) {
    baseQuery.$or = categoryConditions;
  }

  // Payment lock exclusion
  baseQuery.$and = [
    {
      $or: [
        { 'paymentLock.isLocked': { $ne: true } },
        { paymentLock: { $exists: false } },
      ],
    },
  ];

  // Exclude already-tried in this cycle
  if (excludeProviderIds && excludeProviderIds.length > 0) {
    const stringIds = excludeProviderIds.map(String);
    const objectIds = excludeProviderIds
      .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
      .map((id) => new mongoose.Types.ObjectId(String(id)));
    baseQuery.$and.push({
      $and: [
        { providerId: { $nin: stringIds } },
        { _id: { $nin: objectIds } },
      ],
    });
  }

  // City filter — only if booking has city info (don't block if provider schema differs)
  const bookingCityId = booking.city?.cityId || booking.cityId;
  const bookingCityName = booking.city?.cityName || booking.cityName;
  if (bookingCityId || bookingCityName) {
    const cityConds = [];
    if (bookingCityId) {
      try {
        cityConds.push({ cityId: new mongoose.Types.ObjectId(String(bookingCityId)) });
      } catch (e) {}
      cityConds.push({ cityId: String(bookingCityId) });
    }
    if (bookingCityName) {
      cityConds.push({ city: { $regex: `^${escapeRegex(bookingCityName)}$`, $options: 'i' } });
    }
    if (cityConds.length) {
      baseQuery.$and.push({ $or: cityConds });
    }
  }

  let providers = [];
  try {
    providers = await ProvidersCol.find(baseQuery).limit(limit * 2).toArray();
  } catch (err) {
    logger.error('Provider eligibility query failed:', err.message);
    return [];
  }

  // Compute distance if coordinates available
  const bookingLat =
    Number(booking.latitude) ||
    Number(booking.customerLocation?.coordinates?.[1]) ||
    null;
  const bookingLng =
    Number(booking.longitude) ||
    Number(booking.customerLocation?.coordinates?.[0]) ||
    null;

  const withDistance = providers.map((p) => {
    const pLat = Number(p.location?.coordinates?.[1]) || Number(p.latitude) || null;
    const pLng = Number(p.location?.coordinates?.[0]) || Number(p.longitude) || null;
    const distance = haversineKm(bookingLat, bookingLng, pLat, pLng);
    return { ...p, _distanceKm: distance };
  });

  // Filter by radius if we have coordinates
  let filtered;
  if (bookingLat && bookingLng) {
    filtered = withDistance.filter(
      (p) => p._distanceKm === null || p._distanceKm <= radiusKm
    );
    filtered.sort((a, b) => {
      const da = a._distanceKm ?? Infinity;
      const db = b._distanceKm ?? Infinity;
      return da - db;
    });
  } else {
    // No coordinates — return all eligible by last online
    filtered = withDistance.sort((a, b) => {
      const ta = new Date(a.lastOnlineAt || 0).getTime();
      const tb = new Date(b.lastOnlineAt || 0).getTime();
      return tb - ta;
    });
  }

  return filtered.slice(0, limit);
}

function escapeRegex(str) {
  return String(str).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

module.exports = {
  findEligibleProviders,
  haversineKm,
};