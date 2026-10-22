// backend/src/routes/booking.routes.js
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const authMiddleware = require('../middleware/authMiddleware');

// All booking routes require admin auth
router.use(authMiddleware);

router.get('/stats', bookingController.getBookingStats);
router.get('/', bookingController.getAllBookings);
router.get('/:id', bookingController.getBookingById);

router.patch('/:id/status', bookingController.updateBookingStatus);
router.patch('/:id/payment-status', bookingController.updatePaymentStatus);
router.patch('/:id', bookingController.updateBooking);

router.delete('/:id', bookingController.deleteBooking);

module.exports = router;