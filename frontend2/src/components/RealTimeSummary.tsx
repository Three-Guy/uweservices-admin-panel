import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Circle, User, Clock } from 'lucide-react';

const activities = [
  { id: 1, user: 'Amit K.', action: 'booked', service: 'AC Repair', time: '2 mins ago', status: 'new' },
  { id: 2, user: 'Suresh M.', action: 'completed', service: 'Sofa Cleaning', time: '5 mins ago', status: 'done' },
  { id: 3, user: 'Priya S.', action: 'cancelled', service: 'Plumbing', time: '12 mins ago', status: 'cancelled' },
  { id: 4, user: 'Vikram R.', action: 'joined', service: 'Provider', time: '15 mins ago', status: 'new' },
];

export function RealTimeSummary() {
  const [items, setItems] = React.useState(activities);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setItems(prev => {
        const newItems = [...prev];
        const first = newItems.shift();
        if (first) newItems.push({ ...first, id: Math.random() });
        return newItems;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Live Activity
        </h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider animate-pulse">Syncing...</span>
      </div>
      
      <div className="space-y-4 flex-1">
        <AnimatePresence mode="popLayout">
          {items.map((activity) => (
            <motion.div 
              key={activity.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-white transition-colors">
                <User size={14} className="text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  <span className="font-bold">{activity.user}</span> {activity.action} <span className="text-primary font-bold">{activity.service}</span>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock size={10} className="text-slate-400" />
                  <span className="text-[10px] text-slate-400 font-medium">{activity.time}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      <button className="w-full mt-6 py-3 text-xs font-bold text-slate-500 hover:text-primary transition-colors border-t border-slate-50">
        View All Activity
      </button>
    </div>
  );
}
