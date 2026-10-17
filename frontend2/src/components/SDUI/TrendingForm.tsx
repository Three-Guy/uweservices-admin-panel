// src/components/SDUI/TrendingForm.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  TrendingUp,
  Loader2,
  Save,
  FolderOpen,
  ChevronDown,
  Search,
  Check,
  Layers,
  BarChart3,
  Zap,
  Sparkles,
  Eye,
  EyeOff,
  Flame,
  Percent,
  Image,
  Hash,
  Package,
  RefreshCw,
  AlertCircle,
  Star,
} from 'lucide-react';
import { SDUITrendingService, BADGE_TYPES } from './TrendingCard';
import { sduiCategoryApi, sduiSubserviceApi, SDUICategory, SDUISubservice } from '../../lib/sduiApi';

// ==================== PROPS ====================
interface TrendingFormProps {
  trending: SDUITrendingService | null;
  onSubmit: (data: Partial<SDUITrendingService>) => void;
  onClose: () => void;
  isLoading: boolean;
}

// ==================== COMPONENT ====================
const TrendingForm: React.FC<TrendingFormProps> = ({
  trending,
  onSubmit,
  onClose,
  isLoading,
}) => {
  // ==================== FORM STATE ====================
  const [formData, setFormData] = useState({
    serviceId: trending?.serviceId || '',
    name: trending?.name || '',
    categoryId: trending?.categoryId || '',
    categoryName: trending?.categoryName || '',
    subserviceId: '',
    subserviceName: '',
    iconName: trending?.iconName || '📦',
    imageUrl: trending?.imageUrl || '',
    bookingsToday: trending?.bookingsToday || 0,
    progress: trending?.progress || 0,
    sortOrder: trending?.sortOrder || 0,
    badge: {
      text: trending?.badge?.text || '',
      type: trending?.badge?.type || '',
    },
    autoSync: trending?.autoSync ?? false,
    isActive: trending?.isActive ?? true,
  });

  // ==================== CATEGORY STATE ====================
  const [categories, setCategories] = useState<SDUICategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // ==================== SUBSERVICE STATE ====================
  const [subservices, setSubservices] = useState<SDUISubservice[]>([]);
  const [loadingSubservices, setLoadingSubservices] = useState(false);
  const [subserviceDropdownOpen, setSubserviceDropdownOpen] = useState(false);
  const [subserviceSearch, setSubserviceSearch] = useState('');
  const [subserviceError, setSubserviceError] = useState<string | null>(null);

  // ==================== TABS ====================
  const [activeTab, setActiveTab] = useState<'basic' | 'stats' | 'appearance'>('basic');

  // ==================== FETCH CATEGORIES ====================
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        setCategoryError(null);

        console.log('📂 Fetching categories...');
        const response = await sduiCategoryApi.getAll({ isActive: 'true' });

        if (response.success && response.data) {
          const categoriesArray = Array.isArray(response.data) ? response.data : [];
          const regularCategories = categoriesArray.filter(
            (cat) => !cat.isMoreServicesSection
          );
          setCategories(regularCategories);
          console.log(`✅ Loaded ${regularCategories.length} categories`);
        } else {
          setCategoryError('Failed to load categories');
        }
      } catch (error: any) {
        console.error('Error fetching categories:', error);
        setCategoryError(error.message || 'Failed to load categories');
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  // ==================== FETCH SUBSERVICES ====================
  const fetchSubservices = useCallback(async (categoryId: string) => {
    if (!categoryId) {
      console.log('⚠️ No categoryId, clearing subservices');
      setSubservices([]);
      return;
    }

    try {
      setLoadingSubservices(true);
      setSubserviceError(null);
      
      console.log('');
      console.log('🔄 ════════════════════════════════════════════════════════');
      console.log('📦 FETCHING SUBSERVICES');
      console.log('🔄 ════════════════════════════════════════════════════════');
      console.log('📍 Category ID:', categoryId);

      const response = await sduiSubserviceApi.getByCategoryId(categoryId, {
        isActive: 'true',
        limit: 100,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
      });

      console.log('📡 API Response:', response);

      let subservicesArray: SDUISubservice[] = [];
      
      // Handle various response structures
      if (response && response.success && Array.isArray(response.data)) {
        subservicesArray = response.data;
      } else if (response && Array.isArray(response.data)) {
        subservicesArray = response.data;
      } else if (Array.isArray(response)) {
        subservicesArray = response as any;
      } else if (response?.data?.data && Array.isArray(response.data.data)) {
        subservicesArray = response.data.data;
      }

      console.log(`📊 Found ${subservicesArray.length} subservices`);
      
      if (subservicesArray.length > 0) {
        console.log('📋 Subservices:');
        subservicesArray.forEach((sub, idx) => {
          console.log(`   ${idx + 1}. ${sub.name}`);
        });
      }

      console.log('🔄 ════════════════════════════════════════════════════════');

      setSubservices(subservicesArray);
      
    } catch (error: any) {
      console.error('❌ Error fetching subservices:', error);
      setSubserviceError(error.message || 'Failed to load subservices');
      setSubservices([]);
    } finally {
      setLoadingSubservices(false);
    }
  }, []);

  // Fetch subservices when category changes
  useEffect(() => {
    if (formData.categoryId) {
      console.log('🔄 Category changed, fetching subservices for:', formData.categoryId);
      fetchSubservices(formData.categoryId);
    } else {
      setSubservices([]);
    }
  }, [formData.categoryId, fetchSubservices]);

  // ==================== SAFE ARRAYS & COUNTS ====================
  const subservicesArray = Array.isArray(subservices) ? subservices : [];
  const categoriesArray = Array.isArray(categories) ? categories : [];
  const subservicesCount = subservicesArray.length;

  // ==================== FILTERED DATA ====================
  const filteredCategories = categoriesArray.filter((cat) =>
    cat.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const filteredSubservices = subservicesArray.filter((sub) =>
    sub.name.toLowerCase().includes(subserviceSearch.toLowerCase())
  );

  // ==================== SELECTED ITEMS ====================
  const selectedCategory = categoriesArray.find((cat) => cat._id === formData.categoryId);
  const selectedSubservice = subservicesArray.find((sub) => sub._id === formData.subserviceId);

  // ==================== COMPUTED NAME ====================
  const computedName = formData.subserviceName || formData.categoryName || formData.name;

  // ==================== HANDLERS ====================
  const handleCategorySelect = (category: SDUICategory) => {
    console.log('📂 Category selected:', category.name, '- ID:', category._id);
    
    const newServiceId = trending?.serviceId || `trending-${category.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`;

    setFormData((prev) => ({
      ...prev,
      categoryId: category._id,
      categoryName: category.name,
      serviceId: newServiceId,
      name: category.name,
      iconName: category.icon || '📦',
      subserviceId: '',
      subserviceName: '',
    }));
    setCategoryDropdownOpen(false);
    setCategorySearch('');
    setSubserviceDropdownOpen(false);
    setSubserviceSearch('');
  };

  const handleSubserviceSelect = (subservice: SDUISubservice) => {
    console.log('📦 Subservice selected:', subservice.name);
    
    const newServiceId = trending?.serviceId || `trending-${subservice.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`;

    setFormData((prev) => ({
      ...prev,
      subserviceId: subservice._id,
      subserviceName: subservice.name,
      name: subservice.name,
      serviceId: newServiceId,
      iconName: subservice.icon || prev.iconName || '📦',
    }));
    setSubserviceDropdownOpen(false);
    setSubserviceSearch('');
  };

  const handleClearSubservice = () => {
    setFormData((prev) => ({
      ...prev,
      subserviceId: '',
      subserviceName: '',
      name: prev.categoryName,
    }));
  };

  const handleBadgeSelect = (badgeValue: string) => {
    const selectedBadge = BADGE_TYPES.find((b) => b.value === badgeValue);
    setFormData((prev) => ({
      ...prev,
      badge: {
        type: badgeValue,
        text: selectedBadge?.label.replace(/[🔥✨⭐📈🏆⏰]/g, '').trim() || '',
      },
    }));
  };

  const handleRetryFetchSubservices = () => {
    if (formData.categoryId) {
      fetchSubservices(formData.categoryId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.categoryId) {
      alert('Please select a category');
      return;
    }

    const finalName = formData.subserviceName || formData.categoryName;

    if (!finalName.trim()) {
      alert('Please select a category or subservice');
      return;
    }

    const submitData: Partial<SDUITrendingService> = {
      serviceId: formData.serviceId,
      name: finalName.trim(),
      categoryId: formData.categoryId,
      categoryName: formData.categoryName,
      iconName: formData.iconName,
      imageUrl: formData.imageUrl || null,
      bookingsToday: Number(formData.bookingsToday) || 0,
      progress: Math.min(100, Math.max(0, Number(formData.progress) || 0)),
      sortOrder: Number(formData.sortOrder) || 0,
      autoSync: formData.autoSync,
      isActive: formData.isActive,
    };

    if (formData.badge.type) {
      submitData.badge = formData.badge as SDUITrendingService['badge'];
    } else {
      submitData.badge = { text: '', type: '' };
    }

    console.log('📤 Submitting:', submitData);
    onSubmit(submitData);
  };

  // ==================== RENDER ====================
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ==================== HEADER ==================== */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />

          <div className="relative px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {trending ? 'Edit Trending Service' : 'Add Trending Service'}
                  </h2>
                  <p className="text-white/80 text-sm mt-0.5">
                    {trending ? 'Update service details' : 'Select category and subservice'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-xl transition-all duration-200 group"
              >
                <X className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-200" />
              </button>
            </div>
          </div>
        </div>

        {/* ==================== TABS ==================== */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-1">
            {[
              { id: 'basic', label: 'Basic Info', icon: Layers },
              { id: 'stats', label: 'Stats & Metrics', icon: BarChart3 },
              { id: 'appearance', label: 'Appearance', icon: Sparkles },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ==================== FORM CONTENT ==================== */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(100vh-320px)] overflow-y-auto">
          
          {/* ==================== TAB 1: BASIC INFO ==================== */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              
              {/* ==================== CATEGORY SELECTION ==================== */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-orange-100 rounded-lg">
                    <FolderOpen className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Select Category</h3>
                  <span className="text-red-500">*</span>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => !loadingCategories && setCategoryDropdownOpen(!categoryDropdownOpen)}
                    disabled={loadingCategories}
                    className={`w-full px-4 py-3.5 border-2 rounded-xl text-left flex items-center justify-between transition-all duration-200 ${
                      categoryDropdownOpen
                        ? 'border-orange-500 ring-4 ring-orange-500/10 bg-orange-50/50'
                        : selectedCategory
                        ? 'border-orange-200 bg-orange-50/30'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    } ${loadingCategories ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {loadingCategories ? (
                      <span className="flex items-center gap-3 text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Loading categories...</span>
                      </span>
                    ) : categoryError ? (
                      <span className="flex items-center gap-3 text-red-500">
                        <X className="w-5 h-5" />
                        <span>{categoryError}</span>
                      </span>
                    ) : selectedCategory ? (
                      <span className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                          style={{ backgroundColor: selectedCategory.color || '#f97316' }}
                        >
                          {selectedCategory.image?.url ? (
                            <img
                              src={selectedCategory.image.url}
                              alt={selectedCategory.name}
                              className="w-full h-full rounded-xl object-cover"
                            />
                          ) : (
                            <span className="text-lg">{selectedCategory.icon || '📦'}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{selectedCategory.name}</p>
                          <p className="text-xs text-gray-500">
                            {selectedCategory.subservicesCount || 0} subservices available
                          </p>
                        </div>
                      </span>
                    ) : (
                      <span className="flex items-center gap-3 text-gray-400">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                          <Layers className="w-5 h-5 text-gray-400" />
                        </div>
                        <span>Choose a category...</span>
                      </span>
                    )}
                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                        categoryDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Category Dropdown */}
                  {categoryDropdownOpen && !loadingCategories && !categoryError && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setCategoryDropdownOpen(false)}
                      />
                      <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
                        <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={categorySearch}
                              onChange={(e) => setCategorySearch(e.target.value)}
                              placeholder="Search categories..."
                              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                              autoFocus
                            />
                          </div>
                        </div>

                        <div className="max-h-64 overflow-y-auto">
                          {filteredCategories.length === 0 ? (
                            <div className="p-6 text-center">
                              <FolderOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                              <p className="text-sm text-gray-500">No categories found</p>
                            </div>
                          ) : (
                            <div className="p-2">
                              {filteredCategories.map((category) => (
                                <button
                                  key={category._id}
                                  type="button"
                                  onClick={() => handleCategorySelect(category)}
                                  className={`w-full px-3 py-2.5 flex items-center gap-3 rounded-lg transition-all duration-150 ${
                                    formData.categoryId === category._id
                                      ? 'bg-orange-100 border border-orange-200'
                                      : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0"
                                    style={{ backgroundColor: category.color || '#6b7280' }}
                                  >
                                    {category.image?.url ? (
                                      <img
                                        src={category.image.url}
                                        alt={category.name}
                                        className="w-full h-full rounded-lg object-cover"
                                      />
                                    ) : (
                                      <span className="text-lg">{category.icon || '📦'}</span>
                                    )}
                                  </div>
                                  <div className="flex-1 text-left min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{category.name}</p>
                                    <p className="text-xs text-gray-500">
                                      {category.subservicesCount || category.servicesCount || 0} subservices
                                    </p>
                                  </div>
                                  {formData.categoryId === category._id && (
                                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                                      <Check className="w-4 h-4 text-white" />
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ==================== SUBSERVICE SELECTION ==================== */}
              {formData.categoryId && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-purple-100 rounded-lg">
                        <Package className="w-4 h-4 text-purple-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Select Subservice</h3>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                        {loadingSubservices ? '...' : subservicesCount} available
                      </span>
                    </div>
                    {selectedSubservice && (
                      <button
                        type="button"
                        onClick={handleClearSubservice}
                        className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition-all"
                      >
                        <X className="w-3 h-3" />
                        Clear selection
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (!loadingSubservices && subservicesCount > 0) {
                          setSubserviceDropdownOpen(!subserviceDropdownOpen);
                        }
                      }}
                      disabled={loadingSubservices}
                      className={`w-full px-4 py-3.5 border-2 rounded-xl text-left flex items-center justify-between transition-all duration-200 ${
                        subserviceDropdownOpen
                          ? 'border-purple-500 ring-4 ring-purple-500/10 bg-purple-50/50'
                          : selectedSubservice
                          ? 'border-purple-200 bg-purple-50/30'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      } ${loadingSubservices ? 'cursor-wait' : subservicesCount === 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    >
                      {loadingSubservices ? (
                        <span className="flex items-center gap-3 text-gray-400">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Loading subservices...</span>
                        </span>
                      ) : subserviceError ? (
                        <span className="flex items-center gap-3 text-red-500 w-full">
                          <AlertCircle className="w-5 h-5 flex-shrink-0" />
                          <span className="flex-1">{subserviceError}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetryFetchSubservices();
                            }}
                            className="p-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-100 rounded-lg transition-all"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </span>
                      ) : selectedSubservice ? (
                        <span className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-sm">
                            <span className="text-lg">{selectedSubservice.icon || '🔧'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{selectedSubservice.name}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {selectedSubservice.description || 'Selected subservice'}
                            </p>
                          </div>
                          {selectedSubservice.isPopular && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                              <Star className="w-3 h-3" />
                              Popular
                            </span>
                          )}
                        </span>
                      ) : subservicesCount === 0 ? (
                        <span className="flex items-center gap-3 text-gray-400">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                          <div>
                            <p className="font-medium">No subservices available</p>
                            <p className="text-xs">This category has no subservices</p>
                          </div>
                        </span>
                      ) : (
                        <span className="flex items-center gap-3 text-gray-500">
                          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                            <Package className="w-5 h-5 text-purple-400" />
                          </div>
                          <div>
                            <p className="font-medium">Choose a subservice</p>
                            <p className="text-xs text-gray-400">Select from {subservicesCount} options</p>
                          </div>
                        </span>
                      )}
                      {!loadingSubservices && subservicesCount > 0 && (
                        <ChevronDown
                          className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${
                            subserviceDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </button>

                    {/* Subservice Dropdown */}
                    {subserviceDropdownOpen && !loadingSubservices && !subserviceError && subservicesCount > 0 && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setSubserviceDropdownOpen(false)}
                        />
                        <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
                          {/* Search */}
                          <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                value={subserviceSearch}
                                onChange={(e) => setSubserviceSearch(e.target.value)}
                                placeholder={`Search ${subservicesCount} subservices...`}
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                autoFocus
                              />
                            </div>
                          </div>

                          {/* List */}
                          <div className="max-h-64 overflow-y-auto">
                            {filteredSubservices.length === 0 ? (
                              <div className="p-6 text-center">
                                <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">No subservices found for "{subserviceSearch}"</p>
                              </div>
                            ) : (
                              <div className="p-2 space-y-1">
                                {filteredSubservices.map((subservice, index) => (
                                  <button
                                    key={subservice._id}
                                    type="button"
                                    onClick={() => handleSubserviceSelect(subservice)}
                                    className={`w-full px-3 py-3 flex items-center gap-3 rounded-lg transition-all duration-150 ${
                                      formData.subserviceId === subservice._id
                                        ? 'bg-purple-100 border border-purple-200'
                                        : 'hover:bg-gray-50 border border-transparent'
                                    }`}
                                  >
                                    {/* Index Number */}
                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs font-medium text-gray-500">{index + 1}</span>
                                    </div>

                                    {/* Icon */}
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                      formData.subserviceId === subservice._id
                                        ? 'bg-purple-500'
                                        : 'bg-purple-50'
                                    }`}>
                                      <span className="text-lg">{subservice.icon || '🔧'}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 text-left min-w-0">
                                      <p className={`font-medium truncate ${
                                        formData.subserviceId === subservice._id 
                                          ? 'text-purple-900' 
                                          : 'text-gray-900'
                                      }`}>
                                        {subservice.name}
                                      </p>
                                      {subservice.description && (
                                        <p className="text-xs text-gray-500 truncate">
                                          {subservice.description}
                                        </p>
                                      )}
                                    </div>

                                    {/* Badges */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {subservice.isPopular && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                                          <Star className="w-3 h-3" />
                                          Popular
                                        </span>
                                      )}
                                      {subservice.isFeatured && (
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                          Featured
                                        </span>
                                      )}
                                    </div>

                                    {/* Selected Checkmark */}
                                    {formData.subserviceId === subservice._id && (
                                      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Check className="w-4 h-4 text-white" />
                                      </div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="p-2 border-t border-gray-100 bg-gray-50/50">
                            <p className="text-xs text-center text-gray-500">
                              Showing {filteredSubservices.length} of {subservicesCount} subservices
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Debug info - Remove in production */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
                      <p>Debug: Category ID = {formData.categoryId}</p>
                      <p>Debug: Subservices loaded = {subservicesCount}</p>
                      <p>Debug: Loading = {loadingSubservices ? 'Yes' : 'No'}</p>
                      <p>Debug: Error = {subserviceError || 'None'}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ==================== SELECTED PREVIEW CARD ==================== */}
              {formData.categoryId && (
                <div className="p-4 bg-gradient-to-r from-orange-50 to-purple-50 rounded-xl border border-orange-100">
                  <p className="text-xs font-medium text-gray-500 mb-2">SERVICE NAME (Auto-generated)</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-xl shadow-lg">
                      {formData.iconName || '📦'}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-lg">{computedName || 'Select a category/subservice'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
                          {formData.categoryName}
                        </span>
                        {formData.subserviceName && (
                          <>
                            <span className="text-gray-400">→</span>
                            <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                              {formData.subserviceName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== ICON / EMOJI ==================== */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Sparkles className="w-4 h-4 text-gray-500" />
                  Icon / Emoji
                </label>
                <input
                  type="text"
                  value={formData.iconName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, iconName: e.target.value }))}
                  placeholder="📦 or emoji"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all text-2xl text-center"
                  maxLength={4}
                />
              </div>

              {/* ==================== IMAGE URL ==================== */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Image className="w-4 h-4 text-gray-500" />
                  Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                />
                {formData.imageUrl && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-lg inline-block">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-16 h-16 rounded-lg object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* ==================== SERVICE ID ==================== */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Hash className="w-4 h-4 text-gray-500" />
                  Service ID
                  <span className="text-xs text-gray-400">(Auto-generated)</span>
                </label>
                <input
                  type="text"
                  value={formData.serviceId}
                  readOnly
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl bg-gray-50 text-gray-500 text-sm cursor-not-allowed"
                />
              </div>
            </div>
          )}

          {/* ==================== TAB 2: STATS & METRICS ==================== */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {/* Auto Sync Toggle */}
              <label className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl cursor-pointer hover:border-blue-200 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <Zap className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Auto-sync Stats</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Automatically update from real booking data
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.autoSync}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, autoSync: e.target.checked }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-checked:bg-blue-500 rounded-full transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm peer-checked:translate-x-5 transition-transform" />
                </div>
              </label>

              {/* Stats Inputs */}
              <div className="grid grid-cols-2 gap-4">
                {/* Bookings Today */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Flame className="w-4 h-4 text-orange-500" />
                    Bookings Today
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.bookingsToday}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          bookingsToday: Math.max(0, parseInt(e.target.value) || 0),
                        }))
                      }
                      min="0"
                      disabled={formData.autoSync}
                      className={`w-full px-4 py-3 border-2 rounded-xl transition-all ${
                        formData.autoSync
                          ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
                          : 'border-gray-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10'
                      }`}
                      placeholder="0"
                    />
                    {formData.autoSync && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Zap className="w-4 h-4 text-blue-500" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Percent className="w-4 h-4 text-emerald-500" />
                    Progress (0-100)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.progress}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          progress: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                        }))
                      }
                      min="0"
                      max="100"
                      disabled={formData.autoSync}
                      className={`w-full px-4 py-3 border-2 rounded-xl transition-all ${
                        formData.autoSync
                          ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
                          : 'border-gray-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10'
                      }`}
                      placeholder="0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      %
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Bar Preview */}
              <div className="space-y-2 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Progress Preview</span>
                  <span className="font-medium text-gray-900">{formData.progress}%</span>
                </div>
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-300"
                    style={{ width: `${formData.progress}%` }}
                  />
                </div>
              </div>

              {/* Sort Order */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Hash className="w-4 h-4 text-gray-500" />
                  Sort Order
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))
                  }
                  min="0"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500">Lower numbers appear first</p>
              </div>
            </div>
          )}

          {/* ==================== TAB 3: APPEARANCE ==================== */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Badge Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Badge (Optional)</label>
                <div className="flex flex-wrap gap-2">
                  {BADGE_TYPES.map((badge) => (
                    <button
                      key={badge.value}
                      type="button"
                      onClick={() => handleBadgeSelect(badge.value)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all duration-150 ${
                        formData.badge.type === badge.value
                          ? `${badge.color} border-current ring-2 ring-current/20 scale-105`
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:scale-105'
                      }`}
                    >
                      {badge.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Badge Text */}
              {formData.badge.type && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Custom Badge Text</label>
                  <input
                    type="text"
                    value={formData.badge.text}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        badge: { ...prev.badge, text: e.target.value },
                      }))
                    }
                    placeholder="Badge text..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                  />
                </div>
              )}

              {/* Active Status */}
              <label className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100 rounded-xl cursor-pointer hover:border-emerald-200 transition-all group">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      formData.isActive
                        ? 'bg-emerald-100 group-hover:bg-emerald-200'
                        : 'bg-gray-100 group-hover:bg-gray-200'
                    }`}
                  >
                    {formData.isActive ? (
                      <Eye className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {formData.isActive ? 'Active & Visible' : 'Inactive & Hidden'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formData.isActive
                        ? 'This service is visible in trending section'
                        : 'This service is hidden from users'}
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-checked:bg-emerald-500 rounded-full transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm peer-checked:translate-x-5 transition-transform" />
                </div>
              </label>

              {/* Preview Card */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm font-medium text-gray-700 mb-3">Live Preview</p>
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-2xl shadow-lg">
                    {formData.iconName || '📦'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-900">{computedName || 'Service Name'}</h4>
                      {formData.badge.type && (
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            BADGE_TYPES.find((b) => b.value === formData.badge.type)?.color ||
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {formData.badge.text || formData.badge.type}
                        </span>
                      )}
                      {!formData.isActive && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                          Hidden
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-gray-500">
                        <Flame className="w-4 h-4 inline text-orange-500 mr-1" />
                        {formData.bookingsToday} bookings
                      </span>
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full max-w-[100px]">
                          <div
                            className="h-full bg-orange-500 rounded-full"
                            style={{ width: `${formData.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{formData.progress}%</span>
                      </div>
                    </div>
                    {formData.categoryName && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                          {formData.categoryName}
                        </span>
                        {formData.subserviceName && (
                          <>
                            <span className="text-gray-400 text-xs">→</span>
                            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                              {formData.subserviceName}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* ==================== FOOTER ==================== */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center justify-between">
            {/* Selected Info */}
            <div className="flex items-center gap-2 text-sm flex-wrap">
              {selectedCategory && (
                <span className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: selectedCategory.color || '#f97316' }}
                  />
                  <span className="text-gray-600">{selectedCategory.name}</span>
                </span>
              )}
              {selectedSubservice && (
                <span className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg text-purple-700">
                  <Package className="w-3 h-3" />
                  <span>{selectedSubservice.name}</span>
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading || !formData.categoryId}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl transition-all font-medium shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{trending ? 'Update Service' : 'Add to Trending'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendingForm;