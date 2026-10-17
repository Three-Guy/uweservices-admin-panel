// src/pages/SDUI/TrendingPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  RefreshCw, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  Zap,
  Flame,
  BarChart3,
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

import TrendingCard from '../../components/SDUI/TrendingCard';
import TrendingForm from '../../components/SDUI/TrendingForm';
import { sduiTrendingApi, SDUITrendingService } from '../../lib/sduiApi';

// Sortable Trending Item wrapper
const SortableTrendingItem: React.FC<{
  trending: SDUITrendingService;
  index: number;
  onEdit: (trending: SDUITrendingService) => void;
  onDelete: (trending: SDUITrendingService) => void;
  onToggleStatus: (trending: SDUITrendingService) => void;
}> = ({ trending, index, onEdit, onDelete, onToggleStatus }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: trending._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TrendingCard
        trending={trending}
        index={index}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleStatus={onToggleStatus}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
};

const TrendingPage: React.FC = () => {
  const [trendingServices, setTrendingServices] = useState<SDUITrendingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingTrending, setEditingTrending] = useState<SDUITrendingService | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch trending services
  const fetchTrendingServices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await sduiTrendingApi.getAll();

      if (response.success) {
        setTrendingServices(response.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching trending services:', err);
      setError(err.message || 'Failed to fetch trending services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrendingServices();
  }, [fetchTrendingServices]);

  // Auto-hide success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Handle form submit
  const handleSubmit = async (data: Partial<SDUITrendingService>) => {
    try {
      setSaving(true);
      setError(null);

      let response;
      if (editingTrending) {
        response = await sduiTrendingApi.update(editingTrending._id, data);
      } else {
        response = await sduiTrendingApi.create(data);
      }

      if (response.success) {
        setSuccessMessage(
          editingTrending ? 'Trending service updated!' : 'Added to trending successfully!'
        );
        setShowForm(false);
        setEditingTrending(null);
        fetchTrendingServices();
      }
    } catch (err: any) {
      console.error('Error saving trending service:', err);
      setError(err.message || 'Failed to save trending service');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (trending: SDUITrendingService) => {
    if (!window.confirm(`Remove "${trending.name}" from trending?`)) {
      return;
    }

    try {
      setSaving(true);
      const response = await sduiTrendingApi.delete(trending._id);

      if (response.success) {
        setSuccessMessage('Removed from trending successfully!');
        fetchTrendingServices();
      }
    } catch (err: any) {
      console.error('Error deleting trending service:', err);
      setError(err.message || 'Failed to remove from trending');
    } finally {
      setSaving(false);
    }
  };

  // Handle toggle status
  const handleToggleStatus = async (trending: SDUITrendingService) => {
    try {
      const response = await sduiTrendingApi.update(trending._id, {
        isActive: !trending.isActive,
      });

      if (response.success) {
        setSuccessMessage(
          trending.isActive ? 'Deactivated!' : 'Activated!'
        );
        fetchTrendingServices();
      }
    } catch (err: any) {
      console.error('Error toggling status:', err);
      setError(err.message || 'Failed to toggle status');
    }
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = trendingServices.findIndex((t) => t._id === active.id);
    const newIndex = trendingServices.findIndex((t) => t._id === over.id);

    const newTrending = arrayMove(trendingServices, oldIndex, newIndex);
    setTrendingServices(newTrending);

    try {
      const reordered = newTrending.map((trending, index) => ({
        id: trending._id,
        sortOrder: index,
      }));

      await sduiTrendingApi.reorder(reordered);
      setSuccessMessage('Trending order updated!');
    } catch (err: any) {
      console.error('Error reordering trending:', err);
      setError('Failed to save new order');
      fetchTrendingServices();
    }
  };

  // Sync stats from real bookings
  const handleSyncStats = async () => {
    try {
      setSyncing(true);
      const response = await sduiTrendingApi.syncStats();

      if (response.success) {
        setSuccessMessage('Stats synced successfully!');
        fetchTrendingServices();
      }
    } catch (err: any) {
      console.error('Error syncing stats:', err);
      setError(err.message || 'Failed to sync stats');
    } finally {
      setSyncing(false);
    }
  };

  // Stats
  const activeCount = trendingServices.filter(t => t.isActive).length;
  const totalBookings = trendingServices.reduce((sum, t) => sum + (t.bookingsToday || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-red-50">
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg shadow-orange-500/25">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent flex items-center gap-2">
                  Trending Services
                  <Flame className="w-7 h-7 text-orange-500" />
                </h1>
                <p className="text-gray-500 mt-1">
                  Showcase popular services with live booking stats
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSyncStats}
                disabled={syncing}
                className="px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-300 flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 text-blue-500" />
                    Sync Stats
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setEditingTrending(null);
                  setShowForm(true);
                }}
                className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-300 flex items-center gap-2 shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5"
              >
                <Plus className="w-5 h-5" />
                Add Trending
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{trendingServices.length}</p>
                  <p className="text-sm text-gray-500 font-medium">Total Trending</p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl">
                  <Sparkles className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-emerald-600">{activeCount}</p>
                  <p className="text-sm text-gray-500 font-medium">Active / Visible</p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-blue-600">{totalBookings}</p>
                  <p className="text-sm text-gray-500 font-medium">Today's Bookings</p>
                </div>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-5 border border-orange-200/50 mt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Flame className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">About Trending Services</h3>
                <p className="text-sm text-gray-600">
                  Trending services appear on the home page with live booking stats. Drag to reorder them. 
                  <span className="font-medium text-orange-600"> Max 5 services</span> are shown to users. 
                  You can auto-sync stats from real bookings or set them manually.
                </p>
              </div>
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
            <button 
              onClick={() => setError(null)}
              className="p-1 hover:bg-red-100 rounded-lg transition-colors"
            >
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
            <button 
              onClick={() => setSuccessMessage(null)}
              className="p-1 hover:bg-emerald-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Trending List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-orange-200 rounded-full animate-spin border-t-orange-600"></div>
            </div>
            <p className="mt-4 text-gray-500 font-medium">Loading trending services...</p>
          </div>
        ) : trendingServices.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-16 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <TrendingUp className="w-10 h-10 text-orange-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No trending services yet</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Add services to showcase them on the home page with live stats
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-8 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-300 inline-flex items-center gap-2 shadow-lg shadow-orange-500/25"
            >
              <Plus className="w-5 h-5" />
              Add First Trending Service
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                Drag services to reorder • Changes are saved automatically
              </p>
              <button
                onClick={fetchTrendingServices}
                className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-2 font-medium px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={trendingServices.map((t) => t._id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {trendingServices.map((trending, index) => (
                    <SortableTrendingItem
                      key={trending._id}
                      trending={trending}
                      index={index}
                      onEdit={(t) => {
                        setEditingTrending(t);
                        setShowForm(true);
                      }}
                      onDelete={handleDelete}
                      onToggleStatus={handleToggleStatus}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {trendingServices.length > 5 && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">Note:</span> You have {trendingServices.length} trending services, but only the <span className="font-semibold">top 5</span> will be shown to users on the home page.
                </p>
              </div>
            )}
          </>
        )}

        {/* Form Modal */}
        {showForm && (
          <TrendingForm
            trending={editingTrending}
            onSubmit={handleSubmit}
            onClose={() => {
              setShowForm(false);
              setEditingTrending(null);
            }}
            isLoading={saving}
          />
        )}
      </div>
    </div>
  );
};

export default TrendingPage;