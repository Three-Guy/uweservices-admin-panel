import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  Moon, 
  Sun,
  Menu,
  X,
  Check
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store/StoreContext';
import { motion, AnimatePresence } from 'motion/react';

export function Header() {
  const { isDark, setIsDark, notifications, markNotificationsRead } = useStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className={cn(
      "h-20 flex items-center justify-between px-8 backdrop-blur-md border-b sticky top-0 z-40 transition-all duration-300",
      "bg-card-bg/80 border-border-base"
    )}>
      <div className="flex items-center gap-6 flex-1">
        <button className="md:hidden text-text-secondary">
          <Menu size={24} />
        </button>
        <div className="relative max-w-md w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary transition-colors" size={18} />
          <input 
            className={cn(
              "w-full border rounded-2xl py-2.5 pl-12 pr-4 focus:ring-4 focus:ring-primary/10 transition-all text-sm outline-none",
              "bg-bg-secondary border-border-base text-text-primary focus:bg-card-bg focus:border-primary/20"
            )}
            placeholder="Search bookings, providers, or analytics..." 
            type="text"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-1 mr-4">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">System Online</span>
        </div>
        
        <button 
          onClick={() => setIsDark(!isDark)}
          className={cn(
            "p-2.5 rounded-xl transition-colors",
            "text-text-secondary hover:bg-bg-secondary"
          )}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="relative">
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) markNotificationsRead();
            }}
            className={cn(
              "p-2.5 rounded-xl relative transition-colors",
              "text-text-secondary hover:bg-bg-secondary"
            )}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-card-bg">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={cn(
                    "absolute right-0 mt-4 w-80 rounded-2xl border shadow-2xl z-50 overflow-hidden",
                    "bg-card-bg border-border-base"
                  )}
                >
                  <div className="p-4 border-b border-border-base flex items-center justify-between">
                    <h4 className="font-bold text-sm text-text-primary">Notifications</h4>
                    <button onClick={() => setShowNotifications(false)} className="text-text-secondary hover:text-text-primary"><X size={16} /></button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-text-secondary text-xs">No new notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="p-4 border-b border-border-base last:border-0 hover:bg-bg-secondary transition-colors">
                          <p className="text-xs font-bold mb-1 text-text-primary">{n.title}</p>
                          <p className="text-xs text-text-secondary leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-text-secondary mt-2 font-medium">{n.time}</p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        
        <div className={cn("h-8 w-[1px] mx-2", "bg-border-base")}></div>
        
        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className={cn("text-sm font-bold", "text-text-primary")}>Rajesh Kumar</p>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Administrator</p>
          </div>
          <div className={cn("w-10 h-10 rounded-xl border overflow-hidden shadow-sm", "bg-bg-secondary border-border-base")}>
            <img 
              src="https://picsum.photos/seed/admin/100/100" 
              alt="Avatar" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
