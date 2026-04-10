import React, { useState } from 'react';
import { authApi } from '../services/api';
import { IceCream } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login({ onLoginSuccess }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await authApi.login({ phone, password });
      const loginData = response.data?.data || response.data;
      const { access, refresh, user } = loginData;
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user', JSON.stringify(user));
      onLoginSuccess(user);
    } catch (err) {
      setError('Invalid phone number or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-atul-cream flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl border border-atul-pink_soft"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-atul-pink_soft rounded-3xl flex items-center justify-center mb-4 shadow-inner">
            <IceCream className="text-atul-pink_primary" size={40} />
          </div>
          <h1 className="text-3xl font-bold font-serif text-atul-charcoal">Atul Ice Cream</h1>
          <p className="text-atul-gray mt-2 uppercase tracking-widest text-xs font-bold">Luxury POS System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-atul-charcoal mb-2 ml-1">Mobile Number</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl bg-atul-cream border-transparent focus:bg-white focus:ring-2 ring-atul-pink_primary border border-atul-pink_soft outline-none transition-all"
              placeholder="9876543210"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-atul-charcoal mb-2 ml-1">Secret Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl bg-atul-cream border-transparent focus:bg-white focus:ring-2 ring-atul-pink_primary border border-atul-pink_soft outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-atul-red/10 text-atul-red px-4 py-3 rounded-xl text-sm font-medium border border-atul-red/20 text-center"
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-4 rounded-2xl font-bold text-lg active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-8 text-center text-atul-gray text-xs">
          © 2026 ATUL ICE CREAM. ALL RIGHTS RESERVED.
        </p>
      </motion.div>
    </div>
  );
}
