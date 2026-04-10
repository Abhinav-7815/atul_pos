import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { inventoryApi, menuApi } from '../services/api';
import { Search, Edit2, X, Delete, Package, Maximize, Minimize } from 'lucide-react';

const formatStock = (qty) => {
  const q = Number(qty) || 0;
  if (q <= 0) return '0 kg';
  if (q < 1)   return `${(q * 1000).toFixed(0)} g`;
  return `${q % 1 === 0 ? q : q.toFixed(2)} kg`;
};

// ── On-screen Numpad ──────────────────────────────────────────────────────────
function Numpad({ value, onChange }) {
  const press = (key) => {
    if (key === 'back') {
      onChange('0');
    } else if (key === 'clear') {
      onChange('0');
    } else if (key === '.') {
      if (!value.includes('.')) onChange(value + '.');
    } else {
      const next = value === '0' ? key : value + key;
      onChange(next);
    }
  };

  const keys = [
    ['7','8','9'],
    ['4','5','6'],
    ['1','2','3'],
    ['.','0','back'],
  ];

  return (
    <div className="grid gap-2 mt-4">
      {keys.map((row, r) => (
        <div key={r} className="grid grid-cols-3 gap-2">
          {row.map(k => (
            <button
              key={k}
              onPointerDown={e => { e.preventDefault(); press(k); }}
              className={`h-14 rounded-2xl font-black text-xl select-none transition-all active:scale-95 ${
                k === 'back'
                  ? 'bg-red-50 text-red-400 hover:bg-red-100'
                  : 'bg-gray-100 text-atul-charcoal hover:bg-atul-pink_soft hover:text-atul-pink_primary'
              }`}
            >
              {k === 'back' ? <Delete size={20} className="mx-auto" /> : k}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Inventory({ user }) {
  const [categories, setCategories]   = useState([]);
  const [products, setProducts]       = useState([]);
  const [stockMap, setStockMap]       = useState({});
  const [loading, setLoading]         = useState(true);
  const [activeCategory, setActiveCategory] = useState(() => localStorage.getItem('atul_pos_inventory_active_cat') || 'all');

  useEffect(() => {
    localStorage.setItem('atul_pos_inventory_active_cat', activeCategory);
  }, [activeCategory]);
  const [search, setSearch]           = useState('');

  const [editItem, setEditItem]       = useState(null);
  const [editQty, setEditQty]         = useState('0');
  const [editThreshold, setEditThreshold] = useState('5');
  const [activeEditTab, setActiveEditTab] = useState('qty'); // 'qty' or 'threshold'
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState(null);

  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadStocks = async () => {
    const res = await inventoryApi.getStocks({ outlet: user?.outlet, limit: 1000 });
    const list = res.data?.data || res.data?.results || res.data || [];
    const map = {};
    list.forEach(s => { 
      map[s.product] = { 
        id: s.id, 
        quantity: s.quantity,
        min_threshold: s.min_threshold
      }; 
    });
    setStockMap(map);
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [catRes, prodRes] = await Promise.all([
          menuApi.getCategories(),
          menuApi.getProducts({ limit: 1000 }),
        ]);
        setCategories(catRes.data?.data || catRes.data?.results || catRes.data || []);
        setProducts(prodRes.data?.data || prodRes.data?.results || prodRes.data || []);
        await loadStocks();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // ── Filter & group ────────────────────────────────────────────────────────
  const filtered = useMemo(() => products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const catId = p.category?.id ?? p.category;
    const matchCat = activeCategory === 'all' || String(catId) === String(activeCategory);
    return matchSearch && matchCat;
  }), [products, search, activeCategory]);

  const sortedList = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // 1. Stock Status
      const getStatusScore = (item) => {
        const stock = stockMap[item.id];
        const qty = Number(stock?.quantity) || 0;
        const threshold = Number(stock?.min_threshold) || 5;
        if (qty <= 0) return 2; // Out of stock (highest priority)
        if (qty <= threshold) return 1; // Low stock
        return 0; // Normal
      };

      const scoreA = getStatusScore(a);
      const scoreB = getStatusScore(b);

      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Descending score (2 comes first, then 1, then 0)
      }

      // 2. Alphabetical by name
      return a.name.localeCompare(b.name);
    });
  }, [filtered, stockMap]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleInlineSave = async (p, newQty) => {
    const qty = parseFloat(newQty);
    if (isNaN(qty) || qty < 0) return;

    const existing = stockMap[p.id];
    const currentQty = existing ? Number(existing.quantity || 0) : 0;
    
    if (qty === currentQty) return;

    const threshold = existing ? Number(existing.min_threshold) : 5;

    try {
      await inventoryApi.setQuantity({
        product_id: p.id,
        outlet: user?.outlet,
        quantity: qty,
        min_threshold: threshold,
      });
      await loadStocks();
      showToast(`${p.name} stock updated`);
    } catch (err) {
      console.error(err);
      showToast('Failed to save. Please try again.', false);
    }
  };

  const handleSave = async () => {
    if (!editItem) return;
    const qty = parseFloat(editQty);
    if (isNaN(qty) || qty < 0) { showToast('Enter a valid quantity', false); return; }

    setSaving(true);
    try {
      await inventoryApi.setQuantity({
        product_id: editItem.product.id,
        outlet: user?.outlet,
        quantity: qty,
        min_threshold: parseFloat(editThreshold),
      });
      await loadStocks();
      setEditItem(null);
      showToast(`${editItem.product.name} updated`);
    } catch (err) {
      console.error(err);
      showToast('Failed to save. Please try again.', false);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p) => {
    const existing = stockMap[p.id];
    const current = existing ? Number(existing.quantity) : 0;
    const threshold = existing ? Number(existing.min_threshold) : 5;
    setEditQty(String(current));
    setEditThreshold(String(threshold));
    setActiveEditTab('qty');
    setEditItem({ product: p });
  };

  // ── Render ──
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#FDF3F6] text-atul-charcoal" style={{ fontFamily: '"Inter", sans-serif' }}>

      {/* Header */}
      <div className="px-7 pt-6 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-black text-atul-pink_deep leading-none tracking-tight" style={{ fontFamily: '"Outfit", sans-serif' }}>Inventory</h2>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-atul-charcoal/30 mt-1">{products.length} total items</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleFullscreen}
              className="size-10 rounded-2xl bg-white text-atul-charcoal/40 hover:text-atul-pink_primary flex items-center justify-center shadow-sm border border-white hover:border-atul-pink_primary/10 transition-all active:scale-95"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
            <div className="relative group min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-atul-charcoal/20 group-focus-within:text-atul-pink_primary transition-colors" size={16} />
              <input
                type="text" placeholder="Search items..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="pl-10 pr-4 py-3 bg-white border border-white focus:border-atul-pink_primary/20 rounded-2xl text-xs font-bold outline-none w-full shadow-sm transition-all focus:ring-4 focus:ring-atul-pink_primary/5"
              />
            </div>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={`shrink-0 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === 'all' ? 'bg-atul-pink_primary text-white shadow-lg' : 'bg-white text-atul-charcoal/40 hover:text-atul-charcoal border border-transparent hover:border-atul-pink_primary/10'}`}
            style={{ fontFamily: '"Outfit", sans-serif' }}
          >All</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setActiveCategory(c.id)}
              className={`shrink-0 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === c.id ? 'bg-atul-pink_primary text-white shadow-lg' : 'bg-white text-atul-charcoal/40 hover:text-atul-charcoal border border-transparent hover:border-atul-pink_primary/10'}`}
              style={{ fontFamily: '"Outfit", sans-serif' }}
            >{c.name}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-7 pb-8">
        {loading ? (
          <div className="space-y-3 pt-2">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 bg-white/50 rounded-2xl animate-pulse" />)}
          </div>
        ) : sortedList.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 opacity-20">
            <Package size={48} />
            <p className="font-bold text-lg uppercase tracking-widest" style={{ fontFamily: '"Outfit", sans-serif' }}>No items found</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="py-4 px-6 text-[10px] uppercase tracking-widest font-black text-atul-charcoal/40" style={{ fontFamily: '"Outfit", sans-serif' }}>Product Name</th>
                  <th className="py-4 px-6 text-[10px] uppercase tracking-widest font-black text-atul-charcoal/40" style={{ fontFamily: '"Outfit", sans-serif' }}>Category</th>
                  <th className="py-4 px-6 text-[10px] uppercase tracking-widest font-black text-atul-charcoal/40" style={{ fontFamily: '"Outfit", sans-serif' }}>Status</th>
                  <th className="py-4 px-6 text-[10px] uppercase tracking-widest font-black text-atul-charcoal/40 text-right" style={{ fontFamily: '"Outfit", sans-serif' }}>Current Stock</th>
                </tr>
              </thead>
              <tbody>
                {sortedList.map((p, idx) => {
                  const stock = stockMap[p.id];
                  const qty   = Number(stock?.quantity) || 0;
                  const threshold = Number(stock?.min_threshold) || 5;
                  const isOut = qty <= 0;
                  const isLow = !isOut && qty <= threshold;
                  
                  const catId   = p.category?.id ?? p.category ?? 'uncategorized';
                  const catName = p.category_name
                    || categories.find(c => String(c.id) === String(catId))?.name
                    || 'Uncategorized';

                  return (
                    <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${isLow ? 'bg-orange-50/20' : isOut ? 'bg-red-50/20' : ''}`}>
                      <td className="py-4 px-6">
                        <p className="text-[13px] font-bold text-atul-charcoal leading-tight" style={{ fontFamily: '"Inter", sans-serif' }}>
                          {p.name.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ')}
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-[10px] font-black uppercase tracking-widest text-atul-pink_primary/50" style={{ fontFamily: '"Outfit", sans-serif' }}>{catName}</span>
                      </td>
                      <td className="py-4 px-6">
                        {isOut ? (
                          <span className="px-2 py-1 bg-red-100 text-red-600 text-[9px] font-black uppercase rounded-md tracking-widest" style={{ fontFamily: '"Outfit", sans-serif' }}>Out of Stock</span>
                        ) : isLow ? (
                          <span className="px-2 py-1 bg-orange-100 text-orange-600 text-[9px] font-black uppercase rounded-md tracking-widest" style={{ fontFamily: '"Outfit", sans-serif' }}>Low Stock</span>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-600 text-[9px] font-black uppercase rounded-md tracking-widest" style={{ fontFamily: '"Outfit", sans-serif' }}>In Stock</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={qty}
                            onBlur={(e) => handleInlineSave(p, e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                            className={`w-28 px-3 py-2 text-right text-base font-black tabular-nums border rounded-xl outline-none transition-all shadow-sm ${isOut ? 'text-red-600 border-red-200 bg-red-50 focus:border-red-400 focus:ring-4 focus:ring-red-100' : isLow ? 'text-orange-600 border-orange-200 bg-orange-50 focus:border-orange-400 focus:ring-4 focus:ring-orange-100' : 'text-emerald-600 border-emerald-100 hover:border-emerald-200 bg-emerald-50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100'}`}
                            style={{ fontFamily: '"Outfit", sans-serif' }}
                          />
                          <span className="text-[10px] font-black text-atul-charcoal/40 uppercase tracking-widest">kg</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      <AnimatePresence>
        {editItem && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-atul-charcoal/40 backdrop-blur-sm" onClick={() => !saving && setEditItem(null)} />

            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative bg-white rounded-t-[3rem] sm:rounded-[3rem] w-full max-w-sm shadow-2xl z-10 transition-all border border-gray-100"
            >
              {/* Title bar */}
              <div className="flex items-center justify-between px-8 pt-8 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-xl font-black text-atul-charcoal tracking-tight" style={{ fontFamily: '"Outfit", sans-serif' }}>{editItem.product.name}</h3>
                  <p className="text-[10px] font-bold text-atul-charcoal/30 uppercase tracking-[0.2em] mt-1">Configure stock & alerts</p>
                </div>
                <button onClick={() => !saving && setEditItem(null)} className="size-10 rounded-2xl bg-gray-50 text-atul-charcoal/40 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center active:scale-90">
                  <X size={20} strokeWidth={3} />
                </button>
              </div>

              <div className="px-8 pt-6 pb-8">
                {/* Tabs */}
                <div className="flex bg-gray-50 p-1.5 rounded-2xl mb-6">
                  <button 
                    onClick={() => setActiveEditTab('qty')}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeEditTab==='qty' ? 'bg-white text-atul-pink_primary shadow-md' : 'text-atul-charcoal/30 hover:text-atul-charcoal'}`}
                    style={{ fontFamily: '"Outfit", sans-serif' }}
                  >Quantity</button>
                  <button 
                    onClick={() => setActiveEditTab('threshold')}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeEditTab==='threshold' ? 'bg-white text-atul-pink_primary shadow-md' : 'text-atul-charcoal/30 hover:text-atul-charcoal'}`}
                    style={{ fontFamily: '"Outfit", sans-serif' }}
                  >Low Alert</button>
                </div>

                {/* Display */}
                <div className="bg-atul-pink_soft/20 rounded-3xl py-6 px-4 text-center mb-6">
                  <p className="text-[10px] font-black text-atul-pink_primary/40 uppercase tracking-[0.3em] mb-2" style={{ fontFamily: '"Outfit", sans-serif' }}>
                    {activeEditTab === 'qty' ? 'Stock Amount' : 'Threshold Limit'}
                  </p>
                  <p className={`text-6xl font-black tracking-tighter tabular-nums ${(activeEditTab==='qty'?editQty:editThreshold) === '0' ? 'text-atul-charcoal/20' : 'text-atul-pink_primary'}`} style={{ fontFamily: '"Outfit", sans-serif' }}>
                    {activeEditTab === 'qty' ? editQty : editThreshold}
                  </p>
                  <p className="text-[10px] font-bold text-atul-pink_primary/40 mt-1 uppercase tracking-widest">
                    {activeEditTab === 'qty' 
                      ? (Number(editQty) > 0 && Number(editQty) < 1 ? `GRAMS` : `KILOGRAMS`)
                      : `KILOGRAMS`
                    }
                  </p>
                </div>

                {/* Numpad */}
                <Numpad 
                  value={activeEditTab === 'qty' ? editQty : editThreshold} 
                  onChange={activeEditTab === 'qty' ? setEditQty : setEditThreshold} 
                />

                {/* Save button */}
                <button
                  onPointerDown={e => e.preventDefault()}
                  onClick={handleSave}
                  disabled={saving || (activeEditTab === 'qty' && editQty === '')}
                  className="mt-6 w-full h-16 bg-atul-pink_primary text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-atul-pink_primary/30 hover:bg-atul-pink_deep active:scale-95 transition-all disabled:opacity-40"
                  style={{ fontFamily: '"Outfit", sans-serif' }}
                >
                  {saving ? 'UPDATING…' : 'UPDATE STOCK'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl text-white ${toast.ok ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{ fontFamily: '"Outfit", sans-serif' }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
