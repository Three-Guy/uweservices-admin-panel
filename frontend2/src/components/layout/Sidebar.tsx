// src/components/layout/Sidebar.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Settings,
  BarChart2,
  DollarSign,
  LogOut,
  UserPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  MapPin,
  Building2,
  Map,
  Smartphone,
  Layout,
  Grid,
  Image,
  ToggleLeft,
  Package,
  Sparkles,
  MoreHorizontal,
  Bell,
  Send,
  ShoppingCart,
  Gift,
  Receipt,
  Palette,
  TrendingUp,
  Menu,
  X,
  Home,
  Calendar,
  Activity,
  Clock,
  Zap,
  Radar,
  Radio,
  Target, // ✅ NEW — Manual Dispatch icon
} from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { usersApi, providersApi, bookingsApi } from '../../lib/api';

// ─── Types ───
interface UserStats {
  totalUsers: number;
  activeUsers: number;
  todaySignups: number;
  verifiedUsers: number;
}

interface ProviderStatsSimple {
  pendingVerifications: number;
}

interface BookingStatsSimple {
  pendingBookings: number;
  todayBookings: number;
  inProgressBookings: number;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  hasBadge?: boolean;
  badgeType?: string;
  isHot?: boolean;
  isPinned?: boolean;
  isCritical?: boolean; // ✅ NEW — for emergency items
}

// ─── Hooks ───
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return isMobile;
};

const useSwipe = (onSwipeLeft: () => void, onSwipeRight: () => void) => {
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.touches[0].clientX; };
  const onTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) diff > 0 ? onSwipeLeft() : onSwipeRight();
  };
  return { onTouchStart, onTouchMove, onTouchEnd };
};

// ─── Themes ───
const themes = {
  light: {
    name: 'Light',
    sidebar: 'bg-white',
    text: 'text-gray-700',
    textMuted: 'text-gray-500',
    textActive: 'text-indigo-600',
    border: 'border-gray-200',
    hover: 'hover:bg-gray-100 active:bg-gray-200',
    active: 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border-r-[3px] border-indigo-600',
    cardBg: 'bg-gray-50',
    accent: 'bg-indigo-600',
    accentHover: 'hover:bg-indigo-700',
    badge: 'bg-indigo-100 text-indigo-700',
    badgeHot: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white',
    badgeCritical: 'bg-gradient-to-r from-red-600 to-orange-600 text-white',
    badgeLive: 'bg-emerald-100 text-emerald-700',
    shadow: 'shadow-xl shadow-gray-200/50',
    overlay: 'bg-black/50',
  },
  dark: {
    name: 'Dark',
    sidebar: 'bg-gray-900',
    text: 'text-gray-300',
    textMuted: 'text-gray-500',
    textActive: 'text-white',
    border: 'border-gray-800',
    hover: 'hover:bg-gray-800 active:bg-gray-700',
    active: 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 text-white border-r-[3px] border-indigo-500',
    cardBg: 'bg-gray-800',
    accent: 'bg-indigo-600',
    accentHover: 'hover:bg-indigo-700',
    badge: 'bg-indigo-500/20 text-indigo-300',
    badgeHot: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white',
    badgeCritical: 'bg-gradient-to-r from-red-600 to-orange-600 text-white',
    badgeLive: 'bg-emerald-500/20 text-emerald-400',
    shadow: 'shadow-xl shadow-black/50',
    overlay: 'bg-black/70',
  },
  purple: {
    name: 'Purple',
    sidebar: 'bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900',
    text: 'text-purple-100',
    textMuted: 'text-purple-300/60',
    textActive: 'text-white',
    border: 'border-purple-700/50',
    hover: 'hover:bg-white/10 active:bg-white/20',
    active: 'bg-gradient-to-r from-white/20 to-pink-500/20 text-white border-r-[3px] border-pink-400',
    cardBg: 'bg-white/10',
    accent: 'bg-pink-500',
    accentHover: 'hover:bg-pink-600',
    badge: 'bg-pink-500/20 text-pink-200',
    badgeHot: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white',
    badgeCritical: 'bg-gradient-to-r from-red-500 to-orange-500 text-white',
    badgeLive: 'bg-emerald-500/20 text-emerald-300',
    shadow: 'shadow-xl shadow-purple-900/50',
    overlay: 'bg-purple-900/80',
  },
  ocean: {
    name: 'Ocean',
    sidebar: 'bg-gradient-to-b from-slate-900 via-blue-900 to-cyan-900',
    text: 'text-blue-100',
    textMuted: 'text-blue-300/60',
    textActive: 'text-white',
    border: 'border-blue-700/50',
    hover: 'hover:bg-white/10 active:bg-white/20',
    active: 'bg-gradient-to-r from-white/20 to-cyan-500/20 text-white border-r-[3px] border-cyan-400',
    cardBg: 'bg-white/10',
    accent: 'bg-cyan-500',
    accentHover: 'hover:bg-cyan-600',
    badge: 'bg-cyan-500/20 text-cyan-200',
    badgeHot: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white',
    badgeCritical: 'bg-gradient-to-r from-red-500 to-orange-500 text-white',
    badgeLive: 'bg-emerald-500/20 text-emerald-300',
    shadow: 'shadow-xl shadow-blue-900/50',
    overlay: 'bg-blue-900/80',
  },
  forest: {
    name: 'Forest',
    sidebar: 'bg-gradient-to-b from-gray-900 via-emerald-900 to-teal-900',
    text: 'text-emerald-100',
    textMuted: 'text-emerald-300/60',
    textActive: 'text-white',
    border: 'border-emerald-700/50',
    hover: 'hover:bg-white/10 active:bg-white/20',
    active: 'bg-gradient-to-r from-white/20 to-emerald-500/20 text-white border-r-[3px] border-emerald-400',
    cardBg: 'bg-white/10',
    accent: 'bg-emerald-500',
    accentHover: 'hover:bg-emerald-600',
    badge: 'bg-emerald-500/20 text-emerald-200',
    badgeHot: 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white',
    badgeCritical: 'bg-gradient-to-r from-red-500 to-orange-500 text-white',
    badgeLive: 'bg-lime-500/20 text-lime-300',
    shadow: 'shadow-xl shadow-emerald-900/50',
    overlay: 'bg-emerald-900/80',
  },
  sunset: {
    name: 'Sunset',
    sidebar: 'bg-gradient-to-b from-orange-900 via-red-900 to-pink-900',
    text: 'text-orange-100',
    textMuted: 'text-orange-300/60',
    textActive: 'text-white',
    border: 'border-orange-700/50',
    hover: 'hover:bg-white/10 active:bg-white/20',
    active: 'bg-gradient-to-r from-white/20 to-yellow-500/20 text-white border-r-[3px] border-yellow-400',
    cardBg: 'bg-white/10',
    accent: 'bg-orange-500',
    accentHover: 'hover:bg-orange-600',
    badge: 'bg-orange-500/20 text-orange-200',
    badgeHot: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white',
    badgeCritical: 'bg-gradient-to-r from-red-600 to-pink-600 text-white',
    badgeLive: 'bg-yellow-500/20 text-yellow-300',
    shadow: 'shadow-xl shadow-orange-900/50',
    overlay: 'bg-orange-900/80',
  },
};

