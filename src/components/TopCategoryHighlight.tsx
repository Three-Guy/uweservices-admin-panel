import React from 'react';
import { Sparkles, Trophy } from 'lucide-react';

export function TopCategoryHighlight() {
  return (
    <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Trophy size={120} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={18} className="text-indigo-200" />
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-100">Top Performer</span>
        </div>
        <h3 className="text-2xl font-bold mb-1">Home Cleaning</h3>
        <p className="text-indigo-100 text-sm mb-4">42% of total revenue this month</p>
        
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] uppercase font-bold text-indigo-200">Growth</p>
            <p className="text-lg font-bold">+24.5%</p>
          </div>
          <div className="w-[1px] h-8 bg-indigo-500"></div>
          <div>
            <p className="text-[10px] uppercase font-bold text-indigo-200">Bookings</p>
            <p className="text-lg font-bold">4,205</p>
          </div>
        </div>
      </div>
    </div>
  );
}
