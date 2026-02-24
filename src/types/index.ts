export type BookingStatus = 'Success' | 'Pending' | 'Failed' | 'Cancelled' | 'Refunded';
export type WorkStatus = 'Available' | 'Busy' | 'Offline';
export type PaymentMode = 'UPI' | 'Credit Card' | 'Debit Card' | 'Net Banking' | 'Cash' | 'Wallet' | 'EMI' | 'Bank Transfer';

export interface User {
  id: string;
  name: string;
  serviceRequired: string;
  subService?: string;
  paymentAmount: number;
  paymentMode: PaymentMode;
  location: string;
  status: BookingStatus;
  date: string;
  phone: string;
  email: string;
  serviceTime: string;
  address: string;
}

export interface Provider {
  id: string;
  name: string;
  category: string;
  location: string;
  rating: number;
  status: WorkStatus;
  paymentReceived: number;
  paymentMode: PaymentMode;
  contact: string;
  phone: string;
  email: string;
  availableTimeStart: string;
  availableTimeEnd: string;
  address: string;
  performance: number;
  initials: string;
}

export interface Transaction {
  id: string;
  bookingId: string;
  customerName: string;
  customerId?: string;
  providerName: string;
  providerId?: string;
  category: string;
  serviceName: string;
  totalAmount: number;
  discountAmount?: number;
  taxAmount?: number;
  surgeAmount?: number;
  commissionAmount: number;
  date: string;
  time: string;
  status: BookingStatus;
  paymentMode: PaymentMode;
  gatewayRefId?: string;
}

export type PriceChangeType = 'Manual' | 'Random' | 'Dynamic';

export type PricingType = 'Fixed' | 'Onwards' | 'Custom';

export interface SubService {
  id: string;
  name: string;
  basePrice: number;
  defaultPrice: number;
  minPrice: number;
  maxPrice: number;
  pricingType: PricingType;
  isPopular?: boolean;
  isActive: boolean;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  baseCharge: number;
  minimumBooking: number;
  multiplier: number;
  discountPercent: number;
  gstPercent: number;
  commissionPercent: number;
  isActive: boolean;
  isFeatured: boolean;
  icon: string;
  color: string;
  lastUpdated: string;
  subServices: SubService[];
  // Legacy/Internal fields
  basePrice: number;
  currentPrice: number;
  aiSuggestedPrice: number;
  aiReason?: string;
  demand: 'Low' | 'Medium' | 'High';
  priceStatus: PriceChangeType;
  isDynamicEnabled: boolean;
  isSurgeEnabled: boolean;
  isTaxEnabled: boolean;
}

export interface ProviderServicePricing {
  id: string;
  providerId: string;
  serviceId: string;
  categoryId: string;
  providerPrice: number;
  isApproved: boolean;
  isPending: boolean;
  updatedAt: string;
  weekendPricing?: number;
  surgePricing?: number;
}

export interface PriceHistory {
  id: string;
  categoryId: string;
  categoryName: string;
  oldPrice: number;
  newPrice: number;
  changeType: PriceChangeType;
  changedBy: string;
  timestamp: string;
}

export interface AppState {
  users: User[];
  providers: Provider[];
  transactions: Transaction[];
  categories: Category[];
  priceHistory: PriceHistory[];
  providerPricings: ProviderServicePricing[];
  viewMode: 'admin' | 'provider';
  commissionRate: number;
  isDark: boolean;
  notifications: Notification[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}