type ThemeKey = keyof typeof themes;

// ─── Navigation Structure ───
const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Bookings', href: '/bookings', icon: Calendar, hasBadge: true, badgeType: 'booking', isHot: true, isPinned: true },
  { name: 'Live Tracking', href: '/tracking', icon: Radar, hasBadge: true, badgeType: 'tracking', isHot: true, isPinned: true },
  // ✅ DISPATCH SYSTEM (4 items)
  { name: 'Dispatch Monitor', href: '/dispatch', icon: Zap, isHot: true, isPinned: true },
  { name: '🚨 Manual Dispatch', href: '/manual-dispatch', icon: Target, isCritical: true, isPinned: true }, // ✅ NEW
  { name: 'Offer History', href: '/provider-offers', icon: Send },
  { name: 'Alerts Center', href: '/notifications', icon: Radio },
  { name: 'Providers', href: '/providers', icon: Briefcase, hasBadge: true, badgeType: 'provider' },
  { name: 'Verifications', href: '/verifications', icon: ClipboardCheck },
  { name: 'Users', href: '/users', icon: UserPlus, hasBadge: true, badgeType: 'user' },
];

const locationSubMenu: NavItem[] = [
  { name: 'Cities', href: '/locations/cities', icon: Building2 },
  { name: 'Zones', href: '/locations/zones', icon: Map },
];

const sduiMenuItems: NavItem[] = [
  { name: 'Dashboard', href: '/sdui', icon: Smartphone },
  { name: 'Categories', href: '/sdui/categories', icon: Grid },
  { name: 'Subservices', href: '/sdui/subservices', icon: Package },
  { name: 'Banners', href: '/sdui/banners', icon: Image },
  { name: 'Trending', href: '/sdui/trending', icon: TrendingUp },
  { name: 'ASAP Sections', href: '/sdui/asap-sections', icon: MoreHorizontal },
  { name: 'Notifications', href: '/sdui/notifications', icon: Bell },
  { name: 'Send Notification', href: '/sdui/notifications/send', icon: Send },
  { name: 'Layout Editor', href: '/sdui/layout-editor', icon: Layout },
  { name: 'Feature Flags', href: '/sdui/feature-flags', icon: ToggleLeft },
];

