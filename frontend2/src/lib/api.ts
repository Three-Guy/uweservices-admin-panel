import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';

// ==================== CONFIGURATION ====================
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

console.log('🔧 API Configuration:');
console.log('   Base URL:', API_BASE_URL);

// ==================== TYPES ====================
interface TokenData {
  accessToken: string;
  refreshToken: string;
}

interface Admin {
  _id: string;
  email: string;
  name: string;
  role: string;
  permissions?: string[];
  isActive?: boolean;
  lastLogin?: string;
}

interface LoginResponseData {
  admin: Admin;
  tokens: TokenData;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

// ==================== USER TYPES ====================
export interface AppUser {
  id: string;
  _id: string;
  name: string;
  email: string;
  phone: string | null;
  gender: 'Male' | 'Female' | 'Other' | null;
  dateOfBirth: string | null;
  address: string | null;
  profilePicture: string | null;
  authProvider: 'local' | 'google' | 'firebase' | 'apple';
  isEmailVerified: boolean;
  isActive: boolean;
  role: 'user' | 'admin' | 'provider';
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: string;
  gender?: string;
  authProvider?: string;
  isEmailVerified?: string;
  sortBy?: string;
  sortOrder?: string;
  startDate?: string;
  endDate?: string;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  todaySignups: number;
  weeklySignups: number;
  monthlySignups: number;
  deletedUsers: number;
  genderDistribution: Record<string, number>;
  authProviderDistribution: Record<string, number>;
}

// ==================== PROVIDER TYPES ====================
export interface ProviderStats {
  totalProviders: number;
  activeProviders: number;
  inactiveProviders: number;
  pendingVerifications: number;
  approvedProviders: number;
  rejectedProviders: number;
  blockedProviders: number;
  availableProviders: number;
  todaySignups: number;
  weeklySignups: number;
  monthlySignups: number;
  totalEarnings: number;
  todayEarnings: number;
  avgRating: number;
  professionDistribution: Record<string, number>;
}

export interface RecentProvider {
  id: string;
  _id: string;
  providerId: string;
  name: string;
  email: string;
  phone: string;
  profession: string;
  profileImage: string | null;
  verificationStatus: string;
  isActive: boolean;
  isBlocked: boolean;
  rating: number;
  createdAt: string;
}

export interface ProviderFilters {
  page?: number;
  limit?: number;
  search?: string;
  verificationStatus?: string;
  isActive?: string;
  isBlocked?: string;
  profession?: string;
  sortBy?: string;
  sortOrder?: string;
}

// ==================== DETAILED PROVIDER (FULL JSON SHAPE) ====================
export interface ProviderSelfieImage {
  url?: string | null;
  publicId?: string | null;
  uploadedAt?: string | null;
}

export interface ProviderPaymentLock {
  isLocked?: boolean;
  reason?: string | null;
  lockedAt?: string | null;
  unlockedAt?: string | null;
  unpaidAmount?: number;
  pendingTransactionCount?: number;
  lastCheckedAt?: string | null;
  lastTransactionId?: string | null;
  lastModifiedBy?: string | null;
}

export interface ProviderPreOnlineLockState {
  isAvailable?: boolean;
  isAcceptingJobs?: boolean;
  savedAt?: string | null;
}

export interface ProviderRating {
  average?: number;
  count?: number;
}

export interface ProviderWallet {
  balance?: number;
  totalEarnings?: number;
}

export interface ProviderLocation {
  type?: string;
  coordinates?: number[];
  address?: string;
  accuracy?: number | null;
}

export interface DetailedProvider {
  _id: string;
  providerId?: string;
  name?: string;
  email?: string;
  phone?: string;
  profession?: string;
  gender?: string;
  dateOfBirth?: string;

  googleId?: string;
  authProvider?: string;
  isProfileComplete?: boolean;

  profilePicture?: string | null;
  profileImage?: string | null;
  profilePhoto?: string | null;
  selfieImage?: ProviderSelfieImage;

  services?: string[];

  verificationStatus?: string;
  isVerified?: boolean;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  verificationNotes?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  rejectionReason?: string | null;

  isActive?: boolean;
  isAvailable?: boolean;
  isAcceptingJobs?: boolean;
  isBusy?: boolean;
  isOnline?: boolean;
  lastOnlineAt?: string | null;

  isCityServiceAvailable?: boolean;
  cityNotificationRequested?: boolean;

  currentBookingId?: string | null;

  paymentLock?: ProviderPaymentLock;
  preOnlineLockState?: ProviderPreOnlineLockState;

  stateVersion?: number;
  lastStateSyncAt?: string | null;

  rating?: ProviderRating | number;
  totalRatings?: number;
  completedJobs?: number;
  completedBookings?: number;
  totalBookings?: number;
  cancelledBookings?: number;

  wallet?: ProviderWallet;
  totalEarnings?: number;
  todayEarnings?: number;
  walletBalance?: number;

  emailVerified?: boolean;
  phoneVerified?: boolean;

  city?: string;
  cityId?: string;
  categoryId?: string;
  categoryName?: string;

  location?: ProviderLocation;
  serviceRadius?: number;

  lastLogin?: string | null;
  fcmToken?: string; // Masked by backend
  refreshToken?: string; // Masked by backend

  isBlocked?: boolean;
  blockedAt?: string | null;
  blockedBy?: string | null;
  blockReason?: string | null;

  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  restoredAt?: string | null;
  restoredBy?: string | null;

  createdAt?: string;
  updatedAt?: string;
  __v?: number;

