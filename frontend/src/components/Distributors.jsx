import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { distributorMgmtApi } from '../services/api';
import {
  Building2, Plus, Search, Filter, Edit2, Trash2, X,
  TrendingUp, Users, Store, GitBranch, CheckCircle,
  XCircle, Phone, Mail, MapPin, IndianRupee, Percent,
  Eye, EyeOff, ChevronDown, RefreshCw, AlertCircle,
  Landmark, Handshake,
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────────── */
const cn = (...cls) => cls.filter(Boolean).join(' ');

const BRANCH_TYPE_META = {
  own:       { label: 'Own Branch',       color: 'text-violet-700 bg-violet-50  border-violet-200', icon: Landmark },
  franchise: { label: 'Franchise Branch', color: 'text-amber-700  bg-amber-50   border-amber-200',  icon: Handshake },
};

const emptyOutlet = {
  name: '', outlet_code: '', city: '', address: '',
  phone: '', email: '',
  branch_type: 'own',
  credit_limit: '', distributor_discount_pct: '',
  gstin: '', fssai_number: '',
};

const emptyManager = { full_name: '', email: '', phone: '', password: '' };

/* ── Stat Card ───────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-[2rem] p-6 flex items-center gap-5"
    >
      <div className={cn('size-14 rounded-2xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon size={26} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-atul-charcoal/40 mb-0.5">{label}</p>
        <p className="text-3xl font-bold text-atul-charcoal professional-digits">{value ?? '—'}</p>
        {sub && <p className="text-[11px] text-atul-charcoal/50 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

/* ── Branch-type badge ───────────────────────────────────────────────── */
function BranchBadge({ type }) {
  const meta = BRANCH_TYPE_META[type];
  if (!meta) return <span className="text-xs text-gray-400">—</span>;
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border', meta.color)}>
      <Icon size={11} />
      {meta.label}
    </span>
  );
}

/* ── Status badge ────────────────────────────────────────────────────── */
function StatusBadge({ active }) {
  return active
    ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle size={10} />Active</span>
    : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-200"><XCircle size={10} />Inactive</span>;
}

