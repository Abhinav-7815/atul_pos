import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const MaterialIcon = ({ name, className = "", fill = false }) => (
  <span className={cn("material-symbols-outlined", className, fill && "fill-1")}>
    {name}
  </span>
);

export default function ClientManagement({ user }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  useEffect(() => {
    // TODO: Fetch clients from API
    // Mock data for now
    setClients([
      {
        id: 1,
        name: 'Atul Ice Cream Parlors',
        slug: 'atul-ice-cream',
        email: 'admin@atulic.com',
        phone: '+91 98765 43210',
        client_type: 'enterprise',
        status: 'active',
        outlets_count: 5,
        users_count: 15,
        max_outlets: 10,
        max_users: 20,
        subscription_end: '2026-12-31',
        created_at: '2025-01-01'
      },
      {
        id: 2,
        name: 'Sharma Ice Creams',
        slug: 'sharma-ice-creams',
        email: 'admin@sharmaicecreams.com',
        phone: '+91 98765 11111',
        client_type: 'business',
        status: 'active',
        outlets_count: 3,
        users_count: 8,
        max_outlets: 5,
        max_users: 15,
        subscription_end: '2026-06-30',
        created_at: '2025-02-15'
      },
      {
        id: 3,
        name: 'Frozen Delights',
        slug: 'frozen-delights',
        email: 'info@frozendelights.com',
        phone: '+91 98765 22222',
        client_type: 'trial',
        status: 'pending',
        outlets_count: 1,
        users_count: 3,
        max_outlets: 3,
        max_users: 10,
        subscription_end: '2026-04-15',
        created_at: '2026-03-15'
      },
    ]);
    setLoading(false);
  }, []);

  const getStatusBadge = (status) => {
    const styles = {
      active: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: 'check_circle' },
      suspended: { bg: 'bg-red-500/10', text: 'text-red-600', icon: 'block' },
      pending: { bg: 'bg-amber-500/10', text: 'text-amber-600', icon: 'schedule' },
      expired: { bg: 'bg-gray-500/10', text: 'text-gray-600', icon: 'event_busy' },
    };
    const style = styles[status] || styles.active;
    return (
      <span className={cn("px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit", style.bg, style.text)}>
        <MaterialIcon name={style.icon} className="text-sm" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getClientTypeBadge = (type) => {
    const styles = {
      enterprise: { bg: 'from-purple-500/20', text: 'text-purple-600', icon: 'workspace_premium' },
      business: { bg: 'from-blue-500/20', text: 'text-blue-600', icon: 'business_center' },
      starter: { bg: 'from-green-500/20', text: 'text-green-600', icon: 'rocket_launch' },
      trial: { bg: 'from-amber-500/20', text: 'text-amber-600', icon: 'hourglass_top' },
    };
    const style = styles[type] || styles.starter;
    return (
      <div className={cn("px-3 py-1 rounded-xl bg-gradient-to-br to-transparent text-xs font-bold flex items-center gap-1", style.bg, style.text)}>
        <MaterialIcon name={style.icon} className="text-sm" />
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </div>
    );
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || client.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex-1 p-8 min-h-screen overflow-y-auto custom-scrollbar relative z-10 w-full mb-10">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-4xl font-bold text-atul-charcoal mb-2">Client Management</h1>
            <p className="text-atul-charcoal/60 text-sm font-medium">Manage organizations and subscriptions</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-atul-pink_primary text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-atul-pink_primary/30 hover:scale-[1.02] transition-transform"
          >
            <MaterialIcon name="add_circle" className="text-[20px]" />
            <span>Add Client</span>
          </button>
        </div>

        {/* Filters & Search */}
        <div className="glass p-5 rounded-3xl flex items-center gap-4">
          <div className="flex-1 relative">
            <MaterialIcon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-atul-charcoal/40 text-[20px]" />
            <input
              type="text"
              placeholder="Search clients by name, email, or slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/50 rounded-2xl text-sm font-medium text-atul-charcoal placeholder:text-atul-charcoal/40 focus:outline-none focus:ring-2 focus:ring-atul-pink_primary/20"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'active', 'pending', 'suspended'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  filterStatus === status
                    ? "bg-atul-pink_primary text-white shadow-md"
                    : "bg-white/50 text-atul-charcoal/60 hover:bg-white"
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 gap-6">
        {filteredClients.map((client, i) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass p-6 rounded-3xl hover:shadow-xl transition-all group cursor-pointer"
            onClick={() => setSelectedClient(client)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-atul-pink_primary/20 to-atul-pink_primary/10 flex items-center justify-center flex-shrink-0">
                  <MaterialIcon name="business" className="text-[32px] text-atul-pink_primary" fill />
                </div>
                <div>
                  <h3 className="font-serif text-2xl font-bold text-atul-charcoal mb-1 group-hover:text-atul-pink_primary transition-colors">{client.name}</h3>
                  <p className="text-sm text-atul-charcoal/60 font-medium mb-2">{client.slug}</p>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(client.status)}
                    {getClientTypeBadge(client.client_type)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="size-10 rounded-xl glass hover:bg-atul-pink_primary hover:text-white transition-all flex items-center justify-center">
                  <MaterialIcon name="edit" className="text-[18px]" />
                </button>
                <button className="size-10 rounded-xl glass hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
                  <MaterialIcon name="block" className="text-[18px]" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-6 pt-4 border-t border-white/50">
              <div>
                <div className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider mb-1">Contact</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-atul-charcoal">
                    <MaterialIcon name="mail" className="text-xs text-atul-pink_primary" />
                    <span className="font-medium truncate">{client.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-atul-charcoal">
                    <MaterialIcon name="phone" className="text-xs text-atul-pink_primary" />
                    <span className="font-medium">{client.phone}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider mb-1">Outlets</div>
                <div className="text-2xl font-bold text-atul-charcoal font-serif">{client.outlets_count}</div>
                <div className="text-xs text-atul-charcoal/50 font-medium">of {client.max_outlets} allowed</div>
                <div className="mt-2 bg-white/50 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-atul-pink_primary to-atul-pink_deep rounded-full" style={{ width: `${(client.outlets_count / client.max_outlets) * 100}%` }}></div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider mb-1">Users</div>
                <div className="text-2xl font-bold text-atul-charcoal font-serif">{client.users_count}</div>
                <div className="text-xs text-atul-charcoal/50 font-medium">of {client.max_users} allowed</div>
                <div className="mt-2 bg-white/50 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full" style={{ width: `${(client.users_count / client.max_users) * 100}%` }}></div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider mb-1">Subscription</div>
                <div className="text-sm font-bold text-atul-charcoal">{client.subscription_end}</div>
                <div className="text-xs text-atul-charcoal/50 font-medium">Expires</div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider mb-1">Created</div>
                <div className="text-sm font-bold text-atul-charcoal">{client.created_at}</div>
                <div className="mt-2">
                  <button className="text-xs font-bold text-atul-pink_primary hover:underline flex items-center gap-1">
                    View Details
                    <MaterialIcon name="arrow_forward" className="text-xs" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {filteredClients.length === 0 && (
        <div className="glass p-12 rounded-3xl text-center">
          <MaterialIcon name="business" className="text-[64px] text-atul-charcoal/20 mb-4" />
          <h3 className="font-serif text-2xl font-bold text-atul-charcoal/40 mb-2">No clients found</h3>
          <p className="text-atul-charcoal/30 text-sm font-medium">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
}
