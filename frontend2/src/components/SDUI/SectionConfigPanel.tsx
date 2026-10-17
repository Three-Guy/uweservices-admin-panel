// src/components/SDUI/SectionConfigPanel.tsx
import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Settings, Layout, Palette, Eye } from 'lucide-react';
import { SDUISection, SECTION_TYPES } from '../../lib/sduiApi';

interface SectionConfigPanelProps {
  section: SDUISection;
  onSave: (config: Partial<SDUISection>) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

const SectionConfigPanel: React.FC<SectionConfigPanelProps> = ({
  section,
  onSave,
  onClose,
  isLoading = false,
}) => {
  const [config, setConfig] = useState<Partial<SDUISection>>({});
  const [activeTab, setActiveTab] = useState<'basic' | 'layout' | 'style' | 'visibility'>('basic');

  useEffect(() => {
    setConfig({
      title: section.title || '',
      subtitle: section.subtitle || '',
      showViewAll: section.showViewAll || false,
      viewAllTarget: section.viewAllTarget || '',
      dataSource: section.dataSource || '',
      enabled: section.enabled,
      layout: section.layout || {
        style: 'grid',
        columns: 2,
        rows: 2,
        itemsToShow: 4,
        spacing: 16,
        showBorder: false,
        roundedCorners: 12,
      },
      style: section.style || {
        backgroundColor: 'transparent',
        paddingTop: 0,
        paddingBottom: 0,
        paddingHorizontal: 16,
        marginTop: 0,
        marginBottom: 24,
      },
      cardStyle: section.cardStyle || {
        showImage: true,
        showTitle: true,
        showSubtitle: false,
        showPrice: false,
        showRating: false,
        showBadge: true,
        imageAspectRatio: '16:9',
        titleLines: 2,
      },
      visibility: section.visibility || {
        requireAuth: false,
        newUsersOnly: false,
        platforms: ['all'],
        minAppVersion: '',
      },
    });
  }, [section]);

  const handleChange = (field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNestedChange = (parent: string, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [parent]: {
        ...(prev as any)[parent],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(config);
  };

  const sectionType = SECTION_TYPES.find(t => t.value === section.type);

  const tabs = [
    { id: 'basic', label: 'Basic', icon: Settings },
    { id: 'layout', label: 'Layout', icon: Layout },
    { id: 'style', label: 'Style', icon: Palette },
    { id: 'visibility', label: 'Visibility', icon: Eye },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{sectionType?.icon || '📦'}</span>
            <div>
              <h2 className="text-xl font-bold text-white">Configure Section</h2>
              <p className="text-indigo-200 text-sm">{sectionType?.label || section.type}</p>
            </div>
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
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
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
            {/* Basic Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Section Title
                  </label>
                  <input
                    type="text"
                    value={config.title || ''}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="e.g., Our Services"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subtitle
                  </label>
                  <input
                    type="text"
                    value={config.subtitle || ''}
                    onChange={(e) => handleChange('subtitle', e.target.value)}
                    placeholder="Optional subtitle text"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Source
                  </label>
                  <select
                    value={config.dataSource || ''}
                    onChange={(e) => handleChange('dataSource', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">None</option>
                    <option value="banners">Banners</option>
                    <option value="categories">Categories</option>
                    <option value="services">Services</option>
                    <option value="popular">Popular Services</option>
                    <option value="trending">Trending Services</option>
                    <option value="featured">Featured Services</option>
                    <option value="recent">Recent Bookings</option>
                    <option value="custom">Custom Data</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Show "View All" Link</span>
                    <p className="text-xs text-gray-500">Display a link to see all items</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleChange('showViewAll', !config.showViewAll)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.showViewAll ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.showViewAll ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {config.showViewAll && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      View All Target
                    </label>
                    <input
                      type="text"
                      value={config.viewAllTarget || ''}
                      onChange={(e) => handleChange('viewAllTarget', e.target.value)}
                      placeholder="/services or /categories"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Layout Tab */}
            {activeTab === 'layout' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Layout Style
                  </label>
                  <select
                    value={config.layout?.style || 'grid'}
                    onChange={(e) => handleNestedChange('layout', 'style', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="grid">Grid</option>
                    <option value="list">List</option>
                    <option value="horizontal">Horizontal Scroll</option>
                    <option value="carousel">Carousel</option>
                    <option value="masonry">Masonry</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Columns
                    </label>
                    <select
                      value={config.layout?.columns || 2}
                      onChange={(e) => handleNestedChange('layout', 'columns', parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Items to Show
                    </label>
                    <input
                      type="number"
                      value={config.layout?.itemsToShow || 4}
                      onChange={(e) => handleNestedChange('layout', 'itemsToShow', parseInt(e.target.value))}
                      min="1"
                      max="50"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Spacing (px)
                    </label>
                    <input
                      type="number"
                      value={config.layout?.spacing || 16}
                      onChange={(e) => handleNestedChange('layout', 'spacing', parseInt(e.target.value))}
                      min="0"
                      max="48"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Corner Radius (px)
                    </label>
                    <input
                      type="number"
                      value={config.layout?.roundedCorners || 12}
                      onChange={(e) => handleNestedChange('layout', 'roundedCorners', parseInt(e.target.value))}
                      min="0"
                      max="32"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Show Border</span>
                  <button
                    type="button"
                    onClick={() => handleNestedChange('layout', 'showBorder', !config.layout?.showBorder)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.layout?.showBorder ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.layout?.showBorder ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Card Style */}
                <div className="border-t pt-5">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Card Style</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'showImage', label: 'Show Image' },
                      { key: 'showTitle', label: 'Show Title' },
                      { key: 'showSubtitle', label: 'Show Subtitle' },
                      { key: 'showPrice', label: 'Show Price' },
                      { key: 'showRating', label: 'Show Rating' },
                      { key: 'showBadge', label: 'Show Badge' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(config.cardStyle as any)?.[item.key] ?? true}
                          onChange={(e) => handleNestedChange('cardStyle', item.key, e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Style Tab */}
            {activeTab === 'style' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Background Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config.style?.backgroundColor === 'transparent' ? '#ffffff' : config.style?.backgroundColor || '#ffffff'}
                      onChange={(e) => handleNestedChange('style', 'backgroundColor', e.target.value)}
                      className="w-12 h-12 rounded-lg border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={config.style?.backgroundColor || 'transparent'}
                      onChange={(e) => handleNestedChange('style', 'backgroundColor', e.target.value)}
                      placeholder="transparent"
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Margin Top (px)
                    </label>
                    <input
                      type="number"
                      value={config.style?.marginTop || 0}
                      onChange={(e) => handleNestedChange('style', 'marginTop', parseInt(e.target.value))}
                      min="0"
                      max="100"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Margin Bottom (px)
                    </label>
                    <input
                      type="number"
                      value={config.style?.marginBottom || 24}
                      onChange={(e) => handleNestedChange('style', 'marginBottom', parseInt(e.target.value))}
                      min="0"
                      max="100"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Padding Top (px)
                    </label>
                    <input
                      type="number"
                      value={config.style?.paddingTop || 0}
                      onChange={(e) => handleNestedChange('style', 'paddingTop', parseInt(e.target.value))}
                      min="0"
                      max="100"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Padding Bottom (px)
                    </label>
                    <input
                      type="number"
                      value={config.style?.paddingBottom || 0}
                      onChange={(e) => handleNestedChange('style', 'paddingBottom', parseInt(e.target.value))}
                      min="0"
                      max="100"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Horizontal Padding (px)
                  </label>
                  <input
                    type="number"
                    value={config.style?.paddingHorizontal || 16}
                    onChange={(e) => handleNestedChange('style', 'paddingHorizontal', parseInt(e.target.value))}
                    min="0"
                    max="48"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Visibility Tab */}
            {activeTab === 'visibility' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Require Authentication</span>
                    <p className="text-xs text-gray-500">Only show to logged-in users</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNestedChange('visibility', 'requireAuth', !config.visibility?.requireAuth)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.visibility?.requireAuth ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.visibility?.requireAuth ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-700">New Users Only</span>
                    <p className="text-xs text-gray-500">Only show to first-time users</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNestedChange('visibility', 'newUsersOnly', !config.visibility?.newUsersOnly)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.visibility?.newUsersOnly ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.visibility?.newUsersOnly ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Platforms</label>
                  <div className="flex flex-wrap gap-2">
                    {['all', 'ios', 'android', 'web'].map((platform) => (
                      <label key={platform} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.visibility?.platforms?.includes(platform) ?? platform === 'all'}
                          onChange={(e) => {
                            const platforms = config.visibility?.platforms || ['all'];
                            if (e.target.checked) {
                              if (platform === 'all') {
                                handleNestedChange('visibility', 'platforms', ['all']);
                              } else {
                                handleNestedChange('visibility', 'platforms', 
                                  [...platforms.filter(p => p !== 'all'), platform]
                                );
                              }
                            } else {
                              handleNestedChange('visibility', 'platforms', 
                                platforms.filter(p => p !== platform)
                              );
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 capitalize">{platform}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum App Version
                  </label>
                  <input
                    type="text"
                    value={config.visibility?.minAppVersion || ''}
                    onChange={(e) => handleNestedChange('visibility', 'minAppVersion', e.target.value)}
                    placeholder="e.g., 1.2.0"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
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
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
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
        </form>
      </div>
    </div>
  );
};

export default SectionConfigPanel;