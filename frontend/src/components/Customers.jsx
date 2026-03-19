import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { customerApi } from '../services/api';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  Star, 
  TrendingUp, 
  History,
  MoreVertical,
  X,
  CreditCard,
  UserPlus
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await customerApi.getCustomers({ search });
      const customerData = res.data?.data || res.data?.results || res.data;
      setCustomers(Array.isArray(customerData) ? customerData : []);
    } catch (err) {
      console.error("Failed to fetch customers", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async () => {
    try {
      await customerApi.createCustomer(newCustomer);
      setIsAddModalOpen(false);
      setNewCustomer({ name: '', phone: '', email: '' });
      fetchCustomers();
    } catch (err) {
      alert("Failed to add customer. Phone might be duplicate.");
    }
  };

  return (
    <div className="flex-1 p-8 h-screen overflow-hidden flex flex-col text-atul-charcoal">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-serif text-3xl font-bold">Customer Relations</h2>
          <p className="text-atul-pink_primary/60 text-sm mt-1">Manage loyalty and customer profiles</p>
        </div>
        <div className="flex gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-atul-pink_primary/40" size={18} />
            <input 
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white/50 backdrop-blur-md border border-atul-pink_primary/10 rounded-3xl w-64 focus:ring-2 focus:ring-atul-pink_primary/20 outline-none"
            />
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-atul-pink_primary text-white px-6 py-3 rounded-3xl font-bold shadow-lg shadow-atul-pink_primary/30"
          >
            <UserPlus size={18} /> New Customer
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {[
          { label: "Total Customers", value: customers.length, icon: <Users size={20}/>, color: "bg-blue-500" },
          { label: "Loyalty Points Issued", value: "48.2k", icon: <Star size={20}/>, color: "bg-amber-500" },
          { label: "Avg Customer Value", value: "₹420", icon: <TrendingUp size={20}/>, color: "bg-emerald-500" },
        ].map((s, i) => (
          <div key={i} className="glass p-6 rounded-[2rem] flex items-center gap-5">
            <div className={cn("size-12 rounded-2xl flex items-center justify-center text-white shadow-lg", s.color)}>
              {s.icon}
            </div>
            <div>
              <p className="text-[10px] font-bold text-atul-pink_primary/40 uppercase tracking-widest">{s.label}</p>
              <p className="text-2xl font-bold professional-digits">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Customer List */}
      <div className="flex-1 glass rounded-[2.5rem] overflow-hidden flex flex-col">
          <table className="w-full">
            <thead className="sticky top-0 bg-[#FFF5F8] text-[10px] uppercase font-bold text-atul-pink_primary/60 tracking-widest">
              <tr>
                <th className="px-8 py-4 text-left">Customer</th>
                <th className="px-8 py-4 text-left">Contact</th>
                <th className="px-8 py-4 text-center">Loyalty Pts</th>
                <th className="px-8 py-4 text-center">Total Spent</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="overflow-y-auto custom-scrollbar">
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-atul-pink_primary/5 hover:bg-atul-pink_primary/5 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                       <img 
                         src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || 'G')}&background=D63384&color=fff&bold=true`} 
                         className="size-10 rounded-full border-2 border-white shadow-sm" 
                         alt=""
                       />
                       <div>
                          <p className="font-bold text-sm">{c.name || 'Guest Customer'}</p>
                          <p className="text-[10px] text-atul-pink_primary/40 font-bold uppercase tracking-wider">Elite Member</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm font-medium">
                    <div className="flex flex-col gap-1">
                       <span className="flex items-center gap-1.5"><Phone size={12}/> {c.phone}</span>
                       <span className="flex items-center gap-1.5 opacity-40 italic"><Mail size={12}/> {c.email || 'no email'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-xs font-bold professional-digits">
                       {c.loyalty_points}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center font-bold professional-digits">
                    ₹{Number(c.total_spent).toLocaleString()}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="text-atul-pink_primary hover:bg-atul-pink_primary/10 size-8 rounded-full inline-flex items-center justify-center transition-colors">
                       <History size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-atul-charcoal/40 backdrop-blur-md">
            <motion.div 
               initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
               className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
               <div className="p-8 border-b border-atul-pink_primary/10 flex items-center justify-between">
                  <h3 className="font-serif text-2xl font-bold">New Customer</h3>
                  <button onClick={() => setIsAddModalOpen(false)}><X size={24}/></button>
               </div>
               <div className="p-8 space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase block mb-1">Full Name</label>
                    <input 
                      type="text"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                      className="w-full bg-gray-50 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-atul-pink_primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase block mb-1">Phone Number *</label>
                    <input 
                      type="text"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                      className="w-full bg-gray-50 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-atul-pink_primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase block mb-1">Email Address</label>
                    <input 
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                      className="w-full bg-gray-50 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-atul-pink_primary/20"
                    />
                  </div>
               </div>
               <div className="p-8 bg-gray-50 flex gap-4">
                  <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 font-bold">Cancel</button>
                  <button onClick={handleAddCustomer} className="flex-[2] py-4 bg-atul-pink_primary text-white rounded-2xl font-bold">Add Customer</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
