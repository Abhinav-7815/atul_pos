import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Truck, Plus, Search, X, Calendar, Tag, DollarSign,
  User, Mail, Phone, MapPin, Download, CheckCircle2, Clock,
  AlertCircle, Edit2, Trash2, Package, ChevronRight, FileText
} from 'lucide-react';
import { inventoryApi, menuApi } from '../services/api';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const STATUS_META = {
  draft:      { color: 'bg-gray-100 text-gray-500',    icon: <Clock size={14}/> },
  ordered:    { color: 'bg-blue-100 text-blue-600',    icon: <Truck size={14}/> },
  received:   { color: 'bg-emerald-100 text-emerald-600', icon: <CheckCircle2 size={14}/> },
  cancelled:  { color: 'bg-red-100 text-red-500',      icon: <X size={14}/> },
};

export default function Procurement({ user }) {
  const [tab, setTab]                        = useState('pos');
  const [purchaseOrders, setPurchaseOrders]  = useState([]);
  const [suppliers, setSuppliers]            = useState([]);
  const [products, setProducts]              = useState([]);
  const [lowStockItems, setLowStockItems]    = useState([]);
  const [loading, setLoading]                = useState(true);
  const [searchTerm, setSearchTerm]          = useState('');

  // Modals
  const [supplierModal, setSupplierModal]    = useState(false);
  const [editSupplierModal, setEditSupplierModal] = useState(false);
  const [poModal, setPOModal]                = useState(false);
  const [detailPO, setDetailPO]              = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [toast, setToast]                    = useState(null);

  // Forms
  const [supplierForm, setSupplierForm]      = useState({ name: '', contact_person: '', phone: '', email: '', address: '', gstin: '' });
  const [poForm, setPOForm]                  = useState({ supplier: '', outlet: user?.outlet, items: [], notes: '' });
  const [poItems, setPOItems]                = useState([{ product: '', variant: '', quantity: '', unit_cost: '' }]);

  useEffect(() => { fetchData(); }, [tab, user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [poRes, supRes, prodRes, stockRes] = await Promise.all([
        inventoryApi.getPurchaseOrders({ outlet: user?.outlet }),
        inventoryApi.getSuppliers(),
        menuApi.getProducts({ limit: 500 }),
        inventoryApi.getStocks({ outlet: user?.outlet, status: 'LOW_STOCK' }),
      ]);
      setPurchaseOrders(Array.isArray(poRes.data?.data || poRes.data?.results || poRes.data) ? (poRes.data?.data || poRes.data?.results || poRes.data) : []);
      setSuppliers(Array.isArray(supRes.data?.data || supRes.data?.results || supRes.data) ? (supRes.data?.data || supRes.data?.results || supRes.data) : []);
      setProducts(Array.isArray(prodRes.data?.data || prodRes.data?.results || prodRes.data) ? (prodRes.data?.data || prodRes.data?.results || prodRes.data) : []);
      setLowStockItems(Array.isArray(stockRes.data?.data || stockRes.data?.results || stockRes.data) ? (stockRes.data?.data || stockRes.data?.results || stockRes.data) : []);
    } catch (err) {
      console.error('Procurement fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Suppliers CRUD ─────────────────────────────────────────────────────────
  const handleCreateSupplier = async () => {
    if (!supplierForm.name) return;
    try {
      await inventoryApi.createSupplier(supplierForm);
      setSupplierModal(false);
      setSupplierForm({ name: '', contact_person: '', phone: '', email: '', address: '', gstin: '' });
      showToast('Supplier registered successfully');
      fetchData();
    } catch (err) { showToast('Failed to register supplier', 'error'); }
  };

  const handleUpdateSupplier = async () => {
    try {
      await inventoryApi.updateSupplier(selectedSupplier.id, supplierForm);
      setEditSupplierModal(false);
      showToast('Supplier updated');
      fetchData();
    } catch (err) { showToast('Update failed', 'error'); }
  };

  const handleDeleteSupplier = async (id) => {
    if (!window.confirm('Delete this supplier?')) return;
    try {
      await inventoryApi.deleteSupplier(id);
      showToast('Supplier removed');
      fetchData();
    } catch (err) { showToast('Delete failed', 'error'); }
  };

  // ── Purchase Orders CRUD ───────────────────────────────────────────────────
  const handleCreatePO = async () => {
    if (!poForm.supplier || !poItems.some(i => i.product && i.quantity && i.unit_cost)) return;
    try {
      const validItems = poItems.filter(i => i.product && i.quantity && i.unit_cost).map(i => ({
        product: i.product,
        variant: i.variant || null,
        quantity: parseFloat(i.quantity),
        unit_cost: parseFloat(i.unit_cost),
        subtotal: parseFloat(i.quantity) * parseFloat(i.unit_cost),
      }));
      const total = validItems.reduce((sum, i) => sum + i.subtotal, 0);
      await inventoryApi.createPurchaseOrder({
        supplier: poForm.supplier,
        outlet: user.outlet,
        notes: poForm.notes,
        total_amount: total,
        items: validItems,
        status: 'ordered',
      });
      setPOModal(false);
      setPOItems([{ product: '', variant: '', quantity: '', unit_cost: '' }]);
      setPOForm(f => ({ ...f, supplier: '', notes: '' }));
      showToast('Purchase Order created');
      fetchData();
    } catch (err) { showToast('PO creation failed', 'error'); }
  };

  const handleDeletePO = async (id) => {
    if (!window.confirm('Cancel and delete this PO?')) return;
    try {
      await inventoryApi.deletePurchaseOrder(id);
      setDetailPO(null);
      showToast('PO deleted');
      fetchData();
    } catch (err) { showToast('Delete failed', 'error'); }
  };

  const handleReceivePO = async (id) => {
    try {
      await inventoryApi.receivePurchaseOrder(id);
      setDetailPO(null);
      showToast('Goods received — stock updated!');
      fetchData();
    } catch (err) { showToast('Receive failed', 'error'); }
  };

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filteredPOs = purchaseOrders.filter(po =>
    (po.po_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (po.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredSuppliers = suppliers.filter(s =>
    (s.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 p-6 h-screen overflow-hidden flex flex-col text-atul-charcoal bg-[#FDF3F6]">

      {/* Header */}
      <header className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-atul-charcoal flex items-center justify-center text-white shadow-lg">
            <Truck size={22} />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-black italic leading-none">Procurement</h2>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-atul-charcoal/30 mt-1">Supply Chain & Vendor Management</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-white rounded-2xl p-0.5 gap-0.5">
            {[{ id: 'pos', label: 'Purchase Orders' }, { id: 'suppliers', label: 'Suppliers' }].map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setSearchTerm(''); }}
                className={cn('px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all', tab === t.id ? 'bg-atul-charcoal text-white shadow-md' : 'text-atul-charcoal/30 hover:text-atul-charcoal')}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-atul-charcoal/20" size={13} />
            <input type="text" placeholder={`Search ${tab === 'pos' ? 'orders' : 'suppliers'}...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 bg-white border border-white rounded-xl text-xs font-bold w-44 outline-none" />
          </div>

          <button onClick={() => tab === 'pos' ? setPOModal(true) : setSupplierModal(true)}
            className="flex items-center gap-1.5 bg-atul-charcoal text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 transition-all">
            <Plus size={13}/> {tab === 'pos' ? 'New PO' : 'Add Supplier'}
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-5 shrink-0">
        {[
          { label: 'Total POs',       value: purchaseOrders.length,                                               color: 'from-blue-500 to-blue-400',    icon: <FileText size={16}/> },
          { label: 'Active Orders',   value: purchaseOrders.filter(p => p.status === 'ordered').length,           color: 'from-amber-500 to-amber-400',  icon: <Clock size={16}/> },
          { label: 'Received',        value: purchaseOrders.filter(p => p.status === 'received').length,          color: 'from-emerald-500 to-emerald-400', icon: <CheckCircle2 size={16}/> },
          { label: 'Low Stock Items', value: lowStockItems.length,                                                 color: 'from-red-500 to-red-400',      icon: <AlertCircle size={16}/> },
        ].map((s, i) => (
          <div key={i} className="bg-white/60 border border-white rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all group">
            <div className={cn('size-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-br shadow-md group-hover:rotate-12 transition-transform', s.color)}>{s.icon}</div>
            <div>
              <p className="text-[8px] font-black text-atul-charcoal/30 uppercase tracking-widest">{s.label}</p>
              <p className="text-xl font-black professional-digits">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main 2-col layout */}
      <div className="flex-1 flex gap-5 min-h-0 overflow-hidden">

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {tab === 'pos' ? (
            <div className="space-y-3 pb-8">
              {(loading ? [] : filteredPOs).map(po => {
                const meta = STATUS_META[po.status] || STATUS_META.draft;
                return (
                  <button key={po.id} onClick={() => setDetailPO(po)}
                    className="w-full bg-white border border-atul-pink_primary/5 rounded-2xl p-5 flex items-center justify-between hover:shadow-lg hover:shadow-atul-charcoal/5 transition-all text-left group">
                    <div className="flex items-center gap-4">
                      <div className={cn('size-11 rounded-xl flex items-center justify-center shadow-sm', meta.color)}>{meta.icon}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm">{po.po_number}</span>
                          <span className={cn('px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest', meta.color)}>{po.status}</span>
                        </div>
                        <p className="text-[10px] text-atul-charcoal/30 font-bold mt-1 flex items-center gap-1.5">
                          <User size={9}/> {po.supplier_name || '—'}
                          <span className="mx-1 opacity-30">•</span>
                          <Calendar size={9}/> {new Date(po.order_date || po.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-black text-lg professional-digits">₹{Number(po.total_amount).toLocaleString()}</p>
                        <p className="text-[9px] text-atul-charcoal/20 font-bold uppercase">Grand Total</p>
                      </div>
                      {po.status === 'draft' && (
                        <button onClick={e => { e.stopPropagation(); handleDeletePO(po.id); }} className="size-8 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 size={14}/>
                        </button>
                      )}
                      <ChevronRight size={16} className="text-atul-charcoal/20 group-hover:text-atul-charcoal/60 group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>
                );
              })}
              {!loading && filteredPOs.length === 0 && (
                <div className="py-24 text-center opacity-20 flex flex-col items-center gap-3">
                  <Truck size={48}/><p className="font-serif italic text-lg">No purchase orders yet</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 pb-8">
              {filteredSuppliers.map(s => (
                <div key={s.id} className="bg-white border border-atul-pink_primary/5 rounded-2xl p-6 flex items-start gap-4 group hover:shadow-md transition-all">
                  <div className="size-12 rounded-xl bg-atul-charcoal/10 flex items-center justify-center text-atul-charcoal font-black text-lg shrink-0">
                    {s.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-sm truncate">{s.name}</h4>
                    <p className="text-[10px] text-atul-charcoal/40 font-bold mb-3">{s.contact_person || '—'}</p>
                    <div className="space-y-1 opacity-50">
                      <p className="flex items-center gap-1.5 text-[10px] font-bold"><Phone size={10}/>{s.phone || '—'}</p>
                      <p className="flex items-center gap-1.5 text-[10px] font-bold truncate"><Mail size={10}/>{s.email || '—'}</p>
                      {s.gstin && <p className="flex items-center gap-1.5 text-[10px] font-bold"><Tag size={10}/>GSTIN: {s.gstin}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => { setSelectedSupplier(s); setSupplierForm(s); setEditSupplierModal(true); }} className="size-7 rounded-lg bg-gray-50 hover:bg-atul-charcoal text-atul-charcoal/30 hover:text-white flex items-center justify-center transition-all"><Edit2 size={12}/></button>
                    <button onClick={() => handleDeleteSupplier(s.id)} className="size-7 rounded-lg bg-red-50 hover:bg-red-500 text-red-400 hover:text-white flex items-center justify-center transition-all"><Trash2 size={12}/></button>
                  </div>
                </div>
              ))}
              {!loading && filteredSuppliers.length === 0 && (
                <div className="col-span-2 py-24 text-center opacity-20 flex flex-col items-center gap-3">
                  <User size={48}/><p className="font-serif italic text-lg">No suppliers registered</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: Low Stock Panel */}
        <div className="w-[260px] shrink-0 flex flex-col gap-4">
          <div className="bg-white border border-atul-pink_primary/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle size={16} className="text-red-500"/>
              <h5 className="text-[10px] font-black uppercase tracking-widest text-atul-charcoal">Live Low Stock</h5>
            </div>
            {lowStockItems.length === 0 ? (
              <div className="py-6 text-center opacity-20">
                <CheckCircle2 size={28} className="mx-auto mb-2"/>
                <p className="text-[10px] font-bold">All items well stocked</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {lowStockItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 bg-red-50 rounded-xl border border-red-100">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-red-700 truncate">{item.product_name}</p>
                      <p className="text-[9px] text-red-400 font-bold">{Number(item.quantity).toFixed(1)}kg left</p>
                    </div>
                    <button onClick={() => { setPOModal(true); }} className="text-red-400 hover:text-red-600 transition-colors ml-2 shrink-0">
                      <Plus size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-atul-charcoal rounded-2xl p-5 text-white">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-3">Quick Stats</p>
            <div className="space-y-3">
              {[
                { label: 'Active POs Value', value: `₹${purchaseOrders.filter(p => p.status === 'ordered').reduce((s, p) => s + Number(p.total_amount), 0).toLocaleString()}` },
                { label: 'Suppliers on record', value: suppliers.length },
                { label: 'Items needing restock', value: lowStockItems.length },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="text-[9px] font-bold opacity-40 uppercase tracking-wider">{s.label}</span>
                  <span className="text-sm font-black professional-digits">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────── MODALS ─────────────── */}

      {/* PO Detail */}
      <AnimatePresence>
        {detailPO && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="p-7 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-xl bg-atul-charcoal text-white flex items-center justify-center"><FileText size={22}/></div>
                  <div>
                    <h3 className="font-serif text-xl font-black italic">{detailPO.po_number}</h3>
                    <p className="text-[10px] text-atul-charcoal/40 font-bold">Supplier: {detailPO.supplier_name}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(detailPO.status === 'draft' || detailPO.status === 'ordered') && (
                    <button onClick={() => handleDeletePO(detailPO.id)} className="px-4 py-2 bg-red-50 text-red-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all">Delete</button>
                  )}
                  <button onClick={() => setDetailPO(null)} className="size-10 rounded-full hover:bg-gray-100 flex items-center justify-center"><X size={20}/></button>
                </div>
              </div>

              <div className="p-7 flex-1 overflow-y-auto custom-scrollbar space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Status', value: <span className={cn('px-2 py-1 rounded-lg text-[9px] font-black uppercase', STATUS_META[detailPO.status]?.color)}>{detailPO.status}</span> },
                    { label: 'Order Date', value: new Date(detailPO.order_date || detailPO.created_at).toLocaleDateString() },
                    { label: 'Grand Total', value: `₹${Number(detailPO.total_amount).toLocaleString()}` },
                  ].map((f, i) => (
                    <div key={i} className="bg-gray-50 p-4 rounded-2xl">
                      <p className="text-[9px] font-black text-atul-charcoal/30 uppercase tracking-widest mb-1">{f.label}</p>
                      <p className="font-black text-sm">{f.value}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-atul-charcoal/30 mb-3">Order Items</h4>
                  <div className="space-y-2">
                    {detailPO.items?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-xl bg-atul-pink_soft text-atul-pink_primary flex items-center justify-center font-black text-sm">{item.quantity}</div>
                          <div>
                            <p className="font-black text-sm">{item.product_name}</p>
                            {item.variant_name && <p className="text-[10px] text-atul-charcoal/30">{item.variant_name}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black professional-digits">₹{Number(item.subtotal).toLocaleString()}</p>
                          <p className="text-[9px] text-atul-charcoal/30 font-bold">@ ₹{item.unit_cost}/unit</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {detailPO.notes && <div className="bg-gray-50 rounded-2xl p-4"><p className="text-[9px] font-black text-atul-charcoal/30 uppercase tracking-widest mb-1">Notes</p><p className="text-sm font-bold">{detailPO.notes}</p></div>}
              </div>

              <div className="p-7 bg-gray-50 flex gap-4 items-center justify-between">
                <p className="text-xl font-black professional-digits">₹{Number(detailPO.total_amount).toLocaleString()}</p>
                <div className="flex gap-3">
                  {(detailPO.status === 'ordered' || detailPO.status === 'draft') && (
                    <button onClick={() => handleReceivePO(detailPO.id)}
                      className="px-7 py-3.5 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-105 transition-all flex items-center gap-2">
                      <CheckCircle2 size={16}/> Receive Goods
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create PO Modal */}
      <AnimatePresence>
        {poModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-7 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-serif text-xl font-black italic">New Purchase Order</h3>
                <button onClick={() => setPOModal(false)} className="size-10 rounded-full hover:bg-gray-100 flex items-center justify-center"><X size={20}/></button>
              </div>

              <div className="p-7 flex-1 overflow-y-auto custom-scrollbar space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-atul-charcoal/30 uppercase tracking-widest px-1">Supplier *</label>
                    <select value={poForm.supplier} onChange={e => setPOForm(f => ({ ...f, supplier: e.target.value }))} className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none">
                      <option value="">Select supplier...</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-atul-charcoal/30 uppercase tracking-widest px-1">Notes</label>
                    <input type="text" value={poForm.notes} onChange={e => setPOForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[9px] font-black text-atul-charcoal/30 uppercase tracking-widest">Order Items</label>
                    <button onClick={() => setPOItems(i => [...i, { product: '', variant: '', quantity: '', unit_cost: '' }])} className="text-[9px] font-black text-atul-pink_primary uppercase tracking-widest flex items-center gap-1">
                      <Plus size={12}/> Add Row
                    </button>
                  </div>
                  <div className="space-y-3">
                    {poItems.map((item, idx) => (
                      <div key={idx} className="flex gap-3 items-center">
                        <select value={item.product} onChange={e => setPOItems(pi => pi.map((p, i) => i === idx ? { ...p, product: e.target.value } : p))} className="flex-[2] bg-gray-50 border-none rounded-2xl p-3 text-xs font-bold outline-none">
                          <option value="">Product...</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input type="number" placeholder="Qty" value={item.quantity} onChange={e => setPOItems(pi => pi.map((p, i) => i === idx ? { ...p, quantity: e.target.value } : p))} className="flex-1 bg-gray-50 border-none rounded-2xl p-3 text-xs font-black professional-digits outline-none" />
                        <input type="number" placeholder="Unit Cost" value={item.unit_cost} onChange={e => setPOItems(pi => pi.map((p, i) => i === idx ? { ...p, unit_cost: e.target.value } : p))} className="flex-1 bg-gray-50 border-none rounded-2xl p-3 text-xs font-black professional-digits outline-none" />
                        <div className="text-sm font-black professional-digits text-atul-charcoal/40 w-16 text-right">
                          {item.quantity && item.unit_cost ? `₹${(parseFloat(item.quantity) * parseFloat(item.unit_cost)).toFixed(0)}` : '—'}
                        </div>
                        {poItems.length > 1 && (
                          <button onClick={() => setPOItems(pi => pi.filter((_, i) => i !== idx))} className="text-atul-charcoal/10 hover:text-red-400 transition-colors"><X size={16}/></button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                    <span className="font-black text-lg professional-digits">
                      Total: ₹{poItems.filter(i => i.quantity && i.unit_cost).reduce((s, i) => s + parseFloat(i.quantity) * parseFloat(i.unit_cost), 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-7 border-t border-gray-100 flex gap-3">
                <button onClick={() => setPOModal(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button>
                <button onClick={handleCreatePO} className="flex-[2] py-4 bg-atul-charcoal text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-atul-charcoal/30 hover:scale-[1.02] transition-all">Create Purchase Order</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Supplier Modal (Create) */}
      <AnimatePresence>
        {supplierModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="p-7 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-serif text-xl font-black italic">New Supplier</h3>
                <button onClick={() => setSupplierModal(false)} className="size-10 rounded-full hover:bg-gray-100 flex items-center justify-center"><X size={20}/></button>
              </div>
              <SupplierForm form={supplierForm} setForm={setSupplierForm} />
              <div className="p-7 border-t border-gray-100 flex gap-3">
                <button onClick={() => setSupplierModal(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button>
                <button onClick={handleCreateSupplier} className="flex-[2] py-4 bg-atul-charcoal text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-atul-charcoal/30">Register Supplier</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Supplier Modal (Edit) */}
      <AnimatePresence>
        {editSupplierModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="p-7 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-serif text-xl font-black italic">Edit Supplier</h3>
                <button onClick={() => setEditSupplierModal(false)} className="size-10 rounded-full hover:bg-gray-100 flex items-center justify-center"><X size={20}/></button>
              </div>
              <SupplierForm form={supplierForm} setForm={setSupplierForm} />
              <div className="p-7 border-t border-gray-100 flex gap-3">
                <button onClick={() => setEditSupplierModal(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button>
                <button onClick={handleUpdateSupplier} className="flex-[2] py-4 bg-atul-charcoal text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Save Changes</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className={cn('fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl z-[200] flex items-center gap-3', toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-atul-charcoal text-white')}>
            {toast.type === 'error' ? <X size={16}/> : <CheckCircle2 size={16}/>} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SupplierForm({ form, setForm }) {
  const fields = [
    { key: 'name', label: 'Company Name', placeholder: 'e.g. Dairy Fresh Central', col: 2 },
    { key: 'contact_person', label: 'Contact Person', placeholder: 'Full name' },
    { key: 'phone', label: 'Phone', placeholder: '+91 XXXXX XXXXX' },
    { key: 'email', label: 'Email', placeholder: 'vendor@example.com', type: 'email' },
    { key: 'gstin', label: 'GSTIN (optional)', placeholder: '22AAAAA0000A1Z5' },
    { key: 'address', label: 'Address', placeholder: 'Company address', col: 2 },
  ];
  return (
    <div className="p-7 grid grid-cols-2 gap-4">
      {fields.map(f => (
        <div key={f.key} className={cn('space-y-2', f.col === 2 && 'col-span-2')}>
          <label className="text-[9px] font-black text-atul-charcoal/30 uppercase tracking-widest px-1">{f.label}</label>
          <input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-sm font-bold outline-none" />
        </div>
      ))}
    </div>
  );
}