const checkoutMenuItems: NavItem[] = [
  { name: 'Coupons', href: '/checkout/coupons', icon: Gift },
  { name: 'Checkout Settings', href: '/checkout/settings', icon: Receipt },
];

const otherNavigation: NavItem[] = [
  { name: 'Pricing', href: '/pricing', icon: DollarSign },
  { name: 'Analytics', href: '/analytics', icon: BarChart2 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const bottomNavItems: NavItem[] = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Bookings', href: '/bookings', icon: Calendar },
  { name: 'Dispatch', href: '/manual-dispatch', icon: Target }, // ✅ Updated to Manual Dispatch
  { name: 'Providers', href: '/providers', icon: Briefcase },
];

export default function Sidebar() {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const navRef = useRef<HTMLElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const isInitialMountRef = useRef(true);
  const preventScrollRef = useRef(false);

  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>('purple');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [isLocationMenuExpanded, setIsLocationMenuExpanded] = useState(false);
  const [isSDUIMenuExpanded, setIsSDUIMenuExpanded] = useState(false);
  const [isCheckoutMenuExpanded, setIsCheckoutMenuExpanded] = useState(false);

  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [providerStats, setProviderStats] = useState<ProviderStatsSimple | null>(null);
  const [bookingStats, setBookingStats] = useState<BookingStatsSimple | null>(null);
  const [trackingActiveNow, setTrackingActiveNow] = useState<number>(0);

  const theme = themes[currentTheme];
  const swipeHandlers = useSwipe(() => setIsOpen(false), () => setIsOpen(true));

  const isLocationRoute = location.pathname.startsWith('/locations');
  const isSDUIRoute = location.pathname.startsWith('/sdui');
  const isCheckoutRoute = location.pathname.startsWith('/checkout');

  useEffect(() => {
    const savedTheme = localStorage.getItem('sidebarTheme') as ThemeKey;
    if (savedTheme && themes[savedTheme]) setCurrentTheme(savedTheme);
  }, []);

  const changeTheme = (newTheme: ThemeKey) => {
    setCurrentTheme(newTheme);
    localStorage.setItem('sidebarTheme', newTheme);
    setShowThemePicker(false);
  };

  const saveScrollPosition = useCallback(() => {
    if (navRef.current) scrollPositionRef.current = navRef.current.scrollTop;
  }, []);

  const restoreScrollPosition = useCallback(() => {
    if (navRef.current && preventScrollRef.current) {
      requestAnimationFrame(() => {
        if (navRef.current) navRef.current.scrollTop = scrollPositionRef.current;
        preventScrollRef.current = false;
      });
    }
  }, []);

  useEffect(() => {
    if (isInitialMountRef.current) {
      if (isLocationRoute) setIsLocationMenuExpanded(true);
      if (isSDUIRoute) setIsSDUIMenuExpanded(true);
      if (isCheckoutRoute) setIsCheckoutMenuExpanded(true);
      isInitialMountRef.current = false;
    }
  }, []);

  useEffect(() => { restoreScrollPosition(); }, [location.pathname, restoreScrollPosition]);

  useEffect(() => {
    if (isMobile) setIsOpen(false);
  }, [location.pathname, isMobile]);

  useEffect(() => {
    document.body.style.overflow = isMobile && isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, isOpen]);

  const fetchUserStats = async () => {
    try {
      const res = await usersApi.getStats();
      if (res.success) {
        setUserStats({
          totalUsers: res.data.totalUsers,
          activeUsers: res.data.activeUsers,
          todaySignups: res.data.todaySignups,
          verifiedUsers: res.data.verifiedUsers,
        });
      }
    } catch (e) { console.error('user stats:', e); }
  };

  const fetchProviderStats = async () => {
    try {
      const res = await providersApi.getStats();
      if (res.success) setProviderStats({ pendingVerifications: res.data.pendingVerifications || 0 });
    } catch (e) { console.error('provider stats:', e); }
  };

  const fetchBookingStats = async () => {
    try {
      const res = await bookingsApi.getStats();
      if (res?.success && res?.data) {
        const statusStats = res.data.statusStats || [];
        const pendingCount = statusStats
          .filter((s: any) => ['pending', 'searching', 'assigned'].includes(s._id))
          .reduce((sum: number, s: any) => sum + (s.count || 0), 0);
        const inProgressCount = statusStats
          .filter((s: any) => ['accepted', 'en-route', 'arrived', 'in-progress'].includes(s._id))
          .reduce((sum: number, s: any) => sum + (s.count || 0), 0);
        setBookingStats({
          pendingBookings: pendingCount,
          todayBookings: res.data.todayBookings || 0,
          inProgressBookings: inProgressCount,
        });
      }
    } catch (e) { console.error('booking stats:', e); }
  };

  const fetchTrackingStats = async () => {
    try {
      const mod: any = await import('../../lib/api');
      if (mod && mod.trackingApi && typeof mod.trackingApi.getStats === 'function') {
        const data = await mod.trackingApi.getStats();
        setTrackingActiveNow(data?.activeNow || 0);
      }
    } catch (e) {
      console.debug('tracking stats skipped:', e);
    }
  };

  const fetchBadgeData = useCallback(async () => {
    await Promise.all([
      fetchUserStats(),
      fetchProviderStats(),
      fetchBookingStats(),
      fetchTrackingStats(),
    ]);
  }, []);

  useEffect(() => {
    fetchBadgeData();
    const interval = setInterval(fetchBadgeData, 60000);
    return () => clearInterval(interval);
  }, [fetchBadgeData]);

  const getBadgeCount = (badgeType?: string) => {
    if (badgeType === 'user' && userStats?.todaySignups) return userStats.todaySignups;
    if (badgeType === 'provider' && providerStats?.pendingVerifications) return providerStats.pendingVerifications;
    if (badgeType === 'booking' && bookingStats?.pendingBookings) return bookingStats.pendingBookings;
    if (badgeType === 'tracking' && trackingActiveNow) return trackingActiveNow;
    return 0;
  };

  const handleNavClick = useCallback(() => {
    saveScrollPosition();
    preventScrollRef.current = true;
    if (isMobile) setIsOpen(false);
  }, [isMobile, saveScrollPosition]);

  const handleSubmenuToggle = useCallback((
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    currentValue: boolean
  ) => {
    saveScrollPosition();
    preventScrollRef.current = true;
    setter(!currentValue);
    requestAnimationFrame(() => {
      if (navRef.current) navRef.current.scrollTop = scrollPositionRef.current;
    });
  }, [saveScrollPosition]);

  // ─── Render Navigation Item ───
  const renderNavItem = (item: NavItem, compact = false) => {
    const badgeCount = getBadgeCount(item.badgeType);
    const isCollapsedView = isCollapsed && !isMobile;

    return (
      <NavLink
        key={item.name}
        to={item.href}
        onClick={handleNavClick}
        preventScrollReset={true}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-all duration-200 relative group
          ${isActive ? theme.active : `${theme.text} ${theme.hover}`}
          ${isCollapsedView ? 'justify-center' : ''}
          ${item.isPinned && !isActive ? 'bg-gradient-to-r from-pink-500/5 to-rose-500/5' : ''}
          ${item.isCritical && !isActive ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 ring-1 ring-red-500/20' : ''}
          touch-manipulation select-none`
        }
      >
        {({ isActive }) => (
          <>
            {isActive && !isCollapsedView && (
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full ${item.isCritical ? 'bg-red-500' : theme.accent}`} />
            )}

            <div className={`transition-transform duration-200 flex-shrink-0 relative ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
              <item.icon size={compact ? 17 : 18} strokeWidth={isActive ? 2.5 : 2} className={item.isCritical ? 'text-red-400' : ''} />
              {item.isHot && isCollapsedView && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500" />
                </span>
              )}
              {item.isCritical && isCollapsedView && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
                </span>
              )}
              {item.hasBadge && badgeCount > 0 && isCollapsedView && !item.isHot && !item.isCritical && (
                <span className={`absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full ${theme.accent} text-white text-[9px] font-bold flex items-center justify-center`}>
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              )}
            </div>

            {(!isCollapsedView || isMobile) && (
              <>
                <span className={`flex-1 text-[13.5px] ${isActive ? 'font-semibold' : 'font-medium'} ${item.isCritical ? 'font-bold' : ''}`}>
                  {item.name}
                </span>

                {item.isCritical && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${theme.badgeCritical} shadow-sm uppercase tracking-wider flex-shrink-0 animate-pulse`}>
                    SOS
                  </span>
                )}

                {item.isHot && !badgeCount && !item.isCritical && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${theme.badgeHot} shadow-sm uppercase tracking-wider flex-shrink-0`}>
                    NEW
                  </span>
                )}

                {item.hasBadge && badgeCount > 0 && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    item.isHot ? theme.badgeHot : theme.badge
                  } flex-shrink-0 shadow-sm`}>
                    {item.isHot && <span className="w-1 h-1 rounded-full bg-white animate-pulse" />}
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </>
            )}

            {isCollapsedView && !isMobile && (
              <div className={`absolute left-full ml-3 px-3 py-2 ${theme.cardBg} backdrop-blur-xl text-xs rounded-lg 
                opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 
                whitespace-nowrap z-[100] border ${theme.border} ${theme.shadow}`}
              >
                <span className={`font-semibold ${theme.text}`}>{item.name}</span>
                {item.isCritical && (
                  <span className={`ml-2 px-1.5 py-0.5 ${theme.badgeCritical} rounded-md text-[9px] font-black uppercase`}>SOS</span>
                )}
                {item.isHot && !item.isCritical && (
                  <span className={`ml-2 px-1.5 py-0.5 ${theme.badgeHot} rounded-md text-[9px] font-black uppercase`}>NEW</span>
                )}
                {item.hasBadge && badgeCount > 0 && (
                  <span className={`ml-2 px-1.5 py-0.5 ${item.isHot ? theme.badgeHot : theme.badge} rounded-md text-[10px] font-bold`}>
                    {badgeCount}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </NavLink>
    );
  };

  // ─── Render Submenu ───
  const renderSubMenu = (
    title: string,
    icon: React.ElementType,
    items: NavItem[],
    isExpanded: boolean,
    setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>,
    isActiveRoute: boolean
  ) => {
    const Icon = icon;
    const isCollapsedView = isCollapsed && !isMobile;

    return (
      <div className="mb-0.5">
        <button
          onClick={() => !isCollapsedView && handleSubmenuToggle(setIsExpanded, isExpanded)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative group
            ${isActiveRoute ? theme.active : `${theme.text} ${theme.hover}`}
            ${isCollapsedView ? 'justify-center' : ''}
            touch-manipulation select-none`}
        >
          {isActiveRoute && !isCollapsedView && (
            <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full ${theme.accent}`} />
          )}
          <div className={`transition-transform duration-200 flex-shrink-0 ${isActiveRoute ? 'scale-110' : 'group-hover:scale-105'}`}>
            <Icon size={18} strokeWidth={isActiveRoute ? 2.5 : 2} />
          </div>
          {(!isCollapsedView || isMobile) && (
            <>
              <span className={`flex-1 text-left text-[13.5px] ${isActiveRoute ? 'font-semibold' : 'font-medium'}`}>
                {title}
              </span>
              <div className={`transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                <ChevronDown size={14} className={theme.textMuted} />
              </div>
            </>
          )}

          {isCollapsedView && !isMobile && (
            <div className={`absolute left-full ml-3 px-3 py-2.5 ${theme.cardBg} backdrop-blur-xl text-xs rounded-lg 
              opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 
              whitespace-nowrap z-[100] border ${theme.border} ${theme.shadow} min-w-[170px]`}
            >
              <p className={`font-semibold mb-2 ${theme.text}`}>{title}</p>
              <div className="space-y-0.5">
                {items.map((subItem) => (
                  <NavLink key={subItem.name} to={subItem.href} onClick={handleNavClick} preventScrollReset={true}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] transition-colors
                      ${isActive ? theme.active : `${theme.text} ${theme.hover}`}`
                    }>
                    <subItem.icon size={13} />
                    <span className="font-medium">{subItem.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </button>

        {(!isCollapsedView || isMobile) && (
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isExpanded ? 'max-h-[600px] opacity-100 mt-1' : 'max-h-0 opacity-0'
          }`}>
            <div className="ml-3 space-y-0.5 pl-3 border-l border-white/10">
              {items.map((subItem) => (
                <NavLink key={subItem.name} to={subItem.href} onClick={handleNavClick} preventScrollReset={true}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all duration-200 touch-manipulation select-none
                    ${isActive ? `${theme.accent} text-white shadow-md` : `${theme.text} ${theme.hover}`}`
                  }>
                  {({ isActive }) => (
                    <>
                      <subItem.icon size={14} strokeWidth={isActive ? 2.5 : 2} className="flex-shrink-0" />
                      <span className={`text-[12.5px] ${isActive ? 'font-semibold' : 'font-medium'}`}>
                        {subItem.name}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const SectionDivider = ({ label }: { label: string }) => (
    (!isCollapsed || isMobile) ? (
      <div className="mt-4 mb-1.5 px-3">
        <p className={`text-[9.5px] font-black uppercase tracking-[0.15em] ${theme.textMuted}`}>
          {label}
        </p>
      </div>
    ) : (
      <div className="my-2 mx-3">
        <div className={`h-px bg-current opacity-20 ${theme.textMuted}`} />
      </div>
    )
  );

  const MobileMenuButton = () => {
    const pendingBookings = bookingStats?.pendingBookings || 0;
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`md:hidden fixed top-4 left-4 z-40 p-2.5 rounded-xl ${theme.sidebar} ${theme.shadow} ${theme.text}
          transition-all duration-200 active:scale-95 touch-manipulation relative border ${theme.border}`}
        aria-label="Open menu"
      >
        <Menu size={22} />
        {pendingBookings > 0 && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500" />
          </span>
        )}
      </button>
    );
  };

  const MobileBottomNav = () => (
    <div className={`md:hidden fixed bottom-0 left-0 right-0 z-30 ${theme.sidebar} border-t ${theme.border} backdrop-blur-xl`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      <div className="flex items-center justify-around px-1 py-1.5">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.href ||
            (item.href !== '/' && location.pathname.startsWith(item.href));
          const badgeCount =
            item.name === 'Bookings' ? (bookingStats?.pendingBookings || 0) :
            item.name === 'Tracking' ? trackingActiveNow :
            0;

          return (
            <NavLink
              key={item.name}
              to={item.href}
              preventScrollReset={true}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 
                touch-manipulation min-w-[60px] relative
                ${isActive ? theme.textActive : theme.textMuted}`}
            >
              <div className="relative">
                <item.icon size={21} strokeWidth={isActive ? 2.5 : 2} />
                {badgeCount > 0 && (
                  <span className={`absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full 
                    ${theme.badgeHot} text-[9px] font-bold flex items-center justify-center shadow-md`}>
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </div>
              <span className={`text-[9.5px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.name}
              </span>
              {isActive && (
                <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full ${theme.accent}`} />
              )}
            </NavLink>
          );
        })}
        <button
          onClick={() => setIsOpen(true)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 
            touch-manipulation min-w-[60px] ${theme.textMuted}`}
        >
          <Menu size={21} />
          <span className="text-[9.5px] font-medium">More</span>
        </button>
      </div>
    </div>
  );

  const SidebarContent = () => (
    <>
      <div className={`px-3 py-3 flex items-center justify-between border-b ${theme.border} flex-shrink-0`}>
        {(!isCollapsed || isMobile) ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-lg ${theme.accent} flex items-center justify-center shadow-md flex-shrink-0`}>
              <Sparkles className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h1 className={`text-sm font-black ${theme.textActive} truncate leading-tight`}>Admin Panel</h1>
              <p className={`text-[10px] ${theme.textMuted} truncate leading-tight`}>Control Center</p>
            </div>
          </div>
        ) : (
          <div className={`w-9 h-9 rounded-lg ${theme.accent} flex items-center justify-center mx-auto shadow-md`}>
            <Sparkles className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
          </div>
        )}

        {isMobile ? (
          <button onClick={() => setIsOpen(false)}
            className={`p-1.5 ${theme.text} ${theme.hover} rounded-lg transition-all duration-200 touch-manipulation flex-shrink-0`}
            aria-label="Close menu">
            <X size={20} />
          </button>
        ) : (
          <button onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-1.5 ${theme.text} ${theme.hover} rounded-lg transition-all duration-200 hover:scale-110 flex-shrink-0`}>
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      {/* ─── Manual Dispatch Quick Access Card (CRITICAL) ─── */}
      {(!isCollapsed || isMobile) && bookingStats && bookingStats.pendingBookings > 0 && (
        <div className="px-3 pt-3 pb-1 flex-shrink-0">
          <NavLink
            to="/manual-dispatch"
            onClick={handleNavClick}
            className={`block p-2.5 rounded-xl bg-gradient-to-r from-red-500/20 to-orange-500/20 border-2 border-red-500/40 relative overflow-hidden
              hover:scale-[1.02] transition-transform duration-200 group animate-pulse-slow`}
          >
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-red-500 opacity-20 rounded-full blur-2xl animate-pulse" />
            <div className="relative flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg flex-shrink-0`}>
                <Target className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`text-[10px] font-bold uppercase tracking-wider text-red-200`}>🚨 Manual Dispatch</p>
                  <span className="flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-lg font-black text-white leading-none`}>
                    {bookingStats.pendingBookings}
                  </span>
                  <span className={`text-[10px] text-red-200`}>stuck bookings</span>
                </div>
              </div>
              <div className={`px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[9px] font-black shadow-sm uppercase`}>
                SOS
              </div>
            </div>
          </NavLink>
        </div>
      )}

      {/* ─── Live Bookings Card ─── */}
      {(!isCollapsed || isMobile) && bookingStats && (
        <div className="px-3 pt-3 pb-1 flex-shrink-0">
          <NavLink
            to="/bookings"
            onClick={handleNavClick}
            className={`block p-2.5 rounded-xl ${theme.cardBg} border ${theme.border} relative overflow-hidden
              hover:scale-[1.02] transition-transform duration-200 group`}
          >
            <div className={`absolute -top-4 -right-4 w-20 h-20 ${theme.accent} opacity-10 rounded-full blur-2xl`} />
            <div className="relative flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-sm flex-shrink-0`}>
                <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.textMuted}`}>Live Bookings</p>
                  <span className="flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-lg font-black ${theme.textActive} leading-none`}>
                    {bookingStats.todayBookings}
                  </span>
                  <span className={`text-[10px] ${theme.textMuted}`}>today</span>
                </div>
              </div>
              {bookingStats.pendingBookings > 0 && (
                <div className={`px-1.5 py-0.5 rounded-md ${theme.badgeHot} text-[10px] font-black shadow-sm`}>
                  {bookingStats.pendingBookings}
                </div>
              )}
            </div>
            <div className={`mt-2 pt-2 border-t ${theme.border} flex items-center justify-between text-[10px]`}>
              <div className="flex items-center gap-1">
                <Clock size={10} className={theme.textMuted} />
                <span className={theme.textMuted}>Pending</span>
                <span className={`font-bold ${theme.textActive}`}>{bookingStats.pendingBookings}</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap size={10} className={theme.textMuted} />
                <span className={theme.textMuted}>Active</span>
                <span className={`font-bold ${theme.textActive}`}>{bookingStats.inProgressBookings}</span>
              </div>
            </div>
          </NavLink>
        </div>
      )}

      {/* ─── Live Tracking Mini Card ─── */}
      {(!isCollapsed || isMobile) && (
        <div className="px-3 pt-1 pb-1 flex-shrink-0">
          <NavLink
            to="/tracking"
            onClick={handleNavClick}
            className={`block p-2.5 rounded-xl ${theme.cardBg} border ${theme.border} relative overflow-hidden
              hover:scale-[1.02] transition-transform duration-200 group`}
          >
            <div className={`absolute -top-4 -right-4 w-20 h-20 bg-emerald-500 opacity-10 rounded-full blur-2xl`} />
            <div className="relative flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm flex-shrink-0`}>
                <Radar className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.textMuted}`}>Live Tracking</p>
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-lg font-black ${theme.textActive} leading-none`}>
                    {trackingActiveNow.toLocaleString()}
                  </span>
                  <span className={`text-[10px] ${theme.textMuted}`}>active now</span>
                </div>
              </div>
              <div className={`px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase tracking-wider shadow-sm`}>
                NEW
              </div>
            </div>
          </NavLink>
        </div>
      )}

      {/* ─── Theme Picker ─── */}
      {(!isCollapsed || isMobile) && (
        <div className="px-3 py-2 flex-shrink-0">
          <div className="relative">
            <button onClick={() => setShowThemePicker(!showThemePicker)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg ${theme.cardBg} ${theme.text} 
                ${theme.hover} transition-all duration-200 touch-manipulation`}>
              <Palette size={14} className="flex-shrink-0" />
              <span className="flex-1 text-left text-[11.5px] font-medium truncate">{theme.name} Theme</span>
              <ChevronDown size={13} className={`transition-transform flex-shrink-0 ${showThemePicker ? 'rotate-180' : ''}`} />
            </button>

            {showThemePicker && (
              <div className={`absolute top-full left-0 right-0 mt-1.5 p-2 ${theme.cardBg} backdrop-blur-xl 
                rounded-xl border ${theme.border} ${theme.shadow} z-[100]`}>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(themes) as ThemeKey[]).map((themeKey) => (
                    <button key={themeKey} onClick={() => changeTheme(themeKey)}
                      className={`p-1.5 rounded-lg transition-all duration-200 touch-manipulation
                        ${currentTheme === themeKey ? `ring-2 ring-white/60 ${themes[themeKey].accent}` : theme.hover}`}>
                      <div className={`w-full h-6 rounded ${themes[themeKey].sidebar} mb-1 shadow-inner`} />
                      <span className={`text-[9px] font-semibold ${theme.text}`}>{themes[themeKey].name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Navigation ─── */}
      <nav ref={navRef} className="flex-1 px-2 py-2 overflow-y-auto custom-scrollbar overscroll-contain" style={{ scrollBehavior: 'auto' }}>
        <SectionDivider label="Main" />
        {navigation.map((item) => renderNavItem(item))}

        {renderSubMenu('Locations', MapPin, locationSubMenu, isLocationMenuExpanded, setIsLocationMenuExpanded, isLocationRoute)}

        <SectionDivider label="Server-Driven UI" />
        {renderSubMenu('SDUI Manager', Smartphone, sduiMenuItems, isSDUIMenuExpanded, setIsSDUIMenuExpanded, isSDUIRoute)}

        <SectionDivider label="Checkout" />
        {renderSubMenu('Checkout', ShoppingCart, checkoutMenuItems, isCheckoutMenuExpanded, setIsCheckoutMenuExpanded, isCheckoutRoute)}

        <SectionDivider label="System" />
        {otherNavigation.map((item) => renderNavItem(item))}
      </nav>

      {/* ─── Footer ─── */}
      <div className={`p-2.5 border-t ${theme.border} flex-shrink-0 ${isMobile ? 'pb-5' : ''}`}>
        {(!isCollapsed || isMobile) ? (
          <div className="space-y-1.5">
            <div className={`flex items-center gap-2.5 p-2 ${theme.cardBg} rounded-lg`}>
              <div className={`h-9 w-9 rounded-lg ${theme.accent} flex items-center justify-center text-white 
                font-black shadow-md flex-shrink-0 text-sm`}>
                {admin?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[12.5px] font-bold ${theme.textActive} truncate leading-tight`}>{admin?.name}</p>
                <p className={`text-[10px] ${theme.textMuted} truncate leading-tight mt-0.5`}>{admin?.role}</p>
              </div>
              <button onClick={logout}
                className={`p-1.5 rounded-md ${theme.text} hover:text-red-400 ${theme.hover} transition-all duration-200 flex-shrink-0`}
                title="Sign Out">
                <LogOut size={15} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className={`h-9 w-9 rounded-lg ${theme.accent} flex items-center justify-center text-white 
              font-black group relative shadow-md text-sm`}>
              {admin?.name?.charAt(0).toUpperCase() || 'A'}
              <div className={`absolute left-full ml-3 px-3 py-2 ${theme.cardBg} backdrop-blur-xl text-xs 
                rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all 
                duration-150 whitespace-nowrap z-[100] border ${theme.border} ${theme.shadow}`}>
                <p className={`font-bold ${theme.textActive}`}>{admin?.name}</p>
                <p className={theme.textMuted}>{admin?.role}</p>
              </div>
            </div>
            <button onClick={logout}
              className={`p-2 ${theme.text} hover:text-red-400 ${theme.hover} rounded-lg transition-all duration-200 group relative hover:scale-110`}>
              <LogOut size={15} />
              <div className={`absolute left-full ml-3 px-3 py-1.5 ${theme.cardBg} backdrop-blur-xl text-xs 
                rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all 
                duration-150 whitespace-nowrap z-[100] border ${theme.border} ${theme.shadow}`}>
                <span className={theme.text}>Sign Out</span>
              </div>
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {isMobile && !isOpen && <MobileMenuButton />}

      {isMobile && (
        <div
          className={`fixed inset-0 z-40 transition-all duration-300 ${
            isOpen ? `${theme.overlay} opacity-100` : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        {...(isMobile ? swipeHandlers : {})}
        className={`
          ${isMobile
            ? `fixed inset-y-0 left-0 z-50 w-[82vw] max-w-[300px] transform transition-transform duration-300 ease-out
               ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
            : `${isCollapsed ? 'w-[68px]' : 'w-[248px]'} relative transition-all duration-300`
          }
          ${theme.sidebar} min-h-screen flex flex-col ${theme.shadow}
        `}
      >
        <SidebarContent />
      </div>

      {isMobile && <MobileBottomNav />}
      {isMobile && <div className="h-16 flex-shrink-0" />}

      <style>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        .touch-manipulation {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        @media (max-width: 767px) {
          .custom-scrollbar { -webkit-overflow-scrolling: touch; }
        }
        [data-focus-guard] { position: fixed; }
        @keyframes gentle-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-pulse {
          animation: gentle-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse-slow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </>
  );
}