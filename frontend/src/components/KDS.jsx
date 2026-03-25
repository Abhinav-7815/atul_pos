import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, CheckCircle2, AlertCircle, ChefHat, 
  Timer, ChevronRight, Play, CheckCircle, 
  Trash2, Filter, Loader2
} from 'lucide-react';
import { orderApi } from '../services/api';
import { cn } from '../lib/utils';

const OrderCard = ({ order, onMarkReady, onMarkServed }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(order.created_at);
    const timer = setInterval(() => {
      setElapsed(Math.floor((new Date() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [order.created_at]);

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const isUrgent = elapsed > 300; // 5 mins

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "bg-white rounded-[2rem] border-2 overflow-hidden shadow-sm flex flex-col transition-all duration-500",
        isUrgent ? "border-red-100 shadow-red-500/5" : "border-atul-pink_soft/30 hover:border-atul-pink_primary/30"
      )}
    >
      {/* Card Header */}
      <div className={cn(
        "px-6 py-4 flex justify-between items-center border-b border-dashed",
        isUrgent ? "bg-red-50/50 border-red-100" : "bg-atul-cream/20 border-atul-pink_soft/20"
      )}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black tracking-widest uppercase text-atul-pink_primary">#{order.order_number.slice(-4)}</span>
            <span className="size-1.5 rounded-full bg-atul-pink_primary animate-pulse" />
          </div>
          <h3 className="text-xl font-black text-atul-charcoal font-serif tracking-tight">
            {order.order_type === 'takeaway' ? 'Parcel Order' : `Table ${order.table_number || 'NA'}`}
          </h3>
        </div>
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full font-black text-[10px] tracking-tighter",
          isUrgent ? "bg-red-500 text-white" : "bg-atul-charcoal text-white"
        )}>
          <Timer size={12} /> {formatTime(elapsed)}
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 p-6 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
        {order.items.map((item, idx) => (
          <div key={idx} className="flex justify-between items-start group">
            <div className="flex gap-3">
              <div className="size-6 rounded-lg bg-atul-pink_soft/20 flex items-center justify-center text-[11px] font-black text-atul-pink_primary">
                {item.quantity}
              </div>
              <div>
                <p className="text-[15px] font-bold text-atul-charcoal leading-tight">{item.name}</p>
                {item.variant && <p className="text-[10px] font-black text-atul-pink_primary uppercase tracking-wider mt-0.5">{item.variant}</p>}
                {item.notes && <p className="text-[10px] italic text-atul-gray mt-1 opacity-60">“{item.notes}”</p>}
              </div>
            </div>
            {item.status === 'ready' && <CheckCircle size={16} className="text-emerald-500 mt-1" />}
          </div>
        ))}
      </div>

      {/* Action Footer */}
      <div className="p-4 bg-gray-50/50 border-t border-gray-100 grid grid-cols-2 gap-3">
        {order.status === 'confirmed' ? (
          <button 
            onClick={() => onMarkReady(order.id)}
            className="col-span-2 w-full bg-atul-charcoal text-white py-4 rounded-2xl font-black text-[11px] tracking-widest uppercase hover:bg-black transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ChefHat size={16} /> Mark Items Ready
          </button>
        ) : (
          <button 
            onClick={() => onMarkServed(order.id)}
            className="col-span-2 w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-[11px] tracking-widest uppercase hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <CheckCircle2 size={16} /> Dispatch Order
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default function KDS({ user }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [filter, setFilter] = useState('active'); // active, ready

  const loadActiveOrders = async () => {
    try {
      setLoading(true);
      const res = await orderApi.getOrders({ 
        status: ['confirmed', 'preparing', 'ready'],
        ordering: 'created_at' 
      });
      setOrders(res.data?.data || res.data || []);
    } catch (err) {
      console.error("Failed to load KDS orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveOrders();

    // Setup WebSocket
    const outletId = user?.outlet || 'global';
    const wsUrl = `ws://localhost:8000/ws/kds/${outletId}/`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'order_update') {
        const newOrder = data.data;
        setOrders(prev => {
          const index = prev.findIndex(o => o.id === newOrder.id);
          if (index !== -1) {
            // Update existing
            const updated = [...prev];
            updated[index] = newOrder;
            return updated;
          }
          // Add new
          return [...prev, newOrder];
        });
        
        // Notification sound
        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});
      }
    };

    setSocket(ws);
    return () => ws.close();
  }, []);

  const handleMarkReady = async (orderId) => {
    try {
      await orderApi.updateOrder(orderId, { status: 'ready' });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'ready' } : o));
    } catch (err) {
      console.error("Action failed", err);
    }
  };

  const handleMarkServed = async (orderId) => {
    try {
      await orderApi.updateOrder(orderId, { status: 'served' });
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err) {
      console.error("Action failed", err);
    }
  };

  const activeOrders = orders.filter(o => o.status === 'confirmed' || o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  return (
    <div className="h-full flex flex-col bg-[#FDF3F6]/50">
      {/* KDS Header */}
      <header className="px-10 py-8 flex justify-between items-center bg-white/80 backdrop-blur-xl border-b border-atul-pink_soft/20 shadow-sm relative z-10">
        <div>
          <h1 className="text-3xl font-black text-atul-charcoal tracking-tight font-serif uppercase">Kitchen Display System</h1>
          <p className="text-atul-pink_primary text-[11px] font-black uppercase tracking-[0.4em] mt-1 flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> Live Dispatch Center
          </p>
        </div>

        <div className="flex gap-4">
          <div className="flex bg-atul-cream p-1.5 rounded-2xl gap-1">
            <button 
              onClick={() => setFilter('active')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all",
                filter === 'active' ? "bg-white text-atul-pink_primary shadow-md" : "text-atul-gray hover:text-atul-charcoal"
              )}
            >
              Preparing ({activeOrders.length})
            </button>
            <button 
              onClick={() => setFilter('ready')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all",
                filter === 'ready' ? "bg-white text-atul-pink_primary shadow-md" : "text-atul-gray hover:text-atul-charcoal"
              )}
            >
              Ready ({readyOrders.length})
            </button>
          </div>
          
          <button 
            onClick={loadActiveOrders}
            className="size-12 rounded-2xl bg-white border border-atul-pink_soft flex items-center justify-center text-atul-charcoal hover:shadow-lg transition-all"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <ChevronRight size={20} className="rotate-90" />}
          </button>
        </div>
      </header>

      {/* Orders Grid */}
      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        {loading && orders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-6 opacity-20">
            <Loader2 size={64} className="animate-spin text-atul-pink_primary" />
            <p className="font-serif text-2xl italic">Tuning the kitchen frequency...</p>
          </div>
        ) : (filter === 'active' ? activeOrders : readyOrders).length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-6 text-atul-pink_primary/20">
            <ChefHat size={120} strokeWidth={1} />
            <h2 className="text-3xl font-serif italic">Kitchen is clear for now</h2>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            <AnimatePresence>
              {(filter === 'active' ? activeOrders : readyOrders).map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onMarkReady={handleMarkReady}
                  onMarkServed={handleMarkServed}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
