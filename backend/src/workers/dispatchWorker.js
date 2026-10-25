// src/workers/dispatchWorker.js
// Watches for external provider acceptances (e.g. provider app updates DB directly)
// and emits live events + alerts to admin panel. Also handles cleanup.

const cron = require('node-cron');
const { getBookingModel } = require('../config/database');
const { getProviderOfferModel } = require('../models/ProviderOffer');
const { emitLive, createAdminAlert } = require('../services/adminAlertService');
const logger = require('../utils/logger');

let watcherTask = null;
let isRunning = false;
const lastSeenStatus = new Map(); // bookingId -> status (for change detection)

async function watchOnce() {
  if (isRunning) return;
  isRunning = true;
  try {
    const Booking = getBookingModel();
    const Offer = getProviderOfferModel();

    // Look at bookings updated in last 30 seconds
    const since = new Date(Date.now() - 30 * 1000);
    const recent = await Booking.find({
      updatedAt: { $gte: since },
      isDeleted: { $ne: true },
    })
      .limit(200)
      .lean();

    for (const b of recent) {
      const key = String(b._id);
      const prev = lastSeenStatus.get(key);
      const curr = `${b.status}|${b.providerId || ''}`;

      if (prev === curr) continue;
      lastSeenStatus.set(key, curr);

      // Only emit on actual change
      if (prev) {
        emitLive('booking:status_changed', {
          bookingId: b.bookingId || key,
          status: b.status,
          providerId: b.providerId,
          providerName: b.providerName,
          updatedAt: b.updatedAt,
        });

        // External acceptance detection
        if (b.providerId && ['assigned', 'accepted'].includes(b.status)) {
          await Offer.updateMany(
            {
              bookingObjectId: b._id,
              providerId: String(b.providerId),
              isCurrentOffer: true,
              status: { $in: ['sent', 'delivered', 'viewed'] },
            },
            { $set: { status: 'accepted', respondedAt: new Date() } }
          );
          await Offer.updateMany(
            {
              bookingObjectId: b._id,
              isCurrentOffer: true,
              providerId: { $ne: String(b.providerId) },
              status: { $in: ['sent', 'delivered', 'viewed'] },
            },
            { $set: { status: 'superseded', respondedAt: new Date() } }
          );
        }

        if (b.status === 'cancelled') {
          await createAdminAlert({
            type: 'booking_cancelled',
            title: '🚫 Booking Cancelled',
            message: `Booking ${b.bookingId || key} was cancelled`,
            severity: 'warning',
            bookingId: b.bookingId || key,
            providerId: b.providerId,
            data: { reason: b.cancellationReason, cancelledBy: b.cancelledBy },
            actionUrl: `/bookings?open=${b.bookingId || key}`,
          }).catch(() => {});
        }

        if (b.status === 'completed') {
          await createAdminAlert({
            type: 'booking_completed',
            title: '✅ Booking Completed',
            message: `Booking ${b.bookingId || key} completed by ${b.providerName || b.providerId}`,
            severity: 'success',
            bookingId: b.bookingId || key,
            providerId: b.providerId,
            actionUrl: `/bookings?open=${b.bookingId || key}`,
          }).catch(() => {});
        }
      }
    }

    // Bound memory
    if (lastSeenStatus.size > 5000) {
      const keys = Array.from(lastSeenStatus.keys()).slice(0, 2000);
      keys.forEach((k) => lastSeenStatus.delete(k));
    }
  } catch (err) {
    logger.error(`Dispatch watcher error: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

function startWatcher() {
  if (process.env.DISPATCH_ENABLED !== 'true') return;
  watcherTask = cron.schedule('*/5 * * * * *', watchOnce);
  logger.info('✅ Dispatch watcher started (every 5s)');
}

function stopWatcher() {
  if (watcherTask) {
    watcherTask.stop();
    watcherTask = null;
  }
}

module.exports = { startWatcher, stopWatcher, watchOnce };