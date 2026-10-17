// src/pages/SDUI/components/MoreServicesConfigModal.tsx
import React, { useState } from 'react';
import {
  X,
  Settings,
  Layout,
  Filter,
  Eye,
  Save,
  RefreshCw,
  Image as ImageIcon,
  Grid,
  List,
  Search,
  AlertCircle,
} from 'lucide-react';
import { sduiCategoryApi, MoreServicesConfig } from '../../../lib/sduiApi';

// ==================== TYPES ====================

interface MoreServicesConfigModalProps {
  config: any | null;
  categories: any[];
  onClose: () => void;
  onSave: (config: MoreServicesConfig) => void;
}

// ==================== COLOR PRESETS ====================

const COLOR_PRESETS = [
  { name: 'Indigo', value: '#6366F1', class: 'bg-indigo-100' },
  { name: 'Blue', value: '#3B82F6', class: 'bg-blue-100' },
  { name: 'Purple', value: '#8B5CF6', class: 'bg-purple-100' },
  { name: 'Pink', value: '#EC4899', class: 'bg-pink-100' },
  { name: 'Green', value: '#10B981', class: 'bg-green-100' },
  { name: 'Orange', value: '#F59E0B', class: 'bg-orange-100' },
  { name: 'Red', value: '#EF4444', class: 'bg-red-100' },
  { name: 'Teal', value: '#14B8A6', class: 'bg-teal-100' },
];

// ==================== ICON PRESETS ====================

const ICON_PRESETS = ['🔧', '📦', '🏠', '✨', '⚡', '🔥', '💼', '🛠️', '📋', '🎯', '💡', '🚀'];

// ==================== ACTION TYPES ====================

const ACTION_TYPES = [
  { value: 'all_services', label: 'Show All Services', description: 'Display all categories and services' },
  { value: 'all_categories', label: 'Show All Categories', description: 'Display category list only' },
  { value: 'custom_screen', label: 'Custom Screen', description: 'Navigate to a specific app screen' },
  { value: 'external_url', label: 'External URL', description: 'Open a web link' },
];

// ==================== LAYOUT OPTIONS ====================

const LAYOUT_OPTIONS = [
  { value: 'grid', label: 'Grid', icon: Grid },
  { value: 'list', label: 'List', icon: List },
  { value: 'grouped_by_category', label: 'Grouped', icon: Layout },
];

// ==================== SORT OPTIONS ====================

const SORT_OPTIONS = [
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'price_low_high', label: 'Price: Low to High' },
  { value: 'price_high_low', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
  { value: 'rating', label: 'Highest Rated' },
];

// ==================== MAIN COMPONENT ====================

