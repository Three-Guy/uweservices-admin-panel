// backend/src/controllers/couponController.js
const { getCouponModel } = require('../config/database');

// ==================== GET ALL COUPONS ====================
exports.getAllCoupons = async (req, res) => {
  try {
    const Coupon = getCouponModel();
    
    const {
      page = 1,
      limit = 10,
      search = '',
      isActive,
      discountType,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (isActive !== undefined && isActive !== '') {
      query.isActive = isActive === 'true';
    }

    if (discountType) {
      query.discountType = discountType;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query
    const [coupons, total] = await Promise.all([
      Coupon.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Coupon.countDocuments(query),
    ]);

    // Add computed fields
    const now = new Date();
    const enrichedCoupons = coupons.map(coupon => ({
      ...coupon,
      id: coupon._id,
      isExpired: now > new Date(coupon.validUntil),
      isValid: coupon.isActive && now >= new Date(coupon.validFrom) && now <= new Date(coupon.validUntil),
      remainingUses: coupon.usageLimit?.totalUses 
        ? Math.max(0, coupon.usageLimit.totalUses - (coupon.currentUsageCount || 0))
        : 'Unlimited',
    }));

    res.status(200).json({
      success: true,
      data: {
        coupons: enrichedCoupons,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
          hasNext: skip + parseInt(limit) < total,
          hasPrev: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coupons',
      error: error.message,
    });
  }
};

// ==================== GET COUPON STATS ====================
exports.getCouponStats = async (req, res) => {
  try {
    const Coupon = getCouponModel();
    const now = new Date();

    const [
      totalCoupons,
      activeCoupons,
      expiredCoupons,
      percentageCoupons,
      fixedCoupons,
    ] = await Promise.all([
      Coupon.countDocuments(),
      Coupon.countDocuments({ isActive: true, validUntil: { $gte: now } }),
      Coupon.countDocuments({ validUntil: { $lt: now } }),
      Coupon.countDocuments({ discountType: 'percentage' }),
      Coupon.countDocuments({ discountType: 'fixed' }),
    ]);

    // Get total discount given
    const usageStats = await Coupon.aggregate([
      { $unwind: { path: '$usedBy', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          totalUsage: { $sum: { $cond: [{ $ifNull: ['$usedBy', false] }, 1, 0] } },
          totalDiscountGiven: { $sum: { $ifNull: ['$usedBy.discountApplied', 0] } },
        },
      },
    ]);

    const totalUsage = usageStats[0]?.totalUsage || 0;
    const totalDiscountGiven = usageStats[0]?.totalDiscountGiven || 0;

    res.status(200).json({
      success: true,
      data: {
        totalCoupons,
        activeCoupons,
        inactiveCoupons: totalCoupons - activeCoupons,
        expiredCoupons,
        percentageCoupons,
        fixedCoupons,
        totalUsage,
        totalDiscountGiven: Math.round(totalDiscountGiven * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Get coupon stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coupon stats',
      error: error.message,
    });
  }
};

// ==================== GET SINGLE COUPON ====================
exports.getCouponById = async (req, res) => {
  try {
    const Coupon = getCouponModel();
    const { id } = req.params;

    const coupon = await Coupon.findById(id).lean();

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        coupon: {
          ...coupon,
          id: coupon._id,
        },
      },
    });
  } catch (error) {
    console.error('Get coupon by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coupon',
      error: error.message,
    });
  }
};

// ==================== CREATE COUPON ====================
exports.createCoupon = async (req, res) => {
  try {
    const Coupon = getCouponModel();
    
    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderValue,
      validFrom,
      validUntil,
      usageLimit,
      applicableFor,
      specificUsers,
      applicableServices,
      applicableCategories,
      isActive,
      isAutoApply,
    } = req.body;

    // Validate required fields
    if (!code || !name || !discountType || discountValue === undefined || !validUntil) {
      return res.status(400).json({
        success: false,
        message: 'Code, name, discount type, discount value, and valid until date are required',
      });
    }

    // Check if code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists',
      });
    }

    // Create coupon
    const coupon = new Coupon({
      code: code.toUpperCase(),
      name,
      description: description || '',
      discountType,
      discountValue,
      maxDiscountAmount: maxDiscountAmount || null,
      minOrderValue: minOrderValue || 0,
      validFrom: validFrom || new Date(),
      validUntil,
      usageLimit: {
        totalUses: usageLimit?.totalUses || null,
        perUser: usageLimit?.perUser || 1,
      },
      applicableFor: applicableFor || 'all',
      specificUsers: specificUsers || [],
      applicableServices: applicableServices || [],
      applicableCategories: applicableCategories || [],
      isActive: isActive !== undefined ? isActive : true,
      isAutoApply: isAutoApply || false,
      createdBy: req.admin?._id || req.user?._id,
    });

    await coupon.save();

    console.log('✅ Coupon created:', coupon.code);

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data: {
        coupon: {
          ...coupon.toObject(),
          id: coupon._id,
        },
      },
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create coupon',
      error: error.message,
    });
  }
};

