// ==================== PROVIDER TYPES ====================
export interface Provider {
  _id: string;
  providerId: string;
  name: string;
  email: string;
  phone: string;
  profession?: string;
  profileImage?: string;
  gender?: string;
  dateOfBirth?: string;
  verificationStatus: 'pending' | 'approved' | 'rejected' | 'verified' | 'incomplete';
  isActive: boolean;
  isBlocked: boolean;
  isAvailable: boolean;
  isAcceptingJobs: boolean;
  isOnline: boolean;
  isVerified: boolean;
  serviceRadius: number;
  location: {
    type: string;
    coordinates: [number, number];
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  rating: number;
  totalRatings: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  todayEarnings: number;
  totalEarnings: number;
  walletBalance?: number;
  blockedAt?: string;
  blockedBy?: string;
  blockReason?: string;
  createdAt: string;
  updatedAt: string;
  
  // Computed fields for UI compatibility
  initials?: string;
  performance?: number;
  paymentReceived?: number;
  status?: 'Available' | 'Busy' | 'Offline';
  paymentMode?: string;
  contact?: string;
  category?: string;
  availableTimeStart?: string;
  availableTimeEnd?: string;
  address?: string;
}

// ==================== PROVIDER STATS ====================
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

// ==================== RECENT PROVIDER ====================
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

// ==================== VERIFICATION TYPES ====================
export interface Document {
  url: string;
  publicId: string;
  uploadedAt: string;
}

export interface ProviderVerification {
  _id: string;
  verificationId: string;
  provider: {
    _id: string;
    providerId: string;
    name: string;
    email: string;
    phone: string;
    profession?: string;
    profileImage?: string;
  };
  documents: {
    selfie?: Document;
    aadhaarCard?: Document;
    panCard?: Document;
  };
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  reviewedAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  attempts?: number;
}

// ==================== ADMIN TYPES ====================
export interface Admin {
  _id: string;
  adminId: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'moderator';
  permissions: string[];
  isActive: boolean;
  createdAt: string;
}

// ==================== APP USER TYPES (from user_db) ====================
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

// ==================== DASHBOARD STATS ====================
export interface DashboardStats {
  // Provider stats
  totalProviders: number;
  activeProviders: number;
  pendingVerifications: number;
  approvedProviders: number;
  rejectedVerifications: number;
  blockedProviders?: number;
  // User stats (from user_db)
  totalUsers: number;
  activeUsers: number;
  todaySignups: number;
  verifiedUsers: number;
  // Optional booking stats
  totalBookings?: number;
  totalEarnings?: number;
  todayBookings?: number;
  todayEarnings?: number;
}

// ==================== PAGINATION ====================
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ==================== API RESPONSE ====================
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  pagination?: Pagination;
}

// ==================== LEGACY TYPES (for backward compatibility) ====================
export type WorkStatus = 'Available' | 'Busy' | 'Offline';
export type PaymentMode = 'UPI' | 'Bank Transfer' | 'Cash' | 'Card' | 'Wallet' | 'Credit Card' | 'Debit Card' | 'Net Banking' | 'EMI';
export type BookingStatus = 'Success' | 'Pending' | 'Failed' | 'Cancelled' | 'Refunded';

// Legacy User type for local bookings
export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  serviceRequired: string;
  subService?: string;
  serviceTime: string;
  paymentAmount: number;
  paymentMode: PaymentMode;
  location: string;
  address: string;
  status: BookingStatus;
  date: string;
}

// Legacy Category type
export interface SubService {
  id: string;
  name: string;
  description: string;
  startingPrice: number;
  duration: string;
  image: string;
  isPopular?: boolean;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  currentPrice: number;
  oldPrice: number;
  discountPercent: number;
  isTaxEnabled: boolean;
  gstPercent: number;
  image: string;
  isSurgeEnabled: boolean;
  surgeMultiplier: number;
  isActive: boolean;
  subServices: SubService[];
}


// ==================== RECENT PROVIDER ====================
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
  rating: number | null; // ✅ Changed to allow null
  createdAt: string;
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

// ==================== LOCATION DETECTION ====================
export interface LocationDetectionResult {
  found: boolean;
  city?: City;
  zone?: Zone;
  providers?: any[];
}

// ==================== EXISTING TYPES (keep all existing) ====================
// ... your existing types ...

