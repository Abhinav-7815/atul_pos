import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { staffApi } from '../services/api';
import { 
  BadgeCheck, 
  Clock, 
  Wallet, 
  History, 
  LogOut, 
  PlayCircle, 
  ChevronRight, 
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  FileText,
  User,
  X
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

export default function Staff({ user }) {
  const [currentShift, setCurrentShift] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [currentRes, historyRes] = await Promise.all([
        staffApi.getCurrentShift(),
        staffApi.getShifts({ limit: 5 })
      ]);
      
      const currentData = currentRes.data?.data || currentRes.data;
      if (currentData && (currentData.active || currentData.shift)) {
        setCurrentShift({
          ...(currentData.shift || currentData),
          stats: currentData.stats || {}
        });
      } else {
        setCurrentShift(null);
      }

      const historyData = historyRes.data?.data || historyRes.data?.results || historyRes.data;
      setShifts(Array.isArray(historyData) ? historyData : []);
    } catch (err) {
      console.error("Staff data fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async () => {
    try {
      await staffApi.openShift({ 
        opening_balance: openingBalance || 0,
        notes: notes
      });
      setIsOpeningShift(false);
      setOpeningBalance('');
      setNotes('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to open shift");
    }
  };

  const handleCloseShift = async () => {
    try {
      await staffApi.closeShift({ 
        actual_cash: closingCash || 0,
        notes: notes
      });
      setIsClosingShift(false);
      setClosingCash('');
      setNotes('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to close shift");
    }
  };

  return (
    <div className="flex-1 p-8 h-screen overflow-y-auto custom-scrollbar flex flex-col text-atul-charcoal">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-serif text-3xl font-bold">Staff & Shifts</h2>
          <p className="text-atul-pink_primary/60 text-sm mt-1">Manage duty cycles and cash accountability</p>
        </div>
        <div className="flex items-center gap-3 bg-white/50 backdrop-blur-md px-5 py-2.5 rounded-full border border-white">
           <div className="size-8 bg-atul-pink_primary/10 rounded-full flex items-center justify-center text-atul-pink_primary">
              <User size={16}/>
           </div>
           <span className="text-sm font-bold">{user?.full_name}</span>
           <span className="text-[10px] bg-atul-pink_soft text-atul-pink_primary px-2 py-0.5 rounded-full font-black uppercase tracking-wider">{user?.role}</span>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8 mb-10">
        {/* Left Col: Current Status */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
           <div className={cn(
             "glass overflow-hidden rounded-[2.5rem] border-2 transition-all duration-500",
             currentShift ? "border-emerald-500/20" : "border-atul-pink_primary/10"
           )}>
              <div className="p-8 pb-4">
                 <div className="flex items-center justify-between mb-6">
                    <h3 className="font-serif font-bold text-xl">Current Session</h3>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest leading-none",
                      currentShift ? "bg-emerald-50 text-emerald-600 animate-pulse" : "bg-atul-pink_soft text-atul-pink_primary"
                    )}>
                      {currentShift ? 'ACTIVE DUTY' : 'SHIFT CLOSED'}
                    </span>
                 </div>

                 {currentShift ? (
                    <div className="space-y-6">
                       <div className="flex items-center gap-6">
                          <div className="size-16 rounded-3xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                             <Clock size={32}/>
                          </div>
                          <div>
                             <p className="text-[10px] font-bold text-atul-gray uppercase tracking-widest">Started Today At</p>
                             <p className="text-2xl font-bold professional-digits">
                                {currentShift?.start_time ? new Date(currentShift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                             </p>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/40 p-5 rounded-3xl border border-white/50">
                             <p className="text-[10px] font-bold text-atul-gray uppercase tracking-widest mb-1">Opening Cash</p>
                             <p className="text-xl font-bold text-atul-charcoal professional-digits">₹{Number(currentShift?.opening_balance || 0).toLocaleString()}</p>
                          </div>
                          <div className="bg-white/40 p-5 rounded-3xl border border-white/50">
                             <p className="text-[10px] font-bold text-atul-gray uppercase tracking-widest mb-1">Orders Today</p>
                             <p className="text-xl font-bold text-atul-charcoal professional-digits">{currentShift?.stats?.order_count || 0}</p>
                          </div>
                       </div>
                    </div>
                 ) : (
                    <div className="py-8 flex flex-col items-center text-center">
                       <div className="size-20 bg-atul-pink_soft rounded-[2rem] flex items-center justify-center text-atul-pink_primary mb-6">
                          <PlayCircle size={40} strokeWidth={1.5}/>
                       </div>
                       <h4 className="font-bold text-lg mb-2">No Active Shift</h4>
                       <p className="text-sm text-atul-gray/60 max-w-[200px] mb-8">You need to open a shift to proceed with billing and orders.</p>
                       <button 
                         onClick={() => setIsOpeningShift(true)}
                         className="w-full py-4 bg-atul-pink_primary text-white rounded-[2rem] font-bold shadow-xl shadow-atul-pink_primary/30 hover:scale-[1.02] active:scale-95 transition-all"
                       >
                         Start New Shift
                       </button>
                    </div>
                 )}
              </div>
              
              {currentShift && (
                 <div className="p-8 bg-black/5 flex items-center gap-4">
                    <button 
                      onClick={() => setIsClosingShift(true)}
                      className="flex-1 py-4 bg-atul-charcoal text-white rounded-[2rem] font-bold hover:bg-black transition-all flex items-center justify-center gap-2"
                    >
                       <LogOut size={18}/> End My Shift
                    </button>
                 </div>
              )}
           </div>
        </div>

        {/* Right Col: Shift History */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
           <div className="glass rounded-[2.5rem] flex-1 flex flex-col overflow-hidden">
              <div className="p-8 border-b border-atul-pink_primary/10 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <History className="text-atul-pink_primary" size={24}/>
                    <h3 className="font-serif font-bold text-xl">Recent Shifts</h3>
                 </div>
              </div>
              <div className="overflow-y-auto custom-scrollbar flex-1">
                 {shifts.map((s, i) => (
                    <div key={s.id} className="p-6 border-b border-atul-pink_primary/5 hover:bg-white/40 transition-colors group">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className="size-10 rounded-xl bg-gray-100 flex items-center justify-center text-atul-gray group-hover:bg-atul-pink_soft group-hover:text-atul-pink_primary transition-colors">
                                <FileText size={20}/>
                             </div>
                             <div>
                                <p className="font-bold text-sm">{new Date(s.start_time).toLocaleDateString()}</p>
                                <p className="text-[10px] text-atul-gray/60 font-medium">
                                   {new Date(s.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} 
                                   {' → '} 
                                   {s.end_time ? new Date(s.end_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Active'}
                                </p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="font-bold text-atul-charcoal professional-digits">₹{Number(s.actual_cash || 0).toLocaleString()}</p>
                             <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Completed</p>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {/* Opening/Closing Modals */}
      <AnimatePresence>
        {(isOpeningShift || isClosingShift) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-atul-charcoal/40 backdrop-blur-md">
            <motion.div 
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
               <div className="p-8 border-b border-atul-pink_primary/10 flex items-center justify-between bg-gradient-to-r from-atul-pink_soft/20 to-transparent">
                  <div className="flex items-center gap-4">
                     <div className="size-12 rounded-2xl bg-atul-pink_primary text-white flex items-center justify-center">
                        <IndianRupee size={24}/>
                     </div>
                     <div>
                       <h3 className="font-serif text-2xl font-bold">{isOpeningShift ? 'Open Shift' : 'End Shift'}</h3>
                       <p className="text-sm text-atul-pink_primary/60">{isOpeningShift ? 'Declare opening cash' : 'Declare actual collections'}</p>
                     </div>
                  </div>
                  <button onClick={() => {setIsOpeningShift(false); setIsClosingShift(false);}} className="size-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-atul-gray">
                     <X size={24}/>
                  </button>
               </div>

               <div className="p-8 space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-widest block mb-1.5 ml-1">
                       {isOpeningShift ? 'Opening Balance (Cash in Tray)' : 'Actual Cash in Hand'}
                    </label>
                    <div className="relative">
                       <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-atul-charcoal/40">₹</span>
                       <input 
                         type="number"
                         value={isOpeningShift ? openingBalance : closingCash}
                         onChange={(e) => isOpeningShift ? setOpeningBalance(e.target.value) : setClosingCash(e.target.value)}
                         className="w-full bg-gray-50 border-white border-2 rounded-2xl py-4 pl-10 pr-6 text-xl font-bold professional-digits outline-none focus:border-atul-pink_primary/30 focus:ring-4 focus:ring-atul-pink_primary/5 transition-all text-atul-charcoal"
                         placeholder="0.00"
                       />
                    </div>
                  </div>

                  <div>
                     <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-widest block mb-1.5 ml-1">Notes</label>
                     <textarea 
                       value={notes}
                       onChange={(e) => setNotes(e.target.value)}
                       className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-atul-pink_primary/20 outline-none"
                       placeholder="Optional remarks..."
                       rows={3}
                     />
                  </div>
               </div>

               <div className="p-8 bg-gray-50 flex gap-4">
                  <button onClick={() => {setIsOpeningShift(false); setIsClosingShift(false);}} className="flex-1 py-4 bg-white border border-atul-pink_primary/10 rounded-2xl font-bold hover:bg-gray-100 transition-colors">
                    Cancel
                  </button>
                  <button 
                    onClick={isOpeningShift ? handleOpenShift : handleCloseShift}
                    className="flex-[2] py-4 bg-atul-pink_primary text-white rounded-2xl font-bold shadow-xl shadow-atul-pink_primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest"
                  >
                    Confirm {isOpeningShift ? 'Open' : 'Close'}
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
