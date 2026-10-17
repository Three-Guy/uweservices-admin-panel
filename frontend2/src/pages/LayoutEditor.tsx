import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, GripVertical, Eye, EyeOff, ChevronDown, ChevronUp, Upload, X, Layout } from 'lucide-react';
import { layoutsApi, LayoutConfig, LayoutSection } from '../lib/api';

const SECTION_TYPES = [
  { value: 'banner_carousel', label: 'Banner Carousel', icon: '🖼️' },
  { value: 'category_grid', label: 'Category Grid', icon: '📦' },
  { value: 'service_grid', label: 'Service Grid', icon: '🔧' },
  { value: 'popular_services', label: 'Popular Services', icon: '⭐' },
  { value: 'trending_services', label: 'Trending Services', icon: '📈' },
  { value: 'featured_services', label: 'Featured Services', icon: '✨' },
  { value: 'search_bar', label: 'Search Bar', icon: '🔍' },
  { value: 'quick_actions', label: 'Quick Actions', icon: '⚡' },
  { value: 'emergency_section', label: 'Emergency Section', icon: '🚨' },
  { value: 'spacer', label: 'Spacer', icon: '↕️' },
  { value: 'divider', label: 'Divider', icon: '➖' },
];

const PAGES = [
  { value: 'home', label: 'Home Screen' },
  { value: 'services', label: 'Services Screen' },
  { value: 'categories', label: 'Categories Screen' },
  { value: 'profile', label: 'Profile Screen' },
  { value: 'search', label: 'Search Screen' },
];

