import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { analyticsApi } from '../services/api';
import { 
  FileText, 
  Download, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag,
  ArrowRight,
  Filter,
  CreditCard,
  PieChart as PieChartIcon
} from 'lucide-react';
import AnalyticsVisuals from './AnalyticsVisuals';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function Reports({ user }) {
  const today = new Date().toISOString().split('T')[0];
  const [dates, setDates] = useState({ start: today, end: today });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' or 'visuals'

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await analyticsApi.getReports({
        outlet_id: user?.outlet_id || 1,
        start_date: dates.start,
        end_date: dates.end
      });
      setData(res.data?.data || res.data);
    } catch (err) {
      console.error("Failed to fetch reports", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const url = analyticsApi.getExportUrl({
      outlet_id: user?.outlet_id || 1,
      start_date: dates.start,
      end_date: dates.end
    });
    window.open(url, '_blank');
  };

  return (
    <div className="flex-1 p-8 h-screen overflow-hidden flex flex-col text-atul-charcoal">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-serif text-3xl font-bold">Reporting & Insights</h2>
          <div className="flex gap-6 mt-2">
            <button 
              onClick={() => setActiveTab('summary')}
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em] pb-1 border-b-2 transition-all",
                activeTab === 'summary' ? "text-atul-pink_primary border-atul-pink_primary" : "text-atul-gray/40 border-transparent hover:text-atul-charcoal"
              )}
            >Financial Summary</button>
            <button 
              onClick={() => setActiveTab('visuals')}
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em] pb-1 border-b-2 transition-all",
                activeTab === 'visuals' ? "text-atul-pink_primary border-atul-pink_primary" : "text-atul-gray/40 border-transparent hover:text-atul-charcoal"
              )}
            >Visual Insights</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center bg-white/50 backdrop-blur-md rounded-2xl px-4 py-2 border border-atul-pink_primary/10 gap-3">
              <Calendar size={18} className="text-atul-pink_primary"/>
              <input 
                type="date" 
                value={dates.start} 
                onChange={e => setDates({...dates, start: e.target.value})}
                className="bg-transparent text-sm font-bold outline-none"
              />
              <ArrowRight size={14} className="text-atul-pink_primary/40"/>
              <input 
                type="date" 
                value={dates.end} 
                onChange={e => setDates({...dates, end: e.target.value})}
                className="bg-transparent text-sm font-bold outline-none"
              />
              <button 
                onClick={fetchReports}
                className="ml-2 bg-atul-pink_primary text-white p-2 rounded-xl hover:scale-105 active:scale-95 transition-all"
              >
                <Filter size={16}/>
              </button>
           </div>
           <button 
             onClick={handleExport}
             className="flex items-center gap-2 bg-atul-charcoal text-white px-6 py-3 rounded-2xl font-bold hover:bg-black transition-all"
           >
             <Download size={18}/> Export CSV
           </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center font-serif text-atul-pink_primary/20 animate-pulse text-2xl">
          Crunching the numbers...
        </div>
      ) : activeTab === 'visuals' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
           <AnalyticsVisuals user={user} />
        </div>
      ) : data ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pb-10">
           
           {/* Summary Cards */}
           <div className="grid grid-cols-4 gap-6">
              {[
                { label: "Net Revenue", value: `₹${Number(data.summary.total_sales || 0).toLocaleString()}`, icon: <DollarSign/>, color: "bg-emerald-500" },
                { label: "Total Orders", value: data.summary.total_orders, icon: <ShoppingBag/>, color: "bg-blue-500" },
                { label: "Tax Collected", value: `₹${Number(data.summary.total_tax || 0).toLocaleString()}`, icon: <FileText/>, color: "bg-purple-500" },
                { label: "Avg Ticket Size", value: `₹${Number(data.summary.avg_order || 0).toFixed(0)}`, icon: <TrendingUp/>, color: "bg-amber-500" },
              ].map((s, i) => (
                <div key={i} className="glass p-6 rounded-[2rem]">
                  <div className={cn("size-12 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg", s.color)}>
                    {s.icon}
                  </div>
                  <p className="text-[10px] font-bold text-atul-pink_primary/40 uppercase tracking-widest">{s.label}</p>
                  <p className="text-2xl font-bold professional-digits mt-1">{s.value}</p>
                </div>
              ))}
           </div>

           <div className="grid grid-cols-3 gap-8">
              {/* Payment Split */}
              <div className="col-span-1 glass rounded-[2.5rem] p-8">
                 <h4 className="font-serif text-xl font-bold mb-6">Payment Matrix</h4>
                 <div className="space-y-4">
                    {data.payments.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/40 rounded-2xl border border-white">
                         <div className="flex items-center gap-3">
                            <CreditCard size={18} className="text-atul-pink_primary/40"/>
                            <span className="font-bold text-sm uppercase tracking-wide">{p.payment_mode}</span>
                         </div>
                         <div className="text-right">
                            <p className="font-bold">₹{Number(p.total).toLocaleString()}</p>
                            <p className="text-[10px] font-bold opacity-40 uppercase">{p.count} Orders</p>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

              {/* Product Performance */}
              <div className="col-span-2 glass rounded-[2.5rem] p-8">
                 <h4 className="font-serif text-xl font-bold mb-6">Top Sellers</h4>
                 <div className="overflow-hidden">
                    <table className="w-full">
                       <thead className="text-[10px] uppercase font-bold text-atul-pink_primary/40 text-left">
                          <tr>
                             <th className="pb-4">Product</th>
                             <th className="pb-4 text-center">Volume</th>
                             <th className="pb-4 text-right">Revenue</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-atul-pink_primary/5">
                          {data.performance.map((item, i) => (
                            <tr key={i} className="group">
                               <td className="py-4 font-bold text-sm">{item.product__name}</td>
                               <td className="py-4 text-center">
                                  <span className="bg-atul-pink_soft text-atul-pink_primary px-3 py-1 rounded-full text-xs font-bold">
                                    {item.qty} units
                                  </span>
                               </td>
                               <td className="py-4 text-right font-bold professional-digits text-atul-pink_primary">
                                  ₹{Number(item.total).toLocaleString()}
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>

            {/* Wastage & Losses */}
            <div className="col-span-3 glass rounded-[2.5rem] p-8 border-red-500/10">
               <h4 className="font-serif text-xl font-bold mb-6 flex items-center justify-between">
                  Wastage & Losses
                  <span className="text-[10px] font-bold text-red-500/60 uppercase bg-red-50 px-3 py-1 rounded-full border border-red-100 italic">Inventory Shrinkage</span>
               </h4>
               {data.wastage.length === 0 ? (
                 <div className="text-center py-10 opacity-20">
                    <p className="font-serif text-xl font-bold italic">No wastage recorded in this period</p>
                    <p className="text-xs font-bold uppercase mt-2 tracking-widest">Inventory Integrity: 100%</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-5 gap-4">
                    {data.wastage.map((w, i) => (
                      <div key={i} className="p-4 bg-white/40 rounded-2xl border border-white relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-1 bg-red-50 text-[8px] font-bold text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">LOSS</div>
                         <p className="font-bold text-xs truncate mb-1">{w.stock_item__product__name}</p>
                         <p className="text-xl font-bold text-red-400 professional-digits">-{w.total_qty}</p>
                         <p className="text-[9px] font-bold uppercase tracking-widest opacity-30 mt-1">{w.count} Events</p>
                      </div>
                    ))}
                 </div>
               )}
            </div>
         </div>

        </div>
      ) : null}
    </div>
  );
}
