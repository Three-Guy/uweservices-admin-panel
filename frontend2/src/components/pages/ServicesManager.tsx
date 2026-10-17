// src/pages/ServicesManager.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Star,
  Sparkles,
  RefreshCw,
  ChevronDown,
  X,
  Wrench,
  Image,
  DollarSign,
  Tag,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { servicesApi, categoriesApi, Service, Category, ServiceFilters } from '../lib/api';

// Stats Card Component
const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  bgColor 
}: { 
  title: string; 
  value: number; 
  icon: React.ElementType; 
  color: string; 
  bgColor: string;
}) => (
  <div className={`${bgColor} rounded-xl p-4 border border-gray-700`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-400 text-sm">{title}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center`}>
        <Icon className={color} size={20} />
      </div>
    </div>
  </div>
);

export default function ServicesManager() {
  // State
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch categories for dropdown
  const fetchCategories = useCallback(async () => {
    try {
      const response = await categoriesApi.getActive();
      if (response.success) {
        setCategories(response.data.categories);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  // Fetch services
  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: ServiceFilters = {
        page,
        limit: 20,
        sortBy: 'display.sortOrder',
        sortOrder: 'asc',
      };

      if (search) params.search = search;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (statusFilter !== 'all') params.isActive = statusFilter;

      const response = await servicesApi.getAll(params);

      if (response.success) {
        setServices(response.data.services);
        setPagination(response.data.pagination);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch services');
      console.error('Error fetching services:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, statusFilter]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await servicesApi.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchCategories();
    fetchStats();
  }, [fetchCategories, fetchStats]);

  // Fetch services when filters change
  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Handle toggle status
  const handleToggleStatus = async (service: Service) => {
    try {
      setActionLoading(service._id);
      const response = await servicesApi.toggleStatus(service._id, !service.isActive);
      
      if (response.success) {
        setServices(prev => prev.map(s => 
          s._id === service._id ? { ...s, isActive: !s.isActive } : s
        ));
        fetchStats();
      }
    } catch (err: any) {
      console.error('Failed to toggle status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle delete
  const handleDelete = async (service: Service) => {
    if (!window.confirm(`Are you sure you want to delete "${service.name}"?`)) {
      return;
    }

    try {
      setActionLoading(service._id);
      const response = await servicesApi.delete(service._id);
      
      if (response.success) {
        setServices(prev => prev.filter(s => s._id !== service._id));
        fetchStats();
      }
    } catch (err: any) {
      console.error('Failed to delete service:', err);
      alert(err.message || 'Failed to delete service');
    } finally {
      setActionLoading(null);
    }
  };

  // Refresh all data
  const handleRefresh = () => {
    fetchServices();
    fetchStats();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <Wrench className="text-purple-400" />
                Services Manager
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Manage your service catalog for the mobile app
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
              
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
              >
                <Plus size={20} />
                Add Service
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <StatCard
              title="Total Services"
              value={stats.totalServices}
              icon={Wrench}
              color="text-blue-400"
              bgColor="bg-blue-500/10"
            />
            <StatCard
              title="Active"
              value={stats.activeServices}
              icon={Check}
              color="text-green-400"
              bgColor="bg-green-500/10"
            />
            <StatCard
              title="Inactive"
              value={stats.inactiveServices}
              icon={EyeOff}
              color="text-gray-400"
              bgColor="bg-gray-500/10"
            />
            <StatCard
              title="Popular"
              value={stats.popularServices}
              icon={Star}
              color="text-yellow-400"
              bgColor="bg-yellow-500/10"
            />
            <StatCard
              title="Featured"
              value={stats.featuredServices}
              icon={Sparkles}
              color="text-purple-400"
              bgColor="bg-purple-500/10"
            />
            <StatCard
              title="Subservices"
              value={stats.totalSubservices}
              icon={Tag}
              color="text-cyan-400"
              bgColor="bg-cyan-500/10"
            />
          </div>
        )}

        {/* Filters Bar */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px] max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
            >
              <option value="all">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>

            {/* Clear Filters */}
            {(search || categoryFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                }}
                className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X size={16} />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="text-red-400" size={20} />
            <p className="text-red-400">{error}</p>
            <button
              onClick={handleRefresh}
              className="ml-auto px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        )}

        {/* Services Grid */}
        {!loading && services.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {services.map((service) => (
              <ServiceCard
                key={service._id}
                service={service}
                onToggleStatus={handleToggleStatus}
                onEdit={(s) => {
                  setSelectedService(s);
                  setShowEditModal(true);
                }}
                onDelete={handleDelete}
                actionLoading={actionLoading === service._id}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && services.length === 0 && (
          <div className="text-center py-20">
            <Wrench className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No services found</h3>
            <p className="text-gray-500 mb-6">
              {search || categoryFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by adding your first service'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
            >
              <Plus size={20} />
              Add Service
            </button>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={!pagination.hasPrev}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
            >
              Previous
            </button>
            
            <span className="px-4 py-2 text-gray-400">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!pagination.hasNext}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal would go here */}
      {/* For brevity, I'm not including the full modal implementation */}
    </div>
  );
}

// Service Card Component
function ServiceCard({
  service,
  onToggleStatus,
  onEdit,
  onDelete,
  actionLoading,
}: {
  service: Service;
  onToggleStatus: (service: Service) => void;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
  actionLoading: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const imageUrl = service.images?.thumbnail?.url || service.images?.hero?.url || service.image;
  const categoryName = typeof service.category === 'object' 
    ? service.category?.name 
    : service.categoryName || 'Uncategorized';

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-all group ${!service.isActive ? 'opacity-60' : ''}`}>
      {/* Image */}
      <div className="relative aspect-video bg-gray-800">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={service.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">{service.icon || '🔧'}</span>
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {service.isPopular && (
            <span className="px-2 py-0.5 bg-yellow-500/90 text-yellow-900 text-xs font-bold rounded-full flex items-center gap-1">
              <Star size={10} /> Popular
            </span>
          )}
          {service.isFeatured && (
            <span className="px-2 py-0.5 bg-purple-500/90 text-white text-xs font-bold rounded-full flex items-center gap-1">
              <Sparkles size={10} /> Featured
            </span>
          )}
        </div>

        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            service.isActive 
              ? 'bg-green-500/90 text-white' 
              : 'bg-gray-500/90 text-white'
          }`}>
            {service.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Actions Menu */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 bg-gray-900/80 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <MoreVertical size={16} />
            </button>

            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)} 
                />
                <div className="absolute bottom-full right-0 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1 min-w-[140px]">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(service);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Edit size={14} /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onToggleStatus(service);
                    }}
                    disabled={actionLoading}
                    className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    {service.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                    {service.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(service);
                    }}
                    disabled={actionLoading}
                    className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h3 className="font-semibold text-white truncate">{service.name}</h3>
            <p className="text-xs text-gray-500">{categoryName}</p>
          </div>
          <span className="text-lg">{service.icon}</span>
        </div>

        {service.subtitle && (
          <p className="text-sm text-gray-400 line-clamp-2 mb-3">
            {service.subtitle}
          </p>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="text-purple-400 font-medium">
            {service.pricing?.displayText || `$${service.pricing?.basePrice || 0} onwards`}
          </span>
          <span className="text-gray-500">
            {service.subservicesCount || 0} items
          </span>
        </div>

        {/* Tags */}
        {service.tags && service.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {service.tags.slice(0, 3).map((tag, i) => (
              <span 
                key={i}
                className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
            {service.tags.length > 3 && (
              <span className="px-2 py-0.5 bg-gray-800 text-gray-500 text-xs rounded-full">
                +{service.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}