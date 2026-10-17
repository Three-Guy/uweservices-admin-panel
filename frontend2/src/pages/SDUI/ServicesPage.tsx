// src/pages/SDUI/ServicesPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Edit2, Trash2, Search, Eye, EyeOff, Filter, 
  Star, Clock, X, RefreshCw, ChevronLeft, ChevronRight,
  AlertCircle, Check, Loader2, ArrowLeft, IndianRupee, DollarSign
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/api';

// ==================== TYPES ====================
interface ServiceImage {
  url: string | null;
  publicId: string | null;
}

interface ServicePricing {
  basePrice: number;
  currency: string;
  displayText: string;
  priceType: 'fixed' | 'starting_from' | 'hourly' | 'per_unit';
}

interface ServiceDuration {
  minutes: number;
  displayText: string;
}

interface ServiceRating {
  average: number;
  count: number;
}

interface ServiceDisplay {
  sortOrder: number;
  colorClass: string;
  badge?: {
    text: string;
    type: string;
  };
}

interface Category {
  _id: string;
  id: string;
  categoryId: string;
  name: string;
  icon: string;
  isActive: boolean;
}

interface Service {
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
  image: string | null;
  images: {
    hero: ServiceImage;
    thumbnail: ServiceImage;
  };
  color: string;
  pricing: ServicePricing;
  duration: ServiceDuration;
  rating: ServiceRating;
  display: ServiceDisplay;
  isActive: boolean;
  isPopular: boolean;
  isFeatured: boolean;
  sortOrder: number;
  subservicesCount: number;
  tags: string[];
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

interface ServiceStats {
  totalServices: number;
  activeServices: number;
  inactiveServices: number;
  popularServices: number;
  featuredServices: number;
}

interface FormErrors {
  name?: string;
  categoryId?: string;
  basePrice?: string;
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
  { value: 'per_unit', label: 'Per Unit', description: 'Shows "₹X/unit"' },
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
const servicesApi = {
  getAll: async (params?: Record<string, any>) => {
    const response = await apiClient.get('/admin/sdui/services', { params });
    return response.data;
  },
  getStats: async () => {
    const response = await apiClient.get('/admin/sdui/services/stats');
    return response.data;
  },
  create: async (data: any) => {
    const response = await apiClient.post('/admin/sdui/services', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await apiClient.put(`/admin/sdui/services/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await apiClient.delete(`/admin/sdui/services/${id}`);
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

const formatPrice = (price: number, currency: string, priceType: string): string => {
  const symbol = getCurrencySymbol(currency);
  const formattedPrice = price.toLocaleString();
  
  switch (priceType) {
    case 'fixed':
      return `${symbol}${formattedPrice}`;
    case 'hourly':
      return `${symbol}${formattedPrice}/hr`;
    case 'per_unit':
      return `${symbol}${formattedPrice}/unit`;
    case 'starting_from':
    default:
      return `${symbol}${formattedPrice} onwards`;
  }
};

const generateServiceId = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 50);
};

// ==================== COMPONENT ====================
const ServicesPage: React.FC = () => {
  const navigate = useNavigate();
  
  // State
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // Form state
  const initialFormState = {
    name: '',
    serviceId: '',
    categoryId: '',
    description: '',
    shortDescription: '',
    subtitle: '',
    icon: '🔧',
    colorClass: 'bg-blue-100',
    imageUrl: '',
    basePrice: 0,
    currency: 'INR',
    priceType: 'starting_from',
    durationMinutes: 60,
    durationText: '',
    isActive: true,
    isPopular: false,
    isFeatured: false,
    sortOrder: 0,
    tags: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  // ==================== DATA FETCHING ====================
  const fetchCategories = useCallback(async () => {
    try {
      const response = await categoriesApi.getAll({ isActive: 'true', limit: 100 });
      if (response.success) {
        const categoriesData = Array.isArray(response.data) 
          ? response.data 
          : response.data?.data || response.data?.categories || [];
        setCategories(categoriesData);
      }
    } catch (err: any) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, any> = { page: currentPage, limit: 10 };
      if (searchTerm) params.search = searchTerm;
      if (selectedCategory) params.category = selectedCategory;
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active' ? 'true' : 'false';

      const response = await servicesApi.getAll(params);

      if (response.success) {
        const servicesData = response.data?.services || 
          (Array.isArray(response.data) ? response.data : response.data?.data || []);
        setServices(servicesData);
        
        const paginationData = response.pagination || response.data?.pagination;
        if (paginationData) setPagination(paginationData);
      } else {
        setError(response.message || 'Failed to fetch services');
      }
    } catch (err: any) {
      console.error('Error fetching services:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, selectedCategory, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await servicesApi.getStats();
      if (response.success) setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  useEffect(() => { fetchCategories(); fetchStats(); }, [fetchCategories, fetchStats]);
  useEffect(() => { fetchServices(); }, [fetchServices]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedCategory, statusFilter]);

  // ==================== VALIDATION ====================
  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'Service name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Service name must be at least 2 characters';
    } else if (formData.name.trim().length > 100) {
      errors.name = 'Service name cannot exceed 100 characters';
    }

    if (!formData.categoryId) {
      errors.categoryId = 'Please select a category';
    }

    if (formData.basePrice < 0) {
      errors.basePrice = 'Price cannot be negative';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ==================== HANDLERS ====================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    setFormErrors({});

    try {
      // Generate serviceId if not provided
      const serviceId = formData.serviceId.trim() || generateServiceId(formData.name);
      
      // Build display text
      const displayText = formatPrice(formData.basePrice, formData.currency, formData.priceType);
      
      // Build duration text
      const durationText = formData.durationText.trim() || 
        (formData.durationMinutes >= 60 
          ? `${Math.floor(formData.durationMinutes / 60)}-${Math.ceil(formData.durationMinutes / 60)} hours`
          : `${formData.durationMinutes} mins`);

      const payload = {
        name: formData.name.trim(),
        serviceId,
        subtitle: formData.subtitle.trim(),
        description: formData.description.trim(),
        category: formData.categoryId,
        icon: formData.icon || '🔧',
        image: formData.imageUrl || null,
        images: formData.imageUrl ? {
          hero: { url: formData.imageUrl, publicId: null },
          thumbnail: { url: formData.imageUrl, publicId: null },
        } : undefined,
        pricing: {
          basePrice: Number(formData.basePrice) || 0,
          currency: formData.currency,
          priceType: formData.priceType,
          displayText,
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
        tags: formData.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
      };

      console.log('📤 Submitting service payload:', payload);

      let response;
      if (editingService) {
        response = await servicesApi.update(editingService._id, payload);
      } else {
        response = await servicesApi.create(payload);
      }

      console.log('📥 Response:', response);

      if (response.success) {
        await fetchServices();
        await fetchStats();
        closeModal();
      } else {
        // Handle validation errors from backend
        if (response.errors && Array.isArray(response.errors)) {
          const backendErrors: FormErrors = { general: response.message };
          response.errors.forEach((err: any) => {
            if (err.field === 'name') backendErrors.name = err.message;
            if (err.field === 'category') backendErrors.categoryId = err.message;
            if (err.field === 'pricing.basePrice') backendErrors.basePrice = err.message;
          });
          setFormErrors(backendErrors);
        } else {
          setFormErrors({ general: response.message || 'Failed to save service' });
        }
      }
    } catch (err: any) {
      console.error('Error saving service:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Error saving service';
      setFormErrors({ general: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await servicesApi.delete(id);
      if (response.success) {
        await fetchServices();
        await fetchStats();
        setDeleteConfirm(null);
      } else {
        alert(response.message || 'Failed to delete service');
      }
    } catch (err: any) {
      console.error('Error deleting service:', err);
      alert(err.response?.data?.message || 'Error deleting service');
    }
  };

  const toggleStatus = async (service: Service, field: 'isActive' | 'isPopular' | 'isFeatured') => {
    try {
      const response = await servicesApi.update(service._id, { [field]: !service[field] });
      if (response.success) {
        setServices(prev => prev.map(s => s._id === service._id ? { ...s, [field]: !s[field] } : s));
        await fetchStats();
      }
    } catch (err: any) {
      console.error('Error toggling status:', err);
      alert('Error updating service');
    }
  };

  const openModal = (service?: Service) => {
    setFormErrors({});
    
    if (service) {
      setEditingService(service);
      const categoryId = typeof service.category === 'object' 
        ? service.category._id 
        : service.categoryId || service.category;
      
      setFormData({
        name: service.name || '',
        serviceId: service.serviceId || '',
        categoryId: categoryId || '',
        description: service.description || '',
        shortDescription: service.shortDescription || '',
        subtitle: service.subtitle || '',
        icon: service.icon || '🔧',
        colorClass: service.display?.colorClass || 'bg-blue-100',
        imageUrl: service.images?.hero?.url || service.image || '',
        basePrice: service.pricing?.basePrice || 0,
        currency: service.pricing?.currency || 'INR',
        priceType: service.pricing?.priceType || 'starting_from',
        durationMinutes: service.duration?.minutes || 60,
        durationText: service.duration?.displayText || '',
        isActive: service.isActive ?? true,
        isPopular: service.isPopular || false,
        isFeatured: service.isFeatured || false,
        sortOrder: service.display?.sortOrder || service.sortOrder || 0,
        tags: service.tags?.join(', ') || '',
      });
    } else {
      setEditingService(null);
      setFormData({
        ...initialFormState,
        categoryId: selectedCategory || '',
        sortOrder: services.length,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => { 
    setShowModal(false); 
    setEditingService(null);
    setFormErrors({});
  };

  const getCategoryName = (service: Service): string => {
    if (typeof service.category === 'object' && service.category?.name) {
      return service.category.name;
    }
    return service.categoryName || 'Uncategorized';
  };

  const getServiceImage = (service: Service): string | null => {
    return service.images?.thumbnail?.url || service.images?.hero?.url || service.image || null;
  };

  // ==================== RENDER ====================
  if (loading && services.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
          <p className="text-gray-500">Loading services...</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Services Manager</h1>
            <p className="text-gray-600">Manage services for your SDUI mobile app</p>
          </div>
          <button 
            onClick={() => { fetchServices(); fetchStats(); }} 
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
              <p className="text-2xl font-bold text-gray-900">{stats.totalServices}</p>
              <p className="text-sm text-gray-500">Total Services</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-2xl font-bold text-green-600">{stats.activeServices}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-2xl font-bold text-gray-400">{stats.inactiveServices}</p>
              <p className="text-sm text-gray-500">Inactive</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-2xl font-bold text-orange-600">{stats.popularServices}</p>
              <p className="text-sm text-gray-500">Popular</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-2xl font-bold text-purple-600">{stats.featuredServices}</p>
              <p className="text-sm text-gray-500">Featured</p>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
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
              placeholder="Search services..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" 
            />
          </div>
          <div className="relative min-w-[180px]">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)} 
              className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg bg-white appearance-none focus:ring-2 focus:ring-cyan-500"
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
        </div>
        <button 
          onClick={() => openModal()} 
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" /> Add Service
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {services.map((service) => (
                <tr key={service._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div 
                        className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${service.display?.colorClass || 'bg-blue-100'}`}
                      >
                        {getServiceImage(service) ? (
                          <img 
                            src={getServiceImage(service)!} 
                            alt={service.name} 
                            className="h-8 w-8 rounded object-cover" 
                            onError={(e) => { 
                              (e.target as HTMLImageElement).style.display = 'none'; 
                              (e.target as HTMLImageElement).parentElement!.innerHTML = service.icon || '🔧';
                            }} 
                          />
                        ) : (
                          <span className="text-xl">{service.icon || '🔧'}</span>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{service.name}</div>
                        <code className="text-xs text-gray-500 bg-gray-100 px-1 rounded">{service.serviceId}</code>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded-full font-medium">
                      {getCategoryName(service)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {getCurrencySymbol(service.pricing?.currency || 'INR')}
                      {(service.pricing?.basePrice || 0).toLocaleString()}
                    </div>
                    <span className="text-xs text-gray-500 capitalize">
                      {(service.pricing?.priceType || 'starting_from').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Clock className="w-3.5 h-3.5" />
                      {service.duration?.displayText || `${service.duration?.minutes || 60} mins`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-medium">{(service.rating?.average || 0).toFixed(1)}</span>
                      <span className="text-xs text-gray-500">({service.rating?.count || 0})</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={() => toggleStatus(service, 'isActive')} 
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-colors ${
                          service.isActive 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {service.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {service.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <div className="flex gap-1 flex-wrap">
                        {service.isPopular && (
                          <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded font-medium">Popular</span>
                        )}
                        {service.isFeatured && (
                          <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded font-medium">Featured</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => openModal(service)} 
                        className="p-1.5 text-cyan-600 hover:text-cyan-800 hover:bg-cyan-50 rounded transition-colors" 
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm(service._id)} 
                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors" 
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {services.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-5xl mb-4">🔧</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No services found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || selectedCategory ? 'Try adjusting your filters' : 'Get started by creating your first service'}
            </p>
            {!searchTerm && !selectedCategory && (
              <button 
                onClick={() => openModal()} 
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
              >
                <Plus className="w-4 h-4" /> Create Service
              </button>
            )}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50">
            <p className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} services
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={!pagination.hasPrev} 
                className="p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-sm font-medium">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))} 
                disabled={!pagination.hasNext} 
                className="p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
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
              <h3 className="text-lg font-semibold text-gray-900">Delete Service</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this service? This will also delete all associated subservices. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteConfirm(null)} 
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors"
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
            <div className="px-6 py-4 border-b flex justify-between items-center flex-shrink-0 bg-gray-50">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingService ? 'Edit Service' : 'Create New Service'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {editingService ? 'Update service details' : 'Add a new service to your catalog'}
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

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                
                {/* Basic Info Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Basic Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Service Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Service Name <span className="text-red-500">*</span>
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
                        placeholder="e.g., AC Repair & Service" 
                      />
                      {formErrors.name && (
                        <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
                      )}
                    </div>

                    {/* Category */}
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
                      >
                        <option value="">Select a category</option>
                        {categories.map(cat => (
                          <option key={cat._id} value={cat._id}>{cat.icon} {cat.name}</option>
                        ))}
                      </select>
                      {formErrors.categoryId && (
                        <p className="mt-1 text-xs text-red-600">{formErrors.categoryId}</p>
                      )}
                    </div>
                  </div>

                  {/* Subtitle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle / Tagline</label>
                    <input 
                      type="text" 
                      value={formData.subtitle} 
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      placeholder="e.g., Expert technicians at your doorstep" 
                      maxLength={200}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea 
                      value={formData.description} 
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" 
                      rows={3} 
                      placeholder="Detailed description of the service..."
                      maxLength={2000}
                    />
                    <p className="mt-1 text-xs text-gray-400">{formData.description.length}/2000 characters</p>
                  </div>
                </div>

                {/* Appearance Section */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Appearance</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Icon */}
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

                    {/* Color Class */}
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

                    {/* Sort Order */}
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

                  {/* Image URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                    <input 
                      type="url" 
                      value={formData.imageUrl} 
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      placeholder="https://example.com/service-image.jpg" 
                    />
                    {formData.imageUrl && (
                      <div className="mt-2 flex items-center gap-3">
                        <img 
                          src={formData.imageUrl} 
                          alt="Preview" 
                          className="h-16 w-16 object-cover rounded-lg border"
                          onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>' }}
                        />
                        <span className="text-xs text-gray-500">Image preview</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pricing Section - IMPROVED */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Pricing</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Currency */}
                    <div className="md:col-span-3">
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

                    {/* Base Price */}
                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Base Price <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                          {getCurrencySymbol(formData.currency)}
                        </span>
                        <input 
                          type="number" 
                          value={formData.basePrice} 
                          onChange={(e) => {
                            setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 });
                            if (formErrors.basePrice) setFormErrors({ ...formErrors, basePrice: undefined });
                          }} 
                          className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 ${
                            formErrors.basePrice ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                          min="0" 
                          step="0.01"
                          placeholder="0.00"
                        />
                      </div>
                      {formErrors.basePrice && (
                        <p className="mt-1 text-xs text-red-600">{formErrors.basePrice}</p>
                      )}
                    </div>

                    {/* Price Type */}
                    <div className="md:col-span-5">
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Price Preview</p>
                        <p className="text-2xl font-bold text-cyan-700">
                          {formatPrice(formData.basePrice, formData.currency, formData.priceType)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {PRICE_TYPES.find(t => t.value === formData.priceType)?.description}
                        </p>
                      </div>
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
                        placeholder="e.g., 1-2 hours, 30-45 mins" 
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
                      placeholder="repair, maintenance, emergency, home" 
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
                    <label className="flex items-center gap-3 cursor-pointer group">
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
                        <p className="text-xs text-gray-500">Service is visible to users</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
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
                        <span className="text-sm font-medium text-gray-700">Popular</span>
                        <p className="text-xs text-gray-500">Shows "Popular" badge</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
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
                        <span className="text-sm font-medium text-gray-700">Featured</span>
                        <p className="text-xs text-gray-500">Appears in featured section</p>
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
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
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
                        {editingService ? 'Update Service' : 'Create Service'}
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

export default ServicesPage;