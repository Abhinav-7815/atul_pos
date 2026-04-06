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

export default function RoleManagement({ user, isSuperAdmin = true }) {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('roles'); // roles or permissions

  useEffect(() => {
    // TODO: Fetch roles and permissions from API
    // Mock data
    setRoles([
      {
        id: 1,
        name: 'Super Admin',
        description: 'Full system access with all permissions',
        is_system_role: true,
        client_name: 'Platform',
        user_count: 2,
        permissions_count: 40,
        color: 'purple'
      },
      {
        id: 2,
        name: 'Client Admin',
        description: 'Organization administrator with full client access',
        is_system_role: true,
        client_name: 'Platform',
        user_count: 15,
        permissions_count: 30,
        color: 'blue'
      },
      {
        id: 3,
        name: 'Outlet Manager',
        description: 'Manages outlet operations, staff, and inventory',
        is_system_role: true,
        client_name: 'Platform',
        user_count: 8,
        permissions_count: 20,
        color: 'emerald'
      },
      {
        id: 4,
        name: 'Custom Sales Role',
        description: 'Custom role for sales team with specific permissions',
        is_system_role: false,
        client_name: 'Atul Ice Cream',
        user_count: 5,
        permissions_count: 12,
        color: 'amber'
      },
    ]);

    setPermissions([
      { id: 1, codename: 'can_create_user', name: 'Create User', category: 'User Management', description: 'Create new users in the system' },
      { id: 2, codename: 'can_edit_user', name: 'Edit User', category: 'User Management', description: 'Modify existing user information' },
      { id: 3, codename: 'can_delete_user', name: 'Delete User', category: 'User Management', description: 'Remove users from the system' },
      { id: 4, codename: 'can_create_outlet', name: 'Create Outlet', category: 'Outlet Management', description: 'Create new outlets' },
      { id: 5, codename: 'can_edit_outlet', name: 'Edit Outlet', category: 'Outlet Management', description: 'Modify outlet information' },
      { id: 6, codename: 'can_create_product', name: 'Create Product', category: 'Menu Management', description: 'Add new products to menu' },
      { id: 7, codename: 'can_edit_product', name: 'Edit Product', category: 'Menu Management', description: 'Modify product information' },
      { id: 8, codename: 'can_view_reports', name: 'View Reports', category: 'Analytics', description: 'Access analytics and reports' },
      { id: 9, codename: 'can_create_order', name: 'Create Order', category: 'Orders', description: 'Process customer orders' },
      { id: 10, codename: 'can_manage_inventory', name: 'Manage Inventory', category: 'Inventory', description: 'Manage stock and inventory' },
    ]);

    setLoading(false);
  }, []);

  const getCategoryColor = (category) => {
    const colors = {
      'User Management': 'text-purple-600 bg-purple-500/20',
      'Outlet Management': 'text-blue-600 bg-blue-500/20',
      'Menu Management': 'text-emerald-600 bg-emerald-500/20',
      'Analytics': 'text-amber-600 bg-amber-500/20',
      'Orders': 'text-atul-pink_primary bg-atul-pink_primary/20',
      'Inventory': 'text-orange-600 bg-orange-500/20',
    };
    return colors[category] || 'text-gray-600 bg-gray-500/20';
  };

  const getRoleColor = (color) => {
    const colors = {
      purple: { bg: 'bg-gradient-to-br from-purple-500/20 to-transparent', border: 'border-purple-500/30', text: 'text-purple-600' },
      blue: { bg: 'bg-gradient-to-br from-blue-500/20 to-transparent', border: 'border-blue-500/30', text: 'text-blue-600' },
      emerald: { bg: 'bg-gradient-to-br from-emerald-500/20 to-transparent', border: 'border-emerald-500/30', text: 'text-emerald-600' },
      amber: { bg: 'bg-gradient-to-br from-amber-500/20 to-transparent', border: 'border-amber-500/30', text: 'text-amber-600' },
    };
    return colors[color] || colors.blue;
  };

  const permissionsByCategory = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {});

  const RoleCard = ({ role, index }) => {
    const colorScheme = getRoleColor(role.color);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={cn("glass p-6 rounded-3xl border-2 hover:shadow-xl transition-all group cursor-pointer", colorScheme.border, colorScheme.bg)}
        onClick={() => setSelectedRole(role)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className={cn("font-serif text-2xl font-bold group-hover:scale-105 transition-transform", colorScheme.text)}>
                {role.name}
              </h3>
              {role.is_system_role && (
                <span className="px-2 py-0.5 bg-white/50 rounded-lg text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider">
                  System
                </span>
              )}
            </div>
            <p className="text-sm text-atul-charcoal/60 font-medium mb-3">{role.description}</p>
            <div className="text-xs text-atul-charcoal/50 font-medium">
              {role.client_name}
            </div>
          </div>
          <MaterialIcon name="admin_panel_settings" className={cn("text-[32px]", colorScheme.text)} fill />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/50">
          <div>
            <div className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider mb-1">Users</div>
            <div className="text-2xl font-bold text-atul-charcoal font-serif">{role.user_count}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider mb-1">Permissions</div>
            <div className="text-2xl font-bold text-atul-charcoal font-serif">{role.permissions_count}</div>
          </div>
        </div>

        {!role.is_system_role && (
          <div className="flex gap-2 mt-4">
            <button className="flex-1 py-2 rounded-xl bg-white/50 hover:bg-atul-pink_primary hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-1">
              <MaterialIcon name="edit" className="text-sm" />
              Edit
            </button>
            <button className="flex-1 py-2 rounded-xl bg-white/50 hover:bg-red-500 hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-1">
              <MaterialIcon name="delete" className="text-sm" />
              Delete
            </button>
          </div>
        )}
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
              Roles & Permissions
            </h1>
            <p className="text-atul-charcoal/60 text-sm font-medium">
              {isSuperAdmin ? 'System-wide role and permission management' : 'Manage custom roles for your organization'}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-atul-pink_primary text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-atul-pink_primary/30 hover:scale-[1.02] transition-transform"
          >
            <MaterialIcon name="add_circle" className="text-[20px]" />
            <span>Create Role</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="glass p-1.5 rounded-2xl flex gap-2 w-fit">
          <button
            onClick={() => setActiveTab('roles')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              activeTab === 'roles' ? "bg-atul-pink_primary text-white shadow-md" : "text-atul-charcoal/60"
            )}
          >
            <MaterialIcon name="admin_panel_settings" className="text-[18px]" />
            Roles
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              activeTab === 'permissions' ? "bg-atul-pink_primary text-white shadow-md" : "text-atul-charcoal/60"
            )}
          >
            <MaterialIcon name="lock" className="text-[18px]" />
            Permissions
          </button>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="glass p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider">Total Roles</span>
            <MaterialIcon name="admin_panel_settings" className="text-atul-pink_primary text-[24px]" fill />
          </div>
          <div className="text-4xl font-bold text-atul-charcoal font-serif">{roles.length}</div>
        </div>
        <div className="glass p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider">Custom Roles</span>
            <MaterialIcon name="settings" className="text-blue-500 text-[24px]" fill />
          </div>
          <div className="text-4xl font-bold text-atul-charcoal font-serif">{roles.filter(r => !r.is_system_role).length}</div>
        </div>
        <div className="glass p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider">Permissions</span>
            <MaterialIcon name="lock" className="text-emerald-500 text-[24px]" fill />
          </div>
          <div className="text-4xl font-bold text-atul-charcoal font-serif">{permissions.length}</div>
        </div>
        <div className="glass p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider">Categories</span>
            <MaterialIcon name="category" className="text-amber-500 text-[24px]" fill />
          </div>
          <div className="text-4xl font-bold text-atul-charcoal font-serif">{Object.keys(permissionsByCategory).length}</div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'roles' ? (
          <motion.div
            key="roles"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-2 gap-6"
          >
            {roles.map((role, i) => (
              <RoleCard key={role.id} role={role} index={i} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="permissions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {Object.entries(permissionsByCategory).map(([category, perms], catIndex) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: catIndex * 0.1 }}
                className="glass p-6 rounded-3xl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className={cn("px-3 py-1.5 rounded-xl text-xs font-bold", getCategoryColor(category))}>
                    {category}
                  </span>
                  <span className="text-xs text-atul-charcoal/40 font-medium">{perms.length} permissions</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {perms.map((perm, permIndex) => (
                    <motion.div
                      key={perm.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: permIndex * 0.05 }}
                      className="bg-white/50 p-4 rounded-2xl hover:bg-white transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="size-10 rounded-xl bg-gradient-to-br from-atul-pink_primary/20 to-transparent flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <MaterialIcon name="lock" className="text-atul-pink_primary text-[18px]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-atul-charcoal mb-1">{perm.name}</h4>
                          <p className="text-xs text-atul-charcoal/50 font-medium mb-1">{perm.description}</p>
                          <code className="text-[10px] text-atul-charcoal/40 font-mono bg-atul-charcoal/5 px-2 py-0.5 rounded">{perm.codename}</code>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
