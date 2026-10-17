import React, { useState, useMemo } from 'react';
import { useStore } from '../../store/StoreContext';
import { 
  TrendingUp, 
  TrendingDown, 
  IndianRupee, 
  Users, 
  Wrench, 
  CreditCard,
  Download,
  Filter,
  Calendar,
  MapPin,
  ChevronDown,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  BarChart3,
  Activity,
  Zap,
  Target,
  Percent
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { 
  RevenueTrendChart, 
  MonthlyComparisonChart, 
  CategoryRevenueChart, 
  CommissionBreakdownChart, 
  GeoMapChart, 
  WaterfallImpactChart, 
  RevenueForecastChart,
  CustomTooltip
} from '../analytics/AnalyticsCharts';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

const COLORS = ['#ec5b13', '#6366f1', '#fbbf24', '#10b981', '#3b82f6', '#8b5cf6', '#f43f5e', '#0ea5e9', '#d946ef', '#f97316'];

export default function RevenueAnalytics() {
  const { transactions, users, providers, isDark } = useStore();
  
  // Global Filters State
  const [dateRange, setDateRange] = useState('Last 6 Months');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProvider, setSelectedProvider] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('All');

  // Filtered Data
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
      const matchesProvider = selectedProvider === 'All' || t.providerName === selectedProvider;
      const provider = providers.find(p => p.name === t.providerName);
      const matchesLocation = selectedLocation === 'All' || provider?.location === selectedLocation;
      const matchesPaymentMode = selectedPaymentMode === 'All' || t.paymentMode === selectedPaymentMode;
      
      // Date filtering
      let matchesDate = true;
      const tDate = parseISO(t.date);
      if (dateRange === 'Last 30 Days') {
        matchesDate = isWithinInterval(tDate, { start: subMonths(new Date(), 1), end: new Date() });
      } else if (dateRange === 'Last 3 Months') {
        matchesDate = isWithinInterval(tDate, { start: subMonths(new Date(), 3), end: new Date() });
      } else if (dateRange === 'Last 6 Months') {
        matchesDate = isWithinInterval(tDate, { start: subMonths(new Date(), 6), end: new Date() });
      }

      return matchesCategory && matchesProvider && matchesLocation && matchesPaymentMode && matchesDate;
    });
  }, [transactions, selectedCategory, selectedProvider, selectedLocation, selectedPaymentMode, dateRange, providers]);

  // KPI Calculations
  const metrics = useMemo(() => {
    const totalRevenue = filteredTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalCommission = filteredTransactions.reduce((sum, t) => sum + t.commissionAmount, 0);
    const totalDiscounts = filteredTransactions.reduce((sum, t) => sum + (t.discountAmount || 0), 0);
    const totalTax = filteredTransactions.reduce((sum, t) => sum + (t.taxAmount || 0), 0);
    const totalSurge = filteredTransactions.reduce((sum, t) => sum + (t.surgeAmount || 0), 0);
    const avgRevenue = totalRevenue / (filteredTransactions.length || 1);
    
    const catMap: Record<string, number> = {};
    filteredTransactions.forEach(t => catMap[t.category] = (catMap[t.category] || 0) + t.totalAmount);
    const highestCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    const provMap: Record<string, number> = {};
    filteredTransactions.forEach(t => provMap[t.providerName] = (provMap[t.providerName] || 0) + t.totalAmount);
    const highestProv = Object.entries(provMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      totalRevenue,
      totalCommission,
      totalDiscounts,
      totalTax,
      totalSurge,
      avgRevenue,
      highestCat,
      highestProv,
      growth: 14.2 // Mock growth
    };
  }, [filteredTransactions]);

  // Chart Data Preparation
  const trendData = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, i) => format(subMonths(new Date(), i), 'MMM')).reverse();
    return months.map(m => ({
      name: m,
      revenue: filteredTransactions.filter(t => format(parseISO(t.date), 'MMM') === m).reduce((sum, t) => sum + t.totalAmount, 0)
    }));
  }, [filteredTransactions]);

  const categoryRevenueData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTransactions.forEach(t => map[t.category] = (map[t.category] || 0) + t.totalAmount);
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const providerRevenueData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTransactions.forEach(t => map[t.providerName] = (map[t.providerName] || 0) + t.totalAmount);
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [filteredTransactions]);

  const paymentModeData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTransactions.forEach(t => map[t.paymentMode] = (map[t.paymentMode] || 0) + t.totalAmount);
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredTransactions]);

  const locationData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      const provider = providers.find(p => p.name === t.providerName);
      const loc = provider?.location || 'Unknown';
      map[loc] = (map[loc] || 0) + t.totalAmount;
    });
    
    // Coordinates for mapping (mocked for common Indian cities)
    const coords: Record<string, number[]> = {
      'Bangalore': [77.5946, 12.9716],
      'Mumbai': [72.8777, 19.0760],
      'Delhi': [77.2090, 28.6139],
      'Hyderabad': [78.4867, 17.3850],
      'Pune': [73.8567, 18.5204],
      'Chennai': [80.2707, 13.0827],
      'Kolkata': [88.3639, 22.5726]
    };

    return Object.entries(map).map(([name, value]) => ({ 
      name, 
      value,
      coordinates: coords[name] || [78.9629, 20.5937] // Default to center of India if unknown
    }));
  }, [filteredTransactions, providers]);

  const waterfallData = useMemo(() => [
    { name: 'Gross Revenue', value: metrics.totalRevenue, isTotal: true },
    { name: 'Cancellations', value: -45000 },
    { name: 'Refunds', value: -12000 },
    { name: 'Discounts', value: -metrics.totalDiscounts },
    { name: 'Surge Revenue', value: metrics.totalSurge },
    { name: 'Tax Collected', value: metrics.totalTax },
    { name: 'Net Revenue', value: metrics.totalRevenue - 57000 - metrics.totalDiscounts + metrics.totalSurge + metrics.totalTax, isTotal: true },
  ], [metrics]);

  const forecastData = useMemo(() => {
    const base = trendData.map(d => ({ name: d.name, actual: d.revenue, forecast: d.revenue }));
    const lastRev = trendData[trendData.length - 1].revenue;
    return [
      ...base,
      { name: 'Aug', forecast: lastRev * 1.1 },
      { name: 'Sep', forecast: lastRev * 1.25 },
      { name: 'Oct', forecast: lastRev * 1.4 },
    ];
  }, [trendData]);

  const exportReport = () => {
    alert('Exporting Revenue Analytics Report (PDF)...');
  };

  return (
    <div className="p-8 space-y-12 max-w-[1600px] mx-auto w-full pb-24">
      {/* Header & Global Filters */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-text-primary">Revenue Analytics</h1>
          <p className="text-text-secondary mt-2 font-medium text-lg">Enterprise-grade financial intelligence and performance auditing.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-3 border rounded-2xl shadow-sm transition-colors bg-card-bg border-border-base">
            <Calendar size={18} className="text-primary" />
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none cursor-pointer text-text-primary"
            >
              <option>Last 30 Days</option>
              <option>Last 3 Months</option>
              <option>Last 6 Months</option>
              <option>Year to Date</option>
            </select>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 border rounded-2xl shadow-sm transition-colors bg-card-bg border-border-base">
            <Filter size={18} className="text-primary" />
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none cursor-pointer text-text-primary"
            >
              <option value="All">All Categories</option>
              {Array.from(new Set(transactions.map(t => t.category))).map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 border rounded-2xl shadow-sm transition-colors bg-card-bg border-border-base">
            <Wrench size={18} className="text-primary" />
            <select 
              value={selectedProvider} 
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none cursor-pointer text-text-primary max-w-[150px]"
            >
              <option value="All">All Providers</option>
              {Array.from(new Set(transactions.map(t => t.providerName))).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 border rounded-2xl shadow-sm transition-colors bg-card-bg border-border-base">
            <MapPin size={18} className="text-primary" />
            <select 
              value={selectedLocation} 
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none cursor-pointer text-text-primary"
            >
              <option value="All">All Locations</option>
              {Array.from(new Set(providers.map(p => p.location))).map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 border rounded-2xl shadow-sm transition-colors bg-card-bg border-border-base">
            <CreditCard size={18} className="text-primary" />
            <select 
              value={selectedPaymentMode} 
              onChange={(e) => setSelectedPaymentMode(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none cursor-pointer text-text-primary"
            >
              <option value="All">All Payments</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
            </select>
          </div>

          <button 
            onClick={exportReport}
            className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-2xl shadow-primary/40 hover:bg-primary/90 transition-all hover:-translate-y-1 active:translate-y-0"
          >
            <Download size={20} />
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <div className="bg-card-bg p-6 rounded-3xl border border-border-base shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Percent size={64} className="text-text-primary" />
          </div>
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">Total Discounts</p>
          <h3 className="text-2xl font-black text-red-500">₹{(metrics.totalDiscounts / 1000).toFixed(1)}K</h3>
          <div className="mt-2 flex items-center gap-1 text-text-secondary text-[10px] font-bold">
            Promo Savings
          </div>
        </div>

        <div className="bg-card-bg p-6 rounded-3xl border border-border-base shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Zap size={64} className="text-text-primary" />
          </div>
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">Surge Revenue</p>
          <h3 className="text-2xl font-black text-amber-500">₹{(metrics.totalSurge / 1000).toFixed(1)}K</h3>
          <div className="mt-2 flex items-center gap-1 text-text-secondary text-[10px] font-bold">
            Demand Pricing
          </div>
        </div>

        <div className="bg-card-bg p-6 rounded-3xl border border-border-base shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Target size={64} className="text-text-primary" />
          </div>
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">Tax Collected</p>
          <h3 className="text-2xl font-black text-indigo-500">₹{(metrics.totalTax / 1000).toFixed(1)}K</h3>
          <div className="mt-2 flex items-center gap-1 text-text-secondary text-[10px] font-bold">
            GST/VAT
          </div>
        </div>

        <div className="bg-card-bg p-6 rounded-3xl border border-border-base shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <IndianRupee size={64} className="text-text-primary" />
          </div>
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">Total Revenue</p>
          <h3 className="text-2xl font-black text-text-primary">₹{(metrics.totalRevenue / 100000).toFixed(2)}L</h3>
          <div className="mt-2 flex items-center gap-1 text-green-500 text-[10px] font-bold">
            <TrendingUp size={12} /> +{metrics.growth}%
          </div>
        </div>

        <div className="bg-card-bg p-6 rounded-3xl border border-border-base shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Zap size={64} className="text-text-primary" />
          </div>
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">Total Commission</p>
          <h3 className="text-2xl font-black text-text-primary">₹{(metrics.totalCommission / 1000).toFixed(1)}K</h3>
          <div className="mt-2 flex items-center gap-1 text-green-500 text-[10px] font-bold">
            <ArrowUpRight size={12} /> 15% Share
          </div>
        </div>

        <div className="bg-card-bg p-6 rounded-3xl border border-border-base shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Activity size={64} className="text-text-primary" />
          </div>
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">Avg Ticket Size</p>
          <h3 className="text-2xl font-black text-text-primary">₹{Math.round(metrics.avgRevenue)}</h3>
          <div className="mt-2 flex items-center gap-1 text-text-secondary text-[10px] font-bold">
            Per Booking
          </div>
        </div>

        <div className="bg-card-bg p-6 rounded-3xl border border-border-base shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Target size={64} className="text-text-primary" />
          </div>
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">Top Category</p>
          <h3 className="text-2xl font-black truncate text-text-primary">{metrics.highestCat}</h3>
          <div className="mt-2 flex items-center gap-1 text-primary text-[10px] font-bold">
            Highest Volume
          </div>
        </div>

        <div className="bg-card-bg p-6 rounded-3xl border border-border-base shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users size={64} className="text-text-primary" />
          </div>
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">Top Provider</p>
          <h3 className="text-2xl font-black truncate text-text-primary">{metrics.highestProv}</h3>
          <div className="mt-2 flex items-center gap-1 text-indigo-500 text-[10px] font-bold">
            Star Performer
          </div>
        </div>

        <div className="bg-card-bg p-6 rounded-3xl border border-border-base shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp size={64} className="text-text-primary" />
          </div>
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">Revenue Growth</p>
          <h3 className="text-2xl font-black text-green-500">+{metrics.growth}%</h3>
          <div className="mt-2 flex items-center gap-1 text-text-secondary text-[10px] font-bold">
            Month over Month
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Row 1: Revenue Trend & Map */}
        <div className="lg:col-span-8 bg-card-bg p-10 rounded-[3rem] border border-border-base shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-black tracking-tighter text-text-primary">Total Revenue Trend</h3>
              <p className="text-sm text-text-secondary font-medium">Monthly progression of gross platform earnings.</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-secondary rounded-xl text-[10px] font-bold text-text-secondary uppercase tracking-widest">
              <TrendingUp size={12} className="text-green-500" />
              Live Feed
            </div>
          </div>
          <div className="h-[400px] w-full">
            <RevenueTrendChart data={trendData} isDark={isDark} />
          </div>
        </div>

        <div className="lg:col-span-4 bg-card-bg p-10 rounded-[3rem] border border-border-base shadow-sm">
          <h3 className="text-2xl font-black tracking-tighter mb-2 text-text-primary">Geographic Revenue</h3>
          <p className="text-sm text-text-secondary font-medium mb-10">Revenue density by state/region.</p>
          <div className="h-[400px] w-full">
            <GeoMapChart data={locationData} isDark={isDark} onSelectLocation={setSelectedLocation} />
          </div>
        </div>

        {/* Row 2: Category Revenue & Provider Ranking */}
        <div className="lg:col-span-6 bg-card-bg p-10 rounded-[3rem] border border-border-base shadow-sm">
          <h3 className="text-2xl font-black tracking-tighter mb-2 text-text-primary">Category Performance</h3>
          <p className="text-sm text-text-secondary font-medium mb-10">Revenue distribution across service verticals.</p>
          <div className="h-[350px] w-full">
            <CategoryRevenueChart data={categoryRevenueData} isDark={isDark} onDrillDown={setSelectedCategory} />
          </div>
        </div>

        <div className="lg:col-span-6 bg-card-bg p-10 rounded-[3rem] border border-border-base shadow-sm">
          <h3 className="text-2xl font-black tracking-tighter mb-2 text-text-primary">Top 5 Providers</h3>
          <p className="text-sm text-text-secondary font-medium mb-10">Leaderboard of highest earning service partners.</p>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={providerRevenueData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} width={120} />
                <Tooltip content={<CustomTooltip isDark={isDark} />} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 3: Payment Mode & Status Distribution */}
        <div className="lg:col-span-4 bg-card-bg p-10 rounded-[3rem] border border-border-base shadow-sm">
          <h3 className="text-2xl font-black tracking-tighter mb-2 text-text-primary">Payment Modes</h3>
          <p className="text-sm text-text-secondary font-medium mb-10">Revenue split by transaction method.</p>
          <div className="h-[300px] w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentModeData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                  {paymentModeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip isDark={isDark} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <CreditCard size={24} className="text-text-secondary mb-1" />
              <p className="text-xs font-bold text-text-secondary uppercase tracking-widest">Modes</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 bg-card-bg p-10 rounded-[3rem] border border-border-base shadow-sm">
          <h3 className="text-2xl font-black tracking-tighter mb-2 text-text-primary">Commission Breakdown</h3>
          <p className="text-sm text-text-secondary font-medium mb-10">Comparison of provider earnings vs platform commission.</p>
          <div className="h-[300px] w-full">
            <CommissionBreakdownChart 
              data={categoryRevenueData.slice(0, 5).map(c => ({
                name: c.name,
                provider: c.value * 0.85,
                admin: c.value * 0.15
              }))} 
              isDark={isDark} 
            />
          </div>
        </div>

        {/* Row 4: Waterfall & Forecast */}
        <div className="lg:col-span-6 bg-card-bg p-10 rounded-[3rem] border border-border-base shadow-sm">
          <h3 className="text-2xl font-black tracking-tighter mb-2 text-text-primary">Cancellation Impact</h3>
          <p className="text-sm text-text-secondary font-medium mb-10">Revenue leakage analysis due to cancellations and refunds.</p>
          <div className="h-[350px] w-full">
            <WaterfallImpactChart data={waterfallData} isDark={isDark} />
          </div>
        </div>

        <div className="lg:col-span-6 bg-card-bg p-10 rounded-[3rem] border border-border-base shadow-sm">
          <h3 className="text-2xl font-black tracking-tighter mb-2 text-text-primary">Revenue Forecast</h3>
          <p className="text-sm text-text-secondary font-medium mb-10">AI-simulated prediction for the next 3 months.</p>
          <div className="h-[350px] w-full">
            <RevenueForecastChart data={forecastData} isDark={isDark} />
          </div>
        </div>

        {/* Row 5: Low Performing & Daily Trend */}
        <div className="lg:col-span-12 bg-card-bg p-10 rounded-[3rem] border border-border-base shadow-sm">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-20">
            <div>
              <h3 className="text-2xl font-black tracking-tighter mb-2 text-text-primary">Low Performing Services</h3>
              <p className="text-sm text-text-secondary font-medium mb-10">Identify categories requiring marketing intervention.</p>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryRevenueData.slice(-3)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <Tooltip content={<CustomTooltip isDark={isDark} />} />
                    <Bar dataKey="value" fill="#f43f5e" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tighter mb-2 text-text-primary">Repeat Customer Revenue</h3>
              <p className="text-sm text-text-secondary font-medium mb-10">Revenue generated from loyal, returning customers.</p>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={[
                        { name: 'New Customers', value: 65 },
                        { name: 'Repeat Customers', value: 35 }
                      ]} 
                      cx="50%" cy="50%" 
                      innerRadius={60} outerRadius={90} 
                      paddingAngle={5} dataKey="value" 
                      stroke="none"
                    >
                      <Cell fill="#94a3b8" />
                      <Cell fill="#ec5b13" />
                    </Pie>
                    <Tooltip content={<CustomTooltip isDark={isDark} />} />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
