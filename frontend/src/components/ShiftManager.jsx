import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calculator, Receipt, LogOut, Play, 
  ArrowRight, CheckCircle2, AlertCircle, 
  History, Wallet, CreditCard, Smartphone,
  DollarSign, Hash, Clock, Printer, FileText,
  Plus, Minus, PlusCircle, X
} from 'lucide-react';
import { staffApi } from '../services/api';
import { cn } from '../lib/utils';

const StatCard = ({ label, value, icon: Icon, color = "atul-pink_primary" }) => (
  <div className="bg-white/60 backdrop-blur-sm p-6 rounded-[2rem] border border-white/40 shadow-sm flex items-center gap-4">
    <div className={cn("size-12 rounded-2xl flex items-center justify-center text-white shadow-lg", `bg-${color}`)}>
      <Icon size={20} />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-atul-charcoal/40 mb-1">{label}</p>
      <p className="text-2xl font-black text-atul-charcoal tracking-tighter">₹{parseFloat(value || 0).toLocaleString()}</p>
    </div>
  </div>
);

export default function ShiftManager({ user }) {
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isCashEntryModalOpen, setIsCashEntryModalOpen] = useState(false);
  const [cashEntryForm, setCashEntryForm] = useState({ entry_type: 'cash_out', amount: '', reason: '' });

  const fetchCurrentShift = async () => {
    try {
      setLoading(true);
      const res = await staffApi.getCurrentShift();
      const shiftRes = res.data?.data || res.data;
      if (shiftRes && shiftRes.active) {
        setActiveShift(shiftRes.shift);
        setStats(shiftRes.stats);
      } else {
        setActiveShift(null);
        setStats(null);
      }
    } catch (err) {
      console.error("Failed to fetch shift", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentShift();
  }, []);

  const handleOpenShift = async () => {
    try {
      setIsOpening(true);
      await staffApi.openShift({ 
        opening_balance: openingBalance || 0 
      });
      fetchCurrentShift();
    } catch (err) {
      alert("Failed to open shift");
    } finally {
      setIsOpening(false);
    }
  };

  const handleCloseShift = async () => {
    try {
      setIsClosing(true);
      await staffApi.closeShift({ 
        actual_cash: closingCash || 0 
      });
      fetchCurrentShift();
    } catch (err) {
      alert("Failed to close shift");
    } finally {
      setIsClosing(false);
    }
  };

  const handleAddCashEntry = async () => {
    try {
      if (!cashEntryForm.amount || !cashEntryForm.reason) return;
      await staffApi.addCashEntry(cashEntryForm);
      setIsCashEntryModalOpen(false);
      setCashEntryForm({ entry_type: 'cash_out', amount: '', reason: '' });
      fetchCurrentShift();
    } catch (err) {
      alert("Failed to record entry");
    }
  };

  if (loading) return <div className="p-12 font-serif text-atul-pink_primary italic animate-pulse">Syncing accounts...</div>;
  return (
    <div className="h-full flex flex-col bg-[#FDF3F6]/30 overflow-hidden relative">
      <header className="px-10 py-8 flex justify-between items-center bg-white/40 backdrop-blur-xl border-b border-white/50">
        <div>
          <h1 className="text-3xl font-black text-atul-charcoal tracking-tight font-serif uppercase italic">Shift & Register</h1>
          <p className="text-atul-pink_primary text-[10px] font-black uppercase tracking-[0.4em] mt-1">Cash Reconciliation Hub</p>
        </div>
        
        {activeShift && (
          <div className="flex items-center gap-4 bg-emerald-500/5 px-6 py-2.5 rounded-full border border-emerald-500/20">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest">Active Shift: {new Date(activeShift.start_time).toLocaleTimeString()}</span>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        {!activeShift ? (
          /* OPEN SHIFT FORM */
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-8"
          >
            <div className="bg-white/80 backdrop-blur-xl rounded-[3rem] p-12 border-2 border-white shadow-xl shadow-atul-pink_primary/5 text-center">
              <div className="size-24 bg-atul-pink_soft rounded-[2rem] flex items-center justify-center text-atul-pink_primary mx-auto mb-8 shadow-lg">
                <Calculator size={48} strokeWidth={1.5} />
              </div>
              <h2 className="text-4xl font-black text-atul-charcoal font-serif mb-2 italic">Open Register</h2>
              <p className="text-atul-gray/60 font-bold uppercase text-[11px] tracking-widest mb-12">Set your opening drawer balance to start billing</p>

              <div className="space-y-6 max-w-sm mx-auto">
                <div className="relative group">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-serif text-atul-pink_primary/40 group-focus-within:text-atul-pink_primary transition-colors">₹</span>
                  <input 
                    type="number"
                    placeholder="Enter Opening Balance"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="w-full bg-gray-50/50 border-white border-4 rounded-[2rem] pl-12 pr-8 py-6 text-3xl font-black text-atul-charcoal outline-none focus:border-atul-pink_primary/10 transition-all placeholder:text-atul-charcoal/10"
                  />
                </div>

                <button 
                  onClick={handleOpenShift}
                  disabled={isOpening}
                  className="w-full bg-atul-charcoal text-white py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-atul-charcoal/20 hover:bg-black transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  {isOpening ? 'Initializing...' : <><Play size={20} fill="white"/> Start Business Day</>}
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-atul-pink_primary/30 justify-center">
              <div className="h-px bg-current flex-1" />
              <History size={20} />
              <span className="text-[11px] font-black uppercase tracking-widest">Previous Shift History</span>
              <div className="h-px bg-current flex-1" />
            </div>
          </motion.div>
        ) : (
          /* ACTIVE SHIFT VIEW */
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="Expected Cash" value={
                parseFloat(activeShift.opening_balance) + 
                (stats?.payment_breakdown?.find(b => b.method === 'Cash')?.total || 0) +
                (activeShift.drawer_entries?.reduce((acc, e) => acc + (e.entry_type === 'cash_in' ? parseFloat(e.amount) : -parseFloat(e.amount)), 0) || 0)
              } icon={Wallet} color="atul-pink_primary" />
              <StatCard label="Total Sales" value={stats?.totals?.grand_total} icon={DollarSign} color="atul-charcoal" />
              <StatCard label="Net Petty Cash" value={
                activeShift.drawer_entries?.reduce((acc, e) => acc + (e.entry_type === 'cash_in' ? parseFloat(e.amount) : -parseFloat(e.amount)), 0)
              } icon={PlusCircle} color={activeShift.drawer_entries?.length > 0 ? "emerald-500" : "atul-charcoal"} />
              <StatCard label="Order Volume" value={stats?.order_count} icon={Hash} color="amber-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Payment Breakdown */}
              <div className="lg:col-span-2 bg-white/60 backdrop-blur-xl border-2 border-white rounded-[3rem] p-10 overflow-hidden relative">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-2xl font-black text-atul-charcoal font-serif italic">Cash Flow & Sales</h3>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsCashEntryModalOpen(true)}
                      className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-white bg-atul-charcoal px-6 py-2.5 rounded-full shadow-lg"
                    >
                      <Plus size={14} /> Cash Entry
                    </button>
                    <button className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-atul-pink_primary bg-atul-pink_soft/20 px-4 py-2 rounded-full">
                      <Printer size={14} /> X-Report
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {(stats?.payment_breakdown || []).map((method, idx) => (
                     <div key={idx} className="flex items-center justify-between p-6 bg-white/40 border border-white/60 rounded-3xl group hover:border-atul-pink_primary/20 transition-all">
                        <div className="flex items-center gap-6">
                           <div className="size-14 rounded-2xl bg-atul-cream flex items-center justify-center text-atul-pink_primary">
                              {method.method === 'Cash' && <Wallet size={24}/>}
                              {method.method === 'UPI' && <Smartphone size={24}/>}
                              {(method.method === 'Card' || method.method === 'Credit') && <CreditCard size={24}/>}
                           </div>
                           <div>
                              <p className="text-lg font-black text-atul-charcoal font-serif">{method.method}</p>
                              <p className="text-[11px] font-bold text-atul-gray/60 uppercase tracking-widest">Mode Performance</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-2xl font-black text-atul-charcoal tracking-tight">₹{method.total?.toLocaleString()}</p>
                           <div className="h-1.5 w-32 bg-atul-pink_soft/30 rounded-full mt-2 overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(method.total / (stats?.totals?.grand_total || 1)) * 100}%` }}
                                className="h-full bg-atul-pink_primary"
                              />
                           </div>
                        </div>
                     </div>
                  ))}
                  {(stats?.payment_breakdown || []).length === 0 && (
                    <div className="py-20 text-center opacity-20">
                      <AlertCircle size={48} className="mx-auto mb-4" />
                      <p className="font-serif italic text-xl">Waiting for first transaction scan...</p>
                    </div>
                  )}
                </div>

                {activeShift.drawer_entries?.length > 0 && (
                  <div className="mt-12">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-atul-pink_primary/40 mb-4 px-2">Petty Cash Ledger</h4>
                     <div className="bg-atul-cream/30 rounded-[2rem] overflow-hidden">
                        {activeShift.drawer_entries.map((entry, idx) => (
                           <div key={idx} className="flex justify-between items-center p-5 border-b border-atul-pink_primary/5 last:border-0">
                              <div className="flex items-center gap-4">
                                 <div className={cn("size-10 rounded-xl flex items-center justify-center font-bold", entry.entry_type === 'cash_in' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                                    {entry.entry_type === 'cash_in' ? <Plus size={16}/> : <Minus size={16}/>}
                                 </div>
                                 <div>
                                    <p className="text-sm font-bold text-atul-charcoal">{entry.reason}</p>
                                    <p className="text-[10px] text-atul-gray/40">{new Date(entry.created_at).toLocaleTimeString()}</p>
                                 </div>
                              </div>
                              <p className={cn("text-lg font-black", entry.entry_type === 'cash_in' ? "text-emerald-600" : "text-red-600")}>
                                {entry.entry_type === 'cash_in' ? '+' : '-'}₹{parseFloat(entry.amount).toLocaleString()}
                              </p>
                           </div>
                        ))}
                     </div>
                  </div>
                )}
              </div>

              {/* End Shift / Z-Report Actions */}
              <div className="space-y-6">
                <div className="bg-atul-charcoal text-white rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                    <LogOut size={120} />
                  </div>
                  <h3 className="text-2xl font-black font-serif italic mb-6 relative z-10">Close Terminal</h3>
                  <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest mb-10 relative z-10">Generate Z-Report & Freeze Books</p>
                  
                  <div className="space-y-6 relative z-10">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3 block">Actual Cash in Drawer</label>
                      <input 
                        type="number"
                        placeholder="Count your cash..."
                        value={closingCash}
                        onChange={(e) => setClosingCash(e.target.value)}
                        className="w-full bg-white/10 border-white/20 border-2 rounded-2xl p-4 font-black outline-none focus:border-white/40 text-white text-xl placeholder:text-white/20"
                      />
                    </div>
                    
                    <button 
                      onClick={handleCloseShift}
                      disabled={isClosing}
                      className="w-full bg-white text-atul-charcoal py-5 rounded-2xl font-black text-[12px] uppercase tracking-widest hover:bg-atul-pink_soft transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isClosing ? 'Finalizing...' : 'Close & Finalize (Z-Report)'}
                    </button>

                    <p className="text-[9px] text-white/30 italic text-center">Closing the shift will automatically log you out and prepare the daily summary.</p>
                  </div>
                </div>

                <div className="bg-white/60 backdrop-blur-sm border border-white/40 p-10 rounded-[3rem]">
                   <h4 className="font-serif font-black text-lg text-atul-charcoal mb-4 flex items-center gap-2">
                    <Clock size={18} className="text-atul-pink_primary"/> Shift Timeline
                   </h4>
                   <div className="space-y-6">
                      <div className="flex gap-4">
                        <div className="w-0.5 bg-atul-pink_soft relative my-1">
                          <div className="absolute top-0 -left-1.5 size-3 rounded-full bg-atul-pink_primary" />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-atul-charcoal uppercase tracking-tighter">Shift Started</p>
                          <p className="text-[10px] font-bold text-atul-gray">{new Date(activeShift.start_time).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-0.5 bg-atul-pink_soft/20 relative my-1">
                          <div className="absolute top-0 -left-1.5 size-3 rounded-full bg-atul-pink_soft/20 ring-4 ring-white" />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-atul-charcoal/30 uppercase tracking-tighter">Shift In Progress...</p>
                          <p className="text-[10px] font-bold text-atul-gray/30">Total active time: {Math.floor((new Date() - new Date(activeShift.start_time))/3600000)}h {Math.floor(((new Date() - new Date(activeShift.start_time))%3600000)/60000)}m</p>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    {/* Petty Cash Modal */}
    <AnimatePresence>
      {isCashEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCashEntryModalOpen(false)}
            className="absolute inset-0 bg-atul-charcoal/40 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl relative z-10 p-10"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black font-serif italic text-atul-charcoal">Record Cash Entry</h2>
              <button 
                onClick={() => setIsCashEntryModalOpen(false)}
                className="size-10 rounded-full bg-atul-pink_soft/20 flex items-center justify-center text-atul-pink_primary"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-1 bg-atul-cream rounded-2xl">
                <button 
                  onClick={() => setCashEntryForm(f => ({ ...f, entry_type: 'cash_in' }))}
                  className={cn(
                    "py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                    cashEntryForm.entry_type === 'cash_in' ? "bg-white text-emerald-600 shadow-sm" : "text-atul-gray/40"
                  )}
                >Cash IN / Float</button>
                <button 
                  onClick={() => setCashEntryForm(f => ({ ...f, entry_type: 'cash_out' }))}
                  className={cn(
                    "py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                    cashEntryForm.entry_type === 'cash_out' ? "bg-white text-red-600 shadow-sm" : "text-atul-gray/40"
                  )}
                >Cash OUT / Expense</button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40 ml-2">Amount (₹)</label>
                <input 
                  type="number"
                  placeholder="0.00"
                  value={cashEntryForm.amount}
                  onChange={(e) => setCashEntryForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-white rounded-2xl p-5 text-2xl font-black outline-none focus:border-atul-pink_primary/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-atul-gray/40 ml-2">Reason / Note</label>
                <input 
                  type="text"
                  placeholder="e.g., Local milk purchase"
                  value={cashEntryForm.reason}
                  onChange={(e) => setCashEntryForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-white rounded-2xl p-5 font-bold outline-none focus:border-atul-pink_primary/20"
                />
              </div>

              <button 
                onClick={handleAddCashEntry}
                className="w-full bg-atul-charcoal text-white py-6 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-black transition-all active:scale-95 mt-4 shadow-xl"
              >
                Post Transaction
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </div>
  );
}
