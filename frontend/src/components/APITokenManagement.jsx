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

export default function APITokenManagement({ user, isSuperAdmin = true }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);

  useEffect(() => {
    // TODO: Fetch tokens from API
    // Mock data
    setTokens([
      {
        id: 1,
        name: 'Production API',
        token_preview: 'atl_prod_*********************xyz',
        client_name: 'Atul Ice Cream',
        is_active: true,
        created_at: '2025-03-01',
        last_used: '2 min ago',
        expires_at: '2026-03-01',
        request_count: 145280,
        rate_limit: 1000,
        ip_whitelist: ['192.168.1.100', '10.0.0.50'],
        scopes: ['read:menu', 'write:orders', 'read:analytics']
      },
      {
        id: 2,
        name: 'Mobile App Token',
        token_preview: 'atl_mobile_*******************abc',
        client_name: 'Sharma Ice Creams',
        is_active: true,
        created_at: '2025-02-15',
        last_used: '1 hour ago',
        expires_at: '2025-12-31',
        request_count: 52341,
        rate_limit: 500,
        ip_whitelist: null,
        scopes: ['read:menu', 'write:orders']
      },
      {
        id: 3,
        name: 'Analytics Dashboard',
        token_preview: 'atl_analytics_****************def',
        client_name: 'Atul Ice Cream',
        is_active: true,
        created_at: '2025-01-20',
        last_used: '30 min ago',
        expires_at: null,
        request_count: 98765,
        rate_limit: 2000,
        ip_whitelist: ['172.16.0.10'],
        scopes: ['read:analytics', 'read:reports']
      },
      {
        id: 4,
        name: 'Legacy Integration',
        token_preview: 'atl_legacy_*******************ghi',
        client_name: 'Patel Distributors',
        is_active: false,
        created_at: '2024-11-10',
        last_used: '15 days ago',
        expires_at: '2025-04-01',
        request_count: 12450,
        rate_limit: 100,
        ip_whitelist: null,
        scopes: ['read:inventory']
      },
    ]);
    setLoading(false);
  }, []);

  const filteredTokens = tokens.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.client_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' ||
                         (filterStatus === 'active' && t.is_active) ||
                         (filterStatus === 'inactive' && !t.is_active);
    return matchesSearch && matchesStatus;
  });

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  const getExpiryStatus = (expiresAt) => {
    if (!expiresAt) return { text: 'Never', color: 'text-atul-charcoal/40' };
    const daysUntilExpiry = Math.floor((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 0) return { text: 'Expired', color: 'text-red-600' };
    if (daysUntilExpiry < 30) return { text: `${daysUntilExpiry} days`, color: 'text-amber-600' };
    return { text: new Date(expiresAt).toLocaleDateString(), color: 'text-emerald-600' };
  };

  const TokenCard = ({ token, index }) => {
    const expiryStatus = getExpiryStatus(token.expires_at);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="glass p-6 rounded-3xl hover:shadow-xl transition-all group cursor-pointer"
        onClick={() => setSelectedToken(token)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-serif text-xl font-bold text-atul-charcoal group-hover:text-atul-pink_primary transition-colors truncate">
                {token.name}
              </h3>
              <div className={cn("size-3 rounded-full flex-shrink-0", token.is_active ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" : "bg-gray-300")}></div>
            </div>
            <code className="text-xs font-mono text-atul-charcoal/60 bg-white/50 px-3 py-1 rounded-lg inline-block mb-2">
              {token.token_preview}
            </code>
            <p className="text-sm text-atul-charcoal/60 font-medium">{token.client_name}</p>
          </div>
          <MaterialIcon name="key" className="text-atul-pink_primary text-[32px]" fill />
        </div>

        {/* Scopes */}
        <div className="flex flex-wrap gap-2 mb-4">
          {token.scopes.map((scope, i) => (
            <span key={i} className="px-2 py-1 bg-gradient-to-r from-atul-pink_primary/20 to-transparent rounded-lg text-[10px] font-bold text-atul-pink_primary">
              {scope}
            </span>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/50 mb-4">
          <div>
            <div className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider mb-1">Requests</div>
            <div className="text-lg font-bold text-atul-charcoal font-serif">{formatNumber(token.request_count)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider mb-1">Rate Limit</div>
            <div className="text-lg font-bold text-atul-charcoal font-serif">{token.rate_limit}/hr</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider mb-1">Last Used</div>
            <div className="text-sm font-bold text-atul-charcoal">{token.last_used}</div>
          </div>
        </div>

        {/* IP Whitelist */}
        {token.ip_whitelist && (
          <div className="mb-4">
            <div className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider mb-2 flex items-center gap-1">
              <MaterialIcon name="shield" className="text-xs" />
              IP Whitelist
            </div>
            <div className="flex flex-wrap gap-2">
              {token.ip_whitelist.map((ip, i) => (
                <code key={i} className="text-xs font-mono text-atul-charcoal/60 bg-white/50 px-2 py-1 rounded">
                  {ip}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Expiry */}
        <div className="flex items-center justify-between pt-4 border-t border-white/50 mb-4">
          <span className="text-xs text-atul-charcoal/60 font-medium">Expires:</span>
          <span className={cn("text-sm font-bold", expiryStatus.color)}>{expiryStatus.text}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button className="flex-1 py-2 rounded-xl bg-white/50 hover:bg-atul-pink_primary hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-1">
            <MaterialIcon name="content_copy" className="text-sm" />
            Copy
          </button>
          <button className="flex-1 py-2 rounded-xl bg-white/50 hover:bg-blue-500 hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-1">
            <MaterialIcon name="refresh" className="text-sm" />
            Regenerate
          </button>
          <button className={cn(
            "flex-1 py-2 rounded-xl bg-white/50 transition-all text-xs font-bold flex items-center justify-center gap-1",
            token.is_active ? "hover:bg-red-500 hover:text-white" : "hover:bg-emerald-500 hover:text-white"
          )}>
            <MaterialIcon name={token.is_active ? "block" : "check_circle"} className="text-sm" />
            {token.is_active ? 'Revoke' : 'Activate'}
          </button>
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
              API Tokens
            </h1>
            <p className="text-atul-charcoal/60 text-sm font-medium">
              {isSuperAdmin ? 'System-wide API token management' : 'Manage API tokens for your organization'}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-atul-pink_primary text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-atul-pink_primary/30 hover:scale-[1.02] transition-transform"
          >
            <MaterialIcon name="add_circle" className="text-[20px]" />
            <span>Generate Token</span>
          </button>
        </div>

        {/* Filters & Search */}
        <div className="glass p-5 rounded-3xl flex items-center gap-4">
          <div className="flex-1 relative">
            <MaterialIcon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-atul-charcoal/40 text-[20px]" />
            <input
              type="text"
              placeholder="Search tokens by name or organization..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/50 rounded-2xl text-sm font-medium text-atul-charcoal placeholder:text-atul-charcoal/40 focus:outline-none focus:ring-2 focus:ring-atul-pink_primary/20"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'active', 'inactive'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
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

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="glass p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider">Total Tokens</span>
            <MaterialIcon name="key" className="text-atul-pink_primary text-[24px]" fill />
          </div>
          <div className="text-4xl font-bold text-atul-charcoal font-serif">{tokens.length}</div>
        </div>
        <div className="glass p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider">Active</span>
            <MaterialIcon name="check_circle" className="text-emerald-500 text-[24px]" fill />
          </div>
          <div className="text-4xl font-bold text-atul-charcoal font-serif">{tokens.filter(t => t.is_active).length}</div>
        </div>
        <div className="glass p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider">Total Requests</span>
            <MaterialIcon name="analytics" className="text-blue-500 text-[24px]" fill />
          </div>
          <div className="text-4xl font-bold text-atul-charcoal font-serif">
            {formatNumber(tokens.reduce((sum, t) => sum + t.request_count, 0))}
          </div>
        </div>
        <div className="glass p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-atul-charcoal/60 uppercase tracking-wider">Expiring Soon</span>
            <MaterialIcon name="schedule" className="text-amber-500 text-[24px]" fill />
          </div>
          <div className="text-4xl font-bold text-atul-charcoal font-serif">
            {tokens.filter(t => {
              if (!t.expires_at) return false;
              const days = Math.floor((new Date(t.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
              return days > 0 && days < 30;
            }).length}
          </div>
        </div>
      </div>

      {/* Tokens Grid */}
      <div className="grid grid-cols-2 gap-6">
        {filteredTokens.map((token, i) => (
          <TokenCard key={token.id} token={token} index={i} />
        ))}
      </div>

      {/* Empty State */}
      {filteredTokens.length === 0 && (
        <div className="glass p-12 rounded-3xl text-center">
          <MaterialIcon name="key_off" className="text-[64px] text-atul-charcoal/20 mb-4" />
          <h3 className="font-serif text-2xl font-bold text-atul-charcoal/40 mb-2">No tokens found</h3>
          <p className="text-atul-charcoal/30 text-sm font-medium">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Security Notice */}
      <div className="glass p-6 rounded-3xl mt-8 border-l-4 border-amber-500">
        <div className="flex items-start gap-4">
          <MaterialIcon name="warning" className="text-amber-500 text-[32px] flex-shrink-0" fill />
          <div>
            <h3 className="font-bold text-atul-charcoal mb-2">Security Best Practices</h3>
            <ul className="text-sm text-atul-charcoal/60 space-y-1 font-medium">
              <li className="flex items-start gap-2">
                <MaterialIcon name="check_circle" className="text-emerald-500 text-sm flex-shrink-0 mt-0.5" />
                Always store tokens securely and never commit them to version control
              </li>
              <li className="flex items-start gap-2">
                <MaterialIcon name="check_circle" className="text-emerald-500 text-sm flex-shrink-0 mt-0.5" />
                Use IP whitelisting to restrict token access to known locations
              </li>
              <li className="flex items-start gap-2">
                <MaterialIcon name="check_circle" className="text-emerald-500 text-sm flex-shrink-0 mt-0.5" />
                Rotate tokens regularly and revoke unused tokens immediately
              </li>
              <li className="flex items-start gap-2">
                <MaterialIcon name="check_circle" className="text-emerald-500 text-sm flex-shrink-0 mt-0.5" />
                Monitor token usage and set appropriate rate limits
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
