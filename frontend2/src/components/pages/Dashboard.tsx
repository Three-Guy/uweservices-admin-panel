import React, { useState, useEffect, useMemo } from 'react';
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
  AlertCircle,
  Sparkles,
  Clock,
  Zap,
  Shield,
  BarChart3,
  ChevronUp,
  ArrowUpRight,
  Eye
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════
// ANIMATED BACKGROUND BLOBS
// ═══════════════════════════════════════════════════════════════
function FloatingBlobs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-200/30 to-violet-200/20 blur-3xl animate-pulse" />
      <div className="absolute top-1/3 -left-32 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-emerald-200/20 to-cyan-200/15 blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-[350px] h-[350px] rounded-full bg-gradient-to-br from-amber-200/15 to-rose-200/10 blur-3xl" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function DashboardModule() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await dashboardApi.getStats();
      if (response.success) {
        setStats(response.data);
        setLastUpdated(new Date());
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

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning', emoji: '☀️', color: 'from-amber-400 to-orange-400' };
    if (hour < 17) return { text: 'Good afternoon', emoji: '🌤️', color: 'from-sky-400 to-blue-400' };
    if (hour < 21) return { text: 'Good evening', emoji: '🌆', color: 'from-violet-400 to-purple-400' };
    return { text: 'Good night', emoji: '🌙', color: 'from-indigo-400 to-blue-400' };
  }, []);

  // ── Loading State ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/30">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-violet-400 blur-2xl opacity-30 animate-pulse scale-150"></div>
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-xl shadow-blue-500/20">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Loading your dashboard
            </p>
            <p className="text-sm text-slate-400 mt-1">Fetching the latest insights...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-rose-50/30 to-orange-50/20 p-8">
        <div className="bg-white/80 backdrop-blur-xl border border-rose-100 rounded-3xl p-10 text-center max-w-md shadow-xl shadow-rose-500/5">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-rose-400 to-orange-400 flex items-center justify-center mb-6 shadow-lg shadow-rose-400/20">
            <AlertCircle size={36} className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">Something went wrong</h3>
          <p className="text-slate-400 mb-8 text-sm leading-relaxed">{error}</p>
          <button
            onClick={fetchStats}
            className="px-8 py-3 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-rose-500/25 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 mx-auto"
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── No Data State ──
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="text-center bg-white/80 backdrop-blur-xl p-10 rounded-3xl border border-slate-100 shadow-xl">
          <p className="text-slate-400 font-medium mb-4">No data available</p>
          <button
            onClick={fetchStats}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-bold hover:shadow-lg transition-all"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // Calculated values for header
  const totalEntities = (stats.totalProviders || 0) + (stats.totalUsers || 0);
  const pendingTotal = stats.pendingVerifications || 0;
  const activityScore = stats.activeUsers && stats.totalUsers
    ? Math.round((stats.activeUsers / stats.totalUsers) * 100)
    : 0;

  return (
    <>
      <FloatingBlobs />
      <div className="min-h-screen">
        <div className="p-5 md:p-8 space-y-7 max-w-[1800px] mx-auto">

          {/* ═══════════════ HERO HEADER ═══════════════ */}
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 p-7 md:p-10 text-white shadow-2xl shadow-indigo-500/20">
            {/* Decorative shapes */}
            <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-gradient-to-bl from-white/15 to-transparent rounded-full blur-2xl -translate-y-1/3 translate-x-1/4"></div>
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-violet-300/20 to-transparent rounded-full blur-2xl translate-y-1/3 -translate-x-1/4"></div>
            <div className="absolute top-1/2 left-1/2 w-[200px] h-[200px] bg-gradient-to-br from-cyan-300/10 to-transparent rounded-full blur-xl -translate-x-1/2 -translate-y-1/2"></div>

            {/* Pattern overlay */}
            <div className="absolute inset-0 opacity-[0.07]" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }}></div>

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-semibold mb-4">
                  <span className="text-lg">{greeting.emoji}</span>
                  <span className="text-white/90">{greeting.text}, Admin</span>
                </div>

                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 flex items-center gap-3">
                  Dashboard
                  <Sparkles className="w-8 h-8 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                </h1>
                <p className="text-blue-100 text-base md:text-lg max-w-xl leading-relaxed">
                  Real-time insights into your platform's performance and activity
                </p>

                {/* Mini KPI chips */}
                <div className="flex flex-wrap gap-2.5 mt-6">
                  <KPIChip icon={<BarChart3 size={13} />} label={`${totalEntities.toLocaleString()} Total Entities`} />
                  {pendingTotal > 0 && (
                    <KPIChip icon={<Clock size={13} />} label={`${pendingTotal} Awaiting Review`} variant="amber" />
                  )}
                  <KPIChip icon={<Activity size={13} />} label={`${activityScore}% Active Rate`} variant="emerald" />
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm bg-white/12 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-white/15">
                  <Calendar size={15} className="text-blue-200" />
                  <span className="font-semibold text-white/90">
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                <button
                  onClick={fetchStats}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-all shadow-lg shadow-indigo-900/10 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>

            {lastUpdated && (
              <div className="relative z-10 mt-5 flex items-center gap-2 text-xs text-blue-100/80">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* ═══════════════ PROVIDER STATS ═══════════════ */}
          <section>
            <SectionHeader
              icon={<Shield size={18} />}
              title="Provider Overview"
              subtitle="Service provider metrics and verification status"
              gradient="from-blue-500 to-cyan-400"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <GlassStatCard
                icon={<Users size={22} />}
                title="Total Providers"
                value={stats.totalProviders}
                gradient="from-blue-500 to-cyan-400"
                lightBg="from-blue-50 to-cyan-50"
                iconColor="text-blue-500"
              />
              <GlassStatCard
                icon={<FileCheck size={22} />}
                title="Pending Verifications"
                value={stats.pendingVerifications}
                gradient="from-amber-400 to-orange-400"
                lightBg="from-amber-50 to-orange-50"
                iconColor="text-amber-500"
                highlight={stats.pendingVerifications > 0}
                pulse={stats.pendingVerifications > 5}
              />
              <GlassStatCard
                icon={<CheckCircle size={22} />}
                title="Approved Providers"
                value={stats.approvedProviders}
                gradient="from-emerald-400 to-green-400"
                lightBg="from-emerald-50 to-green-50"
                iconColor="text-emerald-500"
              />
              <GlassStatCard
                icon={<TrendingUp size={22} />}
                title="Active Providers"
                value={stats.activeProviders}
                gradient="from-violet-500 to-purple-400"
                lightBg="from-violet-50 to-purple-50"
                iconColor="text-violet-500"
              />
            </div>
          </section>

          {/* ═══════════════ USER STATS ═══════════════ */}
          <section>
            <SectionHeader
              icon={<UserPlus size={18} />}
              title="Users Overview"
              subtitle="Registered user activity and growth metrics"
              gradient="from-indigo-500 to-violet-400"
              badge="User Database"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <GlassStatCard
                icon={<Users size={22} />}
                title="Total Users"
                value={stats.totalUsers || 0}
                gradient="from-indigo-500 to-blue-400"
                lightBg="from-indigo-50 to-blue-50"
                iconColor="text-indigo-500"
                subtitle={stats.todaySignups ? `+${stats.todaySignups} today` : undefined}
              />
              <GlassStatCard
                icon={<UserCheck size={22} />}
                title="Active Users"
                value={stats.activeUsers || 0}
                gradient="from-emerald-400 to-teal-400"
                lightBg="from-emerald-50 to-teal-50"
                iconColor="text-emerald-500"
              />
              <GlassStatCard
                icon={<Mail size={22} />}
                title="Verified Users"
                value={stats.verifiedUsers || 0}
                gradient="from-cyan-400 to-sky-400"
                lightBg="from-cyan-50 to-sky-50"
                iconColor="text-cyan-500"
              />
              <GlassStatCard
                icon={<TrendingUp size={22} />}
                title="Today's Signups"
                value={stats.todaySignups || 0}
                gradient="from-rose-400 to-pink-400"
                lightBg="from-rose-50 to-pink-50"
                iconColor="text-rose-500"
                highlight={stats.todaySignups > 0}
                pulse={stats.todaySignups > 0}
              />
            </div>
          </section>

          {/* ═══════════════ QUICK ACTIONS ═══════════════ */}
          <section>
            <SectionHeader
              icon={<Zap size={18} />}
              title="Quick Actions"
              subtitle="Jump to the most common admin tasks"
              gradient="from-amber-400 to-orange-400"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <ActionCard
                title="Manage Users"
                description={`View and manage ${stats.totalUsers || 0} registered users`}
                icon={<Users size={24} />}
                link="/users"
                gradient="from-indigo-500 to-violet-500"
                accentLight="from-indigo-50 to-violet-50"
                badge={stats.todaySignups > 0 ? `+${stats.todaySignups} today` : undefined}
              />
              <ActionCard
                title="Provider Verifications"
                description={`${stats.pendingVerifications} pending verifications to review`}
                icon={<FileCheck size={24} />}
                link="/verifications"
                gradient="from-amber-400 to-orange-400"
                accentLight="from-amber-50 to-orange-50"
                badge={stats.pendingVerifications > 0 ? `${stats.pendingVerifications} pending` : undefined}
                urgent={stats.pendingVerifications > 5}
              />
              <ActionCard
                title="All Providers"
                description={`Manage ${stats.totalProviders} service providers`}
                icon={<Activity size={24} />}
                link="/providers"
                gradient="from-emerald-400 to-teal-400"
                accentLight="from-emerald-50 to-teal-50"
              />
            </div>
          </section>

          {/* ═══════════════ SUMMARY CARDS ═══════════════ */}
          <section>
            <SectionHeader
              icon={<BarChart3 size={18} />}
              title="Detailed Breakdown"
              subtitle="Complete distribution across providers and users"
              gradient="from-rose-400 to-pink-400"
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Provider Summary */}
              <BreakdownCard
                title="Provider Summary"
                icon={<Shield size={20} />}
                gradient="from-blue-500 to-cyan-400"
                total={stats.totalProviders}
                totalLabel="Total Providers"
              >
                <ProgressRow
                  label="Total Registered"
                  value={stats.totalProviders}
                  color="from-blue-400 to-cyan-400"
                  total={stats.totalProviders}
                />
                <ProgressRow
                  label="Active"
                  value={stats.activeProviders}
                  color="from-emerald-400 to-green-400"
                  total={stats.totalProviders}
                />
                <ProgressRow
                  label="Approved"
                  value={stats.approvedProviders}
                  color="from-teal-400 to-emerald-400"
                  total={stats.totalProviders}
                />
                <ProgressRow
                  label="Pending Verification"
                  value={stats.pendingVerifications}
                  color="from-amber-400 to-orange-400"
                  total={stats.totalProviders}
                />
                <ProgressRow
                  label="Rejected"
                  value={stats.rejectedVerifications || 0}
                  color="from-rose-400 to-red-400"
                  total={stats.totalProviders}
                />
              </BreakdownCard>

              {/* User Summary */}
              <BreakdownCard
                title="User Summary"
                icon={<UserPlus size={20} />}
                gradient="from-indigo-500 to-violet-400"
                total={stats.totalUsers || 0}
                totalLabel="Total Users"
              >
                <ProgressRow
                  label="Total Users"
                  value={stats.totalUsers || 0}
                  color="from-indigo-400 to-violet-400"
                  total={stats.totalUsers || 1}
                />
                <ProgressRow
                  label="Active Users"
                  value={stats.activeUsers || 0}
                  color="from-emerald-400 to-teal-400"
                  total={stats.totalUsers || 1}
                />
                <ProgressRow
                  label="Verified Users"
                  value={stats.verifiedUsers || 0}
                  color="from-cyan-400 to-sky-400"
                  total={stats.totalUsers || 1}
                />
                <ProgressRow
                  label="Today's Signups"
                  value={stats.todaySignups || 0}
                  color="from-rose-400 to-pink-400"
                  total={stats.totalUsers || 1}
                />
              </BreakdownCard>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// KPI CHIP (header mini badges)
