import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const data = [
  { name: 'Cleaning', value: 420 },
  { name: 'Plumbing', value: 280 },
  { name: 'Others', value: 300 },
];

const COLORS = ['#ec5b13', '#6366f1', '#fbbf24'];

export function CategoryChart() {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full">
      <h3 className="font-bold text-lg mb-1">Booking Distribution</h3>
      <p className="text-xs text-slate-500 mb-6">Category-wise volume breakdown</p>
      <div className="flex-1 flex items-center justify-center relative min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-3xl font-bold">1,000</p>
          <p className="text-[10px] text-slate-500 uppercase font-bold">Total</p>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index] }}></span> 
              <span className="font-medium text-slate-700">{item.name}</span>
            </span>
            <span className="font-bold text-slate-900">{Math.round((item.value / 1000) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
