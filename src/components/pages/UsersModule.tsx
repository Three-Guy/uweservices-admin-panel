import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store/StoreContext';
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  MoreVertical, 
  ChevronLeft, 
  ChevronRight,
  User as UserIcon,
  MapPin,
  Calendar,
  CreditCard,
  Trash2,
  Edit2,
  XCircle,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { User, BookingStatus, PaymentMode } from '../../types';
import { format } from 'date-fns';

export function UsersModule() {
  const { users, addUser, updateUser, deleteUser, isDark } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [serviceFilter, setServiceFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'paymentAmount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const itemsPerPage = 10;

  const filteredUsers = useMemo(() => {
    let result = users.filter(u => {
      const matchesSearch = 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.phone.includes(searchQuery) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || u.status === statusFilter;
      const matchesService = serviceFilter === 'All' || u.serviceRequired === serviceFilter;
      return matchesSearch && matchesStatus && matchesService;
    });

    result.sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      } else {
        return sortOrder === 'desc' ? b.paymentAmount - a.paymentAmount : a.paymentAmount - b.paymentAmount;
      }
    });

    return result;
  }, [users, searchQuery, statusFilter, serviceFilter, sortBy, sortOrder]);

  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const exportToCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'Service', 'Time', 'Amount', 'Mode', 'Location', 'Address', 'Status', 'Date'];
    const rows = filteredUsers.map(u => [
      u.name, 
      u.phone, 
      u.email, 
      u.serviceRequired, 
      u.serviceTime,
      u.paymentAmount, 
      u.paymentMode, 
      u.location, 
      `"${u.address}"`,
      u.status, 
      u.date
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "users_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-text-primary">Users Management</h1>
          <p className="text-text-secondary mt-1 font-medium">Manage customer bookings, statuses, and payment records.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-card-bg border border-border-base rounded-xl text-sm font-bold text-text-primary hover:bg-bg-secondary transition-all"
          >
            <Download size={18} />
            Export CSV
          </button>
          <button 
            onClick={() => {
              setEditingUser(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all"
          >
            <Plus size={18} />
            Add User
          </button>
        </div>
      </div>

      <div className="bg-card-bg p-4 rounded-2xl border border-border-base shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between transition-colors duration-300">
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
              <option value="date">Date</option>
              <option value="paymentAmount">Payment</option>
            </select>
            <button 
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-1 hover:bg-card-bg rounded-lg transition-all text-text-secondary"
            >
              <ArrowUpDown size={14} />
            </button>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 border rounded-2xl shrink-0 bg-bg-secondary border-border-base">
            <Filter size={14} className="text-text-secondary" />
            <select 
              className="bg-transparent text-xs font-bold text-text-primary outline-none cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Success">Success</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-2 px-4 py-2.5 border rounded-2xl shrink-0 bg-bg-secondary border-border-base">
            <select 
              className="bg-transparent text-xs font-bold text-text-primary outline-none cursor-pointer"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
            >
              <option value="All">All Services</option>
              <option value="Cleaning">Cleaning</option>
              <option value="Electrical">Electrical</option>
              <option value="Painting">Painting</option>
              <option value="Plumbing">Plumbing</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-card-bg rounded-3xl border border-border-base shadow-sm overflow-hidden transition-colors duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-bg-secondary text-text-secondary border-b border-border-base">
              <tr>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px]">User Details</th>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px]">Contact Info</th>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px]">Service & Time</th>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px]">Payment</th>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px]">Location & Address</th>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px]">Status</th>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px]">Date</th>
                <th className="px-6 py-5 font-bold uppercase tracking-wider text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-base">
              {paginatedUsers.map((u) => (
                <tr key={u.id} className="hover:bg-bg-secondary transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {u.name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-text-primary">{u.name}</p>
                        <p className="text-[10px] text-text-secondary font-medium">ID: {u.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                      <a href={`tel:${u.phone}`} className="block text-xs font-bold text-primary hover:underline">{u.phone}</a>
                      <a href={`mailto:${u.email}`} className="block text-[10px] text-text-secondary hover:underline">{u.email}</a>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                      <span className="px-2 py-1 bg-bg-secondary text-text-secondary rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        {u.serviceRequired}
                      </span>
                      <div className="flex items-center gap-1 text-[10px] text-text-secondary font-bold">
                        <Clock size={10} />
                        {u.serviceTime}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-black text-text-primary">₹{u.paymentAmount.toLocaleString()}</p>
                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">{u.paymentMode}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="max-w-[200px]">
                      <div className="flex items-center gap-1 text-xs font-bold text-text-primary">
                        <MapPin size={12} className="text-primary" />
                        {u.location}
                      </div>
                      <p className="text-[10px] text-text-secondary mt-1 line-clamp-1" title={u.address}>{u.address}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      u.status === 'Success' && "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
                      u.status === 'Pending' && "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
                      u.status === 'Failed' && "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
                      u.status === 'Cancelled' && "bg-bg-secondary text-text-secondary"
                    )}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-text-secondary font-medium">{u.date}</td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => deleteUser(u.id)} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all">
                        <Trash2 size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingUser(u);
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
        
        <div className="px-6 py-5 bg-bg-secondary border-t border-border-base flex justify-between items-center">
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
            Showing {paginatedUsers.length} of {filteredUsers.length} users
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-border-base rounded-xl hover:bg-card-bg transition-all disabled:opacity-50 text-text-primary"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-border-base rounded-xl hover:bg-card-bg transition-all disabled:opacity-50 text-text-primary"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <UserModal 
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingUser(null);
        }}
        user={editingUser}
      />
    </div>
  );
}

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