// ═══════════════════════════════════════════════════════════════
function KPIChip({ icon, label, variant }: {
  icon: React.ReactNode;
  label: string;
  variant?: 'amber' | 'emerald';
}) {
  const bg = variant === 'amber'
    ? 'bg-amber-300/20 border-amber-300/20'
    : variant === 'emerald'
      ? 'bg-emerald-300/20 border-emerald-300/20'
      : 'bg-white/15 border-white/10';

  return (
    <div className={cn('flex items-center gap-1.5 backdrop-blur-sm rounded-full px-3.5 py-1.5 text-xs font-semibold border', bg)}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════════
function SectionHeader({ icon, title, subtitle, gradient, badge }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  gradient: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg',
          gradient
        )}>
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-700 flex items-center gap-2">
            {title}
            {badge && (
              <span className="text-[10px] bg-gradient-to-r from-indigo-100 to-violet-100 text-indigo-600 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                {badge}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GLASS STAT CARD (modern glassmorphism style)
// ═══════════════════════════════════════════════════════════════
function GlassStatCard({ icon, title, value, gradient, lightBg, iconColor, subtitle, highlight, pulse }: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  gradient: string;
  lightBg: string;
  iconColor: string;
  subtitle?: string;
  highlight?: boolean;
  pulse?: boolean;
}) {
  return (
    <div className={cn(
      'group relative rounded-2xl border backdrop-blur-sm transition-all duration-300 overflow-hidden hover:-translate-y-1 hover:shadow-xl',
      highlight
        ? 'bg-white/90 border-amber-200 shadow-lg shadow-amber-500/5 ring-1 ring-amber-200/50'
        : 'bg-white/80 border-white/60 shadow-md shadow-slate-200/50'
    )}>
      {/* Gradient accent top */}
      <div className={cn('absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-80', gradient)}></div>

      {/* Hover glow */}
      <div className={cn(
        'absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500',
        gradient
      )}></div>

      <div className="relative p-5 flex items-start gap-4">
        <div className={cn(
          'w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg',
          lightBg
        )}>
          <div className={cn(iconColor, pulse && 'animate-pulse')}>
            {icon}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1.5">
            {title}
          </p>
          <h4 className="text-3xl font-extrabold bg-gradient-to-r from-slate-700 to-slate-500 bg-clip-text text-transparent leading-none tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </h4>
          {subtitle && (
            <div className="flex items-center gap-1 mt-2">
              <div className="flex items-center gap-0.5 bg-emerald-50 rounded-full px-2 py-0.5">
                <ChevronUp size={11} className="text-emerald-500" />
                <p className="text-[10px] font-bold text-emerald-600">{subtitle}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ACTION CARD (quick actions)
// ═══════════════════════════════════════════════════════════════
function ActionCard({ title, description, icon, link, gradient, accentLight, badge, urgent }: {
  title: string;
  description: string;
  icon: React.ReactNode;
  link: string;
  gradient: string;
  accentLight: string;
  badge?: string;
  urgent?: boolean;
}) {
  return (
    <Link
      to={link}
      className={cn(
        'group relative bg-white/80 backdrop-blur-sm rounded-2xl border shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden hover:-translate-y-1',
        urgent
          ? 'border-amber-200 ring-1 ring-amber-200/50'
          : 'border-white/60'
      )}
    >
      {/* Gradient accent top */}
      <div className={cn('absolute top-0 left-0 right-0 h-1 bg-gradient-to-r', gradient)}></div>

      {/* Hover glow */}
      <div className={cn(
        'absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500',
        gradient
      )}></div>

      <div className="relative p-6">
        {badge && (
          <span className={cn(
            'absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1',
            urgent
              ? 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-600 ring-1 ring-amber-200'
              : 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-600'
          )}>
            {urgent && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
              </span>
            )}
            {badge}
          </span>
        )}

        <div className={cn(
          'w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white mb-5 shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-3',
          gradient
        )}>
          {icon}
        </div>

        <h3 className="text-lg font-extrabold text-slate-700 mb-1.5">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{description}</p>

        <div className="flex items-center gap-1.5 mt-5 font-bold text-sm group-hover:gap-3 transition-all">
          <span className={cn('bg-gradient-to-r bg-clip-text text-transparent', gradient)}>
            View Details
          </span>
          <ArrowRight size={15} className={cn('transition-transform group-hover:translate-x-1', urgent ? 'text-amber-500' : 'text-indigo-400')} />
        </div>
      </div>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════
// BREAKDOWN CARD (summary wrapper)
// ═══════════════════════════════════════════════════════════════
function BreakdownCard({ title, icon, gradient, total, totalLabel, children }: {
  title: string;
  icon: React.ReactNode;
  gradient: string;
  total: number;
  totalLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-md hover:shadow-lg transition-all p-6 overflow-hidden relative">
      {/* Decorative corner blob */}
      <div className={cn(
        'absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br opacity-[0.04] blur-xl',
        gradient
      )}></div>

      <div className="relative flex items-center justify-between mb-7">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg',
            gradient
          )}>
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-700">{title}</h3>
            <p className="text-[11px] text-slate-400">Distribution breakdown</p>
          </div>
        </div>
        <div className="text-right">
          <div className={cn('text-2xl font-extrabold bg-gradient-to-r bg-clip-text text-transparent', gradient)}>
            {total.toLocaleString()}
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{totalLabel}</div>
        </div>
      </div>

      <div className="relative space-y-5">
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PROGRESS ROW (summary progress bar)
// ═══════════════════════════════════════════════════════════════
function ProgressRow({ label, value, color, total }: {
  label: string;
  value: number;
  color: string;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-2 group">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-600">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-slate-600 tabular-nums">
            {value.toLocaleString()}
          </span>
          <span className={cn(
            'text-[10px] font-bold rounded-md px-2 py-0.5 tabular-nums min-w-[42px] text-center bg-gradient-to-r text-white',
            color
          )}>
            {percentage}%
          </span>
        </div>
      </div>
      <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r relative',
            color
          )}
          style={{ width: `${Math.max(percentage, 2)}%` }}
        >
          {/* Animated shimmer */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-[shimmer_1.5s_ease-in-out_infinite] transition-opacity"></div>
        </div>
      </div>
    </div>
  );
}

export { DashboardModule };