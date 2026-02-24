import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const data = [
  { name: 'Mon', revenue: 4000, bookings: 2400 },
  { name: 'Tue', revenue: 3000, bookings: 1398 },
  { name: 'Wed', revenue: 2000, bookings: 9800 },
  { name: 'Thu', revenue: 2780, bookings: 3908 },
  { name: 'Fri', revenue: 1890, bookings: 4800 },
  { name: 'Sat', revenue: 2390, bookings: 3800 },
  { name: 'Sun', revenue: 3490, bookings: 4300 },
];

export function RevenueChart() {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-lg">Revenue Trend</h3>
          <p className="text-xs text-slate-500">Earnings across all service categories</p>
        </div>
        <div className="flex bg-slate-50 p-1 rounded-lg">
          <button className="px-3 py-1 text-[10px] font-bold bg-white rounded-md shadow-sm">Weekly</button>
          <button className="px-3 py-1 text-[10px] font-medium text-slate-500">Monthly</button>
        </div>
      </div>
      <div className="h-64 w-full chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ec5b13" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ec5b13" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#94a3b8', fontSize: 10}}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#94a3b8', fontSize: 10}}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
            />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="#ec5b13" 
              fillOpacity={1} 
              fill="url(#colorRevenue)" 
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
