import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
import Distribution from './components/Distribution';
import DistributorPanel from './components/DistributorPanel';
import Distributors from './components/Distributors';
import AIGenerator from './components/AIGenerator';
import { cn } from './lib/utils';


// ── Build sidebar nav items based on logged-in user's outlet type ──────────
function getNavItems(user) {
  const role = user?.role;
  const isSuperAdmin = role === 'superadmin';

  // Load visibility config
  const navConfig = JSON.parse(localStorage.getItem('atul_pos_nav_config') || '{}');

  const navItems = [];

  const addIfEnabled = (id, label, icon, configKey) => {
    const isVisible = navConfig[configKey] ?? true;
    if (isVisible) {
      navItems.push({ id, label, icon });
    }
  };

  addIfEnabled('billing', 'Billing POS', 'point_of_sale', 'pos_visible');
  addIfEnabled('menu', 'Catalog', 'restaurant_menu', 'menu_visible');
  addIfEnabled('inventory', 'Inventory', 'inventory_2', 'inventory_visible');
  addIfEnabled('reports', 'Reports', 'analytics', 'reports_visible');

  if (isSuperAdmin || (navConfig.settings_visible ?? true)) {
    navItems.push({ id: 'settings', label: 'Settings', icon: 'settings' });
  }

  return navItems;
}

const MaterialIcon = ({ name, className = "", fill = false }) => (
  <span className={cn("material-symbols-outlined", className, fill && "fill-1")}>
    {name}
  </span>
);

function AppContent({ user, setUser, handleLogin, handleLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [navUpdates, setNavUpdates] = useState(0);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  // Sync active tab from URL path
  const activeTab = useMemo(() => {
    const path = location.pathname.substring(1);
    return path || 'billing';
  }, [location.pathname]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleNavChange = () => setNavUpdates(prev => prev + 1);
    window.addEventListener('navConfigChanged', handleNavChange);
    return () => window.removeEventListener('navConfigChanged', handleNavChange);
  }, []);

  const navItems = useMemo(() => getNavItems(user), [user, navUpdates]);

  // Exit fullscreen when navigating away from billing
  useEffect(() => {
    if (activeTab !== 'billing' && isFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, [activeTab]);

  const handlePinSwitch = async (pin) => {
    try {
      const res = await authApi.pinLogin(pin);
      const loginData = res.data?.data || res.data;
      if (loginData && loginData.access) {
        localStorage.setItem('access_token', loginData.access);
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
    if (location.pathname !== '/login') {
       return <Navigate to="/login" replace />;
    }
    return <Login onLoginSuccess={handleLogin} />;
  }

  if (location.pathname === '/login') {
     return <Navigate to="/billing" replace />;
  }

  return (
    <div className="flex h-screen bg-[#FDF3F6] font-sans overflow-hidden">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-50 bg-[url('https://lh3.googleusercontent.com/aida-public/AB6AXuAVBbRsaGYdCe_s-o8jqR9nJa_mthPmgAh0wURjtR78rPPofw-FjgEVlP1a1SZjvP5_caDNAiFJJn4T_HK9JUWMEfkCyowgFI_MqspIP1CiFvv4IkiRmENXYRPX2MJCCSMAUcVWDzEqcD_U9h0oktywI8neBaej-LZcAsDIlyxN_NCMyHtrhQTsnCyKKIQukpRURHFV5IO__JP1DVelhVWW2Q3SMKqacV1bSoLJ9a2d_4I_5RC5cvOn6mS-xtg64rCTeLnGVsCMyzI')]"></div>

      {!(activeTab === 'billing' && isFullscreen) && (
        <aside className="w-[220px] fixed h-screen border-r border-white/50 flex flex-col z-20 bg-transparent">
          <div className="p-6 flex items-center gap-2">
            <div className="size-9 bg-atul-pink_primary rounded-full shadow-sm flex items-center justify-center text-white">
              <MaterialIcon name="icecream" fill className="text-[18px]" />
            </div>
            <div className="flex flex-col">
              <h1 className="font-serif text-[16px] tracking-tight font-bold leading-none text-atul-pink_primary">Atul Ice Cream</h1>
              <span className="text-[8px] uppercase tracking-[0.2em] font-bold text-atul-pink_primary/60 mt-0.5">Luxury POS</span>
            </div>
          </div>

          <nav className="flex-1 mt-4 space-y-1.5 pr-5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  navigate(`/${item.id}`);
                  // Automatically try to enter fullscreen when switching to POS
                  if (item.id === 'billing') {
                    document.documentElement.requestFullscreen().catch(() => {});
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-3 transition-all pl-6 pr-5",
                  activeTab === item.id 
                    ? "bg-atul-pink_primary text-white shadow-lg shadow-atul-pink_primary/20 py-3 rounded-r-full" 
                    : "py-2.5 text-atul-charcoal/60 hover:bg-atul-pink_primary/5 hover:text-atul-pink_primary rounded-r-full"
                )}
              >
                <MaterialIcon name={item.icon} className="text-[20px]" fill={activeTab === item.id} />
                <span className={cn("text-[13px] font-sans tracking-wide", activeTab === item.id ? "font-bold" : "font-semibold")}>
                  {item.label}
                </span>
              </button>
            ))}
          </nav>

          <div className="pb-6 px-4 space-y-2">
            <div className="flex items-center gap-2.5 p-1.5 bg-[#F8E2EB]/50 backdrop-blur-sm border border-white/40 rounded-[2rem] shadow-sm">
              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'Atul Admin')}&background=D63384&color=fff&bold=true`} className="size-9 rounded-full object-cover border-2 border-white shadow-sm" alt="User" />
               <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-[12px] font-bold text-atul-charcoal tracking-tight truncate">{user.full_name || 'System Admin'}</span>
                  <span className="text-[9px] uppercase font-bold text-atul-pink_primary/60 tracking-wider truncate">{user.outlet_name || 'Main Outlet'}</span>
               </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleLogout} className="flex-1 bg-red-50 hover:bg-red-100 text-red-500 py-2.5 rounded-xl border border-red-100 transition-all flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                <MaterialIcon name="logout" className="text-[16px]" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      <PinModal isOpen={isPinModalOpen} onClose={() => setIsPinModalOpen(false)} onConfirm={handlePinSwitch} title="Cashier Swap" />

      <main className={cn("flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300", !(activeTab === 'billing' && isFullscreen) ? "ml-[220px]" : "ml-0")}>
         <Routes>
            <Route path="/billing" element={<POS user={user} />} />
            <Route path="/menu" element={<Menu user={user} />} />
            <Route path="/inventory" element={<Inventory user={user} />} />
            <Route path="/reports" element={<Reports user={user} />} />
            <Route path="/settings" element={<Settings user={user} onUpdateUser={(newOutlet) => setUser(prev => ({...prev, outlet_name: newOutlet.name}))} />} />
            {/* Catch all / fallback */}
            <Route path="/" element={<Navigate to="/billing" replace />} />
         </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')));

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  };

  const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('AtulPOS-Electron');
  const Router = isElectron ? HashRouter : BrowserRouter;
  const routerProps = isElectron ? {} : { basename: "/pos" };

  return (
    <Router {...routerProps}>
       <AppContent user={user} setUser={setUser} handleLogin={handleLogin} handleLogout={handleLogout} />
    </Router>
  );
}
