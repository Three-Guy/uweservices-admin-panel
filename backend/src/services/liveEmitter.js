// backend/src/services/liveEmitter.js
const logger = require('../utils/logger');

let io = null;

/**
 * Set Socket.IO instance (called from server.js or adminAlertService)
 */
function setLiveIo(socketIO) {
  io = socketIO;
}

/**
 * Emit live dispatch event to admin panel
 * Used by dispatchService.js
 *
 * @param {string} event - Event name (e.g., 'dispatch:update', 'booking:assigned')
 * @param {object} data - Event payload
 * @param {string} room - Optional room name (default: 'admins')
 */
function emitLive(event, data = {}, room = 'admins') {
  try {
    if (!io) {
      logger.warn(`⚠️  emitLive called but Socket.IO not initialized (event: ${event})`);
      return false;
    }

    io.to(room).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    return true;
  } catch (err) {
    logger.error(`emitLive failed for ${event}: ${err.message}`);
    return false;
  }
}

/**
 * Emit to specific admin by email
 */
function emitToAdmin(adminEmail, event, data = {}) {
  try {
    if (!io) return false;
    io.to(`admin:${adminEmail}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    logger.error(`emitToAdmin failed: ${err.message}`);
    return false;
  }
}

/**
 * Broadcast to all connected clients
 */
function broadcastLive(event, data = {}) {
  try {
    if (!io) return false;
    io.emit(event, { ...data, timestamp: new Date().toISOString() });
    return true;
  } catch (err) {
    logger.error(`broadcastLive failed: ${err.message}`);
    return false;
  }
}

module.exports = {
  setLiveIo,
  emitLive,
  emitToAdmin,
  broadcastLive,
};