const LayoutEditor: React.FC = () => {
  const [layouts, setLayouts] = useState<LayoutConfig[]>([]);
  const [selectedLayout, setSelectedLayout] = useState<LayoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);

  useEffect(() => { fetchLayouts(); }, []);

  const fetchLayouts = async () => {
    try {
      setLoading(true);
      const response = await layoutsApi.getAll();
      if (response.success) {
        setLayouts(response.data || []);
        if (response.data?.length > 0 && !selectedLayout) {
          setSelectedLayout(response.data[0]);
        }
      }
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  };

  const saveLayout = async (publish = false) => {
    if (!selectedLayout) return;
    try {
      publish ? setPublishing(true) : setSaving(true);
      const payload = { 
        ...selectedLayout, 
        ...(publish && { isPublished: true, publishedAt: new Date().toISOString() }) 
      };
      await layoutsApi.update(selectedLayout._id, payload);
      setHasChanges(false);
      fetchLayouts();
      alert(publish ? 'Layout published successfully!' : 'Layout saved successfully!');
    } catch (error) { 
      console.error('Error:', error); 
      alert('Error saving layout'); 
    } finally { 
      setSaving(false); 
      setPublishing(false); 
    }
  };

  const createLayout = async (page: string) => {
    try {
      const response = await layoutsApi.create({ 
        page, 
        pageName: PAGES.find(p => p.value === page)?.label || page, 
        sections: [], 
        isActive: true 
      });
      if (response.success) { 
        fetchLayouts(); 
        setSelectedLayout(response.data); 
      }
    } catch (error) { console.error('Error:', error); }
  };

  const addSection = (type: string) => {
    if (!selectedLayout) return;
    const sectionType = SECTION_TYPES.find(t => t.value === type);
    const newSection: LayoutSection = {
      sectionId: `${selectedLayout.page}-${type}-${Date.now().toString(36)}`,
      type,
      enabled: true,
      order: selectedLayout.sections.length,
      title: sectionType?.label || 'New Section',
      subtitle: '',
      showViewAll: false,
      viewAllTarget: '',
      dataSource: '',
      layout: {
        style: 'grid',
        columns: 2,
        rows: 2,
        itemsToShow: 4,
        spacing: 16,
        showBorder: false,
        roundedCorners: 12,
      },
      style: {
        backgroundColor: 'transparent',
        paddingTop: 0,
        paddingBottom: 0,
        paddingHorizontal: 16,
        marginTop: 0,
        marginBottom: 24,
      },
      cardStyle: {
        showImage: true,
        showTitle: true,
        showSubtitle: false,
        showPrice: false,
        showRating: false,
        showBadge: true,
        imageAspectRatio: '16:9',
        titleLines: 2,
      },
      filters: {
        categories: [],
        services: [],
        tags: [],
        isPopular: null,
        isFeatured: null,
      },
      visibility: {
        requireAuth: false,
        newUsersOnly: false,
        platforms: ['all'],
        minAppVersion: '',
      },
      customData: {},
    };
    setSelectedLayout({ 
      ...selectedLayout, 
      sections: [...selectedLayout.sections, newSection] 
    });
    setHasChanges(true);
    setShowAddSection(false);
    setExpandedSection(newSection.sectionId);
  };

  const updateSection = (sectionId: string, updates: Partial<LayoutSection>) => {
    if (!selectedLayout) return;
    setSelectedLayout({
      ...selectedLayout,
      sections: selectedLayout.sections.map(s =>
        s.sectionId === sectionId ? { ...s, ...updates } : s
      ),
    });
    setHasChanges(true);
  };

  const removeSection = (sectionId: string) => {
    if (!selectedLayout || !confirm('Remove this section?')) return;
    setSelectedLayout({
      ...selectedLayout,
      sections: selectedLayout.sections.filter(s => s.sectionId !== sectionId),
    });
    setHasChanges(true);
  };

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    if (!selectedLayout) return;
    const sections = [...selectedLayout.sections];
    const index = sections.findIndex(s => s.sectionId === sectionId);
    
    if (direction === 'up' && index > 0) {
      [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]];
    } else if (direction === 'down' && index < sections.length - 1) {
      [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
    }
    
    sections.forEach((s, i) => { s.order = i; });
    setSelectedLayout({ ...selectedLayout, sections });
    setHasChanges(true);
  };

  const updateLayoutSettings = (updates: Partial<LayoutConfig['settings']>) => {
    if (!selectedLayout) return;
    setSelectedLayout({
      ...selectedLayout,
      settings: { ...selectedLayout.settings, ...updates },
    });
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Layout Editor</h1>
          <p className="text-sm text-gray-500">Configure screen layouts for the mobile app</p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-sm text-orange-600 flex items-center gap-1">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              Unsaved changes
            </span>
          )}
          <button
            onClick={() => saveLayout(false)}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => saveLayout(true)}
            disabled={publishing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Page List */}
        <div className="w-64 bg-white border-r overflow-y-auto">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Screens</h2>
          </div>
          <div className="p-2">
            {layouts.map(layout => (
              <button
                key={layout._id}
                onClick={() => {
                  if (hasChanges && !confirm('You have unsaved changes. Continue?')) return;
                  setSelectedLayout(layout);
                  setHasChanges(false);
                }}
                className={`w-full text-left px-3 py-3 rounded-lg mb-1 transition-colors ${
                  selectedLayout?._id === layout._id
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{layout.pageName || layout.page}</div>
                    <div className="text-xs text-gray-500">
                      {layout.sections?.length || 0} sections • v{layout.version || 1}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {layout.isPublished && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Live</span>
                    )}
                    {layout.isActive ? (
                      <Eye className="w-3 h-3 text-green-500" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                </div>
              </button>
            ))}

            {/* Create new layout for missing pages */}
            {PAGES.filter(p => !layouts.find(l => l.page === p.value)).length > 0 && (
              <div className="border-t mt-4 pt-4">
                <p className="text-xs text-gray-500 px-3 mb-2">Create Layout For:</p>
                {PAGES.filter(p => !layouts.find(l => l.page === p.value)).map(page => (
                  <button
                    key={page.value}
                    onClick={() => createLayout(page.value)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {page.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        {selectedLayout ? (
          <div className="flex-1 overflow-y-auto p-6">
            {/* Page Settings */}
            <div className="bg-white rounded-lg shadow-sm mb-6 p-4">
              <h3 className="font-semibold mb-4">Page Settings</h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Header Style</label>
                  <select
                    value={selectedLayout.settings?.headerStyle || 'default'}
                    onChange={(e) => updateLayoutSettings({ headerStyle: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="default">Default</option>
                    <option value="transparent">Transparent</option>
                    <option value="solid">Solid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Background</label>
                  <input
                    type="color"
                    value={selectedLayout.settings?.backgroundColor || '#FFFFFF'}
                    onChange={(e) => updateLayoutSettings({ backgroundColor: e.target.value })}
                    className="w-full h-10 border rounded-lg cursor-pointer"
                  />
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedLayout.settings?.pullToRefresh !== false}
                      onChange={(e) => updateLayoutSettings({ pullToRefresh: e.target.checked })}
                      className="h-4 w-4 text-indigo-600 rounded"
                    />
                    <span className="text-sm">Pull to Refresh</span>
                  </label>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedLayout.isActive}
                      onChange={(e) => {
                        setSelectedLayout({ ...selectedLayout, isActive: e.target.checked });
                        setHasChanges(true);
                      }}
                      className="h-4 w-4 text-indigo-600 rounded"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Sections List */}
            <div className="space-y-3">
              {selectedLayout.sections
                .sort((a, b) => a.order - b.order)
                .map((section, index) => {
                  const sectionType = SECTION_TYPES.find(t => t.value === section.type);
                  const isExpanded = expandedSection === section.sectionId;

                  return (
                    <div
                      key={section.sectionId}
                      className={`bg-white rounded-lg shadow-sm border ${
                        !section.enabled ? 'opacity-60' : ''
                      } ${isExpanded ? 'ring-2 ring-indigo-500' : ''}`}
                    >
                      {/* Section Header */}
                      <div
                        className="flex items-center gap-3 p-4 cursor-pointer"
                        onClick={() => setExpandedSection(isExpanded ? null : section.sectionId)}
                      >
                        <GripVertical className="w-5 h-5 text-gray-400 cursor-grab" />
                        <span className="text-xl">{sectionType?.icon || '📦'}</span>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{section.title}</div>
                          <div className="text-xs text-gray-500">{sectionType?.label}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); updateSection(section.sectionId, { enabled: !section.enabled }); }}
                            className={`p-1.5 rounded ${section.enabled ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50'}`}
                          >
                            {section.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveSection(section.sectionId, 'up'); }}
                            disabled={index === 0}
                            className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveSection(section.sectionId, 'down'); }}
                            disabled={index === selectedLayout.sections.length - 1}
                            className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeSection(section.sectionId); }}
                            className="p-1.5 text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </div>
                      </div>

                      {/* Expanded Section Editor */}
                      {isExpanded && (
                        <div className="border-t p-4 space-y-6">
                          {/* Basic Settings */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                              <input
                                type="text"
                                value={section.title}
                                onChange={(e) => updateSection(section.sectionId, { title: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                              <input
                                type="text"
                                value={section.subtitle}
                                onChange={(e) => updateSection(section.sectionId, { subtitle: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </div>
                          </div>

                          {/* Layout Options */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-3">Layout</h4>
                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Style</label>
                                <select
                                  value={section.layout.style}
                                  onChange={(e) => updateSection(section.sectionId, { layout: { ...section.layout, style: e.target.value } })}
                                  className="w-full px-3 py-2 border rounded-lg text-sm"
                                >
                                  <option value="grid">Grid</option>
                                  <option value="list">List</option>
                                  <option value="horizontal">Horizontal</option>
                                  <option value="carousel">Carousel</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Columns</label>
                                <input
                                  type="number"
                                  value={section.layout.columns}
                                  onChange={(e) => updateSection(section.sectionId, { layout: { ...section.layout, columns: parseInt(e.target.value) } })}
                                  className="w-full px-3 py-2 border rounded-lg text-sm"
                                  min="1"
                                  max="6"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Items to Show</label>
                                <input
                                  type="number"
                                  value={section.layout.itemsToShow}
                                  onChange={(e) => updateSection(section.sectionId, { layout: { ...section.layout, itemsToShow: parseInt(e.target.value) } })}
                                  className="w-full px-3 py-2 border rounded-lg text-sm"
                                  min="1"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Spacing (px)</label>
                                <input
                                  type="number"
                                  value={section.layout.spacing}
                                  onChange={(e) => updateSection(section.sectionId, { layout: { ...section.layout, spacing: parseInt(e.target.value) } })}
                                  className="w-full px-3 py-2 border rounded-lg text-sm"
                                  min="0"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Card Style */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-3">Card Options</h4>
                            <div className="flex flex-wrap gap-4">
                              {Object.entries({
                                showImage: 'Show Image',
                                showTitle: 'Show Title',
                                showSubtitle: 'Show Subtitle',
                                showPrice: 'Show Price',
                                showRating: 'Show Rating',
                                showBadge: 'Show Badge',
                              }).map(([key, label]) => (
                                <label key={key} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={(section.cardStyle as any)[key]}
                                    onChange={(e) => updateSection(section.sectionId, {
                                      cardStyle: { ...section.cardStyle, [key]: e.target.checked }
                                    })}
                                    className="h-4 w-4 text-indigo-600 rounded"
                                  />
                                  <span className="text-sm">{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* View All */}
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={section.showViewAll}
                                onChange={(e) => updateSection(section.sectionId, { showViewAll: e.target.checked })}
                                className="h-4 w-4 text-indigo-600 rounded"
                              />
                              <span className="text-sm">Show "View All" Link</span>
                            </label>
                            {section.showViewAll && (
                              <input
                                type="text"
                                value={section.viewAllTarget}
                                onChange={(e) => updateSection(section.sectionId, { viewAllTarget: e.target.value })}
                                className="flex-1 px-3 py-2 border rounded-lg text-sm"
                                placeholder="Target route (e.g., /services)"
                              />
                            )}
                          </div>

                          {/* Spacing */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-3">Spacing</h4>
                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Margin Top</label>
                                <input
                                  type="number"
                                  value={section.style.marginTop}
                                  onChange={(e) => updateSection(section.sectionId, {
                                    style: { ...section.style, marginTop: parseInt(e.target.value) }
                                  })}
                                  className="w-full px-3 py-2 border rounded-lg text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Margin Bottom</label>
                                <input
                                  type="number"
                                  value={section.style.marginBottom}
                                  onChange={(e) => updateSection(section.sectionId, {
                                    style: { ...section.style, marginBottom: parseInt(e.target.value) }
                                  })}
                                  className="w-full px-3 py-2 border rounded-lg text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Padding H</label>
                                <input
                                  type="number"
                                  value={section.style.paddingHorizontal}
                                  onChange={(e) => updateSection(section.sectionId, {
                                    style: { ...section.style, paddingHorizontal: parseInt(e.target.value) }
                                  })}
                                  className="w-full px-3 py-2 border rounded-lg text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Background</label>
                                <input
                                  type="text"
                                  value={section.style.backgroundColor}
                                  onChange={(e) => updateSection(section.sectionId, {
                                    style: { ...section.style, backgroundColor: e.target.value }
                                  })}
                                  className="w-full px-3 py-2 border rounded-lg text-sm"
                                  placeholder="transparent"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Add Section Button */}
              <div className="relative">
                <button
                  onClick={() => setShowAddSection(!showAddSection)}
                  className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-500 hover:text-indigo-500 flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Add Section
                </button>

                {/* Add Section Dropdown */}
                {showAddSection && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
                    <div className="p-2 grid grid-cols-2 gap-1">
                      {SECTION_TYPES.map(type => (
                        <button
                          key={type.value}
                          onClick={() => addSection(type.value)}
                          className="flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 rounded-lg"
                        >
                          <span className="text-lg">{type.icon}</span>
                          <span className="text-sm">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Layout className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>Select a screen to edit its layout</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LayoutEditor;