/* ── Field ───────────────────────────────────────────────────────────── */
function Field({ label, children, required }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-widest block mb-1.5 ml-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full bg-gray-50 border-2 border-white rounded-xl py-3 px-4 text-sm font-medium outline-none focus:border-atul-pink_primary/30 focus:ring-4 focus:ring-atul-pink_primary/5 transition-all text-atul-charcoal placeholder:text-gray-300';

/* ════════════════════════════════════════════════════════════════════════
   Add / Edit Modal
   ════════════════════════════════════════════════════════════════════════ */
function DistributorModal({ mode, distributor, onClose, onSaved }) {
  const isEdit = mode === 'edit';

  const [outletForm, setOutletForm] = useState(
    isEdit
      ? {
          name: distributor.name || '',
          outlet_code: distributor.outlet_code || '',
          city: distributor.city || '',
          address: distributor.address || '',
          phone: distributor.phone || '',
          email: distributor.email || '',
          branch_type: distributor.branch_type || 'own',
          credit_limit: distributor.credit_limit || '',
          distributor_discount_pct: distributor.distributor_discount_pct || '',
          gstin: distributor.gstin || '',
          fssai_number: distributor.fssai_number || '',
        }
      : { ...emptyOutlet }
  );

  const [managerForm, setManagerForm] = useState({ ...emptyManager });
  const [addManager, setAddManager] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const setO = (k, v) => setOutletForm(p => ({ ...p, [k]: v }));
  const setM = (k, v) => setManagerForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    if (!outletForm.name.trim())        return 'Distributor name is required.';
    if (!outletForm.outlet_code.trim()) return 'Outlet code is required.';
    if (!outletForm.city.trim())        return 'City is required.';
    if (!outletForm.phone.trim())       return 'Phone is required.';
    if (!outletForm.email.trim())       return 'Email is required.';
    if (!isEdit && addManager) {
      if (!managerForm.full_name.trim()) return 'Manager name is required.';
      if (!managerForm.email.trim())     return 'Manager email is required.';
      if (!managerForm.password)         return 'Manager password is required.';
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);
    try {
      if (isEdit) {
        await distributorMgmtApi.updateDistributor(distributor.id, outletForm);
      } else {
        const payload = { outlet: outletForm };
        if (addManager && managerForm.email) payload.manager = managerForm;
        await distributorMgmtApi.createDistributor(payload);
      }
      onSaved();
    } catch (e) {
      const d = e.response?.data;
      setError(
        typeof d === 'string' ? d
          : d?.detail || d?.non_field_errors?.[0]
          || Object.values(d || {}).flat()[0]
          || 'Save failed. Please check all fields.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-atul-charcoal/50 backdrop-blur-md">
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0,  opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-8 border-b border-atul-pink_primary/10 flex items-center justify-between bg-gradient-to-r from-atul-pink_soft/30 to-transparent flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-atul-pink_primary text-white flex items-center justify-center shadow-lg shadow-atul-pink_primary/30">
              <Building2 size={22} />
            </div>
            <div>
              <h3 className="font-serif text-2xl font-bold">
                {isEdit ? 'Edit Distributor' : 'Add Distributor'}
              </h3>
              <p className="text-sm text-atul-pink_primary/50">
                {isEdit ? 'Update distributor details' : 'Register a new distributor outlet'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="size-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-atul-gray transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto custom-scrollbar flex-1 p-8 space-y-8">

          {/* Outlet Info */}
          <section>
            <h4 className="font-serif font-bold text-lg mb-5 flex items-center gap-2 text-atul-charcoal">
              <Store size={18} className="text-atul-pink_primary" /> Outlet Details
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Distributor Name" required>
                <input className={inputCls} placeholder="e.g. Patel Ice Cream Co." value={outletForm.name} onChange={e => setO('name', e.target.value)} />
              </Field>
              <Field label="Outlet Code" required>
                <input className={inputCls} placeholder="e.g. DIST-RJK-01" value={outletForm.outlet_code} onChange={e => setO('outlet_code', e.target.value)} />
              </Field>
              <Field label="City" required>
                <input className={inputCls} placeholder="City" value={outletForm.city} onChange={e => setO('city', e.target.value)} />
              </Field>
              <Field label="Phone" required>
                <input className={inputCls} placeholder="+91 98765 43210" value={outletForm.phone} onChange={e => setO('phone', e.target.value)} />
              </Field>
              <div className="col-span-2">
                <Field label="Address" required>
                  <input className={inputCls} placeholder="Full address" value={outletForm.address} onChange={e => setO('address', e.target.value)} />
                </Field>
              </div>
              <Field label="Email" required>
                <input className={inputCls} type="email" placeholder="distributor@email.com" value={outletForm.email} onChange={e => setO('email', e.target.value)} />
              </Field>
              <Field label="GSTIN">
                <input className={inputCls} placeholder="GST Number" value={outletForm.gstin} onChange={e => setO('gstin', e.target.value)} />
              </Field>
            </div>
          </section>

          {/* Branch Type */}
          <section>
            <h4 className="font-serif font-bold text-lg mb-5 flex items-center gap-2 text-atul-charcoal">
              <GitBranch size={18} className="text-atul-pink_primary" /> Branch Type
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: 'own',       Icon: Landmark,  label: 'Own Branch',       desc: 'Fully owned and operated by Atul Ice Cream' },
                { value: 'franchise', Icon: Handshake, label: 'Franchise Branch',  desc: 'Operated by a franchisee partner under license' },
              ].map(({ value, Icon, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setO('branch_type', value)}
                  className={cn(
                    'p-5 rounded-2xl border-2 text-left transition-all',
                    outletForm.branch_type === value
                      ? 'border-atul-pink_primary bg-atul-pink_soft/30 shadow-md shadow-atul-pink_primary/10'
                      : 'border-gray-100 bg-gray-50 hover:border-atul-pink_primary/30'
                  )}
                >
                  <div className={cn('size-10 rounded-xl flex items-center justify-center mb-3',
                    outletForm.branch_type === value ? 'bg-atul-pink_primary text-white' : 'bg-white text-atul-charcoal/40'
                  )}>
                    <Icon size={18} />
                  </div>
                  <p className={cn('font-bold text-sm', outletForm.branch_type === value ? 'text-atul-pink_primary' : 'text-atul-charcoal')}>{label}</p>
                  <p className="text-[11px] text-atul-charcoal/40 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Distribution Settings */}
          <section>
            <h4 className="font-serif font-bold text-lg mb-5 flex items-center gap-2 text-atul-charcoal">
              <TrendingUp size={18} className="text-atul-pink_primary" /> Distribution Settings
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Credit Limit (₹)">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><IndianRupee size={14} /></span>
                  <input className={cn(inputCls, 'pl-9')} type="number" placeholder="0.00" value={outletForm.credit_limit} onChange={e => setO('credit_limit', e.target.value)} />
                </div>
              </Field>
              <Field label="Discount (%)">
                <div className="relative">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"><Percent size={14} /></span>
                  <input className={cn(inputCls, 'pr-9')} type="number" placeholder="0.00" min="0" max="100" value={outletForm.distributor_discount_pct} onChange={e => setO('distributor_discount_pct', e.target.value)} />
                </div>
              </Field>
            </div>
          </section>

          {/* Manager — only on add */}
          {!isEdit && (
            <section>
              <div className="flex items-center justify-between mb-5">
                <h4 className="font-serif font-bold text-lg flex items-center gap-2 text-atul-charcoal">
                  <Users size={18} className="text-atul-pink_primary" /> Manager Account
                </h4>
                <button
                  onClick={() => setAddManager(v => !v)}
                  className={cn('text-xs font-bold px-3 py-1.5 rounded-full border transition-all',
                    addManager ? 'bg-atul-pink_primary text-white border-atul-pink_primary' : 'bg-white text-atul-pink_primary border-atul-pink_primary/30 hover:bg-atul-pink_soft/20'
                  )}
                >
                  {addManager ? 'Remove Manager' : '+ Add Manager Login'}
                </button>
              </div>
              <AnimatePresence>
                {addManager && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-4 p-5 bg-atul-pink_soft/20 rounded-2xl border border-atul-pink_primary/10">
                      <Field label="Full Name" required>
                        <input className={inputCls} placeholder="Manager's name" value={managerForm.full_name} onChange={e => setM('full_name', e.target.value)} />
                      </Field>
                      <Field label="Phone">
                        <input className={inputCls} placeholder="+91 98765 43210" value={managerForm.phone} onChange={e => setM('phone', e.target.value)} />
                      </Field>
                      <Field label="Email" required>
                        <input className={inputCls} type="email" placeholder="manager@email.com" value={managerForm.email} onChange={e => setM('email', e.target.value)} />
                      </Field>
                      <Field label="Password" required>
                        <div className="relative">
                          <input
                            className={cn(inputCls, 'pr-12')}
                            type={showPwd ? 'text' : 'password'}
                            placeholder="Set login password"
                            value={managerForm.password}
                            onChange={e => setM('password', e.target.value)}
                          />
                          <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </Field>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {!addManager && (
                <p className="text-xs text-atul-charcoal/40 text-center py-2">
                  You can add a manager login later from the distributor detail view.
                </p>
              )}
            </section>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 bg-gray-50/80 border-t border-gray-100 flex gap-4 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-3.5 bg-white border border-gray-200 rounded-2xl font-bold text-atul-charcoal hover:bg-gray-50 transition-all">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] py-3.5 bg-atul-pink_primary text-white rounded-2xl font-bold shadow-xl shadow-atul-pink_primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all uppercase tracking-wider flex items-center justify-center gap-2"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : null}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Distributor'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Delete Confirm Modal
   ════════════════════════════════════════════════════════════════════════ */
function DeleteModal({ distributor, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await distributorMgmtApi.deleteDistributor(distributor.id);
      onDeleted();
    } catch { setDeleting(false); }
  };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-atul-charcoal/50 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 text-center"
      >
        <div className="size-16 bg-red-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
          <Trash2 size={28} className="text-red-500" />
        </div>
        <h3 className="font-serif text-2xl font-bold mb-2">Delete Distributor</h3>
        <p className="text-sm text-atul-charcoal/60 mb-8">
          Are you sure you want to delete <strong>{distributor.name}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3.5 bg-gray-100 rounded-2xl font-bold hover:bg-gray-200 transition-all">Cancel</button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 py-3.5 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {deleting ? <RefreshCw size={14} className="animate-spin" /> : null}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Main Page
   ════════════════════════════════════════════════════════════════════════ */
export default function Distributors({ user }) {
  const [distributors, setDistributors] = useState([]);
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [filterType,   setFilterType]   = useState('all');   // all | own | franchise
  const [filterStatus, setFilterStatus] = useState('all');   // all | active | inactive

  const [modal,    setModal]    = useState(null);   // { type: 'add' | 'edit' | 'delete', data? }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)                    params.search      = search;
      if (filterType !== 'all')      params.branch_type = filterType;
      const [distRes, statsRes] = await Promise.all([
        distributorMgmtApi.getDistributors(params),
        distributorMgmtApi.getStats(),
      ]);
      let list = distRes.data?.data || distRes.data?.results || distRes.data || [];
      if (!Array.isArray(list)) list = [];
      // Client-side status filter
      if (filterStatus === 'active')   list = list.filter(d => d.is_active);
      if (filterStatus === 'inactive') list = list.filter(d => !d.is_active);
      setDistributors(list);
      setStats(statsRes.data?.data || statsRes.data || {});
    } catch (e) {
      console.error('Failed to load distributors', e);
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleToggleActive = async (d) => {
    try {
      await distributorMgmtApi.toggleActive(d.id, !d.is_active);
      load();
    } catch (e) { console.error(e); }
  };

  const closeModal = () => setModal(null);
  const afterSave  = () => { closeModal(); load(); };

  return (
    <div className="flex-1 p-8 h-screen overflow-y-auto custom-scrollbar flex flex-col text-atul-charcoal">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-serif text-3xl font-bold">Distributor Management</h2>
          <p className="text-atul-pink_primary/60 text-sm mt-1">
            Manage own branches and franchise distributors
          </p>
        </div>
        <button
          onClick={() => setModal({ type: 'add' })}
          className="flex items-center gap-2 bg-atul-pink_primary text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-atul-pink_primary/30 hover:scale-[1.03] active:scale-95 transition-all"
        >
          <Plus size={18} /> Add Distributor
        </button>
      </header>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Building2}  label="Total Distributors" value={stats?.total}     color="bg-atul-pink_soft text-atul-pink_primary" />
        <StatCard icon={Landmark}   label="Own Branches"       value={stats?.own}       color="bg-violet-50 text-violet-600" />
        <StatCard icon={Handshake}  label="Franchise Branches" value={stats?.franchise} color="bg-amber-50 text-amber-600" />
        <StatCard icon={CheckCircle} label="Active"            value={stats?.active}    color="bg-emerald-50 text-emerald-600" sub={stats?.inactive ? `${stats.inactive} inactive` : undefined} />
      </div>

      {/* ── Filters ────────────────────────────────────────────────── */}
      <div className="glass rounded-[2rem] p-5 mb-6 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full bg-white/60 border-2 border-white rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium outline-none focus:border-atul-pink_primary/30 transition-all"
            placeholder="Search by name or city…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Branch type filter */}
        <div className="flex items-center gap-1 bg-white/70 rounded-xl p-1 border border-white">
          {[
            { value: 'all',       label: 'All Types' },
            { value: 'own',       label: 'Own' },
            { value: 'franchise', label: 'Franchise' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilterType(f.value)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-bold transition-all',
                filterType === f.value
                  ? 'bg-atul-pink_primary text-white shadow-sm'
                  : 'text-atul-charcoal/60 hover:text-atul-charcoal'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 bg-white/70 rounded-xl p-1 border border-white">
          {[
            { value: 'all',      label: 'All' },
            { value: 'active',   label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-bold transition-all',
                filterStatus === f.value
                  ? 'bg-atul-pink_primary text-white shadow-sm'
                  : 'text-atul-charcoal/60 hover:text-atul-charcoal'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button onClick={load} className="size-10 bg-white border border-white rounded-xl flex items-center justify-center text-atul-charcoal/50 hover:text-atul-pink_primary transition-colors">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="glass rounded-[2rem] overflow-hidden flex-1 flex flex-col">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-4 px-6 py-4 border-b border-atul-pink_primary/10 bg-atul-pink_soft/20">
          {['Distributor',  'Branch Type', 'Credit / Discount', 'Manager', 'Status', 'Actions'].map(h => (
            <span key={h} className="text-[10px] font-black uppercase tracking-widest text-atul-charcoal/40">{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div className="overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-atul-pink_primary/30">
              <RefreshCw size={32} className="animate-spin" />
            </div>
          ) : distributors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-atul-charcoal/30">
              <Building2 size={56} strokeWidth={1} />
              <p className="font-serif text-xl italic">No distributors found</p>
              <button
                onClick={() => setModal({ type: 'add' })}
                className="mt-2 px-6 py-2.5 bg-atul-pink_primary text-white rounded-full text-sm font-bold shadow-lg shadow-atul-pink_primary/20 hover:scale-[1.03] transition-all"
              >
                Add your first distributor
              </button>
            </div>
          ) : (
            <AnimatePresence>
              {distributors.map((d, i) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: i * 0.04 }}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-4 px-6 py-5 border-b border-atul-pink_primary/5 hover:bg-white/50 transition-colors group"
                >
                  {/* Name + location */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-11 rounded-2xl bg-atul-pink_soft flex items-center justify-center text-atul-pink_primary flex-shrink-0 font-bold text-lg">
                      {d.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{d.name}</p>
                      <p className="text-[11px] text-atul-charcoal/40 flex items-center gap-1 truncate">
                        <MapPin size={10} />{d.city || '—'}
                        {d.outlet_code && <span className="ml-1 text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-mono">{d.outlet_code}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Branch type */}
                  <div className="w-32 text-center">
                    <BranchBadge type={d.branch_type} />
                  </div>

                  {/* Credit / Discount */}
                  <div className="w-36 text-right">
                    <p className="text-sm font-bold professional-digits">₹{Number(d.credit_limit || 0).toLocaleString()}</p>
                    <p className="text-[11px] text-atul-charcoal/40">{d.distributor_discount_pct || 0}% off MRP</p>
                  </div>

                  {/* Manager */}
                  <div className="w-36">
                    {d.manager ? (
                      <div>
                        <p className="text-sm font-bold truncate">{d.manager.full_name}</p>
                        <p className="text-[11px] text-atul-charcoal/40 truncate">{d.manager.email}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-atul-charcoal/30 italic">No manager</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="w-24 text-center">
                    <StatusBadge active={d.is_active} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => handleToggleActive(d)}
                      title={d.is_active ? 'Deactivate' : 'Activate'}
                      className={cn(
                        'size-8 rounded-xl flex items-center justify-center transition-all',
                        d.is_active
                          ? 'bg-red-50 text-red-400 hover:bg-red-100'
                          : 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100'
                      )}
                    >
                      {d.is_active ? <XCircle size={16} /> : <CheckCircle size={16} />}
                    </button>
                    <button
                      onClick={() => setModal({ type: 'edit', data: d })}
                      className="size-8 rounded-xl bg-atul-pink_soft text-atul-pink_primary hover:bg-atul-pink_primary hover:text-white flex items-center justify-center transition-all"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setModal({ type: 'delete', data: d })}
                      className="size-8 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Footer count */}
        {!loading && distributors.length > 0 && (
          <div className="px-6 py-3 border-t border-atul-pink_primary/10 bg-atul-pink_soft/10 text-xs text-atul-charcoal/40 font-medium">
            Showing {distributors.length} distributor{distributors.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal?.type === 'add' && (
          <DistributorModal mode="add" onClose={closeModal} onSaved={afterSave} />
        )}
        {modal?.type === 'edit' && (
          <DistributorModal mode="edit" distributor={modal.data} onClose={closeModal} onSaved={afterSave} />
        )}
        {modal?.type === 'delete' && (
          <DeleteModal distributor={modal.data} onClose={closeModal} onDeleted={afterSave} />
        )}
      </AnimatePresence>
    </div>
  );
}
