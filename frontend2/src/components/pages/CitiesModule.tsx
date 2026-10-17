import React, { useState, useEffect, useCallback } from 'react';
import { citiesApi, City, CityFilters, CityStats, Pagination } from '../../lib/api';
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Building2,
  MapPin,
  Globe,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  Map,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';

export default function CitiesModule() {
  // State
  const [cities, setCities] = useState<City[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CityStats | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    cityName: '',
    state: '',
    country: 'India',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const itemsPerPage = 10;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch city stats
  const fetchStats = async () => {
    try {
      const response = await citiesApi.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  // Fetch cities from API
  const fetchCities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: CityFilters = {
        page: currentPage,
        limit: itemsPerPage,
        sortBy,
        sortOrder,
      };

      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.isActive = statusFilter;

      const response = await citiesApi.getAll(params);

      if (response.success) {
        setCities(response.data.cities);
        setPagination(response.data.pagination);
      } else {
        throw new Error(response.message || 'Failed to fetch cities');
      }
    } catch (err: any) {
      console.error('Error fetching cities:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch cities';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchCities();
    fetchStats();
  }, [fetchCities]);

  // Validate form
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.cityName.trim()) {
      errors.cityName = 'City name is required';
    } else if (formData.cityName.length < 2) {
      errors.cityName = 'City name must be at least 2 characters';
    }
    
    if (!formData.state.trim()) {
      errors.state = 'State is required';
    }
    
    if (!formData.country.trim()) {
      errors.country = 'Country is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle add city
  const handleAddCity = async () => {
    if (!validateForm()) return;

    try {
      setActionLoading('add');
      const response = await citiesApi.create(formData);
      
      if (response.success) {
        setShowAddModal(false);
        setFormData({ cityName: '', state: '', country: 'India' });
        fetchCities();
        fetchStats();
      }
    } catch (err: any) {
      console.error('Error adding city:', err);
      setFormErrors({ submit: err.response?.data?.message || 'Failed to add city' });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle edit city
  const handleEditCity = async () => {
    if (!selectedCity || !validateForm()) return;

    try {
      setActionLoading('edit');
      const response = await citiesApi.update(selectedCity._id, formData);
      
      if (response.success) {
        setShowEditModal(false);
        setSelectedCity(null);
        setFormData({ cityName: '', state: '', country: 'India' });
        fetchCities();
      }
    } catch (err: any) {
      console.error('Error updating city:', err);
      setFormErrors({ submit: err.response?.data?.message || 'Failed to update city' });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle delete city
  const handleDeleteCity = async () => {
    if (!selectedCity) return;

    try {
      setActionLoading('delete');
      const response = await citiesApi.delete(selectedCity._id);
      
      if (response.success) {
        setShowDeleteModal(false);
        setSelectedCity(null);
        fetchCities();
        fetchStats();
      }
    } catch (err: any) {
      console.error('Error deleting city:', err);
      alert(err.response?.data?.message || 'Failed to delete city');
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle city status
  const handleToggleStatus = async (city: City) => {
    try {
      setActionLoading(city._id);
      const newStatus = !city.isActive;
      
      const response = await citiesApi.toggleStatus(city._id, newStatus);
      
      if (response.success) {
        setCities(prev => prev.map(c => 
          c._id === city._id ? { ...c, isActive: newStatus } : c
        ));
        fetchStats();
      }
    } catch (err: any) {
      console.error('Error toggling status:', err);
      alert(err.response?.data?.message || 'Failed to update city status');
    } finally {
      setActionLoading(null);
    }
  };

  // Open edit modal
  const openEditModal = (city: City) => {
    setSelectedCity(city);
    setFormData({
      cityName: city.cityName,
      state: city.state,
      country: city.country,
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  // Open delete modal
  const openDeleteModal = (city: City) => {
    setSelectedCity(city);
    setShowDeleteModal(true);
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSortBy('createdAt');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  // Format date
  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'MMM dd, yyyy');
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="text-indigo-600" />
            Cities Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage service areas and cities
            {pagination && <span className="ml-2 text-indigo-600 font-semibold">({pagination.total} total)</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={resetFilters}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Reset Filters"
          >
            <RotateCcw size={18} />
          </button>
          <button 
            onClick={() => { fetchCities(); fetchStats(); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button 
            onClick={() => {
              setFormData({ cityName: '', state: '', country: 'India' });
              setFormErrors({});
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Add City
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Building2 className="text-indigo-600" />}
            label="Total Cities"
            value={stats.totalCities}
            bgColor="bg-indigo-50"
          />
          <StatCard
            icon={<CheckCircle className="text-green-600" />}
            label="Active Cities"
            value={stats.activeCities}
            bgColor="bg-green-50"
          />
          <StatCard
            icon={<XCircle className="text-red-600" />}
            label="Inactive Cities"
            value={stats.inactiveCities}
            bgColor="bg-red-50"
          />
          <StatCard
            icon={<Map className="text-purple-600" />}
            label="Total Zones"
            value={stats.totalZones}
            bgColor="bg-purple-50"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by city name or state..." 
            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        {/* Filter Controls */}
        <div className="flex items-center gap-3 w-full lg:w-auto">
          {/* Sort */}
          <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white shrink-0">
            <span className="text-xs font-medium text-gray-500">Sort:</span>
            <select 
              className="text-sm font-medium text-gray-700 outline-none cursor-pointer bg-transparent"
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
            >
              <option value="createdAt">Created Date</option>
              <option value="cityName">City Name</option>
              <option value="state">State</option>
            </select>
            <button 
              onClick={() => { setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); setCurrentPage(1); }}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              <ArrowUpDown size={14} className="text-gray-500" />
            </button>
          </div>

          {/* Status Filter */}
          <select 
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 outline-none cursor-pointer bg-white shrink-0"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-red-500 shrink-0" size={20} />
          <span className="text-red-700 font-medium flex-1">{error}</span>
          <button 
            onClick={fetchCities}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
            <p className="text-gray-500 font-medium">Loading cities...</p>
          </div>
        </div>
      )}

      {/* Cities Table */}
      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">City</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">State</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Country</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Zones</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Created</th>
                  <th className="px-6 py-4 text-right font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cities.length > 0 ? (
                  cities.map((city) => (
                    <tr key={city._id} className="hover:bg-gray-50 transition-colors group">
                      {/* City Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                            <Building2 size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{city.cityName}</p>
                            <p className="text-xs text-gray-500">ID: {city._id.slice(-8)}</p>
                          </div>
                        </div>
                      </td>

                      {/* State */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-gray-400" />
                          <span className="text-gray-700">{city.state}</span>
                        </div>
                      </td>

                      {/* Country */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Globe size={14} className="text-gray-400" />
                          <span className="text-gray-700">{city.country}</span>
                        </div>
                      </td>

                      {/* Zones Count */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          <Map size={12} />
                          {city.zonesCount || 0} zones
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          city.isActive 
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {city.isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {city.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Created */}
                      <td className="px-6 py-4">
                        <span className="text-gray-700">{formatDate(city.createdAt)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Edit */}
                          <button 
                            onClick={() => openEditModal(city)}
                            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit City"
                          >
                            <Edit2 size={16} />
                          </button>

                          {/* Toggle Status */}
                          <button 
                            onClick={() => handleToggleStatus(city)}
                            disabled={actionLoading === city._id}
                            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                              city.isActive 
                                ? 'text-amber-500 hover:bg-amber-50'
                                : 'text-green-500 hover:bg-green-50'
                            }`}
                            title={city.isActive ? 'Deactivate City' : 'Activate City'}
                          >
                            {actionLoading === city._id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : city.isActive ? (
                              <ToggleRight size={16} />
                            ) : (
                              <ToggleLeft size={16} />
                            )}
                          </button>

                          {/* Delete */}
                          <button 
                            onClick={() => openDeleteModal(city)}
                            disabled={actionLoading === city._id}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete City"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Building2 size={48} className="text-gray-300" />
                        <p className="text-gray-500 font-medium">No cities found</p>
                        <p className="text-sm text-gray-400">Add your first city to get started</p>
                        <button 
                          onClick={() => setShowAddModal(true)}
                          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                        >
                          <Plus size={16} />
                          Add City
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {pagination && pagination.total > 0 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-sm text-gray-600">
                Showing <span className="font-medium">{cities.length}</span> of{' '}
                <span className="font-medium">{pagination.total}</span> cities | 
                Page <span className="font-medium">{pagination.page}</span> of{' '}
                <span className="font-medium">{pagination.totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={!pagination.hasPrev}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                
                {/* Page Numbers */}
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          pageNum === pagination.page
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button 
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={!pagination.hasNext}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add City Modal */}
      {showAddModal && (
        <CityFormModal
          title="Add New City"
          formData={formData}
          setFormData={setFormData}
          formErrors={formErrors}
          loading={actionLoading === 'add'}
          onClose={() => {
            setShowAddModal(false);
            setFormErrors({});
          }}
          onSubmit={handleAddCity}
        />
      )}

      {/* Edit City Modal */}
      {showEditModal && selectedCity && (
        <CityFormModal
          title="Edit City"
          formData={formData}
          setFormData={setFormData}
          formErrors={formErrors}
          loading={actionLoading === 'edit'}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCity(null);
            setFormErrors({});
          }}
          onSubmit={handleEditCity}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedCity && (
        <DeleteConfirmationModal
          city={selectedCity}
          loading={actionLoading === 'delete'}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedCity(null);
          }}
          onConfirm={handleDeleteCity}
        />
      )}
    </div>
  );
}

// ==================== STAT CARD ====================
function StatCard({ icon, label, value, bgColor }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bgColor: string;
}) {
  return (
    <div className={`p-4 rounded-xl border border-gray-200 ${bgColor}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

// ==================== CITY FORM MODAL ====================
function CityFormModal({ title, formData, setFormData, formErrors, loading, onClose, onSubmit }: {
  title: string;
  formData: { cityName: string; state: string; country: string };
  setFormData: (data: any) => void;
  formErrors: Record<string, string>;
  loading: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  // Indian states list
  const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
  ].sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="text-indigo-600" size={24} />
            {title}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* City Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.cityName}
              onChange={(e) => setFormData({ ...formData, cityName: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                formErrors.cityName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Bhopal"
            />
            {formErrors.cityName && (
              <p className="text-red-500 text-xs mt-1">{formErrors.cityName}</p>
            )}
          </div>

          {/* State */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                formErrors.state ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select State</option>
              {indianStates.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
            {formErrors.state && (
              <p className="text-red-500 text-xs mt-1">{formErrors.state}</p>
            )}
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                formErrors.country ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., India"
            />
            {formErrors.country && (
              <p className="text-red-500 text-xs mt-1">{formErrors.country}</p>
            )}
          </div>

          {/* Submit Error */}
          {formErrors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{formErrors.submit}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Save City
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== DELETE CONFIRMATION MODAL ====================
function DeleteConfirmationModal({ city, loading, onClose, onConfirm }: {
  city: City;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-red-50 border-b border-red-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="text-red-600" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Delete City</h3>
              <p className="text-sm text-gray-600">This action cannot be undone</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700">
            Are you sure you want to delete <strong>{city.cityName}</strong>?
          </p>
          <p className="text-sm text-gray-500 mt-2">
            All zones associated with this city will also be deleted.
          </p>
          
          {(city.zonesCount ?? 0) > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-700 text-sm font-medium">
                ⚠️ This city has {city.zonesCount} zone(s) that will be deleted.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Delete City
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}