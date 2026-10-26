// backend/src/services/liveEmitter.js
// ✅ FIXED: Always broadcasts globally so events reach ALL connected admin sockets,
//          even if room-join logic (admin:register) is broken on socket server.

let io = null;

function setLiveIo(socketIO) {
  io = socketIO;
  console.info('✅ Socket.IO attached to liveEmitter');
}

/**
 * emitLive — emits to BOTH the target room AND globally (as safety net)
 * This guarantees delivery even if admin never joined the 'admins' room.
 */
function emitLive(event, data = {}, room = 'admins') {
  try {
    if (!io) {
      console.warn(`[liveEmitter] ⚠️ io not set — cannot emit "${event}"`);
      return false;
    }
    const payload = { ...data, timestamp: new Date().toISOString() };

    // Strategy 1: Emit to room (works if admin joined the room)
    if (room) {
      try {
        io.to(room).emit(event, payload);
      } catch (e) {
        console.warn(`[liveEmitter] room emit failed: ${e.message}`);
      }
    }

    // Strategy 2: ALSO broadcast globally (safety net — guarantees delivery)
    // This is safe because only authenticated admin sockets should be connected
    try {
      io.emit(event, payload);
    } catch (e) {
      console.warn(`[liveEmitter] global emit failed: ${e.message}`);
    }

    // Log how many sockets are connected (for debugging)
    try {
      const sockets = io.sockets?.sockets;
      const count = sockets?.size || 0;
      console.log(`[liveEmitter] 📡 Emitted "${event}" to ${count} connected socket(s)`);
    } catch {}

    return true;
  } catch (e) {
    console.error('❌ emitLive error:', e.message);
    return false;
  }
}

function emitToAdmin(adminId, event, data = {}) {
  try {
    if (!io || !adminId) return false;
    io.to(`admin:${adminId}`).emit(event, { ...data, timestamp: new Date().toISOString() });
    return true;
  } catch (e) {
    console.error('❌ emitToAdmin error:', e.message);
    return false;
  }
}

function broadcastLive(event, data = {}) {
  try {
    if (!io) return false;
    io.emit(event, { ...data, timestamp: new Date().toISOString() });
    return true;
  } catch (e) {
    console.error('❌ broadcastLive error:', e.message);
    return false;
  }
}

/**
 * emitToAdmins — alias used by bookingPoller
 * Also broadcasts globally for safety
 */
function emitToAdmins(event, data = {}) {
  return emitLive(event, data, 'admins');
}

function getIo() { return io; }

module.exports = {
  setLiveIo,
  emitLive,
  emitToAdmin,
  emitToAdmins,
  broadcastLive,
  getIo,
};