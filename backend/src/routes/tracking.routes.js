// backend/src/routes/tracking.routes.js
// ✅ NEW FILE — Live Tracking & Heatmap Routes
// Mounted at /api/v1/admin/tracking in server.js

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');

const {
  getStats,
  getDevices,
  getLeads,
  getHeatmap,
  getDeviceById,
} = require('../controllers/tracking.controller');

// ─── Apply auth middleware to all tracking routes ─────────────────────────────
router.use(authMiddleware);

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/tracking/stats
 * Returns aggregate statistics (totals, active now, by city, by platform)
 */
router.get('/stats', getStats);

/**
 * GET /api/v1/admin/tracking/devices
 * Query params:
 *   - type:     customer | provider | all   (default: all)
 *   - city:     string (regex match, case-insensitive)
 *   - platform: string (regex match, case-insensitive)
 *   - active:   'true' | 'false'  (filters by lastSeenAt within 15 min)
 *   - search:   string (searches deviceId, userId/providerId, city)
 *   - page:     number (default: 1)
 *   - limit:    number (default: 50, max: 200)
 */
router.get('/devices', getDevices);

/**
 * GET /api/v1/admin/tracking/leads
 * Query params:
 *   - city:   string (regex match, case-insensitive)
 *   - search: string (searches email, deviceId, city)
 *   - page:   number (default: 1)
 *   - limit:  number (default: 50, max: 200)
 */
router.get('/leads', getLeads);

/**
 * GET /api/v1/admin/tracking/heatmap
 * Query params:
 *   - type:       all | customer | provider | lead  (default: all)
 *   - city:       string (regex match, case-insensitive)
 *   - activeOnly: 'true' (filters to only active devices within 15 min)
 * Returns array of geo points for Leaflet heatmap visualization
 */
router.get('/heatmap', getHeatmap);

/**
 * GET /api/v1/admin/tracking/device/:deviceId
 * Returns full details for a single device
 * Searches both customer and provider collections
 */
router.get('/device/:deviceId', getDeviceById);

// ─── Export ───────────────────────────────────────────────────────────────────
module.exports = router;