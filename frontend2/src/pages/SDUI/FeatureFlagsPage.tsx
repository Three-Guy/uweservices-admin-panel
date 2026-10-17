// src/pages/SDUI/FeatureFlagsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  ToggleLeft,
  AlertCircle,
  CheckCircle,
  X,
  Filter,
  Sparkles,
  Flag,
  Zap,
  Clock,
  Users,
  Globe,
  MoreVertical,
  Copy,
  Trash2,
  History,
  ChevronDown,
} from 'lucide-react';
import FeatureFlagCard from '../../components/SDUI/FeatureFlagCard';
import FeatureFlagForm from '../../components/SDUI/FeatureFlagForm';
import FeatureFlagHistoryModal from '../../components/SDUI/FeatureFlagHistoryModal';
import {
  sduiFeatureFlagApi,
  SDUIFeatureFlag,
  FeatureFlagStats,
  FeatureFlagFilters,
  FEATURE_FLAG_CATEGORIES,
  FEATURE_FLAG_ENVIRONMENTS,
} from '../../lib/sduiApi';

const FeatureFlagsPage: React.FC = () => {
  // State
  const [flags, setFlags] = useState<SDUIFeatureFlag[]>([]);
  const [stats, setStats] = useState<FeatureFlagStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingFlag, setEditingFlag] = useState<SDUIFeatureFlag | null>(null);

  // History modal
  const [showHistory, setShowHistory] = useState(false);
  const [historyFlagId, setHistoryFlagId] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<FeatureFlagFilters>({
    search: '',
    category: '',
    enabled: '',
    environment: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Selection for bulk actions
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);

  // Fetch flags
  const fetchFlags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: FeatureFlagFilters = { ...filters };
      // Remove empty params
      Object.keys(params).forEach(key => {
        if (!params[key as keyof FeatureFlagFilters]) {
          delete params[key as keyof FeatureFlagFilters];
        }
      });

      const [flagsResponse, statsResponse] = await Promise.all([
        sduiFeatureFlagApi.getAll(params),
        sduiFeatureFlagApi.getStats(),
      ]);

      if (flagsResponse.success) {
        setFlags(flagsResponse.data || []);
      }

      if (statsResponse.success) {
        setStats(statsResponse.data);
      }
    } catch (err: any) {
      console.error('Error fetching feature flags:', err);
      setError(err.message || 'Failed to fetch feature flags');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  // Auto-hide messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Handle form submit
  const handleSubmit = async (data: Partial<SDUIFeatureFlag>) => {
    try {
      setSaving(true);
      setError(null);

      let response;
      if (editingFlag) {
        response = await sduiFeatureFlagApi.update(editingFlag._id, data);
      } else {
        response = await sduiFeatureFlagApi.create(data);
      }

      if (response.success) {
        setSuccessMessage(
          editingFlag ? 'Feature flag updated successfully!' : 'Feature flag created successfully!'
        );
        setShowForm(false);
        setEditingFlag(null);
        fetchFlags();
      }
    } catch (err: any) {
      console.error('Error saving feature flag:', err);
      setError(err.response?.data?.message || err.message || 'Failed to save feature flag');
    } finally {
      setSaving(false);
    }
  };

  // Handle toggle
  const handleToggle = async (flag: SDUIFeatureFlag) => {
    try {
      const response = await sduiFeatureFlagApi.toggle(flag._id, !flag.enabled);

      if (response.success) {
        setSuccessMessage(`Feature flag ${!flag.enabled ? 'enabled' : 'disabled'}!`);
        fetchFlags();
      }
    } catch (err: any) {
      console.error('Error toggling flag:', err);
      setError(err.message || 'Failed to toggle feature flag');
    }
  };

  // Handle delete
  const handleDelete = async (flag: SDUIFeatureFlag) => {
    if (!window.confirm(`Are you sure you want to delete "${flag.name}"?`)) {
      return;
    }

    try {
      setSaving(true);
      const response = await sduiFeatureFlagApi.delete(flag._id);

      if (response.success) {
        setSuccessMessage('Feature flag deleted successfully!');
        fetchFlags();
      }
    } catch (err: any) {
      console.error('Error deleting flag:', err);
      setError(err.message || 'Failed to delete feature flag');
    } finally {
      setSaving(false);
    }
  };

  // Handle duplicate
  const handleDuplicate = async (flag: SDUIFeatureFlag) => {
    try {
      setSaving(true);
      const response = await sduiFeatureFlagApi.duplicate(flag._id);

      if (response.success) {
        setSuccessMessage('Feature flag duplicated successfully!');
        fetchFlags();
      }
    } catch (err: any) {
      console.error('Error duplicating flag:', err);
      setError(err.message || 'Failed to duplicate feature flag');
    } finally {
      setSaving(false);
    }
  };

  // Handle bulk toggle
  const handleBulkToggle = async (enabled: boolean) => {
    if (selectedFlags.length === 0) return;

    try {
      setSaving(true);
      const response = await sduiFeatureFlagApi.bulkToggle(selectedFlags, enabled);

      if (response.success) {
        setSuccessMessage(`${response.data.modifiedCount} flag(s) ${enabled ? 'enabled' : 'disabled'}!`);
        setSelectedFlags([]);
        fetchFlags();
      }
    } catch (err: any) {
      console.error('Error bulk toggling flags:', err);
      setError(err.message || 'Failed to bulk toggle flags');
    } finally {
      setSaving(false);
    }
  };

  // View history
  const handleViewHistory = (flag: SDUIFeatureFlag) => {
    setHistoryFlagId(flag._id);
    setShowHistory(true);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      search: '',
      category: '',
      enabled: '',
      environment: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

  const hasFilters = filters.search || filters.category || filters.enabled || filters.environment;

  // Toggle selection
  const toggleSelection = (flagId: string) => {
    setSelectedFlags(prev =>
      prev.includes(flagId)
        ? prev.filter(id => id !== flagId)
        : [...prev, flagId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedFlags.length === flags.length) {
      setSelectedFlags([]);
    } else {
      setSelectedFlags(flags.map(f => f._id));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg shadow-purple-500/25">
                <Flag className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Feature Flags
                </h1>
                <p className="text-gray-500 mt-1">
                  Control feature rollouts and experiments in real-time
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingFlag(null);
                setShowForm(true);
              }}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 flex items-center gap-2 shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5"
            >
              <Plus className="w-5 h-5" />
              Create Flag
            </button>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl">
                    <Flag className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalFlags}</p>
                    <p className="text-sm text-gray-500 font-medium">Total Flags</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl">
                    <Zap className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-emerald-600">{stats.enabledFlags}</p>
                    <p className="text-sm text-gray-500 font-medium">Enabled</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl">
                    <ToggleLeft className="w-6 h-6 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-500">{stats.disabledFlags}</p>
                    <p className="text-sm text-gray-500 font-medium">Disabled</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl">
                    <Clock className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-amber-600">{stats.scheduledFlags}</p>
                    <p className="text-sm text-gray-500 font-medium">Scheduled</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-5 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by key, name, or description..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-12 pr-4 py-3 bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
            </div>

            {/* Category Filter */}
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="px-4 py-3 bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all min-w-[150px]"
            >
              <option value="">All Categories</option>
              {FEATURE_FLAG_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filters.enabled}
              onChange={(e) => setFilters(prev => ({ ...prev, enabled: e.target.value }))}
              className="px-4 py-3 bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all min-w-[130px]"
            >
              <option value="">All Status</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>

            {/* Environment Filter */}
            <select
              value={filters.environment}
              onChange={(e) => setFilters(prev => ({ ...prev, environment: e.target.value }))}
              className="px-4 py-3 bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all min-w-[150px]"
            >
              <option value="">All Environments</option>
              {FEATURE_FLAG_ENVIRONMENTS.map(env => (
                <option key={env.value} value={env.value}>{env.label}</option>
              ))}
            </select>

            {/* Refresh Button */}
            <button
              onClick={fetchFlags}
              disabled={loading}
              className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Active Filters & Bulk Actions */}
          {(hasFilters || selectedFlags.length > 0) && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-3">
                {hasFilters && (
                  <>
                    <span className="text-sm text-gray-500">
                      <Sparkles className="w-4 h-4 inline mr-1" />
                      {flags.length} result(s) found
                    </span>
                    <button
                      onClick={clearFilters}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      Clear filters
                    </button>
                  </>
                )}
              </div>

              {/* Bulk Actions */}
              {selectedFlags.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 font-medium">
                    {selectedFlags.length} selected
                  </span>
                  <button
                    onClick={() => handleBulkToggle(true)}
                    className="px-3 py-1.5 text-sm bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors font-medium"
                  >
                    Enable All
                  </button>
                  <button
                    onClick={() => handleBulkToggle(false)}
                    className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    Disable All
                  </button>
                  <button
                    onClick={() => setSelectedFlags([])}
                    className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}
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

        {/* Flags List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-purple-200 rounded-full animate-spin border-t-purple-600"></div>
            </div>
            <p className="mt-4 text-gray-500 font-medium">Loading feature flags...</p>
          </div>
        ) : flags.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-16 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Flag className="w-10 h-10 text-purple-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No feature flags yet</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              {hasFilters
                ? 'No flags match your filters. Try adjusting your search criteria.'
                : 'Create your first feature flag to control feature rollouts and experiments.'}
            </p>
            {hasFilters ? (
              <button
                onClick={clearFilters}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
              >
                Clear Filters
              </button>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 inline-flex items-center gap-2 shadow-lg shadow-purple-500/25"
              >
                <Plus className="w-5 h-5" />
                Create First Flag
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Select All */}
            <div className="mb-4 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFlags.length === flags.length && flags.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-600">Select all</span>
              </label>
              <span className="text-sm text-gray-400">
                {flags.length} flag(s)
              </span>
            </div>

            {/* Flags Grid */}
            <div className="space-y-4">
              {flags.map((flag) => (
                <FeatureFlagCard
                  key={flag._id}
                  flag={flag}
                  isSelected={selectedFlags.includes(flag._id)}
                  onSelect={() => toggleSelection(flag._id)}
                  onEdit={() => {
                    setEditingFlag(flag);
                    setShowForm(true);
                  }}
                  onToggle={() => handleToggle(flag)}
                  onDelete={() => handleDelete(flag)}
                  onDuplicate={() => handleDuplicate(flag)}
                  onViewHistory={() => handleViewHistory(flag)}
                />
              ))}
            </div>
          </>
        )}

        {/* Form Modal */}
        {showForm && (
          <FeatureFlagForm
            flag={editingFlag}
            onSubmit={handleSubmit}
            onClose={() => {
              setShowForm(false);
              setEditingFlag(null);
            }}
            isLoading={saving}
          />
        )}

        {/* History Modal */}
        {showHistory && historyFlagId && (
          <FeatureFlagHistoryModal
            flagId={historyFlagId}
            onClose={() => {
              setShowHistory(false);
              setHistoryFlagId(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default FeatureFlagsPage;