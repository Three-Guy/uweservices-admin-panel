import React, { useState, useMemo } from 'react';
import { useStore } from '../../store/StoreContext';
import { 
  IndianRupee, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Zap,
  Calendar,
  Info
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function ProviderPricingPanel() {
  const { providers, categories, providerPricings, updateProviderPrice, isDark } = useStore();
  
  // Mocking "Current Provider" - In a real app, this would come from auth
  const currentProvider = providers[0]; 
  const providerCategory = categories.find(c => c.name === currentProvider.category);
  
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const providerServices = useMemo(() => {
    if (!providerCategory) return [];
    return providerCategory.subServices;
  }, [providerCategory]);

  const getPricingStatus = (serviceId: string) => {
    return providerPricings.find(p => p.providerId === currentProvider.id && p.serviceId === serviceId);
  };

  const handlePriceChange = (serviceId: string, value: number) => {
    setEditingPrices(prev => ({ ...prev, [serviceId]: value }));
  };

  const handleSave = (serviceId: string, basePrice: number, min: number, max: number) => {
    const price = editingPrices[serviceId] || basePrice;
    
    if (price < min || price > max) {
      alert(`Price must be between ₹${min} and ₹${max}`);
      return;
    }

    updateProviderPrice({
      providerId: currentProvider.id,
      serviceId,
      categoryId: providerCategory!.id,
      providerPrice: price,
    });

    setSuccessMsg(`Price update for service requested!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  if (!currentProvider || !providerCategory) return <div>Loading...</div>;

  return (
    <div className="p-8 space-y-12 max-w-[1400px] mx-auto w-full pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-text-primary">My Service Pricing</h1>
          <p className="text-text-secondary mt-2 font-medium text-lg">Manage your custom rates for {providerCategory.name} services.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-6 py-3 bg-indigo-500/10 text-indigo-500 rounded-2xl border border-indigo-500/20 flex items-center gap-2">
            <TrendingUp size={20} />
            <span className="font-black text-sm uppercase tracking-widest">Commission: {providerCategory.commissionPercent}%</span>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card-bg p-8 rounded-[2.5rem] border border-border-base shadow-sm">
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">Total Earnings</p>
          <h3 className="text-4xl font-black text-text-primary">₹{(currentProvider.paymentReceived).toLocaleString()}</h3>
          <p className="text-xs text-green-500 font-bold mt-2 flex items-center gap-1">
            <TrendingUp size={12} /> +12.5% this month
          </p>
        </div>
        <div className="bg-card-bg p-8 rounded-[2.5rem] border border-border-base shadow-sm">
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">Commission Paid</p>
          <h3 className="text-4xl font-black text-red-500">₹{(currentProvider.paymentReceived * (providerCategory.commissionPercent / 100)).toLocaleString()}</h3>
          <p className="text-xs text-text-secondary font-bold mt-2">Automatically deducted from payouts</p>
        </div>
        <div className="bg-text-primary text-card-bg p-8 rounded-[2.5rem] shadow-2xl">
          <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mb-2">Net Payout</p>
          <h3 className="text-4xl font-black">₹{(currentProvider.paymentReceived * (1 - providerCategory.commissionPercent / 100)).toLocaleString()}</h3>
          <p className="text-xs opacity-70 font-bold mt-2">Settled every Tuesday</p>
        </div>
      </div>

      {/* Services List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tighter text-text-primary">Assigned Services</h2>
          <div className="flex items-center gap-2 text-xs font-bold text-text-secondary">
            <Info size={14} />
            <span>Prices must be within the Admin defined range</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {providerServices.map((service) => {
            const pricing = getPricingStatus(service.id);
            const currentPrice = editingPrices[service.id] ?? (pricing?.providerPrice || service.basePrice);
            const commission = currentPrice * (providerCategory.commissionPercent / 100);
            const netEarning = currentPrice - commission;

            return (
              <div 
                key={service.id}
                className="p-8 bg-card-bg rounded-[2.5rem] border border-border-base shadow-sm hover:shadow-xl transition-all group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-3xl flex items-center justify-center">
                      <Zap size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tighter text-text-primary">{service.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="px-3 py-1 bg-bg-secondary border border-border-base rounded-lg text-[10px] font-black uppercase tracking-widest text-text-secondary">
                          Range: ₹{service.minPrice} - ₹{service.maxPrice}
                        </span>
                        {pricing?.isPending && (
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-500">
                            <Clock size={12} /> Pending Approval
                          </span>
                        )}
                        {pricing?.isApproved && (
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-green-500">
                            <CheckCircle2 size={12} /> Live Rate
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-8">
                    {/* Price Input */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Your Rate (₹)</p>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                          <input 
                            type="number"
                            value={currentPrice}
                            onChange={(e) => handlePriceChange(service.id, Number(e.target.value))}
                            className="pl-12 pr-4 py-4 bg-bg-secondary border border-border-base rounded-2xl text-lg font-black text-text-primary outline-none focus:ring-2 focus:ring-primary/20 w-40"
                          />
                        </div>
                        <button 
                          onClick={() => handleSave(service.id, service.basePrice, service.minPrice, service.maxPrice)}
                          className="p-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
                        >
                          <Save size={24} />
                        </button>
                      </div>
                    </div>

                    {/* Earnings Preview */}
                    <div className="flex items-center gap-6 px-8 py-4 bg-bg-secondary rounded-3xl border border-border-base">
                      <div className="text-center">
                        <p className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-1">Commission</p>
                        <p className="text-sm font-black text-red-500">-₹{Math.round(commission)}</p>
                      </div>
                      <div className="w-px h-8 bg-border-base" />
                      <div className="text-center">
                        <p className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-1">Your Earning</p>
                        <p className="text-xl font-black text-green-500">₹{Math.round(netEarning)}</p>
                      </div>
                    </div>

                    {/* Additional Settings */}
                    <div className="flex items-center gap-2">
                      <button className="p-4 bg-bg-secondary border border-border-base rounded-2xl text-text-secondary hover:text-primary transition-colors" title="Weekend Pricing">
                        <Calendar size={20} />
                      </button>
                      <button className="p-4 bg-bg-secondary border border-border-base rounded-2xl text-text-secondary hover:text-amber-500 transition-colors" title="Surge Pricing">
                        <TrendingUp size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 bg-text-primary text-card-bg rounded-2xl shadow-2xl font-black text-sm flex items-center gap-3 z-50"
          >
            <CheckCircle2 className="text-green-500" size={20} />
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
