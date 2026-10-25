// src/workers/bookingPoller.js
const cron = require('node-cron');
const { getBookingModel } = require('../config/database');
const { getDispatchJobModel } = require('../models/DispatchJob');
const { dispatchBooking } = require('../services/dispatchService');
const { createAdminAlert, emitLive } = require('../services/adminAlertService');
const logger = require('../utils/logger');

const STUCK_MINUTES = Number(process.env.DISPATCH_STUCK_BOOKING_MINUTES || 2);
const POLL_INTERVAL_SEC = Number(process.env.DISPATCH_POLL_INTERVAL_SECONDS || 10);

let pollerTask = null;
let isPolling = false;
const seenBookings = new Set(); // in-memory dedupe for "new booking" alerts

async function pollOnce() {
  if (isPolling) return;
  isPolling = true;
  try {
    const Booking = getBookingModel();
    const DispatchJob = getDispatchJobModel();

    const stuckThreshold = new Date(Date.now() - STUCK_MINUTES * 60 * 1000);
    const retryThreshold = new Date();

    // Case 1: New bookings needing dispatch
    //   - status = confirmed/pending AND no providerId
    //   - OR status = no_provider_found AND nextRunAt reached
    //   - OR status = searching for > STUCK_MINUTES

    const candidates = await Booking.find({
      $and: [
        { isDeleted: { $ne: true } },
        {
          $or: [
            {
              $and: [
                { status: { $in: ['confirmed', 'pending'] } },
                {
                  $or: [
                    { providerId: null },
                    { providerId: { $exists: false } },
                    { providerId: '' },
                  ],
                },
              ],
            },
            {
              status: 'searching',
              updatedAt: { $lt: stuckThreshold },
            },
          ],
        },
      ],
    })
      .limit(20)
      .lean();

    // Case 2: no_provider_found bookings whose retry time is due
    const retryJobs = await DispatchJob.find({
      status: 'no_provider_found',
      nextRunAt: { $lte: retryThreshold },
    })
      .limit(10)
      .lean();

    const retryBookingIds = retryJobs.map((j) => String(j.bookingObjectId));

    const retryBookings =
      retryBookingIds.length > 0
        ? await Booking.find({
            _id: { $in: retryBookingIds },
            status: 'no_provider_found',
            isDeleted: { $ne: true },
          }).lean()
        : [];

    const allToProcess = [...candidates, ...retryBookings];

    for (const booking of allToProcess) {
      const key = String(booking._id);

      // Emit "new booking" alert ONCE per booking
      if (!seenBookings.has(key)) {
        seenBookings.add(key);
        // keep set bounded
        if (seenBookings.size > 5000) {
          const arr = Array.from(seenBookings);
          arr.slice(0, 2000).forEach((k) => seenBookings.delete(k));
        }

        emitLive('booking:new', {
          bookingId: booking.bookingId || key,
          customerName: booking.customerName,
          serviceName: booking.serviceName,
          totalAmount: booking.totalAmount,
          address: booking.address,
          createdAt: booking.createdAt,
        });

        await createAdminAlert({
          type: 'new_booking',
          title: '🔔 New Booking Received',
          message: `${booking.customerName || 'Customer'} • ${booking.serviceName || 'Service'} • ₹${booking.totalAmount || 0}`,
          severity: 'info',
          bookingId: booking.bookingId || key,
          userId: booking.userId,
          data: {
            address: booking.address,
            scheduledDate: booking.scheduledDate,
            scheduledTime: booking.scheduledTime,
          },
          actionUrl: `/bookings?open=${booking.bookingId || key}`,
        }).catch(() => {});
      }

      // Fire & forget dispatch
      dispatchBooking(booking).catch((e) =>
        logger.error(`Dispatch error for ${key}: ${e.message}`)
      );
    }

    // Mark job retries that are now re-queued
    if (retryBookingIds.length > 0) {
      await DispatchJob.updateMany(
        { bookingObjectId: { $in: retryBookingIds }, status: 'no_provider_found' },
        { $set: { nextRunAt: null } }
      );
    }
  } catch (err) {
    logger.error(`Poller error: ${err.message}`);
  } finally {
    isPolling = false;
  }
}

function startPoller() {
  if (process.env.DISPATCH_ENABLED !== 'true') {
    logger.warn('⚠️  DISPATCH_ENABLED !== true — booking poller NOT started');
    return;
  }

  const cronExpr = `*/${Math.max(1, POLL_INTERVAL_SEC)} * * * * *`;
  pollerTask = cron.schedule(cronExpr, pollOnce);
  logger.info(`✅ Booking poller started (every ${POLL_INTERVAL_SEC}s)`);
}

function stopPoller() {
  if (pollerTask) {
    pollerTask.stop();
    pollerTask = null;
    logger.info('Booking poller stopped');
  }
}

module.exports = { startPoller, stopPoller, pollOnce };