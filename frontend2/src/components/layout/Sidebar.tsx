// src/components/layout/Sidebar.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  TrendingUp,
  Menu,
  X,
  Home,
  Calendar,
  Zap,
  Radar,
  Radio,
  Target,
  Mail,
  Rocket,
  Palette,
  Moon,
  Sun,
  Monitor,
  Waves,
  TreePine,
  Sunset,
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
  isNew?: boolean;
  isCritical?: boolean;
}

// ─── Hooks ───
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
};

const useSwipe = (onLeft: () => void, onRight: () => void) => {
  const startX = useRef(0);
  const endX = useRef(0);
  return {
    onTouchStart: (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; },
    onTouchMove: (e: React.TouchEvent) => { endX.current = e.touches[0].clientX; },
    onTouchEnd: () => {
      const d = startX.current - endX.current;
      if (Math.abs(d) > 50) d > 0 ? onLeft() : onRight();
    },
  };
};

// ─── Themes ───
const themes = {
  light: {
    name: 'Light',
    icon: Sun,
    sidebar: 'bg-white',
    text: 'text-gray-600',
    textMuted: 'text-gray-400',
    textActive: 'text-gray-900',
    border: 'border-gray-200/80',
    hover: 'hover:bg-gray-50 active:bg-gray-100',
    active: 'bg-indigo-50 text-indigo-700 font-semibold',
    activeBar: 'bg-indigo-600',
    cardBg: 'bg-gray-50',
    accent: 'bg-indigo-600',
    accentText: 'text-indigo-600',
    badge: 'bg-indigo-100 text-indigo-700',
    badgeHot: 'bg-rose-500 text-white',
    badgeCritical: 'bg-red-600 text-white',
    badgeNew: 'bg-emerald-500 text-white',
    sectionLabel: 'text-gray-400',
    scrollThumb: 'rgba(0,0,0,0.12)',
    shadow: 'shadow-lg shadow-gray-200/60',
    overlay: 'bg-black/40',
    footerBg: 'bg-gray-50',
    divider: 'bg-gray-200/70',
    avatarRing: 'ring-indigo-200',
  },
  dark: {
    name: 'Dark',
    icon: Moon,
    sidebar: 'bg-[#0f1117]',
    text: 'text-gray-400',
    textMuted: 'text-gray-600',
    textActive: 'text-white',
    border: 'border-white/[0.06]',
    hover: 'hover:bg-white/[0.04] active:bg-white/[0.08]',
    active: 'bg-white/[0.08] text-white font-semibold',
    activeBar: 'bg-indigo-500',
    cardBg: 'bg-white/[0.03]',
    accent: 'bg-indigo-600',
    accentText: 'text-indigo-400',
    badge: 'bg-indigo-500/20 text-indigo-300',
    badgeHot: 'bg-rose-500 text-white',
    badgeCritical: 'bg-red-600 text-white',
    badgeNew: 'bg-emerald-500 text-white',
    sectionLabel: 'text-gray-600',
    scrollThumb: 'rgba(255,255,255,0.08)',
    shadow: 'shadow-lg shadow-black/40',
    overlay: 'bg-black/60',
    footerBg: 'bg-white/[0.02]',
    divider: 'bg-white/[0.06]',
    avatarRing: 'ring-indigo-500/30',
  },
  purple: {
    name: 'Purple',
    icon: Sparkles,
    sidebar: 'bg-gradient-to-b from-[#1a1035] via-[#1e1145] to-[#150d30]',
    text: 'text-purple-200/70',
    textMuted: 'text-purple-400/40',
    textActive: 'text-white',
    border: 'border-purple-500/10',
    hover: 'hover:bg-white/[0.05] active:bg-white/[0.1]',
    active: 'bg-white/[0.1] text-white font-semibold',
    activeBar: 'bg-purple-400',
    cardBg: 'bg-white/[0.04]',
    accent: 'bg-purple-500',
    accentText: 'text-purple-300',
    badge: 'bg-purple-500/20 text-purple-200',
    badgeHot: 'bg-pink-500 text-white',
    badgeCritical: 'bg-red-500 text-white',
    badgeNew: 'bg-emerald-400 text-white',
    sectionLabel: 'text-purple-400/40',
    scrollThumb: 'rgba(168,85,247,0.15)',
    shadow: 'shadow-lg shadow-purple-900/40',
    overlay: 'bg-purple-950/70',
    footerBg: 'bg-white/[0.02]',
    divider: 'bg-purple-500/10',
    avatarRing: 'ring-purple-400/30',
  },
  ocean: {
    name: 'Ocean',
    icon: Waves,
    sidebar: 'bg-gradient-to-b from-[#0a1628] via-[#0d1f3c] to-[#0a1929]',
    text: 'text-blue-200/70',
    textMuted: 'text-blue-400/40',
    textActive: 'text-white',
    border: 'border-blue-500/10',
    hover: 'hover:bg-white/[0.05] active:bg-white/[0.1]',
    active: 'bg-white/[0.1] text-white font-semibold',
    activeBar: 'bg-cyan-400',
    cardBg: 'bg-white/[0.04]',
    accent: 'bg-cyan-500',
    accentText: 'text-cyan-300',
    badge: 'bg-cyan-500/20 text-cyan-200',
    badgeHot: 'bg-cyan-400 text-white',
    badgeCritical: 'bg-red-500 text-white',
    badgeNew: 'bg-emerald-400 text-white',
    sectionLabel: 'text-blue-400/40',
    scrollThumb: 'rgba(34,211,238,0.12)',
    shadow: 'shadow-lg shadow-blue-950/40',
    overlay: 'bg-blue-950/70',
    footerBg: 'bg-white/[0.02]',
    divider: 'bg-blue-500/10',
    avatarRing: 'ring-cyan-400/30',
  },
  forest: {
    name: 'Forest',
    icon: TreePine,
    sidebar: 'bg-gradient-to-b from-[#0a1a14] via-[#0d2418] to-[#0a1a12]',
    text: 'text-emerald-200/70',
    textMuted: 'text-emerald-400/40',
    textActive: 'text-white',
    border: 'border-emerald-500/10',
    hover: 'hover:bg-white/[0.05] active:bg-white/[0.1]',
    active: 'bg-white/[0.1] text-white font-semibold',
    activeBar: 'bg-emerald-400',
    cardBg: 'bg-white/[0.04]',
    accent: 'bg-emerald-500',
    accentText: 'text-emerald-300',
    badge: 'bg-emerald-500/20 text-emerald-200',
    badgeHot: 'bg-emerald-400 text-white',
    badgeCritical: 'bg-red-500 text-white',
    badgeNew: 'bg-lime-400 text-white',
    sectionLabel: 'text-emerald-400/40',
    scrollThumb: 'rgba(52,211,153,0.12)',
    shadow: 'shadow-lg shadow-emerald-950/40',
    overlay: 'bg-emerald-950/70',
    footerBg: 'bg-white/[0.02]',
    divider: 'bg-emerald-500/10',
    avatarRing: 'ring-emerald-400/30',
  },
  sunset: {
    name: 'Sunset',
    icon: Sunset,
    sidebar: 'bg-gradient-to-b from-[#1a0f08] via-[#2a1510] to-[#1a0c0a]',
    text: 'text-orange-200/70',
    textMuted: 'text-orange-400/40',
    textActive: 'text-white',
    border: 'border-orange-500/10',
    hover: 'hover:bg-white/[0.05] active:bg-white/[0.1]',
    active: 'bg-white/[0.1] text-white font-semibold',
    activeBar: 'bg-orange-400',
    cardBg: 'bg-white/[0.04]',
    accent: 'bg-orange-500',
    accentText: 'text-orange-300',
    badge: 'bg-orange-500/20 text-orange-200',
    badgeHot: 'bg-orange-400 text-white',
    badgeCritical: 'bg-red-500 text-white',
    badgeNew: 'bg-yellow-400 text-gray-900',
    sectionLabel: 'text-orange-400/40',
    scrollThumb: 'rgba(251,146,60,0.12)',
    shadow: 'shadow-lg shadow-orange-950/40',
    overlay: 'bg-orange-950/70',
    footerBg: 'bg-white/[0.02]',
    divider: 'bg-orange-500/10',
    avatarRing: 'ring-orange-400/30',
  },
};
type ThemeKey = keyof typeof themes;

// ─── Navigation Data ───
const mainNav: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Bookings', href: '/bookings', icon: Calendar, hasBadge: true, badgeType: 'booking' },
  { name: 'Live Tracking', href: '/tracking', icon: Radar, hasBadge: true, badgeType: 'tracking', isNew: true },
];

const dispatchNav: NavItem[] = [
  { name: 'Dispatch Monitor', href: '/dispatch', icon: Zap, isNew: true },
  { name: 'Manual Dispatch', href: '/manual-dispatch', icon: Target, isCritical: true },
  { name: 'Offer History', href: '/provider-offers', icon: Send },
  { name: 'Alerts Center', href: '/notifications', icon: Radio },
];

const commNav: NavItem[] = [
  { name: 'Direct Push', href: '/direct-push', icon: Rocket, isNew: true },
  { name: 'Bulk Email', href: '/bulk-email', icon: Mail, isNew: true },
];

const entityNav: NavItem[] = [
  { name: 'Providers', href: '/providers', icon: Briefcase, hasBadge: true, badgeType: 'provider' },
  { name: 'Verifications', href: '/verifications', icon: ClipboardCheck },
  { name: 'Users', href: '/users', icon: UserPlus, hasBadge: true, badgeType: 'user' },
];

const locationSub: NavItem[] = [
  { name: 'Cities', href: '/locations/cities', icon: Building2 },
  { name: 'Zones', href: '/locations/zones', icon: Map },
];

const sduiSub: NavItem[] = [
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

const checkoutSub: NavItem[] = [
  { name: 'Coupons', href: '/checkout/coupons', icon: Gift },
  { name: 'Checkout Settings', href: '/checkout/settings', icon: Receipt },
];

const systemNav: NavItem[] = [
  { name: 'Pricing', href: '/pricing', icon: DollarSign },
  { name: 'Analytics', href: '/analytics', icon: BarChart2 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const bottomMobileNav: NavItem[] = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Bookings', href: '/bookings', icon: Calendar },
  { name: 'Dispatch', href: '/manual-dispatch', icon: Target },
  { name: 'Providers', href: '/providers', icon: Briefcase },
];

// ═══════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════
export default function Sidebar() {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();

  const navRef = useRef<HTMLElement>(null);
  const scrollPos = useRef(0);
  const preventScroll = useRef(false);
  const mounted = useRef(true);

  const [isOpen, setIsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setThemeKey] = useState<ThemeKey>('purple');
  const [showThemes, setShowThemes] = useState(false);
  const [expandLoc, setExpandLoc] = useState(false);
  const [expandSDUI, setExpandSDUI] = useState(false);
  const [expandCheckout, setExpandCheckout] = useState(false);

  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [providerStats, setProviderStats] = useState<ProviderStatsSimple | null>(null);
  const [bookingStats, setBookingStats] = useState<BookingStatsSimple | null>(null);
  const [trackingActive, setTrackingActive] = useState(0);

  const t = themes[theme];
  const swipe = useSwipe(() => setIsOpen(false), () => setIsOpen(true));
  const isLocRoute = location.pathname.startsWith('/locations');
  const isSDUIRoute = location.pathname.startsWith('/sdui');
  const isCheckoutRoute = location.pathname.startsWith('/checkout');
  const isCollapsedView = collapsed && !isMobile;

  // ─── Init ───
  useEffect(() => {
    const saved = localStorage.getItem('sidebarTheme') as ThemeKey;
    if (saved && themes[saved]) setThemeKey(saved);
    if (isLocRoute) setExpandLoc(true);
    if (isSDUIRoute) setExpandSDUI(true);
    if (isCheckoutRoute) setExpandCheckout(true);
    mounted.current = false;
  }, []);

  useEffect(() => { if (isMobile) setIsOpen(false); }, [location.pathname, isMobile]);
  useEffect(() => {
    document.body.style.overflow = isMobile && isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, isOpen]);

  useEffect(() => {
    if (preventScroll.current && navRef.current) {
      requestAnimationFrame(() => {
        if (navRef.current) navRef.current.scrollTop = scrollPos.current;
        preventScroll.current = false;
      });
    }
  }, [location.pathname]);

  const changeTheme = (k: ThemeKey) => {
    setThemeKey(k);
    localStorage.setItem('sidebarTheme', k);
    setShowThemes(false);
  };

  // ─── Badge Data ───
  const fetchBadges = useCallback(async () => {
    try {
      const [u, p, b] = await Promise.allSettled([
        usersApi.getStats(),
        providersApi.getStats(),
        bookingsApi.getStats(),
      ]);
      if (u.status === 'fulfilled' && u.value?.success) {
        setUserStats(u.value.data as UserStats);
      }
      if (p.status === 'fulfilled' && p.value?.success) {
        setProviderStats({ pendingVerifications: p.value.data?.pendingVerifications || 0 });
      }
      if (b.status === 'fulfilled' && b.value?.success) {
        const d = b.value.data as any;
        const ss = d?.statusStats || [];
        setBookingStats({
          pendingBookings: ss.filter((s: any) => ['pending', 'searching', 'assigned'].includes(s._id)).reduce((a: number, s: any) => a + (s.count || 0), 0),
          todayBookings: d?.todayBookings || 0,
          inProgressBookings: ss.filter((s: any) => ['accepted', 'en-route', 'arrived', 'in-progress'].includes(s._id)).reduce((a: number, s: any) => a + (s.count || 0), 0),
        });
      }
    } catch {}
    try {
      const mod: any = await import('../../lib/api');
      if (mod?.trackingApi?.getStats) {
        const data = await mod.trackingApi.getStats();
        setTrackingActive(data?.activeNow || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchBadges();
    const iv = setInterval(fetchBadges, 60000);
    return () => clearInterval(iv);
  }, [fetchBadges]);

  const badge = (type?: string) => {
    if (type === 'user') return userStats?.todaySignups || 0;
    if (type === 'provider') return providerStats?.pendingVerifications || 0;
    if (type === 'booking') return bookingStats?.pendingBookings || 0;
    if (type === 'tracking') return trackingActive;
    return 0;
  };

  const saveScroll = () => { if (navRef.current) scrollPos.current = navRef.current.scrollTop; };
  const onNav = () => { saveScroll(); preventScroll.current = true; if (isMobile) setIsOpen(false); };
  const onSubmenu = (set: React.Dispatch<React.SetStateAction<boolean>>, val: boolean) => {
    saveScroll();
    preventScroll.current = true;
    set(!val);
    requestAnimationFrame(() => { if (navRef.current) navRef.current.scrollTop = scrollPos.current; });
  };

  // ═══════════ RENDER NAV ITEM ═══════════
  const NavItemRow = ({ item }: { item: NavItem }) => {
    const count = badge(item.badgeType);
    return (
      <NavLink
        to={item.href}
        onClick={onNav}
        preventScrollReset
        className={({ isActive }) =>
          `group relative flex items-center gap-3 rounded-lg transition-all duration-200 select-none
          ${isCollapsedView ? 'justify-center px-2 py-2.5 mx-1' : 'px-3 py-[9px] mx-2'}
          ${isActive ? t.active : `${t.text} ${t.hover}`}
          ${item.isCritical && !isActive ? 'ring-1 ring-red-500/20 bg-red-500/5' : ''}`
        }
      >
        {({ isActive }) => (
          <>
            {/* Active indicator bar */}
            {isActive && (
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full ${t.activeBar}`} />
            )}

            {/* Icon */}
            <div className="relative flex-shrink-0">
              <item.icon
                size={isCollapsedView ? 20 : 18}
                strokeWidth={isActive ? 2.2 : 1.8}
                className={`transition-transform duration-200 ${isActive ? 'scale-105' : 'group-hover:scale-105'}
                  ${item.isCritical ? 'text-red-400' : ''}`}
              />
              {/* Collapsed badge dot */}
              {isCollapsedView && count > 0 && (
                <span className={`absolute -top-1 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full
                  ${item.isCritical ? t.badgeCritical : t.badgeHot}
                  text-[8px] font-bold flex items-center justify-center shadow-sm`}>
                  {count > 9 ? '9+' : count}
                </span>
              )}
              {isCollapsedView && !count && item.isNew && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 shadow-sm" />
              )}
              {isCollapsedView && !count && item.isCritical && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-sm" />
              )}
            </div>

            {/* Label + badges (expanded) */}
            {!isCollapsedView && (
              <>
                <span className={`flex-1 text-[13px] leading-tight truncate
                  ${isActive ? 'font-semibold' : 'font-medium'}
                  ${item.isCritical ? 'font-semibold' : ''}`}>
                  {item.name}
                </span>

                {item.isCritical && (
                  <span className={`px-1.5 py-[2px] rounded text-[8px] font-extrabold uppercase tracking-wider
                    ${t.badgeCritical} shadow-sm animate-pulse`}>
                    SOS
                  </span>
                )}

                {item.isNew && !count && !item.isCritical && (
                  <span className={`px-1.5 py-[2px] rounded text-[8px] font-extrabold uppercase tracking-wider
                    ${t.badgeNew} shadow-sm`}>
                    NEW
                  </span>
                )}

                {count > 0 && !item.isCritical && (
                  <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold
                    flex items-center justify-center ${t.badgeHot} shadow-sm`}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </>
            )}

            {/* Collapsed tooltip */}
            {isCollapsedView && (
              <div className={`absolute left-full ml-3 px-3 py-2 rounded-lg z-[200]
                ${t.cardBg} backdrop-blur-xl border ${t.border} ${t.shadow}
                opacity-0 invisible group-hover:opacity-100 group-hover:visible
                transition-all duration-150 whitespace-nowrap pointer-events-none`}>
                <span className={`text-xs font-semibold ${t.textActive}`}>{item.name}</span>
                {count > 0 && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${t.badgeHot}`}>{count}</span>
                )}
                {item.isNew && !count && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${t.badgeNew}`}>NEW</span>
                )}
                {item.isCritical && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${t.badgeCritical}`}>SOS</span>
                )}
              </div>
            )}
          </>
        )}
      </NavLink>
    );
  };

  // ═══════════ RENDER SUBMENU ═══════════
  const SubMenu = ({
    title, icon: Icon, items, expanded, setExpanded, isRoute,
  }: {
    title: string; icon: React.ElementType; items: NavItem[];
    expanded: boolean; setExpanded: React.Dispatch<React.SetStateAction<boolean>>; isRoute: boolean;
  }) => (
    <div>
      <button
        onClick={() => !isCollapsedView && onSubmenu(setExpanded, expanded)}
        className={`group relative w-full flex items-center gap-3 rounded-lg transition-all duration-200 select-none
          ${isCollapsedView ? 'justify-center px-2 py-2.5 mx-1' : 'px-3 py-[9px] mx-2'}
          ${isRoute ? t.active : `${t.text} ${t.hover}`}`}
      >
        {isRoute && (
          <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full ${t.activeBar}`} />
        )}
        <Icon size={isCollapsedView ? 20 : 18} strokeWidth={isRoute ? 2.2 : 1.8} className="flex-shrink-0" />
        {!isCollapsedView && (
          <>
            <span className={`flex-1 text-left text-[13px] leading-tight truncate ${isRoute ? 'font-semibold' : 'font-medium'}`}>
              {title}
            </span>
            <ChevronDown
              size={14}
              className={`flex-shrink-0 transition-transform duration-300 ${t.textMuted} ${expanded ? 'rotate-180' : ''}`}
            />
          </>
        )}

        {/* Collapsed flyout */}
        {isCollapsedView && (
          <div className={`absolute left-full ml-3 py-2 px-1 rounded-xl z-[200] min-w-[180px]
            ${t.cardBg} backdrop-blur-xl border ${t.border} ${t.shadow}
            opacity-0 invisible group-hover:opacity-100 group-hover:visible
            transition-all duration-150 pointer-events-auto`}>
            <p className={`px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider ${t.sectionLabel}`}>{title}</p>
            {items.map(sub => (
              <NavLink
                key={sub.name}
                to={sub.href}
                onClick={onNav}
                preventScrollReset
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md text-[11px] transition-colors
                  ${isActive ? `${t.active}` : `${t.text} ${t.hover}`}`
                }
              >
                <sub.icon size={13} className="flex-shrink-0" />
                <span className="font-medium">{sub.name}</span>
              </NavLink>
            ))}
          </div>
        )}
      </button>

      {/* Expanded sub-items */}
      {!isCollapsedView && (
        <div className={`overflow-hidden transition-all duration-300 ease-in-out
          ${expanded ? 'max-h-[600px] opacity-100 mt-0.5' : 'max-h-0 opacity-0'}`}>
          <div className={`ml-5 mr-2 pl-3 border-l-[2px] ${t.divider} space-y-[1px] py-0.5`}>
            {items.map(sub => (
              <NavLink
                key={sub.name}
                to={sub.href}
                onClick={onNav}
                preventScrollReset
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-[7px] rounded-md transition-all duration-200 select-none
                  ${isActive ? `${t.accent} text-white shadow-sm` : `${t.text} ${t.hover}`}`
                }
              >
                {({ isActive }) => (
                  <>
                    <sub.icon size={14} strokeWidth={isActive ? 2.2 : 1.8} className="flex-shrink-0" />
                    <span className={`text-[12px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{sub.name}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ═══════════ SECTION DIVIDER ═══════════
  const Section = ({ label }: { label: string }) =>
    isCollapsedView ? (
      <div className="my-2 mx-3"><div className={`h-px ${t.divider}`} /></div>
    ) : (
      <div className="mt-5 mb-1.5 mx-5">
        <p className={`text-[9px] font-extrabold uppercase tracking-[0.2em] ${t.sectionLabel}`}>{label}</p>
      </div>
    );

  // ═══════════ SIDEBAR CONTENT ═══════════
  const Content = () => (
    <>
      {/* ─── Header ─── */}
      <div className={`flex items-center justify-between border-b ${t.border} flex-shrink-0
        ${isCollapsedView ? 'px-2 py-3' : 'px-4 py-3.5'}`}>
        {isCollapsedView ? (
          <div className={`w-9 h-9 rounded-xl ${t.accent} flex items-center justify-center mx-auto shadow-lg`}>
            <Sparkles className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl ${t.accent} flex items-center justify-center shadow-lg flex-shrink-0`}>
              <Sparkles className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h1 className={`text-[14px] font-extrabold ${t.textActive} truncate leading-tight tracking-tight`}>
                Admin Panel
              </h1>
              <p className={`text-[10px] ${t.textMuted} truncate`}>Control Center</p>
            </div>
          </div>
        )}

        {isMobile ? (
          <button
            onClick={() => setIsOpen(false)}
            className={`p-1.5 ${t.text} ${t.hover} rounded-lg flex-shrink-0`}
          >
            <X size={18} />
          </button>
        ) : (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-1.5 ${t.text} ${t.hover} rounded-lg flex-shrink-0 transition-transform hover:scale-110`}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        )}
      </div>

      {/* ─── Theme Picker (compact) ─── */}
      {!isCollapsedView && (
        <div className="px-3 pt-3 pb-1 flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowThemes(!showThemes)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg ${t.cardBg}
                ${t.text} ${t.hover} transition-all duration-200`}
            >
              {React.createElement(themes[theme].icon, { size: 13, className: 'flex-shrink-0' })}
              <span className="flex-1 text-left text-[11px] font-medium">{t.name}</span>
              <ChevronDown size={12} className={`transition-transform ${showThemes ? 'rotate-180' : ''} ${t.textMuted}`} />
            </button>

            {showThemes && (
              <div className={`absolute top-full left-0 right-0 mt-1 p-2 rounded-xl z-[200]
                ${t.cardBg} backdrop-blur-xl border ${t.border} ${t.shadow}`}>
                <div className="grid grid-cols-3 gap-1">
                  {(Object.keys(themes) as ThemeKey[]).map(k => {
                    const th = themes[k];
                    const active = theme === k;
                    return (
                      <button
                        key={k}
                        onClick={() => changeTheme(k)}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all
                          ${active ? `ring-2 ring-white/40 ${th.accent}` : t.hover}`}
                      >
                        <div className={`w-full h-5 rounded ${th.sidebar} shadow-inner`} />
                        <span className={`text-[8px] font-bold ${active ? 'text-white' : t.text}`}>{th.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Navigation ─── */}
      <nav
        ref={navRef}
        className="flex-1 py-1 overflow-y-auto sidebar-scroll overscroll-contain"
        style={{ scrollBehavior: 'auto' }}
      >
        <Section label="Overview" />
        {mainNav.map(i => <NavItemRow key={i.name} item={i} />)}

        <Section label="Dispatch" />
        {dispatchNav.map(i => <NavItemRow key={i.name} item={i} />)}

        <Section label="Communication" />
        {commNav.map(i => <NavItemRow key={i.name} item={i} />)}

        <Section label="People" />
        {entityNav.map(i => <NavItemRow key={i.name} item={i} />)}

        <Section label="Locations" />
        <SubMenu title="Locations" icon={MapPin} items={locationSub} expanded={expandLoc} setExpanded={setExpandLoc} isRoute={isLocRoute} />

        <Section label="App Builder" />
        <SubMenu title="SDUI Manager" icon={Smartphone} items={sduiSub} expanded={expandSDUI} setExpanded={setExpandSDUI} isRoute={isSDUIRoute} />

        <Section label="Commerce" />
        <SubMenu title="Checkout" icon={ShoppingCart} items={checkoutSub} expanded={expandCheckout} setExpanded={setExpandCheckout} isRoute={isCheckoutRoute} />

        <Section label="System" />
        {systemNav.map(i => <NavItemRow key={i.name} item={i} />)}
      </nav>

      {/* ─── Footer ─── */}
      <div className={`border-t ${t.border} flex-shrink-0 ${t.footerBg} ${isMobile ? 'pb-6' : ''}`}>
        {isCollapsedView ? (
          <div className="flex flex-col items-center gap-2 py-3">
            <div className={`w-9 h-9 rounded-xl ${t.accent} flex items-center justify-center
              text-white font-bold text-sm shadow-md ring-2 ${t.avatarRing} group relative`}>
              {admin?.name?.charAt(0).toUpperCase() || 'A'}
              <div className={`absolute left-full ml-3 px-3 py-2 rounded-lg z-[200]
                ${t.cardBg} backdrop-blur-xl border ${t.border} ${t.shadow}
                opacity-0 invisible group-hover:opacity-100 group-hover:visible
                transition-all duration-150 whitespace-nowrap pointer-events-none`}>
                <p className={`font-bold text-xs ${t.textActive}`}>{admin?.name}</p>
                <p className={`text-[10px] ${t.textMuted}`}>{admin?.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className={`p-2 rounded-lg ${t.text} hover:text-red-400 ${t.hover} transition-all group relative`}
            >
              <LogOut size={15} />
              <div className={`absolute left-full ml-3 px-3 py-1.5 rounded-lg z-[200]
                ${t.cardBg} backdrop-blur-xl border ${t.border} ${t.shadow}
                opacity-0 invisible group-hover:opacity-100 group-hover:visible
                transition-all duration-150 whitespace-nowrap pointer-events-none`}>
                <span className={`text-xs ${t.text}`}>Sign Out</span>
              </div>
            </button>
          </div>
        ) : (
          <div className="p-3">
            <div className={`flex items-center gap-2.5 p-2.5 rounded-xl ${t.cardBg}`}>
              <div className={`w-9 h-9 rounded-xl ${t.accent} flex items-center justify-center
                text-white font-bold text-sm shadow-md ring-2 ${t.avatarRing} flex-shrink-0`}>
                {admin?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[12px] font-bold ${t.textActive} truncate leading-tight`}>{admin?.name}</p>
                <p className={`text-[10px] ${t.textMuted} truncate`}>{admin?.role || 'Admin'}</p>
              </div>
              <button
                onClick={logout}
                className={`p-1.5 rounded-lg ${t.text} hover:text-red-400 ${t.hover} transition-all flex-shrink-0`}
                title="Sign Out"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // ═══════════ MOBILE BOTTOM NAV ═══════════
  const BottomNav = () => (
    <div
      className={`md:hidden fixed bottom-0 left-0 right-0 z-30 ${t.sidebar} border-t ${t.border} backdrop-blur-xl`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      <div className="flex items-center justify-around px-1 py-1">
        {bottomMobileNav.map(item => {
          const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
          const count = item.name === 'Bookings' ? (bookingStats?.pendingBookings || 0) : 0;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              preventScrollReset
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[56px] relative select-none
                ${isActive ? t.textActive : t.textMuted}`}
            >
              <div className="relative">
                <item.icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
                {count > 0 && (
                  <span className={`absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full
                    ${t.badgeHot} text-[8px] font-bold flex items-center justify-center shadow`}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </div>
              <span className={`text-[9px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.name}</span>
              {isActive && (
                <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full ${t.activeBar}`} />
              )}
            </NavLink>
          );
        })}
        <button
          onClick={() => setIsOpen(true)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[56px] ${t.textMuted} select-none`}
        >
          <Menu size={20} strokeWidth={1.8} />
          <span className="text-[9px] font-medium">More</span>
        </button>
      </div>
    </div>
  );

  // ═══════════ RENDER ═══════════
  return (
    <>
      {/* Mobile hamburger */}
      {isMobile && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`md:hidden fixed top-4 left-4 z-40 p-2.5 rounded-xl ${t.sidebar} ${t.shadow}
            ${t.text} border ${t.border} active:scale-95 transition-all relative select-none`}
          aria-label="Open menu"
        >
          <Menu size={20} />
          {(bookingStats?.pendingBookings || 0) > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm">
              <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping" />
            </span>
          )}
        </button>
      )}

      {/* Mobile overlay */}
      {isMobile && (
        <div
          className={`fixed inset-0 z-40 transition-opacity duration-300
            ${isOpen ? `${t.overlay} opacity-100` : 'opacity-0 pointer-events-none'}`}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <div
        {...(isMobile ? swipe : {})}
        className={`
          ${isMobile
            ? `fixed inset-y-0 left-0 z-50 w-[80vw] max-w-[280px] transform transition-transform duration-300 ease-out
               ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
            : `${collapsed ? 'w-[64px]' : 'w-[240px]'} relative transition-all duration-300`
          }
          ${t.sidebar} min-h-screen flex flex-col ${t.shadow}
        `}
      >
        <Content />
      </div>

      {isMobile && <BottomNav />}
      {isMobile && <div className="h-14 flex-shrink-0" />}

      <style>{`
        .sidebar-scroll {
          scrollbar-width: thin;
          scrollbar-color: ${t.scrollThumb} transparent;
        }
        .sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: ${t.scrollThumb};
          border-radius: 3px;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: ${t.scrollThumb.replace(/[\d.]+\)$/, (m: string) => `${Math.min(parseFloat(m) * 2, 1)})`)}
        }
        @media (max-width: 767px) {
          .sidebar-scroll { -webkit-overflow-scrolling: touch; }
        }
      `}</style>
    </>
  );
}