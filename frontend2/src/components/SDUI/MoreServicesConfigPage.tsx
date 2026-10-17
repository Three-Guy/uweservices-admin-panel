// src/pages/SDUI/MoreServicesConfigPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Eye,
  EyeOff,
  Grid,
  List,
  Search,
  Filter,
  Star,
  TrendingUp,
  Target,
  Layers,
  Layout,
  Palette,
  BarChart3,
  RotateCcw,
  ChevronRight,
  Image as ImageIcon,
  Info,
} from 'lucide-react';
import { sduiCategoryApi, SDUICategory } from '../../lib/sduiApi';

// ==================== TYPES ====================
interface MoreServicesDisplay {
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

interface MoreServicesAction {
  type: 'all_services' | 'all_categories' | 'specific_category' | 'custom_screen' | 'external_url';
  targetCategory?: string | { _id: string; name: string; categoryId: string; icon: string; color: string } | null;
  screenName?: string;
  url?: string;
}

interface MoreServicesServiceFilters {
  showAllServices: boolean;
  includeCategories: string[] | Array<{ _id: string; name: string; categoryId: string; icon: string }>;
  excludeCategories: string[] | Array<{ _id: string; name: string; categoryId: string; icon: string }>;
  onlyPopular: boolean;
  onlyFeatured: boolean;
  tags: string[];
  minRating: number;
}

interface MoreServicesLayout {
  viewType: 'grid' | 'list' | 'grouped_by_category';
  gridColumns: number;
  showSearch: boolean;
  showCategoryFilters: boolean;
  showSortOptions: boolean;
  defaultSort: 'name' | 'popular' | 'price_low_high' | 'price_high_low' | 'newest' | 'rating';
  itemsPerPage: number;
}

interface MoreServicesScreenStyle {
  headerTitle: string;
  backgroundColor: string;
  showBackButton: boolean;
}

interface MoreServicesAnalytics {
  impressions: number;
  clicks: number;
  ctr: number;
  lastClicked: string | null;
}

interface MoreServicesConfig {
  _id: string;
  id: string;
  configId: string;
  isEnabled: boolean;
  display: MoreServicesDisplay;
  action: MoreServicesAction;
  serviceFilters: MoreServicesServiceFilters;
  layout: MoreServicesLayout;
  screenStyle: MoreServicesScreenStyle;
  analytics: MoreServicesAnalytics;
  createdAt: string;
  updatedAt: string;
}

// ==================== DEFAULT CONFIG ====================
const getDefaultConfig = (): MoreServicesConfig => ({
  _id: '',
  id: '',
  configId: 'more-services-config',
  isEnabled: true,
  display: {
    title: 'More Services',
    subtitle: 'Explore all services',
    icon: '➕',
    image: { url: null, publicId: null },
    color: '#6366F1',
    colorClass: 'bg-indigo-100',
    showServiceCount: true,
    customBadge: '',
    position: 'last',
    sortOrder: 999,
  },
  action: {
    type: 'all_services',
    targetCategory: null,
    screenName: '',
    url: '',
  },
  serviceFilters: {
    showAllServices: true,
    includeCategories: [],
    excludeCategories: [],
    onlyPopular: false,
    onlyFeatured: false,
    tags: [],
    minRating: 0,
  },
  layout: {
    viewType: 'grid',
    gridColumns: 2,
    showSearch: true,
    showCategoryFilters: true,
    showSortOptions: true,
    defaultSort: 'popular',
    itemsPerPage: 20,
  },
  screenStyle: {
    headerTitle: 'All Services',
    backgroundColor: '#FFFFFF',
    showBackButton: true,
  },
  analytics: {
    impressions: 0,
    clicks: 0,
    ctr: 0,
    lastClicked: null,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ==================== COLOR PRESETS ====================
const COLOR_PRESETS = [
  { color: '#6366F1', class: 'bg-indigo-100', label: 'Indigo' },
  { color: '#8B5CF6', class: 'bg-purple-100', label: 'Purple' },
  { color: '#EC4899', class: 'bg-pink-100', label: 'Pink' },
  { color: '#3B82F6', class: 'bg-blue-100', label: 'Blue' },
  { color: '#10B981', class: 'bg-green-100', label: 'Green' },
  { color: '#F59E0B', class: 'bg-yellow-100', label: 'Yellow' },
  { color: '#EF4444', class: 'bg-red-100', label: 'Red' },
  { color: '#06B6D4', class: 'bg-cyan-100', label: 'Cyan' },
];

// ==================== EMOJI PICKER ====================
const EMOJI_OPTIONS = [
  '➕', '📦', '🔧', '🏠', '✨', '⭐', '🎯', '💼',
  '🛠️', '🧹', '💡', '🔌', '🚿', '❄️', '🎨', '🪴',
  '🚗', '💇', '💅', '🏋️', '🧘', '🍽️', '📱', '💻',
  '🛒', '🎁', '🏷️', '📋', '🔍', '⚡', '🌟', '🚀',
];

// ==================== MAIN COMPONENT ====================
const MoreServicesConfigPage: React.FC = () => {
  // State
  const [config, setConfig] = useState<MoreServicesConfig>(getDefaultConfig());
  const [categories, setCategories] = useState<SDUICategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'display' | 'action' | 'filters' | 'layout' | 'analytics'>('display');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await sduiCategoryApi.getAll({ isActive: 'true' });
      if (response.success) {
        setCategories(response.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Auto-hide success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove image
  const handleImageRemove = () => {
    setImageFile(null);
    setImagePreview(null);
    updateConfig('display.image', { url: null, publicId: null });
  };

  // Update config locally
  const updateConfig = (path: string, value: any) => {
    setConfig(prev => {
      const keys = path.split('.');
      const newConfig = JSON.parse(JSON.stringify(prev));
      let current: any = newConfig;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

  // Save configuration (local only for now - backend integration needed)
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Simulate save - replace with actual API call when backend is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Store in localStorage for persistence
      localStorage.setItem('more-services-config', JSON.stringify(config));
      
      setSuccessMessage('Configuration saved successfully!');
    } catch (err: any) {
      console.error('Error saving config:', err);
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // Load from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('more-services-config');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error('Failed to parse saved config:', e);
      }
    }
  }, []);

  // Toggle enabled
  const handleToggleEnabled = () => {
    const newEnabled = !config.isEnabled;
    setConfig(prev => ({ ...prev, isEnabled: newEnabled }));
    setSuccessMessage(newEnabled ? 'More Services enabled!' : 'More Services disabled!');
  };

  // Reset configuration
  const handleReset = () => {
    if (!window.confirm('Are you sure you want to reset to default settings?')) {
      return;
    }
    setConfig(getDefaultConfig());
    setImageFile(null);
    setImagePreview(null);
    localStorage.removeItem('more-services-config');
    setSuccessMessage('Configuration reset to defaults!');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-purple-200 rounded-full animate-spin border-t-purple-600"></div>
          <p className="text-gray-500 font-medium">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* ==================== HEADER ==================== */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/25">
                <Settings className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  More Services Configuration
                </h1>
                <p className="text-gray-500 mt-1">
                  Configure the "More Services" tile shown in your app's category grid
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                disabled={saving}
                className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-purple-500/25 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Enable/Disable Toggle */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {config.isEnabled ? (
                <Eye className="w-5 h-5 text-green-600" />
              ) : (
                <EyeOff className="w-5 h-5 text-gray-400" />
              )}
              <div>
                <p className="font-medium text-gray-900">
                  More Services Section is {config.isEnabled ? 'Enabled' : 'Disabled'}
                </p>
                <p className="text-sm text-gray-500">
                  {config.isEnabled
                    ? 'The tile is visible in your app'
                    : 'Enable to show the tile in category grid'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleEnabled}
              disabled={saving}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                config.isEnabled ? 'bg-green-500' : 'bg-gray-300'
              } disabled:opacity-50`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                  config.isEnabled ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* ==================== MESSAGES ==================== */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-4 rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-emerald-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ==================== MAIN CONTENT ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Tabs & Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tab Navigation */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-2">
              <div className="flex gap-1">
                {[
                  { id: 'display', label: 'Display', icon: Palette },
                  { id: 'action', label: 'Action', icon: Target },
                  { id: 'filters', label: 'Filters', icon: Filter },
                  { id: 'layout', label: 'Layout', icon: Layout },
                  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-6">
              {/* ==================== DISPLAY TAB ==================== */}
              {activeTab === 'display' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Palette className="w-5 h-5 text-purple-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Display Settings</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Image Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tile Image
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-purple-400 transition-colors">
                        {(imagePreview || config.display.image?.url) ? (
                          <div className="relative">
                            <img
                              src={imagePreview || config.display.image?.url || ''}
                              alt="Preview"
                              className="w-full h-32 object-cover rounded-lg"
                            />
                            <button
                              onClick={handleImageRemove}
                              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer block">
                            <ImageIcon className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Click to upload image</p>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageSelect}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Icon Picker */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Icon
                      </label>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="w-16 h-16 text-3xl bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center border-2 border-dashed border-gray-300"
                        >
                          {config.display.icon}
                        </button>
                        <span className="text-sm text-gray-500">Click to change</span>
                      </div>
                      {showEmojiPicker && (
                        <div className="mt-3 p-3 bg-white border border-gray-200 rounded-xl shadow-lg">
                          <div className="grid grid-cols-8 gap-2">
                            {EMOJI_OPTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => {
                                  updateConfig('display.icon', emoji);
                                  setShowEmojiPicker(false);
                                }}
                                className={`w-10 h-10 text-xl rounded-lg hover:bg-gray-100 flex items-center justify-center ${
                                  config.display.icon === emoji ? 'bg-purple-100 ring-2 ring-purple-500' : ''
                                }`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Subtitle */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title
                      </label>
                      <input
                        type="text"
                        value={config.display.title}
                        onChange={(e) => updateConfig('display.title', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        placeholder="More Services"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subtitle
                      </label>
                      <input
                        type="text"
                        value={config.display.subtitle}
                        onChange={(e) => updateConfig('display.subtitle', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        placeholder="Explore all services"
                      />
                    </div>
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Background Color
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.color}
                          type="button"
                          onClick={() => {
                            updateConfig('display.color', preset.color);
                            updateConfig('display.colorClass', preset.class);
                          }}
                          className={`w-10 h-10 rounded-lg transition-all ${
                            config.display.color === preset.color
                              ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                              : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: preset.color }}
                          title={preset.label}
                        />
                      ))}
                      <input
                        type="color"
                        value={config.display.color}
                        onChange={(e) => {
                          updateConfig('display.color', e.target.value);
                          updateConfig('display.colorClass', 'bg-gray-100');
                        }}
                        className="w-10 h-10 rounded-lg cursor-pointer border-2 border-dashed border-gray-300"
                        title="Custom color"
                      />
                    </div>
                  </div>

                  {/* Badge Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <input
                        type="checkbox"
                        id="showServiceCount"
                        checked={config.display.showServiceCount}
                        onChange={(e) => updateConfig('display.showServiceCount', e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="showServiceCount" className="text-sm text-gray-700">
                        Show service count badge
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom Badge (optional)
                      </label>
                      <input
                        type="text"
                        value={config.display.customBadge}
                        onChange={(e) => updateConfig('display.customBadge', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        placeholder="e.g., 50+ Services"
                      />
                    </div>
                  </div>

                  {/* Position */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Position in Grid
                      </label>
                      <select
                        value={config.display.position}
                        onChange={(e) => updateConfig('display.position', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      >
                        <option value="first">First (Start)</option>
                        <option value="last">Last (End)</option>
                        <option value="custom">Custom Position</option>
                      </select>
                    </div>

                    {config.display.position === 'custom' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Sort Order
                        </label>
                        <input
                          type="number"
                          value={config.display.sortOrder}
                          onChange={(e) => updateConfig('display.sortOrder', parseInt(e.target.value))}
                          min="0"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ==================== ACTION TAB ==================== */}
              {activeTab === 'action' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Action Settings</h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      When user taps this tile
                    </label>
                    <select
                      value={config.action.type}
                      onChange={(e) => updateConfig('action.type', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="all_services">Show All Services</option>
                      <option value="all_categories">Show All Categories</option>
                      <option value="specific_category">Navigate to Specific Category</option>
                      <option value="custom_screen">Open Custom Screen</option>
                      <option value="external_url">Open External URL</option>
                    </select>
                  </div>

                  {config.action.type === 'specific_category' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Target Category
                      </label>
                      <select
                        value={
                          typeof config.action.targetCategory === 'object'
                            ? config.action.targetCategory?._id || ''
                            : config.action.targetCategory || ''
                        }
                        onChange={(e) => updateConfig('action.targetCategory', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="">Select a category...</option>
                        {categories.map((cat) => (
                          <option key={cat._id} value={cat._id}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {config.action.type === 'custom_screen' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Screen Name
                      </label>
                      <input
                        type="text"
                        value={config.action.screenName || ''}
                        onChange={(e) => updateConfig('action.screenName', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="e.g., AllServicesScreen"
                      />
                    </div>
                  )}

                  {config.action.type === 'external_url' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        URL
                      </label>
                      <input
                        type="url"
                        value={config.action.url || ''}
                        onChange={(e) => updateConfig('action.url', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="https://example.com/services"
                      />
                    </div>
                  )}

                  {/* Screen Style */}
                  {config.action.type === 'all_services' && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-4">Screen Style</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Header Title
                          </label>
                          <input
                            type="text"
                            value={config.screenStyle.headerTitle}
                            onChange={(e) => updateConfig('screenStyle.headerTitle', e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="All Services"
                          />
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <input
                            type="checkbox"
                            id="showBackButton"
                            checked={config.screenStyle.showBackButton}
                            onChange={(e) => updateConfig('screenStyle.showBackButton', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <label htmlFor="showBackButton" className="text-sm text-gray-700">
                            Show back button
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==================== FILTERS TAB ==================== */}
              {activeTab === 'filters' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Service Filters</h3>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                    <input
                      type="checkbox"
                      id="showAllServices"
                      checked={config.serviceFilters.showAllServices}
                      onChange={(e) => updateConfig('serviceFilters.showAllServices', e.target.checked)}
                      className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    />
                    <label htmlFor="showAllServices" className="text-sm font-medium text-green-800">
                      Show all services (no filtering)
                    </label>
                  </div>

                  {!config.serviceFilters.showAllServices && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Include Categories
                        </label>
                        <select
                          multiple
                          value={config.serviceFilters.includeCategories.map((c: any) =>
                            typeof c === 'object' ? c._id : c
                          )}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                            updateConfig('serviceFilters.includeCategories', selected);
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 min-h-[120px]"
                        >
                          {categories.map((cat) => (
                            <option key={cat._id} value={cat._id}>
                              {cat.icon} {cat.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Exclude Categories
                        </label>
                        <select
                          multiple
                          value={config.serviceFilters.excludeCategories.map((c: any) =>
                            typeof c === 'object' ? c._id : c
                          )}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                            updateConfig('serviceFilters.excludeCategories', selected);
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 min-h-[120px]"
                        >
                          {categories.map((cat) => (
                            <option key={cat._id} value={cat._id}>
                              {cat.icon} {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <input
                        type="checkbox"
                        id="onlyPopular"
                        checked={config.serviceFilters.onlyPopular}
                        onChange={(e) => updateConfig('serviceFilters.onlyPopular', e.target.checked)}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <label htmlFor="onlyPopular" className="text-sm text-gray-700 flex items-center gap-1">
                        <Star className="w-4 h-4" /> Popular
                      </label>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <input
                        type="checkbox"
                        id="onlyFeatured"
                        checked={config.serviceFilters.onlyFeatured}
                        onChange={(e) => updateConfig('serviceFilters.onlyFeatured', e.target.checked)}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <label htmlFor="onlyFeatured" className="text-sm text-gray-700 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> Featured
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Rating
                    </label>
                    <select
                      value={config.serviceFilters.minRating}
                      onChange={(e) => updateConfig('serviceFilters.minRating', parseFloat(e.target.value))}
                      className="w-full max-w-xs px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                    >
                      <option value={0}>No minimum</option>
                      <option value={3}>3+ Stars</option>
                      <option value={3.5}>3.5+ Stars</option>
                      <option value={4}>4+ Stars</option>
                      <option value={4.5}>4.5+ Stars</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ==================== LAYOUT TAB ==================== */}
              {activeTab === 'layout' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Layout className="w-5 h-5 text-orange-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Layout Settings</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        View Type
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'grid', label: 'Grid', icon: Grid },
                          { value: 'list', label: 'List', icon: List },
                          { value: 'grouped_by_category', label: 'Grouped', icon: Layers },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateConfig('layout.viewType', option.value)}
                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                              config.layout.viewType === option.value
                                ? 'border-orange-500 bg-orange-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <option.icon className={`w-5 h-5 ${
                              config.layout.viewType === option.value ? 'text-orange-600' : 'text-gray-400'
                            }`} />
                            <span className={`text-xs font-medium ${
                              config.layout.viewType === option.value ? 'text-orange-600' : 'text-gray-600'
                            }`}>
                              {option.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {config.layout.viewType === 'grid' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Grid Columns
                        </label>
                        <select
                          value={config.layout.gridColumns}
                          onChange={(e) => updateConfig('layout.gridColumns', parseInt(e.target.value))}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        >
                          <option value={1}>1 Column</option>
                          <option value={2}>2 Columns</option>
                          <option value={3}>3 Columns</option>
                          <option value={4}>4 Columns</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default Sort Order
                      </label>
                      <select
                        value={config.layout.defaultSort}
                        onChange={(e) => updateConfig('layout.defaultSort', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      >
                        <option value="name">Name (A-Z)</option>
                        <option value="popular">Most Popular</option>
                        <option value="rating">Highest Rated</option>
                        <option value="price_low_high">Price (Low to High)</option>
                        <option value="price_high_low">Price (High to Low)</option>
                        <option value="newest">Newest First</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Items Per Page
                      </label>
                      <select
                        value={config.layout.itemsPerPage}
                        onChange={(e) => updateConfig('layout.itemsPerPage', parseInt(e.target.value))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <input
                        type="checkbox"
                        id="showSearch"
                        checked={config.layout.showSearch}
                        onChange={(e) => updateConfig('layout.showSearch', e.target.checked)}
                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                      />
                      <label htmlFor="showSearch" className="text-sm text-gray-700 flex items-center gap-1">
                        <Search className="w-4 h-4" /> Search
                      </label>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <input
                        type="checkbox"
                        id="showCategoryFilters"
                        checked={config.layout.showCategoryFilters}
                        onChange={(e) => updateConfig('layout.showCategoryFilters', e.target.checked)}
                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                      />
                      <label htmlFor="showCategoryFilters" className="text-sm text-gray-700 flex items-center gap-1">
                        <Filter className="w-4 h-4" /> Filters
                      </label>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <input
                        type="checkbox"
                        id="showSortOptions"
                        checked={config.layout.showSortOptions}
                        onChange={(e) => updateConfig('layout.showSortOptions', e.target.checked)}
                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                      />
                      <label htmlFor="showSortOptions" className="text-sm text-gray-700">
                        Sort Options
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== ANALYTICS TAB ==================== */}
              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-5 h-5 text-cyan-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-5 border border-cyan-100">
                      <p className="text-sm text-cyan-600 font-medium mb-1">Impressions</p>
                      <p className="text-3xl font-bold text-cyan-700">
                        {config.analytics.impressions.toLocaleString()}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100">
                      <p className="text-sm text-green-600 font-medium mb-1">Clicks</p>
                      <p className="text-3xl font-bold text-green-700">
                        {config.analytics.clicks.toLocaleString()}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-100">
                      <p className="text-sm text-purple-600 font-medium mb-1">CTR</p>
                      <p className="text-3xl font-bold text-purple-700">
                        {config.analytics.impressions > 0
                          ? ((config.analytics.clicks / config.analytics.impressions) * 100).toFixed(2)
                          : '0.00'}%
                      </p>
                    </div>
                  </div>

                  {config.analytics.lastClicked && (
                    <div className="text-sm text-gray-500">
                      Last clicked: {new Date(config.analytics.lastClicked).toLocaleString()}
                    </div>
                  )}

                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Analytics Information</p>
                        <p className="text-sm text-blue-600 mt-1">
                          Analytics will be tracked automatically when you integrate the backend API.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ==================== RIGHT COLUMN - PREVIEW ==================== */}
          <div className="space-y-6">
            {/* Preview Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Tile Preview
              </h3>

              <div className="flex justify-center">
                <div
                  className="w-40 h-48 rounded-2xl overflow-hidden shadow-lg relative"
                  style={{ backgroundColor: config.display.color + '20' }}
                >
                  {/* Image */}
                  {(imagePreview || config.display.image?.url) ? (
                    <img
                      src={imagePreview || config.display.image?.url || ''}
                      alt="Preview"
                      className="w-full h-24 object-cover"
                    />
                  ) : (
                    <div 
                      className="w-full h-24 flex items-center justify-center"
                      style={{ backgroundColor: config.display.color + '30' }}
                    >
                      <span className="text-4xl">{config.display.icon}</span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-3">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {config.display.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {config.display.subtitle}
                    </p>
                    
                    {/* Badge */}
                    {(config.display.showServiceCount || config.display.customBadge) && (
                      <span 
                        className="inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-full text-white"
                        style={{ backgroundColor: config.display.color }}
                      >
                        {config.display.customBadge || '50+ Services'}
                      </span>
                    )}
                  </div>

                  {/* Chevron */}
                  <div className="absolute bottom-3 right-3">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Info */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Info</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`font-medium ${config.isEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                    {config.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Position</span>
                  <span className="font-medium text-gray-900 capitalize">{config.display.position}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Action</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {config.action.type.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">View Type</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {config.layout.viewType.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Help Card */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-6">
              <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <Info className="w-5 h-5" />
                How it works
              </h3>
              <ul className="space-y-2 text-sm text-purple-700">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5"></span>
                  <span>The "More Services" tile appears in your category grid</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5"></span>
                  <span>Users tap to see filtered services based on your settings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5"></span>
                  <span>Configuration is saved locally until backend is integrated</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoreServicesConfigPage;