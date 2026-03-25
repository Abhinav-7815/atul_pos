import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { outletApi } from '../services/api';
import { 
  Store, 
  Receipt, 
  Percent, 
  Save, 
  MapPin, 
  Phone, 
  Mail, 
  CreditCard,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Layout
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function Settings({ user, onUpdateUser }) {
  const [outlet, setOutlet] = useState({ 
    name: '', 
    phone: '', 
    email: '', 
    address: '', 
    city: '',
    outlet_code: '',
    gstin: '', 
    fssai_number: '',
    base_tax_rate: 5.0,
    receipt_header: '',
    receipt_footer: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [success, setSuccess] = useState(false);

  const [navConfig, setNavConfig] = useState({
    dashboard_visible: true,
    pos_visible: true,
    kds_visible: true,
    shift_visible: true,
    menu_visible: true,
    inventory_visible: true,
    procurement_visible: true,
    customers_visible: true,
    staff_visible: true,
    reports_visible: true,
    distributors_visible: true,
    distribution_visible: true,
    settings_visible: true,
  });

  useEffect(() => {
    fetchOutlet();
    const nav = JSON.parse(localStorage.getItem('atul_pos_nav_config') || '{}');
    setNavConfig({
      dashboard_visible: nav.dashboard_visible ?? true,
      pos_visible: nav.pos_visible ?? true,
      kds_visible: nav.kds_visible ?? true,
      shift_visible: nav.shift_visible ?? true,
      menu_visible: nav.menu_visible ?? true,
      inventory_visible: nav.inventory_visible ?? true,
      procurement_visible: nav.procurement_visible ?? true,
      customers_visible: nav.customers_visible ?? true,
      staff_visible: nav.staff_visible ?? true,
      reports_visible: nav.reports_visible ?? true,
      distributors_visible: nav.distributors_visible ?? true,
      distribution_visible: nav.distribution_visible ?? true,
      settings_visible: nav.settings_visible ?? true,
    });
  }, [user?.outlet]);

  const fetchOutlet = async () => {
    try {
      setLoading(true);
      let data;
      if (user?.outlet) {
        const res = await outletApi.getOutlet(user.outlet);
        data = res.data?.data || res.data;
      } else {
        // Fallback: fetch all outlets and use the first one
        const res = await outletApi.getOutlets();
        const list = res.data?.data || res.data || [];
        data = Array.isArray(list) ? list[0] : list;
      }
      if (data) setOutlet(data);
    } catch (err) {
      console.error("Failed to fetch outlet settings", err);
    } finally {
      setLoading(false);
    }
  };

  const handleNavToggle = (key) => {
    const newConfig = { ...navConfig, [key]: !navConfig[key] };
    setNavConfig(newConfig);
    localStorage.setItem('atul_pos_nav_config', JSON.stringify(newConfig));
    window.dispatchEvent(new Event('navConfigChanged'));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (outlet.id) {
        const res = await outletApi.updateOutlet(outlet.id, outlet);
        const updated = res.data?.data || res.data;
        setOutlet(updated);
        if (onUpdateUser) onUpdateUser(updated);
      } else {
        const res = await outletApi.createOutlet(outlet);
        const updated = res.data?.data || res.data;
        setOutlet(updated);
        if (onUpdateUser) onUpdateUser(updated);
      }
      localStorage.setItem('atul_pos_nav_config', JSON.stringify(navConfig));
      // Dispatch custom event to notify App.jsx of navigation changes
      window.dispatchEvent(new Event('navConfigChanged'));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Settings Update Failed:", err.response?.data);
      const respData = err.response?.data;
      let errorMsg = "Update failed";
      
      if (respData) {
        // Handle nested error formats (e.g., { success: false, data: { city: [] } })
        const errors = respData.data || respData;
        
        if (typeof errors === 'object' && errors !== null) {
          errorMsg = Object.entries(errors)
            .map(([key, value]) => {
              const valDisplay = typeof value === 'object' ? JSON.stringify(value) : value;
              return `${key}: ${valDisplay}`;
            })
            .join('\n');
        } else if (typeof errors === 'string') {
          errorMsg = errors;
        }
      }
      alert(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 font-serif animate-pulse">Loading settings...</div>;
  if (!outlet) return <div className="p-8 font-serif text-red-500">Failed to load outlet configuration. Please check your connection or backend setup.</div>;

  return (
    <div className="flex-1 p-8 h-screen overflow-hidden flex flex-col text-atul-charcoal">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-serif text-3xl font-bold">Terminal Settings</h2>
          <p className="text-atul-pink_primary/60 text-sm mt-1">Configure your outlet profile and receipt preferences</p>
        </div>
        <button 
           onClick={handleUpdate}
           disabled={saving}
           className="flex items-center gap-2 bg-atul-pink_primary text-white px-8 py-3 rounded-3xl font-bold shadow-lg shadow-atul-pink_primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : success ? <><CheckCircle size={18}/> Saved</> : <><Save size={18}/> Save Changes</>}
        </button>
      </header>

      <div className="flex-1 flex gap-8 min-h-0">
          {/* Tabs Sidebar */}
          <div className="w-64 space-y-2">
             {[
               { id: 'general', label: 'Store Profile', icon: <Store size={20}/> },
               { id: 'tax', label: 'Taxes & GST', icon: <Percent size={20}/> },
               { id: 'receipt', label: 'Receipt Designer', icon: <Receipt size={20}/> },
               user?.role === 'superadmin' && { id: 'navigation', label: 'Access Control', icon: <ShieldCheck size={20}/> },
             ].filter(Boolean).map(t => (
               <button 
                 key={t.id}
                 onClick={() => setActiveTab(t.id)}
                 className={cn(
                   "w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-sm transition-all",
                   activeTab === t.id ? "bg-atul-pink_primary text-white shadow-lg" : "text-atul-gray hover:bg-white/50"
                 )}
               >
                 {t.icon} {t.label}
               </button>
             ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 glass rounded-[2.5rem] p-10 overflow-y-auto custom-scrollbar">
             <form onSubmit={handleUpdate} className={cn("space-y-8 transition-all duration-500", activeTab === 'navigation' ? "max-w-5xl" : "max-w-2xl")}>
                
                {activeTab === 'general' && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <h3 className="text-xl font-serif font-bold mb-6 flex items-center gap-3">
                       <div className="size-10 bg-atul-pink_soft rounded-xl flex items-center justify-center text-atul-pink_primary">
                          <Store size={20}/>
                       </div>
                       General Info
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                       <div className="col-span-2">
                          <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-widest block mb-2">Outlet Name</label>
                          <input 
                            value={outlet.name}
                            onChange={(e) => setOutlet({...outlet, name: e.target.value})}
                            className="w-full bg-gray-50/50 border-white border-2 rounded-2xl p-4 font-bold outline-none focus:border-atul-pink_primary/20"
                          />
                       </div>
                       <div>
                          <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-widest block mb-2">Phone</label>
                          <input 
                            value={outlet.phone}
                            onChange={(e) => setOutlet({...outlet, phone: e.target.value})}
                            className="w-full bg-gray-50/50 border-white border-2 rounded-2xl p-4 font-bold outline-none focus:border-atul-pink_primary/20"
                          />
                       </div>
                       <div>
                          <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-widest block mb-2">Email</label>
                          <input 
                            value={outlet.email}
                            onChange={(e) => setOutlet({...outlet, email: e.target.value})}
                            className="w-full bg-gray-50/50 border-white border-2 rounded-2xl p-4 font-bold outline-none focus:border-atul-pink_primary/20"
                          />
                       </div>
                       <div className="col-span-2">
                          <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-widest block mb-2">Full Address</label>
                          <textarea 
                            value={outlet.address}
                            onChange={(e) => setOutlet({...outlet, address: e.target.value})}
                            className="w-full bg-gray-50/50 border-white border-2 rounded-2xl p-4 font-bold outline-none focus:border-atul-pink_primary/20"
                            rows={2}
                          />
                       </div>
                       <div>
                          <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-widest block mb-2">City</label>
                          <input 
                            value={outlet.city}
                            onChange={(e) => setOutlet({...outlet, city: e.target.value})}
                            placeholder="e.g. Ahmedabad"
                            className="w-full bg-gray-50/50 border-white border-2 rounded-2xl p-4 font-bold outline-none focus:border-atul-pink_primary/20"
                          />
                       </div>
                       <div>
                          <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-widest block mb-2">Outlet Code (Slug)</label>
                          <input 
                            value={outlet.outlet_code}
                            onChange={(e) => setOutlet({...outlet, outlet_code: e.target.value})}
                            placeholder="e.g. vastrapur-01"
                            className="w-full bg-gray-50/50 border-white border-2 rounded-2xl p-4 font-bold outline-none focus:border-atul-pink_primary/20"
                          />
                       </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'tax' && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h3 className="text-xl font-serif font-bold mb-6 flex items-center gap-3">
                       <div className="size-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                          <Percent size={20}/>
                       </div>
                       Taxation Setup
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                       <div>
                          <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-widest block mb-2">GSTIN Number</label>
                          <input 
                            value={outlet.gstin || ''}
                            onChange={(e) => setOutlet({...outlet, gstin: e.target.value})}
                            placeholder="e.g. 24AAAAA0000A1Z5"
                            className="w-full bg-gray-50/50 border-white border-2 rounded-2xl p-4 font-bold outline-none focus:border-atul-pink_primary/20"
                          />
                       </div>
                       <div>
                          <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-widest block mb-2">Standard Tax Rate (%)</label>
                          <input 
                            type="number"
                            value={outlet.base_tax_rate}
                            onChange={(e) => setOutlet({...outlet, base_tax_rate: e.target.value})}
                            className="w-full bg-gray-50/50 border-white border-2 rounded-2xl p-4 font-bold outline-none focus:border-atul-pink_primary/20"
                          />
                       </div>
                       <div className="col-span-2 p-6 bg-amber-50 rounded-3xl border border-amber-200">
                          <div className="flex gap-4">
                             <AlertCircle className="text-amber-600 shrink-0" size={24}/>
                             <div>
                                <p className="text-sm font-bold text-amber-900">Tax Note</p>
                                <p className="text-xs text-amber-700 mt-1">Changing the standard rate will affect all new orders immediately. Past orders will not be updated.</p>
                             </div>
                          </div>
                       </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'receipt' && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h3 className="text-xl font-serif font-bold mb-6 flex items-center gap-3">
                       <div className="size-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                          <Receipt size={20}/>
                       </div>
                       Receipt Designer
                    </h3>
                    <div>
                       <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-widest block mb-2">Receipt Header</label>
                       <textarea 
                         value={outlet.receipt_header || ''}
                         onChange={(e) => setOutlet({...outlet, receipt_header: e.target.value})}
                         placeholder="e.g. Welcome to Atul Ice Cream!"
                         className="w-full bg-gray-50/50 border-white border-2 rounded-2xl p-4 font-bold outline-none focus:border-atul-pink_primary/20 text-center"
                         rows={2}
                       />
                    </div>
                    <div>
                       <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-widest block mb-2">Receipt Footer</label>
                       <textarea 
                         value={outlet.receipt_footer || ''}
                         onChange={(e) => setOutlet({...outlet, receipt_footer: e.target.value})}
                         placeholder="e.g. Thank you, Visit Again!"
                         className="w-full bg-gray-50/50 border-white border-2 rounded-2xl p-4 font-bold outline-none focus:border-atul-pink_primary/20 text-center"
                         rows={2}
                       />
                    </div>
                    
                    {/* Live Preview */}
                    <div className="pt-6">
                       <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-widest block mb-4">Live Preview (Thermal 80mm)</label>
                       <div className="bg-white border-atul-pink_primary/10 border p-10 max-w-sm mx-auto shadow-xl rounded-lg font-mono text-[10px] text-atul-charcoal uppercase text-center space-y-2">
                          <p className="font-bold text-[14px]">{outlet.name}</p>
                          <p className="whitespace-pre-wrap">{outlet.address}</p>
                          <p>{outlet.receipt_header}</p>
                          <div className="border-t border-dashed border-atul-charcoal my-4"></div>
                          <div className="flex justify-between font-bold">
                             <span>ITEM TOTAL (3)</span>
                             <span>₹420.00</span>
                          </div>
                          <div className="flex justify-between">
                             <span>GST ({outlet.base_tax_rate}%)</span>
                             <span>₹21.00</span>
                          </div>
                          <div className="border-t border-dashed border-atul-charcoal my-4"></div>
                          <div className="flex justify-between font-bold text-lg">
                             <span>PAID</span>
                             <span>₹441.00</span>
                          </div>
                          <div className="border-t border-dashed border-atul-charcoal my-4"></div>
                          <p className="italic">{outlet.receipt_footer}</p>
                       </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'navigation' && user?.role === 'superadmin' && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8 pb-10">
                     <div>
                        <h3 className="text-xl font-serif font-bold mb-2 flex items-center gap-3">
                           <div className="size-10 bg-atul-pink_soft rounded-xl flex items-center justify-center text-atul-pink_primary">
                              <ShieldCheck size={20}/>
                           </div>
                           Access & Permissions
                        </h3>
                         <p className="text-[11px] font-bold text-atul-pink_primary/40 uppercase tracking-widest pl-13">Choose which pages are active on this terminal for ALL users</p>
                     </div>

                      <div className="bg-white/40 rounded-[2.5rem] border border-white/60 overflow-hidden shadow-sm">
                        <div className="grid grid-cols-2">
                           {[
                             { key: 'dashboard_visible', label: 'Management Dashboard', desc: 'Central analytics and sales overview.' },
                             { key: 'pos_visible', label: 'Billing POS', desc: 'The main sales and billing point.' },
                             // { key: 'kds_visible', label: 'Kitchen Display (KDS)', desc: 'Live order tracking for kitchen staff.' },
                             // { key: 'shift_visible', label: 'Day Close / Shift', desc: 'Financial day closing and cash handling.' },
                             { key: 'menu_visible', label: 'Menu Catalog', desc: 'Manage product categories and pricing.' },
                             { key: 'inventory_visible', label: 'Inventory Control', desc: 'Check stock levels and perform stock takes.' },
                             // { key: 'procurement_visible', label: 'Procurement', desc: 'Create and manage purchase orders.' },
                             // { key: 'customers_visible', label: 'Customer CRM', desc: 'View customer loyalty and purchase data.' },
                             // { key: 'staff_visible', label: 'Staff Management', desc: 'Manage employee access and logs.' },
                             { key: 'reports_visible', label: 'Financial Reports', desc: 'Deep dive into revenue and performance.' },
                             { key: 'distributors_visible', label: 'Distributors', desc: 'Manage your distribution network supply.' },
                             { key: 'distribution_visible', label: 'Distribution Hub', desc: 'Central management for main distribution outlets.' },
                             { key: 'settings_visible', label: 'Terminal Settings', desc: 'Configure printer, receipt and terminal profile.' },
                           ].map((item, idx) => (
                              <div 
                                 key={item.key} 
                                 className={cn(
                                    "flex items-center justify-between p-6 hover:bg-white/30 transition-colors border-white/40",
                                    idx % 2 !== 0 && "border-l",
                                    idx >= 2 && "border-t"
                                 )}
                              >
                                 <div className="flex-1 min-w-0 pr-4">
                                    <p className="text-[14px] font-bold text-atul-charcoal">{item.label}</p>
                                    <p className="text-[10px] text-atul-gray mt-0.5 leading-relaxed font-medium">{item.desc}</p>
                                 </div>
                                 <button 
                                   type="button"
                                   onClick={() => handleNavToggle(item.key)}
                                   className={cn(
                                     "w-12 h-6 rounded-full transition-all relative flex items-center px-1 shadow-inner shrink-0",
                                     navConfig[item.key] ? "bg-atul-pink_primary" : "bg-gray-200"
                                   )}
                                 >
                                    <motion.div 
                                      animate={{ x: navConfig[item.key] ? 24 : 0 }}
                                      className="size-4 bg-white rounded-full shadow-sm"
                                    />
                                 </button>
                              </div>
                           ))}
                        </div>
                     </div>

                     <div className="p-6 bg-atul-pink_soft/30 rounded-3xl border border-atul-pink_soft flex gap-4 items-start">
                        <div className="text-atul-pink_primary mt-0.5"><Layout size={18}/></div>
                        <div>
                           <p className="text-xs font-bold text-atul-pink_primary uppercase tracking-tight">Security Note</p>
                           <p className="text-[10px] text-atul-charcoal/60 mt-1 leading-relaxed">Changes made here will apply globally for this terminal immediately after saving. To enforce these changes on other devices, please sync or update those terminals.</p>
                        </div>
                     </div>
                  </motion.div>
                )}

             </form>
          </div>
      </div>
    </div>
  );
}
