import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Filter, 
  MoreVertical, Edit3, Trash2, 
  CheckCircle2, XCircle, ChevronRight,
  Eye, EyeOff, Tag, Layout, Package,
  Weight, Scale, IndianRupee, Trash,
  AlertCircle, Check, Save, X, Layers
} from 'lucide-react';
import { menuApi } from '../services/api';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

export default function Menu({ user }) {
  const [categories, setCategories] = useState([]);
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
  const [prodForm, setProdForm] = useState({
    name: '', description: '', category: '', 
    base_price: 0, tax_rate: 5, hsn_code: '',
    is_veg: true, is_available: true, variants: []
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await menuApi.getCategories();
      const catData = res.data?.data || res.data;
      if (Array.isArray(catData)) {
        setCategories(catData);
        if (catData.length > 0 && !activeCategory) {
           setActiveCategory(catData[0]);
        } else if (activeCategory) {
           const updated = catData.find(c => c.id === activeCategory.id);
           if (updated) setActiveCategory(updated);
        }
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
    return activeCategory.products?.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];
  }, [activeCategory, searchTerm]);

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
    setProdForm({
      name: prod.name,
      description: prod.description || '',
      category: prod.category,
      base_price: prod.base_price,
      tax_rate: prod.tax_rate,
      hsn_code: prod.hsn_code || '',
      is_veg: prod.is_veg,
      is_available: prod.is_available,
      variants: prod.variants?.map(v => ({ ...v })) || []
    });
    setIsProdModalOpen(true);
  };

  const handleSaveProduct = async () => {
    try {
      let productId = editingProduct?.id;
      if (editingProduct) {
        await menuApi.updateProduct(editingProduct.id, {
          ...prodForm,
          variants: undefined // Don't send variants directly in patch if not supported
        });
      } else {
        const res = await menuApi.createProduct(prodForm);
        productId = res.data?.id;
      }

      // Handle variants separately if needed, or if API supports nested writes
      // For now let's assume API is being improved to handle nested variants
      // or we do it sequentially.
      
      setIsProdModalOpen(false);
      fetchData();
    } catch (err) {
      alert("Error saving product");
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
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] overflow-hidden font-sans">
      {/* ── HEADER ── */}
      <header className="px-8 py-6 flex justify-between items-center bg-white border-b border-gray-100 shrink-0">
        <div>
          <h1 className="text-2xl font-black text-atul-charcoal tracking-tight font-heading flex items-center gap-3">
            <div className="size-10 bg-atul-pink_primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-atul-pink_primary/20">
              <Package size={20} />
            </div>
            Menu Catalog
          </h1>
          <p className="text-atul-pink_primary text-[10px] font-black uppercase tracking-[0.3em] mt-1.5 opacity-60">Manage your product master</p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-gray-50 px-5 py-2.5 rounded-xl border border-gray-100 flex items-center gap-3 w-72 focus-within:border-atul-pink_primary/30 focus-within:bg-white transition-all">
            <Search size={16} className="text-atul-gray/40" />
            <input 
              type="text" 
              placeholder="Search items..."
              className="bg-transparent border-none outline-none text-sm font-bold w-full placeholder:text-atul-gray/30"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={handleAddProduct}
            className="bg-atul-charcoal text-white h-11 px-6 rounded-xl flex items-center gap-2 font-black text-xs uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-black transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={16} /> New Product
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── SIDEBAR: CATEGORIES ── */}
        <aside className="w-80 bg-white border-r border-gray-100 flex flex-col">
          <div className="p-6 flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40">Categories</h3>
            <button 
              onClick={() => { setEditingCategory(null); setCatForm({name:'', icon_emoji:'🍦', display_order:0}); setIsCatModalOpen(true); }}
              className="text-atul-pink_primary hover:bg-atul-pink_primary/10 p-1.5 rounded-lg transition-all"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-10">
            {categories.map(cat => (
              <div key={cat.id} className="group relative">
                <button
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "w-full px-4 py-3.5 rounded-xl flex items-center justify-between transition-all cursor-pointer",
                    activeCategory?.id === cat.id 
                      ? "bg-atul-pink_primary text-white shadow-lg shadow-atul-pink_primary/20" 
                      : "text-atul-charcoal/60 hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn("text-lg", activeCategory?.id === cat.id ? "grayscale-0" : "grayscale opacity-50")}>{cat.icon_emoji}</span>
                    <span className="text-[13px] font-black tracking-tight">{cat.name}</span>
                  </div>
                  {activeCategory?.id === cat.id && <ChevronRight size={14} className="opacity-60" />}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleEditCategory(cat); }}
                  className="absolute right-10 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 bg-white shadow-sm rounded-lg text-atul-gray hover:text-atul-pink_primary transition-all z-10"
                >
                  <Edit3 size={12} />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* ── MAIN CONTENT: PRODUCTS ── */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#F8F9FA] custom-scrollbar">
          <div className="max-w-6xl mx-auto">
            {activeCategory && (
              <div className="mb-8 flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-black text-atul-charcoal tracking-tight font-heading">{activeCategory.name}</h2>
                  <p className="text-atul-gray/40 text-[11px] font-bold uppercase tracking-widest mt-1">Total {currentProducts.length} items in this category</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode='popLayout'>
                {currentProducts.map(product => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={product.id}
                    className="bg-white border border-gray-100 rounded-[2rem] p-6 group hover:shadow-xl hover:shadow-atul-gray/5 transition-all relative overflow-hidden flex flex-col h-full"
                  >
                    {/* Availabilty indicator bar */}
                    <div className={cn("absolute top-0 left-0 w-1 h-full", product.is_available ? "bg-emerald-500" : "bg-gray-300")} />
                    
                    <div className="flex justify-between items-start mb-5">
                      <div className={cn("size-12 rounded-xl flex items-center justify-center text-white shadow-sm", product.is_veg ? "bg-emerald-500" : "bg-rose-500")}>
                        <div className="size-2 rounded-full border-2 border-white" title={product.is_veg ? "Veg" : "Non-Veg"} />
                      </div>
                      <div className="flex gap-1.5">
                        <button 
                          onClick={() => handleEditProduct(product)}
                          className="size-9 bg-gray-50 text-atul-gray hover:bg-atul-pink_primary hover:text-white rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button className="size-9 bg-gray-50 text-atul-gray hover:bg-rose-50 rounded-xl flex items-center justify-center transition-all cursor-pointer opacity-40 hover:opacity-100">
                          <Trash size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1">
                      <h3 className="text-lg font-black text-atul-charcoal tracking-tight leading-tight mb-2">{product.name}</h3>
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-xl font-black professional-digits text-atul-charcoal">₹{parseFloat(product.base_price).toFixed(0)}</span>
                        <span className="text-[10px] font-bold text-atul-gray/30 uppercase">Base Price</span>
                      </div>

                      <div className="space-y-3">
                        {product.variants?.length > 0 && (
                          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                             <p className="text-[9px] font-black uppercase tracking-widest text-atul-gray/40 mb-2 flex items-center gap-1.5"><Layers size={10}/> Size Variants</p>
                             <div className="flex flex-wrap gap-1.5">
                                {product.variants.map(v => (
                                  <span key={v.id} className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-[10px] font-black text-atul-charcoal">
                                     {v.name} • ₹{(Number(product.base_price) + Number(v.price_delta)).toFixed(0)}
                                  </span>
                                ))}
                             </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-gray-50 flex items-center justify-between">
                       <span className={cn(
                         "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider",
                         product.is_available ? "text-emerald-500" : "text-gray-400"
                       )}>
                          {product.is_available ? <CheckCircle2 size={12}/> : <EyeOff size={12}/>}
                          {product.is_available ? "In Stock" : "Out of Stock"}
                       </span>
                       <span className="text-[9px] font-black text-atul-gray/30 bg-gray-50 px-2 py-1 rounded-lg">HSN: {product.hsn_code || '---'}</span>
                    </div>
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
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-atul-charcoal/40 backdrop-blur-sm">
            <motion.div initial={{scale:0.95, y:20}} animate={{scale:1, y:0}} exit={{scale:0.95, y:20}} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/50">
              <div className="px-8 pt-8 pb-6 border-b border-gray-50">
                <div className="flex justify-between items-center">
                   <div>
                     <h3 className="text-xl font-black text-atul-charcoal tracking-tight">{editingCategory ? "Update Category" : "New Category"}</h3>
                     <p className="text-atul-pink_primary text-[10px] font-black uppercase tracking-widest mt-1">Classification Master</p>
                   </div>
                   <button onClick={() => setIsCatModalOpen(false)} className="size-10 bg-gray-50 rounded-xl flex items-center justify-center text-atul-gray hover:text-atul-charcoal hover:bg-gray-100 transition-all cursor-pointer"><X size={18}/></button>
                </div>
              </div>
              <div className="p-8 space-y-6">
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40 mb-2 block">Category Name</label>
                    <input 
                      type="text" value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})}
                      placeholder="e.g. Loose Ice Cream"
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-atul-pink_primary/30 outline-none transition-all"
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40 mb-2 block">Icon Emoji</label>
                      <input 
                        type="text" value={catForm.icon_emoji} onChange={e => setCatForm({...catForm, icon_emoji: e.target.value})}
                        placeholder="🍦"
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xl focus:bg-white focus:border-atul-pink_primary/30 outline-none transition-all text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40 mb-2 block">Display Order</label>
                      <input 
                        type="number" value={catForm.display_order} onChange={e => setCatForm({...catForm, display_order: parseInt(e.target.value)})}
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-atul-pink_primary/30 outline-none transition-all"
                      />
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-gray-50 rounded-b-3xl border-t border-gray-100 flex gap-4">
                 <button onClick={() => setIsCatModalOpen(false)} className="flex-1 bg-white border border-gray-200 text-atul-gray py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all cursor-pointer">Cancel</button>
                 <button onClick={handleSaveCategory} className="flex-1 bg-atul-pink_primary text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-atul-pink_primary/20 hover:bg-atul-rose_deep transition-all cursor-pointer active:scale-95">Save Changes</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL: PRODUCT ── */}
      <AnimatePresence>
        {isProdModalOpen && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-atul-charcoal/40 backdrop-blur-sm">
            <motion.div initial={{scale:0.95, y:20}} animate={{scale:1, y:0}} exit={{scale:0.95, y:20}} className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-white/50">
              <div className="px-8 pt-8 pb-6 border-b border-gray-50 shrink-0">
                <div className="flex justify-between items-center">
                   <div>
                     <h3 className="text-xl font-black text-atul-charcoal tracking-tight">{editingProduct ? "Edit Product" : "New Master Entry"}</h3>
                     <p className="text-atul-pink_primary text-[10px] font-black uppercase tracking-widest mt-1">Detailed Item Specification</p>
                   </div>
                   <button onClick={() => setIsProdModalOpen(false)} className="size-10 bg-gray-50 rounded-xl flex items-center justify-center text-atul-gray hover:text-atul-charcoal hover:bg-gray-100 transition-all cursor-pointer"><X size={18}/></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-6">
                   <div className="col-span-2 md:col-span-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40 mb-2 block">Product Name</label>
                      <input 
                        type="text" value={prodForm.name} onChange={e => setProdForm({...prodForm, name: e.target.value})}
                        placeholder="e.g. Roasted Almond"
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-atul-pink_primary/30 outline-none transition-all"
                      />
                   </div>
                   <div className="col-span-2 md:col-span-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40 mb-2 block">Category</label>
                      <select 
                        value={prodForm.category} onChange={e => setProdForm({...prodForm, category: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-atul-pink_primary/30 outline-none transition-all appearance-none"
                      >
                         <option value="">Select Category</option>
                         {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                   </div>
                   <div className="col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40 mb-2 block">Description</label>
                      <textarea 
                        rows={2} value={prodForm.description} onChange={e => setProdForm({...prodForm, description: e.target.value})}
                        placeholder="Rich creamy ice cream with roasted almonds..."
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-atul-pink_primary/30 outline-none transition-all resize-none"
                      />
                   </div>
                </div>

                {/* Pricing & Tax */}
                <div className="p-6 bg-gray-50 rounded-3xl space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40 mb-2 block flex items-center gap-1.5"><IndianRupee size={10}/> Base Price</label>
                        <input 
                          type="number" value={prodForm.base_price} onChange={e => setProdForm({...prodForm, base_price: parseFloat(e.target.value)})}
                          className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-sm font-black professional-digits outline-none focus:ring-2 focus:ring-atul-pink_primary/10 transition-all font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40 mb-2 block">GST Rate (%)</label>
                        <input 
                          type="number" value={prodForm.tax_rate} onChange={e => setProdForm({...prodForm, tax_rate: parseFloat(e.target.value)})}
                          className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-sm font-black professional-digits outline-none focus:ring-2 focus:ring-atul-pink_primary/10 transition-all font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40 mb-2 block">HSN Code</label>
                        <input 
                          type="text" value={prodForm.hsn_code} onChange={e => setProdForm({...prodForm, hsn_code: e.target.value})}
                          placeholder="2105..."
                          className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-sm font-black professional-digits outline-none focus:ring-2 focus:ring-atul-pink_primary/10 transition-all font-mono"
                        />
                      </div>
                   </div>
                   
                   <div className="flex gap-8">
                      <div className="flex items-center gap-3">
                         <button 
                           onClick={() => setProdForm({...prodForm, is_veg: !prodForm.is_veg})}
                           className={cn(
                             "size-10 rounded-xl flex items-center justify-center border-2 transition-all",
                             prodForm.is_veg ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-rose-50 border-rose-200 text-rose-600"
                           )}
                         >
                            <div className="size-2 rounded-full border-2 border-current" />
                         </button>
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40">Food Type</p>
                            <p className="text-sm font-black">{prodForm.is_veg ? "Vegetarian" : "Non-Vegetarian"}</p>
                         </div>
                      </div>

                      <div className="flex items-center gap-3">
                         <button 
                           onClick={() => setProdForm({...prodForm, is_available: !prodForm.is_available})}
                           className={cn(
                             "size-10 rounded-xl flex items-center justify-center border-2 transition-all",
                             prodForm.is_available ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-gray-100 border-gray-200 text-gray-400"
                           )}
                         >
                            {prodForm.is_available ? <Check size={18}/> : <EyeOff size={16}/>}
                         </button>
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40">Market Status</p>
                            <p className="text-sm font-black">{prodForm.is_available ? "Active/Live" : "Inactive/Hidden"}</p>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Weights & Variants Section */}
                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                      <h4 className="text-sm font-black text-atul-charcoal tracking-widest uppercase flex items-center gap-2"><Scale size={16} className="text-atul-pink_primary"/> Weight & Size Variants</h4>
                      <button 
                        onClick={addVariantField}
                        className="text-[10px] font-black uppercase bg-white border border-gray-200 px-4 py-2 rounded-xl hover:bg-atul-pink_primary hover:text-white transition-all flex items-center gap-2"
                      >
                         <Plus size={12}/> Add Option
                      </button>
                   </div>

                   <div className="space-y-3">
                      {prodForm.variants.map((v, i) => (
                        <motion.div initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}} key={i} className="flex gap-4 items-end bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
                           <div className="flex-1">
                              <label className="text-[9px] font-black uppercase tracking-widest text-atul-gray/40 mb-1.5 block">Variant Name/Weight</label>
                              <input 
                                type="text" value={v.name} onChange={e => updateVariantField(i, 'name', e.target.value)}
                                placeholder="e.g. 250gm"
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-black outline-none focus:bg-white focus:border-atul-pink_primary/30 transition-all font-mono"
                              />
                           </div>
                           <div className="w-32">
                              <label className="text-[9px] font-black uppercase tracking-widest text-atul-gray/40 mb-1.5 block">Price Delta (+)</label>
                              <div className="relative">
                                 <IndianRupee size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-atul-gray/30"/>
                                 <input 
                                   type="number" value={v.price_delta} onChange={e => updateVariantField(i, 'price_delta', parseFloat(e.target.value))}
                                   className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 pl-7 text-xs font-black outline-none focus:bg-white focus:border-atul-pink_primary/30 transition-all font-mono"
                                 />
                              </div>
                           </div>
                           <div className="flex flex-col items-center gap-1">
                              <label className="text-[9px] font-black uppercase tracking-widest text-atul-gray/40 mb-1.5 block">Default</label>
                              <button 
                                onClick={() => updateVariantField(i, 'is_default', !v.is_default)}
                                className={cn(
                                  "size-10 rounded-xl border-2 transition-all flex items-center justify-center",
                                  v.is_default ? "bg-atul-pink_primary border-atul-pink_primary text-white" : "bg-white border-gray-100 text-gray-200"
                                )}
                              >
                                 <Check size={18}/>
                              </button>
                           </div>
                           <button 
                             onClick={() => removeVariantField(i)}
                             className="size-10 bg-rose-50 text-rose-300 hover:text-rose-500 hover:bg-rose-100 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                           >
                              <Trash size={16}/>
                           </button>
                        </motion.div>
                      ))}
                      
                      {prodForm.variants.length === 0 && (
                        <div className="py-10 border-2 border-dashed border-gray-100 rounded-3xl flex flex-col items-center justify-center text-atul-gray/20">
                           <Weight size={40} className="mb-3"/>
                           <p className="text-xs font-black uppercase tracking-widest">No variants defined</p>
                           <p className="text-[10px] font-medium mt-1">Add weights for stepped pricing</p>
                        </div>
                      )}
                   </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50 rounded-b-3xl border-t border-gray-100 flex gap-4 shrink-0">
                 <button onClick={() => setIsProdModalOpen(false)} className="px-8 bg-white border border-gray-200 text-atul-gray py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all cursor-pointer">Discard</button>
                 <button onClick={handleSaveProduct} className="flex-1 bg-atul-charcoal text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-black transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-3">
                    <Save size={18}/> Confirm & Save Product
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
