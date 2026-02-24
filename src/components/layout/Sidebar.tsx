import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Wrench, 
  Tag, 
  CreditCard, 
  Layers, 
  BarChart3,
  LogOut,
  Sparkles,
  ShieldCheck,
  UserCircle,
  Settings
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/StoreContext';

const adminNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Users, label: 'Users', path: '/users' },
  { icon: Wrench, label: 'Service Providers', path: '/providers' },
  { icon: Tag, label: 'Price Management', path: '/pricing' },
  { icon: ShieldCheck, label: 'Price Approvals', path: '/approvals' },
  { icon: CreditCard, label: 'Payment Transactions', path: '/transactions' },
  { icon: Layers, label: 'Categories', path: '/categories' },
  { icon: BarChart3, label: 'Revenue Analytics', path: '/analytics' },
];

const providerNavItems = [
  { icon: LayoutDashboard, label: 'Provider Dashboard', path: '/' },
  { icon: Tag, label: 'My Pricing', path: '/provider/pricing' },
  { icon: CreditCard, label: 'My Earnings', path: '/transactions' },
  { icon: Settings, label: 'Settings', path: '/providers' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { viewMode, setViewMode } = useStore();

  const navItems = viewMode === 'admin' ? adminNavItems : providerNavItems;

  return (
    <aside className="hidden md:flex flex-col w-72 bg-card-bg border-r border-border-base shrink-0 transition-colors duration-300">
      <div className="p-8 flex items-center gap-3">
        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
          <Wrench size={28} />
        </div>
        <div>
          <span className="text-2xl font-black tracking-tighter text-text-primary block leading-none">SERVI</span>
          <span className="text-[10px] font-bold tracking-[0.2em] text-text-secondary uppercase">Enterprise</span>
        </div>
      </div>
      
      <nav className="flex-1 px-6 py-4 space-y-2 overflow-y-auto hide-scrollbar">
        <div className="flex items-center justify-between mb-4 px-4">
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Main Menu</p>
          <button 
            onClick={() => setViewMode(viewMode === 'admin' ? 'provider' : 'admin')}
            className="flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
          >
            {viewMode === 'admin' ? <UserCircle size={12} /> : <ShieldCheck size={12} />}
            Switch to {viewMode === 'admin' ? 'Provider' : 'Admin'}
          </button>
        </div>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm",
                isActive 
                  ? "bg-primary text-white shadow-md shadow-primary/20" 
                  : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-6 space-y-4">
        <div className="p-4 rounded-2xl bg-bg-secondary border border-border-base relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-bold text-text-secondary mb-1 uppercase tracking-widest">PRO PLAN</p>
            <p className="text-sm font-bold mb-3 text-text-primary">Get advanced AI insights</p>
            <button className="w-full py-2 bg-text-primary text-card-bg rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">
              Upgrade Now
            </button>
          </div>
          <Sparkles className="absolute -right-2 -bottom-2 text-primary/10" size={64} />
        </div>
        
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-900/10 transition-all">
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
