// frontend2/src/types/checkout.ts

// ==================== COUPON TYPES ====================
export interface CouponUsage {
  user: {
    _id: string;
    name: string;
    email: string;
  };
  usedAt: string;
  orderId?: {
    _id: string;
    bookingId: string;
    totalAmount: number;
  };
  discountApplied: number;
}

export interface Coupon {
  _id: string;
  id: string;
  code: string;
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscountAmount: number | null;
  minOrderValue: number;
  validFrom: string;
  validUntil: string;
  usageLimit: {
    totalUses: number | null;
    perUser: number;
  };
  currentUsageCount: number;
  usedBy: CouponUsage[];
  applicableFor: 'all' | 'new_users' | 'specific_users' | 'first_booking';
  specificUsers: string[];
  applicableServices: string[];
  applicableCategories: string[];
  isActive: boolean;
  isAutoApply: boolean;
  isExpired: boolean;
  isValid: boolean;
  remainingUses: number | string;
  createdAt: string;
  updatedAt: string;
}

export interface CouponFilters {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: string;
  discountType?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface CouponStats {
  totalCoupons: number;
  activeCoupons: number;
  inactiveCoupons: number;
  expiredCoupons: number;
  percentageCoupons: number;
  fixedCoupons: number;
  totalUsage: number;
  totalDiscountGiven: number;
}

export interface CreateCouponData {
  code: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderValue?: number;
  validFrom?: string;
  validUntil: string;
  usageLimit?: {
    totalUses?: number | null;
    perUser?: number;
  };
  applicableFor?: 'all' | 'new_users' | 'specific_users' | 'first_booking';
  specificUsers?: string[];
  applicableServices?: string[];
  applicableCategories?: string[];
  isActive?: boolean;
  isAutoApply?: boolean;
}

// ==================== CHECKOUT SETTINGS TYPES ====================
export interface FeeConfig {
  type: 'fixed' | 'percentage';
  value: number;
  maxAmount?: number | null;
}

export interface TaxConfig {
  type: 'fixed' | 'percentage';
  value: number;
  name: string;
}

export interface PaymentMethodConfig {
  enabled: boolean;
  label: string;
  description: string;
  icon: string;
}

export interface PaymentMethodConfig {
  enabled: boolean;
  label: string;
  description: string;
  icon: string;
  sortOrder?: number;
}

export interface PaymentMethodsConfig {
  payAfterService: PaymentMethodConfig;
  googlePay: PaymentMethodConfig;
  phonePe: PaymentMethodConfig;
  paytm: PaymentMethodConfig;
  amazonPay: PaymentMethodConfig;
  card: PaymentMethodConfig;
  netBanking: PaymentMethodConfig;
  wallet: PaymentMethodConfig;
  cashOnDelivery: PaymentMethodConfig;
  newUpi: PaymentMethodConfig;
}

export interface DefaultDiscountConfig {
  enabled: boolean;
  percentage: number;
}

export interface CheckoutSettings {
  _id: string;
  id: string;
  serviceFee: FeeConfig;
  platformFee: FeeConfig;
  tax: TaxConfig;
  paymentMethods: PaymentMethodsConfig;
  defaultDiscount: DefaultDiscountConfig;
  currency: string;
  currencySymbol: string;
  minOrderValue: number;
  isActive: boolean;
  updatedAt: string;
}

export interface PriceCalculation {
  basePrice: number;
  serviceFee: number;
  platformFee: number;
  subtotal: number;
  tax: number;
  taxName: string;
  coupon: {
    code: string;
    name: string;
    discountType: string;
    discountValue: number;
    discount: number;
  } | null;
  couponDiscount: number;
  total: number;
  finalTotal: number;
  originalPrice: number;
  discountPercentage: number;
  currency: string;
  currencySymbol: string;
}

export interface PublicPaymentMethod {
  id: string;
  key: string;
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
  popular?: boolean;
}