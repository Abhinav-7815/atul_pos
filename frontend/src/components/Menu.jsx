import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Filter, 
  MoreVertical, Edit3, Trash2, 
  CheckCircle2, XCircle, ChevronRight,
  Eye, EyeOff, Tag, Layout, Package,
  Weight, Scale, IndianRupee, Trash,
  AlertCircle, Check, Save, X, Layers, ChevronDown
} from 'lucide-react';
import { menuApi } from '../services/api';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

export default function Menu({ user }) {
  const [categories, setCategories] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isProdModalOpen, setIsProdModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);

  // Form State
  const [catForm, setCatForm] = useState({ name: '', icon_emoji: '🍦', display_order: 0 });
  const [autoCalculatePrices, setAutoCalculatePrices] = useState(true);
  const [prodForm, setProdForm] = useState({
    name: '', description: '', category: '', 
    base_price: 0, tax_rate: 5, hsn_code: '',
    is_veg: true, is_available: true, variants: []
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch both categories and products
      const [catRes, prodRes] = await Promise.all([
        menuApi.getCategories(),
        menuApi.getProducts()
      ]);

      const catData = catRes.data?.data || catRes.data;
      const prodData = prodRes.data?.data || prodRes.data;

      if (Array.isArray(catData)) {
        setCategories(catData);
      }
      
      if (Array.isArray(prodData)) {
        setAllProducts(prodData);
      }

      // Handle active category selection
      if (catData && catData.length > 0) {
        if (!activeCategory) {
          setActiveCategory(catData[0]);
        } else {
          const updated = catData.find(c => c.id === activeCategory.id);
          if (updated) setActiveCategory(updated);
        }
      } else if (!activeCategory) {
        // Default to Uncategorized if no categories exist but products do
        setActiveCategory({ id: 'uncategorized', name: 'Uncategorized', icon_emoji: '📦' });
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

  const currentProducts = useMemo(() => {
    if (!activeCategory) return [];
    
    return allProducts.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory.id === 'uncategorized' 
        ? (!p.category || p.category === null)
        : (p.category === activeCategory.id);
      return matchesSearch && matchesCategory;
    });
  }, [activeCategory, searchTerm, allProducts]);

  // CATEGORY ACTIONS
  const handleEditCategory = (cat) => {
    setEditingCategory(cat);
    setCatForm({ name: cat.name, icon_emoji: cat.icon_emoji || '🍦', display_order: cat.display_order || 0 });
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = async () => {
    try {
      if (editingCategory) {
        await menuApi.updateCategory(editingCategory.id, catForm);
      } else {
        await menuApi.createCategory(catForm);
      }
      setIsCatModalOpen(false);
      fetchData();
    } catch (err) {
      alert("Error saving category");
    }
  };

  // PRODUCT ACTIONS
  const handleAddProduct = () => {
    setEditingProduct(null);
    setProdForm({
      name: '', description: '', category: activeCategory?.id || '', 
      base_price: 0, tax_rate: 5, hsn_code: '',
      is_veg: true, is_available: true, variants: []
    });
    setIsProdModalOpen(true);
  };

  const handleEditProduct = (prod) => {
    setEditingProduct(prod);
    
    // Normalize pricing into variants so UI sees exact final prices
    const base = Number(prod.display_price || prod.base_price || 0);
    const normalizedVariants = (prod.variants || []).map(v => ({
      ...v,
      // Ensure we display correctly if delta was relative or override
      price_delta: Number(v.current_price || v.price_delta || 0) + base
    }));

    setProdForm({
      name: prod.name,
      description: prod.description || '',
      category: prod.category,
      base_price: 0,
      display_price: 0,
      tax_rate: prod.tax_rate,
      hsn_code: prod.hsn_code || '',
      is_veg: prod.is_veg,
      is_available: prod.is_available,
      variants: normalizedVariants
    });
    setIsProdModalOpen(true);
  };

  // Delete Confirmation State
  const [confirmModal, setConfirmModal] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    onConfirm: () => {},
    type: 'product' 
  });

  const handleDeleteProduct = (id, name, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setConfirmModal({
      // Same logic...
      isOpen: true,
      title: 'Delete Product?',
      message: `Are you sure you want to permanently remove "${name}" from your catalog?`,
      type: 'product',
      onConfirm: async () => {
        try {
          await menuApi.deleteProduct(id);
          fetchData();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          console.error("Delete Error:", err);
          alert("Failed to delete product.");
        }
      }
    });
  };

  const handleDeleteCategory = (id, name, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: 'Delete Category?',
      message: `Are you sure you want to remove "${name}"? All products in this category will be moved to the "Uncategorized" section safely.`,
      type: 'category',
      onConfirm: async () => {
        try {
          await menuApi.deleteCategory(id);
          fetchData();
          if (activeCategory?.id === id) setActiveCategory(null);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          console.error("Delete Error:", err);
          alert("Failed to delete category.");
        }
      }
    });
  };

  const handleSaveProduct = async () => {
    try {
      let productId = editingProduct?.id;
      const productData = { 
        ...prodForm, 
        base_price: prodForm.base_price || 0
      };

      if (editingProduct) {
        await menuApi.updateProduct(editingProduct.id, productData);
      } else {
        await menuApi.createProduct(productData);
      }
      
      setIsProdModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Save Error:", err);
      alert("Error saving product or versions");
    }
  };

  const addVariantField = () => {
    setProdForm(prev => ({
      ...prev,
      variants: [...prev.variants, { name: '', price_delta: 0, is_default: prev.variants.length === 0 }]
    }));
  };

  const removeVariantField = (index) => {
    setProdForm(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const updateVariantField = (index, field, value) => {
    setProdForm(prev => {
      const newVariants = [...prev.variants];
      newVariants[index][field] = value;
      if (field === 'is_default' && value === true) {
        newVariants.forEach((v, i) => { if(i !== index) v.is_default = false; });
      }
      return { ...prev, variants: newVariants };
    });
  };

  if (loading && !activeCategory) return (
    <div className="h-screen flex items-center justify-center bg-atul-white">
      <div className="flex flex-col items-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="size-16 border-4 border-atul-pink_primary border-t-transparent rounded-full mb-4"/>
        <p className="font-serif italic text-atul-pink_primary text-lg">Opening catalog...</p>
      </div>
      {/* ── MODAL: DELETE CONFIRMATION ── */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-atul-charcoal/80 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-white/50 relative"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500" />
              
              <div className="p-8 pt-10 text-center">
                 <div className="size-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-6 shadow-sm">
                    <Trash2 size={28} strokeWidth={2.5} />
                 </div>
                 
                 <h3 className="text-xl font-black text-atul-charcoal tracking-tight mb-3">
                   {confirmModal.title}
                 </h3>
                 <p className="text-sm font-medium text-atul-gray/60 leading-relaxed px-2">
                   {confirmModal.message}
                 </p>
              </div>

              <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex gap-4">
                 <button 
                   onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                   className="flex-1 bg-white border border-gray-200 text-atul-charcoal font-bold text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-gray-100 transition-all cursor-pointer shadow-sm"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={confirmModal.onConfirm}
                   className="flex-1 bg-rose-500 text-white font-bold text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-rose-600 transition-all cursor-pointer shadow-lg shadow-rose-500/20 active:scale-[0.98]"
                 >
                   Delete
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[#FAFAFB] overflow-hidden font-sans text-atul-charcoal">
      {/* ── HEADER ── */}
      <header className="px-10 py-5 flex justify-between items-center bg-white border-b border-gray-100 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="size-11 bg-atul-pink_primary/10 rounded-2xl flex items-center justify-center text-atul-pink_primary">
            <Package size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight font-heading">Menu Catalog</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-atul-gray/60 text-[10px] font-semibold uppercase tracking-wider">Product Master Live</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-5">
          <div className="bg-gray-50/80 px-4 py-2.5 rounded-2xl border border-gray-100 flex items-center gap-3 w-80 focus-within:border-atul-pink_primary/40 focus-within:bg-white focus-within:ring-4 focus-within:ring-atul-pink_primary/5 transition-all group">
            <Search size={18} className="text-atul-gray/40 group-focus-within:text-atul-pink_primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search in catalog..."
              className="bg-transparent border-none outline-none text-sm font-medium w-full placeholder:text-atul-gray/30 text-atul-charcoal"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={handleAddProduct}
            className="bg-atul-charcoal text-white h-11 px-6 rounded-2xl flex items-center gap-2.5 font-bold text-xs uppercase tracking-widest hover:bg-atul-pink_primary transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-atul-charcoal/10"
          >
            <Plus size={18} /> New Product
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── SIDEBAR: CATEGORIES ── */}
        <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shrink-0 z-10 shadow-sm shadow-gray-200/50">
          <div className="p-6 pb-4 flex justify-between items-center whitespace-nowrap overflow-hidden">
            <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-atul-charcoal/20">Dashboard</h3>
            <button 
              onClick={() => { setEditingCategory(null); setCatForm({name:'', icon_emoji:'🍦', display_order:0}); setIsCatModalOpen(true); }}
              className="size-6 bg-gray-50 text-atul-pink_primary hover:bg-atul-pink_primary hover:text-white rounded flex items-center justify-center transition-all"
            >
              <Plus size={12} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">
            {categories.map(cat => (
              <div key={cat.id} className="group relative mb-1">
                <button
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "w-full px-3.5 py-2.5 rounded-lg flex items-center justify-between transition-all cursor-pointer group/btn duration-300",
                    activeCategory?.id === cat.id 
                      ? "bg-atul-pink_primary text-white shadow-md shadow-atul-pink_primary/10" 
                      : "text-atul-charcoal/50 hover:bg-gray-50 hover:text-atul-charcoal"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-base transition-all", 
                      activeCategory?.id === cat.id ? "grayscale-0" : "grayscale opacity-30 group-hover/btn:opacity-100 group-hover/btn:grayscale-0"
                    )}>
                      {cat.icon_emoji}
                    </span>
                    <span className="text-[12px] font-bold tracking-tight truncate">{cat.name}</span>
                  </div>
                  {activeCategory?.id === cat.id && <ChevronRight size={12} className="text-white/80" />}
                </button>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-all z-20 pointer-events-auto bg-white/90 backdrop-blur-sm p-0.5 rounded-lg shadow-sm">
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditCategory(cat); }}
                    className={cn(
                      "size-6 flex items-center justify-center rounded-md border shadow-sm transition-all active:scale-90",
                      activeCategory?.id === cat.id ? "bg-atul-pink_primary text-white border-atul-pink_primary" : "bg-white text-atul-gray border-gray-100 hover:text-atul-pink_primary"
                    )}
                  >
                    <Edit3 size={11} strokeWidth={2.5} />
                  </button>
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteCategory(cat.id, cat.name, e); }}
                    className={cn(
                      "size-6 flex items-center justify-center rounded-md border shadow-sm transition-all active:scale-90",
                      activeCategory?.id === cat.id ? "bg-rose-500 text-white border-rose-500" : "bg-white text-rose-500 border-gray-100 hover:bg-rose-500 hover:text-white"
                    )}
                  >
                    <Trash2 size={11} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ))}

            {/* Virtual Uncategorized Category */}
            <div className="group relative mb-1 mt-4">
              <button
                onClick={() => setActiveCategory({ id: 'uncategorized', name: 'Uncategorized', icon_emoji: '📦' })}
                className={cn(
                  "w-full px-3.5 py-2.5 rounded-lg flex items-center justify-between transition-all cursor-pointer group/btn duration-300",
                  activeCategory?.id === 'uncategorized' 
                    ? "bg-atul-charcoal text-white shadow-md shadow-atul-charcoal/10" 
                    : "text-atul-charcoal/30 hover:bg-gray-50 hover:text-atul-charcoal italic"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-base transition-all", 
                    activeCategory?.id === 'uncategorized' ? "grayscale-0" : "grayscale opacity-20 group-hover/btn:opacity-100 group-hover/btn:grayscale-0"
                  )}>
                    📦
                  </span>
                  <span className="text-[11px] font-bold tracking-tight truncate">Uncategorized Items</span>
                </div>
                {activeCategory?.id === 'uncategorized' && <ChevronRight size={12} className="text-white/80" />}
              </button>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT: PRODUCTS ── */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#F8F9FA] custom-scrollbar">
          <div className="w-full">
            {activeCategory && (
              <div className="mb-6 flex justify-between items-center border-b border-gray-100 pb-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold text-atul-charcoal tracking-tight font-heading">{activeCategory.name}</h2>
                  <div className="w-px h-4 bg-gray-200" />
                  <p className="text-atul-gray/40 text-[9px] font-bold uppercase tracking-widest leading-none mt-0.5">{currentProducts.length} Selections</p>
                </div>
                <div className="flex gap-2">
                  <div className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-atul-charcoal flex items-center gap-1.5 cursor-pointer hover:bg-gray-50">
                    Category <ChevronDown size={12} className="opacity-40" />
                  </div>
                  <div className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-atul-charcoal flex items-center gap-1.5 cursor-pointer hover:bg-gray-50">
                    Filter <ChevronDown size={12} className="opacity-40" />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5">
              <AnimatePresence mode='popLayout'>
                {currentProducts.map(product => (
                  <motion.div
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={product.id}
                    className="bg-white rounded-xl group hover:shadow-lg hover:shadow-atul-charcoal/5 transition-all duration-300 relative border border-gray-100 flex flex-col overflow-hidden"
                  >
                    {/* Placeholder Area */}
                    <div className="p-2">
                       <div className="relative h-32 w-full rounded-lg bg-[#E8EDF2] flex items-center justify-center overflow-hidden">
                          <span className="text-4xl drop-shadow-lg transition-transform group-hover:scale-110 duration-500">{activeCategory.icon_emoji}</span>
                          
                          {/* Price Badge - Resolve default variant price if base is 0 */}
                          <div className="absolute right-2.5 bottom-2.5 bg-atul-pink_primary text-white px-2.5 py-1 rounded-full text-[12px] font-black shadow-md shadow-atul-pink_primary/30">
                            ₹{(() => {
                              const base = parseFloat(product.base_price || 0);
                              if (base > 0) return base.toFixed(0);
                              const def = (product.variants || []).find(v => v.is_default) || (product.variants || [])[0];
                              return parseFloat(def?.current_price || def?.price_delta || 0).toFixed(0);
                            })()}
                          </div>

                          {/* Actions */}
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-300">
                             <button onClick={() => handleEditProduct(product)} className="size-7 bg-white/90 backdrop-blur rounded flex items-center justify-center text-atul-gray hover:text-atul-pink_primary shadow-sm active:scale-95 transition-all"><Edit3 size={12} /></button>
                             <button onClick={(e) => handleDeleteProduct(product.id, product.name, e)} className="size-7 bg-white/90 backdrop-blur rounded flex items-center justify-center text-rose-500 hover:text-white hover:bg-rose-500 shadow-sm active:scale-95 transition-all"><Trash size={12} /></button>
                          </div>
                       </div>
                    </div>

                    <div className="p-4 pt-1 pb-5 flex-1 flex flex-col">
                      <h3 className="text-[13px] font-bold text-atul-charcoal tracking-tight mb-0.5 truncate">{product.name}</h3>
                      <p className="text-atul-gray/40 text-[9px] font-bold leading-tight mb-3 line-clamp-1">
                        {product.description || "Artisan Collection."}
                      </p>
                      
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-1 px-0.5">
                           <span className={cn(
                             "text-[8px] font-bold uppercase tracking-wider",
                             product.is_available ? "text-emerald-500" : "text-gray-400"
                           )}>
                             {product.is_available ? "In Stock" : "Hidden"}
                           </span>
                           <span className="text-[8px] font-bold text-atul-charcoal/20 uppercase tracking-widest">{product.hsn_code || '---'}</span>
                        </div>
                        <div className="w-full h-1 bg-gray-50 rounded-full overflow-hidden">
                           <div className={cn("h-full transition-all duration-500", product.is_available ? "w-[75%] bg-emerald-500" : "w-[0%] bg-gray-300")} />
                        </div>
                      </div>

                      {product.variants?.length > 0 && (
                        <div className="mt-auto flex flex-wrap gap-1.5 overflow-hidden max-h-[44px]">
                           {product.variants.map(v => (
                             <div key={v.id} className="px-2 py-1 bg-white border border-gray-50 rounded text-[8px] font-bold text-atul-charcoal/50 hover:border-atul-pink_primary/40 hover:text-atul-pink_primary cursor-pointer transition-all">
                                {v.name}
                             </div>
                           ))}
                        </div>
                      )}
                    </div>

                    <div className={cn(
                      "absolute top-4 left-4 size-1.5 rounded-full",
                      product.is_veg ? "bg-emerald-500 shadow-[0_0_4px_#10B981]" : "bg-rose-500 shadow-[0_0_4px_#F43F5E]"
                    )} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>

      {/* ── MODAL: CATEGORY ── */}
      <AnimatePresence>
        {isCatModalOpen && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-atul-charcoal/60 backdrop-blur-md">
            <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-white/50">
              <form onSubmit={(e) => { e.preventDefault(); handleSaveCategory(); }}>
                <div className="px-10 pt-10 pb-6">
                  <div className="flex justify-between items-center">
                     <div>
                       <h3 className="text-2xl font-extrabold text-atul-charcoal tracking-tight font-heading">{editingCategory ? "Update Category" : "New Category"}</h3>
                       <p className="text-atul-pink_primary text-[10px] font-bold uppercase tracking-[0.2em] mt-1.5">Collection Settings</p>
                     </div>
                     <button type="button" onClick={() => setIsCatModalOpen(false)} className="size-11 bg-gray-50 rounded-2xl flex items-center justify-center text-atul-gray hover:text-atul-charcoal hover:bg-gray-100 transition-all cursor-pointer"><X size={20}/></button>
                  </div>
                </div>
                <div className="px-10 pb-10 space-y-6">
                   <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-atul-gray/50 mb-2.5 block px-1">Category Name</label>
                      <input 
                        type="text" value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})}
                        placeholder="e.g. Thick Shakes"
                        className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl p-4.5 text-sm font-semibold focus:bg-white focus:border-atul-pink_primary/40 focus:ring-4 focus:ring-atul-pink_primary/5 outline-none transition-all"
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-atul-gray/50 mb-2.5 block px-1">Icon Emoji</label>
                        <input 
                          type="text" value={catForm.icon_emoji} onChange={e => setCatForm({...catForm, icon_emoji: e.target.value})}
                          placeholder="🍦"
                          className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl p-4.5 text-2xl focus:bg-white focus:border-atul-pink_primary/40 focus:ring-4 focus:ring-atul-pink_primary/5 outline-none transition-all text-center"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-atul-gray/50 mb-2.5 block px-1">Display Order</label>
                        <input 
                          type="number" value={catForm.display_order} onChange={e => setCatForm({...catForm, display_order: parseInt(e.target.value)})}
                          className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl p-4.5 text-sm font-black focus:bg-white focus:border-atul-pink_primary/40 focus:ring-4 focus:ring-atul-pink_primary/5 outline-none transition-all font-mono"
                        />
                      </div>
                   </div>
                </div>
                <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex gap-4">
                   <button type="button" onClick={() => setIsCatModalOpen(false)} className="flex-1 bg-white border border-gray-200 text-atul-gray py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-100 transition-all cursor-pointer">Cancel</button>
                   <button type="submit" className="flex-1 bg-atul-pink_primary text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-atul-pink_primary/20 hover:bg-atul-pink_deep transition-all cursor-pointer active:scale-95">Save Collection</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL: PRODUCT ── */}
      <AnimatePresence>
        {isProdModalOpen && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-atul-charcoal/70 backdrop-blur-md">
            <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-white/50">
              <form onSubmit={(e) => { e.preventDefault(); handleSaveProduct(); }} className="flex flex-col h-full overflow-hidden">
                <div className="px-10 pt-10 pb-6 shrink-0">
                  <div className="flex justify-between items-center">
                     <div>
                       <h3 className="text-2xl font-extrabold text-atul-charcoal tracking-tight font-heading">{editingProduct ? "Edit Product" : "New Master Entry"}</h3>
                       <p className="text-atul-pink_primary text-[10px] font-bold uppercase tracking-[0.2em] mt-1.5">Detailed Item Specification</p>
                     </div>
                     <button type="button" onClick={() => setIsProdModalOpen(false)} className="size-11 bg-gray-50 rounded-2xl flex items-center justify-center text-atul-gray hover:text-atul-charcoal hover:bg-gray-100 transition-all cursor-pointer"><X size={20}/></button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-10 pb-6 space-y-5 custom-scrollbar">
                  {/* ... contents ... */}
                  <div className="grid grid-cols-12 gap-5">
                     <div className="col-span-12 md:col-span-8">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-atul-charcoal/50 mb-2 block px-1">Product Identity</label>
                        <input 
                          type="text" value={prodForm.name} onChange={e => setProdForm({...prodForm, name: e.target.value})}
                          placeholder="e.g. Alphonso Mango Premium"
                          className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl p-3.5 text-sm font-semibold focus:bg-white focus:border-atul-pink_primary/40 focus:ring-8 focus:ring-atul-pink_primary/5 outline-none transition-all shadow-sm"
                        />
                     </div>
                     <div className="col-span-12 md:col-span-4">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-atul-charcoal/50 mb-2 block px-1">Main Category</label>
                        <div className="relative">
                          <select 
                            value={prodForm.category} onChange={e => setProdForm({...prodForm, category: e.target.value})}
                            className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl p-3.5 text-sm font-semibold focus:bg-white focus:border-atul-pink_primary/40 outline-none transition-all appearance-none pr-10 shadow-sm"
                          >
                             <option value="">Select Category</option>
                             {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-atul-gray/40 pointer-events-none" />
                        </div>
                     </div>
                     <div className="col-span-12">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-atul-charcoal/50 mb-2 block px-1">Product Description</label>
                        <textarea 
                          rows={1} value={prodForm.description} onChange={e => setProdForm({...prodForm, description: e.target.value})}
                          placeholder="Highlight the ingredients and taste..."
                          className="w-full bg-gray-50/50 border border-gray-100 rounded-xl p-3 text-sm font-semibold focus:bg-white focus:border-atul-pink_primary/40 outline-none transition-all resize-none shadow-sm"
                        />
                     </div>
                  </div>

                  <div className="bg-[#FAFBFD] rounded-[2rem] p-6 border border-[#E9EEF5]">
                     <div className="flex justify-between items-center mb-4 px-1">
                        <div className="flex items-center gap-3">
                           <div className="size-8 bg-atul-pink_primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-atul-pink_primary/30">
                             <Scale size={16} />
                           </div>
                           <div>
                             <h4 className="text-sm font-bold text-atul-charcoal uppercase tracking-widest">Fixed Quantity Pricing</h4>
                             <p className="text-[9px] font-medium text-atul-charcoal/40 uppercase tracking-wider mt-0.5">Define prices for standard packaging</p>
                           </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setAutoCalculatePrices(!autoCalculatePrices)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-2",
                            autoCalculatePrices ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-gray-100 text-gray-400 border border-gray-200"
                          )}
                        >
                           <div className={cn("size-2 rounded-full", autoCalculatePrices ? "bg-emerald-500 animate-pulse" : "bg-gray-400")} />
                           {autoCalculatePrices ? "Auto-Fill Active" : "Manual Fill"}
                        </button>
                     </div>

                     <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                          { label: '100gm', key: '100gm', ratio: 1 },
                          { label: '250gm', key: '250gm', ratio: 2.5 },
                          { label: '500gm', key: '500gm', ratio: 5 },
                          { label: '750gm', key: '750gm', ratio: 7.5 },
                          { label: '1kg', key: '1kg', ratio: 10 },
                        ].map((qty, idx) => {
                          const normalizeName = (n) => n?.toLowerCase().replace('gms', 'gm');
                          const variant = prodForm.variants.find(v => normalizeName(v.name) === normalizeName(qty.label));
                          const priceValue = variant ? Number(variant.price_delta) : 0;
                          
                          return (
                            <div key={idx} className="group/field">
                               <label className="text-[9px] font-bold uppercase tracking-widest text-atul-charcoal/50 mb-2 block px-2 group-hover/field:text-atul-pink_primary transition-colors">{qty.label}</label>
                               <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-atul-charcoal/20 font-black text-xs">₹</span>
                                  <input 
                                    type="number"
                                    value={priceValue || ''}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      let newVariants = [...prodForm.variants];
                                      const updateQty = (qLabel, qPrice) => {
                                         const vIdx = newVariants.findIndex(v => normalizeName(v.name) === normalizeName(qLabel));
                                         const delta = qPrice; 
                                         if (vIdx >= 0) newVariants[vIdx].price_delta = delta;
                                         else newVariants.push({ name: qLabel, price_delta: delta, is_default: normalizeName(qLabel) === '500gm' });
                                      };
                                      updateQty(qty.label, val);
                                      if (autoCalculatePrices && qty.key === '100gm') {
                                         updateQty('250gm', val * 2.5);
                                         updateQty('500gm', val * 5);
                                         updateQty('750gm', val * 7.5);
                                         updateQty('1kg', val * 10);
                                      }
                                      setProdForm({...prodForm, variants: newVariants, base_price: 0, display_price: 0});
                                    }}
                                    className="w-full bg-white border border-[#E9EEF5] rounded-xl p-3 pl-8 text-sm font-black text-atul-charcoal outline-none focus:border-atul-pink_primary/40 focus:ring-4 focus:ring-atul-pink_primary/5 transition-all shadow-sm group-hover/field:shadow-md"
                                    placeholder="0"
                                  />
                               </div>
                            </div>
                          );
                        })}
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
                     <div className="col-span-12 md:col-span-4 bg-gray-50/50 p-4 rounded-[1.5rem] border border-gray-100 flex flex-col justify-center min-h-[90px]">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-atul-charcoal/50 mb-2 block px-1">Tax Rate (GST %)</label>
                        <div className="flex gap-1.5">
                           {[5, 12, 18, 0].map(tx => (
                             <button 
                               key={tx}
                               type="button"
                               onClick={() => setProdForm({...prodForm, tax_rate: tx})}
                               className={cn(
                                 "px-2.5 py-1.5 rounded-lg text-[10px] font-black tracking-widest border transition-all",
                                 prodForm.tax_rate === tx 
                                   ? "bg-atul-pink_primary text-white border-atul-pink_primary shadow-lg shadow-atul-pink_primary/20" 
                                   : "bg-white text-atul-gray/40 border-gray-100 hover:border-gray-200"
                               )}
                             >
                               {tx}%
                             </button>
                           ))}
                        </div>
                     </div>
                     <div className="col-span-12 md:col-span-4 bg-gray-50/50 p-5 rounded-[1.5rem] border border-gray-100 flex items-center justify-between group hover:bg-white hover:border-atul-pink_primary/10 transition-all cursor-pointer min-h-[90px]" onClick={() => setProdForm({...prodForm, is_available: !prodForm.is_available})}>
                        <div className="flex flex-col">
                           <span className="text-[9px] font-bold uppercase tracking-widest text-atul-charcoal/50 mb-1">Store Status</span>
                           <span className={cn("text-xs font-bold", prodForm.is_available ? "text-emerald-500" : "text-rose-500")}>
                             {prodForm.is_available ? "Live" : "OOS"}
                           </span>
                        </div>
                        <div className={cn("px-2 py-1 rounded-md text-[9px] font-bold uppercase border", prodForm.is_available ? "border-emerald-500 text-emerald-500 bg-emerald-50" : "border-rose-500 text-rose-500 bg-rose-50")}>
                           {prodForm.is_available ? "Online" : "Paused"}
                        </div>
                     </div>
                     <div className="col-span-12 md:col-span-4 bg-gray-50/50 p-5 rounded-[1.5rem] border border-gray-100 flex items-center justify-between group hover:bg-white transition-all min-h-[90px]">
                        <div className="flex flex-col flex-1">
                           <span className="text-[9px] font-bold uppercase tracking-widest text-atul-charcoal/50 mb-1">HSN Code</span>
                           <input 
                             type="text" value={prodForm.hsn_code} onChange={e => setProdForm({...prodForm, hsn_code: e.target.value})}
                             placeholder="HSN..."
                             className="bg-transparent text-xs font-bold outline-none text-atul-charcoal placeholder:text-gray-200"
                           />
                        </div>
                        <Tag size={16} className="text-atul-gray/20" />
                     </div>
                  </div>
                </div>

                <div className="p-6 bg-[#FAFAFB] border-t border-gray-100 flex gap-4 shrink-0 px-10">
                   <button type="button" onClick={() => setIsProdModalOpen(false)} className="px-6 bg-white border border-gray-200 text-atul-gray font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-gray-50 transition-all cursor-pointer">Discard</button>
                   <button type="submit" className="flex-1 bg-atul-pink_primary text-white py-4 rounded-xl font-bold text-[13px] uppercase tracking-[0.15em] shadow-xl shadow-atul-pink_primary/20 hover:bg-atul-charcoal transition-all cursor-pointer flex items-center justify-center gap-3 active:scale-[0.98]">
                      <Check size={20} strokeWidth={3} className="text-white/60"/> Save Product Profile
                   </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL: DELETE CONFIRMATION ── */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-atul-charcoal/80 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-white/50 relative"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500" />
              
              <div className="p-8 pt-10 text-center">
                 <div className="size-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-6 shadow-sm">
                    <Trash2 size={28} strokeWidth={2.5} />
                 </div>
                 
                 <h3 className="text-xl font-black text-atul-charcoal tracking-tight mb-3">
                   {confirmModal.title}
                 </h3>
                 <p className="text-sm font-medium text-atul-gray/60 leading-relaxed px-2">
                   {confirmModal.message}
                 </p>
              </div>

              <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex gap-4">
                 <button 
                   onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                   className="flex-1 bg-white border border-gray-200 text-atul-charcoal font-bold text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-gray-100 transition-all cursor-pointer shadow-sm"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={confirmModal.onConfirm}
                   className="flex-1 bg-rose-500 text-white font-bold text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-rose-600 transition-all cursor-pointer shadow-lg shadow-rose-500/20 active:scale-[0.98]"
                 >
                   Delete
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
