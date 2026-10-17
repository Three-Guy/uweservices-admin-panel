// frontend2/src/pages/checkout/CouponManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Percent,
  DollarSign,
  TrendingUp,
  Tag,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  Gift,
  RefreshCw,
  X,
  AlertCircle,
  Loader2,
  Check,
  Power,
  AlertTriangle,
  Calculator,
  ShoppingCart,
  Info,
} from 'lucide-react';
import { couponsApi } from '../../lib/api';
import type { Coupon, CouponStats, CouponFilters, CreateCouponData } from '../../types/checkout';

// ==================== STAT CARD ====================
const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  color, 
  bgColor 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number | string; 
  color: string; 
  bgColor: string;
}) => (
  <div className={`${bgColor} rounded-xl p-4 border border-gray-100`}>
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${color} bg-opacity-20 flex items-center justify-center`}>
        <Icon size={20} className={color.replace('bg-', 'text-')} />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);

// ==================== DELETE CONFIRM MODAL ====================
const DeleteConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  couponCode,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  couponCode: string;
  isLoading: boolean;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Coupon?</h3>
          <p className="text-gray-500 mb-1">
            Are you sure you want to delete coupon
          </p>
          <p className="font-mono font-bold text-red-600 text-lg mb-4">
            {couponCode}
          </p>
          <p className="text-sm text-gray-400">
            This action cannot be undone. All usage history will be lost.
          </p>
        </div>
        <div className="flex border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-6 py-4 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-6 py-4 bg-red-600 text-white font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={18} />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== TOAST NOTIFICATION ====================
const Toast = ({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-700',
    error: 'bg-red-50 border-red-200 text-red-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  };

  const icons = {
    success: <CheckCircle size={20} className="text-green-600" />,
    error: <AlertCircle size={20} className="text-red-600" />,
    info: <AlertCircle size={20} className="text-blue-600" />,
  };

  return (
    <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-xl border shadow-lg animate-slide-in ${colors[type]}`}>
      {icons[type]}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70">
        <X size={16} />
      </button>
    </div>
  );
};