// ==================== UPDATE COUPON ====================
exports.updateCoupon = async (req, res) => {
  try {
    const Coupon = getCouponModel();
    const { id } = req.params;
    const updates = req.body;

    // Check if coupon exists
    const existingCoupon = await Coupon.findById(id);
    if (!existingCoupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    // If updating code, check uniqueness
    if (updates.code && updates.code.toUpperCase() !== existingCoupon.code) {
      const codeExists = await Coupon.findOne({ 
        code: updates.code.toUpperCase(),
        _id: { $ne: id },
      });
      if (codeExists) {
        return res.status(400).json({
          success: false,
          message: 'Coupon code already exists',
        });
      }
      updates.code = updates.code.toUpperCase();
    }

    // Add updatedBy
    updates.updatedBy = req.admin?._id || req.user?._id;

    const coupon = await Coupon.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    console.log('✅ Coupon updated:', coupon.code);

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      data: {
        coupon: {
          ...coupon.toObject(),
          id: coupon._id,
        },
      },
    });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update coupon',
      error: error.message,
    });
  }
};

// ==================== DELETE COUPON ====================
exports.deleteCoupon = async (req, res) => {
  try {
    const Coupon = getCouponModel();
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    await Coupon.findByIdAndDelete(id);

    console.log('✅ Coupon deleted:', coupon.code);

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete coupon',
      error: error.message,
    });
  }
};

// ==================== TOGGLE COUPON STATUS ====================
exports.toggleCouponStatus = async (req, res) => {
  try {
    const Coupon = getCouponModel();
    const { id } = req.params;
    const { isActive } = req.body;

    const coupon = await Coupon.findByIdAndUpdate(
      id,
      { 
        $set: { 
          isActive,
          updatedBy: req.admin?._id || req.user?._id,
        } 
      },
      { new: true }
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    console.log(`✅ Coupon ${isActive ? 'activated' : 'deactivated'}:`, coupon.code);

    res.status(200).json({
      success: true,
      message: `Coupon ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        coupon: {
          ...coupon.toObject(),
          id: coupon._id,
        },
      },
    });
  } catch (error) {
    console.error('Toggle coupon status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle coupon status',
      error: error.message,
    });
  }
};

// ==================== VALIDATE COUPON (Public) ====================
exports.validateCoupon = async (req, res) => {
  try {
    const Coupon = getCouponModel();
    const { code, orderAmount, userId } = req.body;

    if (!code || !orderAmount) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code and order amount are required',
      });
    }

    const result = await Coupon.validateCoupon(
      code, 
      userId || req.user?._id, 
      parseFloat(orderAmount)
    );

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Coupon is valid',
      data: {
        code: result.coupon.code,
        name: result.coupon.name,
        discountType: result.coupon.discountType,
        discountValue: result.coupon.discountValue,
        discount: result.discount,
        finalAmount: result.finalAmount,
      },
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate coupon',
      error: error.message,
    });
  }
};

// ==================== GET COUPON USAGE HISTORY ====================
exports.getCouponUsageHistory = async (req, res) => {
  try {
    const Coupon = getCouponModel();
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const coupon = await Coupon.findById(id)
      .populate('usedBy.user', 'name email')
      .populate('usedBy.orderId', 'bookingId totalAmount')
      .lean();

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    const usageHistory = coupon.usedBy || [];
    const total = usageHistory.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const paginatedHistory = usageHistory
      .sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))
      .slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        couponCode: coupon.code,
        totalUsage: total,
        usageHistory: paginatedHistory,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get coupon usage history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coupon usage history',
      error: error.message,
    });
  }
};