const MoreServicesConfigModal: React.FC<MoreServicesConfigModalProps> = ({
  config,
  categories,
  onClose,
  onSave,
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'display' | 'action' | 'filters' | 'layout'>('display');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<MoreServicesConfig>({
    action: {
      type: config?.moreServicesConfig?.action?.actionType || 'all_services',
      targetCategory: null,
      screenName: config?.moreServicesConfig?.action?.screenName || '',
      url: config?.moreServicesConfig?.action?.url || '',
    },
    displaySettings: {
      title: config?.moreServicesConfig?.displaySettings?.title || config?.name || 'More Services',
      subtitle: config?.moreServicesConfig?.displaySettings?.subtitle || 'Explore all services',
      icon: config?.icon || '🔧',
      image: config?.image || { url: null, publicId: null },
      color: config?.color || '#6366F1',
      colorClass: config?.colorClass || 'bg-indigo-100',
      showServiceCount: config?.moreServicesConfig?.displaySettings?.showServiceCount ?? true,
      customBadge: config?.moreServicesConfig?.displaySettings?.customBadge || '',
      position: 'last',
      sortOrder: config?.sortOrder || 999,
    },
    serviceFilters: {
      showAllServices: config?.moreServicesConfig?.serviceFilters?.showAllServices ?? true,
      includeCategories: config?.moreServicesConfig?.serviceFilters?.includeCategories || [],
      excludeCategories: config?.moreServicesConfig?.serviceFilters?.excludeCategories || [],
      onlyPopular: config?.moreServicesConfig?.serviceFilters?.onlyPopular || false,
      onlyFeatured: config?.moreServicesConfig?.serviceFilters?.onlyFeatured || false,
      tags: config?.moreServicesConfig?.serviceFilters?.tags || [],
      minRating: 0,
    },
    layout: {
      viewType: config?.moreServicesConfig?.layout?.viewType || 'grid',
      gridColumns: config?.moreServicesConfig?.layout?.gridColumns || 2,
      showSearch: config?.moreServicesConfig?.layout?.showSearch ?? true,
      showCategoryFilters: config?.moreServicesConfig?.layout?.showCategoryFilters ?? true,
      showSortOptions: true,
      defaultSort: config?.moreServicesConfig?.layout?.defaultSort || 'name',
      itemsPerPage: 20,
    },
  });

  // Handle image change
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // Update form field
  const updateField = (section: keyof MoreServicesConfig, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as object),
        [field]: value,
      },
    }));
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Create FormData for upload
      const submitData = new FormData();
      
      // Basic fields
      submitData.append('name', formData.displaySettings.title);
      submitData.append('description', formData.displaySettings.subtitle);
      submitData.append('icon', formData.displaySettings.icon);
      submitData.append('color', formData.displaySettings.color);
      submitData.append('colorClass', formData.displaySettings.colorClass);
      submitData.append('isMoreServicesSection', 'true');
      submitData.append('isActive', 'true');
      submitData.append('sortOrder', '999');

      // More Services Config
      const moreServicesConfig = {
        action: {
          actionType: formData.action.type,
          targetCategory: formData.action.targetCategory,
          screenName: formData.action.screenName,
          url: formData.action.url,
        },
        displaySettings: {
          title: formData.displaySettings.title,
          subtitle: formData.displaySettings.subtitle,
          showServiceCount: formData.displaySettings.showServiceCount,
          customBadge: formData.displaySettings.customBadge,
        },
        serviceFilters: formData.serviceFilters,
        layout: formData.layout,
      };
      submitData.append('moreServicesConfig', JSON.stringify(moreServicesConfig));

      // Image
      if (imageFile) {
        submitData.append('image', imageFile);
      }

      // Save
      await sduiCategoryApi.upsertMoreServicesSection(submitData);
      
      onSave(formData);
    } catch (err: any) {
      console.error('Error saving config:', err);
      setError(err.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  // Tabs
  const tabs = [
    { id: 'display', label: 'Display', icon: Eye },
    { id: 'action', label: 'Action', icon: Settings },
    { id: 'filters', label: 'Filters', icon: Filter },
    { id: 'layout', label: 'Layout', icon: Layout },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Configure "More Services"
              </h2>
              <p className="text-sm text-gray-500">
                Customize how the More Services card looks and behaves
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 px-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* Display Tab */}
            {activeTab === 'display' && (
              <div className="space-y-6">
                {/* Title & Subtitle */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={formData.displaySettings.title}
                      onChange={(e) => updateField('displaySettings', 'title', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="More Services"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subtitle
                    </label>
                    <input
                      type="text"
                      value={formData.displaySettings.subtitle}
                      onChange={(e) => updateField('displaySettings', 'subtitle', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Explore all services"
                    />
                  </div>
                </div>

                {/* Icon */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Icon
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_PRESETS.map(icon => (
                      <button
                        key={icon}
                        onClick={() => updateField('displaySettings', 'icon', icon)}
                        className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg border-2 transition-colors ${
                          formData.displaySettings.icon === icon
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map(color => (
                      <button
                        key={color.value}
                        onClick={() => {
                          updateField('displaySettings', 'color', color.value);
                          updateField('displaySettings', 'colorClass', color.class);
                        }}
                        className={`w-10 h-10 rounded-lg border-2 transition-colors ${
                          formData.displaySettings.color === color.value
                            ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-400'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Card Image (Optional)
                  </label>
                  <div className="flex items-start gap-4">
                    <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300">
                      {imagePreview || formData.displaySettings.image?.url ? (
                        <img
                          src={imagePreview || formData.displaySettings.image?.url || ''}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon size={32} className="text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        id="more-services-image"
                      />
                      <label
                        htmlFor="more-services-image"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors"
                      >
                        <ImageIcon size={16} />
                        Upload Image
                      </label>
                      <p className="text-xs text-gray-500 mt-2">
                        Recommended: 400x400px, PNG or JPG
                      </p>
                    </div>
                  </div>
                </div>

                {/* Show Service Count */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Show Service Count</h4>
                    <p className="text-sm text-gray-500">Display "+12 More" badge</p>
                  </div>
                  <button
                    onClick={() => updateField('displaySettings', 'showServiceCount', !formData.displaySettings.showServiceCount)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      formData.displaySettings.showServiceCount ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        formData.displaySettings.showServiceCount ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Action Tab */}
            {activeTab === 'action' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    When user taps "More Services"
                  </label>
                  <div className="space-y-2">
                    {ACTION_TYPES.map(action => (
                      <label
                        key={action.value}
                        className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          formData.action.type === action.value
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="actionType"
                          value={action.value}
                          checked={formData.action.type === action.value}
                          onChange={(e) => updateField('action', 'type', e.target.value)}
                          className="mt-1"
                        />
                        <div>
                          <h4 className="font-medium text-gray-900">{action.label}</h4>
                          <p className="text-sm text-gray-500">{action.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Custom Screen Name */}
                {formData.action.type === 'custom_screen' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Screen Name
                    </label>
                    <input
                      type="text"
                      value={formData.action.screenName || ''}
                      onChange={(e) => updateField('action', 'screenName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g., AllServices, CategoryList"
                    />
                  </div>
                )}

                {/* External URL */}
                {formData.action.type === 'external_url' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL
                    </label>
                    <input
                      type="url"
                      value={formData.action.url || ''}
                      onChange={(e) => updateField('action', 'url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="https://example.com/services"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Filters Tab */}
            {activeTab === 'filters' && (
              <div className="space-y-6">
                {/* Show All Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Show All Services</h4>
                    <p className="text-sm text-gray-500">Include all active services</p>
                  </div>
                  <button
                    onClick={() => updateField('serviceFilters', 'showAllServices', !formData.serviceFilters.showAllServices)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      formData.serviceFilters.showAllServices ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        formData.serviceFilters.showAllServices ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Only Popular */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Only Popular Services</h4>
                    <p className="text-sm text-gray-500">Show only services marked as popular</p>
                  </div>
                  <button
                    onClick={() => updateField('serviceFilters', 'onlyPopular', !formData.serviceFilters.onlyPopular)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      formData.serviceFilters.onlyPopular ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        formData.serviceFilters.onlyPopular ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Only Featured */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Only Featured Services</h4>
                    <p className="text-sm text-gray-500">Show only featured services</p>
                  </div>
                  <button
                    onClick={() => updateField('serviceFilters', 'onlyFeatured', !formData.serviceFilters.onlyFeatured)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      formData.serviceFilters.onlyFeatured ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        formData.serviceFilters.onlyFeatured ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Exclude Categories */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Exclude Categories
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => {
                      const excludeList = formData.serviceFilters.excludeCategories || [];
                      const isExcluded = excludeList.some(
                        (c: any) => (typeof c === 'string' ? c : c._id) === cat._id
                      );
                      return (
                        <button
                          key={cat._id}
                          onClick={() => {
                            const currentExcluded = formData.serviceFilters.excludeCategories || [];
                            const newExcluded = isExcluded
                              ? currentExcluded.filter((c: any) => (typeof c === 'string' ? c : c._id) !== cat._id)
                              : [...currentExcluded, cat._id];
                            updateField('serviceFilters', 'excludeCategories', newExcluded);
                          }}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
                            isExcluded
                              ? 'bg-red-100 text-red-700 border border-red-300'
                              : 'bg-gray-100 text-gray-700 border border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span>{cat.icon}</span>
                          {cat.name}
                          {isExcluded && <X size={14} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Layout Tab */}
            {activeTab === 'layout' && (
              <div className="space-y-6">
                {/* View Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    View Type
                  </label>
                  <div className="flex gap-2">
                    {LAYOUT_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => updateField('layout', 'viewType', option.value)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors ${
                          formData.layout.viewType === option.value
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <option.icon size={20} />
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid Columns */}
                {formData.layout.viewType === 'grid' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Grid Columns
                    </label>
                    <div className="flex gap-2">
                      {[2, 3, 4].map(cols => (
                        <button
                          key={cols}
                          onClick={() => updateField('layout', 'gridColumns', cols)}
                          className={`flex-1 py-2 rounded-lg border-2 font-medium transition-colors ${
                            formData.layout.gridColumns === cols
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                        >
                          {cols} Columns
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Show Search */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Search size={20} className="text-gray-500" />
                    <div>
                      <h4 className="font-medium text-gray-900">Show Search Bar</h4>
                      <p className="text-sm text-gray-500">Allow users to search services</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateField('layout', 'showSearch', !formData.layout.showSearch)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      formData.layout.showSearch ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        formData.layout.showSearch ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Show Category Filters */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Filter size={20} className="text-gray-500" />
                    <div>
                      <h4 className="font-medium text-gray-900">Show Category Filters</h4>
                      <p className="text-sm text-gray-500">Filter chips at the top</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateField('layout', 'showCategoryFilters', !formData.layout.showCategoryFilters)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      formData.layout.showCategoryFilters ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        formData.layout.showCategoryFilters ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Default Sort */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Sort Order
                  </label>
                  <select
                    value={formData.layout.defaultSort}
                    onChange={(e) => updateField('layout', 'defaultSort', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {SORT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoreServicesConfigModal;