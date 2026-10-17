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
} from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { usersApi, providersApi } from '../../lib/api';

// Types
interface UserStats {
  totalUsers: number;
  activeUsers: number;
  todaySignups: number;
  verifiedUsers: number;
}

interface ProviderStatsSimple {
  pendingVerifications: number;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  hasBadge?: boolean;
  badgeType?: string;
}

// Custom hook for detecting mobile
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

// Custom hook for swipe detection
const useSwipe = (onSwipeLeft: () => void, onSwipeRight: () => void) => {
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const onTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        onSwipeLeft();
      } else {
        onSwipeRight();
      }
    }
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
};

// Theme configurations
const themes = {
  light: {
    name: 'Light',
    sidebar: 'bg-white',
    text: 'text-gray-700',
    textMuted: 'text-gray-500',
    textActive: 'text-indigo-600',
    border: 'border-gray-200',
    hover: 'hover:bg-gray-100 active:bg-gray-200',
    active: 'bg-indigo-50 text-indigo-600 border-r-4 border-indigo-600',
    cardBg: 'bg-gray-50',
    accent: 'bg-indigo-600',
    accentHover: 'hover:bg-indigo-700',
    badge: 'bg-indigo-100 text-indigo-600',
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
    active: 'bg-indigo-600/20 text-indigo-400 border-r-4 border-indigo-500',
    cardBg: 'bg-gray-800',
    accent: 'bg-indigo-600',
    accentHover: 'hover:bg-indigo-700',
    badge: 'bg-indigo-500/20 text-indigo-400',
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
    active: 'bg-white/20 text-white border-r-4 border-pink-400',
    cardBg: 'bg-white/10',
    accent: 'bg-pink-500',
    accentHover: 'hover:bg-pink-600',
    badge: 'bg-pink-500/20 text-pink-300',
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
    active: 'bg-white/20 text-white border-r-4 border-cyan-400',
    cardBg: 'bg-white/10',
    accent: 'bg-cyan-500',
    accentHover: 'hover:bg-cyan-600',
    badge: 'bg-cyan-500/20 text-cyan-300',
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
    active: 'bg-white/20 text-white border-r-4 border-emerald-400',
    cardBg: 'bg-white/10',
    accent: 'bg-emerald-500',
    accentHover: 'hover:bg-emerald-600',
    badge: 'bg-emerald-500/20 text-emerald-300',
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
    active: 'bg-white/20 text-white border-r-4 border-yellow-400',
    cardBg: 'bg-white/10',
    accent: 'bg-orange-500',
    accentHover: 'hover:bg-orange-600',
    badge: 'bg-orange-500/20 text-orange-300',
    shadow: 'shadow-xl shadow-orange-900/50',
    overlay: 'bg-orange-900/80',
  },
};

type ThemeKey = keyof typeof themes;

// Navigation items
const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Providers', href: '/providers', icon: Briefcase, hasBadge: true, badgeType: 'provider' },
  { name: 'Verifications', href: '/verifications', icon: ClipboardCheck },
  { name: 'Users', href: '/users', icon: UserPlus, hasBadge: true, badgeType: 'user' },
];

// Location Management submenu items
const locationSubMenu: NavItem[] = [
  { name: 'Cities', href: '/locations/cities', icon: Building2 },
  { name: 'Zones', href: '/locations/zones', icon: Map },
];

// SDUI menu items
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

// Checkout menu items
const checkoutMenuItems: NavItem[] = [
  { name: 'Coupons', href: '/checkout/coupons', icon: Gift },
  { name: 'Checkout Settings', href: '/checkout/settings', icon: Receipt },
];