function UserModal({ isOpen, onClose, user }: UserModalProps) {
  const { addUser, updateUser, categories } = useStore();
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    serviceRequired: 'Cleaning',
    paymentAmount: 0,
    paymentMode: 'UPI',
    location: 'Bangalore',
    status: 'Pending',
    date: format(new Date(), 'yyyy-MM-dd'),
    phone: '',
    email: '',
    serviceTime: '12:00',
    address: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      setFormData(user);
    } else {
      const defaultService = 'Cleaning';
      const category = categories.find(c => c.name === defaultService);
      const defaultSub = category?.subServices?.[0];
      setFormData({
        name: '',
        serviceRequired: defaultService,
        subService: defaultSub?.name || '',
        paymentAmount: defaultSub?.startingPrice || category?.currentPrice || 0,
        paymentMode: 'UPI',
        location: 'Bangalore',
        status: 'Pending',
        date: format(new Date(), 'yyyy-MM-dd'),
        phone: '',
        email: '',
        serviceTime: '12:00',
        address: ''
      });
    }
    setErrors({});
  }, [user, isOpen, categories]);

  const handleServiceChange = (service: string) => {
    const category = categories.find(c => c.name === service);
    const firstSub = category?.subServices?.find(s => s.isActive);
    
    let basePrice = firstSub?.startingPrice || category?.currentPrice || 0;
    
    // Apply category settings for preview
    const discount = category ? (basePrice * (category.discountPercent / 100)) : 0;
    const surge = category?.isSurgeEnabled ? (basePrice * (category.surgeMultiplier - 1)) : 0;
    const tax = category?.isTaxEnabled ? ((basePrice - discount + surge) * (category.gstPercent / 100)) : 0;
    const finalPrice = Math.round(basePrice - discount + surge + tax);

    setFormData({
      ...formData,
      serviceRequired: service,
      subService: firstSub?.name || '',
      paymentAmount: finalPrice
    });
  };

  const handleSubServiceChange = (subName: string) => {
    const category = categories.find(c => c.name === formData.serviceRequired);
    const sub = category?.subServices?.find(s => s.name === subName);
    
    let basePrice = sub?.startingPrice || 0;
    
    // Apply category settings for preview
    const discount = category ? (basePrice * (category.discountPercent / 100)) : 0;
    const surge = category?.isSurgeEnabled ? (basePrice * (category.surgeMultiplier - 1)) : 0;
    const tax = category?.isTaxEnabled ? ((basePrice - discount + surge) * (category.gstPercent / 100)) : 0;
    const finalPrice = Math.round(basePrice - discount + surge + tax);

    setFormData({
      ...formData,
      subService: subName,
      paymentAmount: finalPrice
    });
  };

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

    if (formData.date === format(new Date(), 'yyyy-MM-dd')) {
      const now = new Date();
      const [hours, minutes] = (formData.serviceTime || '00:00').split(':').map(Number);
      if (hours < now.getHours() || (hours === now.getHours() && minutes < now.getMinutes())) {
        newErrors.serviceTime = 'Service time cannot be in the past';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (user) {
      updateUser(user.id, formData);
    } else {
      addUser(formData as Omit<User, 'id'>);
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
                  {user ? 'Edit User' : 'Add New User'}
                </h3>
                <p className="text-xs text-text-secondary font-bold uppercase tracking-widest mt-1">
                  Customer Booking Details
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
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Full Name</label>
                  <input 
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g. Rajesh Gupta"
                  />
                  {errors.name && <p className="text-[10px] text-red-500 font-bold">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Service Required</label>
                  <select 
                    value={formData.serviceRequired}
                    onChange={e => handleServiceChange(e.target.value)}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Specific Service</label>
                  <select 
                    value={formData.subService}
                    onChange={e => handleSubServiceChange(e.target.value)}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select a service...</option>
                    {categories.find(c => c.name === formData.serviceRequired)?.subServices
                      .filter(s => s.isActive)
                      .map(s => (
                        <option key={s.id} value={s.name}>{s.name} {s.isPopular ? '⭐' : ''}</option>
                      ))
                    }
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Phone Number</label>
                  <input 
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g. 9988776655"
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
                    placeholder="e.g. rajesh@example.com"
                  />
                  {errors.email && <p className="text-[10px] text-red-500 font-bold">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Payment Amount (₹)</label>
                  <input 
                    type="number"
                    value={formData.paymentAmount}
                    onChange={e => setFormData({...formData, paymentAmount: Number(e.target.value)})}
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
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Booking Status</label>
                  <select 
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as BookingStatus})}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Success">Success</option>
                    <option value="Failed">Failed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Booking Date</label>
                  <input 
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Service Time</label>
                  <input 
                    type="time"
                    value={formData.serviceTime}
                    onChange={e => setFormData({...formData, serviceTime: e.target.value})}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border-base rounded-xl text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {errors.serviceTime && <p className="text-[10px] text-red-500 font-bold">{errors.serviceTime}</p>}
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
                  {user ? 'Update User' : 'Add User'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
