// src/pages/SDUI/SubservicesPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Edit2, Trash2, Search, Eye, EyeOff, Filter, 
  Clock, X, RefreshCw, ChevronLeft, ChevronRight,
  AlertCircle, Check, Loader2, ArrowLeft, Package, ListChecks,
  Star, TrendingUp, Sparkles, Image as ImageIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/api';

// ==================== TYPES ====================
interface SubservicePricing {
  price: number;
  originalPrice: number | null;
  currency: string;
  displayText: string;
  priceType: string;
  unit: string;
}

interface SubserviceDuration {
  minutes: number;
  displayText: string;
}

interface SubserviceRating {
  average: number;
  count: number;
}

interface SubserviceDisplay {
  sortOrder: number;
  colorClass: string;
  badge?: {
    text: string;
    type: string;
  };
}

interface SubserviceImages {
  hero?: { url: string | null; publicId: string | null };
  thumbnail?: { url: string | null; publicId: string | null };
}

interface Category {
  _id: string;
  id?: string;
  categoryId: string;
  name: string;
  icon: string;
  color?: string;
  isActive: boolean;
}

interface Subservice {
  _id: string;
  id: string;
  subserviceId: string;
  category?: Category | string;
  categoryId?: string;
  categoryName?: string;
  service?: any;
  serviceId?: string;
  name: string;
  subtitle?: string;
  description: string;
  icon: string;
  colorClass: string;
  image?: string | null;
  images?: SubserviceImages;
  pricing: SubservicePricing;
  duration: SubserviceDuration;
  rating: SubserviceRating;
  display?: SubserviceDisplay;
  isActive: boolean;
  isPopular: boolean;
  isFeatured?: boolean;
  sortOrder: number;
  includes: string[];
  excludes: string[];
  requirements?: string[];
  tags?: string[];
  bookingCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface SubserviceStats {
  totalSubservices: number;
  activeSubservices: number;
  inactiveSubservices: number;
  popularSubservices: number;
  featuredSubservices?: number;
}

interface FormErrors {
  name?: string;
  categoryId?: string;
  price?: string;
  general?: string;
}

// ==================== CONSTANTS ====================
const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
];

const PRICE_TYPES = [
  { value: 'starting_from', label: 'Starting From', description: 'Shows "₹X onwards"' },
  { value: 'fixed', label: 'Fixed Price', description: 'Exact price shown' },
  { value: 'hourly', label: 'Per Hour', description: 'Shows "₹X/hr"' },
  { value: 'per_sqft', label: 'Per Sq.Ft', description: 'Shows "₹X/sqft"' },
  { value: 'per_unit', label: 'Per Unit', description: 'Shows "₹X/unit"' },
  { value: 'custom', label: 'Custom', description: 'Custom pricing' },
];

const COLOR_CLASSES = [
  { value: 'bg-blue-100', label: 'Blue', color: '#DBEAFE' },
  { value: 'bg-green-100', label: 'Green', color: '#DCFCE7' },
  { value: 'bg-yellow-100', label: 'Yellow', color: '#FEF9C3' },
  { value: 'bg-red-100', label: 'Red', color: '#FEE2E2' },
  { value: 'bg-purple-100', label: 'Purple', color: '#F3E8FF' },
  { value: 'bg-pink-100', label: 'Pink', color: '#FCE7F3' },
  { value: 'bg-indigo-100', label: 'Indigo', color: '#E0E7FF' },
  { value: 'bg-cyan-100', label: 'Cyan', color: '#CFFAFE' },
  { value: 'bg-orange-100', label: 'Orange', color: '#FFEDD5' },
];

