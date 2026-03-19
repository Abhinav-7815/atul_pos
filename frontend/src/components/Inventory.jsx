import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { inventoryApi } from '../services/api';
import { 
  Package, 
  Search, 
  Plus, 
  Minus, 
  AlertTriangle, 
  ChevronRight, 
  RefreshCcw, 
  ClipboardList,
  ChevronDown,
  X,
  PlusCircle,
  Truck
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const MaterialIcon = ({ name, className = "" }) => (
  <span className={`material-symbols-outlined ${className}`} style={{ fontSize: 'inherit' }}>
    {name}
  </span>
);

export default function Inventory({ user }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState('purchase');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [batchEntries, setBatchEntries] = useState([]); // [{product_id, name, variant_id, variant_name, quantity}]

  useEffect(() => {
    fetchStocks();
  }, [user, search]);

  const fetchStocks = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getStocks({ 
        outlet_id: user?.outlet_id,
        q: search 
      });
      const stockData = res.data?.data || res.data?.results || res.data;
      setStocks(Array.isArray(stockData) ? stockData : []);
    } catch (err) {
      console.error("Failed to fetch stocks", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchAdjust = async () => {
    try {
      const entries = batchEntries.map(e => ({
        product_id: e.product_id,
        variant_id: e.variant_id,
        quantity: e.quantity,
        type: adjustmentType,
        notes: adjustNotes
      }));
      
      await inventoryApi.batchAdjust({
        outlet_id: user.outlet_id,
        entries
      });
      
      setIsAdjustModalOpen(false);
      setBatchEntries([]);
      setAdjustNotes('');
      fetchStocks();
    } catch (err) {
      alert("Adjustment failed");
    }
  };

  return (
    <div className="flex-1 p-8 h-screen overflow-hidden flex flex-col text-atul-charcoal">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-serif text-3xl font-bold">Inventory Management</h2>
          <p className="text-atul-pink_primary/60 text-sm mt-1">Track and manage stock levels for {user?.outlet_name || 'Vastrapur Outlet'}</p>
        </div>
        <div className="flex gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-atul-pink_primary/40 group-focus-within:text-atul-pink_primary transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white/50 backdrop-blur-md border border-atul-pink_primary/10 rounded-3xl w-64 focus:ring-2 focus:ring-atul-pink_primary/20 transition-all outline-none"
            />
          </div>
          <button 
            onClick={() => {
                setAdjustmentType('purchase');
                setIsAdjustModalOpen(true);
            }}
            className="flex items-center gap-2 bg-atul-pink_primary text-white px-6 py-3 rounded-3xl font-bold shadow-lg shadow-atul-pink_primary/30 hover:scale-[1.02] transition-all"
          >
            <Plus size={18} />
            Add Stock
          </button>
        </div>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          { label: "Total Items", value: stocks.length, icon: <Package size={20}/>, color: "bg-blue-500" },
          { label: "Low Stock", value: stocks.filter(s => s.status === 'LOW_STOCK').length, icon: <AlertTriangle size={20}/>, color: "bg-amber-500" },
          { label: "Out of Stock", value: stocks.filter(s => s.status === 'OUT_OF_STOCK').length, icon: <X size={20}/>, color: "bg-red-500" },
          { label: "Last Refill", value: "2h ago", icon: <RefreshCcw size={20}/>, color: "bg-emerald-500" },
        ].map((s, i) => (
          <div key={i} className="glass p-6 rounded-[2rem] flex items-center gap-5">
            <div className={cn("size-12 rounded-2xl flex items-center justify-center text-white shadow-lg", s.color)}>
              {s.icon}
            </div>
            <div>
              <p className="text-[10px] font-bold text-atul-pink_primary/40 uppercase tracking-widest">{s.label}</p>
              <p className="text-2xl font-bold professional-digits">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="flex-1 glass rounded-[2.5rem] overflow-hidden flex flex-col mb-8">
        <div className="p-6 border-b border-atul-pink_primary/10 bg-white/30 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <ClipboardList className="text-atul-pink_primary" size={20}/>
              <h3 className="font-serif font-bold text-xl">Current Stock List</h3>
           </div>
           <button onClick={fetchStocks} className="text-atul-pink_primary hover:rotate-180 transition-transform duration-500">
             <RefreshCcw size={18} />
           </button>
        </div>
        
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full">
            <thead className="sticky top-0 bg-[#FFF5F8] text-[10px] uppercase font-bold text-atul-pink_primary/60 tracking-widest">
              <tr>
                <th className="px-8 py-4 text-left">Product Details</th>
                <th className="px-8 py-4 text-left">Variant</th>
                <th className="px-8 py-4 text-center">Current Qty</th>
                <th className="px-8 py-4 text-center">Threshold</th>
                <th className="px-8 py-4 text-center">Status</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock, i) => (
                <tr key={stock.id} className="border-b border-atul-pink_primary/5 hover:bg-atul-pink_primary/5 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                       <div className="size-10 bg-atul-pink_soft rounded-xl flex items-center justify-center text-atul-pink_primary font-bold">
                          {stock.product_name[0]}
                       </div>
                       <span className="font-bold text-[14px]">{stock.product_name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                     <span className="text-xs font-medium bg-gray-100 text-atul-charcoal/60 px-3 py-1 rounded-full">{stock.variant_name || 'Standard'}</span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="text-lg font-bold professional-digits">{Number(stock.quantity).toFixed(0)}</span>
                  </td>
                  <td className="px-8 py-5 text-center opacity-40 font-bold professional-digits text-xs">
                    {Number(stock.min_threshold).toFixed(0)}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase",
                      stock.status === 'NORMAL' && "bg-emerald-50 text-emerald-600",
                      stock.status === 'LOW_STOCK' && "bg-amber-50 text-amber-600",
                      stock.status === 'OUT_OF_STOCK' && "bg-red-50 text-red-600"
                    )}>{stock.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="text-atul-pink_primary hover:bg-atul-pink_primary/10 size-8 rounded-full inline-flex items-center justify-center transition-colors">
                       <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustment Modal (Simplified for now) */}
      <AnimatePresence>
        {isAdjustModalOpen && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-atul-charcoal/40 backdrop-blur-md">
             <motion.div 
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: 20, opacity: 0 }}
               className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden"
             >
                <div className="p-8 border-b border-atul-pink_primary/10 flex items-center justify-between bg-gradient-to-r from-atul-pink_soft/20 to-transparent">
                   <div className="flex items-center gap-4">
                      <div className="size-12 rounded-2xl bg-atul-pink_primary text-white flex items-center justify-center">
                         <Truck size={24}/>
                      </div>
                      <div>
                        <h3 className="font-serif text-2xl font-bold">Stock Entry</h3>
                        <p className="text-sm text-atul-pink_primary/60">Record new stock or adjustments</p>
                      </div>
                   </div>
                   <button onClick={() => setIsAdjustModalOpen(false)} className="size-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-atul-gray">
                      <X size={24}/>
                   </button>
                </div>

                <div className="p-8 space-y-6">
                   <div className="flex gap-4">
                      {['purchase', 'adjustment', 'waste'].map(t => (
                        <button 
                          key={t}
                          onClick={() => setAdjustmentType(t)}
                          className={cn(
                            "flex-1 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all",
                            adjustmentType === t ? "bg-atul-charcoal text-white shadow-xl shadow-atul-charcoal/20" : "bg-gray-100 text-atul-charcoal/40 hover:bg-gray-200"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                   </div>

                   <div className="bg-gray-50 p-6 rounded-[2rem] border border-dashed border-atul-pink_primary/20">
                      <p className="text-center text-sm text-atul-charcoal/40 font-medium italic">
                        Select products to adjust stock... (Table row integration pending)
                      </p>
                      <div className="mt-4 space-y-3">
                         {/* Manual entry for demo */}
                         <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-atul-pink_primary/5 shadow-sm">
                            <span className="flex-1 font-bold">Standard Vanilla Cup</span>
                            <div className="flex items-center gap-3">
                               <button className="size-8 rounded-full bg-gray-100 flex items-center justify-center"><Minus size={14}/></button>
                               <span className="w-12 text-center font-bold professional-digits">0</span>
                               <button className="size-8 rounded-full bg-atul-pink_primary text-white flex items-center justify-center"><Plus size={14}/></button>
                            </div>
                         </div>
                      </div>
                   </div>

                   <div>
                      <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-widest block mb-2">Notes</label>
                      <textarea 
                        value={adjustNotes}
                        onChange={(e) => setAdjustNotes(e.target.value)}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-atul-pink_primary/20 outline-none"
                        placeholder="Reference PO# or reason for adjustment..."
                        rows={3}
                      />
                   </div>
                </div>

                <div className="p-8 bg-gray-50 flex gap-4">
                   <button 
                     onClick={() => setIsAdjustModalOpen(false)}
                     className="flex-1 py-4 bg-white border border-atul-pink_primary/10 rounded-2xl font-bold hover:bg-gray-100 transition-colors"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={() => alert("Simulated batch update success")}
                     className="flex-[2] py-4 bg-atul-pink_primary text-white rounded-2xl font-bold shadow-xl shadow-atul-pink_primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest"
                   >
                     Submit Updates
                   </button>
                </div>
             </motion.div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}
