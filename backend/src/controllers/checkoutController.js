// backend/src/controllers/checkoutController.js
const { getCheckoutSettingsModel } = require('../config/database');

// ==================== GET CHECKOUT SETTINGS ====================
exports.getCheckoutSettings = async (req, res) => {
  try {
    const CheckoutSettings = getCheckoutSettingsModel();
    const settings = await CheckoutSettings.getActiveSettings();

    res.status(200).json({
      success: true,
      data: {
        settings: {
          ...settings.toObject(),
          id: settings._id,
        },
      },
    });
  } catch (error) {
    console.error('Get checkout settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch checkout settings',
      error: error.message,
    });
  }
};

// ==================== UPDATE CHECKOUT SETTINGS ====================
exports.updateCheckoutSettings = async (req, res) => {
  try {
    const CheckoutSettings = getCheckoutSettingsModel();
    const updates = req.body;

    // Get current settings or create new one
    let settings = await CheckoutSettings.findOne({ isActive: true });

    if (!settings) {
      settings = new CheckoutSettings({
        ...updates,
        isActive: true,
        updatedBy: req.admin?._id || req.user?._id,
      });
    } else {
      // Update existing settings
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          settings[key] = updates[key];
        }
      });
      settings.updatedBy = req.admin?._id || req.user?._id;
    }

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Checkout settings updated successfully',
      data: {
        settings: {
          ...settings.toObject(),
          id: settings._id,
        },
      },
    });
  } catch (error) {
    console.error('Update checkout settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update checkout settings',
      error: error.message,
    });
  }
};

// ==================== UPDATE SERVICE FEE ====================
exports.updateServiceFee = async (req, res) => {
  try {
    const CheckoutSettings = getCheckoutSettingsModel();
    const { type, value, maxAmount } = req.body;

    if (!type || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Type and value are required',
      });
    }

    let settings = await CheckoutSettings.findOne({ isActive: true });
    if (!settings) {
      settings = new CheckoutSettings({ isActive: true });
    }

    settings.serviceFee = {
      type,
      value: parseFloat(value),
      maxAmount: maxAmount ? parseFloat(maxAmount) : null,
    };
    settings.updatedBy = req.admin?._id || req.user?._id;

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Service fee updated successfully',
      data: { serviceFee: settings.serviceFee },
    });
  } catch (error) {
    console.error('Update service fee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service fee',
      error: error.message,
    });
  }
};

// ==================== UPDATE PLATFORM FEE ====================
exports.updatePlatformFee = async (req, res) => {
  try {
    const CheckoutSettings = getCheckoutSettingsModel();
    const { type, value, maxAmount } = req.body;

    if (!type || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Type and value are required',
      });
    }

    let settings = await CheckoutSettings.findOne({ isActive: true });
    if (!settings) {
      settings = new CheckoutSettings({ isActive: true });
    }

    settings.platformFee = {
      type,
      value: parseFloat(value),
      maxAmount: maxAmount ? parseFloat(maxAmount) : null,
    };
    settings.updatedBy = req.admin?._id || req.user?._id;

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Platform fee updated successfully',
      data: { platformFee: settings.platformFee },
    });
  } catch (error) {
    console.error('Update platform fee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update platform fee',
      error: error.message,
    });
  }
};

// ==================== UPDATE TAX ====================
exports.updateTax = async (req, res) => {
  try {
    const CheckoutSettings = getCheckoutSettingsModel();
    const { type, value, name } = req.body;

    if (!type || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Type and value are required',
      });
    }

    let settings = await CheckoutSettings.findOne({ isActive: true });
    if (!settings) {
      settings = new CheckoutSettings({ isActive: true });
    }

    settings.tax = {
      type,
      value: parseFloat(value),
      name: name || 'GST',
    };
    settings.updatedBy = req.admin?._id || req.user?._id;

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Tax updated successfully',
      data: { tax: settings.tax },
    });
  } catch (error) {
    console.error('Update tax error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tax',
      error: error.message,
    });
  }
};

