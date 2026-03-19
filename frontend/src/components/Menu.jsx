import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Filter, 
  MoreVertical, Edit3, Trash2, 
  CheckCircle2, XCircle, ChevronRight,
  Eye, EyeOff, Tag, Layout
} from 'lucide-react';
import { menuApi } from '../services/api';
import { cn } from '../lib/utils';

export default function Menu({ user }) {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await menuApi.getCategories();
      const catData = res.data?.data || res.data;
      if (Array.isArray(catData)) {
        setCategories(catData);
        if (catData.length > 0) setActiveCategory(catData[0]);
      } else {
        setCategories([]);
      }
    } catch (err) {
      console.error("Failed to fetch menu", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentProducts = activeCategory?.products?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (loading) return <div className="p-12 font-serif italic text-atul-pink_primary">Opening Catalog...</div>;

  return (
    <div className="h-screen flex flex-col bg-[#FDF3F6]/30 overflow-hidden">
      <header className="px-10 py-8 flex justify-between items-center bg-white/40 backdrop-blur-xl border-b border-white/50">
        <div>
          <h1 className="text-3xl font-black text-atul-charcoal tracking-tight font-serif uppercase italic">Menu Catalog</h1>
          <p className="text-atul-pink_primary text-[10px] font-black uppercase tracking-[0.4em] mt-1">Global Product Master</p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-white/60 backdrop-blur-sm px-6 py-3 rounded-full border border-white flex items-center gap-4 w-80">
            <Search size={18} className="text-atul-pink_primary" />
            <input 
              type="text" 
              placeholder="Search master catalog..."
              className="bg-transparent border-none outline-none text-sm font-bold w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="bg-atul-charcoal text-white size-12 rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-all">
            <Plus size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Categories Sidebar */}
        <div className="w-80 bg-white/20 backdrop-blur-md border-r border-white/40 flex flex-col">
          <div className="p-8 pb-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-atul-pink_primary/40 mb-4">Categories</h3>
          </div>
          <div className="flex-1 overflow-y-auto px-4 space-y-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "w-full p-5 rounded-[2rem] flex items-center justify-between group transition-all",
                  activeCategory?.id === cat.id 
                    ? "bg-white shadow-xl shadow-atul-pink_soft/20 text-atul-charcoal" 
                    : "text-atul-charcoal/40 hover:bg-white/40"
                )}
              >
                <div className="flex items-center gap-4">
                  <span className="text-lg">{cat.icon_emoji}</span>
                  <span className="text-sm font-black whitespace-nowrap overflow-hidden text-ellipsis">{cat.name}</span>
                </div>
                {activeCategory?.id === cat.id && <ChevronRight size={14} className="text-atul-pink_primary" />}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-8">
            <AnimatePresence mode='popLayout'>
              {currentProducts.map(product => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={product.id}
                  className="bg-white/80 backdrop-blur-md border-2 border-white rounded-[3rem] p-8 group relative"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="size-16 rounded-[1.5rem] bg-atul-pink_soft/20 flex items-center justify-center text-atul-pink_primary">
                      <Tag size={28} />
                    </div>
                    <div className="flex gap-2">
                      <button className="size-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-atul-pink_soft/10 transition-colors">
                        <Edit3 size={16} className="text-atul-gray" />
                      </button>
                      <button className="size-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-atul-pink_soft/10 transition-colors">
                        <MoreVertical size={16} className="text-atul-gray" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-2xl font-black text-atul-charcoal font-serif italic mb-2">{product.name}</h3>
                  <div className="flex items-center gap-4 mb-6">
                    <span className="text-2xl font-black professional-digits">₹{parseFloat(product.base_price).toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-atul-gray/40 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full border border-gray-100">HSN: {product.hsn_code || 'N/A'}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-atul-cream/40 rounded-[2rem] border border-atul-pink_primary/5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-atul-pink_primary/40 mb-1">Status</p>
                      <div className="flex items-center gap-2">
                        {product.is_available ? (
                          <><CheckCircle2 size={14} className="text-emerald-500" /> <span className="text-[11px] font-black text-emerald-600 uppercase">Live</span></>
                        ) : (
                          <><EyeOff size={14} className="text-atul-gray/40" /> <span className="text-[11px] font-black text-atul-gray/40 uppercase">Offline</span></>
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-atul-cream/40 rounded-[2rem] border border-atul-pink_primary/5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-atul-pink_primary/40 mb-1">Variants</p>
                      <div className="flex items-center gap-2">
                        <Layout size={14} className="text-atul-pink_primary" />
                        <span className="text-[11px] font-black uppercase">{product.variants?.length || 0} Options</span>
                      </div>
                    </div>
                  </div>

                  {/* Outlet Toggles Overlay (Mobile/Granular) */}
                  <div className="mt-6 pt-6 border-t border-dashed border-atul-pink_soft/40">
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40">Local Availability</span>
                        <button className="text-[10px] font-black uppercase tracking-tighter text-atul-pink_primary hover:underline underline-offset-4">Manage Outlets</button>
                     </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
