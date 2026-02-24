import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store/StoreContext';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  Star, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  Clock, 
  XCircle,
  TrendingUp,
  IndianRupee,
  Trash2,
  Edit2,
  ArrowUpDown,
  Mail
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Provider, WorkStatus, PaymentMode } from '../../types';

export function ProvidersModule() {
  const { providers, addProvider, updateProvider, deleteProvider, toggleProviderStatus, isDark } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [sortBy, setSortBy] = useState<'rating' | 'paymentReceived'>('rating');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredProviders = useMemo(() => {
    let result = providers.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.phone.includes(searchQuery) ||
        p.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRating = !ratingFilter || p.rating >= 4.0;
      const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
      return matchesSearch && matchesRating && matchesCategory;
    });

    result.sort((a, b) => {
      if (sortBy === 'rating') {
        return sortOrder === 'desc' ? b.rating - a.rating : a.rating - b.rating;
      } else {
        return sortOrder === 'desc' ? b.paymentReceived - a.paymentReceived : a.paymentReceived - b.paymentReceived;
      }
    });

    return result;
  }, [providers, searchQuery, ratingFilter, categoryFilter, sortBy, sortOrder]);

  const totalEarnings = useMemo(() => providers.reduce((sum, p) => sum + p.paymentReceived, 0), [providers]);
  const activeCount = useMemo(() => providers.filter(p => p.status === 'Available').length, [providers]);

  return (
    <div className="p-8 space-y-12 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-text-primary">Service Providers</h1>
          <p className="text-text-secondary mt-1 font-medium">Manage your service partners, track performance, and verify payouts.</p>
        </div>
        <button 
          onClick={() => {
            setEditingProvider(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all"
        >
          <Plus size={18} />
          Add Provider
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card-bg p-6 rounded-3xl border border-border-base shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center">
            <IndianRupee size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Total Payouts</p>
            <h4 className="text-2xl font-black text-text-primary">₹{(totalEarnings / 100000).toFixed(2)}L</h4>
          </div>
        </div>
        <div className="bg-card-bg p-6 rounded-3xl border border-border-base shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Active Now</p>
            <h4 className="text-2xl font-black text-text-primary">{activeCount} / {providers.length}</h4>
          </div>
        </div>
        <div className="bg-card-bg p-6 rounded-3xl border border-border-base shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
            <Star size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Avg Rating</p>
            <h4 className="text-2xl font-black text-text-primary">4.6</h4>
          </div>
        </div>
      </div>

      <div className="bg-card-bg p-4 rounded-2xl border border-border-base shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, phone, or email..." 
            className="w-full pl-12 pr-4 py-3 border rounded-2xl text-sm outline-none transition-all bg-bg-secondary border-border-base text-text-primary focus:ring-primary/10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 hide-scrollbar">
          <div className="flex items-center gap-2 px-4 py-2.5 border rounded-2xl shrink-0 bg-bg-secondary border-border-base">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Sort By:</span>
            <select 
              className="bg-transparent text-xs font-bold text-text-primary outline-none cursor-pointer"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="rating">Rating</option>
              <option value="paymentReceived">Earnings</option>
            </select>
            <button 
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-1 hover:bg-card-bg rounded-lg transition-all text-text-secondary"
            >
              <ArrowUpDown size={14} />
            </button>
          </div>
          <button 
            onClick={() => setRatingFilter(!ratingFilter)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 border rounded-2xl text-xs font-bold transition-all shrink-0",
              ratingFilter 
                ? "bg-amber-50 border-amber-200 text-amber-600" 
                : "bg-bg-secondary border-border-base text-text-secondary"
            )}
          >
            <Star size={14} className={ratingFilter ? "fill-amber-500" : ""} />
            4+ Stars
          </button>

          <div className="flex items-center gap-2 px-4 py-2.5 border rounded-2xl shrink-0 bg-bg-secondary border-border-base">
            <Filter size={14} className="text-text-secondary" />
            <select 
              className="bg-transparent text-xs font-bold text-text-primary outline-none cursor-pointer"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              <option value="Cleaning">Cleaning</option>
              <option value="Electrical">Electrical</option>
              <option value="Painting">Painting</option>
              <option value="Plumbing">Plumbing</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-card-bg rounded-3xl border border-border-base shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-bg-secondary text-text-secondary border-b border-border-base">
              <tr>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px]">Provider Details</th>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px]">Contact Info</th>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px]">Category & Time</th>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px]">Location & Address</th>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px]">Rating</th>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px]">Status</th>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px]">Earnings</th>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px]">Performance</th>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-base">
              {filteredProviders.map((p) => (
                <tr key={p.id} className="hover:bg-bg-secondary transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {p.initials}
                      </div>
                      <div>
                        <p className="font-bold text-text-primary">{p.name}</p>
                        <p className="text-[10px] text-text-secondary font-medium">ID: {p.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                      <a href={`tel:${p.phone}`} className="block text-xs font-bold text-primary hover:underline">{p.phone}</a>
                      <a href={`mailto:${p.email}`} className="block text-[10px] text-text-secondary hover:underline">{p.email}</a>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                      <span className="px-2 py-1 bg-bg-secondary text-text-secondary rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        {p.category}
                      </span>
                      <div className="flex items-center gap-1 text-[10px] text-text-secondary font-bold">
                        <Clock size={10} />
                        {p.availableTimeStart} - {p.availableTimeEnd}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="max-w-[150px]">
                      <div className="flex items-center gap-1 text-xs font-bold text-text-primary">
                        <MapPin size={12} className="text-primary" />
                        {p.location}
                      </div>
                      <p className="text-[10px] text-text-secondary mt-1 line-clamp-1" title={p.address}>{p.address}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-1">
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                      <span className="font-bold text-text-primary">{p.rating}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <button 
                      onClick={() => toggleProviderStatus(p.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border",
                        p.status === 'Available' && "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30",
                        p.status === 'Busy' && "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30",
                        p.status === 'Offline' && "bg-bg-secondary text-text-secondary border-border-base"
                      )}
                    >
                      {p.status}
                    </button>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-black text-text-primary">₹{p.paymentReceived.toLocaleString()}</p>
                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">{p.paymentMode}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden min-w-[60px]">
                        <div className="h-full bg-primary" style={{ width: `${p.performance}%` }}></div>
                      </div>
                      <span className="text-xs font-bold text-text-secondary">{p.performance}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => deleteProvider(p.id)} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all">
                        <Trash2 size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingProvider(p);
                          setShowModal(true);
                        }}
                        className="p-2 text-text-secondary hover:bg-bg-secondary rounded-lg transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ProviderModal 
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingProvider(null);
        }}
        provider={editingProvider}
      />
    </div>
  );
}