// ==================== API ====================
const subservicesApi = {
  getAll: async (params?: Record<string, any>) => {
    const response = await apiClient.get('/admin/sdui/subservices', { params });
    return response.data;
  },
  getStats: async () => {
    const response = await apiClient.get('/admin/sdui/subservices/stats');
    return response.data;
  },
  getById: async (id: string) => {
    const response = await apiClient.get(`/admin/sdui/subservices/${id}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await apiClient.post('/admin/sdui/subservices', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    console.log('📤 Updating subservice:', id, data);
    const response = await apiClient.patch(`/admin/sdui/subservices/${id}`, data);
    return response.data;
  },
  toggleStatus: async (id: string, isActive: boolean) => {
    console.log('📤 Toggling status:', id, isActive);
    const response = await apiClient.patch(`/admin/sdui/subservices/${id}/status`, { isActive });
    return response.data;
  },
  toggleField: async (id: string, field: string, value: boolean) => {
    console.log('📤 Toggling field:', id, field, value);
    const response = await apiClient.patch(`/admin/sdui/subservices/${id}/toggle`, { field, value });
    return response.data;
  },
  delete: async (id: string) => {
    const response = await apiClient.delete(`/admin/sdui/subservices/${id}`);
    return response.data;
  },
};

const categoriesApi = {
  getAll: async (params?: Record<string, any>) => {
    const response = await apiClient.get('/admin/sdui/categories', { params });
    return response.data;
  },
};

// ==================== HELPERS ====================
const getCurrencySymbol = (code: string): string => {
  return CURRENCIES.find(c => c.code === code)?.symbol || code;
};

const formatPrice = (price: number, currency: string, priceType: string, unit?: string): string => {
  const symbol = getCurrencySymbol(currency);
  const formattedPrice = price.toLocaleString();
  
  switch (priceType) {
    case 'fixed':
      return `${symbol}${formattedPrice}`;
    case 'hourly':
      return `${symbol}${formattedPrice}/hr`;
    case 'per_sqft':
      return `${symbol}${formattedPrice}/sqft`;
    case 'per_unit':
      return `${symbol}${formattedPrice}/unit`;
    case 'custom':
      return unit ? `${symbol}${formattedPrice}/${unit}` : `${symbol}${formattedPrice}`;
    case 'starting_from':
    default:
      return `${symbol}${formattedPrice} onwards`;
  }
};

const calculateDiscount = (price: number, originalPrice: number | null): number | null => {
  if (!originalPrice || originalPrice <= price) return null;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
};

// ==================== COMPONENT ====================
const SubservicesPage: React.FC = () => {
  const navigate = useNavigate();
  
  // Data state
  const [subservices, setSubservices] = useState<Subservice[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<SubserviceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [popularFilter, setPopularFilter] = useState<'all' | 'popular' | 'regular'>('all');
  
  // Pagination state
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingSubservice, setEditingSubservice] = useState<Subservice | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // Loading states for individual toggles
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Form initial state
  const initialFormState = {
    name: '',
    subserviceId: '',
    categoryId: '',
    subtitle: '',
    description: '',
    icon: '🔧',
    colorClass: 'bg-blue-100',
    imageUrl: '',
    price: 0,
    originalPrice: 0,
    currency: 'INR',
    priceType: 'starting_from',
    unit: '',
    durationMinutes: 60,
    durationText: '',
    isActive: true,
    isPopular: false,
    isFeatured: false,
    sortOrder: 0,
    includes: '',
    excludes: '',
    requirements: '',
    tags: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  // ==================== DATA FETCHING ====================
  const fetchCategories = useCallback(async () => {
    try {
      const response = await categoriesApi.getAll({ isActive: 'true', limit: 100 });
      if (response.success) {
        const categoriesData = response.data?.categories || 
          (Array.isArray(response.data) ? response.data : response.data?.data || []);
        setCategories(categoriesData);
      }
    } catch (err: any) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  const fetchSubservices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, any> = { page: currentPage, limit: 10 };
      if (searchTerm) params.search = searchTerm;
      if (selectedCategory) params.categoryId = selectedCategory;
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active' ? 'true' : 'false';
      if (popularFilter !== 'all') params.isPopular = popularFilter === 'popular' ? 'true' : 'false';

      const response = await subservicesApi.getAll(params);

      if (response.success) {
        const data = response.data?.subservices || 
          (Array.isArray(response.data) ? response.data : response.data?.data || []);
        setSubservices(data);
        
        const paginationData = response.pagination || response.data?.pagination;
        if (paginationData) setPagination(paginationData);
      } else {
        setError(response.message || 'Failed to fetch subservices');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch subservices';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, selectedCategory, statusFilter, popularFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await subservicesApi.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Effects
  useEffect(() => { 
    fetchCategories(); 
    fetchStats(); 
  }, [fetchCategories, fetchStats]);
  
  useEffect(() => { 
    fetchSubservices(); 
  }, [fetchSubservices]);
  
  useEffect(() => { 
    setCurrentPage(1); 
  }, [searchTerm, selectedCategory, statusFilter, popularFilter]);

  // ==================== VALIDATION ====================
  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'Subservice name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    } else if (formData.name.trim().length > 150) {
      errors.name = 'Name cannot exceed 150 characters';
    }

    if (!formData.categoryId) {
      errors.categoryId = 'Please select a category';
    }

    if (formData.price < 0) {
      errors.price = 'Price cannot be negative';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ==================== HANDLERS ====================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSaving(true);
    setFormErrors({});

    try {
      const selectedCat = categories.find(c => c._id === formData.categoryId);
      if (!selectedCat) {
        setFormErrors({ categoryId: 'Selected category not found' });
        setSaving(false);
        return;
      }
      
      const displayText = formatPrice(formData.price, formData.currency, formData.priceType, formData.unit);
      
      const durationText = formData.durationText.trim() || 
        (formData.durationMinutes >= 60 
          ? `${Math.floor(formData.durationMinutes / 60)}-${Math.ceil(formData.durationMinutes / 60)} hours`
          : `${formData.durationMinutes} mins`);

      const payload: any = {
        name: formData.name.trim(),
        category: formData.categoryId,
        categoryId: selectedCat.categoryId,
        categoryName: selectedCat.name,
        subtitle: formData.subtitle.trim(),
        description: formData.description.trim(),
        icon: formData.icon || '🔧',
        colorClass: formData.colorClass,
        pricing: {
          price: Number(formData.price) || 0,
          originalPrice: formData.originalPrice > 0 ? Number(formData.originalPrice) : null,
          currency: formData.currency,
          priceType: formData.priceType,
          unit: formData.unit || '',
          displayText,
        },
        duration: {
          minutes: Number(formData.durationMinutes) || 60,
          displayText: durationText,
        },
        display: {
          sortOrder: Number(formData.sortOrder) || 0,
          colorClass: formData.colorClass,
          badge: {
            text: formData.isPopular ? 'Popular' : (formData.isFeatured ? 'Featured' : ''),
            type: formData.isPopular ? 'warning' : (formData.isFeatured ? 'info' : ''),
          },
        },
        isActive: formData.isActive,
        isPopular: formData.isPopular,
        isFeatured: formData.isFeatured,
        sortOrder: Number(formData.sortOrder) || 0,
        includes: formData.includes.split('\n').map(i => i.trim()).filter(Boolean),
        excludes: formData.excludes.split('\n').map(e => e.trim()).filter(Boolean),
        requirements: formData.requirements.split('\n').map(r => r.trim()).filter(Boolean),
        tags: formData.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
      };

      // Add image if provided
      if (formData.imageUrl.trim()) {
        payload.image = formData.imageUrl.trim();
        payload.images = {
          hero: { url: formData.imageUrl.trim(), publicId: null },
          thumbnail: { url: formData.imageUrl.trim(), publicId: null },
        };
      }

      console.log('📤 Submitting payload:', JSON.stringify(payload, null, 2));

      let response;
      if (editingSubservice) {
        console.log('📝 Updating existing subservice:', editingSubservice._id);
        response = await subservicesApi.update(editingSubservice._id, payload);
      } else {
        console.log('➕ Creating new subservice');
        response = await subservicesApi.create(payload);
      }

      console.log('📥 Response:', response);

      if (response.success) {
        await fetchSubservices();
        await fetchStats();
        closeModal();
      } else {
        setFormErrors({ general: response.message || 'Failed to save subservice' });
      }
    } catch (err: any) {
      console.error('❌ Error saving subservice:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Error saving subservice';
      setFormErrors({ general: errorMsg });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await subservicesApi.delete(id);
      if (response.success) {
        await fetchSubservices();
        await fetchStats();
        setDeleteConfirm(null);
      } else {
        alert(response.message || 'Failed to delete');
      }
    } catch (err: any) {
      console.error('Error deleting:', err);
      alert(err.response?.data?.message || 'Error deleting');
    }
  };

  // Toggle any field (isActive, isPopular, isFeatured)
  const toggleField = async (subservice: Subservice, field: 'isActive' | 'isPopular' | 'isFeatured') => {
    const newValue = !subservice[field];
    setTogglingId(`${subservice._id}-${field}`);
    
    try {
      let response;
      
      if (field === 'isActive') {
        response = await subservicesApi.toggleStatus(subservice._id, newValue);
      } else {
        response = await subservicesApi.toggleField(subservice._id, field, newValue);
      }
      
      console.log('📥 Toggle response:', response);
      
      if (response.success) {
        // Update local state immediately
        setSubservices(prev => prev.map(s => 
          s._id === subservice._id ? { ...s, [field]: newValue } : s
        ));
        // Refresh stats
        await fetchStats();
      } else {
        alert(response.message || 'Failed to update');
      }
    } catch (err: any) {
      console.error(`❌ Error toggling ${field}:`, err);
      alert(err.response?.data?.message || `Error updating ${field}`);
    } finally {
      setTogglingId(null);
    }
  };

  const openModal = (subservice?: Subservice) => {
    setFormErrors({});
    
    if (subservice) {
      console.log('📝 Opening edit modal for:', subservice.name, subservice._id);
      setEditingSubservice(subservice);
      
      let categoryId = '';
      if (typeof subservice.category === 'object' && subservice.category?._id) {
        categoryId = subservice.category._id;
      } else if (subservice.categoryId) {
        const foundCat = categories.find(c => 
          c.categoryId === subservice.categoryId || c._id === subservice.categoryId
        );
        categoryId = foundCat?._id || '';
      }
      
      setFormData({
        name: subservice.name || '',
        subserviceId: subservice.subserviceId || '',
        categoryId: categoryId,
        subtitle: subservice.subtitle || '',
        description: subservice.description || '',
        icon: subservice.icon || '🔧',
        colorClass: subservice.display?.colorClass || subservice.colorClass || 'bg-blue-100',
        imageUrl: subservice.images?.hero?.url || subservice.image || '',
        price: subservice.pricing?.price || 0,
        originalPrice: subservice.pricing?.originalPrice || 0,
        currency: subservice.pricing?.currency || 'INR',
        priceType: subservice.pricing?.priceType || 'starting_from',
        unit: subservice.pricing?.unit || '',
        durationMinutes: subservice.duration?.minutes || 60,
        durationText: subservice.duration?.displayText || '',
        isActive: subservice.isActive ?? true,
        isPopular: subservice.isPopular || false,
        isFeatured: subservice.isFeatured || false,
        sortOrder: subservice.display?.sortOrder || subservice.sortOrder || 0,
        includes: subservice.includes?.join('\n') || '',
        excludes: subservice.excludes?.join('\n') || '',
        requirements: subservice.requirements?.join('\n') || '',
        tags: subservice.tags?.join(', ') || '',
      });
    } else {
      console.log('➕ Opening create modal');
      setEditingSubservice(null);
      setFormData({
        ...initialFormState,
        categoryId: selectedCategory || '',
        sortOrder: subservices.length,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => { 
    setShowModal(false); 
    setEditingSubservice(null);
    setFormErrors({});
  };
  
  const getCategoryName = (subservice: Subservice): string => {
    if (typeof subservice.category === 'object' && subservice.category?.name) {
      return subservice.category.name;
    }
    if (subservice.categoryName) {
      return subservice.categoryName;
    }
    const found = categories.find(c => 
      c._id === subservice.categoryId || c.categoryId === subservice.categoryId
    );
    return found?.name || 'Uncategorized';
  };

  const getCategoryIcon = (subservice: Subservice): string => {
    if (typeof subservice.category === 'object' && subservice.category?.icon) {
      return subservice.category.icon;
    }
    const found = categories.find(c => 
      c._id === subservice.categoryId || c.categoryId === subservice.categoryId
    );
    return found?.icon || '📁';
  };

  const getSubserviceImage = (subservice: Subservice): string | null => {
    return subservice.images?.thumbnail?.url || 
           subservice.images?.hero?.url || 
           subservice.image || 
           null;
  };

  // ==================== RENDER ====================
  if (loading && subservices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
          <p className="text-gray-500">Loading subservices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={() => navigate('/sdui')} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Subservices Manager</h1>
            <p className="text-gray-600">Manage individual service items for your SDUI mobile app</p>
          </div>
          <button 
            onClick={() => { fetchSubservices(); fetchStats(); }} 
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-2xl font-bold text-gray-900">{stats.totalSubservices}</p>
              <p className="text-sm text-gray-500">Total Subservices</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-2xl font-bold text-green-600">{stats.activeSubservices}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-2xl font-bold text-gray-400">{stats.inactiveSubservices}</p>
              <p className="text-sm text-gray-500">Inactive</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                <p className="text-2xl font-bold text-orange-600">{stats.popularSubservices}</p>
              </div>
              <p className="text-sm text-gray-500">Popular</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <p className="text-2xl font-bold text-purple-600">{stats.featuredSubservices || 0}</p>
              </div>
              <p className="text-sm text-gray-500">Featured</p>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div className="flex flex-wrap gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search subservices..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" 
            />
          </div>
          
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)} 
              className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-cyan-500 appearance-none"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat._id} value={cat._id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>
          
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value as any)} 
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
          
          <select 
            value={popularFilter} 
            onChange={(e) => setPopularFilter(e.target.value as any)} 
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">All Types</option>
            <option value="popular">Popular Only</option>
            <option value="regular">Regular Only</option>
          </select>
        </div>
        
        <button 
          onClick={() => openModal()} 
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" /> Add Subservice
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subservice</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {subservices.map((sub) => {
                const discount = calculateDiscount(sub.pricing?.price || 0, sub.pricing?.originalPrice);
                const subImage = getSubserviceImage(sub);
                const isTogglingActive = togglingId === `${sub._id}-isActive`;
                const isTogglingPopular = togglingId === `${sub._id}-isPopular`;
                const isTogglingFeatured = togglingId === `${sub._id}-isFeatured`;
                
                return (
                  <tr key={sub._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${sub.display?.colorClass || sub.colorClass || 'bg-blue-100'}`}>
                          {subImage ? (
                            <img 
                              src={subImage} 
                              alt={sub.name} 
                              className="h-8 w-8 rounded object-cover"
                              onError={(e) => { 
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement!.innerHTML = sub.icon || '🔧';
                              }}
                            />
                          ) : (
                            <span className="text-xl">{sub.icon || '🔧'}</span>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{sub.name}</span>
                          </div>
                          <code className="text-xs text-gray-500 bg-gray-100 px-1 rounded">{sub.subserviceId}</code>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded-full font-medium inline-flex items-center gap-1">
                        <span>{getCategoryIcon(sub)}</span>
                        {getCategoryName(sub)}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-semibold text-gray-900">
                          {getCurrencySymbol(sub.pricing?.currency || 'INR')}
                          {(sub.pricing?.price || 0).toLocaleString()}
                        </div>
                        {sub.pricing?.originalPrice && sub.pricing.originalPrice > sub.pricing.price && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 line-through">
                              {getCurrencySymbol(sub.pricing?.currency || 'INR')}{sub.pricing.originalPrice.toLocaleString()}
                            </span>
                            {discount && (
                              <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                {discount}% OFF
                              </span>
                            )}
                          </div>
                        )}
                        <span className="text-xs text-gray-500 capitalize">
                          {(sub.pricing?.priceType || 'starting_from').replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Clock className="w-3.5 h-3.5" />
                        {sub.duration?.displayText || `${sub.duration?.minutes || 60} mins`}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-sm font-medium">{(sub.rating?.average || 0).toFixed(1)}</span>
                        <span className="text-xs text-gray-500">({sub.rating?.count || 0})</span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5">
                        {/* Active/Inactive Toggle */}
                        <button 
                          onClick={() => toggleField(sub, 'isActive')}
                          disabled={isTogglingActive}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full transition-all font-medium ${
                            sub.isActive 
                              ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          } ${isTogglingActive ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          {isTogglingActive ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : sub.isActive ? (
                            <Eye className="w-3 h-3" />
                          ) : (
                            <EyeOff className="w-3 h-3" />
                          )}
                          {sub.isActive ? 'Active' : 'Inactive'}
                        </button>
                        
                        {/* Badge Toggles Row */}
                        <div className="flex gap-1 flex-wrap">
                          {/* Popular Toggle */}
                          <button 
                            onClick={() => toggleField(sub, 'isPopular')}
                            disabled={isTogglingPopular}
                            className={`px-2 py-0.5 text-xs rounded font-medium transition-all flex items-center gap-1 ${
                              sub.isPopular 
                                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                            } ${isTogglingPopular ? 'opacity-50 cursor-wait' : ''}`}
                            title={sub.isPopular ? 'Remove Popular badge' : 'Add Popular badge'}
                          >
                            {isTogglingPopular ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <TrendingUp className="w-3 h-3" />
                            )}
                            Popular
                          </button>
                          
                          {/* Featured Toggle */}
                          <button 
                            onClick={() => toggleField(sub, 'isFeatured')}
                            disabled={isTogglingFeatured}
                            className={`px-2 py-0.5 text-xs rounded font-medium transition-all flex items-center gap-1 ${
                              sub.isFeatured 
                                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                            } ${isTogglingFeatured ? 'opacity-50 cursor-wait' : ''}`}
                            title={sub.isFeatured ? 'Remove Featured badge' : 'Add Featured badge'}
                          >
                            {isTogglingFeatured ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            Featured
                          </button>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => openModal(sub)} 
                          className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm(sub._id)} 
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {subservices.length === 0 && !loading && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No subservices found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || selectedCategory ? 'Try adjusting your filters' : 'Create your first subservice'}
            </p>
            {!searchTerm && !selectedCategory && (
              <button 
                onClick={() => openModal()} 
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
              >
                <Plus className="w-4 h-4" /> Create Subservice
              </button>
            )}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50">
            <p className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} subservices
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={!pagination.hasPrev} 
                className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-sm font-medium">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))} 
                disabled={!pagination.hasNext} 
                className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Subservice</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this subservice? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteConfirm(null)} 
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDelete(deleteConfirm)} 
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingSubservice ? 'Edit Subservice' : 'Create New Subservice'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {editingSubservice ? `Editing: ${editingSubservice.name}` : 'Add a new subservice to your catalog'}
                </p>
              </div>
              <button 
                onClick={closeModal} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Error */}
            {formErrors.general && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{formErrors.general}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                
                {/* Basic Info Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Basic Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subservice Name <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={formData.name} 
                        onChange={(e) => {
                          setFormData({ ...formData, name: e.target.value });
                          if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                        }}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 ${
                          formErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="e.g., AC Gas Refill"
                      />
                      {formErrors.name && (
                        <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select 
                        value={formData.categoryId} 
                        onChange={(e) => {
                          setFormData({ ...formData, categoryId: e.target.value });
                          if (formErrors.categoryId) setFormErrors({ ...formErrors, categoryId: undefined });
                        }}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 ${
                          formErrors.categoryId ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        disabled={!!editingSubservice}
                      >
                        <option value="">Select a category</option>
                        {categories.map(cat => (
                          <option key={cat._id} value={cat._id}>{cat.icon} {cat.name}</option>
                        ))}
                      </select>
                      {formErrors.categoryId && (
                        <p className="mt-1 text-xs text-red-600">{formErrors.categoryId}</p>
                      )}
                      {editingSubservice && (
                        <p className="mt-1 text-xs text-gray-400">Category cannot be changed after creation</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle / Tagline</label>
                    <input 
                      type="text" 
                      value={formData.subtitle} 
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      placeholder="e.g., Professional gas refilling service"
                      maxLength={200}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea 
                      value={formData.description} 
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" 
                      rows={3}
                      placeholder="Detailed description of the subservice..."
                      maxLength={2000}
                    />
                    <p className="mt-1 text-xs text-gray-400">{formData.description.length}/2000 characters</p>
                  </div>
                </div>

                {/* Appearance Section */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Appearance</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Icon (Emoji)</label>
                      <input 
                        type="text" 
                        value={formData.icon} 
                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-2xl focus:ring-2 focus:ring-cyan-500"
                        maxLength={4}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
                      <select 
                        value={formData.colorClass} 
                        onChange={(e) => setFormData({ ...formData, colorClass: e.target.value })} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      >
                        {COLOR_CLASSES.map(color => (
                          <option key={color.value} value={color.value}>{color.label}</option>
                        ))}
                      </select>
                      <div className="mt-2 flex gap-1">
                        {COLOR_CLASSES.map(color => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, colorClass: color.value })}
                            className={`w-6 h-6 rounded-full border-2 transition-transform ${
                              formData.colorClass === color.value ? 'border-gray-800 scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color.color }}
                            title={color.label}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                      <input 
                        type="number" 
                        value={formData.sortOrder} 
                        onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500" 
                        min="0"
                      />
                      <p className="mt-1 text-xs text-gray-400">Lower numbers appear first</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon className="w-4 h-4" />
                        Image URL
                      </span>
                    </label>
                    <input 
                      type="url" 
                      value={formData.imageUrl} 
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      placeholder="https://example.com/image.jpg"
                    />
                    {formData.imageUrl && (
                      <div className="mt-2 flex items-center gap-3">
                        <img 
                          src={formData.imageUrl} 
                          alt="Preview" 
                          className="h-16 w-16 object-cover rounded-lg border"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        <span className="text-xs text-gray-500">Image preview</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pricing Section */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Pricing</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                      <select 
                        value={formData.currency} 
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      >
                        {CURRENCIES.map(curr => (
                          <option key={curr.code} value={curr.code}>
                            {curr.symbol} {curr.code}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Price <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                          {getCurrencySymbol(formData.currency)}
                        </span>
                        <input 
                          type="number" 
                          value={formData.price} 
                          onChange={(e) => {
                            setFormData({ ...formData, price: parseFloat(e.target.value) || 0 });
                            if (formErrors.price) setFormErrors({ ...formErrors, price: undefined });
                          }}
                          className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 ${
                            formErrors.price ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                          min="0"
                          step="1"
                          placeholder="0"
                        />
                      </div>
                      {formErrors.price && (
                        <p className="mt-1 text-xs text-red-600">{formErrors.price}</p>
                      )}
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Original Price <span className="text-xs text-gray-400">(discount)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                          {getCurrencySymbol(formData.currency)}
                        </span>
                        <input 
                          type="number" 
                          value={formData.originalPrice || ''} 
                          onChange={(e) => setFormData({ ...formData, originalPrice: parseFloat(e.target.value) || 0 })} 
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                          min="0"
                          step="1"
                          placeholder="Optional"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price Type</label>
                      <select 
                        value={formData.priceType} 
                        onChange={(e) => setFormData({ ...formData, priceType: e.target.value })} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      >
                        {PRICE_TYPES.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Price Preview */}
                  <div className="p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-100">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Price Preview</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold text-cyan-700">
                        {formatPrice(formData.price, formData.currency, formData.priceType, formData.unit)}
                      </p>
                      {formData.originalPrice > formData.price && formData.originalPrice > 0 && (
                        <>
                          <span className="text-lg text-gray-400 line-through">
                            {getCurrencySymbol(formData.currency)}{formData.originalPrice.toLocaleString()}
                          </span>
                          <span className="text-sm font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded">
                            {calculateDiscount(formData.price, formData.originalPrice)}% OFF
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Duration Section */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Duration</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                      <input 
                        type="number" 
                        value={formData.durationMinutes} 
                        onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 0 })} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500" 
                        min="0"
                        step="15"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Display Text (optional)</label>
                      <input 
                        type="text" 
                        value={formData.durationText} 
                        onChange={(e) => setFormData({ ...formData, durationText: e.target.value })} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                        placeholder="e.g., 30-45 mins"
                      />
                    </div>
                  </div>
                </div>

                {/* Service Details Section */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <ListChecks className="w-4 h-4" />
                    Service Details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <span className="inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-green-600" />
                          What's Included
                        </span>
                      </label>
                      <textarea 
                        value={formData.includes} 
                        onChange={(e) => setFormData({ ...formData, includes: e.target.value })} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500" 
                        rows={4}
                        placeholder="One item per line"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <span className="inline-flex items-center gap-1">
                          <X className="w-3.5 h-3.5 text-red-600" />
                          What's Excluded
                        </span>
                      </label>
                      <textarea 
                        value={formData.excludes} 
                        onChange={(e) => setFormData({ ...formData, excludes: e.target.value })} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500" 
                        rows={4}
                        placeholder="One item per line"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <span className="inline-flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-yellow-600" />
                          Requirements
                        </span>
                      </label>
                      <textarea 
                        value={formData.requirements} 
                        onChange={(e) => setFormData({ ...formData, requirements: e.target.value })} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500" 
                        rows={4}
                        placeholder="One item per line"
                      />
                    </div>
                  </div>
                </div>

                {/* Tags Section */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Tags & SEO</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                    <input 
                      type="text" 
                      value={formData.tags} 
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      placeholder="ac, gas, refill, cooling"
                    />
                    {formData.tags && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {formData.tags.split(',').filter(t => t.trim()).map((tag, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Section */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Status & Visibility</h3>
                  
                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={formData.isActive} 
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} 
                          className="sr-only peer"
                        />
                        <div className="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-green-500 transition-colors"></div>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">Active</span>
                        <p className="text-xs text-gray-500">Visible to users</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={formData.isPopular} 
                          onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })} 
                          className="sr-only peer"
                        />
                        <div className="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-orange-500 transition-colors"></div>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4 text-orange-500" />
                          <span className="text-sm font-medium text-gray-700">Popular</span>
                        </div>
                        <p className="text-xs text-gray-500">Shows "Popular" badge</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={formData.isFeatured} 
                          onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })} 
                          className="sr-only peer"
                        />
                        <div className="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-purple-500 transition-colors"></div>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <Sparkles className="w-4 h-4 text-purple-500" />
                          <span className="text-sm font-medium text-gray-700">Featured</span>
                        </div>
                        <p className="text-xs text-gray-500">Featured section</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center flex-shrink-0">
                <p className="text-xs text-gray-500">
                  <span className="text-red-500">*</span> Required fields
                </p>
                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={closeModal} 
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving} 
                    className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2 transition-colors shadow-sm"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        {editingSubservice ? 'Update Subservice' : 'Create Subservice'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubservicesPage;