// backend/src/services/eligibilityService.js
// ✅ FIXED: Category match works with string categoryIds + profession regex
// ✅ FIXED: Relaxed filters with debug logging
// ✅ FIXED: No crash on invalid ObjectId

const mongoose = require('mongoose');
const { getProviderConnection } = require('../config/database');

/**
 * Haversine distance in KM
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Safely convert any ID to ObjectId. Returns null if invalid.
 */
function safeObjectId(val) {
  if (!val) return null;
  try {
    const str = String(val).trim();
    if (!mongoose.Types.ObjectId.isValid(str)) return null;
    return new mongoose.Types.ObjectId(str);
  } catch (e) {
    return null;
  }
}

/**
 * Build case-insensitive regex that matches a string value
 */
function buildCategoryRegex(categoryName) {
  if (!categoryName) return null;
  const escaped = String(categoryName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * MAIN: Find eligible providers for a booking
 * @param {Object} booking - full booking document
 * @param {Object} opts - { radiusKm, excludeProviderIds, strict, debug }
 * @returns {Array} sorted providers with distance
 */
async function findEligibleProviders(booking, opts = {}) {
  const {
    radiusKm = 12,
    excludeProviderIds = [],
    strict = true,
    debug = false,
  } = opts;

  if (!booking) {
    console.warn('[Eligibility] No booking provided');
    return [];
  }

  const bookingLat =
    booking.latitude ??
    booking.customerLocation?.coordinates?.[1] ??
    null;
  const bookingLng =
    booking.longitude ??
    booking.customerLocation?.coordinates?.[0] ??
    null;

  const logs = [];
  const log = (msg) => {
    logs.push(msg);
    if (debug) console.log(`[Eligibility] ${msg}`);
  };

  log(`🔍 Finding providers for booking ${booking.bookingId}`);
  log(`   Location: lat=${bookingLat}, lng=${bookingLng}`);
  log(`   Radius: ${radiusKm}km, strict=${strict}`);
  log(`   Category: ${booking.categoryName || booking.categoryId}`);
  log(`   City: ${booking.city?.cityName || booking.city?.cityId || 'any'}`);

  const providerColl = getProviderConnection().collection('providers');

  // ─────── BUILD QUERY ───────
  const andClauses = [];

  // 1. Must be active + verified + has fcmToken
  andClauses.push({ isActive: { $ne: false } });
  andClauses.push({
    $or: [
      { verificationStatus: 'approved' },
      { verificationStatus: 'verified' },
      { isVerified: true },
    ],
  });
  andClauses.push({ fcmToken: { $exists: true, $ne: null, $ne: '' } });

  // 2. Not deleted/blocked
  andClauses.push({ isDeleted: { $ne: true } });
  andClauses.push({ isBlocked: { $ne: true } });

  // 3. Not in payment lock
  andClauses.push({
    $or: [
      { 'paymentLock.isLocked': { $ne: true } },
      { paymentLock: { $exists: false } },
    ],
  });

  // 4. CATEGORY MATCHING — multiple strategies combined
  const categoryOrClauses = [];

  // Strategy A: Match by categoryId (if valid ObjectId)
  const catObjectId = safeObjectId(booking.categoryId);
  if (catObjectId) {
    categoryOrClauses.push({ categoryId: catObjectId });
  }

  // Strategy B: Match by categoryName (regex, case-insensitive)
  if (booking.categoryName) {
    const regex = buildCategoryRegex(booking.categoryName);
    if (regex) {
      categoryOrClauses.push({ categoryName: regex });
      categoryOrClauses.push({ profession: regex });
    }
  }

  // Strategy C: Match by categoryId as string (fallback for mismatched schemas)
  if (booking.categoryId && typeof booking.categoryId === 'string' && !catObjectId) {
    // Non-ObjectId string like 'plumbing' — match against profession/categoryName
    const regex = buildCategoryRegex(booking.categoryId);
    if (regex) {
      categoryOrClauses.push({ profession: regex });
      categoryOrClauses.push({ categoryName: regex });
    }
  }

  if (categoryOrClauses.length > 0) {
    andClauses.push({ $or: categoryOrClauses });
    log(`   Category match: ${categoryOrClauses.length} strategies`);
  } else {
    log(`   ⚠️  No category match possible — will match all professions`);
  }

  // 5. CITY MATCHING — flexible
  if (booking.city?.cityId || booking.city?.cityName) {
    const cityOrClauses = [];
    const cityObjectId = safeObjectId(booking.city?.cityId);
    if (cityObjectId) {
      cityOrClauses.push({ cityId: cityObjectId });
    }
    if (booking.city?.cityName) {
      const cityRegex = buildCategoryRegex(booking.city.cityName);
      if (cityRegex) {
        cityOrClauses.push({ city: cityRegex });
      }
    }
    if (cityOrClauses.length > 0) {
      andClauses.push({ $or: cityOrClauses });
    }
  }

  // 6. Exclude already-tried providers
  if (excludeProviderIds && excludeProviderIds.length > 0) {
    const excludeArr = excludeProviderIds
      .map((id) => safeObjectId(id) || id)
      .filter(Boolean);
    if (excludeArr.length > 0) {
      andClauses.push({
        _id: { $nin: excludeArr.filter((x) => x instanceof mongoose.Types.ObjectId) },
      });
      // Also exclude by providerId string
      const stringIds = excludeProviderIds.filter((x) => typeof x === 'string' && !mongoose.Types.ObjectId.isValid(x));
      if (stringIds.length > 0) {
        andClauses.push({ providerId: { $nin: stringIds } });
      }
    }
  }

  // 7. AVAILABILITY — only in STRICT mode
  if (strict) {
    andClauses.push({ isAvailable: true });
    andClauses.push({ isAcceptingJobs: true });
    andClauses.push({ isBusy: { $ne: true } });
  }

  const query = { $and: andClauses };

  if (debug) {
    console.log('[Eligibility] Query:', JSON.stringify(query, null, 2));
  }

  // ─────── EXECUTE ───────
  let providers = [];
  try {
    providers = await providerColl.find(query).limit(500).toArray();
  } catch (e) {
    console.error('[Eligibility] Query error:', e.message);
    return [];
  }

  log(`   DB returned: ${providers.length} providers`);

  // ─────── DISTANCE CALC + FILTER ───────
  const withDistance = providers.map((p) => {
    let plat = null, plng = null;

    if (p.location?.coordinates && Array.isArray(p.location.coordinates) && p.location.coordinates.length === 2) {
      plng = p.location.coordinates[0];
      plat = p.location.coordinates[1];
    } else if (p.latitude != null && p.longitude != null) {
      plat = p.latitude;
      plng = p.longitude;
    }

    const dist = (bookingLat != null && bookingLng != null && plat != null && plng != null)
      ? haversineDistance(bookingLat, bookingLng, plat, plng)
      : null;

    return {
      ...p,
      _distanceKm: dist,
    };
  });

  // Filter by radius (allow null distance if no coords on provider — up to caller to decide)
  const inRadius = withDistance.filter((p) => {
    if (p._distanceKm === null) return true; // keep provider if we can't calculate — they still eligible
    return p._distanceKm <= radiusKm;
  });

  // Sort by distance ascending
  inRadius.sort((a, b) => {
    if (a._distanceKm === null) return 1;
    if (b._distanceKm === null) return -1;
    return a._distanceKm - b._distanceKm;
  });

  log(`   In radius (${radiusKm}km): ${inRadius.length}`);

  return inRadius;
}

/**
 * DEBUG: Return eligibility breakdown for a booking
 * Shows how many providers match at each filter stage
 */
async function debugEligibility(booking) {
  const providerColl = getProviderConnection().collection('providers');
  const result = {
    bookingId: booking.bookingId,
    booking: {
      categoryId: booking.categoryId,
      categoryName: booking.categoryName,
      city: booking.city?.cityName,
      cityId: booking.city?.cityId,
      lat: booking.latitude ?? booking.customerLocation?.coordinates?.[1],
      lng: booking.longitude ?? booking.customerLocation?.coordinates?.[0],
    },
    stages: {},
  };

  // Stage 1: Total providers
  result.stages.total = await providerColl.countDocuments({});

  // Stage 2: Active + verified + fcmToken
  result.stages.activeVerifiedWithFcm = await providerColl.countDocuments({
    isActive: { $ne: false },
    $or: [
      { verificationStatus: 'approved' },
      { verificationStatus: 'verified' },
      { isVerified: true },
    ],
    fcmToken: { $exists: true, $ne: null, $ne: '' },
    isDeleted: { $ne: true },
    isBlocked: { $ne: true },
  });

  // Stage 3: Category match
  const categoryOrClauses = [];
  const catObjectId = safeObjectId(booking.categoryId);
  if (catObjectId) categoryOrClauses.push({ categoryId: catObjectId });
  if (booking.categoryName) {
    const regex = buildCategoryRegex(booking.categoryName);
    if (regex) {
      categoryOrClauses.push({ categoryName: regex });
      categoryOrClauses.push({ profession: regex });
    }
  }
  result.stages.categoryMatch = await providerColl.countDocuments({
    isActive: { $ne: false },
    $or: categoryOrClauses.length > 0 ? categoryOrClauses : [{}],
  });

  // Stage 4: + Available + Accepting
  result.stages.availableAccepting = await providerColl.countDocuments({
    isActive: { $ne: false },
    isAvailable: true,
    isAcceptingJobs: true,
    isBusy: { $ne: true },
    $or: categoryOrClauses.length > 0 ? categoryOrClauses : [{}],
    fcmToken: { $exists: true, $ne: null, $ne: '' },
  });

  // Stage 5: Final strict
  const strict = await findEligibleProviders(booking, { radiusKm: 12, strict: true });
  result.stages.finalStrict12km = strict.length;

  // Stage 6: Final relaxed (no availability filter)
  const relaxed = await findEligibleProviders(booking, { radiusKm: 12, strict: false });
  result.stages.finalRelaxed12km = relaxed.length;

  // List matching providers (relaxed, for debug)
  result.sampleProviders = relaxed.slice(0, 10).map((p) => ({
    _id: String(p._id),
    providerId: p.providerId,
    name: p.name,
    profession: p.profession,
    categoryName: p.categoryName,
    city: p.city,
    isAvailable: p.isAvailable,
    isAcceptingJobs: p.isAcceptingJobs,
    isBusy: p.isBusy,
    hasFcmToken: !!p.fcmToken,
    distanceKm: p._distanceKm,
    verificationStatus: p.verificationStatus,
  }));

  return result;
}

module.exports = {
  findEligibleProviders,
  debugEligibility,
  haversineDistance,
  safeObjectId,
};