interface ProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: Provider | null;
}

function ProviderModal({ isOpen, onClose, provider }: ProviderModalProps) {
  const { addProvider, updateProvider } = useStore();
  const [formData, setFormData] = useState<Partial<Provider>>({
    name: '',
    category: 'Cleaning',
    location: 'Bangalore',
    rating: 4.5,
    status: 'Available',
    paymentMode: 'UPI',
    phone: '',
    email: '',
    availableTimeStart: '09:00',
    availableTimeEnd: '18:00',
    address: '',
    contact: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (provider) {
      setFormData(provider);
    } else {
      setFormData({
        name: '',
        category: 'Cleaning',
        location: 'Bangalore',
        rating: 4.5,
        status: 'Available',
        paymentMode: 'UPI',
        phone: '',
        email: '',
        availableTimeStart: '09:00',
        availableTimeEnd: '18:00',
        address: '',
        contact: ''
      });
    }
    setErrors({});
  }, [provider, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = 'Name is required';
    
    if (!formData.phone) {
      newErrors.phone = 'Phone is required';
    } else if (!/^\d{10,15}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Invalid phone number (10-15 digits)';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.address || formData.address.length < 10) {
      newErrors.address = 'Address must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const dataToSubmit = {
      ...formData,
      contact: formData.phone // Sync contact with phone for legacy support
    };

    if (provider) {
      updateProvider(provider.id, dataToSubmit);
    } else {
      addProvider(dataToSubmit as any);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-card-bg rounded-[2.5rem] shadow-2xl overflow-hidden border border-border-base"
          >
            <div className="p-8 border-b border-border-base flex items-center justify-between bg-bg-secondary">
              <div>
                <h3 className="text-2xl font-black tracking-tighter text-text-primary">
                  {provider ? 'Edit Provider' : 'Add New Provider'}
                </h3>
                <p className="text-xs text-text-secondary font-bold uppercase tracking-widest mt-1">
                  Service Partner Details
                </p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-card-bg rounded-xl text-text-secondary transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Provider Name</label>
                  <input 
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g. Aman Sharma"
                  />
                  {errors.name && <p className="text-[10px] text-red-500 font-bold">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Category</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Cleaning">Cleaning</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Painting">Painting</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Pest Control">Pest Control</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Phone Number</label>
                  <input 
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g. 9876543210"
                  />
                  {errors.phone && <p className="text-[10px] text-red-500 font-bold">{errors.phone}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Email Address</label>
                  <input 
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g. aman@example.com"
                  />
                  {errors.email && <p className="text-[10px] text-red-500 font-bold">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Location</label>
                  <select 
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Bangalore">Bangalore</option>
                    <option value="Mumbai">Mumbai</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Pune">Pune</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Work Status</label>
                  <select 
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as WorkStatus})}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Available">Available</option>
                    <option value="Busy">Busy</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Rating</label>
                  <input 
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={formData.rating}
                    onChange={e => setFormData({...formData, rating: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Payment Mode</label>
                  <select 
                    value={formData.paymentMode}
                    onChange={e => setFormData({...formData, paymentMode: e.target.value as PaymentMode})}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Available From</label>
                  <input 
                    type="time"
                    value={formData.availableTimeStart}
                    onChange={e => setFormData({...formData, availableTimeStart: e.target.value})}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Available To</label>
                  <input 
                    type="time"
                    value={formData.availableTimeEnd}
                    onChange={e => setFormData({...formData, availableTimeEnd: e.target.value})}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Full Address</label>
                  <textarea 
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    rows={3}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    placeholder="Enter complete address details..."
                  />
                  {errors.address && <p className="text-[10px] text-red-500 font-bold">{errors.address}</p>}
                </div>
              </div>

              <div className="mt-10 flex gap-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-4 bg-bg-secondary text-text-primary rounded-2xl font-bold text-sm border border-border-base hover:bg-card-bg transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-[2] py-4 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all"
                >
                  {provider ? 'Update Provider' : 'Add Provider'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
