// src/components/Locations/ZonesModule.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { citiesApi, zonesApi, City, Zone, ZoneFilters, Pagination, PolygonCoordinate } from '../../lib/api';
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
  Map,
  MapPin,
  Building2,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  Eye,
  RotateCcw,
  Navigation,
  MapPinned,
} from 'lucide-react';
import { format } from 'date-fns';
import ZoneMapDrawer from '../Maps/ZoneMapDrawer';

// ==================== TYPES ====================
interface LocationSuggestion {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

// ==================== MAIN COMPONENT ====================
export default function ZonesModule() {
  // State
  const [zones, setZones] = useState<Zone[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    zoneName: '',
    cityId: '',
    polygonCoordinates: [] as PolygonCoordinate[],
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Location search state
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(null);

  const itemsPerPage = 10;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch active cities for dropdown
  const fetchCities = async () => {
    try {
      const response = await citiesApi.getActive();
      if (response.success) {
        setCities(response.data.cities);
      }
    } catch (err) {
      console.error('Failed to fetch cities:', err);
    }
  };

  // Fetch zones from API
  const fetchZones = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: ZoneFilters = {
        page: currentPage,
        limit: itemsPerPage,
        sortBy,
        sortOrder,
      };

      if (debouncedSearch) params.search = debouncedSearch;
      if (cityFilter !== 'all') params.cityId = cityFilter;
      if (statusFilter !== 'all') params.isActive = statusFilter;

      const response = await zonesApi.getAll(params);

      if (response.success) {
        setZones(response.data.zones);
        setPagination(response.data.pagination);
      } else {
        throw new Error(response.message || 'Failed to fetch zones');
      }
    } catch (err: any) {
      console.error('Error fetching zones:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch zones';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, cityFilter, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchCities();
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  // Validate form
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.zoneName.trim()) {
      errors.zoneName = 'Zone name is required';
    } else if (formData.zoneName.length < 2) {
      errors.zoneName = 'Zone name must be at least 2 characters';
    }
    
    if (!formData.cityId) {
      errors.cityId = 'Please select a city';
    }
    
    if (formData.polygonCoordinates.length < 3) {
      errors.polygonCoordinates = 'Please draw a zone boundary with at least 3 points';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle add zone
  const handleAddZone = async () => {
    if (!validateForm()) return;

    try {
      setActionLoading('add');
      const response = await zonesApi.create(formData);
      
      if (response.success) {
        setShowAddModal(false);
        setFormData({ zoneName: '', cityId: '', polygonCoordinates: [] });
        setMapCenter(null);
        setMarkerPosition(null);
        fetchZones();
      }
    } catch (err: any) {
      console.error('Error adding zone:', err);
      setFormErrors({ submit: err.response?.data?.message || 'Failed to add zone' });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle edit zone
  const handleEditZone = async () => {
    if (!selectedZone || !validateForm()) return;

    try {
      setActionLoading('edit');
      const response = await zonesApi.update(selectedZone._id, {
        zoneName: formData.zoneName,
        cityId: formData.cityId,
        polygonCoordinates: formData.polygonCoordinates,
      });
      
      if (response.success) {
        setShowEditModal(false);
        setSelectedZone(null);
        setFormData({ zoneName: '', cityId: '', polygonCoordinates: [] });
        setMapCenter(null);
        setMarkerPosition(null);
        fetchZones();
      }
    } catch (err: any) {
      console.error('Error updating zone:', err);
      setFormErrors({ submit: err.response?.data?.message || 'Failed to update zone' });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle delete zone
  const handleDeleteZone = async () => {
    if (!selectedZone) return;

    try {
      setActionLoading('delete');
      const response = await zonesApi.delete(selectedZone._id);
      
      if (response.success) {
        setShowDeleteModal(false);
        setSelectedZone(null);
        fetchZones();
      }
    } catch (err: any) {
      console.error('Error deleting zone:', err);
      alert(err.response?.data?.message || 'Failed to delete zone');
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle zone status
  const handleToggleStatus = async (zone: Zone) => {
    try {
      setActionLoading(zone._id);
      const newStatus = !zone.isActive;
      
      const response = await zonesApi.toggleStatus(zone._id, newStatus);
      
      if (response.success) {
        setZones(prev => prev.map(z => 
          z._id === zone._id ? { ...z, isActive: newStatus } : z
        ));
      }
    } catch (err: any) {
      console.error('Error toggling status:', err);
      alert(err.response?.data?.message || 'Failed to update zone status');
    } finally {
      setActionLoading(null);
    }
  };

  // Open edit modal
  const openEditModal = (zone: Zone) => {
    setSelectedZone(zone);
    const cityId = typeof zone.city === 'object' ? zone.city._id : zone.cityId;
    setFormData({
      zoneName: zone.zoneName,
      cityId: cityId,
      polygonCoordinates: zone.polygonCoordinates || [],
    });
    setFormErrors({});
    setMapCenter(null);
    setMarkerPosition(null);
    setShowEditModal(true);
  };

  // Open view modal
  const openViewModal = (zone: Zone) => {
    setSelectedZone(zone);
    setShowViewModal(true);
  };

  // Open delete modal
  const openDeleteModal = (zone: Zone) => {
    setSelectedZone(zone);
    setShowDeleteModal(true);
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery('');
    setCityFilter('all');
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

  // Get city name
  const getCityName = (zone: Zone) => {
    if (typeof zone.city === 'object' && zone.city) {
      return zone.city.cityName;
    }
    const city = cities.find(c => c._id === zone.cityId);
    return city?.cityName || 'Unknown';
  };

  // Handle location select from search
  const handleLocationSelect = (lat: number, lng: number, locationName: string) => {
    setMapCenter({ lat, lng });
    setMarkerPosition({ lat, lng });
    // Auto-fill zone name if empty
    if (!formData.zoneName.trim()) {
      // Extract area name from location
      const areaName = locationName.split(',')[0].trim();
      setFormData(prev => ({ ...prev, zoneName: areaName }));
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Map className="text-indigo-600" />
            Zones Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage service zones and delivery areas
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
            onClick={fetchZones}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button 
            onClick={() => {
              setFormData({ zoneName: '', cityId: '', polygonCoordinates: [] });
              setFormErrors({});
              setMapCenter(null);
              setMarkerPosition(null);
              setShowAddModal(true);
            }}
            disabled={cities.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Plus size={16} />
            Add Zone
          </button>
        </div>
      </div>

      {/* No Cities Warning */}
      {cities.length === 0 && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-amber-500 shrink-0" size={20} />
          <span className="text-amber-700 font-medium">
            Please add at least one active city before creating zones.
          </span>
          <a 
            href="/locations/cities" 
            className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
          >
            Go to Cities
          </a>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by zone name..." 
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
        <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
          {/* City Filter */}
          <select 
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 outline-none cursor-pointer bg-white"
            value={cityFilter}
            onChange={(e) => { setCityFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All Cities</option>
            {cities.map(city => (
              <option key={city._id} value={city._id}>{city.cityName}</option>
            ))}
          </select>

          {/* Sort */}
          <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white shrink-0">
            <span className="text-xs font-medium text-gray-500">Sort:</span>
            <select 
              className="text-sm font-medium text-gray-700 outline-none cursor-pointer bg-transparent"
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
            >
              <option value="createdAt">Created Date</option>
              <option value="zoneName">Zone Name</option>
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
            onClick={fetchZones}
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
            <p className="text-gray-500 font-medium">Loading zones...</p>
          </div>
        </div>
      )}

      {/* Zones Table */}
      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Zone</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">City</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Boundary Points</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Created</th>
                  <th className="px-6 py-4 text-right font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {zones.length > 0 ? (
                  zones.map((zone) => (
                    <tr key={zone._id} className="hover:bg-gray-50 transition-colors group">
                      {/* Zone Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
                            <Map size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{zone.zoneName}</p>
                            <p className="text-xs text-gray-500">ID: {zone._id.slice(-8)}</p>
                          </div>
                        </div>
                      </td>

                      {/* City */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-gray-400" />
                          <span className="text-gray-700">{getCityName(zone)}</span>
                        </div>
                      </td>

                      {/* Boundary Points */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          <MapPin size={12} />
                          {zone.polygonCoordinates?.length || 0} points
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          zone.isActive 
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {zone.isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {zone.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Created */}
                      <td className="px-6 py-4">
                        <span className="text-gray-700">{formatDate(zone.createdAt)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* View */}
                          <button 
                            onClick={() => openViewModal(zone)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Zone on Map"
                          >
                            <Eye size={16} />
                          </button>

                          {/* Edit */}
                          <button 
                            onClick={() => openEditModal(zone)}
                            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Zone"
                          >
                            <Edit2 size={16} />
                          </button>

                          {/* Toggle Status */}
                          <button 
                            onClick={() => handleToggleStatus(zone)}
                            disabled={actionLoading === zone._id}
                            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                              zone.isActive 
                                ? 'text-amber-500 hover:bg-amber-50'
                                : 'text-green-500 hover:bg-green-50'
                            }`}
                            title={zone.isActive ? 'Deactivate Zone' : 'Activate Zone'}
                          >
                            {actionLoading === zone._id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : zone.isActive ? (
                              <ToggleRight size={16} />
                            ) : (
                              <ToggleLeft size={16} />
                            )}
                          </button>

                          {/* Delete */}
                          <button 
                            onClick={() => openDeleteModal(zone)}
                            disabled={actionLoading === zone._id}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete Zone"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Map size={48} className="text-gray-300" />
                        <p className="text-gray-500 font-medium">No zones found</p>
                        <p className="text-sm text-gray-400">Create your first zone to define service areas</p>
                        {cities.length > 0 && (
                          <button 
                            onClick={() => setShowAddModal(true)}
                            className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                          >
                            <Plus size={16} />
                            Add Zone
                          </button>
                        )}
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
                Showing <span className="font-medium">{zones.length}</span> of{' '}
                <span className="font-medium">{pagination.total}</span> zones | 
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

      {/* Add Zone Modal */}
      {showAddModal && (
        <ZoneFormModal
          title="Add New Zone"
          formData={formData}
          setFormData={setFormData}
          formErrors={formErrors}
          cities={cities}
          loading={actionLoading === 'add'}
          mapCenter={mapCenter}
          markerPosition={markerPosition}
          onLocationSelect={handleLocationSelect}
          onClose={() => {
            setShowAddModal(false);
            setFormErrors({});
            setMapCenter(null);
            setMarkerPosition(null);
          }}
          onSubmit={handleAddZone}
        />
      )}

      {/* Edit Zone Modal */}
      {showEditModal && selectedZone && (
        <ZoneFormModal
          title="Edit Zone"
          formData={formData}
          setFormData={setFormData}
          formErrors={formErrors}
          cities={cities}
          loading={actionLoading === 'edit'}
          mapCenter={mapCenter}
          markerPosition={markerPosition}
          onLocationSelect={handleLocationSelect}
          onClose={() => {
            setShowEditModal(false);
            setSelectedZone(null);
            setFormErrors({});
            setMapCenter(null);
            setMarkerPosition(null);
          }}
          onSubmit={handleEditZone}
        />
      )}

      {/* View Zone Modal */}
      {showViewModal && selectedZone && (
        <ViewZoneModal
          zone={selectedZone}
          cityName={getCityName(selectedZone)}
          onClose={() => {
            setShowViewModal(false);
            setSelectedZone(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedZone && (
        <DeleteZoneModal
          zone={selectedZone}
          loading={actionLoading === 'delete'}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedZone(null);
          }}
          onConfirm={handleDeleteZone}
        />
      )}
    </div>
  );
}

// ==================== LOCATION SEARCH COMPONENT ====================
function LocationSearchInput({ 
  onSelect, 
  cityName,
  placeholder = "Search for an area or location..."
}: {
  onSelect: (lat: number, lng: number, name: string) => void;
  cityName?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        
        // Build search query with city name for better results
        const searchQuery = cityName ? `${query}, ${cityName}` : query;
        
        // Using OpenStreetMap Nominatim API (free)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=6&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'en',
            },
          }
        );
        
        const data = await response.json();
        setSuggestions(data);
        setShowSuggestions(true);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Error fetching location suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, cityName]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  // Handle selection
  const handleSelect = (suggestion: LocationSuggestion) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    
    onSelect(lat, lng, suggestion.display_name);
    setQuery(suggestion.display_name.split(',')[0]);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" size={18} />
        )}
        {!isLoading && query && (
          <button
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setShowSuggestions(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
        >
          <div className="max-h-64 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.place_id}
                onClick={() => handleSelect(suggestion)}
                className={`w-full px-4 py-3 text-left flex items-start gap-3 transition-colors ${
                  index === selectedIndex
                    ? 'bg-indigo-50 border-l-4 border-indigo-500'
                    : 'hover:bg-gray-50 border-l-4 border-transparent'
                }`}
              >
                <MapPinned className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {suggestion.display_name.split(',')[0]}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {suggestion.display_name.split(',').slice(1, 4).join(',')}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Navigation size={12} />
              Powered by OpenStreetMap
            </p>
          </div>
        </div>
      )}

      {/* No Results */}
      {showSuggestions && query.length >= 3 && suggestions.length === 0 && !isLoading && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-center">
          <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No locations found</p>
          <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  );
}

// ==================== ZONE FORM MODAL ====================
function ZoneFormModal({ 
  title, 
  formData, 
  setFormData, 
  formErrors, 
  cities, 
  loading, 
  onClose, 
  onSubmit 
}: {
  title: string;
  formData: { zoneName: string; cityId: string; polygonCoordinates: PolygonCoordinate[] };
  setFormData: (data: any) => void;
  formErrors: Record<string, string>;
  cities: City[];
  loading: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  // Get selected city for map
  const selectedCity = cities.find(c => c._id === formData.cityId);

  // Handle zone name suggestion from map search
  const handleZoneNameSuggestion = (name: string) => {
    if (!formData.zoneName.trim()) {
      setFormData({ ...formData, zoneName: name });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between shrink-0 bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Map size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="text-indigo-100 text-xs mt-0.5">
                Search for a location and draw zone boundary
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* City & Zone Name Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* City Selection */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Building2 size={16} className="text-indigo-500" />
                Select City <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.cityId}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  cityId: e.target.value, 
                  polygonCoordinates: [] 
                })}
                className={`w-full px-4 py-3 border-2 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${
                  formErrors.cityId ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              >
                <option value="">Choose a city first...</option>
                {cities.map(city => (
                  <option key={city._id} value={city._id}>
                    {city.cityName}, {city.state}
                  </option>
                ))}
              </select>
              {formErrors.cityId && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {formErrors.cityId}
                </p>
              )}
            </div>

            {/* Zone Name */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MapPin size={16} className="text-indigo-500" />
                Zone Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.zoneName}
                onChange={(e) => setFormData({ ...formData, zoneName: e.target.value })}
                className={`w-full px-4 py-3 border-2 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${
                  formErrors.zoneName ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
                placeholder="e.g., Arera Colony Zone"
              />
              {formErrors.zoneName && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {formErrors.zoneName}
                </p>
              )}
            </div>
          </div>

          {/* Map Section */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Map size={16} className="text-indigo-500" />
              Draw Zone Boundary <span className="text-red-500">*</span>
            </label>
            
            {/* Help Text */}
            <div className="mb-3 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl">
              <div className="flex items-start gap-2">
                <div className="p-1 bg-indigo-100 rounded">
                  <Navigation size={14} className="text-indigo-600" />
                </div>
                <div className="text-xs text-indigo-700">
                  <p className="font-medium">How to create a zone:</p>
                  <ol className="mt-1 space-y-0.5 list-decimal list-inside text-indigo-600">
                    <li>Search for the area in the search box on the map</li>
                    <li>Click on the map to add boundary points (minimum 3)</li>
                    <li>Drag points to adjust the boundary</li>
                    <li>Right-click on a point to remove it</li>
                  </ol>
                </div>
              </div>
            </div>
            
            <div className={`border-2 rounded-xl overflow-hidden ${
              formErrors.polygonCoordinates ? 'border-red-400' : 'border-gray-200'
            }`}>
              <ZoneMapDrawer
                initialCoordinates={formData.polygonCoordinates}
                onChange={(coords) => setFormData({ ...formData, polygonCoordinates: coords })}
                cityName={selectedCity?.cityName}
                onZoneNameSuggestion={handleZoneNameSuggestion}
              />
            </div>
            
            {formErrors.polygonCoordinates && (
              <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                <AlertCircle size={12} />
                {formErrors.polygonCoordinates}
              </p>
            )}
          </div>

          {/* Submit Error */}
          {formErrors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
              <p className="text-red-600 text-sm font-medium">{formErrors.submit}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
          {/* Status */}
          <div className="flex items-center gap-4 text-sm">
            {selectedCity && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-600">
                <Building2 size={14} className="text-indigo-500" />
                {selectedCity.cityName}
              </span>
            )}
            {formData.polygonCoordinates.length > 0 && (
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                formData.polygonCoordinates.length >= 3 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-amber-100 text-amber-700'
              }`}>
                <MapPin size={14} />
                {formData.polygonCoordinates.length} points
              </span>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={loading || !formData.cityId || !formData.zoneName || formData.polygonCoordinates.length < 3}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-500/25"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  Save Zone
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== VIEW ZONE MODAL ====================
function ViewZoneModal({ zone, cityName, onClose }: {
  zone: Zone;
  cityName: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between shrink-0 bg-gradient-to-r from-indigo-600 to-purple-600">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Map size={24} />
              {zone.zoneName}
            </h3>
            <p className="text-indigo-100 text-sm mt-1 flex items-center gap-1">
              <Building2 size={14} />
              {cityName}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Map */}
        <div className="flex-1 min-h-[400px]">
          <ZoneMapDrawer
            initialCoordinates={zone.polygonCoordinates}
            onChange={() => {}}
            readOnly={true}
          />
        </div>

        {/* Info */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 shrink-0">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 flex items-center gap-2">
              <MapPin size={16} className="text-indigo-500" />
              <strong>{zone.polygonCoordinates?.length || 0}</strong> boundary points
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              zone.isActive 
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {zone.isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
              {zone.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== DELETE ZONE MODAL ====================
function DeleteZoneModal({ zone, loading, onClose, onConfirm }: {
  zone: Zone;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-red-500 to-rose-600">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <AlertCircle className="text-white" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Delete Zone</h3>
              <p className="text-red-100 text-sm">This action cannot be undone</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700">
            Are you sure you want to delete the zone <strong className="text-gray-900">{zone.zoneName}</strong>?
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Service providers assigned to this zone will need to be reassigned.
          </p>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-medium hover:from-red-600 hover:to-rose-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-500/25"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Delete Zone
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}