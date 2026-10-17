/**
 * Geo Utilities for Location Management
 * Includes Point-in-Polygon algorithm and other geo helpers
 */

/**
 * Check if a point is inside a polygon using Ray Casting algorithm
 * @param {number} lat - Latitude of the point
 * @param {number} lng - Longitude of the point
 * @param {Array<{lat: number, lng: number}>} polygon - Array of polygon coordinates
 * @returns {boolean} - True if point is inside polygon
 */
function isPointInPolygon(lat, lng, polygon) {
  if (!polygon || polygon.length < 3) {
    return false;
  }

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lat;
    const yi = polygon[i].lng;
    const xj = polygon[j].lat;
    const yj = polygon[j].lng;

    // Check if the ray from (lat, lng) going right intersects with edge (i, j)
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Calculate the center point of a polygon
 * @param {Array<{lat: number, lng: number}>} polygon - Array of polygon coordinates
 * @returns {{lat: number, lng: number}} - Center point
 */
function getPolygonCenter(polygon) {
  if (!polygon || polygon.length === 0) {
    return { lat: 0, lng: 0 };
  }

  const latSum = polygon.reduce((sum, coord) => sum + coord.lat, 0);
  const lngSum = polygon.reduce((sum, coord) => sum + coord.lng, 0);

  return {
    lat: latSum / polygon.length,
    lng: lngSum / polygon.length,
  };
}

/**
 * Calculate the area of a polygon using Shoelace formula
 * @param {Array<{lat: number, lng: number}>} polygon - Array of polygon coordinates
 * @returns {number} - Area in square degrees (approximate)
 */
function getPolygonArea(polygon) {
  if (!polygon || polygon.length < 3) {
    return 0;
  }

  let area = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].lat * polygon[j].lng;
    area -= polygon[j].lat * polygon[i].lng;
  }

  return Math.abs(area / 2);
}

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} - Distance in kilometers
 */
function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Convert degrees to radians
 * @param {number} degrees 
 * @returns {number} - Radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a polygon is valid (at least 3 points, non-self-intersecting)
 * @param {Array<{lat: number, lng: number}>} polygon - Array of polygon coordinates
 * @returns {{valid: boolean, message: string}}
 */
function validatePolygon(polygon) {
  if (!polygon || !Array.isArray(polygon)) {
    return { valid: false, message: 'Polygon must be an array' };
  }

  if (polygon.length < 3) {
    return { valid: false, message: 'Polygon must have at least 3 points' };
  }

  // Check if all coordinates are valid numbers
  for (let i = 0; i < polygon.length; i++) {
    const coord = polygon[i];
    if (typeof coord.lat !== 'number' || typeof coord.lng !== 'number') {
      return { valid: false, message: `Invalid coordinate at index ${i}` };
    }
    if (coord.lat < -90 || coord.lat > 90) {
      return { valid: false, message: `Latitude at index ${i} must be between -90 and 90` };
    }
    if (coord.lng < -180 || coord.lng > 180) {
      return { valid: false, message: `Longitude at index ${i} must be between -180 and 180` };
    }
  }

  return { valid: true, message: 'Valid polygon' };
}

/**
 * Get bounding box of a polygon
 * @param {Array<{lat: number, lng: number}>} polygon - Array of polygon coordinates
 * @returns {{minLat: number, maxLat: number, minLng: number, maxLng: number}}
 */
function getPolygonBounds(polygon) {
  if (!polygon || polygon.length === 0) {
    return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
  }

  let minLat = polygon[0].lat;
  let maxLat = polygon[0].lat;
  let minLng = polygon[0].lng;
  let maxLng = polygon[0].lng;

  for (const coord of polygon) {
    if (coord.lat < minLat) minLat = coord.lat;
    if (coord.lat > maxLat) maxLat = coord.lat;
    if (coord.lng < minLng) minLng = coord.lng;
    if (coord.lng > maxLng) maxLng = coord.lng;
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Check if a point is near a polygon (within buffer distance)
 * @param {number} lat - Latitude of the point
 * @param {number} lng - Longitude of the point
 * @param {Array<{lat: number, lng: number}>} polygon - Array of polygon coordinates
 * @param {number} bufferKm - Buffer distance in kilometers
 * @returns {boolean}
 */
function isPointNearPolygon(lat, lng, polygon, bufferKm = 1) {
  // First check if point is inside
  if (isPointInPolygon(lat, lng, polygon)) {
    return true;
  }

  // Check distance to each edge
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const distance = getDistanceToSegment(
      lat, lng,
      polygon[i].lat, polygon[i].lng,
      polygon[j].lat, polygon[j].lng
    );
    if (distance <= bufferKm) {
      return true;
    }
  }

  return false;
}

/**
 * Get distance from a point to a line segment
 * @param {number} px - Point latitude
 * @param {number} py - Point longitude
 * @param {number} x1 - Segment start latitude
 * @param {number} y1 - Segment start longitude
 * @param {number} x2 - Segment end latitude
 * @param {number} y2 - Segment end longitude
 * @returns {number} - Distance in kilometers
 */
function getDistanceToSegment(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  return getDistanceKm(px, py, xx, yy);
}

module.exports = {
  isPointInPolygon,
  getPolygonCenter,
  getPolygonArea,
  getDistanceKm,
  toRadians,
  validatePolygon,
  getPolygonBounds,
  isPointNearPolygon,
  getDistanceToSegment,
};