// ==================== UPDATE PAYMENT METHODS ====================
exports.updatePaymentMethods = async (req, res) => {
  try {
    const CheckoutSettings = getCheckoutSettingsModel();
    const { paymentMethods } = req.body;

    if (!paymentMethods) {
      return res.status(400).json({
        success: false,
        message: 'Payment methods are required',
      });
    }

    let settings = await CheckoutSettings.findOne({ isActive: true });
    if (!settings) {
      settings = new CheckoutSettings({ isActive: true });
    }

    settings.paymentMethods = {
      ...settings.paymentMethods,
      ...paymentMethods,
    };
    settings.updatedBy = req.admin?._id || req.user?._id;

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Payment methods updated successfully',
      data: { paymentMethods: settings.paymentMethods },
    });
  } catch (error) {
    console.error('Update payment methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment methods',
      error: error.message,
    });
  }
};

// ==================== TOGGLE PAYMENT METHOD ====================
// ==================== TOGGLE PAYMENT METHOD ====================
exports.togglePaymentMethod = async (req, res) => {
  try {
    const CheckoutSettings = getCheckoutSettingsModel();
    const { method } = req.params;
    const { enabled } = req.body;

    // Map URL param to settings key
    const methodMap = {
      'pay-after': 'payAfterService',
      'google-pay': 'googlePay',
      'phonepe': 'phonePe',
      'paytm': 'paytm',
      'amazon-pay': 'amazonPay',
      'card': 'card',
      'net-banking': 'netBanking',
      'wallet': 'wallet',
      'cash-on-delivery': 'cashOnDelivery',
      'new-upi': 'newUpi',
    };

    const settingsKey = methodMap[method];
    if (!settingsKey) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method',
      });
    }

    let settings = await CheckoutSettings.findOne({ isActive: true });
    if (!settings) {
      settings = new CheckoutSettings({ isActive: true });
    }

    settings.paymentMethods[settingsKey].enabled = enabled;
    settings.updatedBy = req.admin?._id || req.user?._id;

    await settings.save();

    res.status(200).json({
      success: true,
      message: `Payment method ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: { paymentMethods: settings.paymentMethods },
    });
  } catch (error) {
    console.error('Toggle payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle payment method',
      error: error.message,
    });
  }
};

// ==================== GET PAYMENT METHODS (Public) ====================
exports.getPaymentMethods = async (req, res) => {
  try {
    const CheckoutSettings = getCheckoutSettingsModel();
    const settings = await CheckoutSettings.getActiveSettings();

    const paymentMethods = [];
    const pm = settings.paymentMethods;

    // Define all payment methods with their API keys
    const methodConfigs = [
      { key: 'payAfterService', apiKey: 'pay-after', popular: true },
      { key: 'googlePay', apiKey: 'google-pay' },
      { key: 'phonePe', apiKey: 'phonepe' },
      { key: 'paytm', apiKey: 'paytm' },
      { key: 'amazonPay', apiKey: 'amazon-pay' },
      { key: 'card', apiKey: 'card' },
      { key: 'netBanking', apiKey: 'net-banking' },
      { key: 'wallet', apiKey: 'wallet' },
      { key: 'cashOnDelivery', apiKey: 'cash-on-delivery' },
      { key: 'newUpi', apiKey: 'upi' },
    ];

    for (const config of methodConfigs) {
      const method = pm[config.key];
      if (method && method.enabled) {
        paymentMethods.push({
          id: config.key,
          key: config.apiKey,
          label: method.label,
          description: method.description,
          icon: method.icon,
          enabled: true,
          popular: config.popular || false,
          sortOrder: method.sortOrder || 0,
        });
      }
    }

    // Sort by sortOrder
    paymentMethods.sort((a, b) => a.sortOrder - b.sortOrder);

    res.status(200).json({
      success: true,
      data: { paymentMethods },
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment methods',
      error: error.message,
    });
  }
};
// ==================== CALCULATE CHECKOUT PRICE ====================
exports.calculatePrice = async (req, res) => {
  try {
    const CheckoutSettings = getCheckoutSettingsModel();
    const { getCouponModel } = require('../config/database');
    const Coupon = getCouponModel();
    
    const { basePrice, couponCode, userId } = req.body;

    if (!basePrice) {
      return res.status(400).json({
        success: false,
        message: 'Base price is required',
      });
    }

    // Get checkout settings
    const settings = await CheckoutSettings.getActiveSettings();
    
    // Calculate fees
    const fees = settings.calculateFees(parseFloat(basePrice));

    let couponDiscount = 0;
    let couponInfo = null;

    // Apply coupon if provided
    if (couponCode) {
      const couponResult = await Coupon.validateCoupon(
        couponCode,
        userId || req.user?._id,
        fees.total
      );

      if (couponResult.valid) {
        couponDiscount = couponResult.discount;
        couponInfo = {
          code: couponResult.coupon.code,
          name: couponResult.coupon.name,
          discountType: couponResult.coupon.discountType,
          discountValue: couponResult.coupon.discountValue,
          discount: couponDiscount,
        };
      }
    }

    // Calculate final total
    const finalTotal = Math.round((fees.total - couponDiscount) * 100) / 100;

    // Calculate original price (for showing discount)
    const originalPrice = settings.defaultDiscount.enabled 
      ? Math.round((fees.total / (1 - settings.defaultDiscount.percentage / 100)) * 100) / 100
      : fees.total;

    res.status(200).json({
      success: true,
      data: {
        basePrice: fees.basePrice,
        serviceFee: fees.serviceFee,
        platformFee: fees.platformFee,
        subtotal: fees.subtotal,
        tax: fees.tax,
        taxName: settings.tax.name,
        coupon: couponInfo,
        couponDiscount,
        total: fees.total,
        finalTotal,
        originalPrice,
        discountPercentage: settings.defaultDiscount.enabled ? settings.defaultDiscount.percentage : 0,
        currency: settings.currency,
        currencySymbol: settings.currencySymbol,
      },
    });
  } catch (error) {
    console.error('Calculate price error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate price',
      error: error.message,
    });
  }
};

// ==================== GET PAYMENT METHODS (Public) ====================
exports.getPaymentMethods = async (req, res) => {
  try {
    const CheckoutSettings = getCheckoutSettingsModel();
    const settings = await CheckoutSettings.getActiveSettings();

    const paymentMethods = [];
    const pm = settings.paymentMethods;

    if (pm.payAfterService.enabled) {
      paymentMethods.push({
        id: 'pay_after',
        key: 'pay-after',
        label: pm.payAfterService.label,
        description: pm.payAfterService.description,
        icon: pm.payAfterService.icon,
        enabled: true,
        popular: true,
      });
    }

    if (pm.googlePay.enabled) {
      paymentMethods.push({
        id: 'gpay',
        key: 'google-pay',
        label: pm.googlePay.label,
        description: pm.googlePay.description,
        icon: pm.googlePay.icon,
        enabled: true,
      });
    }

    if (pm.phonePe.enabled) {
      paymentMethods.push({
        id: 'phonepe',
        key: 'phonepe',
        label: pm.phonePe.label,
        description: pm.phonePe.description,
        icon: pm.phonePe.icon,
        enabled: true,
      });
    }

    if (pm.newUpi.enabled) {
      paymentMethods.push({
        id: 'new_upi',
        key: 'upi',
        label: pm.newUpi.label,
        description: pm.newUpi.description,
        icon: pm.newUpi.icon,
        enabled: true,
      });
    }

    res.status(200).json({
      success: true,
      data: { paymentMethods },
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment methods',
      error: error.message,
    });
  }
};