// backend/src/controllers/booking.controller.js
const { getBookingModel } = require('../config/database');
const logger = require('../utils/logger');

// Allowed status values (from your actual data + statusHistory)
const ALLOWED_STATUSES = [
  'pending',
  'confirmed',
  'searching',
  'assigned',
  'accepted',
  'en-route',
  'arrived',
  'in-progress',
  'completed',
  'cancelled',
  'rejected',
  'failed',
  'refunded',
];

const ALLOWED_PAYMENT_STATUSES = [
  'pending',
  'completed',
  'failed',
  'refunded',
  'pay_after_service',
  'paid',
];

// ==================== GET ALL BOOKINGS ====================
exports.getAllBookings = async (req, res) => {
  try {
    const Booking = getBookingModel();

    const {
      page = 1,
      limit = 20,
      search = '',
      status,
      paymentStatus,
      paymentMethod,
      bookingType,
      categoryId,
      cityId,
      zoneId,
      providerId,
      userId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      isDeleted,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (typeof isDeleted !== 'undefined') {
      query.isDeleted = isDeleted === 'true';
    } else {
      // By default show non-deleted; if field missing, still include
      query.$or = [{ isDeleted: false }, { isDeleted: { $exists: false } }];
    }

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (bookingType) query.bookingType = bookingType;
    if (categoryId) query.categoryId = categoryId;
    if (providerId) query.providerId = providerId;
    if (userId) query.userId = userId;
    if (cityId) query['city.cityId'] = cityId;
    if (zoneId) query['zone.zoneId'] = zoneId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      const searchOr = [
        { bookingId: regex },
        { customerName: regex },
        { customerEmail: regex },
        { customerPhone: regex },
        { serviceName: regex },
        { providerName: regex },
        { address: regex },
      ];
      // Merge with existing $or (isDeleted $or)
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [bookings, total] = await Promise.all([
      Booking.find(query).sort(sortObj).skip(skip).limit(limitNum).lean(),
      Booking.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      message: 'Bookings fetched successfully',
      data: {
        bookings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
      },
    });
  } catch (error) {
    logger.error('getAllBookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message,
    });
  }
};

// ==================== GET BOOKING STATS ====================
exports.getBookingStats = async (req, res) => {
  try {
    const Booking = getBookingModel();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalBookings,
      todayBookings,
      weekBookings,
      monthBookings,
      pendingBookings,
      confirmedBookings,
      inProgressBookings,
      completedBookings,
      cancelledBookings,
      statusAgg,
      paymentMethodAgg,
      revenueAgg,
      todayRevenueAgg,
      categoryAgg,
    ] = await Promise.all([
      Booking.countDocuments({}),
      Booking.countDocuments({ createdAt: { $gte: startOfToday } }),
      Booking.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Booking.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Booking.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ status: 'confirmed' }),
      Booking.countDocuments({ status: 'in-progress' }),
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({ status: 'cancelled' }),
      Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Booking.aggregate([{ $group: { _id: '$paymentMethod', count: { $sum: 1 } } }]),
      Booking.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Booking.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Booking.aggregate([{ $group: { _id: '$categoryName', count: { $sum: 1 } } }]),
    ]);

    const statusDistribution = {};
    statusAgg.forEach(s => { statusDistribution[s._id || 'unknown'] = s.count; });

    const paymentMethodDistribution = {};
    paymentMethodAgg.forEach(p => { paymentMethodDistribution[p._id || 'unknown'] = p.count; });

    const categoryDistribution = {};
    categoryAgg.forEach(c => { categoryDistribution[c._id || 'unknown'] = c.count; });

    res.json({
      success: true,
      data: {
        totalBookings,
        todayBookings,
        weekBookings,
        monthBookings,
        pendingBookings,
        confirmedBookings,
        inProgressBookings,
        completedBookings,
        cancelledBookings,
        totalRevenue: revenueAgg[0]?.total || 0,
        todayRevenue: todayRevenueAgg[0]?.total || 0,
        statusDistribution,
        paymentMethodDistribution,
        categoryDistribution,
      },
    });
  } catch (error) {
    logger.error('getBookingStats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
  }
};

// ==================== GET BOOKING BY ID ====================
exports.getBookingById = async (req, res) => {
  try {
    const Booking = getBookingModel();
    const { id } = req.params;

    // Try by _id first, then by bookingId
    let booking = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      booking = await Booking.findById(id).lean();
    }
    if (!booking) {
      booking = await Booking.findOne({ bookingId: id }).lean();
    }

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({ success: true, data: { booking } });
  } catch (error) {
    logger.error('getBookingById error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch booking', error: error.message });
  }
};

