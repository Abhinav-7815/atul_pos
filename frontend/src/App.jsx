import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { menuApi, orderApi, authApi } from './services/api';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import Inventory from './components/Inventory';
import Staff from './components/Staff';
import Customers from './components/Customers';
import Settings from './components/Settings';
import Reports from './components/Reports';
import KDS from './components/KDS';
import ShiftManager from './components/ShiftManager';
import Procurement from './components/Procurement';
import Menu from './components/Menu';
import PinModal from './components/PinModal';
import { cn } from './lib/utils';


const MaterialIcon = ({ name, className = "", fill = false }) => (
  <span className={cn("material-symbols-outlined", className, fill && "fill-1")}>
    {name}
  </span>
);

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')));
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'pos');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadMenu();
    }
  }, [user]);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const loadMenu = async () => {
    try {
      const catRes = await menuApi.getCategories();
      const allCats = catRes.data?.data || catRes.data || [];
      setCategories(allCats);
      if (allCats.length > 0) {
        setSelectedCategory(allCats[0].id);
        loadProducts(allCats[0].id);
      }
    } catch (err) {
      console.error("Failed to load categories", err);
    }
  };

  const loadProducts = async (catId) => {
    try {
      setLoading(true);
      const prodRes = await menuApi.getProducts({ category: catId });
      setProducts(prodRes.data?.data || prodRes.data || []);
    } catch (err) {
      console.error("Failed to load products", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const handlePinSwitch = async (pin) => {
    try {
      const res = await authApi.pinLogin(pin);
      const loginData = res.data?.data || res.data;
      if (loginData && loginData.access) {
        localStorage.setItem('token', loginData.access);
        handleLogin(loginData.user);
        setIsPinModalOpen(false);
        return true;
      }
    } catch (err) {
      console.error("PIN Switch failed", err);
    }
    return false;
  };

  if (!user) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-[#FDF3F6] font-sans overflow-hidden">
      {/* Global Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-50 bg-[url('https://lh3.googleusercontent.com/aida-public/AB6AXuAVBbRsaGYdCe_s-o8jqR9nJa_mthPmgAh0wURjtR78rPPofw-FjgEVlP1a1SZjvP5_caDNAiFJJn4T_HK9JUWMEfkCyowgFI_MqspIP1CiFvv4IkiRmENXYRPX2MJCCSMAUcVWDzEqcD_U9h0oktywI8neBaej-LZcAsDIlyxN_NCMyHtrhQTsnCyKKIQukpRURHFV5IO__JP1DVelhVWW2Q3SMKqacV1bSoLJ9a2d_4I_5RC5cvOn6mS-xtg64rCTeLnGVsCMyzI')]"></div>

      {/* Sidebar */}
      <aside className="w-[220px] fixed h-screen border-r border-white/50 flex flex-col z-20 bg-transparent">
        {/* Logo Section */}
        <div className="p-6 flex items-center gap-2">
          <div className="size-9 bg-atul-pink_primary rounded-full shadow-sm flex items-center justify-center text-white">
            <MaterialIcon name="icecream" fill className="text-[18px]" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-serif text-[16px] tracking-tight font-bold leading-none text-atul-pink_primary">Atul Ice Cream</h1>
            <span className="text-[8px] uppercase tracking-[0.2em] font-bold text-atul-pink_primary/60 mt-0.5">Luxury POS</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 mt-4 space-y-1.5 pr-5">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
            { id: 'pos', label: 'Billing POS', icon: 'point_of_sale' },
            { id: 'kds', label: 'KDS (Live)', icon: 'countertops' },
            { id: 'menu', label: 'Catalog', icon: 'restaurant_menu' },
            { id: 'inventory', label: 'Inventory', icon: 'inventory_2' },
            { id: 'procurement', label: 'Procurement', icon: 'local_shipping' },
            { id: 'customers', label: 'Customers', icon: 'group' },
            { id: 'staff', label: 'Staff', icon: 'badge' },
            { id: 'reports', label: 'Reports', icon: 'analytics' },
            { id: 'shift', label: 'Day Close', icon: 'account_balance_wallet' },
            { id: 'settings', label: 'Settings', icon: 'settings' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                localStorage.setItem('activeTab', item.id);
              }}
              className={cn(
                "w-full flex items-center gap-3 transition-all pl-6 pr-5",
                activeTab === item.id 
                  ? "bg-atul-pink_primary text-white shadow-lg shadow-atul-pink_primary/20 py-3 rounded-r-full" 
                  : "py-2.5 text-atul-charcoal/60 hover:bg-atul-pink_primary/5 hover:text-atul-pink_primary rounded-r-full"
              )}
            >
              <MaterialIcon 
                name={item.icon} 
                className="text-[20px]" 
                fill={activeTab === item.id} 
              />
              <span className={cn(
                  "text-[13px] font-sans tracking-wide", 
                  activeTab === item.id ? "font-bold" : "font-semibold"
                )}>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Profile Section */}
        <div className="pb-6 px-4 space-y-2">
          <div className="flex items-center gap-2.5 p-1.5 bg-[#F8E2EB]/50 backdrop-blur-sm border border-white/40 rounded-[2rem] shadow-sm transition-colors">
            <img 
               src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'Atul Admin')}&background=D63384&color=fff&bold=true`} 
               className="size-9 rounded-full object-cover border-2 border-white shadow-sm" 
               alt="User" 
             />
             <div className="flex flex-col min-w-0 pr-2">
                <span className="text-[12px] font-bold text-atul-charcoal tracking-tight truncate">{user.full_name || 'System Admin'}</span>
                <span className="text-[9px] uppercase font-bold text-atul-pink_primary/60 tracking-wider truncate">{user.outlet_name || 'Main Outlet'}</span>
             </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsPinModalOpen(true)}
              className="flex-1 bg-white hover:bg-atul-pink_soft/20 text-atul-pink_primary py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-white/50 shadow-sm transition-all flex items-center justify-center gap-1.5 px-3">
              <MaterialIcon name="sync_alt" className="text-[14px]" />
              <span>Switch</span>
            </button>
            <button 
              onClick={handleLogout}
              className="px-3 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl border border-red-100 transition-all flex items-center justify-center">
              <MaterialIcon name="logout" className="text-[16px]" />
            </button>
          </div>
        </div>
      </aside>

      <PinModal 
        isOpen={isPinModalOpen} 
        onClose={() => setIsPinModalOpen(false)} 
        onConfirm={handlePinSwitch} 
        title="Cashier Swap" 
      />

      {/* Main Content Area */}
      <main className="ml-[220px] flex-1 flex flex-col h-screen overflow-hidden">
        {activeTab === 'dashboard' ? (
          <Dashboard user={user} onNewOrder={() => setActiveTab('pos')} />
        ) : activeTab === 'pos' ? (
          <POS />
        ) : activeTab === 'inventory' ? (
          <Inventory user={user} />
        ) : activeTab === 'staff' ? (
          <Staff user={user} />
        ) : activeTab === 'customers' ? (
          <Customers />
        ) : activeTab === 'settings' ? (
          <Settings user={user} onUpdateUser={(newOutlet) => setUser(prev => ({...prev, outlet_name: newOutlet.name}))} />
        ) : activeTab === 'reports' ? (
          <Reports user={user} />
        ) : activeTab === 'kds' ? (
          <KDS user={user} />
        ) : activeTab === 'procurement' ? (
          <Procurement user={user} />
        ) : activeTab === 'shift' ? (
          <ShiftManager user={user} />
        ) : activeTab === 'menu' ? (
          <Menu user={user} />
        ) : (
          <div className="p-12 h-full flex flex-col items-center justify-center text-atul-pink_primary/10 font-serif gap-6 relative z-10 w-full">
            <MaterialIcon name="auto_awesome" className="text-8xl" />
            <h2 className="text-4xl italic tracking-tight">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} View In Progress</h2>
          </div>
        )}
      </main>
    </div>
  );
}
