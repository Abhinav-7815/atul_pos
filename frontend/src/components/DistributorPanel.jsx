/**
 * DistributorPanel.jsx  —  Distributor's own ordering & stock panel
 *
 * Sub-tabs (controlled by activeSubTab prop from App.jsx):
 *  distributor_dashboard  — stats + recent orders
 *  distributor_orders     — new order builder OR order list
 *  distributor_myorders   — my orders list with status & actions
 *  distributor_stock      — current inventory (read-only)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Package, Truck, CheckCircle, Clock,
  Plus, Minus, X, RefreshCw, AlertCircle, Send,
  TrendingUp, CreditCard, ArrowRight, Search,
  Boxes, ChevronDown,
} from 'lucide-react';
import { distributionApi, menuApi, inventoryApi } from '../services/api';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...i) => twMerge(clsx(i));

const STATUS_META = {
  draft:       { label: 'Draft',       color: 'bg-gray-100 text-gray-500' },
  submitted:   { label: 'Submitted',   color: 'bg-amber-50 text-amber-600' },
  approved:    { label: 'Approved',    color: 'bg-blue-50 text-blue-600' },
  processing:  { label: 'Processing',  color: 'bg-purple-50 text-purple-600' },
  dispatched:  { label: 'Dispatched',  color: 'bg-indigo-50 text-indigo-600' },
  delivered:   { label: 'Delivered',   color: 'bg-emerald-50 text-emerald-600' },
  cancelled:   { label: 'Cancelled',   color: 'bg-red-50 text-red-400' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide', m.color)}>
      {m.label}
    </span>
  );
}

const fmt = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0 }).format(Number(n) || 0);

// ── Main Component ─────────────────────────────────────────────────────────

export default function DistributorPanel({ user, activeSubTab, onTabChange }) {
  const discountPct = user?.distributor_discount_pct || 0;

  // ── Shared state ────────────────────────────────────────────────────
  const [stats, setStats]     = useState(null);
  const [orders, setOrders]   = useState([]);
  const [stocks, setStocks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // ── New Order state ──────────────────────────────────────────────────
  const [products, setProducts]         = useState([]);
  const [categories, setCategories]     = useState([]);
  const [selectedCat, setSelectedCat]   = useState(null);
  const [searchQ, setSearchQ]           = useState('');
  const [cart, setCart]                 = useState([]); // [{ product, qty }]
  const [orderNotes, setOrderNotes]     = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [drafting, setDrafting]         = useState(false);

  // ── My orders state ───────────────────────────────────────────────────
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // ── Notification ──────────────────────────────────────────────────────
  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // ── Data loading ──────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, ordersRes, stockRes] = await Promise.all([
        distributionApi.getDashboard(),
        distributionApi.getOrders(),
        inventoryApi.getStocks({ outlet_id: user?.outlet_id }),
      ]);
      setStats(dashRes.data?.data || dashRes.data);
      setOrders(ordersRes.data?.data || ordersRes.data || []);
      setStocks(stockRes.data?.data || stockRes.data || []);
    } catch (e) {
      console.error('Distributor panel load error', e);
    } finally {
      setLoading(false);
    }
  }, [user?.outlet_id]);

  const loadProducts = useCallback(async () => {
    try {
      const [catRes] = await Promise.all([menuApi.getCategories()]);
      const cats = catRes.data?.data || catRes.data || [];
      setCategories(cats);
      if (cats.length > 0 && !selectedCat) setSelectedCat(cats[0].id);
    } catch (e) {
      console.error('Product load error', e);
    }
  }, [selectedCat]);

  useEffect(() => { loadDashboard(); loadProducts(); }, [loadDashboard]);

  useEffect(() => {
    if (!selectedCat) return;
    menuApi.getProducts({ category: selectedCat }).then(res => {
      setProducts(res.data?.data || res.data || []);
    });
  }, [selectedCat]);

  // ── Cart helpers ──────────────────────────────────────────────────────
  const discountedPrice = (price) =>
    Number(price) * (1 - Number(discountPct) / 100);

  const cartQty = (productId) =>
    cart.find(c => c.product.id === productId)?.qty || 0;

  const adjustCart = (product, delta) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (!existing) {
        if (delta <= 0) return prev;
        return [...prev, { product, qty: delta }];
      }
      const newQty = existing.qty + delta;
      if (newQty <= 0) return prev.filter(c => c.product.id !== product.id);
      return prev.map(c => c.product.id === product.id ? { ...c, qty: newQty } : c);
    });
  };

  const setCartQty = (productId, qty) => {
    const n = Number(qty);
    if (isNaN(n) || n < 0) return;
    setCart(prev => {
      if (n === 0) return prev.filter(c => c.product.id !== productId);
      return prev.map(c => c.product.id === productId ? { ...c, qty: n } : c);
    });
  };

  const cartTotal = cart.reduce((s, c) => s + discountedPrice(c.product.base_price) * c.qty, 0);
  const cartOriginal = cart.reduce((s, c) => s + Number(c.product.base_price) * c.qty, 0);

  const filteredProducts = searchQ
    ? products.filter(p => p.name.toLowerCase().includes(searchQ.toLowerCase()))
    : products;

  // ── Order submission ───────────────────────────────────────────────────
  const buildOrderPayload = () => ({
    notes: orderNotes,
    items: cart.map(c => ({
      product_id: c.product.id,
      quantity:   c.qty,
      unit_price: discountedPrice(c.product.base_price).toFixed(2),
    })),
  });

  const handleSaveDraft = async () => {
    if (cart.length === 0) return notify('Add at least one item.', 'error');
    setDrafting(true);
    try {
      await distributionApi.createOrder(buildOrderPayload());
      notify('Draft saved successfully.');
      setCart([]);
      setOrderNotes('');
      loadDashboard();
    } catch (e) {
      notify('Failed to save draft.', 'error');
    } finally {
      setDrafting(false);
    }
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return notify('Add at least one item.', 'error');
    setSubmitting(true);
    try {
      const createRes = await distributionApi.createOrder(buildOrderPayload());
      const newOrder  = createRes.data?.data || createRes.data;
      await distributionApi.submitOrder(newOrder.id);
      notify('Order submitted to main branch!');
      setCart([]);
      setOrderNotes('');
      loadDashboard();
      onTabChange?.('distributor_myorders');
    } catch (e) {
      notify('Submission failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── My Orders actions ─────────────────────────────────────────────────
  const handleReceive = async (orderId) => {
    setActionLoading(orderId);
    try {
      const res = await distributionApi.receiveOrder(orderId);
      const updated = res.data?.data || res.data;
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
      notify('Stock received and added to your inventory!');
      loadDashboard();
    } catch (e) {
      notify('Failed to confirm receipt.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (orderId) => {
    setActionLoading(orderId);
    try {
      const res = await distributionApi.cancelOrder(orderId);
      const updated = res.data?.data || res.data;
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
      notify('Order cancelled.');
    } catch (e) {
      notify('Cannot cancel this order.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  //  RENDERS
  // ─────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 opacity-30">
        <RefreshCw className="animate-spin size-8" />
        <span className="text-sm font-bold uppercase tracking-widest">Loading…</span>
      </div>
    </div>
  );

  const s = stats?.stats || {};

  return (
    <div className="flex-1 p-8 h-screen overflow-hidden flex flex-col text-atul-charcoal relative">

      {/* Notification toast */}
      <AnimatePresence>
        {notification && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={cn('fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl text-sm font-bold shadow-xl flex items-center gap-2',
              notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white')}>
            {notification.type === 'error' ? <AlertCircle size={16}/> : <CheckCircle size={16}/>}
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h2 className="font-serif text-3xl font-bold flex items-center gap-3">
            <div className="size-10 bg-atul-pink_primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-atul-pink_primary/30">
              <Truck size={20}/>
            </div>
            {user?.outlet_name || 'Distributor Panel'}
          </h2>
          <p className="text-atul-pink_primary/50 text-sm mt-1 ml-14">
            Distributor Portal &bull; {discountPct}% distributor discount
          </p>
        </div>
        <button onClick={loadDashboard} className="size-9 rounded-xl bg-white border border-gray-100 text-atul-gray hover:text-atul-pink_primary hover:border-atul-pink_primary/30 transition-all flex items-center justify-center shadow-sm">
          <RefreshCw size={15}/>
        </button>
      </header>

      {/* Tab quick nav */}
      <div className="flex gap-1 mb-6 shrink-0">
        {[
          { id: 'distributor_dashboard', label: 'Dashboard',  icon: <TrendingUp size={14}/> },
          { id: 'distributor_orders',    label: 'New Order',  icon: <ShoppingCart size={14}/> },
          { id: 'distributor_myorders',  label: 'My Orders',  icon: <Package size={14}/> },
          { id: 'distributor_stock',     label: 'My Stock',   icon: <Boxes size={14}/> },
        ].map(t => (
          <button key={t.id} onClick={() => onTabChange?.(t.id)}
            className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[12px] font-bold transition-all',
              activeSubTab === t.id
                ? 'bg-atul-pink_primary text-white shadow-md shadow-atul-pink_primary/20'
                : 'text-atul-gray/60 hover:text-atul-charcoal hover:bg-white/50')}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* ── DASHBOARD ── */}
        {activeSubTab === 'distributor_dashboard' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[
                { icon: <Clock size={20}/>,        label: 'Open Orders',           value: s.open_orders ?? 0,           accent: true },
                { icon: <Truck size={20}/>,         label: 'In Transit',            value: s.in_transit ?? 0 },
                { icon: <CheckCircle size={20}/>,   label: 'Delivered This Month',  value: s.delivered_this_month ?? 0 },
                { icon: <TrendingUp size={20}/>,    label: 'Monthly Value',         value: `₹${fmt(s.monthly_value ?? 0)}` },
              ].map(({ icon, label, value, accent }) => (
                <div key={label} className={cn('glass rounded-[2rem] p-5 flex items-start gap-4 border', accent ? 'border-atul-pink_primary/15' : 'border-white/70')}>
                  <div className={cn('size-11 rounded-2xl flex items-center justify-center shrink-0 text-white', accent ? 'bg-atul-pink_primary shadow-lg shadow-atul-pink_primary/30' : 'bg-atul-charcoal/80')}>
                    {icon}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-atul-gray/50">{label}</p>
                    <p className="text-2xl font-black text-atul-charcoal mt-0.5 professional-digits">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Credit bar */}
            <div className="glass rounded-[2rem] p-5 border border-white/60">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-atul-pink_primary"/>
                  <span className="text-sm font-bold">Credit Utilisation</span>
                </div>
                <span className="text-sm font-black professional-digits">
                  ₹{fmt(s.outstanding_amount ?? 0)} <span className="text-atul-gray/40 font-semibold">/ ₹{fmt(s.credit_limit ?? 0)}</span>
                </span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, ((s.outstanding_amount || 0) / (s.credit_limit || 1)) * 100)}%` }}
                  className={cn('h-full rounded-full transition-all',
                    ((s.outstanding_amount || 0) / (s.credit_limit || 1)) > 0.8 ? 'bg-red-400' : 'bg-atul-pink_primary'
                  )}
                />
              </div>
            </div>

            {/* Recent orders mini-list */}
            <div className="glass rounded-[2rem] border border-white/60 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
                <h3 className="font-bold text-sm">Recent Orders</h3>
                <button onClick={() => onTabChange?.('distributor_myorders')}
                  className="text-[11px] font-black text-atul-pink_primary flex items-center gap-1 hover:underline">
                  View All <ArrowRight size={12}/>
                </button>
              </div>
              {(stats?.recent_orders || []).slice(0, 5).map(o => (
                <div key={o.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-white/40 transition-colors">
                  <div>
                    <span className="text-[12px] font-bold text-atul-charcoal">{o.order_number}</span>
                    <span className="ml-2"><StatusBadge status={o.status}/></span>
                  </div>
                  <span className="text-[12px] font-black professional-digits">₹{fmt(o.total_amount)}</span>
                </div>
              ))}
            </div>

            {/* Place new order CTA */}
            <button onClick={() => onTabChange?.('distributor_orders')}
              className="w-full glass rounded-[2rem] p-6 border-2 border-dashed border-atul-pink_primary/20 flex items-center justify-center gap-3 hover:border-atul-pink_primary/40 hover:bg-atul-pink_primary/5 transition-all group">
              <div className="size-10 rounded-2xl bg-atul-pink_primary/10 group-hover:bg-atul-pink_primary group-hover:text-white text-atul-pink_primary flex items-center justify-center transition-all">
                <ShoppingCart size={18}/>
              </div>
              <div className="text-left">
                <p className="font-black text-sm text-atul-charcoal">Place a New Order</p>
                <p className="text-[11px] text-atul-gray/50">Browse products with your {discountPct}% distributor discount</p>
              </div>
              <ArrowRight size={18} className="ml-auto text-atul-pink_primary/30 group-hover:translate-x-1 transition-transform"/>
            </button>
          </motion.div>
        )}

        {/* ── NEW ORDER BUILDER ── */}
        {activeSubTab === 'distributor_orders' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-6 h-full">

            {/* Left — Product browser */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Category pills */}
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-3 mb-3 shrink-0">
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                    className={cn('flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all',
                      selectedCat === cat.id ? 'bg-atul-pink_primary text-white shadow-md shadow-atul-pink_primary/20' : 'bg-white text-atul-gray/50 hover:text-atul-pink_primary')}>
                    {cat.icon_emoji} {cat.name}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative mb-3 shrink-0">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-atul-gray/30"/>
                <input type="text" placeholder="Search products…" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  className="w-full bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium border border-gray-100 outline-none focus:border-atul-pink_primary/30 transition-colors"/>
              </div>

              {/* Product grid */}
              <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start pb-4">
                {filteredProducts.map(p => {
                  const inCart = cartQty(p.id);
                  const dPrice = discountedPrice(p.base_price);
                  return (
                    <div key={p.id} className={cn('bg-white rounded-2xl border overflow-hidden transition-all',
                      inCart > 0 ? 'border-atul-pink_primary/40 shadow-md shadow-atul-pink_primary/10' : 'border-gray-100 hover:border-atul-pink_primary/20 hover:shadow-sm')}>
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <h4 className={cn('text-[12px] font-extrabold leading-tight line-clamp-2',
                            inCart > 0 ? 'text-atul-pink_primary' : 'text-atul-charcoal')}>
                            {p.name}
                          </h4>
                          <span className={cn('size-2 rounded-full mt-1 shrink-0', p.is_veg ? 'bg-emerald-500' : 'bg-red-400')}/>
                        </div>
                        <div className="flex items-baseline gap-1 mb-2">
                          {discountPct > 0 && (
                            <span className="text-[10px] text-atul-gray/30 line-through font-mono">₹{fmt(p.base_price)}</span>
                          )}
                          <span className="text-[14px] font-black text-atul-pink_primary professional-digits">₹{fmt(dPrice.toFixed(0))}</span>
                        </div>
                        {/* Qty controls */}
                        <div className={cn('flex items-center justify-between rounded-xl transition-all overflow-hidden',
                          inCart > 0 ? 'bg-atul-pink_soft' : 'bg-gray-50')}>
                          <button onClick={() => adjustCart(p, -1)} disabled={inCart === 0}
                            className="p-2 hover:bg-atul-pink_primary/10 transition-colors disabled:opacity-20">
                            <Minus size={12}/>
                          </button>
                          <input
                            type="number"
                            value={inCart || ''}
                            onChange={e => setCartQty(p.id, e.target.value)}
                            placeholder="0"
                            className="w-10 text-center bg-transparent text-[13px] font-black outline-none professional-digits [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button onClick={() => adjustCart(p, 1)}
                            className="p-2 hover:bg-atul-pink_primary/10 transition-colors">
                            <Plus size={12}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right — Cart / summary */}
            <div className="w-[280px] shrink-0 flex flex-col gap-3">
              <div className="glass rounded-[2rem] p-5 border border-white/60 flex-1 flex flex-col min-h-0">
                <h3 className="font-serif text-lg font-bold mb-3 flex items-center gap-2">
                  <ShoppingCart size={18} className="text-atul-pink_primary"/> Order Cart
                </h3>

                {cart.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-20 gap-2">
                    <ShoppingCart size={32}/>
                    <p className="text-sm font-bold">No items yet</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 min-h-0">
                    {cart.map(c => (
                      <div key={c.product.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-extrabold text-atul-charcoal truncate">{c.product.name}</p>
                          <p className="text-[9px] text-atul-gray/50">₹{fmt(discountedPrice(c.product.base_price).toFixed(0))} × {c.qty}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] font-black text-atul-pink_primary professional-digits">
                            ₹{fmt((discountedPrice(c.product.base_price) * c.qty).toFixed(0))}
                          </span>
                          <button onClick={() => adjustCart(c.product, -c.qty)}
                            className="size-4 rounded bg-red-50 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all">
                            <X size={8}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totals */}
                {cart.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5 shrink-0">
                    {discountPct > 0 && (
                      <>
                        <div className="flex justify-between text-[11px] text-atul-gray/50">
                          <span>Original MRP</span>
                          <span className="line-through font-mono">₹{fmt(cartOriginal.toFixed(0))}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-emerald-600 font-bold">
                          <span>Discount ({discountPct}%)</span>
                          <span className="font-mono">-₹{fmt((cartOriginal - cartTotal).toFixed(0))}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between font-black text-base text-atul-charcoal pt-1">
                      <span>Total</span>
                      <span className="text-atul-pink_primary professional-digits">₹{fmt(cartTotal.toFixed(0))}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="glass rounded-[2rem] p-4 border border-white/60 shrink-0">
                <label className="text-[9px] font-black uppercase tracking-widest text-atul-gray/40 block mb-1.5">Order Notes</label>
                <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                  placeholder="Special instructions…" rows={2}
                  className="w-full bg-transparent text-sm font-medium outline-none resize-none placeholder:text-atul-gray/25 text-atul-charcoal"/>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={handleSubmitOrder} disabled={submitting || cart.length === 0}
                  className="w-full bg-atul-pink_primary text-white rounded-2xl py-3.5 font-black text-sm hover:bg-pink-600 transition-all disabled:opacity-40 shadow-lg shadow-atul-pink_primary/30 flex items-center justify-center gap-2">
                  <Send size={15}/> {submitting ? 'Submitting…' : 'Submit Order'}
                </button>
                <button onClick={handleSaveDraft} disabled={drafting || cart.length === 0}
                  className="w-full bg-white border-2 border-gray-100 text-atul-gray rounded-2xl py-3 font-black text-sm hover:border-gray-200 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                  {drafting ? 'Saving…' : 'Save as Draft'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── MY ORDERS ── */}
        {activeSubTab === 'distributor_myorders' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {orders.length === 0 ? (
              <div className="glass rounded-[2.5rem] p-16 flex flex-col items-center gap-3 opacity-30">
                <Package size={40}/>
                <p className="font-bold text-sm">No orders placed yet</p>
                <button onClick={() => onTabChange?.('distributor_orders')}
                  className="px-4 py-2 bg-atul-pink_primary text-white rounded-xl text-sm font-bold mt-2">
                  Place First Order
                </button>
              </div>
            ) : orders.map(order => (
              <div key={order.id} className="glass rounded-[2rem] border border-white/70 overflow-hidden">
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/40 transition-colors"
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                  <div className="size-9 rounded-xl bg-atul-pink_soft flex items-center justify-center text-atul-pink_primary shrink-0">
                    <Package size={16}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-extrabold text-atul-charcoal">{order.order_number}</span>
                      <StatusBadge status={order.status}/>
                    </div>
                    <p className="text-[10px] text-atul-gray/50 font-semibold mt-0.5">
                      {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {order.dispatched_at && <span className="ml-2">· Dispatched</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-black professional-digits">₹{fmt(order.total_amount)}</p>
                    <p className="text-[9px] text-atul-gray/40 font-semibold">{order.item_count} items</p>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0 pl-2">
                    {order.status === 'dispatched' && (
                      <button onClick={(e) => { e.stopPropagation(); handleReceive(order.id); }}
                        disabled={actionLoading === order.id}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-black bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5">
                        <CheckCircle size={12}/> {actionLoading === order.id ? '…' : 'Confirm Receipt'}
                      </button>
                    )}
                    {['draft', 'submitted'].includes(order.status) && (
                      <button onClick={(e) => { e.stopPropagation(); handleCancel(order.id); }}
                        disabled={actionLoading === order.id}
                        className="size-7 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all">
                        <X size={12}/>
                      </button>
                    )}
                    <ChevronDown size={14} className={cn('text-atul-gray/30 transition-transform', expandedOrder === order.id && 'rotate-180')}/>
                  </div>
                </div>

                {/* Expanded items */}
                <AnimatePresence>
                  {expandedOrder === order.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-100 bg-white/60 px-5 py-4 overflow-hidden">
                      <p className="text-[9px] font-black uppercase tracking-widest text-atul-gray/40 mb-3">Items</p>
                      <div className="space-y-1.5">
                        {(order.items || []).map((item, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-[12px] font-bold text-atul-charcoal">{item.product_name}</span>
                            <div className="flex items-center gap-4 text-[11px] font-semibold text-atul-gray/60">
                              <span>×{item.quantity}</span>
                              <span className="font-black text-atul-charcoal professional-digits">₹{fmt(item.subtotal)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Dispatch info if available */}
                      {(order.dispatches || []).length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-100">
                          <p className="text-[9px] font-black uppercase tracking-widest text-atul-gray/40 mb-2">Dispatch Info</p>
                          {order.dispatches.map(d => (
                            <div key={d.id} className="flex items-center gap-4 text-[11px] font-semibold text-atul-gray/60">
                              <span>{d.dispatch_number}</span>
                              {d.vehicle_number && <span>🚚 {d.vehicle_number}</span>}
                              {d.driver_name    && <span>👤 {d.driver_name}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── MY STOCK ── */}
        {activeSubTab === 'distributor_stock' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="glass rounded-[2.5rem] border border-white/60 overflow-hidden">
              {stocks.length === 0 ? (
                <div className="p-16 flex flex-col items-center gap-3 opacity-30">
                  <Boxes size={40}/>
                  <p className="font-bold text-sm">No stock records yet</p>
                  <p className="text-xs text-atul-gray/40">Stock is added automatically when you confirm delivery</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/80 text-[9px] font-black uppercase tracking-widest text-atul-gray/40">
                    <tr>
                      {['Product', 'Variant', 'Qty in Stock', 'Min Threshold', 'Status'].map(h => (
                        <th key={h} className="text-left px-5 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stocks.map(s => {
                      const isLow = parseFloat(s.quantity) <= parseFloat(s.min_threshold);
                      return (
                        <tr key={s.id} className={cn('border-t border-gray-50 hover:bg-white/40 transition-colors', isLow && 'bg-red-50/20')}>
                          <td className="px-5 py-3 font-bold text-[12px]">{s.product_name || s.product}</td>
                          <td className="px-5 py-3 text-[11px] text-atul-gray/60">{s.variant_name || '—'}</td>
                          <td className="px-5 py-3 font-black text-[13px] professional-digits">{fmt(s.quantity)}</td>
                          <td className="px-5 py-3 text-[11px] text-atul-gray/50">{fmt(s.min_threshold)}</td>
                          <td className="px-5 py-3">
                            {isLow
                              ? <span className="text-[9px] font-black text-red-500 uppercase tracking-wide flex items-center gap-1"><AlertCircle size={10}/> Low Stock</span>
                              : <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wide flex items-center gap-1"><CheckCircle size={10}/> OK</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
