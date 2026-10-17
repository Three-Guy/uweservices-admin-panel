import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, ComposedChart, 
  Scatter, Legend, Cell as ReCell
} from 'recharts';
import { 
  ComposableMap, 
  Geographies, 
  Geography, 
  Marker,
  Sphere,
  Graticule
} from "react-simple-maps";
import { cn } from '../../lib/utils';

const COLORS = ['#ec5b13', '#6366f1', '#fbbf24', '#10b981', '#3b82f6', '#8b5cf6', '#f43f5e', '#0ea5e9', '#d946ef', '#f97316'];

// Custom Tooltip for charts
export const CustomTooltip = ({ active, payload, label, isDark }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={cn(
        "p-4 rounded-xl shadow-2xl border transition-colors duration-300",
        "bg-card-bg border-border-base text-text-primary"
      )}>
        <p className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-8 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-xs font-medium">{entry.name}:</span>
            </div>
            <span className="text-xs font-black">₹{entry.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// 1. Total Revenue Trend (Line Chart)
export const RevenueTrendChart = ({ data, isDark }: any) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data}>
      <defs>
        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#ec5b13" stopOpacity={0.3}/>
          <stop offset="95%" stopColor="#ec5b13" stopOpacity={0}/>
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-base)" />
      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 10}} dy={10} />
      <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 10}} tickFormatter={(v) => `₹${v/1000}k`} />
      <Tooltip content={<CustomTooltip isDark={isDark} />} />
      <Area type="monotone" dataKey="revenue" stroke="#ec5b13" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
    </AreaChart>
  </ResponsiveContainer>
);

// 2. Monthly Revenue Comparison (Clustered Column Chart)
export const MonthlyComparisonChart = ({ data, isDark }: any) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-base)" />
      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 10}} dy={10} />
      <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 10}} />
      <Tooltip content={<CustomTooltip isDark={isDark} />} />
      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '20px', color: 'var(--text-secondary)' }} />
      <Bar dataKey="current" name="Current Period" fill="#ec5b13" radius={[4, 4, 0, 0]} />
      <Bar dataKey="previous" name="Previous Period" fill="#94a3b8" radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

// 3. Category-wise Revenue (Bar Chart)
export const CategoryRevenueChart = ({ data, isDark, onDrillDown }: any) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} onClick={(e) => e && onDrillDown(e.activeLabel)}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-base)" />
      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 10}} dy={10} />
      <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 10}} />
      <Tooltip content={<CustomTooltip isDark={isDark} />} />
      <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} cursor="pointer" />
    </BarChart>
  </ResponsiveContainer>
);

// 5. Commission Breakdown (Stacked Bar Chart)
export const CommissionBreakdownChart = ({ data, isDark }: any) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} layout="vertical">
      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-base)" />
      <XAxis type="number" hide />
      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 10}} width={80} />
      <Tooltip content={<CustomTooltip isDark={isDark} />} />
      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-secondary)' }} />
      <Bar dataKey="provider" name="Provider Share" stackId="a" fill="#94a3b8" radius={[0, 0, 0, 0]} />
      <Bar dataKey="admin" name="Admin Commission" stackId="a" fill="#ec5b13" radius={[0, 4, 4, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

// 7. Interactive Map Chart (Simplified SVG Map)
export const GeoMapChart = ({ data, isDark, onSelectLocation }: any) => {
  // Mock India GeoJSON URL or simplified paths
  const geoUrl = "https://raw.githubusercontent.com/deldersveld/topojson/master/countries/india/india-states.json";

  return (
    <div className="w-full h-full relative">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 800,
          center: [82, 22]
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const d = data.find((s: any) => s.id === geo.id || s.name === geo.properties.ST_NM);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={() => onSelectLocation(geo.properties.ST_NM)}
                  style={{
                    default: {
                      fill: d ? `rgba(236, 91, 19, ${0.2 + (d.value / 1000000)})` : "var(--bg-secondary)",
                      outline: "none",
                      stroke: "var(--bg-primary)",
                      strokeWidth: 0.5
                    },
                    hover: {
                      fill: "#ec5b13",
                      outline: "none",
                      cursor: "pointer"
                    },
                    pressed: {
                      fill: "#c2410c",
                      outline: "none"
                    }
                  }}
                />
              );
            })
          }
        </Geographies>
        {data.map(({ name, coordinates, value }: any) => (
          <Marker key={name} coordinates={coordinates}>
            <circle r={Math.sqrt(value) / 100} fill="#ec5b13" stroke="#fff" strokeWidth={2} />
            <text
              textAnchor="middle"
              y={-10}
              style={{ fontFamily: "system-ui", fill: "var(--text-primary)", fontSize: 8, fontWeight: "bold" }}
            >
              {name}
            </text>
          </Marker>
        ))}
      </ComposableMap>
    </div>
  );
};

// 14. Cancellation Impact Analysis (Waterfall Chart Simulation)
export const WaterfallImpactChart = ({ data, isDark }: any) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-base)" />
      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 10}} />
      <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 10}} />
      <Tooltip content={<CustomTooltip isDark={isDark} />} />
      <Bar dataKey="value">
        {data.map((entry: any, index: number) => (
          <ReCell key={`cell-${index}`} fill={entry.value > 0 ? (entry.isTotal ? '#6366f1' : '#10b981') : '#f43f5e'} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

// 16. Revenue Forecast (AI Prediction)
export const RevenueForecastChart = ({ data, isDark }: any) => (
  <ResponsiveContainer width="100%" height="100%">
    <ComposedChart data={data}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-base)" />
      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 10}} />
      <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 10}} />
      <Tooltip content={<CustomTooltip isDark={isDark} />} />
      <Area type="monotone" dataKey="actual" fill="#ec5b13" fillOpacity={0.1} stroke="none" />
      <Line type="monotone" dataKey="actual" stroke="#ec5b13" strokeWidth={3} dot={{ r: 4, fill: '#ec5b13' }} />
      <Line type="monotone" dataKey="forecast" stroke="#ec5b13" strokeWidth={2} strokeDasharray="5 5" dot={false} />
    </ComposedChart>
  </ResponsiveContainer>
);
