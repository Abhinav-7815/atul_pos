import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Utensils, 
  Package, 
  Users, 
  BadgeCheck, 
  BarChart3, 
  Settings,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORIES = [
  { id: 1, name: 'Scoops', emoji: '🍨' },
  { id: 2, name: 'Sundaes', emoji: '🍧' },
  { id: 3, name: 'Shakes', emoji: '🥤' },
  { id: 4, name: 'Waffles', emoji: '🧇' },
  { id: 5, name: 'Cakes', emoji: '🍰' },
];

const PRODUCTS = [
  { id: 1, category: 1, name: 'Belgian Chocolate', price: 240, image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=800&q=80', isVeg: true },
  { id: 2, category: 1, name: 'Mango Alphonso', price: 110, image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=800&q=80', isVeg: true },
  { id: 3, category: 2, name: 'Death By Chocolate', price: 320, image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80', isVeg: true },
  { id: 4, category: 3, name: 'Oreo Blast Shake', price: 180, image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=800&q=80', isVeg: true },
];

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState(1);
  const [cart, setCart] = useState<{product: any, qty: number}[]>([]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === id) {
        return { ...item, qty: Math.max(0, item.qty + delta) };
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);

  return (
    <div className="flex h-screen bg-atul-cream overflow-hidden">
      {/* Sidebar */}
      <aside className="w-24 bg-white border-r border-atul-pink_soft flex flex-col items-center py-6 gap-8">
        <div className="text-2xl font-bold text-atul-pink_primary -rotate-45">ATUL</div>
        <nav className="flex flex-col gap-4 flex-1">
          <SidebarIcon icon={<LayoutDashboard size={24} />} label="Dash" />
          <SidebarIcon icon={<Receipt size={24} />} label="POS" active />
          <SidebarIcon icon={<Utensils size={24} />} label="Menu" />
          <SidebarIcon icon={<Package size={24} />} label="Stock" />
          <SidebarIcon icon={<Users size={24} />} label="CRMs" />
          <SidebarIcon icon={<BarChart3 size={24} />} label="Stats" />
        </nav>
        <SidebarIcon icon={<Settings size={24} />} label="Settings" />
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col p-6 overflow-hidden">
        {/* Header */}
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold font-serif text-atul-charcoal">Atul Ice Cream</h1>
            <p className="text-atul-gray text-sm">Vastrapur Outlet • 03:30 AM</p>
          </div>
          <div className="flex bg-white rounded-2xl px-4 py-2 shadow-sm border border-atul-pink_soft items-center gap-3 w-96 focus-within:ring-2 ring-atul-pink_primary">
            <Search size={20} className="text-atul-gray" />
            <input type="text" placeholder="Search product..." className="outline-none flex-1 bg-transparent text-sm" />
          </div>
        </header>

        {/* Product Area */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {/* Categories */}
          <div className="flex gap-4 mb-6">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-3xl min-w-[100px] transition-all",
                  selectedCategory === cat.id 
                    ? "bg-atul-pink_primary text-white shadow-xl shadow-atul-pink_primary/20 scale-105" 
                    : "bg-white text-atul-charcoal hover:bg-atul-pink_soft"
                )}
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span className="text-sm font-semibold">{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRODUCTS.filter(p => p.category === selectedCategory).map(p => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={p.id}
                onClick={() => addToCart(p)}
                className="bg-white rounded-[2rem] p-4 shadow-sm border border-atul-pink_soft group cursor-pointer hover:shadow-xl transition-all relative overflow-hidden active:scale-95"
              >
                <div className="h-40 bg-atul-cream rounded-2xl mb-4 overflow-hidden relative">
                   <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} />
                   <div className="absolute top-2 right-2 px-2 py-0.5 bg-atul-mint/10 text-atul-mint text-[10px] font-bold rounded-md backdrop-blur-sm">VEG</div>
                </div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg leading-tight">{p.name}</h3>
                  <div className="text-atul-pink_primary font-bold">₹{p.price}</div>
                </div>
                <div className="text-atul-gray text-xs mb-4">Premium dairy-base scoop with natural ingredients.</div>
                <button className="w-full btn-primary py-3 rounded-2xl flex items-center justify-center gap-2">
                   <Plus size={18} /> Add to Order
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      {/* Cart / Order Summary */}
      <section className="w-[400px] bg-white border-l border-atul-pink_soft flex flex-col shadow-2xl z-10">
        <div className="p-6 border-b border-atul-pink_soft">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-xl font-bold">New Order</h2>
             <span className="bg-atul-pink_soft text-atul-pink_primary px-3 py-1 rounded-full text-xs font-bold">#8493</span>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="bg-atul-charcoal text-white px-3 py-1.5 rounded-lg flex items-center gap-2">Dine-In <ChevronRight size={12} /></span>
            <span className="border border-atul-gray/20 px-3 py-1.5 rounded-lg text-atul-gray">Takeaway</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-none">
          <AnimatePresence>
            {cart.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-atul-gray text-center gap-4">
                  <ShoppingCart size={48} className="opacity-20" />
                  <p>Your scoop tray is empty.<br/>Select some flavor to start.</p>
               </div>
            ) : (
              <div className="space-y-6">
                {cart.map(item => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    key={item.product.id} 
                    className="flex gap-4"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden shadow-md">
                       <img src={item.product.image} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                       <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-sm">{item.product.name}</h4>
                          <div className="font-bold text-sm">₹{item.product.price * item.qty}</div>
                       </div>
                       <div className="flex justify-between items-center">
                          <div className="text-[10px] text-atul-gray">Single Scoop • Cup</div>
                          <div className="flex items-center gap-3 bg-atul-cream rounded-lg p-1">
                             <button onClick={() => updateQty(item.product.id, -1)} className="p-1 hover:text-atul-pink_primary"><Minus size={14} /></button>
                             <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                             <button onClick={() => updateQty(item.product.id, 1)} className="p-1 hover:text-atul-pink_primary"><Plus size={14} /></button>
                          </div>
                       </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 bg-atul-cream/50 space-y-4">
           <div className="space-y-2">
              <div className="flex justify-between text-sm text-atul-gray">
                 <span>Subtotal</span>
                 <span>₹{cartTotal}</span>
              </div>
              <div className="flex justify-between text-sm text-atul-gray">
                 <span>GST (5%)</span>
                 <span>₹{Math.round(cartTotal * 0.05)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-2 border-t border-dashed border-atul-gray/30">
                 <span>Total</span>
                 <span className="text-atul-pink_primary">₹{Math.round(cartTotal * 1.05)}</span>
              </div>
           </div>
           
           <div className="grid grid-cols-2 gap-3">
              <button className="bg-white border border-atul-pink_soft py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm shadow-sm active:scale-95 transition-all">
                 <Trash2 size={16} /> Clear
              </button>
              <button className="btn-primary py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm active:scale-95 transition-all">
                 <Receipt size={16} /> Print KOT
              </button>
           </div>
           
           <button 
             disabled={cart.length === 0}
             className="w-full bg-atul-charcoal text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-atul-charcoal/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pay Now
           </button>
        </div>
      </section>
    </div>
  );
}

function SidebarIcon({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={cn(
      "flex flex-col items-center gap-1 cursor-pointer transition-all p-2 rounded-xl group",
      active ? "text-atul-pink_primary" : "text-atul-gray hover:text-atul-pink_primary"
    )}>
      <div className={cn(
        "p-3 rounded-2xl transition-all shadow-sm border border-transparent",
        active ? "bg-atul-pink_soft border-atul-pink_soft shadow-atul-pink_primary/10" : "hover:bg-atul-cream"
      )}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </div>
  );
}
