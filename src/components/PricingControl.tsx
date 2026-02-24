import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  Zap, 
  Plus, 
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Star,
  ToggleLeft,
  ToggleRight,
  Percent,
  Receipt,
  AlertTriangle,
  Edit3,
  Check,
  X,
  PlusCircle,
  RotateCcw,
  Calculator,
  Eye,
  LayoutGrid,
  Settings2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store/StoreContext';
import { Category, SubService } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export function PricingControl() {
  const { 
    categories, 
    updateSubService, 
    addSubService, 
    deleteSubService, 
    resetSubServicePrice,
    updateCategorySettings,
    bulkUpdatePrices,
    addNotification
  } = useStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(categories[0]?.id || null);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [newSubData, setNewSubData] = useState<{ name: string; price: number; minPrice: number; maxPrice: number; isPopular: boolean; pricingType: 'Fixed' | 'Onwards' | 'Custom' }>({
    name: '',
    price: 0,
    minPrice: 0,
    maxPrice: 0,
    isPopular: false,
    pricingType: 'Onwards'
  });
  const [showAddSub, setShowAddSub] = useState<string | null>(null);
  const [bulkUpdateValue, setBulkUpdateValue] = useState<number>(0);
  const [previewService, setPreviewService] = useState<{ catId: string; subId: string } | null>(null);

  const calculateFinalPrice = (cat: Category, sub: SubService) => {
    if (sub.pricingType === 'Custom') return 'Custom';
    
    // Logic: Final = ((Base + VisitCharge) * Multiplier - Discount) + GST
    const base = sub.basePrice;
    const visitCharge = cat.baseCharge;
    const multiplier = cat.multiplier;
    const discountPercent = cat.discountPercent;
    const gstPercent = cat.gstPercent;

    const subtotalBeforeDiscount = (base + visitCharge) * multiplier;
    const discountAmount = subtotalBeforeDiscount * (discountPercent / 100);
    const subtotalAfterDiscount = subtotalBeforeDiscount - discountAmount;
    const taxAmount = subtotalAfterDiscount * (gstPercent / 100);
    const total = subtotalAfterDiscount + taxAmount;

    return Math.round(total);
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    return categories.filter(cat => 
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.subServices.some(sub => sub.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [categories, searchQuery]);

  const toggleAccordion = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const expandAll = () => setExpandedId('all');
  const collapseAll = () => setExpandedId(null);

  const handleUpdateSub = (catId: string, subId: string, updates: Partial<SubService>) => {
    updateSubService(catId, subId, updates);
    setEditingSubId(null);
    addNotification('Service Updated', 'Service details have been updated successfully.');
  };

  const handleResetSub = (categoryId: string, subServiceId: string) => {
    resetSubServicePrice(categoryId, subServiceId);
  };

  const handleAddSub = (catId: string) => {
    if (!newSubData.name) return;
    addSubService(catId, {
      name: newSubData.name,
      basePrice: newSubData.price,
      minPrice: newSubData.minPrice,
      maxPrice: newSubData.maxPrice,
      isPopular: newSubData.isPopular,
      isActive: true,
      pricingType: newSubData.pricingType
    });
    setNewSubData({ name: '', price: 0, minPrice: 0, maxPrice: 0, isPopular: false, pricingType: 'Onwards' });
    setShowAddSub(null);
  };

  const handleBulkUpdate = (catId: string) => {
    if (bulkUpdateValue === 0) return;
    bulkUpdatePrices(catId, bulkUpdateValue);
    setBulkUpdateValue(0);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-text-primary">Pricing Management</h2>
          <p className="text-text-secondary mt-1 font-medium italic">Configure services, manage pricing tiers, and toggle market settings.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-bg-secondary border border-border-base rounded-2xl p-1">
            <button 
              onClick={expandAll}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-primary transition-colors"
            >
              Expand All
            </button>
            <div className="w-px h-4 bg-border-base mx-1" />
            <button 
              onClick={collapseAll}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-primary transition-colors"
            >
              Collapse All
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input 
              type="text"
              placeholder="Search categories or services..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-12 pr-6 py-3 bg-card-bg border border-border-base rounded-2xl text-sm font-bold text-text-primary outline-none focus:ring-2 focus:ring-primary/20 w-full md:w-80"
            />
          </div>
          <button className="p-3 bg-bg-secondary border border-border-base rounded-2xl text-text-secondary hover:text-primary transition-colors">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* Categories Accordion */}
      <div className="space-y-4">
        {filteredCategories.map((category) => (
          <div 
            key={category.id}
            className={cn(
              "bg-card-bg rounded-[2.5rem] border transition-all duration-500 overflow-hidden",
              (expandedId === category.id || expandedId === 'all') ? "border-primary/30 shadow-2xl shadow-primary/5" : "border-border-base shadow-sm"
            )}
          >
            {/* Accordion Header */}
            <div 
              onClick={() => toggleAccordion(category.id)}
              className={cn(
                "p-8 flex items-center justify-between cursor-pointer transition-colors",
                (expandedId === category.id || expandedId === 'all') ? "bg-bg-secondary" : "hover:bg-bg-secondary/50"
              )}
            >
              <div className="flex items-center gap-6">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg",
                  category.color
                )}>
                  <Zap size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tighter text-text-primary">{category.name}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                      {category.subServices.length} Services
                    </span>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        category.demand === 'High' ? "bg-red-500" : category.demand === 'Medium' ? "bg-amber-500" : "bg-green-500"
                      )} />
                      <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                        {category.demand} Demand
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="hidden xl:flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-0.5">Visit Charge</p>
                    <p className="text-lg font-black text-text-primary">₹{category.baseCharge}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-0.5">Multiplier</p>
                    <p className="text-lg font-black text-amber-500">{category.multiplier}x</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-0.5">GST</p>
                    <p className="text-lg font-black text-green-500">{category.gstPercent}%</p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center text-text-secondary">
                  {(expandedId === category.id || expandedId === 'all') ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </div>
              </div>
            </div>

            {/* Accordion Content */}
            <AnimatePresence>
              {(expandedId === category.id || expandedId === 'all') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                >
                  <div className="p-8 border-t border-border-base space-y-10">
                    {/* Category Settings Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                      <div className="p-5 bg-bg-secondary rounded-3xl border border-border-base space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Base Visit Charge</p>
                          <Receipt className="text-primary" size={14} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-text-secondary">₹</span>
                          <input 
                            type="number"
                            value={category.baseCharge}
                            onChange={e => updateCategorySettings(category.id, { baseCharge: Number(e.target.value) })}
                            className="bg-transparent font-black text-text-primary outline-none w-full text-lg"
                          />
                        </div>
                      </div>

                      <div className="p-5 bg-bg-secondary rounded-3xl border border-border-base space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Min Booking Price</p>
                          <AlertTriangle className="text-amber-500" size={14} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-text-secondary">₹</span>
                          <input 
                            type="number"
                            value={category.minimumBooking}
                            onChange={e => updateCategorySettings(category.id, { minimumBooking: Number(e.target.value) })}
                            className="bg-transparent font-black text-text-primary outline-none w-full text-lg"
                          />
                        </div>
                      </div>

                      <div className="p-5 bg-bg-secondary rounded-3xl border border-border-base space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Commission %</p>
                          <TrendingUp className="text-indigo-500" size={14} />
                        </div>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number"
                            value={category.commissionPercent}
                            onChange={e => updateCategorySettings(category.id, { commissionPercent: Number(e.target.value) })}
                            className="bg-transparent font-black text-text-primary outline-none w-16 text-lg"
                          />
                          <span className="text-sm font-bold text-text-secondary">%</span>
                        </div>
                      </div>

                      <div className="p-5 bg-bg-secondary rounded-3xl border border-border-base space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Multiplier (Surge)</p>
                          <TrendingUp className={category.multiplier > 1 ? "text-amber-500" : "text-text-secondary"} size={14} />
                        </div>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number"
                            step="0.1"
                            value={category.multiplier}
                            onChange={e => updateCategorySettings(category.id, { multiplier: Number(e.target.value) })}
                            className="bg-transparent font-black text-text-primary outline-none w-16 text-lg"
                          />
                          <span className="text-sm font-bold text-text-secondary">x</span>
                        </div>
                      </div>

                      <div className="p-5 bg-bg-secondary rounded-3xl border border-border-base space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Discount %</p>
                          <Percent className="text-primary" size={14} />
                        </div>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number"
                            value={category.discountPercent}
                            onChange={e => updateCategorySettings(category.id, { discountPercent: Number(e.target.value) })}
                            className="bg-transparent font-black text-text-primary outline-none w-16 text-lg"
                          />
                          <span className="text-sm font-bold text-text-secondary">%</span>
                        </div>
                      </div>

                      <div className="p-5 bg-bg-secondary rounded-3xl border border-border-base space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">GST %</p>
                          <Receipt className="text-green-500" size={14} />
                        </div>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number"
                            value={category.gstPercent}
                            onChange={e => updateCategorySettings(category.id, { gstPercent: Number(e.target.value) })}
                            className="bg-transparent font-black text-text-primary outline-none w-16 text-lg"
                          />
                          <span className="text-sm font-bold text-text-secondary">%</span>
                        </div>
                      </div>

                      <div className="p-5 bg-bg-secondary rounded-3xl border border-border-base flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Featured</p>
                          <p className="text-xs font-black text-text-primary">{category.isFeatured ? 'Yes' : 'No'}</p>
                        </div>
                        <button 
                          onClick={() => updateCategorySettings(category.id, { isFeatured: !category.isFeatured })}
                          className={cn(
                            "w-10 h-5 rounded-full relative transition-all",
                            category.isFeatured ? "bg-primary" : "bg-border-base"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all",
                            category.isFeatured ? "left-5.5" : "left-0.5"
                          )} />
                        </button>
                      </div>

                      <div className="p-5 bg-bg-secondary rounded-3xl border border-border-base flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Active</p>
                          <p className="text-xs font-black text-text-primary">{category.isActive ? 'Active' : 'Disabled'}</p>
                        </div>
                        <button 
                          onClick={() => updateCategorySettings(category.id, { isActive: !category.isActive })}
                          className={cn(
                            "w-10 h-5 rounded-full relative transition-all",
                            category.isActive ? "bg-green-500" : "bg-border-base"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all",
                            category.isActive ? "left-5.5" : "left-0.5"
                          )} />
                        </button>
                      </div>

                      <div className="p-5 bg-primary/5 rounded-3xl border border-primary/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Bulk Update %</p>
                          <PlusCircle className="text-primary" size={14} />
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number"
                            value={bulkUpdateValue}
                            onChange={e => setBulkUpdateValue(Number(e.target.value))}
                            placeholder="±%"
                            className="bg-transparent font-black text-text-primary outline-none w-12 text-lg"
                          />
                          <button 
                            onClick={() => handleBulkUpdate(category.id)}
                            className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Sub-Services Table */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-text-primary uppercase tracking-widest">Service Catalog</h4>
                        <button 
                          onClick={() => setShowAddSub(category.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-all"
                        >
                          <PlusCircle size={16} /> Add Service
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {category.subServices.map((sub) => (
                          <div 
                            key={sub.id}
                            className={cn(
                              "p-6 bg-bg-secondary rounded-3xl border border-border-base flex flex-col md:flex-row md:items-center justify-between gap-6 group transition-all",
                              !sub.isActive && "opacity-50 grayscale"
                            )}
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center",
                                sub.isActive ? "bg-primary/10 text-primary" : "bg-text-secondary/10 text-text-secondary"
                              )}>
                                {sub.isPopular ? <Star size={20} fill="currentColor" /> : <Zap size={20} />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className="font-black text-text-primary">{sub.name}</h5>
                                  {sub.isPopular && (
                                    <span className="px-2 py-0.5 bg-amber-500 text-white rounded text-[8px] font-black uppercase tracking-tighter shadow-sm">Popular Service</span>
                                  )}
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                                    sub.pricingType === 'Fixed' ? "bg-green-100 text-green-600" : 
                                    sub.pricingType === 'Onwards' ? "bg-blue-100 text-blue-600" : 
                                    "bg-indigo-100 text-indigo-600"
                                  )}>
                                    {sub.pricingType}
                                  </span>
                                </div>
                                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-0.5">
                                  ID: {sub.id} • {sub.isActive ? 'Active' : 'Inactive'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-8">
                              <div className="text-right min-w-[100px]">
                                <p className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-0.5">Min Price</p>
                                <div className="flex items-center gap-1 justify-end">
                                  <span className="text-xs font-bold text-text-secondary">₹</span>
                                  <input 
                                    type="number"
                                    defaultValue={sub.minPrice}
                                    onBlur={(e) => handleUpdateSub(category.id, sub.id, { minPrice: Number(e.target.value) })}
                                    className="w-16 bg-transparent text-right font-bold text-text-primary outline-none border-b border-transparent hover:border-border-base focus:border-primary"
                                  />
                                </div>
                              </div>

                              <div className="text-right min-w-[100px]">
                                <p className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-0.5">Max Price</p>
                                <div className="flex items-center gap-1 justify-end">
                                  <span className="text-xs font-bold text-text-secondary">₹</span>
                                  <input 
                                    type="number"
                                    defaultValue={sub.maxPrice}
                                    onBlur={(e) => handleUpdateSub(category.id, sub.id, { maxPrice: Number(e.target.value) })}
                                    className="w-16 bg-transparent text-right font-bold text-text-primary outline-none border-b border-transparent hover:border-border-base focus:border-primary"
                                  />
                                </div>
                              </div>

                              <div className="text-right min-w-[140px]">
                                <p className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-0.5">Base Price</p>
                                {editingSubId === sub.id ? (
                                  <div className="flex flex-col gap-2 items-end">
                                    <div className="flex items-center gap-2 justify-end">
                                      <span className="text-text-primary font-black">₹</span>
                                      <input 
                                        type="number"
                                        autoFocus
                                        defaultValue={sub.basePrice}
                                        onBlur={(e) => handleUpdateSub(category.id, sub.id, { basePrice: Number(e.target.value) })}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleUpdateSub(category.id, sub.id, { basePrice: Number((e.target as HTMLInputElement).value) });
                                          if (e.key === 'Escape') setEditingSubId(null);
                                        }}
                                        className="w-24 bg-card-bg border border-border-base rounded-lg px-2 py-1 text-right font-black text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                                      />
                                    </div>
                                    <select 
                                      className="text-[10px] bg-bg-secondary border border-border-base rounded px-1 py-0.5 font-bold outline-none"
                                      defaultValue={sub.pricingType}
                                      onChange={(e) => handleUpdateSub(category.id, sub.id, { pricingType: e.target.value as any })}
                                    >
                                      <option value="Fixed">Fixed</option>
                                      <option value="Onwards">Onwards</option>
                                      <option value="Custom">Custom</option>
                                    </select>
                                  </div>
                                ) : (
                                  <div 
                                    onClick={() => setEditingSubId(sub.id)}
                                    className="cursor-pointer hover:text-primary transition-colors flex flex-col items-end"
                                  >
                                    <p className="text-xl font-black text-text-primary">
                                      {sub.pricingType === 'Custom' ? 'Custom' : `₹${sub.basePrice}`}
                                      {sub.pricingType === 'Onwards' && <span className="text-xs ml-1">onwards</span>}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => setPreviewService({ catId: category.id, subId: sub.id })}
                                  className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all"
                                  title="Price Preview"
                                >
                                  <Eye size={20} />
                                </button>
                                <button 
                                  onClick={() => handleResetSub(category.id, sub.id)}
                                  className="p-2 bg-text-secondary/10 text-text-secondary rounded-xl hover:bg-primary/10 hover:text-primary transition-all"
                                  title="Reset to Default Price"
                                >
                                  <RotateCcw size={20} />
                                </button>
                                <button 
                                  onClick={() => handleUpdateSub(category.id, sub.id, { isActive: !sub.isActive })}
                                  className={cn(
                                    "p-2 rounded-xl transition-all",
                                    sub.isActive ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" : "bg-text-secondary/10 text-text-secondary hover:bg-text-secondary/20"
                                  )}
                                  title={sub.isActive ? "Deactivate" : "Activate"}
                                >
                                  {sub.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                </button>
                                <button 
                                  onClick={() => handleUpdateSub(category.id, sub.id, { isPopular: !sub.isPopular })}
                                  className={cn(
                                    "p-2 rounded-xl transition-all",
                                    sub.isPopular ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" : "bg-text-secondary/10 text-text-secondary hover:bg-text-secondary/20"
                                  )}
                                  title="Toggle Popular"
                                >
                                  <Star size={20} fill={sub.isPopular ? "currentColor" : "none"} />
                                </button>
                                <button 
                                  onClick={() => deleteSubService(category.id, sub.id)}
                                  className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all"
                                  title="Delete"
                                >
                                  <Trash2 size={20} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Add New Service Form */}
                        <AnimatePresence>
                          {showAddSub === category.id && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-8 bg-card-bg rounded-3xl border-2 border-dashed border-primary/30 space-y-6"
                            >
                              <div className="flex items-center justify-between">
                                <h5 className="text-sm font-black text-text-primary uppercase tracking-widest">New Service Details</h5>
                                <button onClick={() => setShowAddSub(null)} className="text-text-secondary hover:text-red-500"><X size={20} /></button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Service Name</label>
                                  <input 
                                    type="text"
                                    value={newSubData.name}
                                    onChange={e => setNewSubData({...newSubData, name: e.target.value})}
                                    placeholder="e.g. Deep Cleaning"
                                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm font-bold text-text-primary outline-none"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Base Price (₹)</label>
                                  <input 
                                    type="number"
                                    value={newSubData.price}
                                    onChange={e => setNewSubData({...newSubData, price: Number(e.target.value)})}
                                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm font-bold text-text-primary outline-none"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Min Price (₹)</label>
                                  <input 
                                    type="number"
                                    value={newSubData.minPrice}
                                    onChange={e => setNewSubData({...newSubData, minPrice: Number(e.target.value)})}
                                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm font-bold text-text-primary outline-none"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Max Price (₹)</label>
                                  <input 
                                    type="number"
                                    value={newSubData.maxPrice}
                                    onChange={e => setNewSubData({...newSubData, maxPrice: Number(e.target.value)})}
                                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm font-bold text-text-primary outline-none"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Pricing Type</label>
                                  <select 
                                    value={newSubData.pricingType}
                                    onChange={e => setNewSubData({...newSubData, pricingType: e.target.value as any})}
                                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm font-bold text-text-primary outline-none"
                                  >
                                    <option value="Fixed">Fixed</option>
                                    <option value="Onwards">Onwards</option>
                                    <option value="Custom">Custom</option>
                                  </select>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <button 
                                  onClick={() => setNewSubData({...newSubData, isPopular: !newSubData.isPopular})}
                                  className={cn(
                                    "px-8 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                                    newSubData.isPopular ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "bg-bg-secondary text-text-secondary border border-border-base"
                                  )}
                                >
                                  <Star size={14} fill={newSubData.isPopular ? "currentColor" : "none"} /> Popular
                                </button>
                                <button 
                                  onClick={() => handleAddSub(category.id)}
                                  className="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                                >
                                  <Check size={18} /> Add to Catalog
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {filteredCategories.length === 0 && (
          <div className="py-20 text-center bg-bg-secondary rounded-[2.5rem] border border-dashed border-border-base">
            <div className="w-20 h-20 bg-card-bg rounded-full flex items-center justify-center mx-auto mb-6 text-text-secondary">
              <AlertTriangle size={40} />
            </div>
            <h3 className="text-2xl font-black tracking-tighter text-text-primary">No results found</h3>
            <p className="text-text-secondary font-medium mt-2">Try adjusting your search query or filters.</p>
          </div>
        )}
      </div>

      {/* Price Preview Modal */}
      <AnimatePresence>
        {previewService && (() => {
          const cat = categories.find(c => c.id === previewService.catId);
          const sub = cat?.subServices.find(s => s.id === previewService.subId);
          if (!cat || !sub) return null;

          const base = sub.basePrice;
          const visit = cat.baseCharge;
          const multiplier = cat.multiplier;
          const discountPercent = cat.discountPercent;
          const gstPercent = cat.gstPercent;

          const subtotalBeforeDiscount = (base + visit) * multiplier;
          const discountAmount = subtotalBeforeDiscount * (discountPercent / 100);
          const subtotalAfterDiscount = subtotalBeforeDiscount - discountAmount;
          const taxAmount = subtotalAfterDiscount * (gstPercent / 100);
          const total = subtotalAfterDiscount + taxAmount;

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPreviewService(null)}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-card-bg rounded-[2.5rem] shadow-2xl overflow-hidden border border-border-base"
              >
                <div className="p-8 border-b border-border-base bg-bg-secondary flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                      <Calculator size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tighter text-text-primary">Price Preview</h3>
                      <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{cat.name} • {sub.name}</p>
                    </div>
                  </div>
                  <button onClick={() => setPreviewService(null)} className="p-2 hover:bg-card-bg rounded-xl text-text-secondary transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-border-base border-dashed">
                      <span className="text-sm font-medium text-text-secondary">Service Base Price</span>
                      <span className="text-sm font-black text-text-primary">₹{base}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border-base border-dashed">
                      <span className="text-sm font-medium text-text-secondary">Category Visit Charge</span>
                      <span className="text-sm font-black text-text-primary">+ ₹{visit}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border-base border-dashed">
                      <span className="text-sm font-medium text-text-secondary">Surge Multiplier</span>
                      <span className="text-sm font-black text-amber-500">x {multiplier}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border-base border-dashed">
                      <span className="text-sm font-medium text-text-secondary">Category Discount ({discountPercent}%)</span>
                      <span className="text-sm font-black text-red-500">- ₹{discountAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border-base border-dashed">
                      <span className="text-sm font-medium text-text-secondary">GST ({gstPercent}%)</span>
                      <span className="text-sm font-black text-green-500">+ ₹{taxAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="p-6 bg-primary/5 rounded-3xl border border-primary/20 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Final Customer Price</p>
                      <h4 className="text-3xl font-black text-primary">₹{Math.round(total)}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Min. Booking</p>
                      <p className="text-sm font-black text-text-primary">₹{cat.minimumBooking}</p>
                    </div>
                  </div>

                  {total < cat.minimumBooking && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
                      <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                      <p className="text-xs font-medium text-amber-700">
                        Warning: Final price is below minimum booking amount. Customer will be charged ₹{cat.minimumBooking}.
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-8 bg-bg-secondary border-t border-border-base">
                  <button 
                    onClick={() => setPreviewService(null)}
                    className="w-full py-4 bg-white text-text-primary border border-border-base rounded-2xl font-black text-sm hover:bg-card-bg transition-all"
                  >
                    Close Preview
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
