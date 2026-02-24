import React from 'react';
import { useStore } from '../../store/StoreContext';
import { KPICard } from '../KPICard';
import { RevenueChart } from '../RevenueChart';
import { BookingTrendChart } from '../BookingTrendChart';
import { CategoryChart } from '../CategoryChart';
import { TopCategoryHighlight } from '../TopCategoryHighlight';
import { PricingControl } from '../PricingControl';
import { RealTimeSummary } from '../RealTimeSummary';
import { DateRangeFilter } from '../DateRangeFilter';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export function Dashboard() {
  const { users, providers, transactions, isDark } = useStore();

  const stats = React.useMemo(() => {
    const totalBookings = users.length;
    const activeBookings = users.filter(u => u.status === 'Pending').length;
    const completedBookings = users.filter(u => u.status === 'Success').length;
    const totalRevenue = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalCommission = transactions.reduce((sum, t) => sum + t.commissionAmount, 0);
    const activeProviders = providers.filter(p => p.status === 'Available').length;
    const pendingPayments = users.filter(u => u.status === 'Pending').reduce((sum, u) => sum + u.paymentAmount, 0);

    return [
      { label: 'Total Bookings', value: totalBookings.toLocaleString(), trend: '+12%', trendType: 'up' as const },
      { label: 'Active Bookings', value: activeBookings.toLocaleString(), isPulse: true },
      { label: 'Completed Bookings', value: completedBookings.toLocaleString(), subtext: '92% rate' },
      { label: 'Total Revenue', value: `₹${(totalRevenue / 100000).toFixed(1)}L`, trend: '+18%', trendType: 'up' as const },
      { label: 'Total Commission', value: `₹${(totalCommission / 1000).toFixed(1)}K`, subtext: '15% avg' },
      { label: 'Active Providers', value: activeProviders.toLocaleString(), trend: '+42', trendType: 'up' as const },
      { label: 'Pending Payments', value: `₹${(pendingPayments / 1000).toFixed(1)}K`, trendType: 'warning' as const },
    ];
  }, [users, providers, transactions]);

  return (
    <div className="p-8 space-y-16 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-text-primary">Dashboard</h1>
          <p className="text-text-secondary mt-1 font-medium">Welcome back, Rajesh. Here's your enterprise overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter />
          <button className="px-6 py-3 bg-primary text-white rounded-2xl text-sm font-bold shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all hover:-translate-y-0.5 active:translate-y-0">
            Download Report
          </button>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {stats.map((kpi, index) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <KPICard {...kpi} />
            </motion.div>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <RevenueChart />
          <BookingTrendChart />
        </div>
        <div className="space-y-10">
          <TopCategoryHighlight />
          <CategoryChart />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          <PricingControl />
        </div>
        <div>
          <RealTimeSummary />
        </div>
      </div>
    </div>
  );
}