// ==================== UPDATE BOOKING STATUS (adds statusHistory entry) ====================
exports.updateBookingStatus = async (req, res) => {
  try {
    const Booking = getBookingModel();
    const { id } = req.params;
    const { status, reason = '' } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required' });
    }
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
      });
    }

    const adminId = req.admin?._id || req.admin?.id || 'admin';
    const adminLabel = `admin:${adminId}`;

    let booking = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      booking = await Booking.findById(id);
    }
    if (!booking) {
      booking = await Booking.findOne({ bookingId: id });
    }
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const now = new Date();
    const previousStatus = booking.status;

    booking.status = status;
    booking.updatedAt = now;

    // Append statusHistory
    if (!Array.isArray(booking.statusHistory)) booking.statusHistory = [];
    booking.statusHistory.push({
      status,
      changedAt: now,
      changedBy: adminLabel,
      reason: reason || `Status changed from ${previousStatus} to ${status} by admin`,
    });

    // Set lifecycle timestamps automatically (preserve existing values if set)
    if (status === 'assigned' && !booking.assignedAt) booking.assignedAt = now;
    if (status === 'en-route' && !booking.enRouteAt) booking.enRouteAt = now;
    if (status === 'arrived' && !booking.arrivedAt) booking.arrivedAt = now;
    if (status === 'in-progress' && !booking.startedAt) booking.startedAt = now;
    if (status === 'completed' && !booking.completedAt) booking.completedAt = now;
    if (status === 'cancelled') {
      if (!booking.cancelledAt) booking.cancelledAt = now;
      if (!booking.cancellationReason) booking.cancellationReason = reason || 'Cancelled by admin';
      if (!booking.cancelledBy) booking.cancelledBy = adminLabel;
    }

    // markModified for mixed/strict:false subdocs
    booking.markModified('statusHistory');

    await booking.save();

    // Emit socket event (optional, if io present)
    try {
      const io = req.app.get('io');
      if (io) {
        io.to('admins').emit('booking:status_changed', {
          bookingId: booking.bookingId,
          _id: booking._id,
          status,
          previousStatus,
          changedBy: adminLabel,
          changedAt: now,
        });
      }
    } catch (e) { /* ignore */ }

    res.json({
      success: true,
      message: `Booking status updated to ${status}`,
      data: { booking: booking.toObject() },
    });
  } catch (error) {
    logger.error('updateBookingStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status', error: error.message });
  }
};

// ==================== UPDATE PAYMENT STATUS ====================
exports.updatePaymentStatus = async (req, res) => {
  try {
    const Booking = getBookingModel();
    const { id } = req.params;
    const { paymentStatus } = req.body;

    if (!paymentStatus) {
      return res.status(400).json({ success: false, message: 'paymentStatus is required' });
    }
    if (!ALLOWED_PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid paymentStatus. Allowed: ${ALLOWED_PAYMENT_STATUSES.join(', ')}`,
      });
    }

    let booking = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      booking = await Booking.findById(id);
    }
    if (!booking) {
      booking = await Booking.findOne({ bookingId: id });
    }
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    booking.paymentStatus = paymentStatus;
    if (paymentStatus === 'completed' || paymentStatus === 'paid') {
      if (!booking.paymentDetails) booking.paymentDetails = {};
      if (!booking.paymentDetails.paidAt) booking.paymentDetails.paidAt = new Date();
      booking.markModified('paymentDetails');
    }
    booking.updatedAt = new Date();

    await booking.save();

    res.json({
      success: true,
      message: 'Payment status updated',
      data: { booking: booking.toObject() },
    });
  } catch (error) {
    logger.error('updatePaymentStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update payment status', error: error.message });
  }
};

// ==================== UPDATE GENERIC BOOKING FIELDS ====================
exports.updateBooking = async (req, res) => {
  try {
    const Booking = getBookingModel();
    const { id } = req.params;
    const updates = { ...req.body };

    // Prevent overwriting critical identifiers
    delete updates._id;
    delete updates.bookingId;
    delete updates.createdAt;
    delete updates.__v;

    let booking = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      booking = await Booking.findById(id);
    }
    if (!booking) {
      booking = await Booking.findOne({ bookingId: id });
    }
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    Object.keys(updates).forEach(key => {
      booking[key] = updates[key];
      booking.markModified(key);
    });
    booking.updatedAt = new Date();

    await booking.save();

    res.json({
      success: true,
      message: 'Booking updated',
      data: { booking: booking.toObject() },
    });
  } catch (error) {
    logger.error('updateBooking error:', error);
    res.status(500).json({ success: false, message: 'Failed to update booking', error: error.message });
  }
};

// ==================== DELETE BOOKING (soft) ====================
exports.deleteBooking = async (req, res) => {
  try {
    const Booking = getBookingModel();
    const { id } = req.params;
    const { permanent = 'false' } = req.query;

    let booking = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      booking = await Booking.findById(id);
    }
    if (!booking) {
      booking = await Booking.findOne({ bookingId: id });
    }
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (permanent === 'true') {
      await Booking.deleteOne({ _id: booking._id });
      return res.json({ success: true, message: 'Booking permanently deleted' });
    }

    booking.isDeleted = true;
    booking.deletedAt = new Date();
    await booking.save();

    res.json({ success: true, message: 'Booking soft deleted', data: { booking: booking.toObject() } });
  } catch (error) {
    logger.error('deleteBooking error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete booking', error: error.message });
  }
};