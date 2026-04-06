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

export default function SuperAdminDashboard({ user, onNavigate }) {
  const [stats, setStats] = useState({
    clients: { total: 0, active: 0, suspended: 0, trial: 0, enterprise: 0 },
    users: { total: 0, active: 0, super_admins: 0 },
    api_tokens: { total: 0, active: 0 },
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch dashboard stats from API
    // For now using mock data
    setStats({
      clients: { total: 12, active: 10, suspended: 1, trial: 3, enterprise: 4 },
      users: { total: 145, active: 138, super_admins: 3 },
      api_tokens: { total: 8, active: 6 },
    });

    setRecentActivities([
      { id: 1, type: 'login', user: 'admin@atul.com', description: 'Logged in successfully', time: '2 min ago', icon: 'login' },
      { id: 2, type: 'create', user: 'super@admin.com', description: 'Created new client: Sharma Ice Creams', time: '15 min ago', icon: 'add_business' },
      { id: 3, type: 'update', user: 'admin@example.com', description: 'Updated user permissions', time: '1 hour ago', icon: 'admin_panel_settings' },
      { id: 4, type: 'token_generated', user: 'super@admin.com', description: 'Generated API token for client', time: '2 hours ago', icon: 'key' },
    ]);

    setLoading(false);
  }, []);

  const kpis = [
    {
      label: "Total Clients",
      value: stats.clients.total,
      subtitle: `${stats.clients.active} Active`,
      trend: "+2 this month",
      up: true,
      icon: "business",
      color: "atul-pink_primary",
      bgGrad: "from-atul-pink_primary/10 to-atul-pink_primary/5"
    },
    {
      label: "Active Users",
      value: stats.users.active,
      subtitle: `${stats.users.total} Total`,
      trend: "+24 this week",
      up: true,
      icon: "group",
      color: "atul-mint",
      bgGrad: "from-emerald-500/10 to-emerald-500/5"
    },
    {
      label: "API Tokens",
      value: stats.api_tokens.active,
      subtitle: `${stats.api_tokens.total} Issued`,
      trend: "Stable",
      up: false,
      icon: "vpn_key",
      color: "atul-mango",
      bgGrad: "from-amber-500/10 to-amber-500/5"
    },
    {
      label: "Enterprise",
      value: stats.clients.enterprise,
      subtitle: `${stats.clients.trial} Trial`,
      text: "Clients",
      icon: "workspace_premium",
      color: "purple-500",
      bgGrad: "from-purple-500/10 to-purple-500/5"
    }
  ];

  const quickActions = [
    { id: 'clients', label: 'Manage Clients', icon: 'business', description: 'View and manage organizations', color: 'atul-pink_primary' },
    { id: 'users', label: 'All Users', icon: 'group', description: 'System-wide user management', color: 'atul-mint' },
    { id: 'tokens', label: 'API Tokens', icon: 'vpn_key', description: 'Issue and manage tokens', color: 'atul-mango' },
    { id: 'permissions', label: 'Permissions', icon: 'admin_panel_settings', description: 'Configure access control', color: 'purple-500' },
    { id: 'roles', label: 'Roles', icon: 'shield', description: 'Manage system roles', color: 'blue-500' },
    { id: 'activities', label: 'Activity Logs', icon: 'history', description: 'View system activities', color: 'gray-500' },
  ];

  const clientTypes = [
    { label: 'Enterprise', count: stats.clients.enterprise, color: 'purple-500', icon: 'workspace_premium' },
    { label: 'Business', count: 5, color: 'blue-500', icon: 'business_center' },
    { label: 'Starter', count: 0, color: 'green-500', icon: 'rocket_launch' },
    { label: 'Trial', count: stats.clients.trial, color: 'amber-500', icon: 'hourglass_top' },
  ];

  return (
    <div className="flex-1 p-8 min-h-screen overflow-y-auto custom-scrollbar relative z-10 w-full mb-10">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-4xl font-bold text-atul-charcoal mb-2">Super Admin Panel</h1>
            <p className="text-atul-charcoal/60 text-sm font-medium">Platform-wide management and control</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="glass px-4 py-2 rounded-2xl flex items-center gap-2">
              <div className="size-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-bold text-atul-charcoal">System Online</span>
            </div>
            <button className="glass px-5 py-3 rounded-2xl flex items-center gap-2 hover:bg-atul-pink_primary hover:text-white transition-all group">
              <MaterialIcon name="refresh" className="text-[18px]" />
              <span className="text-xs font-bold">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {kpis.map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn("glass p-6 rounded-3xl flex flex-col justify-between relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer")}
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", kpi.bgGrad)}></div>
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <span className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-[0.15em]">{kpi.label}</span>
                <MaterialIcon name={kpi.icon} className={cn("text-[24px]", `text-${kpi.color}`)} fill />
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold text-atul-charcoal font-serif">{kpi.value}</span>
              </div>
              <p className="text-xs text-atul-charcoal/50 font-medium">{kpi.subtitle}</p>
              {kpi.trend && (
                <div className={cn("mt-2 flex items-center gap-1 text-xs font-bold", kpi.up ? "text-emerald-500" : "text-amber-500")}>
                  <MaterialIcon name={kpi.up ? "trending_up" : "trending_flat"} className="text-sm" />
                  <span>{kpi.trend}</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Quick Actions */}
        <div className="col-span-2 glass p-6 rounded-3xl">
          <h3 className="font-serif text-xl font-bold text-atul-charcoal mb-6 flex items-center gap-2">
            <MaterialIcon name="bolt" className="text-atul-pink_primary" fill />
            Quick Actions
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {quickActions.map((action, i) => (
              <motion.button
                key={action.id}
                onClick={() => onNavigate?.(action.id)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="p-5 rounded-2xl bg-gradient-to-br from-white to-atul-cream border border-white/50 hover:shadow-lg transition-all group text-left"
              >
                <MaterialIcon name={action.icon} className={cn("text-[32px] mb-3", `text-${action.color}`)} fill />
                <h4 className="font-bold text-sm text-atul-charcoal mb-1 group-hover:text-atul-pink_primary transition-colors">{action.label}</h4>
                <p className="text-[10px] text-atul-charcoal/50 font-medium">{action.description}</p>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Client Distribution */}
        <div className="glass p-6 rounded-3xl">
          <h3 className="font-serif text-xl font-bold text-atul-charcoal mb-6">Client Types</h3>
          <div className="space-y-4">
            {clientTypes.map((type, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-white to-atul-cream border border-white/50">
                <div className="flex items-center gap-3">
                  <div className={cn("size-10 rounded-full bg-gradient-to-br flex items-center justify-center", `from-${type.color}/20 to-${type.color}/10`)}>
                    <MaterialIcon name={type.icon} className={cn("text-[18px]", `text-${type.color}`)} />
                  </div>
                  <span className="text-sm font-bold text-atul-charcoal">{type.label}</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-atul-charcoal font-serif">{type.count}</div>
                  <div className="text-[9px] text-atul-charcoal/50 font-medium uppercase">Clients</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="glass p-6 rounded-3xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif text-xl font-bold text-atul-charcoal flex items-center gap-2">
            <MaterialIcon name="history" className="text-atul-pink_primary" />
            Recent Activities
          </h3>
          <button
            onClick={() => onNavigate?.('activities')}
            className="text-xs font-bold text-atul-pink_primary hover:underline flex items-center gap-1"
          >
            View All
            <MaterialIcon name="arrow_forward" className="text-sm" />
          </button>
        </div>
        <div className="space-y-3">
          {recentActivities.map((activity, i) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-white to-atul-cream border border-white/50 hover:shadow-md transition-shadow"
            >
              <div className="size-10 rounded-full bg-gradient-to-br from-atul-pink_primary/20 to-atul-pink_primary/10 flex items-center justify-center flex-shrink-0">
                <MaterialIcon name={activity.icon} className="text-[18px] text-atul-pink_primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-atul-charcoal mb-0.5">{activity.description}</p>
                <p className="text-xs text-atul-charcoal/50 font-medium">{activity.user}</p>
              </div>
              <div className="text-xs text-atul-charcoal/40 font-medium whitespace-nowrap">{activity.time}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
