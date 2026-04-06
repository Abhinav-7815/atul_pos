import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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

export default function ActivityLogs({ user, isSuperAdmin = true }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [dateRange, setDateRange] = useState('today');

  useEffect(() => {
    // TODO: Fetch activities from API
    // Mock data
    setActivities([
      {
        id: 1,
        activity_type: 'login',
        description: 'User logged in successfully',
        user_name: 'Aryan Patel',
        user_email: 'admin@atul.com',
        ip_address: '192.168.1.100',
        timestamp: '2 min ago',
        metadata: { device: 'Chrome on Windows', location: 'Ahmedabad, IN' }
      },
      {
        id: 2,
        activity_type: 'user_created',
        description: 'Created new user "Priya Sharma"',
        user_name: 'Aryan Patel',
        user_email: 'admin@atul.com',
        ip_address: '192.168.1.100',
        timestamp: '15 min ago',
        metadata: { target_user: 'priya.sharma@atul.com', role: 'cashier' }
      },
      {
        id: 3,
        activity_type: 'order_created',
        description: 'Created order #ORD-2025-0326-001',
        user_name: 'Amit Kumar',
        user_email: 'cashier@atul.com',
        ip_address: '10.0.0.50',
        timestamp: '30 min ago',
        metadata: { order_total: '₹2,450', items_count: 5 }
      },
      {
        id: 4,
        activity_type: 'product_updated',
        description: 'Updated product "Mango Delight Sundae"',
        user_name: 'Rajesh Sharma',
        user_email: 'manager@atul.com',
        ip_address: '192.168.1.105',
        timestamp: '1 hour ago',
        metadata: { changes: ['price', 'description'], old_price: '₹250', new_price: '₹280' }
      },
      {
        id: 5,
        activity_type: 'logout',
        description: 'User logged out',
        user_name: 'Sanjay Verma',
        user_email: 'kitchen@atul.com',
        ip_address: '192.168.1.110',
        timestamp: '2 hours ago',
        metadata: { session_duration: '4h 32m' }
      },
      {
        id: 6,
        activity_type: 'role_updated',
        description: 'Updated role permissions for "Cashier"',
        user_name: 'Aryan Patel',
        user_email: 'admin@atul.com',
        ip_address: '192.168.1.100',
        timestamp: '3 hours ago',
        metadata: { added_permissions: 2, removed_permissions: 1 }
      },
      {
        id: 7,
        activity_type: 'token_created',
        description: 'Generated new API token "Mobile App v2"',
        user_name: 'Aryan Patel',
        user_email: 'admin@atul.com',
        ip_address: '192.168.1.100',
        timestamp: '5 hours ago',
        metadata: { scopes: ['read:menu', 'write:orders'], rate_limit: 1000 }
      },
      {
        id: 8,
        activity_type: 'failed_login',
        description: 'Failed login attempt',
        user_name: 'Unknown',
        user_email: 'test@example.com',
        ip_address: '203.0.113.42',
        timestamp: '6 hours ago',
        metadata: { reason: 'Invalid credentials', attempts: 3 }
      },
    ]);
    setLoading(false);
  }, []);

  const getActivityStyle = (type) => {
    const styles = {
      login: { icon: 'login', color: 'text-emerald-600', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30' },
      logout: { icon: 'logout', color: 'text-blue-600', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
      user_created: { icon: 'person_add', color: 'text-purple-600', bg: 'bg-purple-500/20', border: 'border-purple-500/30' },
      user_updated: { icon: 'edit', color: 'text-amber-600', bg: 'bg-amber-500/20', border: 'border-amber-500/30' },
      order_created: { icon: 'shopping_cart', color: 'text-atul-pink_primary', bg: 'bg-atul-pink_primary/20', border: 'border-atul-pink_primary/30' },
      product_updated: { icon: 'edit_note', color: 'text-blue-600', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
      role_updated: { icon: 'admin_panel_settings', color: 'text-purple-600', bg: 'bg-purple-500/20', border: 'border-purple-500/30' },
      token_created: { icon: 'key', color: 'text-amber-600', bg: 'bg-amber-500/20', border: 'border-amber-500/30' },
      failed_login: { icon: 'warning', color: 'text-red-600', bg: 'bg-red-500/20', border: 'border-red-500/30' },
      system: { icon: 'settings', color: 'text-gray-600', bg: 'bg-gray-500/20', border: 'border-gray-500/30' },
    };
    return styles[type] || styles.system;
  };

  const filteredActivities = activities.filter(a => {
    const matchesType = filterType === 'all' || a.activity_type === filterType;
    const matchesUser = filterUser === 'all' || a.user_email === filterUser;
    return matchesType && matchesUser;
  });

  const uniqueUsers = [...new Set(activities.map(a => a.user_email))];

  const ActivityItem = ({ activity, index }) => {
    const style = getActivityStyle(activity.activity_type);

    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        className={cn("glass p-5 rounded-2xl border-l-4 hover:shadow-lg transition-all", style.border)}
      >
        <div className="flex items-start gap-4">
          <div className={cn("size-12 rounded-xl flex items-center justify-center flex-shrink-0", style.bg)}>
            <MaterialIcon name={style.icon} className={cn("text-[24px]", style.color)} fill />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <p className="font-bold text-atul-charcoal mb-1">{activity.description}</p>
                <div className="flex items-center gap-3 text-xs text-atul-charcoal/60 font-medium">
                  <span className="flex items-center gap-1">
                    <MaterialIcon name="person" className="text-xs" />
                    {activity.user_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <MaterialIcon name="email" className="text-xs" />
                    {activity.user_email}
                  </span>
                  <span className="flex items-center gap-1">
                    <MaterialIcon name="location_on" className="text-xs" />
                    {activity.ip_address}
                  </span>
                </div>
              </div>
              <span className="text-xs text-atul-charcoal/40 font-medium whitespace-nowrap ml-4">
                {activity.timestamp}
              </span>
            </div>

            {/* Metadata */}
            {activity.metadata && Object.keys(activity.metadata).length > 0 && (
              <div className="bg-white/50 rounded-xl p-3 mt-3">
                <div className="flex flex-wrap gap-3">
                  {Object.entries(activity.metadata).map(([key, value]) => (
                    <div key={key} className="text-xs">
                      <span className="text-atul-charcoal/50 font-medium">{key.replace(/_/g, ' ')}:</span>
                      <span className="text-atul-charcoal font-bold ml-1">
                        {Array.isArray(value) ? value.join(', ') : value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex-1 p-8 min-h-screen overflow-y-auto custom-scrollbar relative z-10 w-full mb-10">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-4xl font-bold text-atul-charcoal mb-2">
              Activity Logs
            </h1>
            <p className="text-atul-charcoal/60 text-sm font-medium">
              {isSuperAdmin ? 'System-wide activity monitoring and audit trail' : 'Monitor activities in your organization'}
            </p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 bg-white/50 glass px-6 py-3 rounded-2xl font-bold hover:bg-white transition-all">
              <MaterialIcon name="download" className="text-[20px]" />
              <span>Export</span>
            </button>
            <button className="flex items-center gap-2 bg-atul-pink_primary text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-atul-pink_primary/30 hover:scale-[1.02] transition-transform">
              <MaterialIcon name="refresh" className="text-[20px]" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="glass p-5 rounded-3xl">
          <div className="grid grid-cols-3 gap-4">
            {/* Activity Type Filter */}
            <div>
              <label className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider mb-2 block">
                Activity Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/50 rounded-xl text-sm font-medium text-atul-charcoal focus:outline-none focus:ring-2 focus:ring-atul-pink_primary/20"
              >
                <option value="all">All Activities</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
                <option value="user_created">User Created</option>
                <option value="order_created">Order Created</option>
                <option value="product_updated">Product Updated</option>
                <option value="role_updated">Role Updated</option>
                <option value="token_created">Token Created</option>
                <option value="failed_login">Failed Login</option>
              </select>
            </div>

            {/* User Filter */}
            <div>
              <label className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider mb-2 block">
                User
              </label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/50 rounded-xl text-sm font-medium text-atul-charcoal focus:outline-none focus:ring-2 focus:ring-atul-pink_primary/20"
              >
                <option value="all">All Users</option>
                {uniqueUsers.map(email => (
                  <option key={email} value={email}>{email}</option>
                ))}
              </select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider mb-2 block">
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/50 rounded-xl text-sm font-medium text-atul-charcoal focus:outline-none focus:ring-2 focus:ring-atul-pink_primary/20"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="glass p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider">Total Activities</span>
            <MaterialIcon name="history" className="text-atul-pink_primary text-[24px]" fill />
          </div>
          <div className="text-4xl font-bold text-atul-charcoal font-serif">{activities.length}</div>
        </div>
        <div className="glass p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider">Success Rate</span>
            <MaterialIcon name="check_circle" className="text-emerald-500 text-[24px]" fill />
          </div>
          <div className="text-4xl font-bold text-atul-charcoal font-serif">98.5%</div>
        </div>
        <div className="glass p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider">Active Users</span>
            <MaterialIcon name="group" className="text-blue-500 text-[24px]" fill />
          </div>
          <div className="text-4xl font-bold text-atul-charcoal font-serif">{uniqueUsers.length}</div>
        </div>
        <div className="glass p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider">Failed Attempts</span>
            <MaterialIcon name="warning" className="text-red-500 text-[24px]" fill />
          </div>
          <div className="text-4xl font-bold text-atul-charcoal font-serif">
            {activities.filter(a => a.activity_type === 'failed_login').length}
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="space-y-4">
        {filteredActivities.map((activity, i) => (
          <ActivityItem key={activity.id} activity={activity} index={i} />
        ))}
      </div>

      {/* Empty State */}
      {filteredActivities.length === 0 && (
        <div className="glass p-12 rounded-3xl text-center">
          <MaterialIcon name="history" className="text-[64px] text-atul-charcoal/20 mb-4" />
          <h3 className="font-serif text-2xl font-bold text-atul-charcoal/40 mb-2">No activities found</h3>
          <p className="text-atul-charcoal/30 text-sm font-medium">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
}
