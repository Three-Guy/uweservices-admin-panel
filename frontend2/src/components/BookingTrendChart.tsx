import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const data = [
  { name: 'Mon', bookings: 120 },
  { name: 'Tue', bookings: 150 },
  { name: 'Wed', bookings: 180 },
  { name: 'Thu', bookings: 140 },
  { name: 'Fri', bookings: 210 },
  { name: 'Sat', bookings: 250 },
  { name: 'Sun', bookings: 230 },
];

export function BookingTrendChart() {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-lg">Booking Trend</h3>
          <p className="text-xs text-slate-500">Daily volume of ce requests</p>
        </div>
        <div className="flex bg-slate-50 p-1 rounded-lg">
          <button className="px-3 py-1 text-[10px] font-bold bg-white rounded-md shadow-sm">Daily</button>
          <button className="px-3 py-1 text-[10px] font-medium text-slate-500">Weekly</button>
        </div>
      </div>
      <div className="h-64 w-full chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
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
            />
            <Line 
              type="monotone" 
              dataKey="bookings" 
              stroke="#6366f1" 
              strokeWidth={3}
              dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
