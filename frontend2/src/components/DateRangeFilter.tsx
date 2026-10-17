import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export function DateRangeFilter() {
  const [range, setRange] = useState('Last 30 Days');

  return (
    <div className="relative inline-block">
      <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
        <Calendar size={16} className="text-slate-400" />
        <span>{range}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>
    </div>
  );
}
