import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyticsApi } from '../services/api';
import { 
  Zap, TrendingUp, BarChart3, 
  Clock, Hash, Activity 
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function AnalyticsVisuals({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchData();
  }, [days]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await analyticsApi.getAdvancedAnalytics({ 
        outlet_id: user?.outlet,
        days: days 
      });
      setData(res.data);
    } catch (err) {
      console.error("Advanced analytics failed", err);
    } finally {
      setLoading(false);
    }
  };

  const getDayName = (dayNum) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    // Django ExtractWeekDay returns 1 (Sun) to 7 (Sat)
    return days[dayNum - 1];
  };

  const hours = Array.from({ length: 15 }, (_, i) => i + 9); // 9 AM to 11 PM

  if (loading) return <div className="p-12 font-serif italic text-atul-pink_primary animate-pulse">Scanning patterns...</div>;

  return (
    <div className="space-y-10 pb-20">
      {/* Visual Header Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="col-span-1 bg-atul-charcoal text-white rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 opacity-10 rotate-12">
            <TrendingUp size={200} />
          </div>
          <h3 className="text-2xl font-black font-serif italic mb-2 relative z-10">Sales Velocity</h3>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-8 relative z-10">Top Moving Items (Daily Avg)</p>
          
          <div className="space-y-4 relative z-10">
            {data?.top_velocity?.slice(0, 5).map((v, i) => (
              <div key={i} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10">
                <span className="text-xs font-bold truncate max-w-[150px]">{v.product__name}</span>
                <span className="text-sm font-black text-atul-pink_soft">{v.daily_qty} / day</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 bg-white/60 backdrop-blur-xl border-2 border-white rounded-[3rem] p-10">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black text-atul-charcoal font-serif italic">Inventory Absorption</h3>
            <span className="text-[10px] font-black text-atul-pink_primary bg-atul-pink_soft/20 px-4 py-1.5 rounded-full uppercase">Category Load</span>
          </div>
          
          <div className="flex items-end gap-4 h-64 px-4 overflow-x-auto custom-scrollbar pb-10">
            {data?.category_performance?.map((cat, i) => (
              <div key={i} className="flex-1 min-w-[80px] flex flex-col items-center gap-4 group">
                <div className="w-full relative px-2">
                   <motion.div 
                     initial={{ height: 0 }}
                     animate={{ height: `${(cat.total_revenue / (data.category_performance[0].total_revenue || 1)) * 100}%` }}
                     className="w-full bg-gradient-to-t from-atul-pink_primary to-atul-pink_soft rounded-t-2xl relative group-hover:shadow-lg transition-all"
                   />
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-black text-atul-charcoal truncate w-20">{cat.product__category__name}</p>
                  <p className="text-[9px] font-bold text-atul-gray/40">₹{Math.round(cat.total_revenue / 1000)}k</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap Section */}
      <div className="bg-white/80 backdrop-blur-xl border-2 border-white rounded-[4rem] p-12">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h3 className="text-3xl font-black text-atul-charcoal font-serif italic mb-2">Peak Hour Density</h3>
            <p className="text-atul-pink_primary text-[10px] font-black uppercase tracking-[0.4em]">Heatmap of order volume by time of day</p>
          </div>
          <div className="flex gap-2">
            {[7, 30, 90].map(d => (
              <button 
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  "px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                  days === d ? "bg-atul-charcoal text-white" : "bg-atul-cream text-atul-charcoal/40 hover:bg-atul-pink_soft/20"
                )}
              >{d} Days</button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar pb-8">
          <div className="min-w-[800px]">
            {/* Grid Header */}
            <div className="flex mb-4">
              <div className="w-20" />
              <div className="flex-1 flex justify-between px-4 text-[10px] font-black text-atul-gray/30 uppercase tracking-[0.2em]">
                {hours.map(h => <span key={h}>{h > 12 ? h-12 : h} {h >= 12 ? 'PM' : 'AM'}</span>)}
              </div>
            </div>

            {/* Grid Body */}
            {[1, 2, 3, 4, 5, 6, 7].map(dow => (
              <div key={dow} className="flex items-center group mb-2">
                <div className="w-20 text-[11px] font-black text-atul-charcoal/40 uppercase tracking-widest">{getDayName(dow)}</div>
                <div className="flex-1 flex gap-2">
                  {hours.map(h => {
                    const cell = data?.heatmap?.find(d => d.weekday === dow && d.hour === h);
                    const opacity = cell ? Math.min(1, (cell.order_count / 10) + 0.1) : 0.05;
                    return (
                      <div 
                        key={h}
                        className="flex-1 aspect-square rounded-xl relative group/cell cursor-pointer"
                        style={{ backgroundColor: cell ? `rgba(214, 51, 132, ${opacity})` : '#FDF3F6' }}
                      >
                        {cell && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                             <span className="text-[10px] font-black text-white drop-shadow-sm">{cell.order_count}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-12 flex items-center justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-atul-gray/40">
           <div className="flex items-center gap-2">
              <div className="size-4 rounded-md bg-[#FDF3F6]" /> Low Traffic
           </div>
           <div className="flex items-center gap-2">
              <div className="size-4 rounded-md bg-atul-pink_primary/50" /> Moderate
           </div>
           <div className="flex items-center gap-2">
              <div className="size-4 rounded-md bg-atul-pink_primary" /> Peak Rush
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white/40 border-2 border-white p-10 rounded-[3rem]">
            <h4 className="font-serif italic font-black text-2xl text-atul-charcoal mb-8">Payment Velocity</h4>
            <div className="space-y-6">
                {Array.from(new Set(data?.payment_trends?.map(t => t.payment_mode))).map(mode => {
                  const items = data.payment_trends.filter(t => t.payment_mode === mode).slice(-7);
                  return (
                    <div key={mode} className="space-y-2">
                       <div className="flex justify-between items-center p-2">
                          <span className="text-xs font-black uppercase text-atul-charcoal/60">{mode} Intensity</span>
                          <span className="text-[11px] font-black text-atul-pink_primary">₹{items.reduce((acc, i) => acc + i.volume, 0).toLocaleString()} (7D)</span>
                       </div>
                       <div className="flex items-end gap-1 h-12 px-1">
                          {items.map((i, idx) => (
                            <div 
                              key={idx} 
                              className="flex-1 bg-atul-pink_soft/20 rounded-sm hover:bg-atul-pink_primary transition-colors"
                              style={{ height: `${(i.volume / Math.max(...items.map(m => m.volume))) * 100}%` }}
                            />
                          ))}
                       </div>
                    </div>
                  );
                })}
            </div>
         </div>

         <div className="bg-atul-cream/30 border-2 border-white p-10 rounded-[3rem] flex flex-col justify-center text-center">
            <div className="size-20 bg-white rounded-full flex items-center justify-center text-atul-pink_primary mx-auto mb-6 shadow-xl">
               <Activity size={32} />
            </div>
            <h4 className="font-serif italic font-black text-2xl text-atul-charcoal mb-4">Predictive Insight</h4>
            <p className="text-sm font-bold text-atul-gray/60 max-w-xs mx-auto mb-8">
              Based on the last {days} days, your peak demand occurs on <span className="text-atul-pink_primary font-black">{getDayName(data?.heatmap?.sort((a,b) => b.order_count - a.order_count)[0]?.weekday || 1)}s</span> between <span className="text-atul-pink_primary font-black">7 PM - 10 PM</span>.
            </p>
            <div className="bg-white/60 p-6 rounded-2xl border border-white">
               <p className="text-[10px] font-black uppercase text-atul-pink_primary/40 mb-2">Recommended Prep Load</p>
               <p className="text-xl font-black text-atul-charcoal">+15% Staff Capacity Recommended</p>
            </div>
         </div>
      </div>
    </div>
  );
}
