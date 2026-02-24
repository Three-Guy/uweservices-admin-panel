import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Save, 
  RotateCcw, 
  Star, 
  Eye, 
  EyeOff, 
  ChevronDown, 
  ChevronUp,
  ArrowUpDown,
  Check,
  AlertCircle,
  IndianRupee,
  MoreVertical
} from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { cn } from '../../lib/utils';
import { PricingType, SubService } from '../../types';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export function ServicePriceTable() {
  const { categories, updateSubService, resetSubServicePrice, addNotification } = useStore();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Flatten services for the table
  const allServices = useMemo(() => {
    const services: (SubService & { categoryName: string; categoryId: string })[] = [];
    categories.forEach(cat => {
      cat.subServices.forEach(sub => {
        services.push({
          ...sub,
          categoryName: cat.name,
          categoryId: cat.id
        });
      });
    });
    return services;
  }, [categories]);

  const filteredServices = useMemo(() => {
    return allServices.filter(service => {
      const matchesSearch = service.name.toLowerCase().includes(search.toLowerCase()) || 
                           service.categoryName.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || service.categoryId === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [allServices, search, categoryFilter]);

  const sortedServices = useMemo(() => {
    if (!sortConfig) return filteredServices;
    return [...filteredServices].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof typeof a];
      const bValue = b[sortConfig.key as keyof typeof b];
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredServices, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleEdit = (service: SubService) => {
    setEditingId(service.id);
    setEditValue(service.basePrice.toString());
  };

  const handleSave = (categoryId: string, serviceId: string) => {
    const newPrice = parseFloat(editValue);
    if (isNaN(newPrice) || newPrice < 0) {
      addNotification('Invalid Price', 'Price cannot be negative or empty.');
      return;
    }

    updateSubService(categoryId, serviceId, { basePrice: newPrice });
    setEditingId(null);
    addNotification('Price Updated', 'Service price has been updated successfully.');
  };

  const handleToggleActive = (categoryId: string, serviceId: string, current: boolean) => {
    updateSubService(categoryId, serviceId, { isActive: !current });
  };

  const handleTogglePopular = (categoryId: string, serviceId: string, current: boolean) => {
    updateSubService(categoryId, serviceId, { isPopular: !current });
  };

  const handleReset = (categoryId: string, serviceId: string) => {
    resetSubServicePrice(categoryId, serviceId);
  };

  return (
    <div className="space-y-6">
      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card-bg p-4 rounded-2xl border border-border-base shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input
            type="text"
            placeholder="Search service or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-bg-secondary border-none rounded-xl text-sm focus:ring-2 focus:ring-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-12 pr-10 py-3 bg-bg-secondary border-none rounded-xl text-sm appearance-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={16} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card-bg rounded-2xl border border-border-base shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-secondary/50 border-bottom border-border-base">
                <th className="px-6 py-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-2 hover:text-text-primary transition-colors">
                    Service Name <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                  <button onClick={() => handleSort('categoryName')} className="flex items-center gap-2 hover:text-text-primary transition-colors">
                    Category <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest text-right">
                  <button onClick={() => handleSort('basePrice')} className="flex items-center gap-2 ml-auto hover:text-text-primary transition-colors">
                    Base Price <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest text-center">Popular</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-base/50">
              <AnimatePresence mode="popLayout">
                {sortedServices.map((service) => (
                  <motion.tr
                    key={service.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-bg-secondary/30 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-text-primary">{service.name}</div>
                      <div className="text-[10px] text-text-secondary mt-0.5">Last updated: {format(new Date(service.updatedAt), 'MMM dd, HH:mm')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-bg-secondary text-text-secondary rounded-lg text-[10px] font-bold uppercase tracking-wider border border-border-base">
                        {service.categoryName}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {editingId === service.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-24 pl-8 pr-3 py-1.5 bg-bg-primary border border-primary rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave(service.categoryId, service.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                          </div>
                          <button
                            onClick={() => handleSave(service.categoryId, service.id)}
                            className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(service)}
                          className="text-lg font-black text-text-primary hover:text-primary transition-colors flex items-center justify-end gap-1 ml-auto group/price"
                        >
                          <span className="text-sm font-medium text-text-secondary">₹</span>
                          {service.basePrice}
                          <span className="opacity-0 group-hover/price:opacity-100 transition-opacity ml-1">
                            <Save size={14} className="text-text-secondary" />
                          </span>
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        service.pricingType === 'Fixed' ? "bg-blue-500/10 text-blue-500" :
                        service.pricingType === 'Onwards' ? "bg-amber-500/10 text-amber-500" :
                        "bg-purple-500/10 text-purple-500"
                      )}>
                        {service.pricingType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleTogglePopular(service.categoryId, service.id, !!service.isPopular)}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          service.isPopular ? "text-amber-500 bg-amber-500/10" : "text-text-secondary hover:bg-bg-secondary"
                        )}
                      >
                        <Star size={18} fill={service.isPopular ? "currentColor" : "none"} />
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleActive(service.categoryId, service.id, service.isActive)}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          service.isActive ? "text-green-500 bg-green-500/10" : "text-red-500 bg-red-500/10"
                        )}
                      >
                        {service.isActive ? <Eye size={18} /> : <EyeOff size={18} />}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleReset(service.categoryId, service.id)}
                          title="Reset to default price"
                          className="p-2 text-text-secondary hover:text-primary hover:bg-bg-secondary rounded-xl transition-all"
                        >
                          <RotateCcw size={18} />
                        </button>
                        <button className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-secondary rounded-xl transition-all">
                          <MoreVertical size={18} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        {sortedServices.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-text-secondary" />
            </div>
            <h3 className="text-lg font-bold text-text-primary">No services found</h3>
            <p className="text-text-secondary">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
