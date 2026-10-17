// src/components/SDUI/CategoryForm.tsx
import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Palette, Star, Layers, Info } from 'lucide-react';
import ImageUploader from './ImageUploader';
import IconPicker from './IconPicker';
import { SDUICategory } from '../../lib/sduiApi';

interface CategoryFormProps {
  category?: SDUICategory | null;
  onSubmit: (formData: FormData) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
  hasExistingMoreServicesSection?: boolean;
}

const COLOR_PRESETS = [
  { color: '#FF8C42', class: 'bg-orange-100', label: 'Orange' },
  { color: '#3B82F6', class: 'bg-blue-100', label: 'Blue' },
  { color: '#10B981', class: 'bg-green-100', label: 'Green' },
  { color: '#8B5CF6', class: 'bg-purple-100', label: 'Purple' },
  { color: '#EF4444', class: 'bg-red-100', label: 'Red' },
  { color: '#F59E0B', class: 'bg-yellow-100', label: 'Yellow' },
  { color: '#EC4899', class: 'bg-pink-100', label: 'Pink' },
  { color: '#06B6D4', class: 'bg-cyan-100', label: 'Cyan' },
];

const CategoryForm: React.FC<CategoryFormProps> = ({
  category,
  onSubmit,
  onClose,
  isLoading = false,
  hasExistingMoreServicesSection = false,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '📦',
    color: '#FF8C42',
    colorClass: 'bg-orange-100',
    sortOrder: 0,
    isActive: true,
    isFeatured: false,
    isMoreServicesSection: false,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Load category data for editing
  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        description: category.description || '',
        icon: category.icon || '📦',
        color: category.color || '#FF8C42',
        colorClass: category.colorClass || 'bg-orange-100',
        sortOrder: category.sortOrder || 0,
        isActive: category.isActive ?? true,
        isFeatured: category.isFeatured ?? false,
        isMoreServicesSection: category.isMoreServicesSection ?? false,
      });
    }
  }, [category]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleColorSelect = (preset: typeof COLOR_PRESETS[0]) => {
    setFormData(prev => ({
      ...prev,
      color: preset.color,
      colorClass: preset.class,
    }));
  };

  const handleToggle = (field: keyof typeof formData) => {
    // Don't allow enabling More Services if one already exists (and we're not editing it)
    if (field === 'isMoreServicesSection' && !formData.isMoreServicesSection) {
      if (hasExistingMoreServicesSection && !category?.isMoreServicesSection) {
        setErrors(prev => ({
          ...prev,
          isMoreServicesSection: 'A "More Services" section already exists',
        }));
        return;
      }
    }
    
    setFormData(prev => ({ ...prev, [field]: !prev[field] }));
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Category name is required';
    }

    if (!category && !imageFile) {
      newErrors.image = 'Category image is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const submitData = new FormData();

    submitData.append('name', formData.name);
    submitData.append('description', formData.description);
    submitData.append('icon', formData.icon);
    submitData.append('color', formData.color);
    submitData.append('colorClass', formData.colorClass);
    submitData.append('sortOrder', String(formData.sortOrder));
    submitData.append('isActive', String(formData.isActive));
    submitData.append('isFeatured', String(formData.isFeatured));
    submitData.append('isMoreServicesSection', String(formData.isMoreServicesSection));

    if (imageFile) {
      submitData.append('image', imageFile);
    }

    await onSubmit(submitData);
  };

  // Check if we can show More Services option
  const canToggleMoreServices = !hasExistingMoreServicesSection || category?.isMoreServicesSection;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-600 to-blue-600">
          <h2 className="text-xl font-bold text-white">
            {category ? 'Edit Category' : 'Create New Category'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Image & Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Image *
                </label>
                <ImageUploader
                  currentImage={category?.image?.url}
                  onImageSelect={(file) => setImageFile(file)}
                  onImageRemove={() => setImageFile(null)}
                  aspectRatio="1/1"
                />
                {errors.image && (
                  <p className="mt-1 text-sm text-red-600">{errors.image}</p>
                )}
              </div>

              {/* Preview Card */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview
                </label>
                <div 
                  className={`${formData.colorClass} rounded-xl p-4 aspect-square flex flex-col items-center justify-center relative`}
                  style={{ borderLeft: `4px solid ${formData.color}` }}
                >
                  {formData.isMoreServicesSection && (
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
                        <Layers className="w-3 h-3" /> More Services
                      </span>
                    </div>
                  )}
                  <span className="text-4xl mb-2">{formData.icon}</span>
                  <span className="font-semibold text-gray-800 text-center">
                    {formData.name || 'Category Name'}
                  </span>
                  {formData.isFeatured && !formData.isMoreServicesSection && (
                    <span className="mt-2 px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-medium rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3" /> Featured
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Name & Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Cleaning Services"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  name="sortOrder"
                  value={formData.sortOrder}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Brief description of this category..."
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Icon Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Icon
              </label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="w-16 h-16 text-3xl bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center border-2 border-dashed border-gray-300"
                >
                  {formData.icon}
                </button>
                <div className="text-sm text-gray-500">
                  Click to change icon
                </div>
              </div>
              
              {showIconPicker && (
                <IconPicker
                  currentIcon={formData.icon}
                  onSelect={(icon) => {
                    setFormData(prev => ({ ...prev, icon }));
                    setShowIconPicker(false);
                  }}
                  onClose={() => setShowIconPicker(false)}
                />
              )}
            </div>

            {/* Color Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Palette className="w-4 h-4 inline mr-1" />
                Color Theme
              </label>
              <div className="flex flex-wrap gap-3">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.color}
                    type="button"
                    onClick={() => handleColorSelect(preset)}
                    className={`w-10 h-10 rounded-lg transition-all ${
                      formData.color === preset.color
                        ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset.color }}
                    title={preset.label}
                  />
                ))}
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    color: e.target.value,
                    colorClass: 'bg-gray-100',
                  }))}
                  className="w-10 h-10 rounded-lg cursor-pointer border-2 border-dashed border-gray-300"
                  title="Custom color"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggle('isActive')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.isActive ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-700">Active</span>
                </div>

                {!formData.isMoreServicesSection && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggle('isFeatured')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        formData.isFeatured ? 'bg-yellow-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.isFeatured ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-sm text-gray-700 flex items-center gap-1">
                      <Star className="w-4 h-4" /> Featured
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggle('isMoreServicesSection')}
                    disabled={!canToggleMoreServices}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.isMoreServicesSection ? 'bg-blue-500' : 'bg-gray-300'
                    } ${!canToggleMoreServices ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isMoreServicesSection ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-700 flex items-center gap-1">
                    <Layers className="w-4 h-4" /> More Services Section
                  </span>
                </div>
              </div>

              {errors.isMoreServicesSection && (
                <p className="text-sm text-red-600">{errors.isMoreServicesSection}</p>
              )}

              {formData.isMoreServicesSection && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-700 font-medium">
                        More Services Section
                      </p>
                      <p className="text-sm text-blue-600 mt-1">
                        This category will appear as a special "More Services" tile in the category grid. 
                        You can configure its behavior (action, filters, layout) after saving.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-purple-500/25"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {category ? 'Update Category' : 'Create Category'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CategoryForm;