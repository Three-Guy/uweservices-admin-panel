// src/components/SDUI/BannerForm.tsx
import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Calendar, Link, Palette, Settings } from 'lucide-react';
import ImageUploader from './ImageUploader';
import { SDUIBanner } from '../../lib/sduiApi';

interface BannerFormProps {
  banner?: SDUIBanner | null;
  onSubmit: (formData: FormData) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

const BannerForm: React.FC<BannerFormProps> = ({
  banner,
  onSubmit,
  onClose,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    isActive: true,
    // Action
    actionType: 'none' as 'none' | 'service' | 'category' | 'url' | 'screen' | 'promo',
    actionTarget: '',
    promoCode: '',
    // Animation
    animationType: 'slide' as 'none' | 'fade' | 'slide' | 'zoom' | 'flip',
    animationDuration: 500,
    autoPlayDelay: 5000,
    // Schedule
    isScheduled: false,
    startDate: '',
    endDate: '',
    // Display
    sortOrder: 0,
    position: 'hero' as 'hero' | 'middle' | 'bottom' | 'popup',
    backgroundColor: '#000000',
    // Overlay
    overlayEnabled: false,
    overlayTitle: '',
    overlaySubtitle: '',
    overlayButtonText: '',
    overlayTextColor: '#FFFFFF',
    // Targeting
    platforms: ['all'] as string[],
    userSegments: ['all'] as string[],
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'basic' | 'action' | 'schedule' | 'display'>('basic');

  // Load banner data for editing
  useEffect(() => {
    if (banner) {
      setFormData({
        title: banner.title || '',
        description: banner.description || '',
        isActive: banner.isActive ?? true,
        actionType: banner.action?.type || 'none',
        actionTarget: banner.action?.target || '',
        promoCode: banner.action?.promoCode || '',
        animationType: banner.animation?.type || 'slide',
        animationDuration: banner.animation?.duration || 500,
        autoPlayDelay: banner.animation?.autoPlayDelay || 5000,
        isScheduled: banner.schedule?.isScheduled || false,
        startDate: banner.schedule?.startDate ? new Date(banner.schedule.startDate).toISOString().slice(0, 16) : '',
        endDate: banner.schedule?.endDate ? new Date(banner.schedule.endDate).toISOString().slice(0, 16) : '',
        sortOrder: banner.display?.sortOrder || 0,
        position: banner.display?.position || 'hero',
        backgroundColor: banner.display?.backgroundColor || '#000000',
        overlayEnabled: banner.display?.overlay?.enabled || false,
        overlayTitle: banner.display?.overlay?.title || '',
        overlaySubtitle: banner.display?.overlay?.subtitle || '',
        overlayButtonText: banner.display?.overlay?.buttonText || '',
        overlayTextColor: banner.display?.overlay?.textColor || '#FFFFFF',
        platforms: banner.targeting?.platforms || ['all'],
        userSegments: banner.targeting?.userSegments || ['all'],
      });
    }
  }, [banner]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseInt(value) || 0,
    }));
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!banner && !imageFile) {
      newErrors.image = 'Banner image is required';
    }

    if (formData.actionType !== 'none' && !formData.actionTarget.trim()) {
      newErrors.actionTarget = 'Action target is required';
    }

    if (formData.isScheduled && !formData.startDate) {
      newErrors.startDate = 'Start date is required for scheduled banners';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const submitData = new FormData();

    submitData.append('title', formData.title);
    submitData.append('description', formData.description);
    submitData.append('isActive', String(formData.isActive));

    submitData.append('action', JSON.stringify({
      type: formData.actionType,
      target: formData.actionTarget,
      promoCode: formData.promoCode,
    }));

    submitData.append('animation', JSON.stringify({
      type: formData.animationType,
      duration: formData.animationDuration,
      autoPlayDelay: formData.autoPlayDelay,
    }));

    submitData.append('schedule', JSON.stringify({
      isScheduled: formData.isScheduled,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }));

    submitData.append('display', JSON.stringify({
      sortOrder: formData.sortOrder,
      position: formData.position,
      backgroundColor: formData.backgroundColor,
      overlay: {
        enabled: formData.overlayEnabled,
        title: formData.overlayTitle,
        subtitle: formData.overlaySubtitle,
        buttonText: formData.overlayButtonText,
        textColor: formData.overlayTextColor,
      },
    }));

    submitData.append('targeting', JSON.stringify({
      platforms: formData.platforms,
      userSegments: formData.userSegments,
    }));

    if (imageFile) {
      submitData.append('image', imageFile);
    }

    await onSubmit(submitData);
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Settings },
    { id: 'action', label: 'Action', icon: Link },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'display', label: 'Display', icon: Palette },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-600 to-purple-600">
          <h2 className="text-xl font-bold text-white">
            {banner ? 'Edit Banner' : 'Create New Banner'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="p-6">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Image */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Banner Image *
                    </label>
                    <ImageUploader
                      currentImage={banner?.image?.url}
                      onImageSelect={(file) => {
                        setImageFile(file);
                        if (errors.image) {
                          setErrors(prev => ({ ...prev, image: '' }));
                        }
                      }}
                      onImageRemove={() => setImageFile(null)}
                      aspectRatio="16/9"
                    />
                    {errors.image && (
                      <p className="mt-1 text-sm text-red-600">{errors.image}</p>
                    )}
                  </div>

                  {/* Basic Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title *
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        placeholder="Enter banner title"
                        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors.title ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.title && (
                        <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Enter banner description"
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Position
                        </label>
                        <select
                          name="position"
                          value={formData.position}
                          onChange={handleChange}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="hero">Hero (Top)</option>
                          <option value="middle">Middle</option>
                          <option value="bottom">Bottom</option>
                          <option value="popup">Popup</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Sort Order
                        </label>
                        <input
                          type="number"
                          name="sortOrder"
                          value={formData.sortOrder}
                          onChange={handleNumberChange}
                          min="0"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                      <button
                        type="button"
                        onClick={() => handleCheckboxChange('isActive', !formData.isActive)}
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
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          {formData.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <p className="text-xs text-gray-500">
                          {formData.isActive ? 'Banner is visible to users' : 'Banner is hidden'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Tab */}
            {activeTab === 'action' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Action Type
                    </label>
                    <select
                      name="actionType"
                      value={formData.actionType}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="none">No Action</option>
                      <option value="service">Navigate to Service</option>
                      <option value="category">Navigate to Category</option>
                      <option value="url">Open URL</option>
                      <option value="screen">Navigate to Screen</option>
                      <option value="promo">Apply Promo Code</option>
                    </select>
                  </div>

                  {formData.actionType !== 'none' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Target {formData.actionType === 'url' ? 'URL' : 'ID/Slug'}
                      </label>
                      <input
                        type="text"
                        name="actionTarget"
                        value={formData.actionTarget}
                        onChange={handleChange}
                        placeholder={formData.actionType === 'url' ? 'https://...' : 'service-slug'}
                        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.actionTarget ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.actionTarget && (
                        <p className="mt-1 text-sm text-red-600">{errors.actionTarget}</p>
                      )}
                    </div>
                  )}
                </div>

                {formData.actionType === 'promo' && (
                  <div className="max-w-md">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Promo Code
                    </label>
                    <input
                      type="text"
                      name="promoCode"
                      value={formData.promoCode}
                      onChange={handleChange}
                      placeholder="SUMMER20"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                    />
                  </div>
                )}

                {/* Animation Settings */}
                <div className="border-t pt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Animation Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Animation Type
                      </label>
                      <select
                        name="animationType"
                        value={formData.animationType}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="none">None</option>
                        <option value="fade">Fade</option>
                        <option value="slide">Slide</option>
                        <option value="zoom">Zoom</option>
                        <option value="flip">Flip</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Duration (ms)
                      </label>
                      <input
                        type="number"
                        name="animationDuration"
                        value={formData.animationDuration}
                        onChange={handleNumberChange}
                        min="100"
                        max="2000"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Auto-play Delay (ms)
                      </label>
                      <input
                        type="number"
                        name="autoPlayDelay"
                        value={formData.autoPlayDelay}
                        onChange={handleNumberChange}
                        min="1000"
                        max="10000"
                        step="500"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Tab */}
            {activeTab === 'schedule' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleCheckboxChange('isScheduled', !formData.isScheduled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.isScheduled ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isScheduled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      Enable Scheduling
                    </span>
                    <p className="text-xs text-gray-500">
                      Banner will only be shown during the scheduled period
                    </p>
                  </div>
                </div>

                {formData.isScheduled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date & Time *
                      </label>
                      <input
                        type="datetime-local"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.startDate ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.startDate && (
                        <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date & Time (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleChange}
                        min={formData.startDate}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Targeting */}
                <div className="border-t pt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Targeting</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm text-gray-600 mb-2">Platforms</label>
                      <div className="space-y-2">
                        {['all', 'ios', 'android', 'web'].map((platform) => (
                          <label key={platform} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={formData.platforms.includes(platform)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData(prev => ({
                                    ...prev,
                                    platforms: platform === 'all' ? ['all'] : [...prev.platforms.filter(p => p !== 'all'), platform],
                                  }));
                                } else {
                                  setFormData(prev => ({
                                    ...prev,
                                    platforms: prev.platforms.filter(p => p !== platform),
                                  }));
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 capitalize">{platform}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-2">User Segments</label>
                      <div className="space-y-2">
                        {['all', 'new_users', 'returning_users', 'premium_users'].map((segment) => (
                          <label key={segment} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={formData.userSegments.includes(segment)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData(prev => ({
                                    ...prev,
                                    userSegments: segment === 'all' ? ['all'] : [...prev.userSegments.filter(s => s !== 'all'), segment],
                                  }));
                                } else {
                                  setFormData(prev => ({
                                    ...prev,
                                    userSegments: prev.userSegments.filter(s => s !== segment),
                                  }));
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 capitalize">{segment.replace(/_/g, ' ')}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Display Tab */}
            {activeTab === 'display' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Background Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        name="backgroundColor"
                        value={formData.backgroundColor}
                        onChange={handleChange}
                        className="w-12 h-12 rounded-lg border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.backgroundColor}
                        onChange={(e) => setFormData(prev => ({ ...prev, backgroundColor: e.target.value }))}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>

                {/* Text Overlay */}
                <div className="border-t pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => handleCheckboxChange('overlayEnabled', !formData.overlayEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        formData.overlayEnabled ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.overlayEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Text Overlay</span>
                      <p className="text-xs text-gray-500">Show text on top of the banner</p>
                    </div>
                  </div>

                  {formData.overlayEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Overlay Title</label>
                        <input
                          type="text"
                          name="overlayTitle"
                          value={formData.overlayTitle}
                          onChange={handleChange}
                          placeholder="Big Sale!"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Overlay Subtitle</label>
                        <input
                          type="text"
                          name="overlaySubtitle"
                          value={formData.overlaySubtitle}
                          onChange={handleChange}
                          placeholder="Up to 50% off"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Button Text</label>
                        <input
                          type="text"
                          name="overlayButtonText"
                          value={formData.overlayButtonText}
                          onChange={handleChange}
                          placeholder="Shop Now"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Text Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            name="overlayTextColor"
                            value={formData.overlayTextColor}
                            onChange={handleChange}
                            className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={formData.overlayTextColor}
                            onChange={(e) => setFormData(prev => ({ ...prev, overlayTextColor: e.target.value }))}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                            maxLength={7}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
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
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {banner ? 'Update Banner' : 'Create Banner'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BannerForm;