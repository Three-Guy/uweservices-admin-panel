import React, { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  trend?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function KPICard({ title, value, icon, trend, variant = 'default' }: KPICardProps) {
  const bgColors = {
    default: 'bg-white',
    success: 'bg-green-50',
    warning: 'bg-yellow-50',
    danger: 'bg-red-50',
  };

  return (
    <div className={`${bgColors[variant]} rounded-lg shadow p-6`}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-gray-100">{icon}</div>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 text-sm ${
              trend >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{title}</p>
    </div>
  );
}
