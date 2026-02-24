import React from 'react';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface KPICardProps {
  label: string;
  value: string;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral' | 'warning';
  subtext?: string;
  isPulse?: boolean;
}

export function KPICard({ label, value, trend, trendType, subtext, isPulse }: KPICardProps) {
  return (
    <div className="bg-card-bg p-5 rounded-2xl border border-border-base shadow-sm transition-all duration-300">
      <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">{label}</p>
      <div className="flex items-end justify-between mt-3">
        <h3 className={cn("text-2xl font-black truncate text-text-primary")}>
          {value}
        </h3>
        {trend && (
          <span className={cn(
            "text-[10px] font-bold flex items-center gap-0.5",
            trendType === 'up' ? "text-green-500" : "text-text-secondary"
          )}>
            {trend} {trendType === 'up' && <TrendingUp size={10} />}
          </span>
        )}
        {isPulse && (
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse mb-2 shadow-[0_0_8px_rgba(236,91,19,0.5)]"></span>
        )}
        {trendType === 'warning' && (
          <AlertCircle size={14} className="text-red-500 mb-2" />
        )}
        {subtext && !trend && (
          <span className="text-[10px] text-text-secondary font-medium">{subtext}</span>
        )}
      </div>
    </div>
  );
}
