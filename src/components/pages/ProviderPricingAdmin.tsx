import React, { useState, useMemo } from 'react';
import { useStore } from '../../store/StoreContext';
import { 
  Check, 
  X, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle,
  IndianRupee,
  User,
  Zap,
  ArrowUpRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function ProviderPricingAdmin() {
  const { providerPricings, providers, categories, approveProviderPrice, rejectProviderPrice, isDark } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');

  const pendingRequests = useMemo(() => {
    return providerPricings.filter(p => {
      const provider = providers.find(pr => pr.id === p.providerId);
      const category = categories.find(c => c.id === p.categoryId);
      const service = category?.subServices.find(s => s.id === p.serviceId);
      
      const matchesSearch = 
        provider?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service?.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = 
        filterStatus === 'All' || 
        (filterStatus === 'Pending' && p.isPending) ||
        (filterStatus === 'Approved' && p.isApproved && !p.isPending) ||
        (filterStatus === 'Rejected' && !p.isApproved && !p.isPending);

      return matchesSearch && matchesStatus;
    });
  }, [providerPricings, providers, categories, searchQuery, filterStatus]);

  const getProviderInfo = (providerId: string) => providers.find(p => p.id === providerId);
  const getServiceInfo = (categoryId: string, serviceId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.subServices.find(s => s.id === serviceId);
  };

  return (
    <div className="p-8 space-y-12 max-w-[1600px] mx-auto w-full pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-text-primary">Provider Price Approvals</h1>
          <p className="text-text-secondary mt-2 font-medium text-lg">Review and manage custom pricing requests from service providers.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-6 py-3 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/20 flex items-center gap-2">
            <Clock size={20} />
            <span className="font-black text-sm uppercase tracking-widest">{providerPricings.filter(p => p.isPending).length} Pending Requests</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card-bg p-6 rounded-3xl border border-border-base shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-1/3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input 
            type="text" 
            placeholder="Search provider or service..." 
            className="w-full pl-12 pr-4 py-4 border rounded-2xl text-sm outline-none transition-all bg-bg-secondary border-border-base text-text-primary focus:ring-2 focus:ring-primary/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 bg-bg-secondary p-1 rounded-2xl border border-border-base">
          {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                filterStatus === status ? "bg-text-primary text-card-bg shadow-lg" : "text-text-secondary hover:text-text-primary"
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="popLayout">
          {pendingRequests.map((request) => {
            const provider = getProviderInfo(request.providerId);
            const service = getServiceInfo(request.categoryId, request.serviceId);
            const category = categories.find(c => c.id === request.categoryId);

            if (!provider || !service || !category) return null;

            const priceDiff = request.providerPrice - service.basePrice;
            const diffPercent = (priceDiff / service.basePrice) * 100;

            return (
              <motion.div
                key={request.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card-bg rounded-[2.5rem] border border-border-base shadow-sm overflow-hidden group hover:border-primary/30 transition-all"
              >
                <div className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-bg-secondary rounded-3xl flex items-center justify-center text-text-secondary group-hover:text-primary transition-colors border border-border-base">
                      <User size={32} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-black tracking-tighter text-text-primary">{provider.name}</h3>
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest">
                          {category.name}
                        </span>
                      </div>
                      <p className="text-text-secondary font-bold mt-1 flex items-center gap-2">
                        <Zap size={14} className="text-amber-500" />
                        Requesting update for: <span className="text-text-primary">{service.name}</span>
                      </p>
                      <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest mt-2">
                        Requested on {request.updatedAt}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-10">
                    {/* Price Comparison */}
                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">Base Price</p>
                        <p className="text-xl font-black text-text-secondary">₹{service.basePrice}</p>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1",
                          priceDiff > 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                        )}>
                          {priceDiff > 0 ? <TrendingUp size={10} /> : <AlertCircle size={10} />}
                          {priceDiff > 0 ? '+' : ''}{diffPercent.toFixed(1)}%
                        </div>
                        <div className="h-px w-8 bg-border-base my-2" />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">New Price</p>
                        <p className="text-3xl font-black text-text-primary">₹{request.providerPrice}</p>
                      </div>
                    </div>

                    {/* Range Validation */}
                    <div className="px-6 py-3 bg-bg-secondary rounded-2xl border border-border-base">
                      <p className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-1">Allowed Range</p>
                      <p className="text-xs font-black text-text-primary">₹{service.minPrice} - ₹{service.maxPrice}</p>
                      <div className="w-full bg-border-base h-1.5 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded-full" 
                          style={{ 
                            width: `${((request.providerPrice - service.minPrice) / (service.maxPrice - service.minPrice)) * 100}%` 
                          }} 
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    {request.isPending ? (
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => approveProviderPrice(request.id)}
                          className="flex items-center gap-2 px-8 py-4 bg-green-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-green-500/20 hover:bg-green-600 transition-all"
                        >
                          <Check size={20} /> Approve
                        </button>
                        <button 
                          onClick={() => rejectProviderPrice(request.id)}
                          className="flex items-center gap-2 px-8 py-4 bg-red-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-red-500/20 hover:bg-red-600 transition-all"
                        >
                          <X size={20} /> Reject
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        {request.isApproved ? (
                          <div className="flex items-center gap-2 px-6 py-3 bg-green-500/10 text-green-500 rounded-2xl border border-green-500/20 font-black text-xs uppercase tracking-widest">
                            <CheckCircle2 size={16} /> Approved
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 font-black text-xs uppercase tracking-widest">
                            <XCircle size={16} /> Rejected
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {pendingRequests.length === 0 && (
          <div className="py-32 text-center bg-bg-secondary rounded-[3rem] border border-dashed border-border-base">
            <div className="w-24 h-24 bg-card-bg rounded-full flex items-center justify-center mx-auto mb-8 text-text-secondary">
              <CheckCircle2 size={48} />
            </div>
            <h3 className="text-3xl font-black tracking-tighter text-text-primary">All caught up!</h3>
            <p className="text-text-secondary font-medium text-lg mt-2">No pending price update requests to review.</p>
          </div>
        )}
      </div>
    </div>
  );
}
