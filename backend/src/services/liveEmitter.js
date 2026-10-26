// backend/src/services/liveEmitter.js
let io = null;

function setLiveIo(socketIO) {
  io = socketIO;
  console.info('✅ Socket.IO attached to liveEmitter');
}

function emitLive(event, data = {}, room = 'admins') {
  try {
    if (!io) return false;
    const payload = { ...data, timestamp: new Date().toISOString() };
    if (room) {
      io.to(room).emit(event, payload);
    } else {
      io.emit(event, payload);
    }
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

function getIo() { return io; }

module.exports = {
  setLiveIo,
  emitLive,
  emitToAdmin,
  broadcastLive,
  getIo,
};