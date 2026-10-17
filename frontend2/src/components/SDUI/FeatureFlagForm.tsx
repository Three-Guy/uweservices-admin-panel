// src/components/SDUI/FeatureFlagForm.tsx
import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Loader2,
  Flag,
  Settings,
  Users,
  Calendar,
  Code,
  Percent,
  Globe,
  Smartphone,
  Tag,
  AlertCircle,
  Info,
} from 'lucide-react';
import {
  SDUIFeatureFlag,
  FEATURE_FLAG_CATEGORIES,
  FEATURE_FLAG_TYPES,
  FEATURE_FLAG_ENVIRONMENTS,
  USER_SEGMENTS,
  PLATFORMS,
} from '../../lib/sduiApi';

interface FeatureFlagFormProps {
  flag?: SDUIFeatureFlag | null;
  onSubmit: (data: Partial<SDUIFeatureFlag>) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

const FeatureFlagForm: React.FC<FeatureFlagFormProps> = ({
  flag,
  onSubmit,
  onClose,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    enabled: false,
    type: 'boolean' as 'boolean' | 'percentage' | 'user_list' | 'date_range' | 'json',
    // Value
    percentage: 0,
    userIds: '',
    jsonValue: '',
    // Schedule
    isScheduled: false,
    startDate: '',
    endDate: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    // Targeting
    platforms: ['all'] as string[],
    userSegments: ['all'] as string[],
    cities: '',
    minAppVersion: '',
    maxAppVersion: '',
    // Meta
    environment: 'all' as 'development' | 'staging' | 'production' | 'all',
    category: 'feature' as string,
    tags: '',
    dependencies: '',
    priority: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'basic' | 'value' | 'targeting' | 'schedule'>('basic');

  // Load flag data for editing
  useEffect(() => {
    if (flag) {
      setFormData({
        key: flag.key || '',
        name: flag.name || '',
        description: flag.description || '',
        enabled: flag.enabled ?? false,
        type: flag.type || 'boolean',
        percentage: flag.value?.percentage || 0,
        userIds: flag.value?.userIds?.join(', ') || '',
        jsonValue: flag.value?.jsonValue ? JSON.stringify(flag.value.jsonValue, null, 2) : '',
        isScheduled: flag.schedule?.isScheduled || false,
        startDate: flag.schedule?.startDate ? new Date(flag.schedule.startDate).toISOString().slice(0, 16) : '',
        endDate: flag.schedule?.endDate ? new Date(flag.schedule.endDate).toISOString().slice(0, 16) : '',
        timezone: flag.schedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        platforms: flag.targeting?.platforms || ['all'],
        userSegments: flag.targeting?.userSegments || ['all'],
        cities: flag.targeting?.cities?.join(', ') || '',
        minAppVersion: flag.targeting?.minAppVersion || '',
        maxAppVersion: flag.targeting?.maxAppVersion || '',
        environment: flag.environment || 'all',
        category: flag.category || 'feature',
        tags: flag.tags?.join(', ') || '',
        dependencies: flag.dependencies?.join(', ') || '',
        priority: flag.priority || 0,
      });
    }
  }, [flag]);

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

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleMultiSelect = (name: 'platforms' | 'userSegments', value: string) => {
    setFormData(prev => {
      const current = prev[name];
      if (value === 'all') {
        return { ...prev, [name]: ['all'] };
      }
      const filtered = current.filter(v => v !== 'all');
      if (filtered.includes(value)) {
        const newValue = filtered.filter(v => v !== value);
        return { ...prev, [name]: newValue.length > 0 ? newValue : ['all'] };
      }
      return { ...prev, [name]: [...filtered, value] };
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.key.trim()) {
      newErrors.key = 'Key is required';
    } else if (!/^[a-z][a-z0-9_]*$/.test(formData.key)) {
      newErrors.key = 'Key must start with a letter and contain only lowercase letters, numbers, and underscores';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (formData.type === 'percentage') {
      if (formData.percentage < 0 || formData.percentage > 100) {
        newErrors.percentage = 'Percentage must be between 0 and 100';
      }
    }

    if (formData.type === 'json' && formData.jsonValue) {
      try {
        JSON.parse(formData.jsonValue);
      } catch {
        newErrors.jsonValue = 'Invalid JSON format';
      }
    }

    if (formData.isScheduled && !formData.startDate) {
      newErrors.startDate = 'Start date is required for scheduled flags';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Build submit data
    const data: Partial<SDUIFeatureFlag> = {
      key: formData.key.toLowerCase().trim(),
      name: formData.name.trim(),
      description: formData.description.trim(),
      enabled: formData.enabled,
      type: formData.type,
      value: {
        percentage: formData.type === 'percentage' ? formData.percentage : 0,
        userIds: formData.type === 'user_list'
          ? formData.userIds.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        jsonValue: formData.type === 'json' && formData.jsonValue
          ? JSON.parse(formData.jsonValue)
          : null,
      },
      schedule: {
        isScheduled: formData.isScheduled,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        timezone: formData.timezone,
      },
      targeting: {
        platforms: formData.platforms,
        userSegments: formData.userSegments,
        cities: formData.cities.split(',').map(s => s.trim()).filter(Boolean),
        minAppVersion: formData.minAppVersion,
        maxAppVersion: formData.maxAppVersion,
      },
      environment: formData.environment,
      category: formData.category,
      tags: formData.tags.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
      dependencies: formData.dependencies.split(',').map(s => s.trim()).filter(Boolean),
      priority: formData.priority,
    };

    await onSubmit(data);
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Settings },
    { id: 'value', label: 'Value & Type', icon: Code },
    { id: 'targeting', label: 'Targeting', icon: Users },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <Flag className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">
              {flag ? 'Edit Feature Flag' : 'Create Feature Flag'}
            </h2>
          </div>
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
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
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
                {/* Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Flag Key *
                  </label>
                  <input
                    type="text"
                    name="key"
                    value={formData.key}
                    onChange={handleChange}
                    placeholder="e.g., new_checkout_flow"
                    disabled={!!flag} // Can't change key when editing
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono ${
                      errors.key ? 'border-red-500' : 'border-gray-300'
                    } ${flag ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                  {errors.key && <p className="mt-1 text-sm text-red-600">{errors.key}</p>}
                  <p className="mt-1 text-xs text-gray-500">
                    Lowercase letters, numbers, and underscores only. Cannot be changed after creation.
                  </p>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., New Checkout Flow"
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Describe what this flag controls..."
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                {/* Category & Environment */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      {FEATURE_FLAG_CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>
                          {cat.icon} {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Environment
                    </label>
                    <select
                      name="environment"
                      value={formData.environment}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      {FEATURE_FLAG_ENVIRONMENTS.map(env => (
                        <option key={env.value} value={env.value}>{env.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    placeholder="e.g., checkout, payment, experiment (comma-separated)"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Enabled Toggle */}
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleCheckboxChange('enabled', !formData.enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      {formData.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <p className="text-xs text-gray-500">
                      {formData.enabled ? 'This flag is active and will be evaluated' : 'This flag is off'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Value & Type Tab */}
            {activeTab === 'value' && (
              <div className="space-y-6">
                {/* Flag Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Flag Type
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {FEATURE_FLAG_TYPES.map(type => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type: type.value as any }))}
                        className={`p-4 border-2 rounded-xl text-left transition-all ${
                          formData.type === type.value
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="font-medium text-gray-900">{type.label}</p>
                        <p className="text-xs text-gray-500 mt-1">{type.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type-specific value inputs */}
                {formData.type === 'percentage' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rollout Percentage
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        name="percentage"
                        min="0"
                        max="100"
                        value={formData.percentage}
                        onChange={handleChange}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          name="percentage"
                          min="0"
                          max="100"
                          value={formData.percentage}
                          onChange={handleChange}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
                        />
                        <span className="text-gray-500">%</span>
                      </div>
                    </div>
                    {errors.percentage && (
                      <p className="mt-1 text-sm text-red-600">{errors.percentage}</p>
                    )}
                    <p className="mt-2 text-xs text-gray-500">
                      {formData.percentage}% of users will see this feature
                    </p>
                  </div>
                )}

                {formData.type === 'user_list' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      User IDs
                    </label>
                    <textarea
                      name="userIds"
                      value={formData.userIds}
                      onChange={handleChange}
                      placeholder="user123, user456, user789 (comma-separated)"
                      rows={4}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {formData.userIds.split(',').filter(s => s.trim()).length} user(s) will be targeted
                    </p>
                  </div>
                )}

                {formData.type === 'json' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      JSON Configuration
                    </label>
                    <textarea
                      name="jsonValue"
                      value={formData.jsonValue}
                      onChange={handleChange}
                      placeholder='{"key": "value"}'
                      rows={6}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 font-mono text-sm ${
                        errors.jsonValue ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.jsonValue && (
                      <p className="mt-1 text-sm text-red-600">{errors.jsonValue}</p>
                    )}
                  </div>
                )}

                {/* Dependencies */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dependencies
                  </label>
                  <input
                    type="text"
                    name="dependencies"
                    value={formData.dependencies}
                    onChange={handleChange}
                    placeholder="e.g., feature_a, feature_b (comma-separated flag keys)"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    This flag depends on other flags being enabled
                  </p>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority (0-100)
                  </label>
                  <input
                    type="number"
                    name="priority"
                    min="0"
                    max="100"
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Higher priority flags are evaluated first
                  </p>
                </div>
              </div>
            )}

            {/* Targeting Tab */}
            {activeTab === 'targeting' && (
              <div className="space-y-6">
                {/* Platforms */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Smartphone className="w-4 h-4 inline mr-1" />
                    Platforms
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map(platform => (
                      <button
                        key={platform.value}
                        type="button"
                        onClick={() => handleMultiSelect('platforms', platform.value)}
                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                          formData.platforms.includes(platform.value)
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {platform.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* User Segments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Users className="w-4 h-4 inline mr-1" />
                    User Segments
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {USER_SEGMENTS.map(segment => (
                      <button
                        key={segment.value}
                        type="button"
                        onClick={() => handleMultiSelect('userSegments', segment.value)}
                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                          formData.userSegments.includes(segment.value)
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {segment.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cities */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Globe className="w-4 h-4 inline mr-1" />
                    Cities (Optional)
                  </label>
                  <input
                    type="text"
                    name="cities"
                    value={formData.cities}
                    onChange={handleChange}
                    placeholder="e.g., Mumbai, Delhi, Bangalore (comma-separated)"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty to target all cities
                  </p>
                </div>

                {/* App Version */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min App Version
                    </label>
                    <input
                      type="text"
                      name="minAppVersion"
                      value={formData.minAppVersion}
                      onChange={handleChange}
                      placeholder="e.g., 2.0.0"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max App Version
                    </label>
                    <input
                      type="text"
                      name="maxAppVersion"
                      value={formData.maxAppVersion}
                      onChange={handleChange}
                      placeholder="e.g., 3.0.0"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Tab */}
            {activeTab === 'schedule' && (
              <div className="space-y-6">
                {/* Enable Scheduling */}
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
                      Flag will only be active during the scheduled period
                    </p>
                  </div>
                </div>

                {formData.isScheduled && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Date & Time *
                        </label>
                        <input
                          type="datetime-local"
                          name="startDate"
                          value={formData.startDate}
                          onChange={handleChange}
                          className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
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
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50 rounded-lg flex items-start gap-3">
                      <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-700">
                        <p className="font-medium">Schedule Info</p>
                        <p className="mt-1">
                          The flag will automatically become active at the start date and
                          {formData.endDate ? ' deactivate at the end date.' : ' remain active until manually disabled.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
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
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {flag ? 'Update Flag' : 'Create Flag'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeatureFlagForm;