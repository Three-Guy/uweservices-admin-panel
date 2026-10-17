import React, { useState } from 'react';
import { useStore } from '../../store/StoreContext';
import { PricingControl } from '../PricingControl';
import { ServicePriceTable } from '../pricing/ServicePriceTable';
import { cn } from '../../lib/utils';
import { LayoutGrid, List } from 'lucide-react';

export default function PricingModule() {
  const [view, setView] = useState<'category' | 'table'>('category');

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-text-primary">Price Management</h1>
          <p className="text-text-secondary mt-1 font-medium">Configure base prices and enable AI-driven dynamic adjustments.</p>
        </div>

        <div className="flex bg-bg-secondary p-1 rounded-xl border border-border-base self-start">
          <button
            onClick={() => setView('category')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
              view === 'category' ? "bg-card-bg text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
            )}
          >
            <LayoutGrid size={18} />
            Category View
          </button>
          <button
            onClick={() => setView('table')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
              view === 'table' ? "bg-card-bg text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
            )}
          >
            <List size={18} />
            Table View
          </button>
        </div>
      </div>

      {view === 'category' ? <PricingControl /> : <ServicePriceTable />}
    </div>
  );
}
