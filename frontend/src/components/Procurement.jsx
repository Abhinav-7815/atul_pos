import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Truck, 
  Plus, 
  Search, 
  X, 
  ChevronRight, 
  Calendar, 
  Tag, 
  DollarSign, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  MoreVertical,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { inventoryApi, menuApi } from '../services/api';
import { cn } from '../lib/utils';

export default function Procurement({ user }) {
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' for Purchase Orders, 'suppliers' for Suppliers
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);

  // Forms
  const [supplierForm, setSupplierForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '', gstin: '' });
  const [poForm, setPOForm] = useState({ supplier: '', outlet: user.outlet, items: [], notes: '' });

  useEffect(() => {
    fetchData();
  }, [activeTab, user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'pos') {
        const res = await inventoryApi.getPurchaseOrders({ outlet: user.outlet });
        const poData = res.data?.data || res.data?.results || res.data;
        setPurchaseOrders(Array.isArray(poData) ? poData : []);
        const prodRes = await menuApi.getProducts();
        setProducts(prodRes.data?.data || prodRes.data || []);
      } else {
        const res = await inventoryApi.getSuppliers();
        const supData = res.data?.data || res.data?.results || res.data;
        setSuppliers(Array.isArray(supData) ? supData : []);
      }
    } catch (err) {
      console.error("Data fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSupplier = async () => {
    try {
      await inventoryApi.createSupplier(supplierForm);
      setIsSupplierModalOpen(false);
      setSupplierForm({ name: '', contact_person: '', phone: '', email: '', address: '', gstin: '' });
      fetchData();
    } catch (err) {
      alert("Failed to create supplier");
    }
  };

  const handleReceivePO = async (id) => {
    try {
      await inventoryApi.receivePurchaseOrder(id);
      fetchData();
      setSelectedPO(null);
    } catch (err) {
      alert("Failed to receive PO");
    }
  };

  return (
    <div className="flex-1 p-8 h-screen overflow-hidden flex flex-col text-atul-charcoal relative">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-serif text-3xl font-bold">Procurement & Suppliers</h2>
          <p className="text-atul-pink_primary/60 text-sm mt-1 flex items-center gap-2">
            <Truck size={14} /> Handle stock incoming and vendor relationships
          </p>
        </div>
        
        <div className="flex gap-4">
          <div className="flex bg-white/40 p-1 rounded-2xl border border-atul-pink_primary/10">
            <button 
              onClick={() => setActiveTab('pos')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                activeTab === 'pos' ? "bg-atul-pink_primary text-white shadow-lg shadow-atul-pink_primary/20" : "text-atul-charcoal/40 hover:text-atul-pink_primary"
              )}
            >
              Purchase Orders
            </button>
            <button 
              onClick={() => setActiveTab('suppliers')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                activeTab === 'suppliers' ? "bg-atul-pink_primary text-white shadow-lg shadow-atul-pink_primary/20" : "text-atul-charcoal/40 hover:text-atul-pink_primary"
              )}
            >
              Suppliers
            </button>
          </div>

          <button 
            onClick={() => activeTab === 'pos' ? setIsPOModalOpen(true) : setIsSupplierModalOpen(true)}
            className="flex items-center gap-2 bg-atul-charcoal text-white px-6 py-3 rounded-2xl font-bold hover:scale-105 transition-all shadow-xl shadow-atul-charcoal/20"
          >
            <Plus size={18} />
            {activeTab === 'pos' ? 'New PO' : 'Add Supplier'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex gap-8 min-h-0 overflow-hidden">
        {/* List Section */}
        <div className="flex-[2] glass rounded-[2.5rem] overflow-hidden flex flex-col">
          <div className="p-6 border-b border-atul-pink_primary/5 bg-white/20 flex items-center justify-between">
            <div className="relative w-72">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-atul-pink_primary/30" size={16} />
               <input 
                 type="text" 
                 placeholder={`Search ${activeTab === 'pos' ? 'orders' : 'suppliers'}...`}
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-11 pr-4 py-2.5 bg-white/50 border border-atul-pink_primary/10 rounded-xl outline-none focus:ring-2 focus:ring-atul-pink_primary/10 text-sm"
               />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {activeTab === 'pos' ? (
              <div className="space-y-3">
                {purchaseOrders.map(po => (
                  <motion.div 
                    key={po.id}
                    layoutId={po.id}
                    onClick={() => setSelectedPO(po)}
                    className="group bg-white/60 hover:bg-white p-5 rounded-3xl border border-atul-pink_primary/5 shadow-sm hover:shadow-xl hover:shadow-atul-pink_primary/5 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "size-12 rounded-2xl flex items-center justify-center",
                        po.status === 'ordered' ? "bg-blue-50 text-blue-600" :
                        po.status === 'received' ? "bg-emerald-50 text-emerald-600" :
                        "bg-gray-50 text-gray-400"
                      )}>
                        {po.status === 'received' ? <CheckCircle2 size={24}/> : <Clock size={24}/>}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{po.po_number}</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                            po.status === 'ordered' ? "bg-blue-100 text-blue-700" :
                            po.status === 'received' ? "bg-emerald-100 text-emerald-700" :
                            "bg-gray-100 text-gray-500"
                          )}>{po.status}</span>
                        </div>
                        <p className="text-atul-charcoal/40 text-[10px] font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                          <User size={10} /> {po.supplier_name} • <Calendar size={10} /> {new Date(po.order_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="font-bold text-xl professional-digits">₹{Number(po.total_amount).toLocaleString()}</p>
                       <p className="text-[10px] font-bold text-atul-pink_primary/40 uppercase tracking-widest">Gross Total</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                   {suppliers.map(s => (
                     <div key={s.id} className="bg-white/60 p-6 rounded-[2rem] border border-atul-pink_primary/5 flex items-start gap-4">
                        <div className="size-14 rounded-2xl bg-atul-pink_soft text-atul-pink_primary flex items-center justify-center">
                           <User size={28}/>
                        </div>
                        <div className="flex-1">
                           <h4 className="font-bold text-lg leading-tight">{s.name}</h4>
                           <p className="text-xs text-atul-pink_primary/60 font-medium mb-3">{s.contact_person || 'N/A'}</p>
                           
                           <div className="space-y-1.5 opacity-60">
                              <p className="flex items-center gap-2 text-[10px]"><Phone size={12}/> {s.phone || 'N/A'}</p>
                              <p className="flex items-center gap-2 text-[10px]"><Mail size={12}/> {s.email || 'N/A'}</p>
                              <p className="flex items-center gap-2 text-[10px]"><Tag size={12}/> GPTIN: {s.gstin || 'N/A'}</p>
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
            )}
          </div>
        </div>

        {/* Action/Preview Sidebar */}
        <div className="w-[320px] flex flex-col gap-6">
           <div className="glass p-8 rounded-[2.5rem] flex flex-col items-center justify-center text-center gap-4 border-2 border-atul-pink_primary/5">
              <div className="size-16 rounded-[1.5rem] bg-gradient-to-br from-atul-pink_primary to-[#C2185B] text-white flex items-center justify-center shadow-2xl shadow-atul-pink_primary/30">
                 <Truck size={32}/>
              </div>
              <div>
                <h4 className="font-serif text-xl font-bold">Supply Chain Flow</h4>
                <p className="text-xs text-atul-charcoal/40 mt-1">Manage vendor payments and inventory refills seamlessly.</p>
              </div>
              <div className="w-full h-px bg-atul-pink_primary/10 my-2" />
              <div className="w-full space-y-3">
                 <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest">
                    <span className="text-atul-pink_primary/40">Active POs</span>
                    <span>{purchaseOrders.filter(p => p.status === 'ordered').length}</span>
                 </div>
                 <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest">
                    <span className="text-atul-pink_primary/40">Registered Vendors</span>
                    <span>{suppliers.length}</span>
                 </div>
              </div>
           </div>

           <div className="flex-1 glass p-6 rounded-[2.5rem] border border-atul-pink_primary/5 flex flex-col overflow-hidden">
              <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-atul-pink_primary/40 mb-4">Quick Insights</h5>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                 <div className="p-4 bg-atul-pink_soft/20 rounded-2xl border border-atul-pink_primary/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-atul-pink_primary flex items-center gap-2 mb-1">
                      <AlertCircle size={12}/> Low Stock Warning
                    </p>
                    <p className="text-xs font-semibold">Standard Waffle Cones (Large)</p>
                    <p className="text-[10px] text-atul-charcoal/40 mt-1">Stock Level: 12 Units</p>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedPO && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-atul-charcoal/40 backdrop-blur-md">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
                >
                   <div className="p-8 border-b border-atul-pink_primary/10 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                         <div className="size-14 rounded-2xl bg-atul-charcoal text-white flex items-center justify-center">
                            <ClipboardList size={28}/>
                         </div>
                         <div>
                            <h3 className="font-serif text-2xl font-bold">{selectedPO.po_number}</h3>
                            <p className="text-sm font-medium text-atul-pink_primary/60">Supplier: {selectedPO.supplier_name}</p>
                         </div>
                      </div>
                      <button onClick={() => setSelectedPO(null)} className="size-10 rounded-full hover:bg-gray-100 flex items-center justify-center">
                         <X size={24}/>
                      </button>
                   </div>

                   <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                      <div className="space-y-6">
                         <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 rounded-2xl">
                               <p className="text-[10px] font-black uppercase tracking-widest text-atul-charcoal/40 mb-1">Status</p>
                               <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                                selectedPO.status === 'received' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                               )}>{selectedPO.status}</span>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-2xl">
                               <p className="text-[10px] font-black uppercase tracking-widest text-atul-charcoal/40 mb-1">Order Date</p>
                               <p className="font-bold text-sm">{new Date(selectedPO.order_date).toDateString()}</p>
                            </div>
                         </div>

                         <div>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-atul-pink_primary/40 mb-3">Order Items</h4>
                            <div className="space-y-2">
                               {selectedPO.items?.map((item, idx) => (
                                 <div key={idx} className="flex items-center justify-between p-4 bg-white border border-atul-pink_primary/5 rounded-2xl shadow-sm">
                                    <div className="flex items-center gap-3">
                                       <div className="size-8 rounded-lg bg-atul-pink_soft flex items-center justify-center text-atul-pink_primary text-xs font-black">
                                          {item.quantity}
                                       </div>
                                       <div>
                                          <p className="text-sm font-bold">{item.product_name}</p>
                                          {item.variant_name && <p className="text-[10px] text-atul-charcoal/40">{item.variant_name}</p>}
                                       </div>
                                    </div>
                                    <div className="text-right">
                                       <p className="text-sm font-bold professional-digits">₹{Number(item.subtotal).toLocaleString()}</p>
                                       <p className="text-[10px] text-atul-charcoal/40 font-bold">@ ₹{item.unit_cost}</p>
                                    </div>
                                 </div>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="p-8 bg-gray-50 flex items-center justify-between gap-6">
                      <div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-atul-charcoal/40">Grand Total Payable</p>
                         <p className="text-3xl font-bold professional-digits">₹{Number(selectedPO.total_amount).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-3">
                         <button className="px-6 py-4 bg-white border border-atul-pink_primary/10 rounded-2xl font-bold text-sm hover:bg-gray-100 transition-colors flex items-center gap-2">
                            <Download size={18}/> Export PDF
                         </button>
                         {(selectedPO.status === 'ordered' || selectedPO.status === 'draft') && (
                           <button 
                             onClick={() => handleReceivePO(selectedPO.id)}
                             className="px-8 py-4 bg-atul-pink_primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-atul-pink_primary/20 hover:scale-[1.02] transition-all flex items-center gap-2 uppercase tracking-wide"
                           >
                              <CheckCircle2 size={18}/> Receive Goods
                           </button>
                         )}
                      </div>
                   </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Add Supplier Modal */}
      <AnimatePresence>
        {isSupplierModalOpen && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-atul-charcoal/40 backdrop-blur-md">
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden"
                >
                   <div className="p-8 border-b border-atul-pink_primary/10 flex items-center justify-between">
                      <h3 className="font-serif text-2xl font-bold">New Supplier Partnership</h3>
                      <button onClick={() => setIsSupplierModalOpen(false)} className="size-10 rounded-full hover:bg-gray-100 flex items-center justify-center">
                         <X size={24}/>
                      </button>
                   </div>
                   
                   <div className="p-8 space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-atul-pink_primary/60 ml-2">Company Name</label>
                            <input 
                              type="text"
                              value={supplierForm.name}
                              onChange={e => setSupplierForm({...supplierForm, name: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-atul-pink_primary/20 outline-none text-sm font-medium"
                              placeholder="e.g. Dairy Fresh Central"
                            />
                         </div>
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-atul-pink_primary/60 ml-2">Contact Person</label>
                            <input 
                              type="text"
                              value={supplierForm.contact_person}
                              onChange={e => setSupplierForm({...supplierForm, contact_person: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-atul-pink_primary/20 outline-none text-sm font-medium"
                              placeholder="Full Name"
                            />
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-atul-pink_primary/60 ml-2">Phone Number</label>
                            <input 
                              type="text"
                              value={supplierForm.phone}
                              onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-atul-pink_primary/20 outline-none text-sm font-medium"
                              placeholder="+91 XXXXX XXXXX"
                            />
                         </div>
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-atul-pink_primary/60 ml-2">Email Address</label>
                            <input 
                              type="email"
                              value={supplierForm.email}
                              onChange={e => setSupplierForm({...supplierForm, email: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-atul-pink_primary/20 outline-none text-sm font-medium"
                              placeholder="vendor@example.com"
                            />
                         </div>
                      </div>

                      <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-atul-pink_primary/60 ml-2">GSTIN Number</label>
                          <input 
                            type="text"
                            value={supplierForm.gstin}
                            onChange={e => setSupplierForm({...supplierForm, gstin: e.target.value})}
                            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-atul-pink_primary/20 outline-none text-sm font-bold uppercase tracking-widest placeholder:normal-case placeholder:font-medium"
                            placeholder="Optional"
                          />
                      </div>
                   </div>

                   <div className="p-8 bg-gray-50 flex gap-4">
                      <button onClick={() => setIsSupplierModalOpen(false)} className="flex-1 py-4 font-bold rounded-2xl bg-white border border-atul-pink_primary/10">Discard</button>
                      <button onClick={handleCreateSupplier} className="flex-[2] py-4 bg-atul-charcoal text-white rounded-2xl font-bold shadow-xl shadow-atul-charcoal/20 uppercase tracking-widest">Register Supplier</button>
                   </div>
                </motion.div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components would be next...