  // Allow any additional fields from DB
  [key: string]: any;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ==================== CITY TYPES ====================
export interface City {
  _id: string;
  id: string;
  cityName: string;
  state: string;
  country: string;
  isActive: boolean;
  zonesCount?: number;
  providersCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CityFilters {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: string;
  state?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface CityStats {
  totalCities: number;
  activeCities: number;
  inactiveCities: number;
  totalZones: number;
  citiesWithZones: number;
}

// ==================== ZONE TYPES ====================
export interface PolygonCoordinate {
  lat: number;
  lng: number;
}

export interface Zone {
  _id: string;
  id: string;
  zoneName: string;
  city: City | string;
  cityId: string;
  polygonCoordinates: PolygonCoordinate[];
  isActive: boolean;
  providersCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ZoneFilters {
  page?: number;
  limit?: number;
  search?: string;
  cityId?: string;
  isActive?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface ZoneStats {
  totalZones: number;
  activeZones: number;
  inactiveZones: number;
  zonesPerCity: Record<string, number>;
}

// ==================== CATEGORY TYPES ====================
export interface Category {
  _id: string;
  id: string;
  categoryId: string;
  name: string;
  description: string;
  icon: string;
  image: { url: string | null; publicId: string | null };
  color: string;
  colorClass: string;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  servicesCount: number;
  availableCities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CategoryFilters {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: string;
  isFeatured?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface CategoryStats {
  totalCategories: number;
  activeCategories: number;
  inactiveCategories: number;
  featuredCategories: number;
  totalServices: number;
  servicesPerCategory: Record<string, number>;
}

// ==================== SERVICE TYPES ====================
export interface Service {
  _id: string;
  id: string;
  serviceId: string;
  name: string;
  subtitle: string;
  description: string;
  shortDescription: string;
  category: Category | string;
  categoryId: string;
  categoryName: string;
  icon: string;
  image: { url: string | null; publicId: string | null };
  color: string;
  pricing: {
    basePrice: number;
    currency: string;
    displayText: string;
    priceType: string;
  };
  duration: {
    minutes: number;
    displayText: string;
  };
  rating: { average: number; count: number };
  isActive: boolean;
  isPopular: boolean;
  isFeatured: boolean;
  sortOrder: number;
  subservicesCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ServiceFilters {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  isActive?: string;
  isPopular?: string;
  isFeatured?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface ServiceStats {
  totalServices: number;
  activeServices: number;
  inactiveServices: number;
  popularServices: number;
  featuredServices: number;
  totalSubservices: number;
  categoryDistribution: Record<string, number>;
}

// ==================== SUBSERVICE TYPES ====================
export interface Subservice {
  _id: string;
  id: string;
  subserviceId: string;
  service: Service | string;
  serviceId: string;
  name: string;
  description: string;
  icon: string;
  colorClass: string;
  pricing: {
    price: number;
    originalPrice: number | null;
    currency: string;
    displayText: string;
    priceType: string;
    unit: string;
  };
  duration: { minutes: number; displayText: string };
  rating: { average: number; count: number };
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  includes: string[];
  excludes: string[];
  requirements: string[];
  bookingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubserviceFilters {
  page?: number;
  limit?: number;
  search?: string;
  serviceId?: string;
  isActive?: string;
  isPopular?: string;
  sortBy?: string;
  sortOrder?: string;
}

// ==================== BANNER TYPES ====================
export interface Banner {
  _id: string;
  id: string;
  bannerId: string;
  title: string;
  description: string;
  image: {
    url: string;
    publicId: string | null;
    darkModeUrl: string | null;
    altText: string;
  };
  mobileImage: { url: string | null; publicId: string | null };
  action: {
    type: 'none' | 'service' | 'category' | 'url' | 'screen' | 'promo';
    target: string;
    serviceRef?: string;
    categoryRef?: string;
    promoCode?: string;
  };
  animation: {
    type: 'none' | 'fade' | 'slide' | 'zoom' | 'flip';
    duration: number;
    autoPlayDelay: number;
  };
  schedule: {
    isScheduled: boolean;
    startDate: string | null;
    endDate: string | null;
    timezone: string;
  };
  targeting: {
    cities: string[];
    userSegments: string[];
    platforms: string[];
  };
  display: {
    sortOrder: number;
    position: 'hero' | 'middle' | 'bottom' | 'popup';
    backgroundColor: string;
    overlay: {
      enabled: boolean;
      title: string;
      subtitle: string;
      buttonText: string;
      textColor: string;
    };
  };
  isActive: boolean;
  analytics: { impressions: number; clicks: number; ctr: number };
  campaign: { name: string; source: string };
  createdAt: string;
  updatedAt: string;
}

export interface BannerFilters {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: string;
  position?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface BannerStats {
  totalBanners: number;
  activeBanners: number;
  inactiveBanners: number;
  scheduledBanners: number;
  expiredBanners: number;
  positionDistribution: Record<string, number>;
}

// ==================== LAYOUT CONFIG TYPES ====================
export interface LayoutSection {
  _id?: string;
  sectionId: string;
  type: string;
  enabled: boolean;
  order: number;
  title: string;
  subtitle: string;
  showViewAll: boolean;
  viewAllTarget: string;
  dataSource: string;
  layout: {
    style: string;
    columns: number;
    rows: number;
    itemsToShow: number;
    spacing: number;
    showBorder: boolean;
    roundedCorners: number;
  };
  style: {
    backgroundColor: string;
    paddingTop: number;
    paddingBottom: number;
    paddingHorizontal: number;
    marginTop: number;
    marginBottom: number;
  };
  cardStyle: {
    showImage: boolean;
    showTitle: boolean;
    showSubtitle: boolean;
    showPrice: boolean;
    showRating: boolean;
    showBadge: boolean;
    imageAspectRatio: string;
    titleLines: number;
  };
  filters: {
    categories: string[];
    services: string[];
    tags: string[];
    isPopular: boolean | null;
    isFeatured: boolean | null;
  };
  visibility: {
    requireAuth: boolean;
    newUsersOnly: boolean;
    platforms: string[];
    minAppVersion: string;
  };
  customData: Record<string, any>;
}

export interface LayoutConfig {
  _id: string;
  id: string;
  page: string;
  pageName: string;
  description: string;
  sections: LayoutSection[];
  settings: {
    pullToRefresh: boolean;
    showHeader: boolean;
    headerStyle: string;
    backgroundColor: string;
    darkBackgroundColor: string;
    statusBarStyle: string;
  };
  isActive: boolean;
  isPublished: boolean;
  version: number;
  draft?: { sections: LayoutSection[]; settings: Record<string, any>; lastSavedAt: string };
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== FEATURE FLAG TYPES ====================
export interface FeatureFlag {
  _id: string;
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'boolean' | 'percentage' | 'user_list' | 'date_range';
  value: { percentage: number; userIds: string[]; jsonValue: any };
  schedule: { isScheduled: boolean; startDate: string | null; endDate: string | null };
  targeting: {
    platforms: string[];
    minAppVersion: string;
    maxAppVersion: string;
    cities: string[];
    userSegments: string[];
  };
  environment: string;
  category: string;
  tags: string[];
  dependencies: string[];
  history: { action: string; performedBy: any; performedAt: string; previousValue: boolean; newValue: boolean; notes: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlagFilters {
  category?: string;
  enabled?: string;
  search?: string;
  environment?: string;
}

export interface FeatureFlagStats {
  totalFlags: number;
  enabledFlags: number;
  disabledFlags: number;
  categoryDistribution: Record<string, number>;
}



// ==================== BOOKING TYPES ====================
export interface BookingStatusHistoryItem {
  _id?: string;
  status: string;
  changedAt: string;
  changedBy: string;
  reason: string;
}

export interface Booking {
  _id: string;
  bookingId: string;
  bookingType?: string;
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  serviceName: string;
  servicePrice?: string | number;
  serviceIcon?: string;
  serviceId?: string;
  categoryId?: string;
  categoryName?: string;
  cartItems?: any[];

  address: string;
  houseFlat?: string;
  buildingStreet?: string;
  providerInstructions?: string;

  customerLocation?: {
    type?: string;
    coordinates?: number[];
    address?: string;
    accuracy?: number | null;
  };
  latitude?: number;
  longitude?: number;

  city?: {
    cityId?: string;
    cityName?: string;
    state?: string;
    country?: string;
  };
  zone?: {
    zoneId?: string;
    zoneName?: string;
  };

  scheduledDate?: string;
  scheduledTime?: string;
  scheduledDateDay?: string;
  scheduledDateNum?: string;
  scheduledDateMonth?: string;
  scheduledDateTime?: string;

  status: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentDetails?: {
    razorpayOrderId?: string | null;
    razorpayPaymentId?: string | null;
    transactionId?: string | null;
    paidAt?: string | null;
    method?: string;
  };

  totalAmount?: number;
  baseAmount?: number;
  serviceFee?: number;
  platformFee?: number;
  tax?: number;
  couponCode?: string | null;
  couponId?: string | null;
  couponDiscount?: number;

  providerId?: string;
  providerName?: string;
  providerPhone?: string;
  assignedAt?: string;
  assignmentMethod?: string;
  assignmentAttempts?: number;

  providerSelfie?: {
    url?: string | null;
    publicId?: string | null;
    sentAt?: string | null;
    providerName?: string;
    providerPhone?: string;
  };

  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  cancelledBy?: string | null;

  providerLiveLocation?: {
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    updatedAt?: string | null;
  };

  otp?: {
    code?: string;
    generatedAt?: string;
    expiresAt?: string;
    verified?: boolean;
    verifiedAt?: string | null;
    attempts?: number;
    maxAttempts?: number;
    sentVia?: string;
  };

  enRouteAt?: string | null;
  arrivedAt?: string | null;
  rating?: number | null;
  review?: string | null;
  ratedAt?: string | null;
  specialRequirements?: string;
  notes?: string;
  customServiceDescription?: string | null;
  estimatedPrice?: number | null;
  pricingMetadata?: any;

  servicePhoto?: {
    url?: string | null;
    publicId?: string | null;
    uploadedAt?: string | null;
  };
  servicePhotos?: any[];

  orderId?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  source?: string;
  platform?: string;
  appVersion?: string | null;

  isDeleted?: boolean;
  deletedAt?: string | null;

  statusHistory?: BookingStatusHistoryItem[];
  createdAt: string;
  updatedAt: string;

  dispatchCompletedAt?: string | null;
  feeConfig?: {
    commissionPercent?: number;
    gstPercent?: number;
    platformFeeFlatINR?: number;
    serviceFeeFlatINR?: number;
  };
  platformFeeAmount?: number;
  platformFeeStatus?: string;
  walletCredited?: boolean;
  platformFeePaidAt?: string | null;
}

export interface BookingFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  bookingType?: string;
  categoryId?: string;
  cityId?: string;
  zoneId?: string;
  providerId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
  isDeleted?: string;
}

export interface BookingStats {
  totalBookings: number;
  todayBookings: number;
  weekBookings: number;
  monthBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  inProgressBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  todayRevenue: number;
  statusDistribution: Record<string, number>;
  paymentMethodDistribution: Record<string, number>;
  categoryDistribution: Record<string, number>;
}


// ==================== TRACKING TYPES ====================
export interface TrackingDevice {
  _id: string;
  deviceId: string | null;
  type: 'customer' | 'provider' | 'lead';
  userId?: string | null;
  providerId?: string | null;
  email?: string | null;
  city: string | null;
  platform: string | null;
  appVersion: string | null;
  isActive: boolean;
  isServiceable?: boolean;
  lat: number | null;
  lng: number | null;
  fcmToken: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
  active: boolean;
  raw?: Record<string, any>;
}

export interface TrackingLead {
  _id: string;
  deviceId: string | null;
  type: 'lead';
  email: string | null;
  city: string | null;
  createdAt: string | null;
  raw?: Record<string, any>;
}

export interface TrackingStats {
  totalDevices: number;
  totalCustomers: number;
  totalProviders: number;
  totalLeads: number;
  activeNow: number;
  activeCustomers: number;
  activeProviders: number;
  byCity: { city: string; count: number }[];
  byPlatform: { platform: string; count: number }[];
  activeThresholdMinutes: number;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  type: 'customer' | 'provider' | 'lead';
  weight: number;
  city: string | null;
  deviceId: string | null;
  providerId?: string | null;
  lastSeenAt: string | null;
  active: boolean;
}




// ==================== BOOKINGS API ====================
export const bookingsApi = {
  getAll: async (params?: BookingFilters): Promise<ApiResponse<{ bookings: Booking[]; pagination: Pagination }>> => {
    console.log('\n📋 Fetching bookings with params:', params);
    const response = await apiClient.get('/admin/bookings', { params });
    return response.data;
  },

  getStats: async (): Promise<ApiResponse<BookingStats>> => {
    const response = await apiClient.get('/admin/bookings/stats');
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<{ booking: Booking }>> => {
    const response = await apiClient.get(`/admin/bookings/${id}`);
    return response.data;
  },

  updateStatus: async (id: string, status: string, reason?: string): Promise<ApiResponse<{ booking: Booking }>> => {
    const response = await apiClient.patch(`/admin/bookings/${id}/status`, { status, reason });
    return response.data;
  },

  updatePaymentStatus: async (id: string, paymentStatus: string): Promise<ApiResponse<{ booking: Booking }>> => {
    const response = await apiClient.patch(`/admin/bookings/${id}/payment-status`, { paymentStatus });
    return response.data;
  },

  update: async (id: string, data: Partial<Booking>): Promise<ApiResponse<{ booking: Booking }>> => {
    const response = await apiClient.patch(`/admin/bookings/${id}`, data);
    return response.data;
  },

  delete: async (id: string, permanent: boolean = false): Promise<ApiResponse<any>> => {
    const response = await apiClient.delete(`/admin/bookings/${id}`, {
      params: { permanent: permanent.toString() },
    });
    return response.data;
  },
};




// ==================== AXIOS INSTANCE ====================
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});
// ==================== ADD THESE IMPORTS AT TOP ====================
import type { 
  Coupon, 
  CouponFilters, 
  CouponStats, 
  CreateCouponData,
  CheckoutSettings,
  FeeConfig,
  TaxConfig,
  PaymentMethodsConfig,
  PriceCalculation,
  PublicPaymentMethod,
} from '../types/checkout';

// ==================== COUPON TYPES (for inline use) ====================
export type { 
  Coupon, 
  CouponFilters, 
  CouponStats, 
  CreateCouponData,
  CheckoutSettings,
  PriceCalculation,
  PublicPaymentMethod,
};

// ==================== COUPONS API ====================
export const couponsApi = {
  getAll: async (params?: CouponFilters): Promise<ApiResponse<{ coupons: Coupon[]; pagination: Pagination }>> => {
    console.log('\n📋 Fetching coupons with params:', params);
    const response = await apiClient.get('/admin/coupons', { params });
    return response.data;
  },

  getStats: async (): Promise<ApiResponse<CouponStats>> => {
    const response = await apiClient.get('/admin/coupons/stats');
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<{ coupon: Coupon }>> => {
    const response = await apiClient.get(`/admin/coupons/${id}`);
    return response.data;
  },

  create: async (data: CreateCouponData): Promise<ApiResponse<{ coupon: Coupon }>> => {
    const response = await apiClient.post('/admin/coupons', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateCouponData>): Promise<ApiResponse<{ coupon: Coupon }>> => {
    const response = await apiClient.put(`/admin/coupons/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.delete(`/admin/coupons/${id}`);
    return response.data;
  },

  toggleStatus: async (id: string, isActive: boolean): Promise<ApiResponse<{ coupon: Coupon }>> => {
    const response = await apiClient.patch(`/admin/coupons/${id}/status`, { isActive });
    return response.data;
  },

  validate: async (code: string, orderAmount: number, userId?: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post('/admin/coupons/validate', { code, orderAmount, userId });
    return response.data;
  },

  getUsageHistory: async (id: string, params?: { page?: number; limit?: number }): Promise<ApiResponse<any>> => {
    const response = await apiClient.get(`/admin/coupons/${id}/usage`, { params });
    return response.data;
  },
};

// ==================== CHECKOUT SETTINGS API ====================
export const checkoutApi = {
  getSettings: async (): Promise<ApiResponse<{ settings: CheckoutSettings }>> => {
    const response = await apiClient.get('/admin/checkout/settings');
    return response.data;
  },

  updateSettings: async (data: Partial<CheckoutSettings>): Promise<ApiResponse<{ settings: CheckoutSettings }>> => {
    const response = await apiClient.put('/admin/checkout/settings', data);
    return response.data;
  },

  updateServiceFee: async (data: FeeConfig): Promise<ApiResponse<{ serviceFee: FeeConfig }>> => {
    const response = await apiClient.patch('/admin/checkout/settings/service-fee', data);
    return response.data;
  },

  updatePlatformFee: async (data: FeeConfig): Promise<ApiResponse<{ platformFee: FeeConfig }>> => {
    const response = await apiClient.patch('/admin/checkout/settings/platform-fee', data);
    return response.data;
  },

  updateTax: async (data: TaxConfig): Promise<ApiResponse<{ tax: TaxConfig }>> => {
    const response = await apiClient.patch('/admin/checkout/settings/tax', data);
    return response.data;
  },

  updatePaymentMethods: async (data: { paymentMethods: Partial<PaymentMethodsConfig> }): Promise<ApiResponse<{ paymentMethods: PaymentMethodsConfig }>> => {
    const response = await apiClient.patch('/admin/checkout/settings/payment-methods', data);
    return response.data;
  },

  togglePaymentMethod: async (method: string, enabled: boolean): Promise<ApiResponse<{ paymentMethods: PaymentMethodsConfig }>> => {
    const response = await apiClient.patch(`/admin/checkout/settings/payment-methods/${method}/toggle`, { enabled });
    return response.data;
  },

  calculatePrice: async (basePrice: number, couponCode?: string, userId?: string): Promise<ApiResponse<PriceCalculation>> => {
    const response = await apiClient.post('/admin/checkout/calculate', { basePrice, couponCode, userId });
    return response.data;
  },

  getPaymentMethods: async (): Promise<ApiResponse<{ paymentMethods: PublicPaymentMethod[] }>> => {
    const response = await apiClient.get('/admin/checkout/payment-methods');
    return response.data;
  },
};
// ==================== REQUEST INTERCEPTOR ====================
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    console.log(`📤 Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    
    const tokensStr = localStorage.getItem('admin_tokens');
    
    if (tokensStr) {
      try {
        const tokens: TokenData = JSON.parse(tokensStr);
        if (tokens.accessToken) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
      } catch (error) {
        console.error('❌ Failed to parse tokens:', error);
      }
    }
    
    if (config.data) {
      console.log('📦 Request Data:', config.data);
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// ==================== RESPONSE INTERCEPTOR ====================
apiClient.interceptors.response.use(
  (response) => {
    console.log(`📥 Response: ${response.status} ${response.config.url}`);
    return response;
  },
  async (error: AxiosError) => {
    console.error(`❌ Response Error: ${error.response?.status} ${error.config?.url}`);
    console.error('Error Data:', error.response?.data);
    
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      console.log('🔒 Unauthorized - clearing tokens');
      localStorage.removeItem('admin_tokens');
      localStorage.removeItem('admin_data');
    }
    
    return Promise.reject(error);
  }
);

export { apiClient };

// ==================== AUTH API ====================
export const authApi = {
  login: async (email: string, password: string): Promise<{ admin: Admin; tokens: TokenData }> => {
    console.log('\n🔐 ===== LOGIN ATTEMPT =====');
    console.log('Email:', email);
    
    try {
      const response = await apiClient.post<ApiResponse<LoginResponseData>>('/admin/auth/login', { 
        email: email.trim().toLowerCase(), 
        password: password
      });
      
      console.log('📥 Login Response:', response.data);
      
      if (response.data.success && response.data.data) {
        const { admin, tokens } = response.data.data;
        
        localStorage.setItem('admin_tokens', JSON.stringify(tokens));
        localStorage.setItem('admin_data', JSON.stringify(admin));
        
        console.log('✅ Login successful!');
        console.log('👤 Admin:', admin.email);
        
        return { admin, tokens };
      } else {
        const errorMessage = response.data.message || 'Login failed';
        console.error('❌ Login failed:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('❌ Login Error:', error);
      let errorMessage = 'Login failed';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      throw new Error(errorMessage);
    }
  },

  logout: () => {
    console.log('🚪 Logging out...');
    localStorage.removeItem('admin_tokens');
    localStorage.removeItem('admin_data');
    window.location.href = '/login';
  },

  getStoredAdmin: (): Admin | null => {
    try {
      const adminStr = localStorage.getItem('admin_data');
      if (adminStr) {
        return JSON.parse(adminStr);
      }
    } catch (error) {
      console.error('❌ Failed to parse stored admin:', error);
    }
    return null;
  },

  getStoredTokens: (): TokenData | null => {
    try {
      const tokensStr = localStorage.getItem('admin_tokens');
      if (tokensStr) {
        return JSON.parse(tokensStr);
      }
    } catch (error) {
      console.error('❌ Failed to parse stored tokens:', error);
    }
    return null;
  },

  isAuthenticated: (): boolean => {
    const tokens = authApi.getStoredTokens();
    const admin = authApi.getStoredAdmin();
    return !!(tokens?.accessToken && admin);
  },
};

// ==================== DASHBOARD API ====================
export const dashboardApi = {
  getStats: async () => {
    const response = await apiClient.get('/admin/dashboard/stats');
    return response.data;
  },
};

// ==================== PROVIDERS API ====================
export const providersApi = {
  getAll: async (params?: ProviderFilters) => {
    const response = await apiClient.get('/admin/providers', { params });
    return response.data;
  },

  getStats: async (): Promise<ApiResponse<ProviderStats>> => {
    const response = await apiClient.get('/admin/providers/stats');
    return response.data;
  },

  getRecent: async (limit: number = 5): Promise<ApiResponse<{ providers: RecentProvider[] }>> => {
    const response = await apiClient.get('/admin/providers/recent', { params: { limit } });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/admin/providers/${id}`);
    return response.data;
  },

  // NEW: Get full detailed provider (returns ALL raw fields, tokens masked)
  getFullDetails: async (id: string): Promise<ApiResponse<{ provider: DetailedProvider }>> => {
    const response = await apiClient.get(`/admin/providers/${id}`);
    return response.data;
  },

  toggleStatus: async (id: string, isActive: boolean) => {
    const response = await apiClient.patch(`/admin/providers/${id}/status`, { isActive });
    return response.data;
  },

  // NEW: Update availability (isAvailable, isAcceptingJobs, isBusy, isOnline)
  updateAvailability: async (
    id: string,
    data: { isAvailable?: boolean; isAcceptingJobs?: boolean; isBusy?: boolean; isOnline?: boolean }
  ): Promise<ApiResponse<{ provider: DetailedProvider }>> => {
    const response = await apiClient.patch(`/admin/providers/${id}/availability`, data);
    return response.data;
  },

  // NEW: Update verification status (approved/rejected/pending)
  updateVerification: async (
    id: string,
    data: { verificationStatus: string; notes?: string; reason?: string }
  ): Promise<ApiResponse<{ provider: DetailedProvider }>> => {
    const response = await apiClient.patch(`/admin/providers/${id}/verification`, data);
    return response.data;
  },

  // NEW: Update payment lock
  updatePaymentLock: async (
    id: string,
    data: {
      isLocked: boolean;
      reason?: string;
      unpaidAmount?: number;
      pendingTransactionCount?: number;
    }
  ): Promise<ApiResponse<{ provider: DetailedProvider }>> => {
    const response = await apiClient.patch(`/admin/providers/${id}/payment-lock`, data);
    return response.data;
  },

  blockProvider: async (id: string, isBlocked: boolean, reason?: string) => {
    const response = await apiClient.patch(`/admin/providers/${id}/block`, { isBlocked, reason });
    return response.data;
  },

  updateProvider: async (id: string, updates: any) => {
    const response = await apiClient.patch(`/admin/providers/${id}`, updates);
    return response.data;
  },

  deleteProvider: async (id: string, permanent: boolean = false) => {
    const response = await apiClient.delete(`/admin/providers/${id}`, {
      params: { permanent: permanent.toString() }
    });
    return response.data;
  },

  deleteMultiple: async (providerIds: string[], permanent: boolean = false) => {
    const response = await apiClient.post('/admin/providers/delete-multiple', { providerIds, permanent });
    return response.data;
  },

  restoreProvider: async (id: string) => {
    const response = await apiClient.patch(`/admin/providers/${id}/restore`);
    return response.data;
  },
};

// ==================== VERIFICATIONS API ====================
export const verificationsApi = {
  getPending: async (params?: { page?: number; limit?: number }) => {
    const response = await apiClient.get('/admin/verifications/pending', { params });
    return response.data;
  },

  getAll: async (params?: any) => {
    const response = await apiClient.get('/admin/verifications', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/admin/verifications/${id}`);
    return response.data;
  },

  approve: async (id: string, notes?: string) => {
    const response = await apiClient.post(`/admin/verifications/${id}/approve`, { notes });
    return response.data;
  },

  reject: async (id: string, reason: string) => {
    const response = await apiClient.post(`/admin/verifications/${id}/reject`, { rejectionReason: reason });
    return response.data;
  },

  getStats: async () => {
    const response = await apiClient.get('/admin/verifications/stats');
    return response.data;
  },
};

// ==================== USERS API ====================
export const usersApi = {
  getAll: async (params?: UserFilters): Promise<ApiResponse<{ users: AppUser[]; pagination: Pagination }>> => {
    const response = await apiClient.get('/admin/users', { params });
    return response.data;
  },

  delete: async (id: string, permanent: boolean = false): Promise<ApiResponse<any>> => {
    const response = await apiClient.delete(`/admin/users/${id}`, { params: { permanent: permanent.toString() } });
    return response.data;
  },

  deleteMultiple: async (userIds: string[], permanent: boolean = false): Promise<ApiResponse<any>> => {
    const response = await apiClient.post('/admin/users/delete-multiple', { userIds, permanent });
    return response.data;
  },

  getStats: async (): Promise<ApiResponse<UserStats>> => {
    const response = await apiClient.get('/admin/users/stats');
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<{ user: AppUser }>> => {
    const response = await apiClient.get(`/admin/users/${id}`);
    return response.data;
  },

  update: async (id: string, data: Partial<AppUser>): Promise<ApiResponse<{ user: AppUser }>> => {
    const response = await apiClient.patch(`/admin/users/${id}`, data);
    return response.data;
  },

  toggleStatus: async (id: string, isActive: boolean): Promise<ApiResponse<{ user: AppUser }>> => {
    const response = await apiClient.patch(`/admin/users/${id}/status`, { isActive });
    return response.data;
  },

  restore: async (id: string): Promise<ApiResponse<{ user: AppUser }>> => {
    const response = await apiClient.patch(`/admin/users/${id}/restore`);
    return response.data;
  },

  exportCSV: async (params?: { isActive?: string; startDate?: string; endDate?: string }): Promise<ApiResponse<{ users: any[]; total: number }>> => {
    const response = await apiClient.get('/admin/users/export/csv', { params });
    return response.data;
  },
};

// ==================== CITIES API ====================
export const citiesApi = {
  getAll: async (params?: CityFilters): Promise<ApiResponse<{ cities: City[]; pagination: Pagination }>> => {
    const response = await apiClient.get('/admin/cities', { params });
    return response.data;
  },

  getStats: async (): Promise<ApiResponse<CityStats>> => {
    const response = await apiClient.get('/admin/cities/stats');
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<{ city: City }>> => {
    const response = await apiClient.get(`/admin/cities/${id}`);
    return response.data;
  },

  create: async (data: { cityName: string; state: string; country: string }): Promise<ApiResponse<{ city: City }>> => {
    const response = await apiClient.post('/admin/cities', data);
    return response.data;
  },

  update: async (id: string, data: Partial<City>): Promise<ApiResponse<{ city: City }>> => {
    const response = await apiClient.patch(`/admin/cities/${id}`, data);
    return response.data;
  },

  toggleStatus: async (id: string, isActive: boolean): Promise<ApiResponse<{ city: City }>> => {
    const response = await apiClient.patch(`/admin/cities/${id}/status`, { isActive });
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.delete(`/admin/cities/${id}`);
    return response.data;
  },

  getActive: async (): Promise<ApiResponse<{ cities: City[] }>> => {
    const response = await apiClient.get('/admin/cities/active/list');
    return response.data;
  },
};

// ==================== ZONES API ====================
export const zonesApi = {
  getAll: async (params?: ZoneFilters): Promise<ApiResponse<{ zones: Zone[]; pagination: Pagination }>> => {
    const response = await apiClient.get('/admin/zones', { params });
    return response.data;
  },

  getStats: async (): Promise<ApiResponse<ZoneStats>> => {
    const response = await apiClient.get('/admin/zones/stats');
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<{ zone: Zone }>> => {
    const response = await apiClient.get(`/admin/zones/${id}`);
    return response.data;
  },

  getByCity: async (cityId: string): Promise<ApiResponse<{ zones: Zone[] }>> => {
    const response = await apiClient.get(`/admin/zones/city/${cityId}`);
    return response.data;
  },

  create: async (data: { zoneName: string; cityId: string; polygonCoordinates: PolygonCoordinate[] }): Promise<ApiResponse<{ zone: Zone }>> => {
    const response = await apiClient.post('/admin/zones', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Zone>): Promise<ApiResponse<{ zone: Zone }>> => {
    const response = await apiClient.patch(`/admin/zones/${id}`, data);
    return response.data;
  },

  toggleStatus: async (id: string, isActive: boolean): Promise<ApiResponse<{ zone: Zone }>> => {
    const response = await apiClient.patch(`/admin/zones/${id}/status`, { isActive });
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.delete(`/admin/zones/${id}`);
    return response.data;
  },

  detectZone: async (lat: number, lng: number): Promise<ApiResponse<{ found: boolean; city?: City; zone?: Zone }>> => {
    const response = await apiClient.get('/admin/zones/detect', { params: { lat, lng } });
    return response.data;
  },
};

// ==================== CATEGORIES API (SDUI) ====================
export const categoriesApi = {
  getAll: async (params?: CategoryFilters): Promise<ApiResponse<{ data: Category[]; pagination?: Pagination }>> => {
    console.log('\n📋 Fetching categories with params:', params);
    const response = await apiClient.get('/admin/sdui/categories', { params });
    return response.data;
  },

  getStats: async (): Promise<ApiResponse<CategoryStats>> => {
    const response = await apiClient.get('/admin/sdui/categories/stats');
    return response.data;
  },

  getActive: async (): Promise<ApiResponse<{ data: Category[] }>> => {
    const response = await apiClient.get('/admin/sdui/categories', { params: { isActive: true } });
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<{ data: Category }>> => {
    const response = await apiClient.get(`/admin/sdui/categories/${id}`);
    return response.data;
  },

  create: async (data: Partial<Category>): Promise<ApiResponse<{ data: Category }>> => {
    const response = await apiClient.post('/admin/sdui/categories', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Category>): Promise<ApiResponse<{ data: Category }>> => {
    const response = await apiClient.put(`/admin/sdui/categories/${id}`, data);
    return response.data;
  },

  toggleStatus: async (id: string, isActive: boolean): Promise<ApiResponse<{ data: Category }>> => {
    const response = await apiClient.put(`/admin/sdui/categories/${id}`, { isActive });
    return response.data;
  },

  toggleFeatured: async (id: string, isFeatured: boolean): Promise<ApiResponse<{ data: Category }>> => {
    const response = await apiClient.put(`/admin/sdui/categories/${id}`, { isFeatured });
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.delete(`/admin/sdui/categories/${id}`);
    return response.data;
  },

  reorder: async (categories: { id: string; sortOrder: number }[]): Promise<ApiResponse<any>> => {
    const response = await apiClient.post('/admin/sdui/categories/reorder', { categories });
    return response.data;
  },
};

// ==================== SERVICES API (SDUI) ====================
export const servicesApi = {
  getAll: async (params?: ServiceFilters): Promise<ApiResponse<{ data: Service[]; pagination?: Pagination }>> => {
    console.log('\n📋 Fetching services with params:', params);
    const response = await apiClient.get('/admin/sdui/services', { params });
    return response.data;
  },

  getStats: async (): Promise<ApiResponse<ServiceStats>> => {
    const response = await apiClient.get('/admin/sdui/services/stats');
    return response.data;
  },

  getByCategory: async (categoryId: string): Promise<ApiResponse<{ data: Service[] }>> => {
    const response = await apiClient.get('/admin/sdui/services', { params: { categoryId } });
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<{ data: Service }>> => {
    const response = await apiClient.get(`/admin/sdui/services/${id}`);
    return response.data;
  },

  create: async (data: Partial<Service>): Promise<ApiResponse<{ data: Service }>> => {
    const response = await apiClient.post('/admin/sdui/services', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Service>): Promise<ApiResponse<{ data: Service }>> => {
    const response = await apiClient.put(`/admin/sdui/services/${id}`, data);
    return response.data;
  },

  toggleStatus: async (id: string, isActive: boolean): Promise<ApiResponse<{ data: Service }>> => {
    const response = await apiClient.put(`/admin/sdui/services/${id}`, { isActive });
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.delete(`/admin/sdui/services/${id}`);
    return response.data;
  },

  reorder: async (services: { id: string; sortOrder: number }[]): Promise<ApiResponse<any>> => {
    const response = await apiClient.post('/admin/sdui/services/reorder', { services });
    return response.data;
  },
};

// ==================== SUBSERVICES API (SDUI) ====================
export const subservicesApi = {
  getAll: async (params?: SubserviceFilters): Promise<ApiResponse<{ data: Subservice[]; pagination?: Pagination }>> => {
    console.log('\n📋 Fetching subservices with params:', params);
    const response = await apiClient.get('/admin/sdui/subservices', { params });
    return response.data;
  },

  getByService: async (serviceId: string): Promise<ApiResponse<{ data: Subservice[] }>> => {
    const response = await apiClient.get('/admin/sdui/subservices', { params: { serviceId } });
    return response.data;
  },

  getStats: async (): Promise<ApiResponse<any>> => {
    const response = await apiClient.get('/admin/sdui/subservices/stats');
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<{ data: Subservice }>> => {
    const response = await apiClient.get(`/admin/sdui/subservices/${id}`);
    return response.data;
  },

  create: async (data: Partial<Subservice>): Promise<ApiResponse<{ data: Subservice }>> => {
    const response = await apiClient.post('/admin/sdui/subservices', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Subservice>): Promise<ApiResponse<{ data: Subservice }>> => {
    const response = await apiClient.put(`/admin/sdui/subservices/${id}`, data);
    return response.data;
  },

  toggleStatus: async (id: string, isActive: boolean): Promise<ApiResponse<{ data: Subservice }>> => {
    const response = await apiClient.put(`/admin/sdui/subservices/${id}`, { isActive });
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.delete(`/admin/sdui/subservices/${id}`);
    return response.data;
  },

  reorder: async (subservices: { id: string; sortOrder: number }[]): Promise<ApiResponse<any>> => {
    const response = await apiClient.post('/admin/sdui/subservices/reorder', { subservices });
    return response.data;
  },
};

// ==================== BANNERS API (SDUI) ====================
export const bannersApi = {
  getAll: async (params?: BannerFilters): Promise<ApiResponse<{ data: Banner[]; pagination?: Pagination }>> => {
    console.log('\n📋 Fetching banners with params:', params);
    const response = await apiClient.get('/admin/sdui/banners', { params });
    return response.data;
  },

  getStats: async (): Promise<ApiResponse<BannerStats>> => {
    const response = await apiClient.get('/admin/sdui/banners/stats');
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<{ data: Banner }>> => {
    const response = await apiClient.get(`/admin/sdui/banners/${id}`);
    return response.data;
  },

  create: async (data: Partial<Banner>): Promise<ApiResponse<{ data: Banner }>> => {
    const response = await apiClient.post('/admin/sdui/banners', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Banner>): Promise<ApiResponse<{ data: Banner }>> => {
    const response = await apiClient.put(`/admin/sdui/banners/${id}`, data);
    return response.data;
  },

  toggleStatus: async (id: string, isActive: boolean): Promise<ApiResponse<{ data: Banner }>> => {
    const response = await apiClient.put(`/admin/sdui/banners/${id}`, { isActive });
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.delete(`/admin/sdui/banners/${id}`);
    return response.data;
  },

  reorder: async (banners: { id: string; sortOrder: number }[]): Promise<ApiResponse<any>> => {
    const response = await apiClient.post('/admin/sdui/banners/reorder', { banners });
    return response.data;
  },
};

// ==================== LAYOUTS API (SDUI) ====================
export const layoutsApi = {
  getAll: async (): Promise<ApiResponse<{ data: LayoutConfig[] }>> => {
    console.log('\n📋 Fetching all layouts...');
    const response = await apiClient.get('/admin/sdui/layouts');
    return response.data;
  },

  getByPage: async (page: string): Promise<ApiResponse<{ data: LayoutConfig }>> => {
    const response = await apiClient.get(`/admin/sdui/layouts/${page}`);
    return response.data;
  },

  create: async (data: Partial<LayoutConfig>): Promise<ApiResponse<{ data: LayoutConfig }>> => {
    const response = await apiClient.post('/admin/sdui/layouts', data);
    return response.data;
  },

  update: async (id: string, data: Partial<LayoutConfig>): Promise<ApiResponse<{ data: LayoutConfig }>> => {
    const response = await apiClient.put(`/admin/sdui/layouts/${id}`, data);
    return response.data;
  },

  updateSections: async (id: string, sections: LayoutSection[]): Promise<ApiResponse<{ data: LayoutConfig }>> => {
    const response = await apiClient.patch(`/admin/sdui/layouts/${id}/sections`, { sections });
    return response.data;
  },

  saveDraft: async (id: string, draft: { sections: LayoutSection[]; settings?: any }): Promise<ApiResponse<{ data: LayoutConfig }>> => {
    const response = await apiClient.post(`/admin/sdui/layouts/${id}/draft`, draft);
    return response.data;
  },

  publish: async (id: string, changes?: string): Promise<ApiResponse<{ data: LayoutConfig }>> => {
    const response = await apiClient.post(`/admin/sdui/layouts/${id}/publish`, { changes });
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.delete(`/admin/sdui/layouts/${id}`);
    return response.data;
  },
};

// ==================== FEATURE FLAGS API (SDUI) ====================
export const featureFlagsApi = {
  getAll: async (params?: FeatureFlagFilters): Promise<ApiResponse<{ data: FeatureFlag[] }>> => {
    console.log('\n📋 Fetching feature flags with params:', params);
    const response = await apiClient.get('/admin/sdui/feature-flags', { params });
    return response.data;
  },

  getStats: async (): Promise<ApiResponse<FeatureFlagStats>> => {
    const response = await apiClient.get('/admin/sdui/feature-flags/stats');
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<{ data: FeatureFlag }>> => {
    const response = await apiClient.get(`/admin/sdui/feature-flags/${id}`);
    return response.data;
  },

  create: async (data: Partial<FeatureFlag>): Promise<ApiResponse<{ data: FeatureFlag }>> => {
    const response = await apiClient.post('/admin/sdui/feature-flags', data);
    return response.data;
  },

  update: async (id: string, data: Partial<FeatureFlag>): Promise<ApiResponse<{ data: FeatureFlag }>> => {
    const response = await apiClient.put(`/admin/sdui/feature-flags/${id}`, data);
    return response.data;
  },

  toggle: async (id: string, enabled: boolean, notes?: string): Promise<ApiResponse<{ data: FeatureFlag }>> => {
    const response = await apiClient.put(`/admin/sdui/feature-flags/${id}`, { enabled, notes });
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.delete(`/admin/sdui/feature-flags/${id}`);
    return response.data;
  },

  bulkToggle: async (ids: string[], enabled: boolean): Promise<ApiResponse<any>> => {
    const response = await apiClient.post('/admin/sdui/feature-flags/bulk-toggle', { ids, enabled });
    return response.data;
  },
};


// ==================== TRACKING API ====================
export const trackingApi = {
  getStats: async (): Promise<ApiResponse<TrackingStats>> => {
    console.log('\n📍 Fetching tracking stats...');
    const response = await apiClient.get('/admin/tracking/stats');
    return response.data;
  },

  getDevices: async (params?: {
    type?: string;
    city?: string;
    platform?: string;
    active?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ devices: TrackingDevice[]; pagination: Pagination }>> => {
    console.log('\n📍 Fetching tracking devices with params:', params);
    const response = await apiClient.get('/admin/tracking/devices', { params });
    return response.data;
  },

  getLeads: async (params?: {
    city?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ leads: TrackingLead[]; pagination: Pagination }>> => {
    console.log('\n📍 Fetching tracking leads with params:', params);
    const response = await apiClient.get('/admin/tracking/leads', { params });
    return response.data;
  },

  getHeatmap: async (params?: {
    type?: string;
    city?: string;
    activeOnly?: string;
  }): Promise<ApiResponse<{ points: HeatmapPoint[]; total: number; leadCityCounts: Record<string, number> }>> => {
    console.log('\n📍 Fetching heatmap with params:', params);
    const response = await apiClient.get('/admin/tracking/heatmap', { params });
    return response.data;
  },

  getDeviceById: async (deviceId: string): Promise<ApiResponse<{ device: TrackingDevice }>> => {
    const response = await apiClient.get(`/admin/tracking/device/${encodeURIComponent(deviceId)}`);
    return response.data;
  },
};

// ==================== EXPORT ALL ====================
export default apiClient;