// ==================== NEW: CATEGORY TYPES ====================
export interface Category {
  _id: string;
  id: string;
  categoryId: string;
  name: string;
  description: string;
  icon: string;
  image: {
    url: string | null;
    publicId: string | null;
  };
  color: string;
  colorClass: string;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  servicesCount: number;
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

export interface CreateCategoryData {
  name: string;
  categoryId?: string;
  description?: string;
  icon?: string;
  color?: string;
  colorClass?: string;
  sortOrder?: number;
  isActive?: boolean;
  isFeatured?: boolean;
}

// ==================== NEW: SERVICE TYPES ====================
export interface ServiceImage {
  url: string | null;
  publicId: string | null;
}

export interface ServicePricing {
  basePrice: number;
  currency: string;
  displayText: string;
  priceType: 'fixed' | 'starting_from' | 'hourly' | 'per_unit' | 'custom';
}

export interface ServiceDisplay {
  colorClass: string;
  badge: {
    text: string;
    type: string;
  };
  sortOrder: number;
}

export interface ServiceMetrics {
  responseTime: string;
  completionRate: number;
  totalBookings: number;
  todayBookings: number;
}

export interface ServiceRating {
  average: number;
  count: number;
}

export interface Service {
  _id: string;
  id: string;
  serviceId: string;
  name: string;
  subtitle: string;
  description: string;
  category: Category | string;
  categoryName: string;
  icon: string;
  image: string | null;
  images: {
    hero: ServiceImage;
    thumbnail: ServiceImage;
    gallery: ServiceImage[];
  };
  pricing: ServicePricing;
  rating: ServiceRating;
  metrics: ServiceMetrics;
  display: ServiceDisplay;
  isActive: boolean;
  isPopular: boolean;
  isFeatured: boolean;
  isNew: boolean;
  tags: string[];
  subservicesCount: number;
  providersCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
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

export interface CreateServiceData {
  name: string;
  serviceId?: string;
  subtitle?: string;
  description?: string;
  category: string;
  icon?: string;
  image?: string;
  images?: {
    hero?: ServiceImage;
    thumbnail?: ServiceImage;
  };
  pricing?: Partial<ServicePricing>;
  display?: Partial<ServiceDisplay>;
  tags?: string[];
  isActive?: boolean;
  isPopular?: boolean;
  isFeatured?: boolean;
}

// ==================== NEW: SUBSERVICE TYPES ====================
export interface SubservicePricing {
  price: number;
  originalPrice: number | null;
  currency: string;
  displayText: string;
  priceType: string;
  unit: string;
}

export interface SubserviceDuration {
  minutes: number;
  displayText: string;
}

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
  pricing: SubservicePricing;
  duration: SubserviceDuration;
  rating: ServiceRating;
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

export interface SubserviceStats {
  totalSubservices: number;
  activeSubservices: number;
  inactiveSubservices: number;
  popularSubservices: number;
}

export interface CreateSubserviceData {
  name: string;
  service?: string;
  serviceId?: string;
  description?: string;
  icon?: string;
  colorClass?: string;
  pricing?: {
    price: number;
    originalPrice?: number;
    currency?: string;
    priceType?: string;
    unit?: string;
  };
  duration?: {
    minutes: number;
    displayText?: string;
  };
  includes?: string[];
  excludes?: string[];
  isActive?: boolean;
  isPopular?: boolean;
  sortOrder?: number;
}

// ==================== NEW: BANNER TYPES ====================
export interface BannerImage {
  url: string;
  publicId: string | null;
  darkModeUrl: string | null;
  altText: string;
}

export interface BannerAction {
  type: 'none' | 'service' | 'category' | 'url' | 'screen' | 'promo';
  target: string;
  serviceRef?: string;
  categoryRef?: string;
  promoCode?: string;
}

export interface BannerAnimation {
  type: 'none' | 'fade' | 'slide' | 'zoom' | 'flip';
  duration: number;
  autoPlayDelay: number;
}

export interface BannerSchedule {
  isScheduled: boolean;
  startDate: string | null;
  endDate: string | null;
  timezone: string;
}

export interface BannerDisplay {
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
}

export interface BannerAnalytics {
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface Banner {
  _id: string;
  id: string;
  bannerId: string;
  title: string;
  description: string;
  image: BannerImage;
  mobileImage: {
    url: string | null;
    publicId: string | null;
  };
  action: BannerAction;
  animation: BannerAnimation;
  schedule: BannerSchedule;
  display: BannerDisplay;
  isActive: boolean;
  analytics: BannerAnalytics;
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

export interface CreateBannerData {
  title: string;
  description?: string;
  image: {
    url: string;
    publicId?: string;
  };
  mobileImage?: {
    url: string;
    publicId?: string;
  };
  action?: Partial<BannerAction>;
  animation?: Partial<BannerAnimation>;
  schedule?: Partial<BannerSchedule>;
  display?: Partial<BannerDisplay>;
  isActive?: boolean;
}

// ==================== NEW: LAYOUT CONFIG TYPES ====================
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
    style: 'grid' | 'list' | 'horizontal' | 'carousel' | 'masonry';
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
  customData: Record<string, any>;
}

export interface LayoutSettings {
  pullToRefresh: boolean;
  showHeader: boolean;
  headerStyle: 'default' | 'transparent' | 'solid' | 'gradient';
  backgroundColor: string;
  darkBackgroundColor: string;
  statusBarStyle: 'default' | 'light' | 'dark';
}

export interface LayoutConfig {
  _id: string;
  id: string;
  page: string;
  pageName: string;
  description: string;
  sections: LayoutSection[];
  settings: LayoutSettings;
  isActive: boolean;
  isPublished: boolean;
  version: number;
  draft?: {
    sections: LayoutSection[];
    settings: LayoutSettings;
    lastSavedAt: string;
  };
  publishHistory: {
    version: number;
    publishedAt: string;
    publishedBy: string;
    changes: string;
  }[];
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== NEW: FEATURE FLAG TYPES ====================
export interface FeatureFlagValue {
  percentage: number;
  userIds: string[];
  jsonValue: any;
}

export interface FeatureFlagSchedule {
  isScheduled: boolean;
  startDate: string | null;
  endDate: string | null;
}

export interface FeatureFlagTargeting {
  platforms: string[];
  minAppVersion: string;
  maxAppVersion: string;
  cities: string[];
  userSegments: string[];
}

export interface FeatureFlagHistory {
  action: string;
  performedBy: string;
  performedAt: string;
  previousValue: boolean;
  newValue: boolean;
  notes: string;
}

export interface FeatureFlag {
  _id: string;
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'boolean' | 'percentage' | 'user_list' | 'date_range';
  value: FeatureFlagValue;
  schedule: FeatureFlagSchedule;
  targeting: FeatureFlagTargeting;
  environment: 'all' | 'development' | 'staging' | 'production';
  category: 'ui' | 'feature' | 'experiment' | 'promotion' | 'maintenance' | 'other';
  tags: string[];
  history: FeatureFlagHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlagFilters {
  category?: string;
  enabled?: string;
  search?: string;
}

export interface FeatureFlagStats {
  totalFlags: number;
  enabledFlags: number;
  disabledFlags: number;
  categoryDistribution: Record<string, number>;
}

export interface CreateFeatureFlagData {
  key: string;
  name: string;
  description?: string;
  enabled?: boolean;
  type?: string;
  value?: Partial<FeatureFlagValue>;
  schedule?: Partial<FeatureFlagSchedule>;
  targeting?: Partial<FeatureFlagTargeting>;
  category?: string;
  tags?: string[];
}

// ==================== SECTION TYPES (for Layout Editor) ====================
export type SectionType =
  | 'banner_carousel'
  | 'category_grid'
  | 'category_list'
  | 'service_grid'
  | 'service_list'
  | 'service_horizontal'
  | 'popular_services'
  | 'trending_services'
  | 'featured_services'
  | 'search_bar'
  | 'promo_banner'
  | 'quick_actions'
  | 'recent_bookings'
  | 'testimonials'
  | 'stats_card'
  | 'emergency_section'
  | 'custom_html'
  | 'spacer'
  | 'divider';

export const SECTION_TYPES: { value: SectionType; label: string; icon: string }[] = [
  { value: 'banner_carousel', label: 'Banner Carousel', icon: '🖼️' },
  { value: 'category_grid', label: 'Category Grid', icon: '📦' },
  { value: 'category_list', label: 'Category List', icon: '📋' },
  { value: 'service_grid', label: 'Service Grid', icon: '🔧' },
  { value: 'service_list', label: 'Service List', icon: '📝' },
  { value: 'service_horizontal', label: 'Horizontal Services', icon: '↔️' },
  { value: 'popular_services', label: 'Popular Services', icon: '⭐' },
  { value: 'trending_services', label: 'Trending Services', icon: '📈' },
  { value: 'featured_services', label: 'Featured Services', icon: '✨' },
  { value: 'search_bar', label: 'Search Bar', icon: '🔍' },
  { value: 'promo_banner', label: 'Promo Banner', icon: '🎁' },
  { value: 'quick_actions', label: 'Quick Actions', icon: '⚡' },
  { value: 'emergency_section', label: 'Emergency Section', icon: '🚨' },
  { value: 'spacer', label: 'Spacer', icon: '↕️' },
  { value: 'divider', label: 'Divider', icon: '➖' },
];

// ADD THIS TO YOUR EXISTING index.ts FILE

// ==================== TRENDING SERVICE TYPES ====================
export interface TrendingServiceBadge {
  text: string;
  type: 'HOT' | 'NEW' | 'POPULAR' | 'TRENDING' | 'BEST_SELLER' | 'LIMITED' | 'success' | 'warning' | 'info' | 'error' | 'default' | '';
}

export interface TrendingService {
  _id: string;
  id: string;
  serviceId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  iconName: string;
  imageUrl: string | null;
  badge: TrendingServiceBadge;
  bookingsToday: number;
  progress: number;
  sortOrder: number;
  isActive: boolean;
  autoSync: boolean;
  serviceSlug?: string;
  service?: string;
  category?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrendingServiceFilters {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: string;
  categoryId?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface TrendingServiceStats {
  totalTrending: number;
  activeTrending: number;
  inactiveTrending: number;
  autoSyncEnabled: number;
  totalBookingsToday: number;
  avgProgress: number;
  categoryDistribution: Record<string, number>;
}

export interface CreateTrendingServiceData {
  serviceId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  iconName?: string;
  imageUrl?: string | null;
  badge?: TrendingServiceBadge;
  bookingsToday?: number;
  progress?: number;
  sortOrder?: number;
  isActive?: boolean;
  autoSync?: boolean;
}