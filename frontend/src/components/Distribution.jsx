/**
 * Distribution.jsx  —  Main Branch (HQ) distribution management panel
 *
 * Tabs:
 *  1. Overview   — dashboard stats + recent order activity
 *  2. Orders     — incoming distributor orders with workflow actions
 *  3. Distributors — manage distributor outlets
 *  4. History    — all dispatches (read-only audit)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network, Package, Truck, CheckCircle, Clock, XCircle,
  ChevronDown, ChevronRight, X, Eye, Send, AlertCircle,
  TrendingUp, Users, ShoppingBag, RefreshCw, Building2,
  ArrowRight, MapPin, Phone, CreditCard, Percent,
} from 'lucide-react';
import { distributionApi, outletApi } from '../services/api';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...i) => twMerge(clsx(i));

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_META = {
  draft:       { label: 'Draft',       color: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-400' },
  submitted:   { label: 'Submitted',   color: 'bg-amber-50 text-amber-600',    dot: 'bg-amber-400' },
  approved:    { label: 'Approved',    color: 'bg-blue-50 text-blue-600',      dot: 'bg-blue-500' },
  processing:  { label: 'Processing',  color: 'bg-purple-50 text-purple-600',  dot: 'bg-purple-500' },
  dispatched:  { label: 'Dispatched',  color: 'bg-indigo-50 text-indigo-600',  dot: 'bg-indigo-500' },
  delivered:   { label: 'Delivered',   color: 'bg-emerald-50 text-emerald-600',dot: 'bg-emerald-500' },
  cancelled:   { label: 'Cancelled',   color: 'bg-red-50 text-red-400',        dot: 'bg-red-400' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide', m.color)}>
      <span className={cn('size-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

function fmt(n) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0 }).format(n);
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function Distribution({ user }) {
  const [tab, setTab]                   = useState('overview');
  const [stats, setStats]               = useState(null);
  const [orders, setOrders]             = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [dispatches, setDispatches]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Expanded order row
  const [expandedOrder, setExpandedOrder] = useState(null);

  // Dispatch modal
  const [dispatchModal, setDispatchModal] = useState(null); // { order }
  const [dispatchForm, setDispatchForm]   = useState({ vehicle_number: '', driver_name: '', notes: '' });

  // Edit distributor modal
  const [editDistModal, setEditDistModal]   = useState(null); // { outlet }
  const [editDistForm, setEditDistForm]     = useState({});

  const [notification, setNotification] = useState(null);

  // ── Data loading ──────────────────────────────────────────────────────

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, ordersRes, distsRes, dispatchesRes] = await Promise.all([
        distributionApi.getDashboard(),
        distributionApi.getOrders(),
        distributionApi.getDistributorOutlets(),
        distributionApi.getDispatches(),
      ]);
      setStats(dashRes.data?.data || dashRes.data);
      setOrders(ordersRes.data?.data || ordersRes.data || []);
      setDistributors(distsRes.data?.data || distsRes.data || []);
      setDispatches(dispatchesRes.data?.data || dispatchesRes.data || []);
    } catch (e) {
      console.error('Distribution load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Order workflow actions ─────────────────────────────────────────────

  const doAction = async (action, orderId, payload = {}) => {
    setActionLoading(orderId);
    try {
      let res;
      if      (action === 'approve')  res = await distributionApi.approveOrder(orderId);
      else if (action === 'process')  res = await distributionApi.processOrder(orderId);
      else if (action === 'dispatch') res = await distributionApi.dispatchOrder(orderId, payload);
      else if (action === 'cancel')   res = await distributionApi.cancelOrder(orderId);

      const updated = res.data?.data || res.data;
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
      notify(`Order ${action}d successfully.`);
      if (action === 'dispatch') {
        setDispatchModal(null);
        setDispatchForm({ vehicle_number: '', driver_name: '', notes: '' });
        loadAll(); // refresh dispatch list
      }
    } catch (e) {
      notify(e.response?.data?.data?.error || 'Action failed.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDispatchSubmit = () => {
    if (!dispatchModal) return;
    doAction('dispatch', dispatchModal.order.id, dispatchForm);
  };

  // ── Distributor edit ───────────────────────────────────────────────────

  const saveDistributor = async () => {
    try {
      await outletApi.updateOutlet(editDistModal.id, {
        credit_limit: editDistForm.credit_limit,
        distributor_discount_pct: editDistForm.distributor_discount_pct,
      });
      setDistributors(prev => prev.map(d =>
        d.id === editDistModal.id ? { ...d, ...editDistForm } : d
      ));
      setEditDistModal(null);
      notify('Distributor settings saved.');
    } catch (e) {
      notify('Save failed.', 'error');
    }
  };

  // ── Action button per status ──────────────────────────────────────────

  const ActionButton = ({ order }) => {
    const busy = actionLoading === order.id;
    const cls  = 'px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5';

    if (order.status === 'submitted') return (
      <button onClick={() => doAction('approve', order.id)} disabled={busy}
        className={cn(cls, 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm shadow-blue-200')}>
        <CheckCircle size={12}/> {busy ? '…' : 'Approve'}
      </button>
    );
    if (order.status === 'approved') return (
      <button onClick={() => doAction('process', order.id)} disabled={busy}
        className={cn(cls, 'bg-purple-500 text-white hover:bg-purple-600 shadow-sm shadow-purple-200')}>
        <Package size={12}/> {busy ? '…' : 'Start Processing'}
      </button>
    );
    if (order.status === 'processing') return (
      <button onClick={() => { setDispatchModal({ order }); setDispatchForm({ vehicle_number: '', driver_name: '', notes: '' }); }}
        className={cn(cls, 'bg-atul-pink_primary text-white hover:bg-pink-600 shadow-sm shadow-pink-200')}>
        <Truck size={12}/> Dispatch
      </button>
    );
    if (order.status === 'dispatched') return (
      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide flex items-center gap-1">
        <Clock size={11}/> Awaiting Confirmation
      </span>
    );
    return null;
  };

  // ── Stat card ────────────────────────────────────────────────────────

  const StatCard = ({ icon, label, value, sub, accent }) => (
    <div className={cn('glass rounded-[2rem] p-5 flex items-start gap-4 border', accent ? 'border-atul-pink_primary/15' : 'border-white/70')}>
      <div className={cn('size-11 rounded-2xl flex items-center justify-center shrink-0 text-white', accent ? 'bg-atul-pink_primary shadow-lg shadow-atul-pink_primary/30' : 'bg-atul-charcoal/80')}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-atul-gray/50">{label}</p>
        <p className="text-2xl font-black text-atul-charcoal mt-0.5 professional-digits">{value}</p>
        {sub && <p className="text-[10px] font-semibold text-atul-gray/40 mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 opacity-30">
        <RefreshCw className="animate-spin size-8" />
        <span className="text-sm font-bold uppercase tracking-widest">Loading Distribution…</span>
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
              <Network size={20} />
            </div>
            Distribution Centre
          </h2>
          <p className="text-atul-pink_primary/50 text-sm mt-1 ml-14">
            Manage outbound stock &amp; distributor orders
          </p>
        </div>
        <button onClick={loadAll} className="size-9 rounded-xl bg-white border border-gray-100 text-atul-gray hover:text-atul-pink_primary hover:border-atul-pink_primary/30 transition-all flex items-center justify-center shadow-sm">
          <RefreshCw size={15} />
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 shrink-0">
        {[
          { id: 'overview',      label: 'Overview',       icon: <TrendingUp size={14}/> },
          { id: 'orders',        label: 'Incoming Orders', icon: <ShoppingBag size={14}/> },
          { id: 'distributors',  label: 'Distributors',   icon: <Users size={14}/> },
          { id: 'history',       label: 'Dispatch History',icon: <Truck size={14}/> },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[12px] font-bold transition-all',
              tab === t.id ? 'bg-atul-pink_primary text-white shadow-md shadow-atul-pink_primary/20' : 'text-atul-gray/60 hover:text-atul-charcoal hover:bg-white/50')}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <StatCard icon={<Clock size={20}/>}      label="Pending Approval"  value={s.pending_approval  ?? 0} accent />
              <StatCard icon={<Package size={20}/>}    label="In Processing"     value={s.processing        ?? 0} />
              <StatCard icon={<Truck size={20}/>}      label="In Transit"        value={s.in_transit        ?? 0} />
              <StatCard icon={<CheckCircle size={20}/>}label="Today's Dispatches"value={s.today_dispatches  ?? 0} />
            </div>
            <div className="glass rounded-[2.5rem] p-6 border border-white/60">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-serif text-lg font-bold">Monthly Revenue from Distributors</h3>
                <span className="text-2xl font-black text-atul-pink_primary professional-digits">
                  ₹{fmt(s.monthly_revenue ?? 0)}
                </span>
              </div>
              {/* Top distributors */}
              {(stats?.top_distributors || []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40 mb-3">Top Distributors This Month</p>
                  {stats.top_distributors.map((d, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="size-6 rounded-full bg-atul-pink_soft text-atul-pink_primary text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                        <span className="text-sm font-bold text-atul-charcoal">{d.distributor_outlet__name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black professional-digits">₹{fmt(d.total)}</p>
                        <p className="text-[9px] text-atul-gray/40 font-semibold">{d.order_count} orders</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── ORDERS ── */}
        {tab === 'orders' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {orders.length === 0 ? (
              <div className="glass rounded-[2.5rem] p-16 flex flex-col items-center gap-3 opacity-30">
                <ShoppingBag size={40} />
                <p className="font-bold text-sm">No distribution orders yet</p>
              </div>
            ) : orders.map(order => (
              <div key={order.id} className="glass rounded-[2rem] border border-white/70 overflow-hidden">
                {/* Order row */}
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/40 transition-colors"
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                  <div className="size-9 rounded-xl bg-atul-pink_soft flex items-center justify-center text-atul-pink_primary shrink-0">
                    <Package size={16}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-extrabold text-atul-charcoal">{order.order_number}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-[11px] text-atul-gray/60 font-semibold mt-0.5 flex items-center gap-1.5">
                      <Building2 size={10}/>
                      {order.distributor_outlet_name}
                      {order.distributor_outlet_city && <span className="text-atul-gray/30">— {order.distributor_outlet_city}</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-black professional-digits">₹{fmt(order.total_amount)}</p>
                    <p className="text-[9px] text-atul-gray/40 font-semibold">{order.item_count} items</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pl-2">
                    <ActionButton order={order} />
                    {['submitted', 'approved', 'processing'].includes(order.status) && (
                      <button onClick={(e) => { e.stopPropagation(); doAction('cancel', order.id); }}
                        className="size-7 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all text-[10px]">
                        <X size={12}/>
                      </button>
                    )}
                    <ChevronDown size={14} className={cn('text-atul-gray/30 transition-transform', expandedOrder === order.id && 'rotate-180')} />
                  </div>
                </div>

                {/* Expanded items */}
                <AnimatePresence>
                  {expandedOrder === order.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-100 bg-white/60 px-5 py-4 overflow-hidden">
                      <p className="text-[9px] font-black uppercase tracking-widest text-atul-gray/40 mb-3">Order Items</p>
                      <div className="space-y-1.5">
                        {(order.items || []).map((item, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                            <span className="text-[12px] font-bold text-atul-charcoal">
                              {item.product_name} {item.variant_name && <span className="text-atul-pink_primary text-[10px]">({item.variant_name})</span>}
                            </span>
                            <div className="flex items-center gap-4 text-[11px] font-semibold text-atul-gray/60">
                              <span>×{item.quantity}</span>
                              <span className="font-black text-atul-charcoal">₹{fmt(item.subtotal)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {order.notes && (
                        <p className="text-[10px] text-atul-gray/50 mt-3 italic">Notes: {order.notes}</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── DISTRIBUTORS ── */}
        {tab === 'distributors' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {distributors.length === 0 ? (
              <div className="col-span-3 glass rounded-[2.5rem] p-16 flex flex-col items-center gap-3 opacity-30">
                <Users size={40} />
                <p className="font-bold text-sm">No distributor outlets configured yet</p>
                <p className="text-xs text-atul-gray/50">Create outlets with type "Distributor" in Settings</p>
              </div>
            ) : distributors.map(dist => (
              <div key={dist.id} className="glass rounded-[2rem] border border-white/70 p-5 space-y-3 hover:border-atul-pink_primary/20 transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-[14px] text-atul-charcoal">{dist.name}</h4>
                    <p className="text-[10px] text-atul-gray/50 font-semibold flex items-center gap-1 mt-0.5">
                      <MapPin size={9}/>{dist.city || '—'}
                    </p>
                  </div>
                  <button onClick={() => { setEditDistModal(dist); setEditDistForm({ credit_limit: dist.credit_limit, distributor_discount_pct: dist.distributor_discount_pct }); }}
                    className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-atul-pink_soft text-atul-pink_primary hover:bg-atul-pink_primary hover:text-white transition-all">
                    Edit
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/70 rounded-xl p-2.5">
                    <p className="text-[8px] font-black uppercase tracking-widest text-atul-gray/40 flex items-center gap-1"><CreditCard size={8}/> Credit Limit</p>
                    <p className="text-sm font-black professional-digits mt-1">₹{fmt(dist.credit_limit || 0)}</p>
                  </div>
                  <div className="bg-white/70 rounded-xl p-2.5">
                    <p className="text-[8px] font-black uppercase tracking-widest text-atul-gray/40 flex items-center gap-1"><Percent size={8}/> Discount</p>
                    <p className="text-sm font-black mt-1">{dist.distributor_discount_pct || 0}%</p>
                  </div>
                </div>
                {dist.phone && (
                  <p className="text-[10px] text-atul-gray/50 flex items-center gap-1.5 font-semibold">
                    <Phone size={10}/>{dist.phone}
                  </p>
                )}
              </div>
            ))}
          </motion.div>
        )}

        {/* ── HISTORY ── */}
        {tab === 'history' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            {dispatches.length === 0 ? (
              <div className="glass rounded-[2.5rem] p-16 flex flex-col items-center gap-3 opacity-30">
                <Truck size={40} />
                <p className="font-bold text-sm">No dispatches recorded yet</p>
              </div>
            ) : (
              <div className="glass rounded-[2.5rem] overflow-hidden border border-white/60">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/80 text-[9px] font-black uppercase tracking-widest text-atul-gray/40">
                    <tr>
                      {['Dispatch #', 'Order #', 'Distributor', 'Vehicle', 'Driver', 'Date', 'Status'].map(h => (
                        <th key={h} className="text-left px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dispatches.map(d => (
                      <tr key={d.id} className="border-t border-gray-50 hover:bg-white/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] font-bold">{d.dispatch_number}</td>
                        <td className="px-4 py-3 text-[11px] font-semibold text-atul-pink_primary">{d.order_number}</td>
                        <td className="px-4 py-3 text-[11px] font-semibold">{d.distributor_name}</td>
                        <td className="px-4 py-3 text-[11px] text-atul-gray/60">{d.vehicle_number || '—'}</td>
                        <td className="px-4 py-3 text-[11px] text-atul-gray/60">{d.driver_name || '—'}</td>
                        <td className="px-4 py-3 text-[10px] text-atul-gray/40 font-mono">{new Date(d.created_at).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3">
                          {d.is_received
                            ? <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wide flex items-center gap-1"><CheckCircle size={10}/> Received</span>
                            : <span className="text-[9px] font-black text-indigo-500 uppercase tracking-wide flex items-center gap-1"><Truck size={10}/> In Transit</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ── DISPATCH MODAL ── */}
      <AnimatePresence>
        {dispatchModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setDispatchModal(null)}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-serif text-xl font-bold">Dispatch Order</h3>
                  <p className="text-sm text-atul-gray/50 mt-0.5">{dispatchModal.order.order_number} → {dispatchModal.order.distributor_outlet_name}</p>
                </div>
                <button onClick={() => setDispatchModal(null)} className="size-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                  <X size={14}/>
                </button>
              </div>
              <div className="space-y-4">
                {[
                  { field: 'vehicle_number', label: 'Vehicle Number', placeholder: 'e.g. GJ01AB1234' },
                  { field: 'driver_name',    label: 'Driver Name',    placeholder: 'e.g. Ramesh Kumar' },
                ].map(({ field, label, placeholder }) => (
                  <div key={field}>
                    <label className="text-[10px] font-black text-atul-pink_primary/60 uppercase tracking-widest block mb-1.5">{label}</label>
                    <input
                      value={dispatchForm[field]}
                      onChange={e => setDispatchForm(f => ({ ...f, [field]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full bg-gray-50 border-2 border-white rounded-2xl p-3.5 font-bold text-sm outline-none focus:border-atul-pink_primary/20 transition-colors"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-[10px] font-black text-atul-pink_primary/60 uppercase tracking-widest block mb-1.5">Notes (Optional)</label>
                  <textarea
                    value={dispatchForm.notes}
                    onChange={e => setDispatchForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="w-full bg-gray-50 border-2 border-white rounded-2xl p-3.5 font-bold text-sm outline-none focus:border-atul-pink_primary/20 transition-colors resize-none"
                  />
                </div>
              </div>
              <button onClick={handleDispatchSubmit} disabled={!!actionLoading}
                className="w-full mt-6 bg-atul-pink_primary text-white rounded-2xl py-4 font-black text-sm hover:bg-pink-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-atul-pink_primary/30">
                <Truck size={16}/> {actionLoading ? 'Dispatching…' : 'Confirm Dispatch'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EDIT DISTRIBUTOR MODAL ── */}
      <AnimatePresence>
        {editDistModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setEditDistModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-serif text-xl font-bold">Edit Distributor</h3>
                  <p className="text-sm text-atul-gray/50 mt-0.5">{editDistModal.name}</p>
                </div>
                <button onClick={() => setEditDistModal(null)} className="size-8 rounded-xl bg-gray-100 flex items-center justify-center">
                  <X size={14}/>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-atul-pink_primary/60 uppercase tracking-widest block mb-1.5">Credit Limit (₹)</label>
                  <input type="number" value={editDistForm.credit_limit}
                    onChange={e => setEditDistForm(f => ({ ...f, credit_limit: e.target.value }))}
                    className="w-full bg-gray-50 border-2 border-white rounded-2xl p-3.5 font-bold text-sm outline-none focus:border-atul-pink_primary/20"/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-atul-pink_primary/60 uppercase tracking-widest block mb-1.5">Discount % (off MRP)</label>
                  <input type="number" value={editDistForm.distributor_discount_pct}
                    onChange={e => setEditDistForm(f => ({ ...f, distributor_discount_pct: e.target.value }))}
                    className="w-full bg-gray-50 border-2 border-white rounded-2xl p-3.5 font-bold text-sm outline-none focus:border-atul-pink_primary/20"/>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditDistModal(null)}
                  className="flex-1 py-3 rounded-2xl border-2 border-gray-100 font-black text-sm text-atul-gray hover:border-gray-200">
                  Cancel
                </button>
                <button onClick={saveDistributor}
                  className="flex-1 py-3 rounded-2xl bg-atul-pink_primary text-white font-black text-sm hover:bg-pink-600 shadow-lg shadow-atul-pink_primary/30">
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