// ==================== COUPON MODAL ====================
const CouponModal = ({
  isOpen,
  onClose,
  coupon,
  onSave,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  coupon: Coupon | null;
  onSave: (data: CreateCouponData) => Promise<void>;
  isLoading: boolean;
}) => {
  const [formData, setFormData] = useState<CreateCouponData>({
    code: '',
    name: '',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    maxDiscountAmount: null,
    minOrderValue: 0,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    usageLimit: {
      totalUses: null,
      perUser: 1,
    },
    applicableFor: 'all',
    isActive: true,
    isAutoApply: false,
  });

  useEffect(() => {
    if (coupon) {
      setFormData({
        code: coupon.code,
        name: coupon.name,
        description: coupon.description || '',
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
        minOrderValue: coupon.minOrderValue,
        validFrom: coupon.validFrom ? new Date(coupon.validFrom).toISOString().split('T')[0] : '',
        validUntil: coupon.validUntil ? new Date(coupon.validUntil).toISOString().split('T')[0] : '',
        usageLimit: coupon.usageLimit,
        applicableFor: coupon.applicableFor,
        isActive: coupon.isActive,
        isAutoApply: coupon.isAutoApply,
      });
    } else {
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      setFormData({
        code: '',
        name: '',
        description: '',
        discountType: 'percentage',
        discountValue: 10,
        maxDiscountAmount: null,
        minOrderValue: 0,
        validFrom: today.toISOString().split('T')[0],
        validUntil: nextMonth.toISOString().split('T')[0],
        usageLimit: {
          totalUses: null,
          perUser: 1,
        },
        applicableFor: 'all',
        isActive: true,
        isAutoApply: false,
      });
    }
  }, [coupon, isOpen]);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, code }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <Gift className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {coupon ? 'Edit Coupon' : 'Create New Coupon'}
              </h2>
              <p className="text-sm text-gray-500">
                {coupon ? 'Update coupon details' : 'Fill in the details to create a new coupon'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="space-y-6">
            {/* Code & Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coupon Code *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. SAVE20"
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent uppercase font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={generateCode}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Generate Code"
                  >
                    <RefreshCw size={18} className="text-gray-600" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coupon Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Summer Sale"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this coupon offers..."
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Discount Type & Value */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Type *
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, discountType: 'percentage' }))}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                      formData.discountType === 'percentage'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Percent size={18} />
                    Percentage
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, discountType: 'fixed' }))}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                      formData.discountType === 'fixed'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <DollarSign size={18} />
                    Fixed
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Value *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    {formData.discountType === 'percentage' ? '%' : '₹'}
                  </span>
                  <input
                    type="number"
                    value={formData.discountValue}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    max={formData.discountType === 'percentage' ? 100 : undefined}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Max Discount & Min Order */}
            <div className="grid grid-cols-2 gap-4">
              {formData.discountType === 'percentage' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Discount Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="number"
                      value={formData.maxDiscountAmount || ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        maxDiscountAmount: e.target.value ? parseFloat(e.target.value) : null 
                      }))}
                      placeholder="No limit"
                      min="0"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Leave empty for no limit</p>
                </div>
              )}
              <div className={formData.discountType === 'percentage' ? '' : 'col-span-2'}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Order Value
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                  <input
                    type="number"
                    value={formData.minOrderValue}
                    onChange={(e) => setFormData(prev => ({ ...prev, minOrderValue: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Validity Period */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valid From *
                </label>
                <input
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData(prev => ({ ...prev, validFrom: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valid Until *
                </label>
                <input
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                  min={formData.validFrom}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Usage Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Usage Limit
                </label>
                <input
                  type="number"
                  value={formData.usageLimit?.totalUses || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    usageLimit: {
                      ...prev.usageLimit!,
                      totalUses: e.target.value ? parseInt(e.target.value) : null,
                    }
                  }))}
                  placeholder="Unlimited"
                  min="1"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for unlimited</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Per User Limit *
                </label>
                <input
                  type="number"
                  value={formData.usageLimit?.perUser || 1}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    usageLimit: {
                      ...prev.usageLimit!,
                      perUser: parseInt(e.target.value) || 1,
                    }
                  }))}
                  min="1"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Applicable For */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Applicable For
              </label>
              <select
                value={formData.applicableFor}
                onChange={(e) => setFormData(prev => ({ ...prev, applicableFor: e.target.value as any }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Users</option>
                <option value="new_users">New Users Only</option>
                <option value="first_booking">First Booking Only</option>
                <option value="specific_users">Specific Users</option>
              </select>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isAutoApply}
                  onChange={(e) => setFormData(prev => ({ ...prev, isAutoApply: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-gray-700">Auto Apply</span>
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle size={18} />
                {coupon ? 'Update Coupon' : 'Create Coupon'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== COUPON CALCULATOR ====================
const CouponCalculator = ({ coupons }: { coupons: Coupon[] }) => {
  const [orderAmount, setOrderAmount] = useState<number>(500);
  const [selectedCouponId, setSelectedCouponId] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');
  const [useManualCode, setUseManualCode] = useState(false);
  const [result, setResult] = useState<{
    orderAmount: number;
    couponCode: string;
    couponName: string;
    discountType: string;
    discountValue: number;
    maxDiscountAmount: number | null;
    minOrderValue: number;
    calculatedDiscount: number;
    finalAmount: number;
    savings: number;
    savingsPercentage: number;
    isValid: boolean;
    message: string;
  } | null>(null);

  // Get active coupons only
  const activeCoupons = coupons.filter(c => c.isActive && !c.isExpired);

  const calculateDiscount = useCallback(() => {
    let coupon: Coupon | undefined;

    if (useManualCode && manualCode) {
      coupon = coupons.find(c => c.code.toUpperCase() === manualCode.toUpperCase());
      if (!coupon) {
        setResult({
          orderAmount,
          couponCode: manualCode.toUpperCase(),
          couponName: '',
          discountType: '',
          discountValue: 0,
          maxDiscountAmount: null,
          minOrderValue: 0,
          calculatedDiscount: 0,
          finalAmount: orderAmount,
          savings: 0,
          savingsPercentage: 0,
          isValid: false,
          message: 'Invalid coupon code',
        });
        return;
      }
    } else if (selectedCouponId) {
      coupon = coupons.find(c => c._id === selectedCouponId);
    }

    if (!coupon) {
      setResult(null);
      return;
    }

    if (orderAmount <= 0) {
      setResult({
        orderAmount: 0,
        couponCode: coupon.code,
        couponName: coupon.name,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
        minOrderValue: coupon.minOrderValue,
        calculatedDiscount: 0,
        finalAmount: 0,
        savings: 0,
        savingsPercentage: 0,
        isValid: false,
        message: 'Please enter a valid order amount',
      });
      return;
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      setResult({
        orderAmount,
        couponCode: coupon.code,
        couponName: coupon.name,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
        minOrderValue: coupon.minOrderValue,
        calculatedDiscount: 0,
        finalAmount: orderAmount,
        savings: 0,
        savingsPercentage: 0,
        isValid: false,
        message: 'This coupon is inactive',
      });
      return;
    }

    // Check if coupon is expired
    if (coupon.isExpired) {
      setResult({
        orderAmount,
        couponCode: coupon.code,
        couponName: coupon.name,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
        minOrderValue: coupon.minOrderValue,
        calculatedDiscount: 0,
        finalAmount: orderAmount,
        savings: 0,
        savingsPercentage: 0,
        isValid: false,
        message: 'This coupon has expired',
      });
      return;
    }

    // Check minimum order value
    if (orderAmount < coupon.minOrderValue) {
      setResult({
        orderAmount,
        couponCode: coupon.code,
        couponName: coupon.name,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
        minOrderValue: coupon.minOrderValue,
        calculatedDiscount: 0,
        finalAmount: orderAmount,
        savings: 0,
        savingsPercentage: 0,
        isValid: false,
        message: `Minimum order value is ₹${coupon.minOrderValue}`,
      });
      return;
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (orderAmount * coupon.discountValue) / 100;
      // Apply max discount cap
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount;
      }
    } else {
      discount = coupon.discountValue;
      // Fixed discount cannot exceed order amount
      if (discount > orderAmount) {
        discount = orderAmount;
      }
    }

    // Round to 2 decimal places
    discount = Math.round(discount * 100) / 100;
    const finalAmount = Math.round((orderAmount - discount) * 100) / 100;
    const savingsPercentage = Math.round((discount / orderAmount) * 100 * 100) / 100;

    setResult({
      orderAmount,
      couponCode: coupon.code,
      couponName: coupon.name,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountAmount: coupon.maxDiscountAmount,
      minOrderValue: coupon.minOrderValue,
      calculatedDiscount: discount,
      finalAmount,
      savings: discount,
      savingsPercentage,
      isValid: true,
      message: 'Coupon applied successfully!',
    });
  }, [orderAmount, selectedCouponId, manualCode, useManualCode, coupons]);

  // Auto-calculate when inputs change
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((useManualCode && manualCode) || (!useManualCode && selectedCouponId)) {
        calculateDiscount();
      } else {
        setResult(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [calculateDiscount, useManualCode, manualCode, selectedCouponId]);

  const handleReset = () => {
    setOrderAmount(500);
    setSelectedCouponId('');
    setManualCode('');
    setResult(null);
  };

  return (
    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center">
            <Calculator size={24} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Coupon Calculator</h3>
            <p className="text-sm text-gray-600">Test coupon discounts</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="p-2 hover:bg-orange-200 rounded-lg transition-colors"
          title="Reset Calculator"
        >
          <RefreshCw size={18} className="text-orange-600" />
        </button>
      </div>

      <div className="space-y-4 mb-6">
        {/* Order Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <ShoppingCart size={14} className="inline mr-1" />
            Order Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
            <input
              type="number"
              value={orderAmount}
              onChange={(e) => setOrderAmount(parseFloat(e.target.value) || 0)}
              placeholder="Enter order amount"
              min="0"
              className="w-full pl-10 pr-4 py-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
            />
          </div>
        </div>

        {/* Toggle between select and manual input */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setUseManualCode(false);
              setManualCode('');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              !useManualCode
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Select Coupon
          </button>
          <button
            onClick={() => {
              setUseManualCode(true);
              setSelectedCouponId('');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              useManualCode
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Enter Code
          </button>
        </div>

        {/* Coupon Selection or Manual Input */}
        {useManualCode ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Tag size={14} className="inline mr-1" />
              Enter Coupon Code
            </label>
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="e.g. SAVE20"
              className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white uppercase font-mono"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Tag size={14} className="inline mr-1" />
              Select Coupon
            </label>
            <select
              value={selectedCouponId}
              onChange={(e) => setSelectedCouponId(e.target.value)}
              className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
            >
              <option value="">Choose a coupon...</option>
              {activeCoupons.length > 0 ? (
                activeCoupons.map(coupon => (
                  <option key={coupon._id} value={coupon._id}>
                    {coupon.code} - {coupon.discountType === 'percentage' 
                      ? `${coupon.discountValue}% off` 
                      : `₹${coupon.discountValue} off`}
                    {coupon.minOrderValue > 0 ? ` (Min ₹${coupon.minOrderValue})` : ''}
                  </option>
                ))
              ) : (
                <option value="" disabled>No active coupons available</option>
              )}
            </select>
            {activeCoupons.length === 0 && (
              <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                <Info size={12} />
                Create some coupons to test them here
              </p>
            )}
          </div>
        )}

        <button
          onClick={calculateDiscount}
          disabled={(!useManualCode && !selectedCouponId) || (useManualCode && !manualCode) || orderAmount <= 0}
          className="w-full px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Calculator size={18} />
          Calculate Discount
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-white rounded-xl p-4 space-y-3">
          {/* Validity Status */}
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            result.isValid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {result.isValid ? <CheckCircle size={18} /> : <XCircle size={18} />}
            <span className="text-sm font-medium">{result.message}</span>
          </div>

          {/* Coupon Details */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Coupon Code</span>
              <span className="font-mono font-bold text-orange-600">{result.couponCode}</span>
            </div>
            {result.couponName && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Coupon Name</span>
                <span className="font-medium text-gray-900">{result.couponName}</span>
              </div>
            )}
            {result.discountType && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Discount Type</span>
                  <span className="font-medium capitalize flex items-center gap-1">
                    {result.discountType === 'percentage' ? (
                      <><Percent size={14} /> Percentage</>
                    ) : (
                      <><DollarSign size={14} /> Fixed Amount</>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Discount Value</span>
                  <span className="font-medium">
                    {result.discountType === 'percentage' 
                      ? `${result.discountValue}%` 
                      : `₹${result.discountValue}`}
                    {result.discountType === 'percentage' && result.maxDiscountAmount && (
                      <span className="text-gray-400 text-xs ml-1">(Max ₹{result.maxDiscountAmount})</span>
                    )}
                  </span>
                </div>
                {result.minOrderValue > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Min. Order Value</span>
                    <span className="font-medium">₹{result.minOrderValue}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <hr className="border-gray-200" />
          
          {/* Price Breakdown */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Order Amount</span>
              <span className="font-medium">₹{result.orderAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Discount</span>
              <span className={`font-medium ${result.isValid ? 'text-green-600' : 'text-gray-400'}`}>
                {result.isValid ? `- ₹${result.calculatedDiscount.toFixed(2)}` : '₹0.00'}
              </span>
            </div>
            
            {result.isValid && result.savingsPercentage > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">You Save</span>
                <span className="font-medium text-green-600">
                  {result.savingsPercentage.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          
          <hr className="border-gray-200" />
          
          {/* Final Amount */}
          <div className="flex justify-between items-center pt-1">
            <span className="font-semibold text-gray-900">Final Amount</span>
            <div className="text-right">
              <span className="text-2xl font-bold text-orange-600">
                ₹{result.finalAmount.toFixed(2)}
              </span>
              {result.isValid && result.savings > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  Saving ₹{result.savings.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!result && (
        <div className="bg-white/50 rounded-xl p-6 text-center">
          <Calculator size={32} className="text-orange-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            Enter an order amount and select a coupon to see the discount calculation
          </p>
        </div>
      )}
    </div>
  );
};

// ==================== QUICK INFO CARD ====================
const QuickInfoCard = ({ coupons, stats }: { coupons: Coupon[]; stats: CouponStats | null }) => {
  const activeCoupons = coupons.filter(c => c.isActive && !c.isExpired);
  const expiredCoupons = coupons.filter(c => c.isExpired);
  const percentageCoupons = coupons.filter(c => c.discountType === 'percentage');
  const fixedCoupons = coupons.filter(c => c.discountType === 'fixed');

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Info size={18} className="text-gray-500" />
        Quick Overview
      </h3>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-gray-500">Total Coupons</span>
          <span className="font-semibold text-gray-900">{coupons.length}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-gray-500 flex items-center gap-1">
            <CheckCircle size={14} className="text-green-500" />
            Active
          </span>
          <span className="font-semibold text-green-600">{activeCoupons.length}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-gray-500 flex items-center gap-1">
            <Clock size={14} className="text-red-500" />
            Expired
          </span>
          <span className="font-semibold text-red-500">{expiredCoupons.length}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-gray-500 flex items-center gap-1">
            <Percent size={14} className="text-purple-500" />
            Percentage
          </span>
          <span className="font-semibold text-purple-600">{percentageCoupons.length}</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-gray-500 flex items-center gap-1">
            <DollarSign size={14} className="text-blue-500" />
            Fixed Amount
          </span>
          <span className="font-semibold text-blue-600">{fixedCoupons.length}</span>
        </div>
      </div>

      {stats && stats.totalUsage > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Performance
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Total Usage</span>
              <span className="font-semibold text-gray-900">{stats.totalUsage}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Total Discount Given</span>
              <span className="font-semibold text-orange-600">₹{stats.totalDiscountGiven}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== HOW IT WORKS CARD ====================
const HowItWorksCard = () => (
  <div className="bg-white rounded-2xl border border-gray-100 p-6">
    <h3 className="font-semibold text-gray-900 mb-4">How Coupons Work</h3>
    <div className="space-y-3 text-sm text-gray-600">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-bold text-orange-600">1</span>
        </div>
        <p><strong>Percentage:</strong> Discount is calculated as a percentage of the order amount</p>
      </div>
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-bold text-orange-600">2</span>
        </div>
        <p><strong>Fixed:</strong> A flat amount is deducted from the order total</p>
      </div>
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-bold text-orange-600">3</span>
        </div>
        <p><strong>Max Discount:</strong> Caps the maximum discount for percentage coupons</p>
      </div>
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-bold text-orange-600">4</span>
        </div>
        <p><strong>Min Order:</strong> Minimum order value required to apply the coupon</p>
      </div>
    </div>
  </div>
);

// ==================== MAIN COMPONENT ====================
export default function CouponManagement() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<CouponStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Toggling state - tracks which coupon is being toggled
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Dropdown menu
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Show toast helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  // Fetch coupons
  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params: CouponFilters = {
        page,
        limit: 10,
        search: search || undefined,
        isActive: filterActive || undefined,
        discountType: filterType || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      const response = await couponsApi.getAll(params);
      if (response.success) {
        setCoupons(response.data.coupons);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch coupons');
    } finally {
      setLoading(false);
    }
  }, [page, search, filterActive, filterType]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const response = await couponsApi.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenu(null);
    if (openMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenu]);

  // Handle save coupon
  const handleSaveCoupon = async (data: CreateCouponData) => {
    try {
      setSaving(true);
      setError('');

      if (selectedCoupon) {
        await couponsApi.update(selectedCoupon._id, data);
        showToast(`Coupon "${data.code}" updated successfully`, 'success');
      } else {
        await couponsApi.create(data);
        showToast(`Coupon "${data.code}" created successfully`, 'success');
      }

      setModalOpen(false);
      setSelectedCoupon(null);
      fetchCoupons();
      fetchStats();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to save coupon';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete coupon
  const handleDeleteCoupon = async () => {
    if (!couponToDelete) return;

    try {
      setDeleting(true);
      await couponsApi.delete(couponToDelete._id);
      showToast(`Coupon "${couponToDelete.code}" deleted successfully`, 'success');
      setDeleteModalOpen(false);
      setCouponToDelete(null);
      fetchCoupons();
      fetchStats();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to delete coupon';
      showToast(errorMsg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Open delete confirmation
  const openDeleteConfirm = (coupon: Coupon) => {
    setCouponToDelete(coupon);
    setDeleteModalOpen(true);
    setOpenMenu(null);
  };

  // Handle toggle status
  const handleToggleStatus = async (coupon: Coupon) => {
    try {
      setTogglingId(coupon._id);
      setOpenMenu(null);
      
      const newStatus = !coupon.isActive;
      await couponsApi.toggleStatus(coupon._id, newStatus);
      
      showToast(
        `Coupon "${coupon.code}" ${newStatus ? 'activated' : 'deactivated'} successfully`,
        'success'
      );
      
      fetchCoupons();
      fetchStats();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to toggle status';
      showToast(errorMsg, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  // Copy code to clipboard
  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      showToast(`Coupon code "${code}" copied!`, 'info');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coupon Management</h1>
          <p className="text-gray-500 mt-1">Create and manage discount coupons for your customers</p>
        </div>
        <button
          onClick={() => {
            setSelectedCoupon(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 font-medium"
        >
          <Plus size={20} />
          Create Coupon
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statsLoading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl p-4 animate-pulse h-20" />
          ))
        ) : stats ? (
          <>
            <StatCard icon={Tag} label="Total Coupons" value={stats.totalCoupons} color="bg-blue-500" bgColor="bg-blue-50" />
            <StatCard icon={CheckCircle} label="Active" value={stats.activeCoupons} color="bg-green-500" bgColor="bg-green-50" />
            <StatCard icon={TrendingUp} label="Total Usage" value={stats.totalUsage} color="bg-purple-500" bgColor="bg-purple-50" />
            <StatCard icon={DollarSign} label="Discount Given" value={`₹${stats.totalDiscountGiven}`} color="bg-orange-500" bgColor="bg-orange-50" />
          </>
        ) : null}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="hover:opacity-70">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Main Layout - 3 Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Filters & Table (2 cols on lg) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by code or name..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {/* Status Filter */}
              <select
                value={filterActive}
                onChange={(e) => {
                  setFilterActive(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent min-w-[140px]"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>

              {/* Type Filter */}
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent min-w-[140px]"
              >
                <option value="">All Types</option>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>

              {/* Refresh */}
              <button
                onClick={() => {
                  fetchCoupons();
                  fetchStats();
                }}
                className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                title="Refresh"
              >
                <RefreshCw size={20} />
              </button>
            </div>
          </div>

          {/* Coupons Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : coupons.length === 0 ? (
              <div className="text-center py-20">
                <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700">No Coupons Found</h3>
                <p className="text-gray-500 mt-1">Create your first coupon to get started</p>
                <button
                  onClick={() => {
                    setSelectedCoupon(null);
                    setModalOpen(true);
                  }}
                  className="mt-4 px-5 py-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-all font-medium inline-flex items-center gap-2"
                >
                  <Plus size={18} />
                  Create Coupon
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Discount</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Validity</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usage</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {coupons.map((coupon) => {
                      const isToggling = togglingId === coupon._id;
                      
                      return (
                        <tr key={coupon._id} className="hover:bg-gray-50 transition-colors group">
                          {/* Code */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                coupon.discountType === 'percentage' ? 'bg-purple-100' : 'bg-green-100'
                              }`}>
                                {coupon.discountType === 'percentage' ? (
                                  <Percent className="w-5 h-5 text-purple-600" />
                                ) : (
                                  <DollarSign className="w-5 h-5 text-green-600" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-gray-900">{coupon.code}</span>
                                  <button
                                    onClick={() => copyCode(coupon.code)}
                                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                                    title="Copy code"
                                  >
                                    {copiedCode === coupon.code ? (
                                      <Check size={14} className="text-green-500" />
                                    ) : (
                                      <Copy size={14} className="text-gray-400" />
                                    )}
                                  </button>
                                </div>
                                <p className="text-sm text-gray-500">{coupon.name}</p>
                              </div>
                            </div>
                          </td>

                          {/* Discount */}
                          <td className="px-6 py-4">
                            <div>
                              <span className="font-semibold text-gray-900">
                                {coupon.discountType === 'percentage' 
                                  ? `${coupon.discountValue}%` 
                                  : `₹${coupon.discountValue}`
                                }
                              </span>
                              {coupon.discountType === 'percentage' && coupon.maxDiscountAmount && (
                                <p className="text-xs text-gray-500">Max ₹{coupon.maxDiscountAmount}</p>
                              )}
                              {coupon.minOrderValue > 0 && (
                                <p className="text-xs text-gray-500">Min order ₹{coupon.minOrderValue}</p>
                              )}
                            </div>
                          </td>

                          {/* Validity */}
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <p className="text-gray-700">{formatDate(coupon.validFrom)}</p>
                              <p className="text-gray-500">to {formatDate(coupon.validUntil)}</p>
                              {coupon.isExpired && (
                                <span className="inline-flex items-center gap-1 text-xs text-red-600 mt-1">
                                  <Clock size={12} />
                                  Expired
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Usage */}
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <span className="font-medium text-gray-900">{coupon.currentUsageCount}</span>
                              <span className="text-gray-500">
                                {' / '}
                                {coupon.usageLimit?.totalUses || '∞'}
                              </span>
                              <p className="text-xs text-gray-500">
                                {coupon.usageLimit?.perUser || 1} per user
                              </p>
                            </div>
                          </td>

                          {/* Status - Inline Toggle */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-center gap-1.5">
                              <button
                                onClick={() => handleToggleStatus(coupon)}
                                disabled={isToggling}
                                className={`relative w-12 h-7 rounded-full transition-colors ${
                                  coupon.isActive ? 'bg-green-500' : 'bg-gray-300'
                                } ${isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                title={coupon.isActive ? 'Click to deactivate' : 'Click to activate'}
                              >
                                {isToggling ? (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader2 size={14} className="animate-spin text-white" />
                                  </div>
                                ) : (
                                  <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${
                                    coupon.isActive ? 'left-5.5 translate-x-0' : 'left-0.5'
                                  }`} 
                                  style={{ left: coupon.isActive ? '22px' : '2px' }}
                                  />
                                )}
                              </button>
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                                coupon.isActive && !coupon.isExpired ? 'text-green-600' : 'text-gray-400'
                              }`}>
                                {coupon.isExpired ? 'Expired' : coupon.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {/* Edit Button */}
                              <button
                                onClick={() => {
                                  setSelectedCoupon(coupon);
                                  setModalOpen(true);
                                }}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit coupon"
                              >
                                <Edit2 size={16} />
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => openDeleteConfirm(coupon)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete coupon"
                              >
                                <Trash2 size={16} />
                              </button>

                              {/* More Menu */}
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenu(openMenu === coupon._id ? null : coupon._id);
                                  }}
                                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                  <MoreVertical size={16} />
                                </button>

                                {openMenu === coupon._id && (
                                  <div 
                                    className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 z-20 py-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {/* Edit */}
                                    <button
                                      onClick={() => {
                                        setSelectedCoupon(coupon);
                                        setModalOpen(true);
                                        setOpenMenu(null);
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                      <Edit2 size={16} className="text-gray-500" />
                                      Edit Coupon
                                    </button>

                                    {/* Toggle Status */}
                                    <button
                                      onClick={() => handleToggleStatus(coupon)}
                                      disabled={isToggling}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                    >
                                      <Power size={16} className={coupon.isActive ? 'text-red-500' : 'text-green-500'} />
                                      {coupon.isActive ? 'Deactivate' : 'Activate'}
                                    </button>

                                    {/* Copy Code */}
                                    <button
                                      onClick={() => {
                                        copyCode(coupon.code);
                                        setOpenMenu(null);
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                      <Copy size={16} className="text-gray-500" />
                                      Copy Code
                                    </button>

                                    <hr className="my-2 border-gray-100" />

                                    {/* Delete */}
                                    <button
                                      onClick={() => openDeleteConfirm(coupon)}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      <Trash2 size={16} />
                                      Delete Coupon
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Calculator & Info */}
        <div className="space-y-6">
          {/* Coupon Calculator */}
          <CouponCalculator coupons={coupons} />

          {/* Quick Info */}
          <QuickInfoCard coupons={coupons} stats={stats} />

          {/* How It Works */}
          <HowItWorksCard />
        </div>
      </div>

      {/* Coupon Modal */}
      <CouponModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedCoupon(null);
        }}
        coupon={selectedCoupon}
        onSave={handleSaveCoupon}
        isLoading={saving}
      />

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setCouponToDelete(null);
        }}
        onConfirm={handleDeleteCoupon}
        couponCode={couponToDelete?.code || ''}
        isLoading={deleting}
      />
    </div>
  );
}