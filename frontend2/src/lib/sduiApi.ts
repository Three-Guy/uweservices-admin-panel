// src/lib/sduiApi.ts
import { apiClient, ApiResponse } from './api';

// ==================== TYPES ====================

export interface SDUIBanner {
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
  mobileImage: {
    url: string | null;
    publicId: string | null;
  };
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
  analytics: {
    impressions: number;
    clicks: number;
    ctr: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ==================== CATEGORY ACTION CONFIG TYPES ====================

export interface CategoryActionConfig {
  actionType: 'show_all_subservices' | 'show_selected_subservices' | 'custom_screen' | 'external_url';
  selectedSubservices: string[];
  screenName?: string;
  url?: string;
  displaySettings: {
    title?: string;
    subtitle?: string;
    showCount: boolean;
  };
  layout: {
    viewType: 'grid' | 'list';
    gridColumns: number;
    showSearch: boolean;
    showFilters: boolean;
  };
}

// ==================== SUBSERVICE TYPES ====================

export interface SDUISubservice {
  _id: string;
  id?: string;
  subserviceId?: string;
  name: string;
  description?: string;
  icon?: string;
  colorClass?: string;
  image?: {
    url: string | null;
    publicId: string | null;
  };
  images?: Array<{ _id?: string; url?: string; publicId?: string }>;
  pricing?: {
    price: number;
    originalPrice?: number;
    currency: string;
    priceType: string;
    unit?: string;
    displayText?: string;
  };
  duration?: {
    minutes: number;
    displayText: string;
  };
  rating?: {
    average: number;
    count: number;
  };
  price?: number;
  discountedPrice?: number;
  isActive?: boolean;
  isPopular?: boolean;
  isFeatured?: boolean;
  category?: string | { _id: string; name?: string; categoryId?: string; $oid?: string };
  categoryId?: string;
  service?: string | { _id: string; name?: string } | null;
  serviceId?: string;
  sortOrder?: number;
  tags?: string[];
  includes?: string[];
  excludes?: string[];
  requirements?: string[];
  availability?: {
    cities: string[];
    zones: string[];
  };
  bookingCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SDUICategory {
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
  subservicesCount?: number;
  isMoreServicesSection?: boolean;
  moreServicesConfig?: MoreServicesConfig;
  actionConfig?: CategoryActionConfig;
  createdAt: string;
  updatedAt: string;
}

// ==================== TRENDING SERVICE TYPES ====================

export interface BadgeType {
  value: string;
  label: string;
  color: string;
}

// ==================== BADGE TYPES ====================
export const BADGE_TYPES = [
  { value: '', label: 'No Badge', color: 'bg-gray-100 text-gray-800' },
  { value: 'HOT', label: '🔥 HOT', color: 'bg-red-100 text-red-700' },
  { value: 'NEW', label: '✨ NEW', color: 'bg-blue-100 text-blue-700' },
  { value: 'POPULAR', label: '⭐ POPULAR', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'TRENDING', label: '📈 TRENDING', color: 'bg-orange-100 text-orange-700' },
  { value: 'BEST_SELLER', label: '🏆 BEST SELLER', color: 'bg-purple-100 text-purple-700' },
  { value: 'LIMITED', label: '⏰ LIMITED', color: 'bg-pink-100 text-pink-700' },
];

export interface SDUITrendingService {
  _id: string;
  id: string;
  serviceId: string;
  name: string;
  iconName: string;
  imageUrl: string | null;
  categoryId: string;
  categoryName: string;
  serviceSlug?: string;
  service?: string;
  badge: {
    text: string;
    type: 'success' | 'warning' | 'info' | 'error' | 'default' | 'HOT' | 'NEW' | 'POPULAR' | 'TRENDING' | 'BEST_SELLER' | 'LIMITED' | '';
  };
  bookingsToday: number;
  progress: number;
  sortOrder: number;
  isActive: boolean;
  autoSync: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrendingFilters {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: string;
  categoryId?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface SDUISection {
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
  visibility: {
    requireAuth: boolean;
    newUsersOnly: boolean;
    platforms: string[];
    minAppVersion: string;
  };
  customData: Record<string, any>;
}

export interface SDUILayout {
  _id: string;
  id: string;
  page: string;
  pageName: string;
  description: string;
  sections: SDUISection[];
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
  draft?: {
    sections: SDUISection[];
    settings: any;
    lastSavedAt: string;
  };
  publishHistory?: Array<{
    version: number;
    publishedAt: string;
    publishedBy?: string;
    changes?: string;
  }>;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BannerStats {
  totalBanners: number;
  activeBanners: number;
  inactiveBanners: number;
  scheduledBanners: number;
  expiredBanners: number;
  positionDistribution: Record<string, number>;
}

export interface CategoryStats {
  totalCategories: number;
  activeCategories: number;
  inactiveCategories: number;
  featuredCategories: number;
  totalServices: number;
  servicesPerCategory: Record<string, number>;
}

export interface TrendingStats {
  totalTrending: number;
  activeTrending: number;
  inactiveTrending: number;
  autoSyncEnabled: number;
  totalBookingsToday: number;
  avgProgress: number;
  categoryDistribution: Record<string, number>;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ==================== MORE SERVICES CONFIG TYPES ====================

export interface MoreServicesAction {
  type: 'all_services' | 'all_categories' | 'specific_category' | 'custom_screen' | 'external_url';
  targetCategory?: string | { _id: string; name: string; categoryId: string; icon: string; color: string } | null;
  screenName?: string;
  url?: string;
}

export interface MoreServicesDisplaySettings {
  title: string;
  subtitle: string;
  icon: string;
  image: {
    url: string | null;
    publicId: string | null;
  };
  color: string;
  colorClass: string;
  showServiceCount: boolean;
  customBadge: string;
  position: 'first' | 'last' | 'custom';
  sortOrder: number;
}

export interface MoreServicesServiceFilters {
  showAllServices: boolean;
  includeCategories: string[] | Array<{ _id: string; name: string; categoryId: string; icon: string }>;
  excludeCategories: string[] | Array<{ _id: string; name: string; categoryId: string; icon: string }>;
  onlyPopular: boolean;
  onlyFeatured: boolean;
  tags: string[];
  minRating: number;
}

export interface MoreServicesLayout {
  viewType: 'grid' | 'list' | 'grouped_by_category';
  gridColumns: number;
  showSearch: boolean;
  showCategoryFilters: boolean;
  showSortOptions: boolean;
  defaultSort: 'name' | 'popular' | 'price_low_high' | 'price_high_low' | 'newest' | 'rating';
  itemsPerPage: number;
}

export interface MoreServicesScreenStyle {
  headerTitle: string;
  backgroundColor: string;
  showBackButton: boolean;
}

export interface MoreServicesAnalytics {
  impressions: number;
  clicks: number;
  ctr: number;
  lastClicked: string | null;
}

export interface MoreServicesConfig {
  action: MoreServicesAction;
  displaySettings: MoreServicesDisplaySettings;
  serviceFilters: MoreServicesServiceFilters;
  layout: MoreServicesLayout;
  screenStyle?: MoreServicesScreenStyle;
}

export interface SDUICategoryWithMoreServices extends SDUICategory {
  isMoreServicesSection?: boolean;
  moreServicesConfig?: MoreServicesConfig;
}

// ==================== GRID MANAGEMENT TYPES ====================

export interface CategoryGridItem {
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
  isMoreServicesSection: boolean;
  subservicesCount?: number;
  servicesCount?: number;
  moreServicesConfig?: MoreServicesConfig;
  actionConfig?: CategoryActionConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryGridResponse {
  success: boolean;
  data: {
    gridCategories: CategoryGridItem[];
    remainingCategories: CategoryGridItem[];
    moreServicesSection: CategoryGridItem | null;
    totalCategories: number;
    gridSize: number;
  };
}

// ==================== FEATURE FLAG TYPES ====================

export interface SDUIFeatureFlag {
  _id: string;
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'boolean' | 'percentage' | 'user_list' | 'date_range' | 'json';
  value: {
    percentage: number;
    userIds: string[];
    jsonValue: any;
  };
  schedule: {
    isScheduled: boolean;
    startDate: string | null;
    endDate: string | null;
    timezone: string;
  };
  targeting: {
    platforms: string[];
    minAppVersion: string;
    maxAppVersion: string;
    cities: string[];
    userSegments: string[];
  };
  environment: 'development' | 'staging' | 'production' | 'all';
  category: 'feature' | 'experiment' | 'ops' | 'release' | 'ui' | 'backend' | 'other';
  tags: string[];
  dependencies: string[];
  priority: number;
  history: Array<{
    action: string;
    performedBy: string;
    performedByName: string;
    performedAt: string;
    previousValue: any;
    newValue: any;
    notes: string;
  }>;
  isCurrentlyActive?: boolean;
  isSchedulePending?: boolean;
  isExpired?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlagStats {
  totalFlags: number;
  enabledFlags: number;
  disabledFlags: number;
  scheduledFlags: number;
  categoryDistribution: Record<string, number>;
  environmentDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
}

export interface FeatureFlagFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  enabled?: string;
  environment?: string;
  tags?: string;
  sortBy?: string;
  sortOrder?: string;
}

// ==================== RESPONSE TYPES ====================

interface BannersResponse {
  success: boolean;
  data: SDUIBanner[];
  pagination?: Pagination;
}

interface BannerResponse {
  success: boolean;
  data: SDUIBanner;
}

interface BannerStatsResponse {
  success: boolean;
  data: BannerStats;
}

interface CategoriesResponse {
  success: boolean;
  data: SDUICategory[];
  pagination?: Pagination;
}

interface CategoryResponse {
  success: boolean;
  data: SDUICategory;
}

interface CategoryStatsResponse {
  success: boolean;
  data: CategoryStats;
}

interface TrendingResponse {
  success: boolean;
  data: SDUITrendingService[];
  pagination?: Pagination;
}

interface TrendingItemResponse {
  success: boolean;
  data: SDUITrendingService;
}

interface TrendingStatsResponse {
  success: boolean;
  data: TrendingStats;
}

interface LayoutsResponse {
  success: boolean;
  data: SDUILayout[];
}

interface LayoutResponse {
  success: boolean;
  data: SDUILayout;
}

interface SectionResponse {
  success: boolean;
  data: SDUISection;
}

interface SubservicesResponse {
  success: boolean;
  data: SDUISubservice[];
  pagination?: Pagination;
}

interface SubserviceResponse {
  success: boolean;
  data: SDUISubservice;
}

// ==================== HELPER FUNCTION ====================

const extractCategoryId = (category: any): string | null => {
  if (!category) return null;
  if (typeof category === 'string') return category;
  if (category.$oid) return category.$oid;
  if (category._id) {
    if (typeof category._id === 'string') return category._id;
    if (category._id.$oid) return category._id.$oid;
  }
  return null;
};

// ==================== BANNER API ====================

export const sduiBannerApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: string;
    position?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<BannersResponse> => {
    console.log('📋 Fetching SDUI banners...');
    const response = await apiClient.get('/admin/sdui/banners', { params });
    return response.data;
  },

  getById: async (id: string): Promise<BannerResponse> => {
    const response = await apiClient.get(`/admin/sdui/banners/${id}`);
    return response.data;
  },

  getStats: async (): Promise<BannerStatsResponse> => {
    const response = await apiClient.get('/admin/sdui/banners/stats');
    return response.data;
  },

  create: async (formData: FormData): Promise<BannerResponse> => {
    console.log('📤 Creating banner...');
    const response = await apiClient.post('/admin/sdui/banners', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  update: async (id: string, formData: FormData): Promise<BannerResponse> => {
    console.log('📤 Updating banner:', id);
    const response = await apiClient.put(`/admin/sdui/banners/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete(`/admin/sdui/banners/${id}`);
    return response.data;
  },

  reorder: async (banners: { id: string; sortOrder: number }[]): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/admin/sdui/banners/reorder', { banners });
    return response.data;
  },
};

// ==================== CATEGORY API ====================

export const sduiCategoryApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: string;
    isFeatured?: string;
    isMoreServicesSection?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<CategoriesResponse> => {
    console.log('📋 Fetching SDUI categories...');
    const response = await apiClient.get('/admin/sdui/categories', { params });
    return response.data;
  },

  getById: async (id: string): Promise<CategoryResponse> => {
    const response = await apiClient.get(`/admin/sdui/categories/${id}`);
    return response.data;
  },

  getStats: async (): Promise<CategoryStatsResponse> => {
    const response = await apiClient.get('/admin/sdui/categories/stats');
    return response.data;
  },

  create: async (formData: FormData): Promise<CategoryResponse> => {
    console.log('📤 Creating category...');
    const response = await apiClient.post('/admin/sdui/categories', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  update: async (id: string, formData: FormData | Record<string, any>): Promise<CategoryResponse> => {
    console.log('📤 Updating category:', id);
    if (formData instanceof FormData) {
      const response = await apiClient.put(`/admin/sdui/categories/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } else {
      const response = await apiClient.put(`/admin/sdui/categories/${id}`, formData);
      return response.data;
    }
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete(`/admin/sdui/categories/${id}`);
    return response.data;
  },

  reorder: async (categories: { id: string; sortOrder: number }[]): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/admin/sdui/categories/reorder', { categories });
    return response.data;
  },

  updateActionConfig: async (id: string, actionConfig: CategoryActionConfig): Promise<CategoryResponse> => {
    console.log('📤 Updating category action config:', id);
    const response = await apiClient.put(`/admin/sdui/categories/${id}`, { actionConfig });
    return response.data;
  },

  clearActionConfig: async (id: string): Promise<CategoryResponse> => {
    console.log('📤 Clearing category action config:', id);
    const response = await apiClient.put(`/admin/sdui/categories/${id}`, { actionConfig: null });
    return response.data;
  },

  getGridCategories: async (): Promise<CategoryGridResponse> => {
    console.log('📋 Fetching grid categories...');
    const response = await apiClient.get('/admin/sdui/categories', {
      params: { sortBy: 'sortOrder', sortOrder: 'asc', limit: 100 },
    });

    const allCategories: CategoryGridItem[] = response.data.data || [];
    const moreServicesSection = allCategories.find(cat => cat.isMoreServicesSection) || null;
    const regularCategories = allCategories.filter(cat => !cat.isMoreServicesSection && cat.isActive);
    regularCategories.sort((a, b) => a.sortOrder - b.sortOrder);
    const gridCategories = regularCategories.slice(0, 3);
    const remainingCategories = regularCategories.slice(3);

    return {
      success: true,
      data: {
        gridCategories,
        remainingCategories,
        moreServicesSection,
        totalCategories: regularCategories.length,
        gridSize: 3,
      },
    };
  },

  updateGridOrder: async (orderedIds: string[]): Promise<{ success: boolean; message: string }> => {
    console.log('📤 Updating grid order:', orderedIds);
    const categories = orderedIds.map((id, index) => ({ id, sortOrder: index }));
    const response = await apiClient.post('/admin/sdui/categories/reorder', { categories });
    return response.data;
  },

  upsertMoreServicesSection: async (formData: FormData): Promise<CategoryResponse> => {
    console.log('📤 Upserting More Services section...');
    const existingResponse = await apiClient.get('/admin/sdui/categories', {
      params: { isMoreServicesSection: 'true' },
    });
    const existing = existingResponse.data.data?.find((cat: any) => cat.isMoreServicesSection);

    if (existing) {
      console.log('📝 Updating existing More Services section:', existing._id);
      const response = await apiClient.put(`/admin/sdui/categories/${existing._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } else {
      console.log('➕ Creating new More Services section');
      formData.append('isMoreServicesSection', 'true');
      const response = await apiClient.post('/admin/sdui/categories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    }
  },

  toggleInGrid: async (categoryId: string, inGrid: boolean, newSortOrder: number): Promise<CategoryResponse> => {
    console.log('📤 Toggling category in grid:', categoryId, inGrid);
    const response = await apiClient.put(`/admin/sdui/categories/${categoryId}`, { sortOrder: newSortOrder });
    return response.data;
  },

  swapCategories: async (category1Id: string, category2Id: string): Promise<{ success: boolean; message: string }> => {
    console.log('📤 Swapping categories:', category1Id, category2Id);
    const [cat1Response, cat2Response] = await Promise.all([
      apiClient.get(`/admin/sdui/categories/${category1Id}`),
      apiClient.get(`/admin/sdui/categories/${category2Id}`),
    ]);

    const cat1SortOrder = cat1Response.data.data.sortOrder;
    const cat2SortOrder = cat2Response.data.data.sortOrder;

    await Promise.all([
      apiClient.put(`/admin/sdui/categories/${category1Id}`, { sortOrder: cat2SortOrder }),
      apiClient.put(`/admin/sdui/categories/${category2Id}`, { sortOrder: cat1SortOrder }),
    ]);

    return { success: true, message: 'Categories swapped successfully' };
  },

  getMoreServicesConfig: async (): Promise<{ success: boolean; data: SDUICategoryWithMoreServices | null }> => {
    console.log('📋 Fetching More Services configuration...');
    try {
      const response = await apiClient.get('/admin/categories/more-services-config');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { success: true, data: null };
      }
      throw error;
    }
  },

  updateMoreServicesConfig: async (config: Partial<MoreServicesConfig>): Promise<{ success: boolean; data: SDUICategoryWithMoreServices }> => {
    console.log('📤 Updating More Services configuration...');
    const response = await apiClient.put('/admin/categories/more-services-config', { config });
    return response.data;
  },
};

// ==================== SUBSERVICE API - COMPLETELY REWRITTEN ====================

export const sduiSubserviceApi = {
  /**
   * Get all subservices
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: string;
    isPopular?: string;
    isFeatured?: boolean;
    category?: string;
    categoryId?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<SubservicesResponse> => {
    console.log('📋 Fetching all subservices with params:', params);
    try {
      const response = await apiClient.get('/admin/subservices', { params });
      console.log('📦 Subservices response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching subservices:', error);
      return { success: false, data: [] };
    }
  },

  /**
   * Get subservices by Category ID
   * Tries multiple approaches to ensure we get the data
   */
  getByCategoryId: async (categoryId: string, params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<SubservicesResponse> => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 FETCHING SUBSERVICES FOR CATEGORY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📍 Category ID:', categoryId);

    if (!categoryId) {
      console.log('⚠️ No category ID provided');
      return { success: false, data: [] };
    }

    // Try multiple endpoints/approaches
    const approaches = [
      // Approach 1: Dedicated category route
      async () => {
        console.log('🔍 Approach 1: GET /admin/subservices/category/' + categoryId);
        const response = await apiClient.get(`/admin/subservices/category/${categoryId}`, {
          params: {
            isActive: params?.isActive ?? 'true',
            limit: params?.limit ?? 100,
            sortBy: params?.sortBy ?? 'sortOrder',
            sortOrder: params?.sortOrder ?? 'asc',
          },
        });
        return response.data;
      },
      // Approach 2: Query param with 'category'
      async () => {
        console.log('🔍 Approach 2: GET /admin/subservices?category=' + categoryId);
        const response = await apiClient.get('/admin/subservices', {
          params: {
            category: categoryId,
            isActive: params?.isActive ?? 'true',
            limit: params?.limit ?? 100,
            sortBy: params?.sortBy ?? 'sortOrder',
            sortOrder: params?.sortOrder ?? 'asc',
          },
        });
        return response.data;
      },
      // Approach 3: Fetch all and filter client-side
      async () => {
        console.log('🔍 Approach 3: Fetch all and filter client-side');
        const response = await apiClient.get('/admin/subservices', {
          params: { limit: 500 },
        });
        
        let allSubservices: SDUISubservice[] = [];
        if (response.data?.success && Array.isArray(response.data.data)) {
          allSubservices = response.data.data;
        } else if (Array.isArray(response.data)) {
          allSubservices = response.data;
        }

        console.log(`📦 Total subservices in DB: ${allSubservices.length}`);

        // Filter by category
        const filtered = allSubservices.filter((sub) => {
          // Check category ObjectId reference
          const catId = extractCategoryId(sub.category);
          if (catId === categoryId) return true;
          
          // Check categoryId string field
          if (sub.categoryId === categoryId) return true;
          
          return false;
        });

        console.log(`📦 Filtered to ${filtered.length} subservices for category ${categoryId}`);
        
        return { success: true, data: filtered };
      },
    ];

    // Try each approach until one works
    for (let i = 0; i < approaches.length; i++) {
      try {
        const result = await approaches[i]();
        
        let subservices: SDUISubservice[] = [];
        
        if (result?.success && Array.isArray(result.data)) {
          subservices = result.data;
        } else if (Array.isArray(result?.data?.data)) {
          subservices = result.data.data;
        } else if (Array.isArray(result)) {
          subservices = result;
        }

        if (subservices.length > 0) {
          console.log(`✅ Approach ${i + 1} SUCCESS! Found ${subservices.length} subservices`);
          subservices.slice(0, 5).forEach((s, idx) => console.log(`   ${idx + 1}. ${s.name}`));
          console.log('═══════════════════════════════════════════════════════════');
          return { success: true, data: subservices };
        } else {
          console.log(`⚠️ Approach ${i + 1}: No subservices found, trying next...`);
        }
      } catch (error: any) {
        console.log(`⚠️ Approach ${i + 1} failed:`, error.response?.status || error.message);
      }
    }

    // All approaches failed
    console.log('❌ All approaches failed - no subservices found');
    console.log('═══════════════════════════════════════════════════════════');
    return { success: true, data: [] };
  },

  /**
   * Get subservice by ID
   */
  getById: async (id: string): Promise<SubserviceResponse> => {
    const response = await apiClient.get(`/admin/subservices/${id}`);
    return response.data;
  },

  /**
   * Get multiple subservices by IDs
   */
  getByIds: async (ids: string[]): Promise<SubservicesResponse> => {
    console.log('📋 Fetching subservices by IDs:', ids);
    try {
      // Try bulk endpoint first
      const response = await apiClient.post('/admin/subservices/bulk-get', { ids });
      return response.data;
    } catch (error) {
      // Fallback: fetch all and filter
      const response = await apiClient.get('/admin/subservices', { params: { limit: 1000 } });
      let allSubservices: SDUISubservice[] = [];
      if (response.data?.success && Array.isArray(response.data.data)) {
        allSubservices = response.data.data;
      }
      const filtered = allSubservices.filter((s) => ids.includes(s._id));
      return { success: true, data: filtered };
    }
  },

  /**
   * Search subservices
   */
  search: async (query: string, categoryId?: string): Promise<SubservicesResponse> => {
    console.log('🔍 Searching subservices:', query, 'in category:', categoryId);

    if (categoryId) {
      const result = await sduiSubserviceApi.getByCategoryId(categoryId, {
        search: query,
        isActive: 'true',
      });
      return result;
    }

    const response = await apiClient.get('/admin/subservices', {
      params: { search: query, isActive: 'true', limit: 50 },
    });

    let subservices: SDUISubservice[] = [];
    if (response.data?.success && Array.isArray(response.data.data)) {
      subservices = response.data.data;
    }
    return { success: true, data: subservices };
  },

  /**
   * Create a new subservice
   */
  create: async (data: Partial<SDUISubservice>): Promise<SubserviceResponse> => {
    console.log('📤 Creating subservice:', data);
    const response = await apiClient.post('/admin/subservices', data);
    return response.data;
  },

  /**
   * Update a subservice
   */
  update: async (id: string, data: Partial<SDUISubservice>): Promise<SubserviceResponse> => {
    console.log('📤 Updating subservice:', id);
    const response = await apiClient.put(`/admin/subservices/${id}`, data);
    return response.data;
  },

  /**
   * Delete a subservice
   */
  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete(`/admin/subservices/${id}`);
    return response.data;
  },

  /**
   * Toggle status
   */
  toggleStatus: async (id: string, isActive: boolean): Promise<SubserviceResponse> => {
    const response = await apiClient.patch(`/admin/subservices/${id}/status`, { isActive });
    return response.data;
  },

  /**
   * Reorder subservices
   */
  reorder: async (subservices: { id: string; sortOrder: number }[]): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/admin/subservices/reorder', { subservices });
    return response.data;
  },
};

// ==================== TRENDING API ====================

export const sduiTrendingApi = {
  getAll: async (params?: TrendingFilters): Promise<TrendingResponse> => {
    console.log('📋 Fetching trending services...');
    const response = await apiClient.get('/admin/sdui/trending', { params });
    return response.data;
  },

  getById: async (id: string): Promise<TrendingItemResponse> => {
    const response = await apiClient.get(`/admin/sdui/trending/${id}`);
    return response.data;
  },

  getStats: async (): Promise<TrendingStatsResponse> => {
    const response = await apiClient.get('/admin/sdui/trending/stats');
    return response.data;
  },

  create: async (data: Partial<SDUITrendingService>): Promise<TrendingItemResponse> => {
    console.log('📤 Creating trending service:', data);
    const response = await apiClient.post('/admin/sdui/trending', data);
    return response.data;
  },

  update: async (id: string, data: Partial<SDUITrendingService>): Promise<TrendingItemResponse> => {
    console.log('📤 Updating trending service:', id, data);
    const response = await apiClient.put(`/admin/sdui/trending/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    console.log('🗑️ Deleting trending service:', id);
    const response = await apiClient.delete(`/admin/sdui/trending/${id}`);
    return response.data;
  },

  reorder: async (items: { id: string; sortOrder: number }[]): Promise<{ success: boolean; message: string }> => {
    console.log('🔄 Reordering trending services:', items);
    const response = await apiClient.post('/admin/sdui/trending/reorder', { items });
    return response.data;
  },

  syncStats: async (): Promise<{ success: boolean; message: string; data?: any }> => {
    console.log('🔄 Syncing trending stats from bookings...');
    const response = await apiClient.post('/admin/sdui/trending/sync-stats');
    return response.data;
  },

  toggleStatus: async (id: string, isActive: boolean): Promise<TrendingItemResponse> => {
    const response = await apiClient.patch(`/admin/sdui/trending/${id}/status`, { isActive });
    return response.data;
  },
};

// ==================== LAYOUT API ====================

export const sduiLayoutApi = {
  getAll: async (): Promise<LayoutsResponse> => {
    console.log('📋 Fetching layouts...');
    const response = await apiClient.get('/admin/sdui/layouts');
    return response.data;
  },

  getByPage: async (page: string): Promise<LayoutResponse> => {
    const response = await apiClient.get(`/admin/sdui/layouts/${page}`);
    return response.data;
  },

  create: async (data: Partial<SDUILayout>): Promise<LayoutResponse> => {
    const response = await apiClient.post('/admin/sdui/layouts', data);
    return response.data;
  },

  update: async (id: string, data: Partial<SDUILayout>): Promise<LayoutResponse> => {
    const response = await apiClient.put(`/admin/sdui/layouts/${id}`, data);
    return response.data;
  },

  updateSections: async (id: string, sections: SDUISection[]): Promise<LayoutResponse> => {
    const response = await apiClient.patch(`/admin/sdui/layouts/${id}/sections`, { sections });
    return response.data;
  },

  reorderSections: async (id: string, sections: { sectionId: string; order: number }[]): Promise<LayoutResponse> => {
    const response = await apiClient.post(`/admin/sdui/layouts/${id}/sections/reorder`, { sections });
    return response.data;
  },

  addSection: async (id: string, section: Partial<SDUISection>): Promise<SectionResponse> => {
    const response = await apiClient.post(`/admin/sdui/layouts/${id}/sections`, section);
    return response.data;
  },

  updateSectionConfig: async (id: string, sectionId: string, config: Partial<SDUISection>): Promise<SectionResponse> => {
    const response = await apiClient.patch(`/admin/sdui/layouts/${id}/sections/${sectionId}`, config);
    return response.data;
  },

  toggleSection: async (id: string, sectionId: string, enabled: boolean): Promise<LayoutResponse> => {
    const response = await apiClient.patch(`/admin/sdui/layouts/${id}/sections/${sectionId}/toggle`, { enabled });
    return response.data;
  },

  deleteSection: async (id: string, sectionId: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete(`/admin/sdui/layouts/${id}/sections/${sectionId}`);
    return response.data;
  },

  saveDraft: async (id: string, draft: { sections: SDUISection[]; settings?: any }): Promise<{ success: boolean; data: any }> => {
    const response = await apiClient.post(`/admin/sdui/layouts/${id}/draft`, draft);
    return response.data;
  },

  publish: async (id: string, changes?: string): Promise<LayoutResponse> => {
    const response = await apiClient.post(`/admin/sdui/layouts/${id}/publish`, { changes });
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete(`/admin/sdui/layouts/${id}`);
    return response.data;
  },
};

// ==================== FEATURE FLAG API ====================

export const sduiFeatureFlagApi = {
  getAll: async (params?: FeatureFlagFilters): Promise<{
    success: boolean;
    data: SDUIFeatureFlag[];
    pagination?: Pagination;
  }> => {
    console.log('📋 Fetching feature flags...');
    const response = await apiClient.get('/admin/sdui/feature-flags', { params });
    return response.data;
  },

  getById: async (id: string): Promise<{ success: boolean; data: SDUIFeatureFlag }> => {
    const response = await apiClient.get(`/admin/sdui/feature-flags/${id}`);
    return response.data;
  },

  getByKey: async (key: string): Promise<{ success: boolean; data: SDUIFeatureFlag }> => {
    const response = await apiClient.get(`/admin/sdui/feature-flags/key/${key}`);
    return response.data;
  },

  getStats: async (): Promise<{ success: boolean; data: FeatureFlagStats }> => {
    const response = await apiClient.get('/admin/sdui/feature-flags/stats');
    return response.data;
  },

  getHistory: async (id: string, limit?: number): Promise<{
    success: boolean;
    data: { key: string; name: string; history: any[] };
  }> => {
    const response = await apiClient.get(`/admin/sdui/feature-flags/${id}/history`, {
      params: { limit },
    });
    return response.data;
  },

  create: async (data: Partial<SDUIFeatureFlag>): Promise<{ success: boolean; data: SDUIFeatureFlag }> => {
    console.log('📤 Creating feature flag...');
    const response = await apiClient.post('/admin/sdui/feature-flags', data);
    return response.data;
  },

  update: async (id: string, data: Partial<SDUIFeatureFlag>): Promise<{ success: boolean; data: SDUIFeatureFlag }> => {
    console.log('📤 Updating feature flag:', id);
    const response = await apiClient.put(`/admin/sdui/feature-flags/${id}`, data);
    return response.data;
  },

  toggle: async (id: string, enabled: boolean, notes?: string): Promise<{ success: boolean; data: SDUIFeatureFlag }> => {
    const response = await apiClient.patch(`/admin/sdui/feature-flags/${id}/toggle`, { enabled, notes });
    return response.data;
  },

  bulkToggle: async (ids: string[], enabled: boolean, notes?: string): Promise<{
    success: boolean;
    data: { modifiedCount: number };
  }> => {
    const response = await apiClient.post('/admin/sdui/feature-flags/bulk-toggle', { ids, enabled, notes });
    return response.data;
  },

  duplicate: async (id: string, newKey?: string, newName?: string): Promise<{ success: boolean; data: SDUIFeatureFlag }> => {
    const response = await apiClient.post(`/admin/sdui/feature-flags/${id}/duplicate`, { newKey, newName });
    return response.data;
  },

  delete: async (id: string, permanent?: boolean): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete(`/admin/sdui/feature-flags/${id}`, {
      params: { permanent },
    });
    return response.data;
  },

  restore: async (id: string): Promise<{ success: boolean; data: SDUIFeatureFlag }> => {
    const response = await apiClient.patch(`/admin/sdui/feature-flags/${id}/restore`);
    return response.data;
  },

  check: async (key: string, context?: Record<string, string>): Promise<{
    success: boolean;
    data: { key: string; enabled: boolean; type: string; value: any; reason: string };
  }> => {
    const response = await apiClient.get(`/admin/sdui/feature-flags/check/${key}`, { params: context });
    return response.data;
  },

  getActive: async (): Promise<{
    success: boolean;
    data: Array<{ key: string; type: string; value: any }>;
  }> => {
    const response = await apiClient.get('/admin/sdui/feature-flags/active');
    return response.data;
  },
};

// ==================== SECTION TYPES ====================

export const SECTION_TYPES = [
  { value: 'banner_carousel', label: 'Banner Carousel', icon: '🖼️', dataSource: 'banners' },
  { value: 'category_grid', label: 'Category Grid', icon: '📦', dataSource: 'categories' },
  { value: 'category_list', label: 'Category List', icon: '📋', dataSource: 'categories' },
  { value: 'service_grid', label: 'Service Grid', icon: '🔧', dataSource: 'services' },
  { value: 'service_list', label: 'Service List', icon: '📝', dataSource: 'services' },
  { value: 'service_horizontal', label: 'Horizontal Services', icon: '↔️', dataSource: 'services' },
  { value: 'popular_services', label: 'Popular Services', icon: '⭐', dataSource: 'popular' },
  { value: 'trending_services', label: 'Trending Services', icon: '📈', dataSource: 'trending' },
  { value: 'featured_services', label: 'Featured Services', icon: '✨', dataSource: 'featured' },
  { value: 'search_bar', label: 'Search Bar', icon: '🔍', dataSource: '' },
  { value: 'promo_banner', label: 'Promo Banner', icon: '🎁', dataSource: 'banners' },
  { value: 'quick_actions', label: 'Quick Actions', icon: '⚡', dataSource: 'custom' },
  { value: 'emergency_section', label: 'Emergency Section', icon: '🚨', dataSource: '' },
  { value: 'spacer', label: 'Spacer', icon: '↕️', dataSource: '' },
  { value: 'divider', label: 'Divider', icon: '➖', dataSource: '' },
];

export const MATERIAL_ICONS = [
  'home', 'cleaning_services', 'plumbing', 'electrical_services', 'ac_unit',
  'construction', 'handyman', 'carpenter', 'format_paint', 'local_laundry_service',
  'pest_control', 'kitchen', 'bathroom', 'bed', 'chair',
  'build', 'settings', 'spa', 'self_improvement', 'fitness_center',
  'medical_services', 'local_hospital', 'directions_car', 'two_wheeler', 'local_shipping',
  'home_repair_service', 'auto_fix_high', 'water_drop', 'bolt', 'gardening',
  'yard', 'roofing', 'window', 'door_front', 'garage',
];

// ==================== FEATURE FLAG CONSTANTS ====================

export const FEATURE_FLAG_CATEGORIES = [
  { value: 'feature', label: 'Feature', color: 'bg-blue-100 text-blue-800', icon: '✨' },
  { value: 'experiment', label: 'Experiment', color: 'bg-purple-100 text-purple-800', icon: '🧪' },
  { value: 'ops', label: 'Operations', color: 'bg-orange-100 text-orange-800', icon: '⚙️' },
  { value: 'release', label: 'Release', color: 'bg-green-100 text-green-800', icon: '🚀' },
  { value: 'ui', label: 'UI/UX', color: 'bg-pink-100 text-pink-800', icon: '🎨' },
  { value: 'backend', label: 'Backend', color: 'bg-gray-100 text-gray-800', icon: '🔧' },
  { value: 'other', label: 'Other', color: 'bg-slate-100 text-slate-800', icon: '📦' },
];

export const FEATURE_FLAG_TYPES = [
  { value: 'boolean', label: 'Boolean (On/Off)', description: 'Simple on/off toggle' },
  { value: 'percentage', label: 'Percentage Rollout', description: 'Gradual rollout to % of users' },
  { value: 'user_list', label: 'User List', description: 'Enable for specific users' },
  { value: 'date_range', label: 'Date Range', description: 'Enable during specific dates' },
  { value: 'json', label: 'JSON Config', description: 'Custom JSON configuration' },
];

export const FEATURE_FLAG_ENVIRONMENTS = [
  { value: 'all', label: 'All Environments' },
  { value: 'development', label: 'Development' },
  { value: 'staging', label: 'Staging' },
  { value: 'production', label: 'Production' },
];

export const USER_SEGMENTS = [
  { value: 'all', label: 'All Users' },
  { value: 'new_users', label: 'New Users' },
  { value: 'returning_users', label: 'Returning Users' },
  { value: 'premium_users', label: 'Premium Users' },
  { value: 'free_users', label: 'Free Users' },
];

export const PLATFORMS = [
  { value: 'all', label: 'All Platforms' },
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
  { value: 'web', label: 'Web' },
];

// ==================== DEFAULT EXPORT ====================

export default {
  banners: sduiBannerApi,
  categories: sduiCategoryApi,
  subservices: sduiSubserviceApi,
  trending: sduiTrendingApi,
  layouts: sduiLayoutApi,
  featureFlags: sduiFeatureFlagApi,
};