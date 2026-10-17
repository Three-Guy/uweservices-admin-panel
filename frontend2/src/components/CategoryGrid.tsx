import React, { useState, useMemo } from 'react';
import { 
  Brush, 
  Zap, 
  Droplets, 
  Truck, 
  Scissors, 
  SprayCan,
  Bug,
  ShieldCheck,
  UserCheck,
  Wrench,
  Home,
  X,
  TrendingUp,
  BarChart3,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trophy,
  Flower2,
  Hammer,
  Sparkles,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useStore } from '../store/StoreContext';

interface CategoryData {
  icon: any;
  label: string;
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
  revenue: string;
  topProvider: string;
  color: string;
}

const categories: CategoryData[] = [
  { icon: SprayCan, label: 'Cleaning', total: 4200, completed: 3800, pending: 300, cancelled: 100, revenue: '₹8.4L', topProvider: 'Aman Sharma', color: 'bg-primary' },
  { icon: Droplets, label: 'Plumbing', total: 1800, completed: 1500, pending: 200, cancelled: 100, revenue: '₹3.6L', topProvider: 'Vikram Singh', color: 'bg-green-500' },
  { icon: Zap, label: 'Electrical', total: 2100, completed: 1800, pending: 200, cancelled: 100, revenue: '₹4.2L', topProvider: 'Rahul Khan', color: 'bg-indigo-500' },
  { icon: Scissors, label: 'Home Salon', total: 3200, completed: 3000, pending: 150, cancelled: 50, revenue: '₹6.4L', topProvider: 'Anjali Rao', color: 'bg-pink-500' },
  { icon: Flower2, label: 'Gardening', total: 1100, completed: 950, pending: 100, cancelled: 50, revenue: '₹2.2L', topProvider: 'Suresh G.', color: 'bg-emerald-500' },
  { icon: Brush, label: 'Painting', total: 1500, completed: 1200, pending: 200, cancelled: 100, revenue: '₹12.5L', topProvider: 'Suresh M.', color: 'bg-amber-500' },
  { icon: Bug, label: 'Pest Control', total: 1200, completed: 1100, pending: 80, cancelled: 20, revenue: '₹2.8L', topProvider: 'Priya Varma', color: 'bg-purple-500' },
  { icon: Truck, label: 'Moving Service', total: 940, completed: 800, pending: 100, cancelled: 40, revenue: '₹15.2L', topProvider: 'Karan J.', color: 'bg-blue-500' },
  { icon: Hammer, label: 'Carpentry', total: 1400, completed: 1250, pending: 100, cancelled: 50, revenue: '₹3.1L', topProvider: 'Manoj C.', color: 'bg-orange-500' },
  { icon: Wrench, label: 'Appliance Repair', total: 2800, completed: 2500, pending: 200, cancelled: 100, revenue: '₹5.6L', topProvider: 'Rahul K.', color: 'bg-cyan-500' },
  { icon: Home, label: 'Roofing Service', total: 320, completed: 280, pending: 30, cancelled: 10, revenue: '₹35.2L', topProvider: 'Sanya M.', color: 'bg-slate-500' },
  { icon: ShieldCheck, label: 'Home Security', total: 850, completed: 780, pending: 50, cancelled: 20, revenue: '₹22.4L', topProvider: 'Rajesh K.', color: 'bg-red-500' },
];

export function CategoryGrid() {
  const { categories: storeCategories } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<CategoryData | null>(null);

  const selectedStoreCategory = useMemo(() => {
    if (!selectedCategory) return null;
    return storeCategories.find(c => c.name === selectedCategory.label);
  }, [selectedCategory, storeCategories]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-text-primary">Service Categories</h2>
          <p className="text-text-secondary font-medium">Performance metrics across all service verticals.</p>
        </div>
        <button className="px-4 py-2 bg-bg-secondary text-text-secondary rounded-xl text-xs font-bold hover:bg-card-bg transition-all border border-border-base">
          Manage Verticals
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6">
        {categories.map((cat) => (
          <motion.div 
            key={cat.label}
            whileHover={{ y: -5 }}
            onClick={() => setSelectedCategory(cat)}
            className="bg-card-bg p-6 rounded-3xl border border-border-base shadow-sm hover:shadow-xl hover:border-primary/20 transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg",
              cat.color,
              "text-white"
            )}>
              <cat.icon size={24} />
            </div>
            
            <h4 className="font-black text-lg text-text-primary mb-1">{cat.label}</h4>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl font-black text-primary">{cat.revenue}</span>
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Revenue</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border-base">
              <div>
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Bookings</p>
                <p className="font-bold text-text-primary">{cat.total.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Success</p>
                <p className="font-bold text-green-500">{Math.round((cat.completed / cat.total) * 100)}%</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-bg-secondary flex items-center justify-center">
                <Trophy size={12} className="text-amber-500" />
              </div>
              <p className="text-[10px] font-bold text-text-secondary truncate">{cat.topProvider}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detailed Analytics Modal */}
      <AnimatePresence>
        {selectedCategory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCategory(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-card-bg rounded-[2.5rem] shadow-2xl overflow-hidden border border-border-base"
            >
              <div className={cn("h-32 p-8 flex items-end justify-between", selectedCategory.color)}>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-xl">
                    <selectedCategory.icon size={32} />
                  </div>
                  <div className="text-white">
                    <h3 className="text-3xl font-black tracking-tighter leading-none">{selectedCategory.label}</h3>
                    <p className="text-white/70 font-bold text-sm mt-1 uppercase tracking-widest">Detailed Analytics</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-bg-secondary rounded-2xl border border-border-base">
                    <div className="flex items-center gap-2 text-text-secondary mb-1">
                      <BarChart3 size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Total</span>
                    </div>
                    <p className="text-xl font-black text-text-primary">{selectedCategory.total}</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-100 dark:border-green-900/30">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                      <CheckCircle2 size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Completed</span>
                    </div>
                    <p className="text-xl font-black text-green-700 dark:text-green-300">{selectedCategory.completed}</p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                      <Clock size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Pending</span>
                    </div>
                    <p className="text-xl font-black text-amber-700 dark:text-amber-300">{selectedCategory.pending}</p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
                      <AlertCircle size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Cancelled</span>
                    </div>
                    <p className="text-xl font-black text-red-700 dark:text-red-300">{selectedCategory.cancelled}</p>
                  </div>
                </div>

                <div className="bg-text-primary rounded-3xl p-6 text-card-bg flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-text-secondary opacity-70 uppercase tracking-widest mb-1">Top Performing Provider</p>
                    <h4 className="text-xl font-black">{selectedCategory.topProvider}</h4>
                  </div>
                  <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 text-white">
                    <Trophy size={24} />
                  </div>
                </div>

                {selectedStoreCategory && selectedStoreCategory.subServices && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
                      <Sparkles size={16} className="text-primary" /> Sub-Services & Pricing
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedStoreCategory.subServices.map(sub => (
                        <div key={sub.id} className="p-4 bg-bg-secondary rounded-2xl border border-border-base flex items-center justify-between group hover:border-primary/30 transition-all">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-text-primary">{sub.name}</span>
                              {sub.isPopular && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded text-[8px] font-black uppercase tracking-tighter">
                                  <Star size={8} fill="currentColor" /> Popular
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-0.5">Starting from</p>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-black text-primary">${sub.startingPrice}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-6 border-t border-border-base">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="text-green-500" size={20} />
                    <span className="text-sm font-bold text-text-secondary">Growth: +14.2% this week</span>
                  </div>
                  <button className="px-6 py-3 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all">
                    Generate Full Report
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
