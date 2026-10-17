// src/pages/SDUI/LayoutEditorPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout,
  Plus,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  Eye,
  Upload,
  Smartphone,
  Undo,
  History,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import SectionCard from '../../components/SDUI/SectionCard';
import SectionConfigPanel from '../../components/SDUI/SectionConfigPanel';
import AddSectionModal from '../../components/SDUI/AddSectionModal';
import { sduiLayoutApi, SDUILayout, SDUISection, SECTION_TYPES } from '../../lib/sduiApi';

// ==================== SORTABLE SECTION WRAPPER ====================
const SortableSectionItem: React.FC<{
  section: SDUISection;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onConfigure: () => void;
  onDelete: () => void;
}> = ({ section, index, isExpanded, onToggleExpand, onToggleEnabled, onConfigure, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.sectionId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SectionCard
        section={section}
        index={index}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        onToggleEnabled={onToggleEnabled}
        onConfigure={onConfigure}
        onDelete={onDelete}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
const LayoutEditorPage: React.FC = () => {
  // State
  const [layout, setLayout] = useState<SDUILayout | null>(null);
  const [sections, setSections] = useState<SDUISection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // UI State
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [configSection, setConfigSection] = useState<SDUISection | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPage, setSelectedPage] = useState('home');

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ==================== FETCH LAYOUT ====================
  const fetchLayout = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await sduiLayoutApi.getByPage(selectedPage);

      if (response.success && response.data) {
        setLayout(response.data);
        setSections(response.data.sections || []);
        setHasChanges(false);
      }
    } catch (err: any) {
      console.error('Error fetching layout:', err);
      setError(err.message || 'Failed to fetch layout');
    } finally {
      setLoading(false);
    }
  }, [selectedPage]);

  useEffect(() => {
    fetchLayout();
  }, [fetchLayout]);

  // Auto-hide success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // ==================== HANDLERS ====================

  // Toggle section expand
  const handleToggleExpand = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Toggle section enabled
  const handleToggleEnabled = async (sectionId: string) => {
    const section = sections.find(s => s.sectionId === sectionId);
    if (!section || !layout) return;

    const newEnabled = !section.enabled;

    // Optimistic update
    setSections(prev => prev.map(s => 
      s.sectionId === sectionId ? { ...s, enabled: newEnabled } : s
    ));
    setHasChanges(true);

    try {
      await sduiLayoutApi.toggleSection(layout._id, sectionId, newEnabled);
      setSuccessMessage(newEnabled ? 'Section enabled!' : 'Section hidden!');
    } catch (err: any) {
      console.error('Error toggling section:', err);
      // Revert on error
      setSections(prev => prev.map(s => 
        s.sectionId === sectionId ? { ...s, enabled: section.enabled } : s
      ));
      setError('Failed to toggle section');
    }
  };

  // Delete section
  const handleDeleteSection = async (sectionId: string) => {
    const section = sections.find(s => s.sectionId === sectionId);
    if (!section || !layout) return;

    const sectionType = SECTION_TYPES.find(t => t.value === section.type);
    const sectionName = sectionType?.label || section.type;

    if (!window.confirm(`Are you sure you want to delete the "${sectionName}" section?`)) {
      return;
    }

    // Optimistic update
    const prevSections = [...sections];
    setSections(prev => prev.filter(s => s.sectionId !== sectionId));
    setHasChanges(true);

    try {
      await sduiLayoutApi.deleteSection(layout._id, sectionId);
      setSuccessMessage('Section deleted!');
    } catch (err: any) {
      console.error('Error deleting section:', err);
      // Revert on error
      setSections(prevSections);
      setError('Failed to delete section');
    }
  };

  // Configure section
  const handleConfigureSection = (sectionId: string) => {
    const section = sections.find(s => s.sectionId === sectionId);
    if (section) {
      setConfigSection(section);
    }
  };

  // Save section config
  const handleSaveConfig = async (config: Partial<SDUISection>) => {
    if (!configSection || !layout) return;

    try {
      setSaving(true);
      
      await sduiLayoutApi.updateSectionConfig(layout._id, configSection.sectionId, config);
      
      // Update local state
      setSections(prev => prev.map(s => 
        s.sectionId === configSection.sectionId ? { ...s, ...config } : s
      ));
      
      setSuccessMessage('Section configuration saved!');
      setConfigSection(null);
      setHasChanges(true);
    } catch (err: any) {
      console.error('Error saving config:', err);
      setError('Failed to save section configuration');
    } finally {
      setSaving(false);
    }
  };

  // Add new section
  const handleAddSection = async (sectionType: string) => {
    if (!layout) return;

    const typeConfig = SECTION_TYPES.find(t => t.value === sectionType);

    const newSection: Partial<SDUISection> = {
      type: sectionType,
      enabled: true,
      order: sections.length,
      title: typeConfig?.label || '',
      subtitle: '',
      showViewAll: false,
      viewAllTarget: '',
      dataSource: typeConfig?.dataSource || '',
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
      visibility: {
        requireAuth: false,
        newUsersOnly: false,
        platforms: ['all'],
        minAppVersion: '',
      },
      customData: {},
    };

    try {
      const response = await sduiLayoutApi.addSection(layout._id, newSection);
      
      if (response.success && response.data) {
        setSections(prev => [...prev, response.data]);
        setSuccessMessage('Section added!');
        setHasChanges(true);
      }
    } catch (err: any) {
      console.error('Error adding section:', err);
      setError('Failed to add section');
    } finally {
      setShowAddModal(false);
    }
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !layout) return;

    const oldIndex = sections.findIndex(s => s.sectionId === active.id);
    const newIndex = sections.findIndex(s => s.sectionId === over.id);

    const newSections = arrayMove(sections, oldIndex, newIndex).map((section, index) => ({
      ...section,
      order: index,
    }));

    setSections(newSections);
    setHasChanges(true);

    try {
      const reorderData = newSections.map((section, index) => ({
        sectionId: section.sectionId,
        order: index,
      }));

      await sduiLayoutApi.reorderSections(layout._id, reorderData);
      setSuccessMessage('Sections reordered!');
    } catch (err: any) {
      console.error('Error reordering sections:', err);
      setError('Failed to save new order');
      // Revert on error
      fetchLayout();
    }
  };

  // Save draft
  const handleSaveDraft = async () => {
    if (!layout) return;

    try {
      setSaving(true);
      
      await sduiLayoutApi.saveDraft(layout._id, {
        sections,
        settings: layout.settings,
      });
      
      setSuccessMessage('Draft saved!');
      setHasChanges(false);
    } catch (err: any) {
      console.error('Error saving draft:', err);
      setError('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  // Publish layout
  const handlePublish = async () => {
    if (!layout) return;

    if (!window.confirm('Are you sure you want to publish these changes? They will be visible to all users immediately.')) {
      return;
    }

    try {
      setPublishing(true);
      
      // First, update sections
      await sduiLayoutApi.updateSections(layout._id, sections);
      
      // Then publish
      const response = await sduiLayoutApi.publish(layout._id, 'Published via admin panel');
      
      if (response.success && response.data) {
        setLayout(response.data);
        setSuccessMessage('Layout published successfully! 🎉');
        setHasChanges(false);
      }
    } catch (err: any) {
      console.error('Error publishing layout:', err);
      setError('Failed to publish layout');
    } finally {
      setPublishing(false);
    }
  };

  // Reset changes
  const handleReset = () => {
    if (!window.confirm('Are you sure you want to discard all unsaved changes?')) {
      return;
    }

    fetchLayout();
    setHasChanges(false);
    setSuccessMessage('Changes discarded');
  };

  // Page options
  const pageOptions = [
    { value: 'home', label: 'Home Page', icon: '🏠' },
    { value: 'services', label: 'Services Page', icon: '🔧' },
    { value: 'categories', label: 'Categories Page', icon: '📦' },
  ];

  // Stats
  const enabledCount = sections.filter(s => s.enabled).length;
  const totalCount = sections.length;

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* ==================== HEADER ==================== */}
      <div className="bg-white/80 backdrop-blur-md border-b border-white/50 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/25">
                <Layout className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Layout Editor
                </h1>
                <p className="text-sm text-gray-500">
                  Customize your mobile app's page layout
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Page Selector */}
              <select
                value={selectedPage}
                onChange={(e) => setSelectedPage(e.target.value)}
                className="px-4 py-2.5 bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              >
                {pageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>

              {/* Actions */}
              {hasChanges && (
                <button
                  onClick={handleReset}
                  className="px-4 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all flex items-center gap-2"
                >
                  <Undo className="w-4 h-4" />
                  Discard
                </button>
              )}

              <button
                onClick={handleSaveDraft}
                disabled={saving || !hasChanges}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all flex items-center gap-2 disabled:opacity-50 font-medium"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Draft
              </button>

              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/25 font-medium"
              >
                {publishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Publish
              </button>
            </div>
          </div>

          {/* Unsaved changes indicator */}
          {hasChanges && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg w-fit">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              You have unsaved changes
            </div>
          )}
        </div>
      </div>

      {/* ==================== CONTENT ==================== */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ==================== SECTIONS LIST (Left) ==================== */}
          <div className="lg:col-span-2">
            {/* Stats Bar */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-5 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-gray-900">{totalCount}</p>
                    <p className="text-sm text-gray-500">Total</p>
                  </div>
                  <div className="w-px h-12 bg-gray-200" />
                  <div className="text-center">
                    <p className="text-3xl font-bold text-emerald-600">{enabledCount}</p>
                    <p className="text-sm text-gray-500">Visible</p>
                  </div>
                  <div className="w-px h-12 bg-gray-200" />
                  <div className="text-center">
                    <p className="text-3xl font-bold text-gray-400">{totalCount - enabledCount}</p>
                    <p className="text-sm text-gray-500">Hidden</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={fetchLayout}
                    disabled={loading}
                    className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/25"
                  >
                    <Plus className="w-4 h-4" />
                    Add Section
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
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

            {/* Sections List */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 border-4 border-indigo-200 rounded-full animate-spin border-t-indigo-600"></div>
                <p className="mt-4 text-gray-500 font-medium">Loading layout...</p>
              </div>
            ) : sections.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-16 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Layers className="w-10 h-10 text-indigo-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No sections yet</h3>
                <p className="text-gray-500 mb-8">
                  Add sections to build your page layout
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all inline-flex items-center gap-2 shadow-lg shadow-indigo-500/25"
                >
                  <Plus className="w-5 h-5" />
                  Add First Section
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Drag sections to reorder • Click ⚙️ to configure
                </p>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={sections.map(s => s.sectionId)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4">
                      {sections.map((section, index) => (
                        <SortableSectionItem
                          key={section.sectionId}
                          section={section}
                          index={index}
                          isExpanded={expandedSections.has(section.sectionId)}
                          onToggleExpand={() => handleToggleExpand(section.sectionId)}
                          onToggleEnabled={() => handleToggleEnabled(section.sectionId)}
                          onConfigure={() => handleConfigureSection(section.sectionId)}
                          onDelete={() => handleDeleteSection(section.sectionId)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            )}
          </div>

          {/* ==================== PREVIEW PANEL (Right) ==================== */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg overflow-hidden">
                <div className="p-4 border-b bg-gradient-to-r from-gray-50 to-gray-100/50">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      Preview
                    </h3>
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-lg">
                      {selectedPage.charAt(0).toUpperCase() + selectedPage.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Phone Frame Preview */}
                <div className="p-4 bg-gradient-to-b from-gray-100 to-gray-200">
                  <div className="mx-auto w-[260px] bg-gray-900 rounded-[36px] shadow-2xl overflow-hidden p-2">
                    <div className="bg-white rounded-[28px] overflow-hidden">
                      {/* Phone Notch */}
                      <div className="h-6 bg-gray-900 flex items-center justify-center">
                        <div className="w-16 h-4 bg-black rounded-full" />
                      </div>

                      {/* Screen Content */}
                      <div className="h-[450px] overflow-y-auto bg-gray-50">
                        {sections.filter(s => s.enabled).length === 0 ? (
                          <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4 text-center">
                            <div>
                              <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              No visible sections
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 space-y-3">
                            {sections
                              .filter(s => s.enabled)
                              .sort((a, b) => a.order - b.order)
                              .map((section) => {
                                const sectionType = SECTION_TYPES.find(t => t.value === section.type);
                                return (
                                  <div
                                    key={section.sectionId}
                                    className="bg-white rounded-xl p-3 shadow-sm border border-gray-100"
                                  >
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-lg">{sectionType?.icon || '📦'}</span>
                                      <span className="text-xs font-medium text-gray-700 truncate">
                                        {section.title || sectionType?.label || section.type}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                      {Array.from({ length: Math.min(section.layout?.itemsToShow || 4, 4) }).map((_, i) => (
                                        <div
                                          key={i}
                                          className="h-6 bg-gradient-to-r from-gray-100 to-gray-200 rounded animate-pulse"
                                        />
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>

                      {/* Phone Home Indicator */}
                      <div className="h-5 bg-white flex items-center justify-center">
                        <div className="w-20 h-1 bg-gray-300 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Layout Info */}
                {layout && (
                  <div className="p-4 border-t bg-gray-50/50 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-gray-500">Version:</span>
                        <span className="ml-1 font-semibold">v{layout.version}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <span className={`ml-1 font-semibold ${layout.isPublished ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {layout.isPublished ? '✓ Live' : '○ Draft'}
                        </span>
                      </div>
                    </div>
                    {layout.publishedAt && (
                      <div className="mt-2 text-gray-500 text-xs">
                        Last published: {new Date(layout.publishedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Version History */}
              {layout?.publishHistory && layout.publishHistory.length > 0 && (
                <div className="mt-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg overflow-hidden">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Version History
                    </h3>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {layout.publishHistory.slice(-5).reverse().map((entry, index) => (
                      <div key={index} className="p-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">v{entry.version}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(entry.publishedAt).toLocaleDateString()}
                          </span>
                        </div>
                        {entry.changes && (
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {entry.changes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== MODALS ==================== */}

      {/* Section Config Modal */}
      {configSection && (
        <SectionConfigPanel
          section={configSection}
          onSave={handleSaveConfig}
          onClose={() => setConfigSection(null)}
          isLoading={saving}
        />
      )}

      {/* Add Section Modal */}
      {showAddModal && (
        <AddSectionModal
          onAdd={handleAddSection}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
};

export default LayoutEditorPage;