// src/pages/SDUI/CategoriesPage.tsx
// SELF-CONTAINED - All components are inline, no external component imports needed

import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Search,
  RefreshCw,
  Grid3X3,
  List,
  LayoutGrid,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Star,
  X,
  Check,
  AlertCircle,
  GripVertical,
  Settings,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Save,
  Filter,
  Layout,
  Image as ImageIcon,
  Grid,
  Layers,
  CheckSquare,
  Square,
  MousePointer,
  ExternalLink,
} from 'lucide-react';
import {
  sduiCategoryApi,
  sduiSubserviceApi,
  SDUICategory,
  SDUISubservice,
  CategoryActionConfig,
} from '../../lib/sduiApi';

// ====================================================================
// TYPES
// ====================================================================

type ViewMode = 'grid' | 'list' | 'grid-manager';

interface GridCategory {
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
  isMoreServicesSection?: boolean;
  subservicesCount?: number;
  servicesCount?: number;
  moreServicesConfig?: any;
  actionConfig?: CategoryActionConfig;
}

// ====================================================================
// CONSTANTS
// ====================================================================

const COLOR_PRESETS = [
  { name: 'Orange', value: '#FF8C42', cls: 'bg-orange-100' },
  { name: 'Blue', value: '#3B82F6', cls: 'bg-blue-100' },
  { name: 'Green', value: '#10B981', cls: 'bg-green-100' },
  { name: 'Purple', value: '#8B5CF6', cls: 'bg-purple-100' },
  { name: 'Pink', value: '#EC4899', cls: 'bg-pink-100' },
  { name: 'Indigo', value: '#6366F1', cls: 'bg-indigo-100' },
  { name: 'Red', value: '#EF4444', cls: 'bg-red-100' },
  { name: 'Teal', value: '#14B8A6', cls: 'bg-teal-100' },
  { name: 'Yellow', value: '#F59E0B', cls: 'bg-yellow-100' },
  { name: 'Cyan', value: '#06B6D4', cls: 'bg-cyan-100' },
];

const ICON_PRESETS = [
  '🧹', '🔧', '⚡', '❄️', '🎨', '🪲', '🚚', '🪚', '🔌', '💇',
  '🏠', '🛠️', '🔨', '🪠', '🧰', '🧺', '🪣', '🌿', '🚿', '🛁',
  '📦', '✨', '🔥', '💼', '📋', '🎯', '💡', '🚀', '⚙️', '🔩',
];

const CATEGORY_ACTION_TYPES = [
  { value: 'show_all_subservices', label: 'Show All Subservices', desc: 'Display all subservices in this category', icon: Layers },
  { value: 'show_selected_subservices', label: 'Show Selected Subservices', desc: 'Display only selected subservices', icon: CheckSquare },
  { value: 'custom_screen', label: 'Custom Screen', desc: 'Navigate to a specific app screen', icon: MousePointer },
  { value: 'external_url', label: 'External URL', desc: 'Open a web link', icon: ExternalLink },
];

// ====================================================================
// TOGGLE SWITCH COMPONENT
// ====================================================================

const Toggle: React.FC<{ enabled: boolean; onChange: () => void; color?: string }> = ({
  enabled,
  onChange,
  color = 'bg-indigo-600',
}) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? color : 'bg-gray-300'}`}
  >
    <span
      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
        enabled ? 'left-7' : 'left-1'
      }`}
    />
  </button>
);

// ====================================================================
// CATEGORY FORM MODAL
// ====================================================================

