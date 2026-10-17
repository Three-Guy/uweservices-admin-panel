import React from 'react';
import { useStore } from '../../store/StoreContext';
import { CategoryGrid } from '../CategoryGrid';
import { cn } from '../../lib/utils';

export default function CategoriesModule() {
  return (
    <div className="p-8 space-y-12 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-text-primary">Service Categories</h1>
          <p className="text-text-secondary mt-1 font-medium">Performance metrics and operational health across all service verticals.</p>
        </div>
      </div>

      <CategoryGrid />
    </div>
  );
}
