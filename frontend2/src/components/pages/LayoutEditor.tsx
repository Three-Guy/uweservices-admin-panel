import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, GripVertical, Eye, Settings } from 'lucide-react';

interface LayoutSection {
  id: string;
  type: string;
  title: string;
  config: Record<string, any>;
  sortOrder: number;
  isVisible: boolean;
}

interface Layout {
  _id: string;
  name: string;
  screenType: string;
  sections: LayoutSection[];
  isActive: boolean;
}

const SECTION_TYPES = [
  { value: 'banner_carousel', label: 'Banner Carousel' },
  { value: 'category_grid', label: 'Category Grid' },
  { value: 'service_list', label: 'Service List' },
  { value: 'featured_services', label: 'Featured Services' },
  { value: 'popular_services', label: 'Popular Services' },
  { value: 'offers', label: 'Special Offers' },
  { value: 'testimonials', label: 'Testimonials' },
];

const LayoutEditor: React.FC = () => {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [selectedLayout, setSelectedLayout] = useState<Layout | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchLayouts();
  }, []);

  const fetchLayouts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/sdui/layouts`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setLayouts(data.data || []);
        if (data.data?.length > 0 && !selectedLayout) {
          setSelectedLayout(data.data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching layouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveLayout = async () => {
    if (!selectedLayout) return;
    
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/sdui/layouts/${selectedLayout._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(selectedLayout),
      });

      const data = await response.json();
      if (data.success) {
        alert('Layout saved successfully!');
        fetchLayouts();
      } else {
        alert(data.message || 'Error saving layout');
      }
    } catch (error) {
      console.error('Error saving layout:', error);
    } finally {
      setSaving(false);
    }
  };

  const addSection = () => {
    if (!selectedLayout) return;
    
    const newSection: LayoutSection = {
      id: `section_${Date.now()}`,
      type: 'service_list',
      title: 'New Section',
      config: {},
      sortOrder: selectedLayout.sections.length,
      isVisible: true,
    };

    setSelectedLayout({
      ...selectedLayout,
      sections: [...selectedLayout.sections, newSection],
    });
  };

  const removeSection = (sectionId: string) => {
    if (!selectedLayout) return;
    
    setSelectedLayout({
      ...selectedLayout,
      sections: selectedLayout.sections.filter(s => s.id !== sectionId),
    });
  };

  const updateSection = (sectionId: string, updates: Partial<LayoutSection>) => {
    if (!selectedLayout) return;
    
    setSelectedLayout({
      ...selectedLayout,
      sections: selectedLayout.sections.map(s =>
        s.id === sectionId ? { ...s, ...updates } : s
      ),
    });
  };

  const toggleSectionVisibility = (sectionId: string) => {
    if (!selectedLayout) return;
    
    setSelectedLayout({
      ...selectedLayout,
      sections: selectedLayout.sections.map(s =>
        s.id === sectionId ? { ...s, isVisible: !s.isVisible } : s
      ),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Layout Editor</h1>
        <p className="text-gray-600">Configure screen layouts for the mobile app</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Layout List */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-900 mb-4">Screens</h2>
          <div className="space-y-2">
            {layouts.map(layout => (
              <button
                key={layout._id}
                onClick={() => setSelectedLayout(layout)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedLayout?._id === layout._id
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className="font-medium">{layout.name}</div>
                <div className="text-xs text-gray-500">{layout.screenType}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Layout Editor */}
        <div className="lg:col-span-3">
          {selectedLayout ? (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b flex justify-between items-center">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedLayout.name}</h2>
                  <p className="text-sm text-gray-500">{selectedLayout.sections.length} sections</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addSection}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    <Plus className="w-4 h-4" />
                    Add Section
                  </button>
                  <button
                    onClick={saveLayout}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Layout'}
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {selectedLayout.sections.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No sections. Click "Add Section" to get started.
                  </div>
                ) : (
                  selectedLayout.sections.map((section, index) => (
                    <div
                      key={section.id}
                      className={`border rounded-lg p-4 ${
                        section.isVisible ? 'bg-white' : 'bg-gray-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="cursor-grab text-gray-400 mt-1">
                          <GripVertical className="w-5 h-5" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-1">Section Title</label>
                              <input
                                type="text"
                                value={section.title}
                                onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                            <div className="w-48">
                              <label className="block text-xs text-gray-500 mb-1">Section Type</label>
                              <select
                                value={section.type}
                                onChange={(e) => updateSection(section.id, { type: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              >
                                {SECTION_TYPES.map(type => (
                                  <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleSectionVisibility(section.id)}
                            className={`p-2 rounded ${section.isVisible ? 'text-green-600' : 'text-gray-400'}`}
                            title={section.isVisible ? 'Visible' : 'Hidden'}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeSection(section.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
              Select a layout from the list to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LayoutEditor;