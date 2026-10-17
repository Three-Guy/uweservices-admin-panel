import React from 'react';
import { 
  LayoutDashboard, 
  Wrench, 
  Tag, 
  BarChart3, 
  Menu 
} from 'lucide-react';
import { cn } from '../lib/utils';

const mobileNavItems = [
  { icon: LayoutDashboard, label: 'Dash', active: true },
  { icon: Wrench, label: 'Prov' },
  { icon: Tag, label: 'Price' },
  { icon: BarChart3, label: 'Stats' },
  { icon: Menu, label: 'More' },
];

export function MobileNav() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card-bg border-t border-border-base flex items-center justify-around py-3 px-4 z-50">
      {mobileNavItems.map((item) => (
        <a 
          key={item.label}
          href="#" 
          className={cn(
            "flex flex-col items-center gap-1",
            item.active ? "text-primary" : "text-text-secondary"
          )}
        >
          <item.icon size={20} />
          <span className="text-[10px] font-bold">{item.label}</span>
        </a>
      ))}
    </div>
  );
}
