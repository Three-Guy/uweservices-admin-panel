// src/services/liveEmitter.js

let _io = null;

function getIo() {
  // 1. Return cached io if valid
  if (_io && _io.sockets) return _io;

  // 2. Try to get from global app
  try {
    const app = require('express')();
    // This won't work — need the actual app instance
  } catch (e) {}

  // 3. Try global
  if (global.__IO_INSTANCE__ && global.__IO_INSTANCE__.sockets) {
    _io = global.__IO_INSTANCE__;
    return _io;
  }

  return _io;
}

function setLiveIo(io) {
  _io = io;
  global.__IO_INSTANCE__ = io;
  console.log('✅ [LiveEmitter] io instance set');

  // Log current socket count
  try {
    const count = io.engine.clientsCount || 0;
    const adminRoom = io.sockets.adapter.rooms.get('admins');
    const adminCount = adminRoom ? adminRoom.size : 0;
    console.log(`   Connected: ${count} total, ${adminCount} in 'admins' room`);
  } catch (e) {}
}

function emitLive(event, data, room) {
  const io = getIo();
  if (!io) {
    console.error('❌ [LiveEmitter] io is NULL — cannot emit', event);
    return false;
  }

  try {
    let sent = false;

    // 1. Emit to specific room
    if (room) {
      const roomSockets = io.sockets.adapter.rooms.get(room);
      const roomCount = roomSockets ? roomSockets.size : 0;
      console.log(`📡 [LiveEmitter] Emitting "${event}" to room "${room}" (${roomCount} sockets)`);

      if (roomCount > 0) {
        io.to(room).emit(event, data);
        sent = true;
      } else {
        console.warn(`⚠️ [LiveEmitter] Room "${room}" is EMPTY`);
      }
    }

    // 2. ALWAYS emit globally as safety net
    const totalSockets = io.engine.clientsCount || 0;
    console.log(`📡 [LiveEmitter] Emitting "${event}" GLOBALLY (${totalSockets} total sockets)`);
    if (totalSockets > 0) {
      io.emit(event, data);
      sent = true;
    } else {
      console.warn(`⚠️ [LiveEmitter] No sockets connected at all`);
    }

    return sent;
  } catch (err) {
    console.error('❌ [LiveEmitter] emitLive error:', err.message);
    return false;
  }
}

function emitToAdmin(event, adminId, data) {
  const io = getIo();
  if (!io) return false;
  try {
    io.to(`admin:${adminId}`).emit(event, data);
    return true;
  } catch (e) {
    return false;
  }
}

function emitToAdmins(event, data) {
  return emitLive(event, data, 'admins');
}

function broadcastLive(event, data) {
  const io = getIo();
  if (!io) return false;
  try {
    io.emit(event, data);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  setLiveIo,
  getIo,
  emitLive,
  emitToAdmin,
  emitToAdmins,
  broadcastLive,
};