const CategoryFormModal: React.FC<{
  category: SDUICategory | null;
  onClose: () => void;
  onSave: () => void;
}> = ({ category, onClose, onSave }) => {
  const isEditing = !!category;

  const [formData, setFormData] = useState({
    name: category?.name || '',
    description: category?.description || '',
    icon: category?.icon || '📦',
    color: category?.color || '#FF8C42',
    colorClass: category?.colorClass || 'bg-orange-100',
    isActive: category?.isActive ?? true,
    isFeatured: category?.isFeatured ?? false,
    sortOrder: category?.sortOrder ?? 0,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(category?.image?.url || null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.name.trim()) { setError('Category name is required'); return; }
    if (!isEditing && !imageFile) { setError('Category image is required'); return; }

    setIsSaving(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append('name', formData.name.trim());
      fd.append('description', formData.description.trim());
      fd.append('icon', formData.icon);
      fd.append('color', formData.color);
      fd.append('colorClass', formData.colorClass);
      fd.append('isActive', String(formData.isActive));
      fd.append('isFeatured', String(formData.isFeatured));
      fd.append('sortOrder', String(formData.sortOrder));
      if (imageFile) fd.append('image', imageFile);

      if (isEditing && category?._id) {
        await sduiCategoryApi.update(category._id, fd);
      } else {
        await sduiCategoryApi.create(fd);
      }
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-bold text-gray-900">
              {isEditing ? 'Edit Category' : 'Add New Category'}
            </h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle size={16} />{error}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Cleaning, Plumbing" />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={formData.description} rows={3}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Brief description" />
            </div>

            {/* Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image {!isEditing && <span className="text-red-500">*</span>}
              </label>
              <div className="flex items-start gap-4">
                <div className="w-32 h-32 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={32} className="text-gray-400" />
                  )}
                </div>
                <div>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" id="cat-img" />
                  <label htmlFor="cat-img"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer">
                    <ImageIcon size={16} />{isEditing ? 'Change' : 'Upload'}
                  </label>
                  <p className="text-xs text-gray-500 mt-2">400x400px, PNG/JPG, Max 5MB</p>
                </div>
              </div>
            </div>

            {/* Icon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICON_PRESETS.map(ic => (
                  <button key={ic} type="button"
                    onClick={() => setFormData(p => ({ ...p, icon: ic }))}
                    className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg border-2 ${
                      formData.icon === ic ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>{ic}</button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map(c => (
                  <button key={c.value} type="button"
                    onClick={() => setFormData(p => ({ ...p, color: c.value, colorClass: c.cls }))}
                    className={`w-10 h-10 rounded-lg border-2 ${
                      formData.color === c.value ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-400' : 'border-transparent'
                    }`} style={{ backgroundColor: c.value }} title={c.name} />
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div><h4 className="font-medium text-gray-900">Active</h4><p className="text-xs text-gray-500">Show in app</p></div>
                <Toggle enabled={formData.isActive} onChange={() => setFormData(p => ({ ...p, isActive: !p.isActive }))} color="bg-green-500" />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div><h4 className="font-medium text-gray-900">Featured</h4><p className="text-xs text-gray-500">Highlight</p></div>
                <Toggle enabled={formData.isFeatured} onChange={() => setFormData(p => ({ ...p, isFeatured: !p.isFeatured }))} color="bg-yellow-500" />
              </div>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <input type="number" min="0" value={formData.sortOrder}
                onChange={e => setFormData(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              <p className="text-xs text-gray-500 mt-1">Lower = appears first</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
            <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">Cancel</button>
            <button onClick={handleSubmit} disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50">
              {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
              {isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ====================================================================
// CATEGORY ACTION CONFIG MODAL (FIXED - For configuring category grid actions)
// ====================================================================

const CategoryActionConfigModal: React.FC<{
  category: GridCategory;
  onClose: () => void;
  onSave: () => void;
}> = ({ category, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<'action' | 'subservices' | 'layout'>('action');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subservices, setSubservices] = useState<SDUISubservice[]>([]);
  const [loadingSubservices, setLoadingSubservices] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const existingConfig = category.actionConfig;

  const [form, setForm] = useState<{
    actionType: string;
    selectedSubservices: string[];
    screenName: string;
    url: string;
    title: string;
    subtitle: string;
    showCount: boolean;
    viewType: string;
    gridColumns: number;
    showSearch: boolean;
    showFilters: boolean;
  }>({
    actionType: existingConfig?.actionType || 'show_all_subservices',
    selectedSubservices: existingConfig?.selectedSubservices || [],
    screenName: existingConfig?.screenName || '',
    url: existingConfig?.url || '',
    title: existingConfig?.displaySettings?.title || category.name,
    subtitle: existingConfig?.displaySettings?.subtitle || '',
    showCount: existingConfig?.displaySettings?.showCount ?? true,
    viewType: existingConfig?.layout?.viewType || 'grid',
    gridColumns: existingConfig?.layout?.gridColumns || 2,
    showSearch: existingConfig?.layout?.showSearch ?? true,
    showFilters: existingConfig?.layout?.showFilters ?? false,
  });

  const updateForm = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));

  // Fetch subservices for this category
  useEffect(() => {
    const fetchSubservices = async () => {
      setLoadingSubservices(true);
      try {
        const res = await sduiSubserviceApi.getByCategoryId(category._id, {
          isActive: 'true',
          limit: 100,
          sortBy: 'sortOrder',
          sortOrder: 'asc',
        });

        // Handle different response structures
        let subserviceData: SDUISubservice[] = [];

        if (res && res.data) {
          if (Array.isArray(res.data)) {
            subserviceData = res.data;
          } else if (res.data.subservices && Array.isArray(res.data.subservices)) {
            subserviceData = res.data.subservices;
          } else if (res.data.data && Array.isArray(res.data.data)) {
            subserviceData = res.data.data;
          }
        } else if (res && Array.isArray(res)) {
          subserviceData = res;
        }

        setSubservices(subserviceData);
      } catch (err: any) {
        console.error('Failed to fetch subservices:', err);
        setSubservices([]);
      } finally {
        setLoadingSubservices(false);
      }
    };

    if (category._id) {
      fetchSubservices();
    }
  }, [category._id]);

  // Safe filtered subservices - always returns an array
  const filteredSubservices = React.useMemo(() => {
    if (!Array.isArray(subservices)) {
      return [];
    }

    if (!searchQuery.trim()) {
      return subservices;
    }

    const query = searchQuery.toLowerCase();
    return subservices.filter(s => {
      if (!s) return false;
      const nameMatch = s.name?.toLowerCase().includes(query) || false;
      const descMatch = s.description?.toLowerCase().includes(query) || false;
      return nameMatch || descMatch;
    });
  }, [subservices, searchQuery]);

  const toggleSubservice = (subserviceId: string) => {
    setForm(prev => {
      const isSelected = prev.selectedSubservices.includes(subserviceId);
      return {
        ...prev,
        selectedSubservices: isSelected
          ? prev.selectedSubservices.filter(id => id !== subserviceId)
          : [...prev.selectedSubservices, subserviceId]
      };
    });
  };

  const selectAllSubservices = () => {
    setForm(prev => ({
      ...prev,
      selectedSubservices: filteredSubservices.map(s => s._id)
    }));
  };

  const deselectAllSubservices = () => {
    setForm(prev => ({
      ...prev,
      selectedSubservices: []
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const actionConfig: CategoryActionConfig = {
        actionType: form.actionType as CategoryActionConfig['actionType'],
        selectedSubservices: form.selectedSubservices,
        screenName: form.screenName,
        url: form.url,
        displaySettings: {
          title: form.title,
          subtitle: form.subtitle,
          showCount: form.showCount,
        },
        layout: {
          viewType: form.viewType as 'grid' | 'list',
          gridColumns: form.gridColumns,
          showSearch: form.showSearch,
          showFilters: form.showFilters,
        },
      };

      // Update category with action config
      await sduiCategoryApi.updateActionConfig(category._id, actionConfig);

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearConfig = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await sduiCategoryApi.clearActionConfig(category._id);
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to clear configuration');
    } finally {
      setIsSaving(false);
    }
  };

  // Safe count for subservices
  const subservicesCount = Array.isArray(subservices) ? subservices.length : 0;
  const selectedCount = form.selectedSubservices.length;

  const tabs = [
    { id: 'action', label: 'Action', icon: Settings },
    { id: 'subservices', label: 'Subservices', icon: Layers, badge: form.actionType === 'show_selected_subservices' ? selectedCount : null },
    { id: 'layout', label: 'Layout', icon: Layout },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: category.color + '20' }}
              >
                {category.image?.url ? (
                  <img src={category.image.url} alt="" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  category.icon
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Configure "{category.name}"</h2>
                <p className="text-sm text-gray-500">Set up what happens when users tap this category</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b px-6">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <t.icon size={16} />
                {t.label}
                {t.badge !== null && t.badge !== undefined && t.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-xs rounded-full">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle size={16} />
                {error}
                <button onClick={() => setError(null)} className="ml-auto">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Action Tab */}
            {activeTab === 'action' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    When user taps "{category.name}"
                  </label>
                  <div className="space-y-2">
                    {CATEGORY_ACTION_TYPES.map(a => {
                      const Icon = a.icon;
                      return (
                        <label
                          key={a.value}
                          className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                            form.actionType === a.value
                              ? 'border-indigo-600 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="actionType"
                            value={a.value}
                            checked={form.actionType === a.value}
                            onChange={() => updateForm('actionType', a.value)}
                            className="mt-1"
                          />
                          <Icon size={20} className={form.actionType === a.value ? 'text-indigo-600' : 'text-gray-400'} />
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{a.label}</h4>
                            <p className="text-sm text-gray-500">{a.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {form.actionType === 'custom_screen' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Screen Name</label>
                    <input
                      type="text"
                      value={form.screenName}
                      onChange={e => updateForm('screenName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., CleaningServicesScreen"
                    />
                    <p className="text-xs text-gray-500 mt-1">The screen name to navigate to in your app</p>
                  </div>
                )}

                {form.actionType === 'external_url' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                    <input
                      type="url"
                      value={form.url}
                      onChange={e => updateForm('url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="https://example.com/services"
                    />
                  </div>
                )}

                {/* Display Settings */}
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium text-gray-700 mb-4">Display Settings</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Screen Title</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={e => updateForm('title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder={category.name}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Subtitle (Optional)</label>
                      <input
                        type="text"
                        value={form.subtitle}
                        onChange={e => updateForm('subtitle', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g., Professional services"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mt-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Show Service Count</h4>
                      <p className="text-sm text-gray-500">Display number of services available</p>
                    </div>
                    <Toggle
                      enabled={form.showCount}
                      onChange={() => updateForm('showCount', !form.showCount)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Subservices Tab */}
            {activeTab === 'subservices' && (
              <>
                {form.actionType !== 'show_selected_subservices' ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <Layers size={48} className="mx-auto text-gray-300 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Subservice Selection Disabled</h3>
                    <p className="text-gray-500 mb-4">
                      To select specific subservices, change the action type to<br />
                      "Show Selected Subservices" in the Action tab.
                    </p>
                    <button
                      onClick={() => {
                        updateForm('actionType', 'show_selected_subservices');
                        setActiveTab('action');
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                    >
                      Enable Selection
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Search & Selection Controls */}
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="relative flex-1">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search subservices..."
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={selectAllSubservices}
                          className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        >
                          Select All
                        </button>
                        <button
                          onClick={deselectAllSubservices}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    {/* Selection Info */}
                    <div className="flex items-center justify-between mb-4 p-3 bg-indigo-50 rounded-lg">
                      <span className="text-sm text-indigo-700">
                        <strong>{selectedCount}</strong> of <strong>{subservicesCount}</strong> subservices selected
                      </span>
                      {selectedCount > 0 && (
                        <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full">
                          Will be shown when tapped
                        </span>
                      )}
                    </div>

                    {/* Subservices List */}
                    {loadingSubservices ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                        <span className="ml-3 text-gray-600">Loading subservices...</span>
                      </div>
                    ) : filteredSubservices.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-xl">
                        <Layers size={48} className="mx-auto text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {searchQuery ? 'No Matching Subservices' : 'No Subservices Found'}
                        </h3>
                        <p className="text-gray-500">
                          {searchQuery
                            ? 'Try a different search term.'
                            : 'This category doesn\'t have any subservices yet.'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-2">
                        {filteredSubservices.map(subservice => {
                          if (!subservice || !subservice._id) return null;
                          const isSelected = form.selectedSubservices.includes(subservice._id);
                          return (
                            <div
                              key={subservice._id}
                              onClick={() => toggleSubservice(subservice._id)}
                              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-50'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex-shrink-0">
                                {isSelected ? (
                                  <CheckSquare size={20} className="text-indigo-600" />
                                ) : (
                                  <Square size={20} className="text-gray-400" />
                                )}
                              </div>
                              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {subservice.image?.url ? (
                                  <img
                                    src={subservice.image.url}
                                    alt={subservice.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-xl">{subservice.icon || '📦'}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 truncate">
                                  {subservice.name}
                                </h4>
                                {subservice.description && (
                                  <p className="text-sm text-gray-500 truncate">
                                    {subservice.description}
                                  </p>
                                )}
                              </div>
                              {subservice.price !== undefined && subservice.price !== null && (
                                <div className="text-right flex-shrink-0">
                                  <span className="text-sm font-semibold text-gray-900">
                                    ₹{subservice.price}
                                  </span>
                                  {subservice.discountedPrice !== undefined &&
                                    subservice.discountedPrice !== null &&
                                    subservice.discountedPrice < subservice.price && (
                                      <span className="block text-xs text-gray-400 line-through">
                                        ₹{subservice.discountedPrice}
                                      </span>
                                    )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Layout Tab */}
            {activeTab === 'layout' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">View Type</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'grid', label: 'Grid', icon: Grid },
                      { value: 'list', label: 'List', icon: List },
                    ].map(o => (
                      <button
                        key={o.value}
                        onClick={() => updateForm('viewType', o.value)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors ${
                          form.viewType === o.value
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <o.icon size={20} />
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {form.viewType === 'grid' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Grid Columns</label>
                    <div className="flex gap-2">
                      {[2, 3, 4].map(n => (
                        <button
                          key={n}
                          onClick={() => updateForm('gridColumns', n)}
                          className={`flex-1 py-2 rounded-lg border-2 font-medium transition-colors ${
                            form.gridColumns === n
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {n} Columns
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Search size={20} className="text-gray-500" />
                    <div>
                      <h4 className="font-medium text-gray-900">Search Bar</h4>
                      <p className="text-sm text-gray-500">Allow users to search subservices</p>
                    </div>
                  </div>
                  <Toggle
                    enabled={form.showSearch}
                    onChange={() => updateForm('showSearch', !form.showSearch)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Filter size={20} className="text-gray-500" />
                    <div>
                      <h4 className="font-medium text-gray-900">Filter Options</h4>
                      <p className="text-sm text-gray-500">Show filter chips for subservices</p>
                    </div>
                  </div>
                  <Toggle
                    enabled={form.showFilters}
                    onChange={() => updateForm('showFilters', !form.showFilters)}
                  />
                </div>

                {/* Preview */}
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Preview</h3>
                  <div className="bg-gray-100 rounded-xl p-4">
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">{form.title || category.name}</h4>
                        {form.showCount && (
                          <span className="text-xs text-gray-500">
                            {form.actionType === 'show_selected_subservices'
                              ? selectedCount
                              : subservicesCount} services
                          </span>
                        )}
                      </div>
                      {form.subtitle && (
                        <p className="text-sm text-gray-500 mb-3">{form.subtitle}</p>
                      )}
                      {form.showSearch && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg mb-3">
                          <Search size={14} className="text-gray-400" />
                          <span className="text-sm text-gray-400">Search...</span>
                        </div>
                      )}
                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns: form.viewType === 'grid'
                            ? `repeat(${form.gridColumns}, 1fr)`
                            : '1fr'
                        }}
                      >
                        {Array.from({ length: form.viewType === 'grid' ? form.gridColumns * 2 : 3 }).map((_, i) => (
                          <div
                            key={i}
                            className={`bg-gray-100 rounded-lg ${
                              form.viewType === 'grid' ? 'aspect-square' : 'h-12'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
            <div>
              {existingConfig && (
                <button
                  onClick={handleClearConfig}
                  disabled={isSaving}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                >
                  Clear Configuration
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
              >
                {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ====================================================================
// SORTABLE CATEGORY CARD (for Grid Manager)
// ====================================================================

const SortableCategoryCard: React.FC<{
  category: GridCategory;
  index: number;
  onEdit?: (c: GridCategory) => void;
  onToggleActive?: (c: GridCategory) => void;
  onConfigure?: (c: GridCategory) => void;
  disabled?: boolean;
}> = ({ category, index, onEdit, onToggleActive, onConfigure, disabled = false }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category._id, disabled });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const hasActionConfig = !!category.actionConfig;
  const selectedCount = category.actionConfig?.selectedSubservices?.length || 0;

  return (
    <div ref={setNodeRef} style={style}
      className={`relative bg-white rounded-xl border-2 overflow-hidden ${isDragging ? 'border-indigo-500 shadow-xl z-50' : 'border-gray-200'} ${!category.isActive ? 'opacity-60' : ''}`}>
      {/* Position Badge */}
      <div className="absolute top-2 left-2 z-10 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">
        #{index + 1}
      </div>

      {/* Action Config Indicator */}
      {hasActionConfig && (
        <div className="absolute top-2 left-12 z-10 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
          <Settings size={10} />
          {category.actionConfig?.actionType === 'show_selected_subservices' && selectedCount > 0 ? (
            <span>{selectedCount} selected</span>
          ) : (
            <span>Configured</span>
          )}
        </div>
      )}

      {/* Drag Handle */}
      {!disabled && (
        <div {...attributes} {...listeners} className="absolute top-2 right-2 z-10 p-1.5 bg-white/90 rounded-lg cursor-grab active:cursor-grabbing hover:bg-gray-100">
          <GripVertical size={16} className="text-gray-500" />
        </div>
      )}

      {/* Image */}
      <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 relative">
        {category.image?.url ? (
          <img src={category.image.url} alt={category.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl" style={{ backgroundColor: category.color + '20' }}>
            {category.icon}
          </div>
        )}
        {!category.isActive && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">Inactive</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 truncate">{category.name}</h4>
            <p className="text-xs text-gray-500 mt-0.5">{category.subservicesCount || category.servicesCount || 0} services</p>
          </div>
          <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
          {/* Configure Action Button */}
          <button
            onClick={() => onConfigure?.(category)}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg ${
              hasActionConfig
                ? 'text-green-600 bg-green-50 hover:bg-green-100'
                : 'text-indigo-600 hover:bg-indigo-50'
            }`}
            title="Configure action"
          >
            <Settings size={14} />
            {hasActionConfig ? 'Edit Action' : 'Add Action'}
          </button>
          <button
            onClick={() => onEdit?.(category)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Edit category"
          >
            <Edit size={14} />
          </button>
          <button
            onClick={() => onToggleActive?.(category)}
            className={`p-1.5 rounded-lg ${category.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
            title={category.isActive ? 'Deactivate' : 'Activate'}
          >
            {category.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
};

// ====================================================================
// CATEGORY GRID MANAGER (Without More Services)
// ====================================================================

const CategoryGridManager: React.FC<{
  onEditCategory?: (c: any) => void;
  onRefresh?: () => void;
}> = ({ onEditCategory, onRefresh }) => {
  const [categories, setCategories] = useState<GridCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCategoryActionConfig, setShowCategoryActionConfig] = useState<GridCategory | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchCats = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await sduiCategoryApi.getAll({ sortBy: 'sortOrder', sortOrder: 'asc', limit: 100 });
      if (res.success) {
        const all = (res.data || []) as GridCategory[];
        // Filter out "More Services" section and sort by sortOrder
        const regularCategories = all
          .filter(c => !c.isMoreServicesSection)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setCategories(regularCategories);
        setChanged(false);
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCats(); }, [fetchCats]);

  const onDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over || e.active.id === e.over.id) return;
    const aIdx = categories.findIndex(c => c._id === e.active.id);
    const oIdx = categories.findIndex(c => c._id === e.over!.id);
    if (aIdx >= 0 && oIdx >= 0) {
      setCategories(arrayMove(categories, aIdx, oIdx));
      setChanged(true);
    }
  };

  const toggleActive = async (cat: GridCategory) => {
    try {
      await sduiCategoryApi.update(cat._id, { isActive: !cat.isActive });
      fetchCats();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleConfigureCategory = (cat: GridCategory) => {
    setShowCategoryActionConfig(cat);
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await sduiCategoryApi.reorder(categories.map((c, i) => ({ id: c._id, sortOrder: i })));
      setChanged(false);
      onRefresh?.();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const activeCat = activeId ? categories.find(c => c._id === activeId) : null;

  // Filter active categories for preview
  const activeCategories = categories.filter(c => c.isActive);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      <span className="ml-3 text-gray-600">Loading...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Grid3X3 className="text-indigo-600" size={24} />
            Category Grid Manager
          </h2>
          <p className="text-sm text-gray-500 mt-1">Drag to reorder categories. Configure actions for each category.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchCats} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={20} />
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${showPreview ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Smartphone size={18} />Preview
          </button>
          {changed && (
            <>
              <button onClick={fetchCats} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Discard</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50">
                {saving ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />}Save Order
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded">
            <X size={16} />
          </button>
        </div>
      )}

      <div className={`grid gap-6 ${showPreview ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
        <div className={showPreview ? 'lg:col-span-2' : ''}>
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">
                {categories.length}
              </span>
              All Categories
              <span className="text-xs text-gray-400 font-normal">(Drag to reorder)</span>
            </h3>

            {categories.length === 0 ? (
              <div className="text-center py-12">
                <LayoutGrid size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
                <p className="text-gray-500">Add categories to manage them here.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
                <SortableContext items={categories.map(c => c._id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {categories.map((c, i) => (
                      <SortableCategoryCard
                        key={c._id}
                        category={c}
                        index={i}
                        onEdit={onEditCategory}
                        onToggleActive={toggleActive}
                        onConfigure={handleConfigureCategory}
                      />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeCat ? (
                    <div className="bg-white rounded-xl border-2 border-indigo-500 shadow-2xl overflow-hidden w-48">
                      <div className="h-24 bg-gray-200">
                        {activeCat.image?.url ? (
                          <img src={activeCat.image.url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl" style={{ backgroundColor: activeCat.color + '20' }}>
                            {activeCat.icon}
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <h4 className="font-semibold text-sm truncate">{activeCat.name}</h4>
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <LayoutGrid size={20} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
                  <p className="text-sm text-gray-500">Total Categories</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Eye size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{activeCategories.length}</p>
                  <p className="text-sm text-gray-500">Active</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Settings size={20} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{categories.filter(c => c.actionConfig).length}</p>
                  <p className="text-sm text-gray-500">Configured</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showPreview && (
          <div className="lg:col-span-1">
            <div className="bg-gray-100 rounded-xl p-6 sticky top-4">
              <h3 className="font-semibold text-gray-900 text-center mb-4">Mobile Preview</h3>
              <div className="bg-gray-900 rounded-3xl p-2 w-64 mx-auto shadow-2xl">
                <div className="bg-black rounded-t-2xl pt-2">
                  <div className="w-20 h-5 bg-gray-900 rounded-full mx-auto" />
                </div>
                <div className="bg-white rounded-b-2xl p-3 min-h-[320px]">
                  <div className="text-center mb-3">
                    <h4 className="font-semibold text-gray-900 text-sm">Our Services</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {activeCategories.slice(0, 6).map(c => (
                      <div key={c._id} className="aspect-square rounded-xl overflow-hidden relative">
                        {c.image?.url ? (
                          <img src={c.image.url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl" style={{ backgroundColor: c.color + '30' }}>
                            {c.icon}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <span className="absolute bottom-1 left-1 right-1 text-white text-xs font-medium truncate">{c.name}</span>
                        {/* Show config indicator in preview */}
                        {c.actionConfig && (
                          <div className="absolute top-1 right-1 w-3 h-3 bg-green-500 rounded-full border border-white" title="Action configured" />
                        )}
                      </div>
                    ))}
                  </div>
                  {activeCategories.length > 6 && (
                    <p className="text-center text-xs text-gray-500 mt-2">
                      +{activeCategories.length - 6} more categories
                    </p>
                  )}
                  <div className="mt-4 flex justify-center">
                    <div className="w-24 h-1 bg-gray-300 rounded-full" />
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-white rounded-lg">
                <p className="text-xs text-gray-600 text-center flex items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                    Action configured
                  </span>
                </p>
              </div>
              <p className="text-xs text-gray-500 text-center mt-2">How it appears on user's home</p>
            </div>
          </div>
        )}
      </div>

      {/* Category Action Config Modal */}
      {showCategoryActionConfig && (
        <CategoryActionConfigModal
          category={showCategoryActionConfig}
          onClose={() => setShowCategoryActionConfig(null)}
          onSave={() => { fetchCats(); setShowCategoryActionConfig(null); }}
        />
      )}
    </div>
  );
};

// ====================================================================
// MAIN CATEGORIES PAGE
// ====================================================================

const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<SDUICategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedCategory, setSelectedCategory] = useState<SDUICategory | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const params: any = { sortBy: 'sortOrder', sortOrder: 'asc', limit: 100 };
      if (searchQuery) params.search = searchQuery;
      if (filterStatus !== 'all') params.isActive = filterStatus === 'active' ? 'true' : 'false';
      const res = await sduiCategoryApi.getAll(params);
      if (res.success) setCategories(res.data || []);
      else setError('Failed to fetch categories');
    } catch (err: any) { setError(err.message || 'Failed to fetch'); }
    finally { setIsLoading(false); }
  }, [searchQuery, filterStatus]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleEdit = (cat: SDUICategory) => { setSelectedCategory(cat); setShowFormModal(true); };

  const handleDelete = async (id: string) => {
    try { await sduiCategoryApi.delete(id); setShowDeleteConfirm(null); fetchCategories(); }
    catch (err: any) { setError(err.message); }
  };

  const handleToggleActive = async (cat: SDUICategory) => {
    try { await sduiCategoryApi.update(cat._id, { isActive: !cat.isActive }); fetchCategories(); }
    catch (err: any) { setError(err.message); }
  };

  const filteredCategories = categories.filter(c => !c.isMoreServicesSection);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-1">Manage service categories for your app</p>
        </div>
        <button onClick={() => { setSelectedCategory(null); setShowFormModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
          <Plus size={20} />Add Category
        </button>
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex bg-gray-100 rounded-lg p-1">
          {([['grid', LayoutGrid, 'Grid View'], ['list', List, 'List View'], ['grid-manager', Grid3X3, 'Grid Manager']] as const).map(([mode, Icon, label]) => (
            <button key={mode} onClick={() => setViewMode(mode as ViewMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              <Icon size={18} />{label}
            </button>
          ))}
        </div>
        {viewMode !== 'grid-manager' && (
          <div className="flex items-center gap-3 ml-auto">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search categories..."
                className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button onClick={fetchCategories} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
              <RefreshCw size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Content */}
      {viewMode === 'grid-manager' ? (
        <CategoryGridManager onEditCategory={handleEdit as any} onRefresh={fetchCategories} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center py-12">
          <LayoutGrid size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
          <p className="text-gray-500 mb-4">{searchQuery ? 'Try different search' : 'Add your first category'}</p>
          <button onClick={() => { setSelectedCategory(null); setShowFormModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
            <Plus size={20} />Add Category
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCategories.map(cat => (
            <div key={cat._id} className={`bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-shadow ${!cat.isActive ? 'opacity-60' : ''}`}>
              <div className="h-40 bg-gray-100 relative">
                {cat.image?.url ? (
                  <img src={cat.image.url} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl" style={{ backgroundColor: cat.color + '20' }}>
                    {cat.icon}
                  </div>
                )}
                <div className="absolute top-2 left-2 flex gap-1">
                  {cat.isFeatured && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                      <Star size={12} />Featured
                    </span>
                  )}
                  {cat.actionConfig && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      <Settings size={12} />Action
                    </span>
                  )}
                </div>
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${cat.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {cat.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{cat.subservicesCount || cat.servicesCount || 0} services</p>
                  </div>
                  <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                </div>
                {cat.description && (
                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">{cat.description}</p>
                )}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button onClick={() => handleEdit(cat)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                    <Edit size={16} />Edit
                  </button>
                  <button onClick={() => handleToggleActive(cat)} className={`p-2 rounded-lg ${cat.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                    {cat.isActive ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                  <button onClick={() => setShowDeleteConfirm(cat._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Category</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Services</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Action Config</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Order</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCategories.map(cat => (
                <tr key={cat._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl overflow-hidden" style={{ backgroundColor: cat.color + '20' }}>
                        {cat.image?.url ? <img src={cat.image.url} alt="" className="w-full h-full object-cover" /> : cat.icon}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{cat.name}</p>
                        <p className="text-sm text-gray-500">{cat.categoryId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{cat.subservicesCount || cat.servicesCount || 0}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${cat.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {cat.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {cat.actionConfig ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                        <Settings size={12} />
                        {cat.actionConfig.actionType === 'show_selected_subservices'
                          ? `${cat.actionConfig.selectedSubservices?.length || 0} selected`
                          : 'Configured'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Not configured</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">#{cat.sortOrder + 1}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(cat)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleToggleActive(cat)} className={`p-2 rounded-lg ${cat.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                        {cat.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button onClick={() => setShowDeleteConfirm(cat._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 size={24} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Delete Category</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this category? All associated data including action configurations will be permanently removed.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  Delete Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showFormModal && (
        <CategoryFormModal
          category={selectedCategory}
          onClose={() => { setShowFormModal(false); setSelectedCategory(null); }}
          onSave={() => { fetchCategories(); setShowFormModal(false); setSelectedCategory(null); }}
        />
      )}
    </div>
  );
};

export default CategoriesPage;