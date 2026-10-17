import React, { useState, useMemo } from 'react';
import { useStore } from '../../store/StoreContext';
import { 
  ArrowUpDown, 
  Download, 
  Filter, 
  Search, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Calendar,
  IndianRupee,
  FileText,
  CreditCard,
  Smartphone,
  Wallet,
  Building2,
  Banknote,
  ChevronRight,
  AlertCircle,
  RefreshCcw,
  Check,
  X,
  PieChart as PieIcon,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell as ReCell
} from 'recharts';
import { format, parseISO, isWithinInterval, subDays, startOfDay, endOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, PaymentMode, BookingStatus } from '../../types';

const COLORS = ['#ec5b13', '#6366f1', '#fbbf24', '#10b981', '#3b82f6', '#8b5cf6', '#f43f5e'];

export function TransactionsModule() {
  const { transactions, users, providers, isDark } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [modeFilter, setModeFilter] = useState<string>('All');
  const [dateRange, setDateRange] = useState<string>('All');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction, direction: 'asc' | 'desc' } | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  // Filtered & Sorted Data
  const filteredTransactions = useMemo(() => {
    let result = transactions.filter(t => {
      const matchesSearch = 
        t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.bookingId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.gatewayRefId?.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
      const matchesMode = modeFilter === 'All' || t.paymentMode === modeFilter;
      
      let matchesDate = true;
      if (dateRange !== 'All') {
        const tDate = parseISO(t.date);
        const today = new Date();
        if (dateRange === 'Today') {
          matchesDate = isWithinInterval(tDate, { start: startOfDay(today), end: endOfDay(today) });
        } else if (dateRange === 'Last 7 Days') {
          matchesDate = isWithinInterval(tDate, { start: subDays(today, 7), end: today });
        } else if (dateRange === 'Last 30 Days') {
          matchesDate = isWithinInterval(tDate, { start: subDays(today, 30), end: today });
        }
      }

      return matchesSearch && matchesStatus && matchesMode && matchesDate;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === undefined || bVal === undefined) return 0;
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [transactions, searchQuery, statusFilter, modeFilter, dateRange, sortConfig]);

  // Analytics Data
  const analytics = useMemo(() => {
    const totalRevenue = filteredTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
    
    const modeMap: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      modeMap[t.paymentMode] = (modeMap[t.paymentMode] || 0) + t.totalAmount;
    });
    const modeData = Object.entries(modeMap).map(([name, value]) => ({ name, value }));

    const statusMap: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      statusMap[t.status] = (statusMap[t.status] || 0) + 1;
    });
    const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

    return { totalRevenue, modeData, statusData };
  }, [filteredTransactions]);

  const handleSort = (key: keyof Transaction) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportData = () => {
    const headers = ['TXN ID', 'Booking ID', 'Customer', 'Category', 'Service', 'Mode', 'Amount', 'Status', 'Date', 'Time', 'Gateway Ref'];
    const csvContent = [
      headers.join(','),
      ...filteredTransactions.map(t => [
        t.id, t.bookingId, t.customerName, t.category, t.serviceName, t.paymentMode, t.totalAmount, t.status, t.date, t.time, t.gatewayRefId || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
  };

  const getStatusColor = (status: BookingStatus) => {
    switch (status) {
      case 'Success': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Pending': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Failed': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'Refunded': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Cancelled': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getModeIcon = (mode: PaymentMode) => {
    switch (mode) {
      case 'UPI': return <Smartphone size={14} />;
      case 'Credit Card':
      case 'Debit Card': return <CreditCard size={14} />;
      case 'Net Banking': return <Building2 size={14} />;
      case 'Cash': return <Banknote size={14} />;
      case 'Wallet': return <Wallet size={14} />;
      default: return <CreditCard size={14} />;
    }
  };

  return (
    <div className="p-8 space-y-12 max-w-[1600px] mx-auto w-full pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-text-primary">Payment Management</h1>
          <p className="text-text-secondary mt-2 font-medium text-lg">Comprehensive audit trail and financial reconciliation engine.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={exportData}
            className="flex items-center gap-2 px-8 py-4 bg-bg-secondary border border-border-base text-text-primary rounded-2xl font-black text-sm shadow-sm hover:bg-border-base transition-all"
          >
            <Download size={20} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Total Revenue Card */}
        <div className="lg:col-span-4 bg-text-primary text-card-bg p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[300px]">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <IndianRupee size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-primary/20 rounded-lg">
                <FileText className="text-primary" size={24} />
              </div>
              <span className="text-sm font-bold uppercase tracking-widest opacity-70">Total Revenue</span>
            </div>
            <h3 className="text-6xl font-black tracking-tighter">₹{analytics.totalRevenue.toLocaleString()}</h3>
            <p className="opacity-70 text-sm mt-2 font-medium">Gross platform volume from filtered transactions</p>
          </div>
          <div className="relative z-10 flex items-center gap-4 mt-8">
            <div className="flex-1 p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Success Rate</p>
              <p className="text-xl font-black">94.2%</p>
            </div>
            <div className="flex-1 p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Avg Ticket</p>
              <p className="text-xl font-black">₹{Math.round(analytics.totalRevenue / (filteredTransactions.length || 1))}</p>
            </div>
          </div>
        </div>

        {/* Revenue by Mode Chart */}
        <div className="lg:col-span-4 bg-card-bg p-8 rounded-[2.5rem] border border-border-base shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black tracking-tighter text-text-primary">Revenue by Mode</h3>
            <BarChart3 size={20} className="text-text-secondary" />
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.modeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: '#ec5b13', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" fill="#ec5b13" radius={[6, 6, 0, 0]}>
                  {analytics.modeData.map((entry, index) => (
                    <ReCell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Chart */}
        <div className="lg:col-span-4 bg-card-bg p-8 rounded-[2.5rem] border border-border-base shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black tracking-tighter text-text-primary">Transaction Status</h3>
            <PieIcon size={20} className="text-text-secondary" />
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {analytics.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={
                      entry.name === 'Success' ? '#10b981' : 
                      entry.name === 'Failed' ? '#f43f5e' : 
                      entry.name === 'Pending' ? '#fbbf24' : '#94a3b8'
                    } />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-card-bg p-6 rounded-3xl border border-border-base shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="relative w-full lg:w-1/3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input 
              type="text" 
              placeholder="Search TXN ID, Booking ID, Customer..." 
              className="w-full pl-12 pr-4 py-4 border rounded-2xl text-sm outline-none transition-all bg-bg-secondary border-border-base text-text-primary focus:ring-2 focus:ring-primary/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 px-4 py-3 border rounded-2xl bg-bg-secondary border-border-base">
              <Calendar size={16} className="text-text-secondary" />
              <select 
                className="bg-transparent text-xs font-bold text-text-primary outline-none cursor-pointer"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              >
                <option value="All">All Time</option>
                <option value="Today">Today</option>
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="Last 30 Days">Last 30 Days</option>
              </select>
            </div>

            <div className="flex items-center gap-2 px-4 py-3 border rounded-2xl bg-bg-secondary border-border-base">
              <Filter size={16} className="text-text-secondary" />
              <select 
                className="bg-transparent text-xs font-bold text-text-primary outline-none cursor-pointer"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Success">Success</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
                <option value="Refunded">Refunded</option>
              </select>
            </div>

            <div className="flex items-center gap-2 px-4 py-3 border rounded-2xl bg-bg-secondary border-border-base">
              <CreditCard size={16} className="text-text-secondary" />
              <select 
                className="bg-transparent text-xs font-bold text-text-primary outline-none cursor-pointer"
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
              >
                <option value="All">All Modes</option>
                <option value="UPI">UPI</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Cash">Cash</option>
                <option value="Wallet">Wallet</option>
                <option value="EMI">EMI</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-card-bg rounded-[2.5rem] border border-border-base shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-bg-secondary text-text-secondary border-b border-border-base">
              <tr>
                <th className="px-6 py-6 font-bold uppercase tracking-wider text-[10px] cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('id')}>
                  <div className="flex items-center gap-2">TXN ID <ArrowUpDown size={12} /></div>
                </th>
                <th className="px-6 py-6 font-bold uppercase tracking-wider text-[10px]">Booking ID</th>
                <th className="px-6 py-6 font-bold uppercase tracking-wider text-[10px]">Customer</th>
                <th className="px-6 py-6 font-bold uppercase tracking-wider text-[10px]">Service</th>
                <th className="px-6 py-6 font-bold uppercase tracking-wider text-[10px]">Mode</th>
                <th className="px-6 py-6 font-bold uppercase tracking-wider text-[10px] cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('totalAmount')}>
                  <div className="flex items-center gap-2">Amount <ArrowUpDown size={12} /></div>
                </th>
                <th className="px-6 py-6 font-bold uppercase tracking-wider text-[10px] cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-2">Date & Time <ArrowUpDown size={12} /></div>
                </th>
                <th className="px-6 py-6 font-bold uppercase tracking-wider text-[10px] text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-base">
              {filteredTransactions.map((t) => (
                <tr 
                  key={t.id} 
                  className="hover:bg-bg-secondary transition-all group cursor-pointer"
                  onClick={() => setSelectedTxn(t)}
                >
                  <td className="px-6 py-6">
                    <span className="font-black text-text-primary group-hover:text-primary transition-colors">{t.id}</span>
                  </td>
                  <td className="px-6 py-6 font-bold text-text-secondary">{t.bookingId}</td>
                  <td className="px-6 py-6">
                    <p className="font-bold text-text-primary">{t.customerName}</p>
                  </td>
                  <td className="px-6 py-6">
                    <p className="font-bold text-text-primary text-xs">{t.serviceName}</p>
                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest mt-0.5">{t.category}</p>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-2 text-text-primary font-bold">
                      {getModeIcon(t.paymentMode)}
                      <span>{t.paymentMode}</span>
                    </div>
                  </td>
                  <td className="px-6 py-6 font-black text-text-primary text-lg">₹{t.totalAmount.toLocaleString()}</td>
                  <td className="px-6 py-6">
                    <p className="font-bold text-text-primary">{t.date}</p>
                    <p className="text-[10px] text-text-secondary font-bold">{t.time}</p>
                  </td>
                  <td className="px-6 py-6 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                        getStatusColor(t.status)
                      )}>
                        {t.status === 'Success' && <CheckCircle2 size={12} />}
                        {t.status === 'Pending' && <Clock size={12} />}
                        {t.status === 'Failed' && <XCircle size={12} />}
                        {t.status}
                      </span>
                      {t.paymentMode === 'Cash' && t.status === 'Pending' && (
                        <span className="text-[8px] font-bold text-amber-600 uppercase tracking-tighter">Manual Confirmation Required</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      <AnimatePresence>
        {selectedTxn && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTxn(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-card-bg rounded-[3rem] shadow-2xl overflow-hidden border border-border-base"
            >
              <div className="p-10 border-b border-border-base flex items-center justify-between bg-bg-secondary">
                <div>
                  <h3 className="text-3xl font-black tracking-tighter text-text-primary">Transaction Details</h3>
                  <p className="text-xs text-text-secondary font-bold uppercase tracking-widest mt-1">Audit Log for {selectedTxn.id}</p>
                </div>
                <button 
                  onClick={() => setSelectedTxn(null)}
                  className="p-3 hover:bg-card-bg rounded-2xl text-text-secondary transition-colors border border-border-base"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-10 space-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Status Banner */}
                <div className={cn(
                  "p-6 rounded-3xl border flex items-center justify-between",
                  getStatusColor(selectedTxn.status)
                )}>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-2xl">
                      {selectedTxn.status === 'Success' ? <Check size={32} /> : <AlertCircle size={32} />}
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-widest opacity-80">Payment Status</p>
                      <h4 className="text-3xl font-black tracking-tight">{selectedTxn.status}</h4>
                    </div>
                  </div>
                  {selectedTxn.status === 'Failed' && (
                    <button className="px-6 py-3 bg-white text-red-500 rounded-xl font-black text-sm shadow-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
                      <RefreshCcw size={16} />
                      Retry Payment
                    </button>
                  )}
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Customer Name</p>
                    <p className="text-lg font-black text-text-primary">{selectedTxn.customerName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Booking ID</p>
                    <p className="text-lg font-black text-text-primary">{selectedTxn.bookingId}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Service Rendered</p>
                    <p className="text-lg font-black text-text-primary">{selectedTxn.serviceName}</p>
                    <p className="text-xs font-bold text-primary uppercase tracking-widest">{selectedTxn.category}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Payment Mode</p>
                    <div className="flex items-center gap-2 text-lg font-black text-text-primary">
                      {getModeIcon(selectedTxn.paymentMode)}
                      {selectedTxn.paymentMode}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Transaction Date</p>
                    <p className="text-lg font-black text-text-primary">{selectedTxn.date} at {selectedTxn.time}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Gateway Reference</p>
                    <p className="text-lg font-black text-text-primary font-mono">{selectedTxn.gatewayRefId || 'N/A'}</p>
                  </div>
                </div>

                {/* Amount Breakdown */}
                <div className="bg-bg-secondary p-8 rounded-[2rem] border border-border-base space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-secondary font-bold uppercase tracking-widest">Base Amount</span>
                    <span className="text-text-primary font-black">₹{(selectedTxn.totalAmount - (selectedTxn.taxAmount || 0) - (selectedTxn.surgeAmount || 0) + (selectedTxn.discountAmount || 0)).toLocaleString()}</span>
                  </div>
                  {selectedTxn.discountAmount && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-red-500 font-bold uppercase tracking-widest">Discount Applied</span>
                      <span className="text-red-500 font-black">-₹{selectedTxn.discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {selectedTxn.surgeAmount && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-amber-500 font-bold uppercase tracking-widest">Surge Pricing</span>
                      <span className="text-amber-500 font-black">+₹{selectedTxn.surgeAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {selectedTxn.taxAmount && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-text-secondary font-bold uppercase tracking-widest">Tax (GST 18%)</span>
                      <span className="text-text-primary font-black">+₹{selectedTxn.taxAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="pt-4 border-t border-border-base flex justify-between items-center">
                    <span className="text-lg font-black text-text-primary uppercase tracking-tighter">Total Paid</span>
                    <span className="text-3xl font-black text-primary">₹{selectedTxn.totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button className="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
                    <Download size={18} />
                    Download Invoice
                  </button>
                  <button className="flex-1 py-4 bg-bg-secondary border border-border-base text-text-primary rounded-2xl font-black text-sm hover:bg-border-base transition-all flex items-center justify-center gap-2">
                    <ExternalLink size={18} />
                    View in Gateway
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