// Other navigation items
const otherNavigation: NavItem[] = [
  { name: 'Pricing', href: '/pricing', icon: DollarSign },
  { name: 'Analytics', href: '/analytics', icon: BarChart2 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

// Bottom navigation for mobile
const bottomNavItems: NavItem[] = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Providers', href: '/providers', icon: Briefcase },
  { name: 'SDUI', href: '/sdui', icon: Smartphone },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Refs
  const navRef = useRef<HTMLElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const isInitialMountRef = useRef(true);
  const preventScrollRef = useRef(false);
  
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>('purple');
  const [showThemePicker, setShowThemePicker] = useState(false);

  // Menu expanded states
  const [isLocationMenuExpanded, setIsLocationMenuExpanded] = useState(false);
  const [isSDUIMenuExpanded, setIsSDUIMenuExpanded] = useState(false);
  const [isCheckoutMenuExpanded, setIsCheckoutMenuExpanded] = useState(false);

  // Stats for badges
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [providerStats, setProviderStats] = useState<ProviderStatsSimple | null>(null);

  const theme = themes[currentTheme];

  // Swipe handlers for mobile
  const swipeHandlers = useSwipe(
    () => setIsOpen(false),
    () => setIsOpen(true)
  );

  // Check routes
  const isLocationRoute = location.pathname.startsWith('/locations');
  const isSDUIRoute = location.pathname.startsWith('/sdui');
  const isCheckoutRoute = location.pathname.startsWith('/checkout');

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('sidebarTheme') as ThemeKey;
    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(savedTheme);
    }
  }, []);

  // Save theme to localStorage
  const changeTheme = (newTheme: ThemeKey) => {
    setCurrentTheme(newTheme);
    localStorage.setItem('sidebarTheme', newTheme);
    setShowThemePicker(false);
  };

  // Save scroll position before navigation
  const saveScrollPosition = useCallback(() => {
    if (navRef.current) {
      scrollPositionRef.current = navRef.current.scrollTop;
    }
  }, []);

  // Restore scroll position after navigation
  const restoreScrollPosition = useCallback(() => {
    if (navRef.current && preventScrollRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (navRef.current) {
          navRef.current.scrollTop = scrollPositionRef.current;
        }
        preventScrollRef.current = false;
      });
    }
  }, []);

  // Auto-expand menus ONLY on initial mount
  useEffect(() => {
    if (isInitialMountRef.current) {
      if (isLocationRoute) setIsLocationMenuExpanded(true);
      if (isSDUIRoute) setIsSDUIMenuExpanded(true);
      if (isCheckoutRoute) setIsCheckoutMenuExpanded(true);
      isInitialMountRef.current = false;
    }
  }, []);

  // Restore scroll position after route change
  useEffect(() => {
    restoreScrollPosition();
  }, [location.pathname, restoreScrollPosition]);

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [location.pathname, isMobile]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, isOpen]);

  // Fetch stats
  const fetchUserStats = async () => {
    try {
      const response = await usersApi.getStats();
      if (response.success) {
        setUserStats({
          totalUsers: response.data.totalUsers,
          activeUsers: response.data.activeUsers,
          todaySignups: response.data.todaySignups,
          verifiedUsers: response.data.verifiedUsers,
        });
      }
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
    }
  };

  const fetchProviderStats = async () => {
    try {
      const response = await providersApi.getStats();
      if (response.success) {
        setProviderStats({
          pendingVerifications: response.data.pendingVerifications || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch provider stats:', error);
    }
  };

  const fetchBadgeData = useCallback(async () => {
    await Promise.all([fetchUserStats(), fetchProviderStats()]);
  }, []);

  useEffect(() => {
    fetchBadgeData();
    const interval = setInterval(fetchBadgeData, 60000);
    return () => clearInterval(interval);
  }, [fetchBadgeData]);

  // Get badge count
  const getBadgeCount = (badgeType?: string) => {
    if (badgeType === 'user' && userStats?.todaySignups) return userStats.todaySignups;
    if (badgeType === 'provider' && providerStats?.pendingVerifications) return providerStats.pendingVerifications;
    return 0;
  };

  // Handle navigation item click - FIXED: Save scroll position before navigation
  const handleNavClick = useCallback((e: React.MouseEvent) => {
    saveScrollPosition();
    preventScrollRef.current = true;
    
    if (isMobile) {
      setIsOpen(false);
    }
  }, [isMobile, saveScrollPosition]);

  // Handle submenu toggle - Don't scroll when toggling
  const handleSubmenuToggle = useCallback((
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    currentValue: boolean
  ) => {
    saveScrollPosition();
    preventScrollRef.current = true;
    setter(!currentValue);
    
    // Restore position after state update
    requestAnimationFrame(() => {
      if (navRef.current) {
        navRef.current.scrollTop = scrollPositionRef.current;
      }
    });
  }, [saveScrollPosition]);

  // Render navigation item
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
          `flex items-center gap-3 px-4 py-3.5 rounded-xl mb-1.5 transition-all duration-200 relative group
          ${compact ? 'py-2.5' : 'py-3.5'}
          ${isActive ? theme.active : `${theme.text} ${theme.hover}`}
          ${isCollapsedView ? 'justify-center' : ''}
          touch-manipulation select-none`
        }
      >
        {({ isActive }) => (
          <>
            <div className={`transition-transform duration-200 flex-shrink-0 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
              <item.icon size={compact ? 18 : 20} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            {(!isCollapsedView || isMobile) && (
              <>
                <span className={`flex-1 font-medium ${compact ? 'text-sm' : ''} ${isActive ? 'font-semibold' : ''}`}>
                  {item.name}
                </span>
                {item.hasBadge && badgeCount > 0 && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${theme.badge} animate-pulse flex-shrink-0`}>
                    {item.badgeType === 'provider' ? badgeCount : `+${badgeCount}`}
                  </span>
                )}
              </>
            )}
            
            {/* Desktop collapsed tooltip */}
            {isCollapsedView && !isMobile && (
              <div className={`absolute left-full ml-3 px-4 py-2.5 ${theme.cardBg} backdrop-blur-xl text-sm rounded-xl 
                opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 
                whitespace-nowrap z-[100] border ${theme.border} ${theme.shadow}`}
              >
                <span className={`font-medium ${theme.text}`}>{item.name}</span>
                {item.hasBadge && badgeCount > 0 && (
                  <span className={`ml-2 px-2 py-0.5 ${theme.badge} rounded-full text-xs font-bold`}>
                    {item.badgeType === 'provider' ? badgeCount : `+${badgeCount}`}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </NavLink>
    );
  };

  // Render submenu - FIXED: No auto-scroll on expand
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
      <div className="mb-1.5">
        <button
          onClick={() => !isCollapsedView && handleSubmenuToggle(setIsExpanded, isExpanded)}
          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 relative group
            ${isActiveRoute ? theme.active : `${theme.text} ${theme.hover}`}
            ${isCollapsedView ? 'justify-center' : ''}
            touch-manipulation select-none`}
        >
          <div className={`transition-transform duration-200 flex-shrink-0 ${isActiveRoute ? 'scale-110' : 'group-hover:scale-110'}`}>
            <Icon size={20} strokeWidth={isActiveRoute ? 2.5 : 2} />
          </div>
          {(!isCollapsedView || isMobile) && (
            <>
              <span className={`flex-1 text-left font-medium ${isActiveRoute ? 'font-semibold' : ''}`}>
                {title}
              </span>
              <div className={`transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                <ChevronDown size={16} className={theme.textMuted} />
              </div>
            </>
          )}
          
          {/* Desktop collapsed tooltip */}
          {isCollapsedView && !isMobile && (
            <div className={`absolute left-full ml-3 px-4 py-3 ${theme.cardBg} backdrop-blur-xl text-sm rounded-xl 
              opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 
              whitespace-nowrap z-[100] border ${theme.border} ${theme.shadow} min-w-[180px]`}
            >
              <p className={`font-semibold mb-3 ${theme.text}`}>{title}</p>
              <div className="space-y-1">
                {items.map((subItem) => (
                  <NavLink
                    key={subItem.name}
                    to={subItem.href}
                    onClick={handleNavClick}
                    preventScrollReset={true}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors
                      ${isActive ? theme.active : `${theme.text} ${theme.hover}`}`
                    }
                  >
                    <subItem.icon size={14} />
                    <span className="font-medium">{subItem.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </button>

        {/* Expanded Submenu - No scroll into view */}
        {(!isCollapsedView || isMobile) && (
          <div 
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="ml-4 mt-2 space-y-1 pl-4 border-l-2 border-white/20">
              {items.map((subItem) => (
                <NavLink
                  key={subItem.name}
                  to={subItem.href}
                  onClick={handleNavClick}
                  preventScrollReset={true}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 touch-manipulation select-none
                    ${isActive ? `${theme.accent} text-white shadow-lg` : `${theme.text} ${theme.hover}`}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <subItem.icon size={16} strokeWidth={isActive ? 2.5 : 2} className="flex-shrink-0" />
                      <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
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

  // Section divider
  const SectionDivider = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
    (!isCollapsed || isMobile) ? (
      <div className="my-5 px-4">
        <div className={`flex items-center gap-3 ${theme.textMuted}`}>
          <div className="h-px flex-1 bg-current opacity-30" />
          <div className="flex items-center gap-2">
            <Icon size={12} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
          </div>
          <div className="h-px flex-1 bg-current opacity-30" />
        </div>
      </div>
    ) : (
      <div className="my-3 mx-3">
        <div className={`h-px bg-current opacity-20 ${theme.textMuted}`} />
      </div>
    )
  );

  // Mobile hamburger button
  const MobileMenuButton = () => (
    <button
      onClick={() => setIsOpen(true)}
      className={`md:hidden fixed top-4 left-4 z-40 p-3 rounded-xl ${theme.sidebar} ${theme.shadow} ${theme.text}
        transition-all duration-200 active:scale-95 touch-manipulation`}
      aria-label="Open menu"
    >
      <Menu size={24} />
    </button>
  );

  // Mobile bottom navigation
  const MobileBottomNav = () => (
    <div className={`md:hidden fixed bottom-0 left-0 right-0 z-30 ${theme.sidebar} border-t ${theme.border}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/' && location.pathname.startsWith(item.href));
          
          return (
            <NavLink
              key={item.name}
              to={item.href}
              preventScrollReset={true}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 
                touch-manipulation min-w-[64px]
                ${isActive ? theme.textActive : theme.textMuted}`}
            >
              <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                {item.name}
              </span>
            </NavLink>
          );
        })}
        <button
          onClick={() => setIsOpen(true)}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 
            touch-manipulation min-w-[64px] ${theme.textMuted}`}
        >
          <Menu size={22} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </div>
  );

  // Sidebar content
  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className={`p-5 flex items-center justify-between border-b ${theme.border} flex-shrink-0`}>
        {(!isCollapsed || isMobile) && (
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${theme.accent} flex items-center justify-center shadow-lg flex-shrink-0`}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className={`text-lg font-bold ${theme.textActive} truncate`}>Admin</h1>
              <p className={`text-xs ${theme.textMuted} truncate`}>Control Panel</p>
            </div>
          </div>
        )}
        {isCollapsed && !isMobile && (
          <div className={`w-10 h-10 rounded-xl ${theme.accent} flex items-center justify-center mx-auto shadow-lg`}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        )}
        
        {isMobile ? (
          <button
            onClick={() => setIsOpen(false)}
            className={`p-2 ${theme.text} ${theme.hover} rounded-lg transition-all duration-200 touch-manipulation flex-shrink-0`}
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        ) : (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-2 ${theme.text} ${theme.hover} rounded-lg transition-all duration-200 hover:scale-110 flex-shrink-0`}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        )}
      </div>

      {/* Theme Picker */}
      {(!isCollapsed || isMobile) && (
        <div className="px-5 py-3 flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowThemePicker(!showThemePicker)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${theme.cardBg} ${theme.text} 
                ${theme.hover} transition-all duration-200 touch-manipulation`}
            >
              <Palette size={18} className="flex-shrink-0" />
              <span className="flex-1 text-left text-sm font-medium truncate">Theme: {theme.name}</span>
              <ChevronDown size={16} className={`transition-transform flex-shrink-0 ${showThemePicker ? 'rotate-180' : ''}`} />
            </button>
            
            {showThemePicker && (
              <div className={`absolute top-full left-0 right-0 mt-2 p-3 ${theme.cardBg} backdrop-blur-xl 
                rounded-xl border ${theme.border} ${theme.shadow} z-[100]`}
              >
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(themes) as ThemeKey[]).map((themeKey) => (
                    <button
                      key={themeKey}
                      onClick={() => changeTheme(themeKey)}
                      className={`p-3 rounded-xl transition-all duration-200 touch-manipulation
                        ${currentTheme === themeKey ? `ring-2 ring-white/50 ${themes[themeKey].accent}` : theme.hover}`}
                    >
                      <div className={`w-full h-8 rounded-lg ${themes[themeKey].sidebar} mb-2`} />
                      <span className={`text-xs font-medium ${theme.text}`}>{themes[themeKey].name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation - FIXED: Added ref and scroll behavior */}
      <nav 
        ref={navRef}
        className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar overscroll-contain"
        style={{ scrollBehavior: 'auto' }}
      >
        {navigation.map((item) => renderNavItem(item))}

        {renderSubMenu(
          'Locations',
          MapPin,
          locationSubMenu,
          isLocationMenuExpanded,
          setIsLocationMenuExpanded,
          isLocationRoute
        )}

        <SectionDivider icon={Sparkles} label="Server-Driven UI" />

        {renderSubMenu(
          'SDUI Manager',
          Smartphone,
          sduiMenuItems,
          isSDUIMenuExpanded,
          setIsSDUIMenuExpanded,
          isSDUIRoute
        )}

        <SectionDivider icon={ShoppingCart} label="Checkout" />

        {renderSubMenu(
          'Checkout',
          ShoppingCart,
          checkoutMenuItems,
          isCheckoutMenuExpanded,
          setIsCheckoutMenuExpanded,
          isCheckoutRoute
        )}

        <SectionDivider icon={Settings} label="System" />
        {otherNavigation.map((item) => renderNavItem(item))}
      </nav>

      {/* Admin Info & Logout */}
      <div className={`p-4 border-t ${theme.border} flex-shrink-0 ${isMobile ? 'pb-6' : ''}`}>
        {(!isCollapsed || isMobile) ? (
          <div className="space-y-3">
            <div className={`flex items-center gap-3 p-3 ${theme.cardBg} rounded-xl`}>
              <div className={`h-11 w-11 rounded-xl ${theme.accent} flex items-center justify-center text-white 
                font-bold shadow-lg flex-shrink-0`}
              >
                {admin?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${theme.textActive} truncate`}>{admin?.name}</p>
                <p className={`text-xs ${theme.textMuted} truncate`}>{admin?.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className={`flex items-center justify-center gap-2 w-full py-3.5 ${theme.cardBg} ${theme.text} 
                ${theme.hover} rounded-xl transition-all duration-200 font-medium hover:text-red-400 
                touch-manipulation active:scale-[0.98]`}
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className={`h-11 w-11 rounded-xl ${theme.accent} flex items-center justify-center text-white 
              font-bold group relative shadow-lg`}
            >
              {admin?.name?.charAt(0).toUpperCase() || 'A'}
              <div className={`absolute left-full ml-3 px-4 py-3 ${theme.cardBg} backdrop-blur-xl text-sm 
                rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all 
                duration-200 whitespace-nowrap z-[100] border ${theme.border} ${theme.shadow}`}
              >
                <p className={`font-bold ${theme.textActive}`}>{admin?.name}</p>
                <p className={theme.textMuted}>{admin?.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className={`p-2.5 ${theme.text} hover:text-red-400 ${theme.hover} rounded-xl transition-all 
                duration-200 group relative hover:scale-110`}
            >
              <LogOut size={18} />
              <div className={`absolute left-full ml-3 px-4 py-2.5 ${theme.cardBg} backdrop-blur-xl text-sm 
                rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all 
                duration-200 whitespace-nowrap z-[100] border ${theme.border} ${theme.shadow}`}
              >
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
      {/* Mobile Menu Button */}
      {isMobile && !isOpen && <MobileMenuButton />}

      {/* Mobile Overlay */}
      {isMobile && (
        <div
          className={`fixed inset-0 z-40 transition-all duration-300 ${
            isOpen ? `${theme.overlay} opacity-100` : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        {...(isMobile ? swipeHandlers : {})}
        className={`
          ${isMobile 
            ? `fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[320px] transform transition-transform duration-300 ease-out
               ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
            : `${isCollapsed ? 'w-20' : 'w-72'} relative transition-all duration-300`
          }
          ${theme.sidebar} min-h-screen flex flex-col ${theme.shadow}
        `}
      >
        <SidebarContent />
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav />}

      {/* Spacer for mobile bottom nav */}
      {isMobile && <div className="h-20 flex-shrink-0" />}

      {/* Custom Styles */}
      <style>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        .touch-manipulation {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        
        @media (max-width: 767px) {
          .custom-scrollbar {
            -webkit-overflow-scrolling: touch;
          }
        }
        
        /* Prevent focus scroll */
        [data-focus-guard] {
          position: fixed;
        }
      `}</style>
    </>
  );
}