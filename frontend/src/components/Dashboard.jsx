import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { analyticsApi, orderApi } from '../services/api';
import { Trash2, ShieldAlert, X, Check } from 'lucide-react';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const MaterialIcon = ({ name, className = "", fill = false }) => (
  <span className={`material-symbols-outlined ${fill ? 'fill-1' : ''} ${className}`} style={{ fontSize: 'inherit' }}>
    {name}
  </span>
);

export default function Dashboard({ user, onNewOrder }) {
  const [stats, setStats] = useState(null);
  const [liveOrders, setLiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voidingOrder, setVoidingOrder] = useState(null);
  const [voidPin, setVoidPin] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, ordersRes] = await Promise.all([
          analyticsApi.getDashboardStats({ outlet_id: user?.outlet_id }),
          orderApi.getOrders({ status: 'confirmed,preparing,ready', limit: 5 })
        ]);
        setStats(statsRes.data?.data || statsRes.data);
        const orderData = ordersRes.data?.data || ordersRes.data?.results || ordersRes.data;
        setLiveOrders(Array.isArray(orderData) ? orderData : []);
      } catch (err) {
        console.error("Dashboard data fetch failed", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchData();
    
    // Refresh every 30 seconds for live feel
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleVoid = async () => {
    if (!voidPin) {
      setError("PIN is required");
      return;
    }
    try {
      setError(null);
      await orderApi.voidOrder(voidingOrder.id, { pin: voidPin, reason: voidReason });
      setVoidingOrder(null);
      setVoidPin('');
      setVoidReason('');
      
      // Refresh
      const ordersRes = await orderApi.getOrders({ status: 'confirmed,preparing,ready', limit: 5 });
      const orderData = ordersRes.data?.data || ordersRes.data?.results || ordersRes.data;
      setLiveOrders(Array.isArray(orderData) ? orderData : []);
    } catch (err) {
      setError(err.response?.data?.error || "Voiding failed");
    }
  };

  const kpis = [
    { label: "Today's Revenue", value: `₹${stats?.today?.sales?.toLocaleString() || '0'}`, trend: "12%", up: true, icon: "trending_up" },
    { label: "Orders", value: stats?.today?.orders || '0', trend: "5%", up: true, icon: "trending_up" },
    { label: "Avg Bill", value: `₹${Math.round(stats?.today?.avg_bill || 0)}`, trend: "2%", up: false, icon: "trending_flat" },
    { label: "Active Orders", value: stats?.today?.active_orders || '0', text: "In Kitchen" }
  ];

  return (
    <div className="flex-1 p-8 min-h-screen overflow-y-auto custom-scrollbar relative z-10 w-full mb-10 text-atul-charcoal">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <div>
            <h2 className="font-serif text-3xl font-bold text-atul-charcoal">Welcome back, {user?.full_name?.split(' ')[0] || 'Aryan'}</h2>
            <div className="flex items-center gap-2 text-atul-pink_primary/60 text-sm mt-1">
              <MaterialIcon name="location_on" className="text-sm" />
              <span className="font-medium">Vastrapur Outlet</span>
              <span className="mx-2">•</span>
              <MaterialIcon name="schedule" className="text-sm" />
              <span className="font-medium">Live: 12:45 PM, Oct 24</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button className="size-12 rounded-3xl glass flex items-center justify-center text-atul-pink_primary">
              <MaterialIcon name="notifications" className="text-[24px]" />
            </button>
            <span className="absolute -top-1 -right-1 size-5 bg-atul-pink_primary text-white text-[10px] font-bold rounded-full border-2 border-[#FDF3F6] flex items-center justify-center">3</span>
          </div>
          <button 
            onClick={onNewOrder}
            className="flex items-center gap-2 bg-atul-pink_primary text-white px-6 py-3 rounded-3xl font-bold shadow-[0_4px_14px_rgba(214,51,132,0.39)] hover:scale-[1.02] transition-transform"
          >
            <MaterialIcon name="add_circle" className="text-[20px]" />
            <span className="text-[15px]">New Order</span>
          </button>
        </div>
      </header>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {kpis.map((stat, i) => (
          <div key={i} className="glass p-6 rounded-3xl flex flex-col justify-between">
            <span className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-[0.15em] font-serif">{stat.label}</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold text-atul-charcoal" style={{ fontFamily: '"Playfair Display", serif' }}>{stat.value}</span>
              {stat.trend && (
                <span className={`text-[12px] font-bold flex items-center gap-0.5 ${stat.up ? 'text-emerald-500' : 'text-amber-500'}`}>
                  <MaterialIcon name={stat.icon} className="text-xs" /> {stat.trend}
                </span>
              )}
              {stat.text && (
                <span className="text-atul-pink_primary text-xs font-bold ml-1">{stat.text}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="col-span-2 glass p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif text-xl font-bold text-atul-charcoal">Sales Trend</h3>
            <div className="flex gap-4 text-[10px] font-bold text-atul-charcoal tracking-wide">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#D63384]"></span> Today
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full border-2 border-dashed border-[#F8BBD9]"></span> Yesterday
              </div>
            </div>
          </div>
          <div className="h-48 relative flex items-end justify-between px-2">
            <div className="absolute inset-0 px-2 pt-4 pb-8">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 800 160">
                <defs>
                  <linearGradient id="gradientToday" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#D63384" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#D63384" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="gradientYesterday" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#F8BBD9" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#F8BBD9" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M 0 135 C 100 100, 150 125, 266 125 C 380 125, 380 65, 480 65 C 580 65, 600 135, 680 135 C 740 135, 760 100, 800 55 V 160 H 0 Z" fill="url(#gradientYesterday)" />
                <path d="M 0 135 C 100 100, 150 125, 266 125 C 380 125, 380 65, 480 65 C 580 65, 600 135, 680 135 C 740 135, 760 100, 800 55" fill="none" stroke="#F8BBD9" strokeDasharray="6,4" strokeWidth="2" />
                <path d="M 0 130 C 100 60, 150 100, 266 100 C 380 100, 380 30, 480 30 C 580 30, 600 125, 680 125 C 740 125, 760 70, 800 30 V 160 H 0 Z" fill="url(#gradientToday)" />
                <path d="M 0 130 C 100 60, 150 100, 266 100 C 380 100, 380 30, 480 30 C 580 30, 600 125, 680 125 C 740 125, 760 70, 800 30" fill="none" stroke="#D63384" strokeWidth="3" />
              </svg>
            </div>
            <div className="absolute left-[25%] top-[25%] bg-amber-100/90 backdrop-blur-sm border border-amber-200 text-amber-800 text-[10px] px-2 py-1 rounded font-bold shadow-sm z-20 flex gap-0.5 items-center">Lunch Rush <span className="text-[10px]">⚡</span></div>
            <div className="w-full flex justify-between mt-4 border-t border-atul-pink_primary/5 pt-2 text-[10px] font-bold text-atul-pink_primary/40 uppercase tracking-tighter">
              <span>10 AM</span><span>12 PM</span><span>2 PM</span><span>4 PM</span><span>6 PM</span><span>8 PM</span><span>10 PM</span>
            </div>
          </div>
        </div>
        <div className="glass p-6 rounded-3xl">
          <h3 className="font-serif text-xl font-bold mb-6 text-atul-charcoal">Top Flavors</h3>
          <div className="space-y-4">
            {(stats?.top_products || []).length > 0 ? stats.top_products.map((flavor, i) => (
              <div key={flavor.name} className="space-y-1.5">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[12px] font-bold text-atul-charcoal/80">{flavor.name}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-serif text-sm font-bold text-atul-pink_primary" style={{ fontFamily: '"Playfair Display", serif' }}>{flavor.quantity}</span>
                    <span className="text-[10px] font-bold text-atul-pink_primary/40">qty</span>
                  </div>
                </div>
                <div className="w-full bg-atul-pink_primary/5 h-2.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (flavor.quantity / stats.top_products[0].quantity) * 100)}%` }}
                    className="bg-gradient-to-r from-[#D63384] to-[#F48FB1] h-full rounded-full transition-all duration-1000 shadow-sm"
                  />
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-atul-gray/40 text-[10px] uppercase font-bold tracking-widest">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Live Orders & Quick Actions */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="col-span-2 glass rounded-3xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-atul-pink_primary/10 flex items-center justify-between">
            <h3 className="font-serif font-bold text-xl text-atul-charcoal">Live Orders Queue</h3>
            <span className="px-3 py-1 bg-atul-pink_primary/10 text-atul-pink_primary text-[10px] font-bold rounded-full tracking-wider leading-none">{liveOrders.length} ACTIVE</span>
          </div>
          <div className="overflow-y-auto max-h-[300px]">
            <table className="w-full text-left">
              <thead className="bg-[#FFE4EF]/30 text-[10px] uppercase tracking-wider font-bold text-atul-pink_primary/60 font-sans">
                <tr>
                  <th className="px-5 py-3 border-none w-[15%]">ID</th>
                  <th className="px-5 py-3 border-none min-w-1/2">Items</th>
                  <th className="px-5 py-3 border-none">Status</th>
                  <th className="px-5 py-3 border-none text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[13px] font-sans text-atul-charcoal">
                {liveOrders.map((row, i) => (
                    <tr key={row.id} className="border-b border-atul-pink_primary/5 hover:bg-atul-pink_primary/5 transition-colors">
                        <td className="px-5 py-4 font-bold text-atul-charcoal">#{row.order_number.split('-').pop()}</td>
                        <td className="px-5 py-4 text-atul-charcoal border-none font-medium truncate max-w-[150px]">
                           {row.items.map(it => `\${it.quantity}x \${it.product_name}`).join(', ')}
                        </td>
                        <td className="px-5 py-4 border-none">
                            <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                                row.status === 'confirmed' && "bg-blue-100 text-blue-700",
                                row.status === 'preparing' && "bg-amber-100 text-amber-700",
                                row.status === 'ready' && "bg-emerald-100 text-emerald-700",
                                row.status === 'served' && "bg-atul-pink_soft text-atul-pink_primary"
                            )}>{row.status}</span>
                        </td>
                        <td className="px-5 py-4 border-none text-right flex items-center justify-end gap-2">
                            <span className="text-atul-charcoal/40 text-[10px] uppercase font-bold mr-2">
                                {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                           <button 
                             onClick={() => setVoidingOrder(row)}
                             className="size-8 rounded-full flex items-center justify-center text-red-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                             title="Void Order"
                           >
                              <Trash2 size={14} />
                           </button>
                        </td>
                    </tr>
                ))}
                {liveOrders.length === 0 && (
                   <tr>
                     <td colSpan="4" className="px-5 py-12 text-center text-atul-gray/40 text-[10px] font-bold uppercase tracking-[0.2em]">No active orders</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Alerts */}
        <div className="glass p-6 rounded-3xl flex flex-col">
          <h3 className="font-serif font-bold text-xl mb-6 text-atul-charcoal">Inventory Alerts</h3>
          <div className="space-y-6">
             {stats?.inventory_alerts?.length > 0 ? (
                 stats.inventory_alerts.map((alert, i) => (
                    <div key={i} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <span className={cn(
                                "size-2.5 rounded-full",
                                alert.status === 'DANGER' ? "bg-red-600 animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                            )}></span>
                            <span className="text-[13px] font-bold text-atul-charcoal group-hover:text-atul-pink_primary transition-colors">{alert.name}</span>
                        </div>
                        <span className={cn(
                            "text-[10px] font-bold tracking-wider professional-digits",
                            alert.status === 'DANGER' ? "text-red-600" : "text-amber-600"
                        )}>{Number(alert.quantity).toFixed(0)} LEFT</span>
                    </div>
                 ))
             ) : (
                 <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-40">
                    <div className="size-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-3">
                        <Check size={20} strokeWidth={3}/>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-center">Stock Levels<br/>Normal</p>
                 </div>
             )}
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-4">
            {[
                { label: 'NEW ORDER', icon: 'add_box' },
                { label: 'ADD STOCK', icon: 'inventory_2' },
                { label: 'REPORTS', icon: 'description' },
                { label: 'STAFF', icon: 'badge' },
                { label: 'Z-REPORT', icon: 'print' },
                { label: 'LOOKUP', icon: 'search' },
            ].map((action, i) => (
                <button 
                    key={action.label} 
                    onClick={action.label === 'NEW ORDER' ? onNewOrder : undefined}
                    className="glass rounded-3xl flex flex-col items-center justify-center p-4 hover:bg-atul-pink_primary hover:text-white transition-all group"
                >
                    <MaterialIcon name={action.icon} className="text-[#D63384] text-2xl group-hover:text-white mb-2 transition-colors" />
                    <span className="text-[9px] font-bold tracking-[0.1em] text-atul-charcoal group-hover:text-white transition-colors">{action.label}</span>
                </button>
            ))}
        </div>
      </div>
      {/* Bottom Row: Transactions & Staff */}
      <div className="grid grid-cols-4 gap-6 pb-[25vh]">
          {/* Recent Transactions */}
          <div className="col-span-3 glass rounded-3xl overflow-hidden">
            <div className="p-4 border-b border-atul-pink_primary/10 flex items-center justify-between">
                <h3 className="font-serif font-bold text-[18px] tracking-tight text-atul-charcoal">Recent Transactions</h3>
                <button className="text-atul-pink_primary text-[9px] font-bold uppercase tracking-[0.15em] hover:opacity-80 transition-opacity">VIEW ALL</button>
            </div>
            <table className="w-full text-left">
                <thead className="bg-[#FFE4EF]/50 text-[10px] uppercase tracking-widest font-bold text-atul-pink_primary/60 font-sans">
                    <tr>
                    <th className="px-6 py-3.5 border-b-0 border-r-0">Bill #</th>
                    <th className="px-6 py-3.5 border-b-0 border-r-0">Time</th>
                    <th className="px-6 py-3.5 border-b-0 border-r-0 w-1/3">Items</th>
                    <th className="px-6 py-3.5 border-b-0 border-r-0">Amount</th>
                    <th className="px-6 py-3.5 text-right">Method</th>
                    </tr>
                </thead>
                <tbody className="text-xs font-sans text-atul-charcoal">
                    {[
                        { bill: '#INV-9023', time: '12:30 PM', items: 'Mango Pulp (1kg)', amount: '₹650', method: 'UPI', style: 'emerald' },
                        { bill: '#INV-9022', time: '12:15 PM', items: '2x Choco Sundae', amount: '₹320', method: 'Cash', style: 'amber' },
                        { bill: '#INV-9021', time: '12:10 PM', items: '1x Tub Mix', amount: '₹890', method: 'Card', style: 'primary' },
                    ].map((tx) => (
                        <tr key={tx.bill} className="border-b border-atul-pink_primary/5">
                            <td className="px-6 py-3 font-bold text-[12px]">{tx.bill}</td>
                            <td className="px-6 py-3 text-atul-charcoal/70 text-[12px]">{tx.time}</td>
                            <td className="px-6 py-3 text-[12px] text-atul-charcoal/80 font-medium">{tx.items}</td>
                            <td className="px-6 py-3 text-[14px] font-black tracking-tighter" style={{ fontFamily: '"Playfair Display", serif' }}>{tx.amount}</td>
                            <td className="px-6 py-3 text-right">
                                <span className={cn(
                                    "px-3 py-1.5 rounded-full font-bold uppercase text-[9px] tracking-widest",
                                    tx.style === 'emerald' && "bg-emerald-100 text-emerald-700",
                                    tx.style === 'amber' && "bg-amber-100 text-amber-700",
                                    tx.style === 'primary' && "bg-[#FFE4EF] text-atul-pink_primary"
                                )}>{tx.method}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
          
          <div className="glass p-6 rounded-3xl">
             <h3 className="font-serif font-bold text-[18px] tracking-tight mb-4 text-atul-charcoal">Staff on Shift</h3>
             <div className="space-y-4">
                 {[
                     { name: 'Rohit K.', orders: '24', pct: '80%', img: 'AB6AXuBcRLEo9BPDxy9eWbG-ezSm1hFfZYSCFvYR7nYLAzWapxE9PjN2lyvuHOLgYBaqP_h0Qm3pBNuY9ewjcqzED5s9evbOpdG9aeGPt7kN8EfwTxTe7pg9En9fwh9-PJVnLAUu8e_KHDbNPyhFGVAySmCwsSqB8eW2cU1Vr4aWm1bnIvzcdFPAPO2tMmPo9EjKJPCWYvUGKi3rqbb21GNuWlDQ1qrj_oauRA6aQtMRcsvcfL0LavC2hN07t0QMUxSnz5joCXOSRA_KrKg' },
                     { name: 'Sita M.', orders: '18', pct: '60%', img: 'AB6AXuD6crECfEmt38upL62ZOhxUOXmlJu7NxJNPDy77bYaq-lokBsHphaZUZRmTcoPJTMrTVAYCP6iAuqaBU3c2PxVdGiiaPGZwRO6znRQyid9wcgCUugaCjYkzN-ytV66D-dL2h9dHvF9Bu60wXjrhRds0VXQUMoESN86ICfqQgWito1PK6O8nzOtP3zHmatCgJC_wFIUutrXYpNOzgmDpQKZgR7sPps1Jp7mM6XHuL-YRG0BpCEJDoyZzTVYI7P3lLsNA115Od4G76Zs' },
                     { name: 'Vikram S.', orders: '32', pct: '95%', img: 'AB6AXuDTiRC0MRBHNIo5GZ_k3lZyhGwNE4FIz6N43D4CEVXNGi_w6fV7-cL4iYmX89muAofTUbeQ-D2Znjp0FJ66ETuB4C7v6cTGWx1Gxkqq34pKgbLf4OHVia5k5W8fVRZyRxnt2nKqGOtcCAfv5Xophk7i6RpaGL8GC9sWeZ6fsLPFpUsOCKsLntzKXIi1WErSp5b8NUiWK53OHe2LWqMtTLyYN8VkYOdX_aF_bXNWXpohcwgITOgR-JnSCeJcnfE-YQroCn5_2r27c_Y' },
                 ].map((staff) => (
                    <div key={staff.name} className="flex items-center gap-3">
                        <img src={`https://lh3.googleusercontent.com/aida-public/${staff.img}`} className="size-8 rounded-full shadow-sm object-cover" alt={staff.name} />
                        <div className="flex-1">
                             <div className="flex justify-between items-center mb-1">
                                 <span className="text-xs font-bold text-atul-charcoal">{staff.name}</span>
                                 <span className="text-[10px] font-bold text-atul-pink_primary">{staff.orders} Orders</span>
                             </div>
                             <div className="w-full bg-atul-pink_primary/5 h-1 rounded-full">
                                 <motion.div initial={{ width: 0 }} animate={{ width: staff.pct }} className="bg-atul-pink_primary h-full rounded-full transition-all duration-1000" />
                             </div>
                        </div>
                    </div>
                 ))}
             </div>
          </div>
      </div>
      {/* Void Confirmation Modal */}
      {voidingOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-atul-charcoal/20 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-atul-pink_primary/10"
          >
            <div className="p-6 border-b border-atul-pink_primary/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                  <ShieldAlert size={20} />
                </div>
                <h3 className="font-serif font-bold text-xl">Void Order</h3>
              </div>
              <button onClick={() => setVoidingOrder(null)} className="text-atul-gray hover:text-atul-charcoal">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-atul-pink_soft/30 p-4 rounded-2xl border border-atul-pink_primary/5">
                <p className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-wider mb-1">Order Details</p>
                <p className="font-bold text-atul-charcoal">{voidingOrder.order_number}</p>
                <div className="text-xs text-atul-charcoal/60 mt-1">
                   {voidingOrder.items.map(it => `${it.quantity}x ${it.product_name}`).join(', ')}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-wider mb-2 block">Manager PIN</label>
                <div className="relative">
                  <input 
                    type="password"
                    maxLength={4}
                    value={voidPin}
                    onChange={(e) => setVoidPin(e.target.value)}
                    className="w-full h-12 bg-gray-50 border-none rounded-2xl px-4 font-bold tracking-[1em] text-center focus:ring-2 focus:ring-atul-pink_primary/20 transition-all"
                    placeholder="****"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-atul-pink_primary">
                    <MaterialIcon name="lock" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-atul-pink_primary/60 uppercase tracking-wider mb-2 block">Reason for Void</label>
                <textarea 
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-atul-pink_primary/20 transition-all min-h-[80px]"
                  placeholder="e.g., Wrong variant selected"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2">
                  <MaterialIcon name="error" className="text-sm" />
                  {error}
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 flex gap-3">
              <button 
                onClick={() => setVoidingOrder(null)}
                className="flex-1 py-3 bg-white border border-atul-pink_primary/10 rounded-2xl text-atul-charcoal font-bold hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleVoid}
                className="flex-[2] py-3 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Confirm Void
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
