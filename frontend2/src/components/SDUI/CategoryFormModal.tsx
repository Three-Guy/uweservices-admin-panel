// src/pages/SDUI/components/CategoryFormModal.tsx
import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  RefreshCw,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import { sduiCategoryApi, SDUICategory } from '../../../lib/sduiApi';

// ==================== TYPES ====================

interface CategoryFormModalProps {
  category: SDUICategory | null;
  onClose: () => void;
  onSave: () => void;
}

// ==================== COLOR PRESETS ====================

const COLOR_PRESETS = [
  { name: 'Orange', value: '#FF8C42', class: 'bg-orange-100' },
  { name: 'Blue', value: '#3B82F6', class: 'bg-blue-100' },
  { name: 'Green', value: '#10B981', class: 'bg-green-100' },
  { name: 'Purple', value: '#8B5CF6', class: 'bg-purple-100' },
  { name: 'Pink', value: '#EC4899', class: 'bg-pink-100' },
  { name: 'Indigo', value: '#6366F1', class: 'bg-indigo-100' },
  { name: 'Red', value: '#EF4444', class: 'bg-red-100' },
  { name: 'Teal', value: '#14B8A6', class: 'bg-teal-100' },
  { name: 'Yellow', value: '#F59E0B', class: 'bg-yellow-100' },
  { name: 'Cyan', value: '#06B6D4', class: 'bg-cyan-100' },
];

// ==================== ICON PRESETS ====================

const ICON_PRESETS = [
  '🧹', '🔧', '⚡', '❄️', '🎨', '🪲', '🚚', '🪚', '🔌', '💇',
  '🏠', '🛠️', '🔨', '🪠', '🧰', '🧺', '🪣', '🌿', '🚿', '🛁',
  '📦', '✨', '🔥', '💼', '📋', '🎯', '💡', '🚀', '⚙️', '🔩',
];

// ==================== MAIN COMPONENT ====================

const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  category,
  onClose,
  onSave,
}) => {
  const isEditing = !!category;
  
  // Form State
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

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Category name is required');
      return;
    }

    if (!isEditing && !imageFile) {
      setError('Category image is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const submitData = new FormData();
      submitData.append('name', formData.name.trim());
      submitData.append('description', formData.description.trim());
      submitData.append('icon', formData.icon);
      submitData.append('color', formData.color);
      submitData.append('colorClass', formData.colorClass);
      submitData.append('isActive', String(formData.isActive));
      submitData.append('isFeatured', String(formData.isFeatured));
      submitData.append('sortOrder', String(formData.sortOrder));

      if (imageFile) {
        submitData.append('image', imageFile);
      }

      if (isEditing && category?._id) {
        await sduiCategoryApi.update(category._id, submitData);
      } else {
        await sduiCategoryApi.create(submitData);
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error('Error saving category:', err);
      setError(err.response?.data?.message || err.message || 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  // Update color
  const handleColorSelect = (color: typeof COLOR_PRESETS[0]) => {
    setFormData(prev => ({
      ...prev,
      color: color.value,
      colorClass: color.class,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              {isEditing ? 'Edit Category' : 'Add New Category'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., Cleaning, Plumbing"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Brief description of this category"
                />
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Image {!isEditing && <span className="text-red-500">*</span>}
                </label>
                <div className="flex items-start gap-4">
                  <div className="w-32 h-32 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
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
                      id="category-image"
                    />
                    <label
                      htmlFor="category-image"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors"
                    >
                      <ImageIcon size={16} />
                      {isEditing ? 'Change Image' : 'Upload Image'}
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                      Recommended: 400x400px, PNG or JPG, Max 5MB
                    </p>
                  </div>
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
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, icon }))}
                      className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg border-2 transition-colors ${
                        formData.icon === icon
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
                  Color Theme
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => handleColorSelect(color)}
                      className={`w-10 h-10 rounded-lg border-2 transition-colors ${
                        formData.color === color.value
                          ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-400'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-4">
                {/* Active */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Active</h4>
                    <p className="text-xs text-gray-500">Show in app</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      formData.isActive ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        formData.isActive ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Featured */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Featured</h4>
                    <p className="text-xs text-gray-500">Highlight this</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isFeatured: !prev.isFeatured }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      formData.isFeatured ? 'bg-yellow-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        formData.isFeatured ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lower numbers appear first in the grid
                </p>
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {isEditing ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryFormModal;