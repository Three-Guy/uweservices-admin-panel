import React, { useState, useEffect } from 'react';
import { dashboardApi } from '../../lib/api';
import { DashboardStats } from '../../types';
import { 
  Users, 
  FileCheck, 
  CheckCircle, 
  TrendingUp, 
  Loader2,
  Calendar,
  ArrowRight,
  UserPlus,
  Activity,
  UserCheck,
  Mail,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';

export default function DashboardModule() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await dashboardApi.getStats();
      if (response.success) {
        setStats(response.data);
        console.log('📊 Dashboard stats loaded:', response.data);
      } else {
        throw new Error(response.message || 'Failed to fetch stats');
      }
    } catch (err: any) {
      console.error('❌ Failed to fetch dashboard stats:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-text-secondary font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
          <p className="text-text-secondary mb-4">{error}</p>
          <button 
            onClick={fetchStats}
            className="px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center gap-2 mx-auto"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-text-secondary">No data available</p>
          <button 
            onClick={fetchStats}
            className="mt-4 px-6 py-2 bg-primary text-white rounded-xl font-bold"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-text-primary">Dashboard</h1>
          <p className="text-text-secondary mt-1 font-medium">Welcome back! Here's your overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-card-bg border border-border-base rounded-xl text-sm font-bold text-text-primary hover:bg-bg-secondary transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <div className="flex items-center gap-2 text-sm text-text-secondary bg-card-bg px-4 py-2.5 rounded-xl border border-border-base">
            <Calendar size={16} />
            <span className="font-medium">{new Date().toLocaleDateString('en-US', { 
              weekday: 'short', 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })}</span>
          </div>
        </div>
      </div>

      {/* Provider Stats */}
      <div>
        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          <Users size={20} className="text-primary" />
          Provider Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={<Users />}
            title="Total Providers"
            value={stats.totalProviders}
            color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <StatCard
            icon={<FileCheck />}
            title="Pending Verifications"
            value={stats.pendingVerifications}
            color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
            highlight={stats.pendingVerifications > 0}
          />
          <StatCard
            icon={<CheckCircle />}
            title="Approved Providers"
            value={stats.approvedProviders}
            color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          />
          <StatCard
            icon={<TrendingUp />}
            title="Active Providers"
            value={stats.activeProviders}
            color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          />
        </div>
      </div>

      {/* User Stats */}
      <div>
        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          <UserPlus size={20} className="text-primary" />
          Users Overview
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-bold ml-2">
            From User Database
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={<Users />}
            title="Total Users"
            value={stats.totalUsers || 0}
            color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
            subtitle={stats.todaySignups ? `+${stats.todaySignups} today` : undefined}
          />
          <StatCard
            icon={<UserCheck />}
            title="Active Users"
            value={stats.activeUsers || 0}
            color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          />
          <StatCard
            icon={<Mail />}
            title="Verified Users"
            value={stats.verifiedUsers || 0}
            color="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400"
          />
          <StatCard
            icon={<TrendingUp />}
            title="Today's Signups"
            value={stats.todaySignups || 0}
            color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
            highlight={stats.todaySignups > 0}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          <Activity size={20} className="text-primary" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <QuickActionCard 
            title="Manage Users"
            description={`View and manage ${stats.totalUsers || 0} registered users`}
            icon={<Users />}
            link="/users"
            color="bg-indigo-500"
            badge={stats.todaySignups > 0 ? `+${stats.todaySignups} today` : undefined}
          />
          <QuickActionCard 
            title="Provider Verifications"
            description={`${stats.pendingVerifications} pending verifications`}
            icon={<FileCheck />}
            link="/verifications"
            color="bg-amber-500"
            badge={stats.pendingVerifications > 0 ? `${stats.pendingVerifications} pending` : undefined}
            urgent={stats.pendingVerifications > 5}
          />
          <QuickActionCard 
            title="All Providers"
            description={`Manage ${stats.totalProviders} service providers`}
            icon={<Activity />}
            link="/providers"
            color="bg-green-500"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Provider Summary */}
        <div className="bg-card-bg rounded-3xl border border-border-base shadow-sm p-6">
          <h3 className="text-lg font-bold text-text-primary mb-4">Provider Summary</h3>
          <div className="space-y-4">
            <SummaryRow 
              label="Total Registered" 
              value={stats.totalProviders} 
              color="bg-blue-500" 
              total={stats.totalProviders}
            />
            <SummaryRow 
              label="Active" 
              value={stats.activeProviders} 
              color="bg-green-500" 
              total={stats.totalProviders}
            />
            <SummaryRow 
              label="Approved" 
              value={stats.approvedProviders} 
              color="bg-emerald-500" 
              total={stats.totalProviders}
            />
            <SummaryRow 
              label="Pending Verification" 
              value={stats.pendingVerifications} 
              color="bg-amber-500" 
              total={stats.totalProviders}
            />
            <SummaryRow 
              label="Rejected" 
              value={stats.rejectedVerifications || 0} 
              color="bg-red-500" 
              total={stats.totalProviders}
            />
          </div>
        </div>

        {/* User Summary */}
        <div className="bg-card-bg rounded-3xl border border-border-base shadow-sm p-6">
          <h3 className="text-lg font-bold text-text-primary mb-4">User Summary</h3>
          <div className="space-y-4">
            <SummaryRow 
              label="Total Users" 
              value={stats.totalUsers || 0} 
              color="bg-indigo-500" 
              total={stats.totalUsers || 1}
            />
            <SummaryRow 
              label="Active Users" 
              value={stats.activeUsers || 0} 
              color="bg-green-500" 
              total={stats.totalUsers || 1}
            />
            <SummaryRow 
              label="Verified Users" 
              value={stats.verifiedUsers || 0} 
              color="bg-cyan-500" 
              total={stats.totalUsers || 1}
            />
            <SummaryRow 
              label="Today's Signups" 
              value={stats.todaySignups || 0} 
              color="bg-orange-500" 
              total={stats.totalUsers || 1}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== STAT CARD COMPONENT ====================
function StatCard({ icon, title, value, color, subtitle, highlight }: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  color: string;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "bg-card-bg p-6 rounded-3xl border shadow-sm flex items-center gap-4 hover:shadow-md transition-all",
      highlight ? "border-primary/50 ring-2 ring-primary/20" : "border-border-base"
    )}>
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", color)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{title}</p>
        <h4 className="text-2xl font-black text-text-primary">{value}</h4>
        {subtitle && (
          <p className="text-[10px] font-bold text-primary mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ==================== QUICK ACTION CARD ====================
function QuickActionCard({ title, description, icon, link, color, badge, urgent }: {
  title: string;
  description: string;
  icon: React.ReactNode;
  link: string;
  color: string;
  badge?: string;
  urgent?: boolean;
}) {
  return (
    <Link 
      to={link}
      className={cn(
        "bg-card-bg p-6 rounded-3xl border shadow-sm hover:shadow-md transition-all group relative overflow-hidden",
        urgent ? "border-amber-400 dark:border-amber-600" : "border-border-base"
      )}
    >
      {badge && (
        <span className={cn(
          "absolute top-4 right-4 px-2 py-1 rounded-full text-[10px] font-bold",
          urgent 
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            : "bg-primary/10 text-primary"
        )}>
          {badge}
        </span>
      )}
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-4", color)}>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-text-primary">{title}</h3>
      <p className="text-sm text-text-secondary mt-1">{description}</p>
      <div className="flex items-center gap-1 mt-4 text-primary font-bold text-sm group-hover:gap-2 transition-all">
        View <ArrowRight size={16} />
      </div>
    </Link>
  );
}

// ==================== SUMMARY ROW ====================
function SummaryRow({ label, value, color, total }: {
  label: string;
  value: number;
  color: string;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-text-primary">{label}</span>
        <span className="font-bold text-text-secondary">
          {value} <span className="text-text-secondary/60">({percentage}%)</span>
        </span>
      </div>
      <div className="w-full h-2 bg-bg-secondary rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export { DashboardModule };