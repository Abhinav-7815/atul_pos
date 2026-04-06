import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { userApi, outletApi } from '../services/api';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const MaterialIcon = ({ name, className = "", fill = false }) => (
  <span className={cn("material-symbols-outlined", className, fill && "fill-1")}>
    {name}
  </span>
);

export default function UserManagement({ user: currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Stats for the top bar
  const [stats, setStats] = useState({
    total: 0,
    admins: 0,
    staff: 0
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log("Fetching users from /api/v1/users/...");
      const res = await userApi.getUsers();
      console.log("API Response UserManagement:", res.data);
      
      let data = [];
      if (res.data) {
        if (Array.isArray(res.data)) data = res.data;
        else if (res.data.results && Array.isArray(res.data.results)) data = res.data.results;
        else if (res.data.data && Array.isArray(res.data.data)) data = res.data.data;
      }
      
      setUsers(data);
      calculateStats(data);
    } catch (e) {
      console.error("Failed to fetch users", e);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (userList) => {
    if (!Array.isArray(userList)) return;
    setStats({
      total: userList.length,
      admins: userList.filter(u => u.role?.includes('admin')).length,
      staff: userList.filter(u => u.role === 'cashier' || u.role === 'kitchen').length
    });
  };

  const getRoleBadge = (role) => {
    const r = (role || '').toLowerCase();
    const styles = {
      superadmin: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100', label: 'Super Admin' },
      client_admin: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', label: 'Client Admin' },
      outlet_manager: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', label: 'Manager' },
      cashier: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', label: 'Cashier' },
      kitchen: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100', label: 'Kitchen' },
    };
    const style = styles[r] || { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-100', label: role || 'Member' };

    return (
      <span className={cn(
        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
        style.bg, style.text, style.border
      )}>
        {style.label}
      </span>
    );
  };

  // Improved filtering with safer string checks
  const filteredUsers = (Array.isArray(users) ? users : []).filter(u => {
    if (!u) return false;
    const name = (u.full_name || u.first_name || u.username || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const query = (searchTerm || '').toLowerCase();
    
    const matchesSearch = name.includes(query) || email.includes(query);
    const userRole = (u.role || '').toLowerCase();
    const targetRole = (filterRole || '').toLowerCase();
    const matchesRole = targetRole === 'all' || userRole === targetRole;
    
    return matchesSearch && matchesRole;
  });

  return (
    <div className="flex-1 min-h-screen flex flex-col bg-[#FDF3F6] overflow-hidden">
      {/* Header Section */}
      <div className="px-10 pt-10 pb-8 border-b border-atul-pink_primary/5">
        <div className="flex items-start justify-between gap-8 mb-10">
          <div>
            <h1 className="text-5xl font-black text-atul-charcoal tracking-tight" style={{ fontFamily: '"Outfit", sans-serif' }}>Access Center</h1>
            <p className="text-xs font-bold text-atul-charcoal/30 uppercase tracking-[0.3em] mt-3 bg-white/50 inline-block px-3 py-1 rounded-full border border-white">
               Identity & Permission Management
            </p>
          </div>

          <div className="flex gap-4">
             <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-[2rem] border border-white shadow-xl shadow-atul-pink_primary/5 flex items-center gap-6">
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-atul-charcoal/30">Active Team</p>
                   <p className="text-2xl font-black text-atul-charcoal professional-digits">{stats.total}</p>
                </div>
                <div className="w-px h-8 bg-atul-pink_soft/50" />
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-atul-charcoal/30">Privileged</p>
                   <p className="text-2xl font-black text-atul-pink_primary professional-digits">{stats.admins}</p>
                </div>
             </div>

             <button 
                onClick={() => setShowCreateModal(true)}
                className="bg-atul-charcoal text-white pl-6 pr-8 h-[72px] rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl flex items-center gap-3 hover:scale-[1.03] active:scale-95 transition-all group"
                style={{ fontFamily: '"Outfit", sans-serif' }}
              >
                <div className="size-8 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-atul-pink_primary transition-colors">
                  <MaterialIcon name="person_add" className="text-lg" />
                </div>
                Provision Account
              </button>
          </div>
        </div>

        {/* Dynamic Filters Bar */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-lg group">
            <MaterialIcon name="search" className="absolute left-5 top-1/2 -translate-y-1/2 text-atul-charcoal/20 group-focus-within:text-atul-pink_primary transition-colors" />
            <input
              type="text" placeholder="Lookup members by identity or mail..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white/60 backdrop-blur-sm border-2 border-white rounded-[1.5rem] py-4 pl-14 pr-6 text-xs font-bold focus:bg-white focus:ring-8 focus:ring-atul-pink_primary/5 transition-all outline-none shadow-sm placeholder:text-atul-charcoal/20"
            />
          </div>
          
          <div className="flex bg-white/40 p-1.5 rounded-[1.5rem] border-2 border-white shadow-inner">
            {['all', 'superadmin', 'client_admin', 'outlet_manager', 'cashier'].map(role => (
              <button
                key={role} onClick={() => setFilterRole(role)}
                className={cn(
                  "px-6 py-2.5 rounded-[1rem] text-[10px] font-black uppercase tracking-widest transition-all",
                  filterRole === role ? "bg-white text-atul-pink_primary shadow-lg shadow-atul-pink_primary/5 ring-1 ring-atul-pink_soft" : "text-atul-charcoal/30 hover:text-atul-charcoal hover:bg-white/40"
                )}
                style={{ fontFamily: '"Outfit", sans-serif' }}
              >
                {role === 'all' ? 'Universal' : role.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table Interface */}
      <div className="flex-1 px-10 pt-6 pb-10 overflow-y-auto custom-scrollbar relative">
        <div className="bg-white/40 backdrop-blur-xl rounded-[3rem] border-2 border-white shadow-2xl shadow-atul-pink_primary/5 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/60 border-b border-atul-pink_soft">
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-atul-charcoal/30">Principal Identity</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-atul-charcoal/30">Access Level</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-atul-charcoal/30">Assigned Node</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-atul-charcoal/30 text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-atul-pink_soft/30">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-10 py-8">
                       <div className="flex items-center gap-4">
                          <div className="size-14 bg-gray-100 rounded-2xl" />
                          <div className="space-y-2">
                             <div className="w-40 h-3 bg-gray-100 rounded-full" />
                             <div className="w-24 h-2 bg-gray-100 rounded-full" />
                          </div>
                       </div>
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                   <td colSpan={4} className="px-10 py-32 text-center">
                     <div className="bg-white/50 p-10 rounded-[3rem] border border-white inline-block">
                        <MaterialIcon name="groups_3" className="text-6xl text-atul-pink_primary/20 mb-4" />
                        <p className="text-sm font-black text-atul-charcoal/20 uppercase tracking-[0.3em]">No Personnel Located</p>
                     </div>
                   </td>
                </tr>
              ) : filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-white/80 transition-all group">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-5">
                      <div className="size-14 rounded-3xl bg-atul-charcoal flex items-center justify-center text-white font-black text-xl shadow-lg group-hover:scale-110 transition-transform">
                        {(u.full_name || u.first_name || u.username || 'A')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[15px] font-black text-atul-charcoal tracking-tight">
                          {u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username}
                        </p>
                        <p className="text-[11px] font-bold text-atul-charcoal/40 mt-1 lowercase">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    {getRoleBadge(u.role)}
                  </td>
                  <td className="px-8 py-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 rounded-2xl border border-white shadow-sm">
                       <MaterialIcon name="location_on" className="text-[14px] text-atul-pink_primary" />
                       <span className="text-[11px] font-black text-atul-charcoal/60 uppercase tracking-widest leading-none">{u.outlet_name || 'Central Head'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                      <button className="size-11 rounded-2xl border border-white bg-white text-atul-charcoal/30 hover:text-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all flex items-center justify-center active:scale-90">
                        <MaterialIcon name="edit_note" className="text-xl" />
                      </button>
                      <button className="size-11 rounded-2xl border border-white bg-white text-atul-charcoal/30 hover:text-red-500 hover:shadow-xl hover:shadow-red-500/10 transition-all flex items-center justify-center active:scale-90">
                        <MaterialIcon name="person_off" className="text-xl" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
