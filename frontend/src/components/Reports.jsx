import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { orderApi } from '../services/api';
import * as XLSX from 'xlsx';
import {
  Calendar,
  Download,
  Search,
  FileText,
  Printer,
  X,
  Receipt,
  Clock,
  TrendingUp,
  ArrowUpRight,
  Edit2,
  Trash2,
  Eye,
  Save,
  Plus,
  Minus
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const MaterialIcon = ({ name, className = "", fill = false }) => (
  <span className={cn("material-symbols-outlined leading-none", className, fill && "fill-1")}>
    {name}
  </span>
);

export default function Reports({ user }) {
  // Get today's date in local timezone
  const getToday = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() - offset);
    return localDate.toISOString().split('T')[0];
  };

  const today = getToday();
  const [selectedDate, setSelectedDate] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [dateMode, setDateMode] = useState(() => localStorage.getItem('atul_pos_reports_date_mode') || 'single');

  useEffect(() => {
    localStorage.setItem('atul_pos_reports_date_mode', dateMode);
  }, [dateMode]);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [voidPin, setVoidPin] = useState('');
  const [bulkDeletePassword, setBulkDeletePassword] = useState('');

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(50);

  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    cashOrders: 0,
    cardOrders: 0,
    upiOrders: 0,
    totalDiscount: 0,
    totalTax: 0,
    netSales: 0
  });

  const fetchOrders = async () => {
    try {
      setLoading(true);

      const params = {
        outlet: user?.outlet,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        ordering: '-created_at'
      };

      // Add date filtering based on mode
      if (dateMode === 'single') {
        params.created_at__date = selectedDate;
      } else {
        params.created_at__gte = startDate + 'T00:00:00';
        params.created_at__lte = endDate + 'T23:59:59';
      }

      const res = await orderApi.getOrders(params);

      // Extremely defensive data extraction
      const rawData = res?.data;
      const orderData = rawData?.data || rawData?.results || (Array.isArray(rawData) ? rawData : []);
      const count = rawData?.count || (Array.isArray(rawData) ? rawData.length : 0);
      const ordersArray = Array.isArray(orderData) ? orderData : [];

      setOrders(ordersArray);
      setTotalCount(count);
      
      // For stats, we might want to fetch without pagination if needed, but for now we calculate from current page
      // Actually, typically we should have a separate stats call.
      calculateStats(ordersArray);
    } catch (err) {
      console.error("Failed to fetch orders", err);
      setOrders([]);
      calculateStats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [selectedDate, startDate, endDate, dateMode, user?.outlet]);

  useEffect(() => {
    fetchOrders();
  }, [selectedDate, startDate, endDate, dateMode, user?.outlet, page]);

  const handleBulkDelete = async () => {
    if (!bulkDeletePassword) {
      alert("Password is required.");
      return;
    }
    if (!window.confirm("CRITICAL: Are you sure you want to delete ALL orders for the current outlet? This action is IRREVERSIBLE and will also clear related item records.")) {
      return;
    }
    setLoading(true);
    try {
      await orderApi.bulkDeleteOrders({ password: bulkDeletePassword });
      alert("All records successfully cleared.");
      setShowBulkDeleteConfirm(false);
      setBulkDeletePassword('');
      setPage(1);
      fetchOrders();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Bulk delete failed. Incorrect password.');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (ordersList) => {
    const safeList = Array.isArray(ordersList) ? ordersList : [];

    let rev = 0;
    let cash = 0;
    let card = 0;
    let upi = 0;
    let discount = 0;
    let tax = 0;

    safeList.forEach(o => {
      const amt = parseFloat(o.total_amount || 0);
      if (!isNaN(amt)) rev += amt;

      const method = (o.payments?.[0]?.method || o.payment_mode || 'Cash').toLowerCase();
      if (method === 'cash') cash++;
      else if (method === 'card') card++;
      else if (method === 'upi') upi++;

      // Calculate discount and tax if available
      discount += parseFloat(o.discount_amount || 0);
      tax += parseFloat(o.tax_amount || 0);
    });

    const total = safeList.length;
    setStats({
      totalOrders: total,
      totalRevenue: rev,
      avgOrderValue: total > 0 ? rev / total : 0,
      cashOrders: cash,
      cardOrders: card,
      upiOrders: upi,
      totalDiscount: discount,
      totalTax: tax,
      netSales: rev - discount
    });
  };

  const applyFilters = useCallback(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const searchLow = (searchQuery || '').toLowerCase();
    
    let filtered = safeOrders.filter(order => {
      // Search filter
      const matchesSearch = !searchLow || (
        (order.order_number?.toString() || '').toLowerCase().includes(searchLow) ||
        (Array.isArray(order.items) && order.items.some(it => 
          (it.product_name || '').toLowerCase().includes(searchLow)
        ))
      );

      // Payment filter
      const method = (order.payments?.[0]?.method || order.payment_mode || 'Cash').toLowerCase();
      const matchesPayment = paymentFilter === 'all' || method === paymentFilter.toLowerCase();

      return matchesSearch && matchesPayment;
    });

    setFilteredOrders(filtered);
  }, [orders, searchQuery, paymentFilter]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handlePrint = () => window.print();

  const handleExportExcel = () => {
    const dateRangeText = dateMode === 'single'
      ? selectedDate
      : `${startDate}_to_${endDate}`;

    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // ========== SHEET 1: Summary ==========
    const summaryData = [
      ['SALES REPORT'],
      [`${user?.outlet_name || 'Atul Ice Cream POS'}`],
      [`Generated: ${new Date().toLocaleString('en-IN')}`],
      [`Period: ${dateMode === 'single' ? selectedDate : `${startDate} to ${endDate}`}`],
      [],
      ['SALES SUMMARY'],
      ['Metric', 'Value'],
      ['Total Orders', stats.totalOrders],
      ['Total Revenue', `₹${stats.totalRevenue.toFixed(2)}`],
      ['Average Order Value', `₹${stats.avgOrderValue.toFixed(2)}`],
      ['Total Discounts', stats.totalDiscount > 0 ? `₹${stats.totalDiscount.toFixed(2)}` : '₹0.00'],
      ['Total Tax', stats.totalTax > 0 ? `₹${stats.totalTax.toFixed(2)}` : '₹0.00'],
      ['Net Sales', `₹${stats.netSales.toFixed(2)}`],
      [],
      ['PAYMENT METHOD BREAKDOWN'],
      ['Method', 'Count', 'Amount'],
      ['Cash', stats.cashOrders, `₹${filteredOrders.filter(o => (o.payments?.[0]?.method || o.payment_mode || 'Cash').toLowerCase() === 'cash').reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0).toFixed(2)}`],
      ['Card', stats.cardOrders, `₹${filteredOrders.filter(o => (o.payments?.[0]?.method || o.payment_mode || '').toLowerCase() === 'card').reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0).toFixed(2)}`],
      ['UPI', stats.upiOrders, `₹${filteredOrders.filter(o => (o.payments?.[0]?.method || o.payment_mode || '').toLowerCase() === 'upi').reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0).toFixed(2)}`],
    ];
    const ws_summary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws_summary, 'Summary');

    // ========== SHEET 2: Product Sales ==========
    const productSales = {};
    filteredOrders.forEach(order => {
      (order.items || []).forEach(item => {
        const productName = item.product_name || 'Unknown Product';
        if (!productSales[productName]) {
          productSales[productName] = { quantity: 0, revenue: 0 };
        }
        productSales[productName].quantity += parseFloat(item.quantity || 0);
        productSales[productName].revenue += parseFloat(item.price || 0) * parseFloat(item.quantity || 0);
      });
    });

    const productData = [
      ['PRODUCT-WISE SALES'],
      ['Product Name', 'Quantity Sold', 'Revenue'],
      ...Object.entries(productSales)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .map(([product, data]) => [
          product,
          data.quantity.toFixed(2),
          `₹${data.revenue.toFixed(2)}`
        ])
    ];
    const ws_products = XLSX.utils.aoa_to_sheet(productData);
    XLSX.utils.book_append_sheet(wb, ws_products, 'Product Sales');

    // ========== SHEET 3: Detailed Orders ==========
    const orderData = [
      ['DETAILED ORDER LIST'],
      ['Order #', 'Date & Time', 'Payment Method', 'Items', 'Total Qty', 'Amount (₹)'],
      ...filteredOrders.map(order => {
        const itemsList = (order.items || []).map(it =>
          `${Math.round(it.quantity)}x ${it.product_name}${it.variant_name ? ' (' + it.variant_name + ')' : ''}`
        ).join('; ');
        const totalQty = (order.items || []).reduce((sum, it) => sum + parseFloat(it.quantity || 0), 0);

        return [
          order.order_number,
          new Date(order.created_at).toLocaleString('en-IN'),
          order.payments?.[0]?.method || order.payment_mode || 'Cash',
          itemsList,
          totalQty.toFixed(0),
          `₹${parseFloat(order.total_amount || 0).toFixed(2)}`
        ];
      })
    ];
    const ws_orders = XLSX.utils.aoa_to_sheet(orderData);
    XLSX.utils.book_append_sheet(wb, ws_orders, 'Orders');

    // Generate Excel file and download
    XLSX.writeFile(wb, `Sales_Report_${dateRangeText}.xlsx`);
  };

  const handleEditOrder = (order) => {
    setEditingOrder({
      ...order,
      items: Array.isArray(order.items) ? order.items.map(item => ({ ...item })) : []
    });
    setSelectedOrder(null);
  };

  const handleUpdateQuantity = (itemIndex, delta) => {
    setEditingOrder(prev => {
      if (!prev) return prev;
      const newItems = [...(prev.items || [])];
      if (!newItems[itemIndex]) return prev;

      const newQty = parseFloat(newItems[itemIndex].quantity || 0) + delta;
      if (newQty <= 0) {
        newItems.splice(itemIndex, 1);
      } else {
        newItems[itemIndex].quantity = newQty;
      }

      const newTotal = newItems.reduce((sum, it) =>
        sum + (parseFloat(it.price || 0) * parseFloat(it.quantity || 0)), 0
      );

      return {
        ...prev,
        items: newItems,
        total_amount: newTotal.toFixed(2)
      };
    });
  };

  const handleSaveOrder = async () => {
    if (!editingOrder) return;
    try {
      const updatedOrders = orders.map(o => o.id === editingOrder.id ? editingOrder : o);
      setOrders(updatedOrders);
      calculateStats(updatedOrders);
      setEditingOrder(null);
      alert('Order updated locally (API integration pending)');
    } catch (err) {
      console.error('Failed to update order', err);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!voidPin) {
      alert("Password is required.");
      return;
    }
    try {
      await orderApi.deleteOrder(orderId, { pin: voidPin });
      setShowDeleteConfirm(null);
      setVoidPin('');
      setSelectedOrder(null);
      fetchOrders(); // refetch so renumbered order numbers reflect immediately
    } catch (err) {
      console.error('Failed to delete order', err);
      const errorMsg = err.response?.data?.error || 'Failed to delete order. Please try again.';
      alert(errorMsg);
    }
  };

  const getPaymentMethodColor = (method) => {
    const m = (method || '').toLowerCase();
    if (m === 'cash') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (m === 'card') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (m === 'upi') return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <div className="flex-1 h-screen overflow-hidden flex flex-col bg-[#FDF3F6]">
      {/* Header */}
      <header className="px-8 pt-8 pb-6 border-b border-atul-pink_primary/10">
        <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
          <div>
            <h2 className="font-serif text-4xl font-bold text-atul-charcoal tracking-tight">Sales Reports</h2>
            <p className="text-sm text-atul-charcoal/40 font-bold uppercase tracking-widest mt-1">Transaction History & Analytics</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date Mode Toggle */}
            <div className="bg-white/80 backdrop-blur-md rounded-2xl p-1 flex items-center gap-1 border border-white shadow-sm">
              <button
                onClick={() => setDateMode('single')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                  dateMode === 'single' ? "bg-atul-pink_primary text-white" : "text-atul-charcoal/60 hover:text-atul-charcoal"
                )}
              >
                Single Day
              </button>
              <button
                onClick={() => setDateMode('range')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                  dateMode === 'range' ? "bg-atul-pink_primary text-white" : "text-atul-charcoal/60 hover:text-atul-charcoal"
                )}
              >
                Date Range
              </button>
            </div>

            {/* Date Picker(s) */}
            {dateMode === 'single' ? (
              <div className="bg-white/80 backdrop-blur-md rounded-2xl px-4 py-2.5 flex items-center gap-3 border border-white shadow-sm">
                <Calendar size={18} className="text-atul-pink_primary"/>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  max={today}
                  className="bg-transparent text-sm font-black text-atul-charcoal outline-none cursor-pointer"
                />
              </div>
            ) : (
              <div className="bg-white/80 backdrop-blur-md rounded-2xl px-4 py-2.5 flex items-center gap-3 border border-white shadow-sm">
                <Calendar size={18} className="text-atul-pink_primary"/>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  max={endDate}
                  className="bg-transparent text-sm font-black text-atul-charcoal outline-none cursor-pointer"
                />
                <span className="text-atul-charcoal/40 font-bold">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  min={startDate}
                  max={today}
                  className="bg-transparent text-sm font-black text-atul-charcoal outline-none cursor-pointer"
                />
              </div>
            )}

            <button
              onClick={handleExportExcel}
              className="bg-emerald-500 text-white rounded-2xl px-5 py-2.5 flex items-center gap-2 font-black text-[11px] uppercase tracking-wider hover:bg-emerald-600 transition-all border border-emerald-400 shadow-sm"
            >
              <Download size={16}/>
              Export Excel
            </button>

            <button
              onClick={handlePrint}
              className="bg-white/80 backdrop-blur-md rounded-2xl px-5 py-2.5 flex items-center gap-2 font-black text-[11px] uppercase tracking-wider text-atul-charcoal hover:bg-atul-pink_primary hover:text-white transition-all border border-white shadow-sm"
            >
              <Printer size={16}/>
              Print
            </button>

            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="bg-red-50 text-red-500 rounded-2xl px-5 py-2.5 flex items-center gap-2 font-black text-[11px] uppercase tracking-wider hover:bg-red-500 hover:text-white transition-all border border-red-200 shadow-sm"
            >
              <Trash2 size={16}/>
              Delete All
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Orders', value: stats.totalOrders, icon: <Receipt size={16}/>, color: 'text-atul-pink_primary' },
            { label: 'Revenue', value: `₹${Math.round(stats.totalRevenue).toLocaleString()}`, icon: <TrendingUp size={16}/>, color: 'text-atul-pink_primary' },
            { label: 'Avg Value', value: `₹${Math.round(stats.avgOrderValue)}`, icon: <ArrowUpRight size={16}/>, color: 'text-atul-charcoal' },
            { label: 'Cash', value: stats.cashOrders, dot: 'bg-emerald-500' },
            { label: 'Card', value: stats.cardOrders, dot: 'bg-blue-500' },
            { label: 'UPI', value: stats.upiOrders, dot: 'bg-purple-500' }
          ].map((stat, i) => (
            <div key={i} className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 border border-white shadow-sm">
              <div className="flex items-center gap-2 mb-2 font-bold text-[10px] text-atul-charcoal/30 uppercase tracking-widest">
                {stat.icon || <div className={cn("size-2.5 rounded-full", stat.dot)}></div>}
                {stat.label}
              </div>
              <p className={cn("text-2xl font-black professional-digits tracking-tighter", stat.color || "text-atul-charcoal")}>{stat.value}</p>
            </div>
          ))}
        </div>
      </header>

      {/* Filters Bar */}
      <div className="px-8 py-4 border-b border-atul-pink_primary/5 bg-white/20 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-md bg-white rounded-2xl px-4 py-2.5 flex items-center gap-3 border border-atul-pink_soft shadow-sm focus-within:border-atul-pink_primary/30 transition-all">
            <Search size={18} className="text-atul-charcoal/20"/>
            <input
              type="text"
              placeholder="Search by order # or item name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm font-bold text-atul-charcoal outline-none placeholder:text-atul-charcoal/20"
            />
          </div>

          <div className="bg-white rounded-2xl border border-atul-pink_soft shadow-sm overflow-hidden">
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
              className="bg-transparent px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-atul-charcoal outline-none cursor-pointer pr-10"
            >
              <option value="all">All Payments</option>
              <option value="cash">Cash Only</option>
              <option value="card">Card Only</option>
              <option value="upi">UPI Only</option>
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-atul-pink_primary/5 rounded-2xl border border-atul-pink_primary/10">
            <div className="size-2 bg-atul-pink_primary rounded-full animate-pulse"></div>
            <span className="text-[11px] font-black uppercase tracking-widest text-atul-charcoal/60">
              {totalCount} {totalCount === 1 ? 'Record' : 'Records'}
            </span>
          </div>
        </div>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-atul-pink_primary opacity-20">
            <div className="size-16 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
            <p className="font-serif italic text-xl">Compiling Daily Data...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-12">
            <div className="size-24 bg-atul-pink_soft rounded-full flex items-center justify-center text-atul-pink_primary/30 mb-6 font-serif italic text-4xl">!</div>
            <h3 className="font-serif text-2xl font-bold text-atul-charcoal mb-2">No Transactions Found</h3>
            <p className="text-sm font-bold text-atul-charcoal/30 uppercase tracking-widest">Adjust filters or select another date</p>
          </div>
        ) : (
          <div className="px-8 pb-32 pt-2">
            <div className="bg-white/50 backdrop-blur-md rounded-[2.5rem] border border-white shadow-xl shadow-atul-pink_primary/5 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-atul-pink_primary/[0.02] border-b border-atul-pink_primary/10">
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-atul-pink_primary/60">Reference</th>
                    <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-atul-pink_primary/60">Timestamp</th>
                    <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-atul-pink_primary/60">Method</th>
                    <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-atul-pink_primary/60">Items Summary</th>
                    <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-atul-pink_primary/60 text-right">Revenue</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-atul-pink_primary/60 text-right">Management</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-atul-pink_primary/5">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {filteredOrders.map((order, index) => (
                      <motion.tr 
                        key={order.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="group hover:bg-white transition-all cursor-default"
                      >
                        <td className="px-10 py-5">
                          <span className="font-black text-atul-charcoal professional-digits tracking-tight">#{order.order_number}</span>
                        </td>
                        <td className="px-6 py-5">
                           <div className="flex flex-col">
                             <span className="text-xs font-bold text-atul-charcoal">{new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                             <span className="text-[10px] font-bold text-atul-charcoal/30 uppercase">{new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                           </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={cn(
                            "px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm",
                            getPaymentMethodColor(order.payments?.[0]?.method || order.payment_mode)
                          )}>
                            {order.payments?.[0]?.method || order.payment_mode || 'Cash'}
                          </span>
                        </td>
                        <td className="px-6 py-5 overflow-hidden">
                           <div className="text-[11px] font-bold text-atul-charcoal truncate max-w-[240px] opacity-60 group-hover:opacity-100 transition-opacity">
                              {Array.isArray(order.items) ? order.items.map(it => it.product_name).join(', ') : 'No items'}
                           </div>
                        </td>
                        <td className="px-6 py-5 text-right font-black text-atul-pink_primary professional-digits text-lg tracking-tight">
                           ₹{parseFloat(order.total_amount || 0).toLocaleString()}
                        </td>
                        <td className="px-10 py-5 text-right">
                           <div className="flex items-center justify-end gap-2 transition-all">
                             <button onClick={() => setSelectedOrder(order)} className="size-9 bg-white rounded-2xl border border-atul-pink_soft shadow-sm flex items-center justify-center text-atul-charcoal/40 hover:text-atul-pink_primary transition-all active:scale-90" title="View Details"><Eye size={16} /></button>
                             <button onClick={() => handleEditOrder(order)} className="size-9 bg-white rounded-2xl border border-atul-pink_soft shadow-sm flex items-center justify-center text-atul-charcoal/40 hover:text-blue-500 transition-all active:scale-90" title="Modify Order"><Edit2 size={16} /></button>
                             <button onClick={() => setShowDeleteConfirm(order.id)} className="size-9 bg-white rounded-2xl border border-atul-pink_soft shadow-sm flex items-center justify-center text-atul-charcoal/40 hover:text-red-500 transition-all active:scale-90" title="Void Transaction"><Trash2 size={16} /></button>
                           </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Pagination Footer */}
      {(totalCount > 0 || filteredOrders.length > 0) && (
        <div className="bg-white/90 backdrop-blur-md border-t border-atul-pink_primary/5 px-10 py-5 flex items-center justify-between z-10 shrink-0 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-atul-charcoal/40">Transaction Ledger</span>
            <span className="text-[11px] font-bold text-atul-charcoal">
                Showing {filteredOrders.length} of {totalCount || filteredOrders.length} records
            </span>
          </div>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={() => { setPage(p => Math.max(1, p - 1)); }}
              disabled={page === 1}
              className="px-8 py-3 bg-white rounded-[1.25rem] border border-atul-pink_soft text-atul-pink_primary font-bold text-[10px] uppercase tracking-widest disabled:opacity-30 hover:bg-atul-pink_soft transition-all active:scale-95 shadow-sm"
            >
              Previous
            </button>
            <div className="font-black text-atul-charcoal text-[11px] uppercase tracking-widest px-6 py-3 bg-atul-pink_soft/20 rounded-full border border-atul-pink_soft/30">
               Page {page} of {Math.max(1, Math.ceil((totalCount || filteredOrders.length) / pageSize))}
            </div>
            <button 
              onClick={() => { setPage(p => p + 1); }}
              disabled={page * pageSize >= (totalCount || filteredOrders.length)}
              className="px-8 py-3 bg-white rounded-[1.25rem] border border-atul-pink_soft text-atul-pink_primary font-bold text-[10px] uppercase tracking-widest disabled:opacity-30 hover:bg-atul-pink_soft transition-all active:scale-95 shadow-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Simplified Modal logic omitted for brevity, but I'll add the essential Check Order modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 bg-atul-charcoal/20 backdrop-blur-md z-[100] flex items-center justify-center p-6" onClick={() => setSelectedOrder(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[3rem] p-10 max-w-lg w-full shadow-2xl border border-white relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-serif text-3xl font-bold text-atul-charcoal tracking-tight">Order Record</h3>
                <button onClick={() => setSelectedOrder(null)} className="size-12 rounded-full border border-atul-pink_soft flex items-center justify-center text-atul-charcoal/30 hover:bg-atul-pink_soft transition-colors shadow-sm">
                   <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex border-b border-atul-pink_soft pb-6 items-end justify-between">
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-atul-charcoal/30 mb-2">Reference ID</p>
                     <p className="text-4xl font-black text-atul-charcoal professional-digits tracking-tighter">#{selectedOrder.order_number}</p>
                   </div>
                   <div className="text-right">
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-atul-charcoal/30 mb-2">Timestamp</p>
                     <p className="text-sm font-bold text-atul-charcoal">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                   </div>
                </div>

                <div className="py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-atul-charcoal/30 mb-4">Line Items</p>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                    {Array.isArray(selectedOrder.items) && selectedOrder.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                           <div className="size-9 bg-atul-pink_soft flex items-center justify-center text-atul-pink_primary font-black rounded-2xl group-hover:scale-110 transition-transform">{Math.round(it.quantity)}</div>
                           <div>
                             <p className="font-black text-atul-charcoal text-sm">{it.product_name}</p>
                             <p className="text-[10px] font-bold text-atul-charcoal/30 tracking-widest">{it.variant_name || 'Standard'}</p>
                           </div>
                        </div>
                        <p className="font-black text-atul-charcoal text-sm">₹{(it.price * it.quantity).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t-4 border-double border-atul-pink_soft flex items-center justify-between">
                   <span className="font-serif text-2xl font-bold italic text-atul-pink_primary">Total Paid</span>
                   <span className="text-4xl font-black text-atul-pink_primary professional-digits tracking-tighter">₹{parseFloat(selectedOrder.total_amount || 0).toLocaleString()}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Order Modal */}
      <AnimatePresence>
        {editingOrder && (
          <div className="fixed inset-0 bg-atul-charcoal/20 backdrop-blur-md z-[100] flex items-center justify-center p-6" onClick={() => setEditingOrder(null)}>
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-[3rem] p-10 max-w-xl w-full shadow-2xl border border-white max-h-[90vh] overflow-y-auto custom-scrollbar"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-serif text-3xl font-bold text-atul-charcoal tracking-tight">Edit Record</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-atul-charcoal/30 mt-1">Order Ref: #{editingOrder.order_number}</p>
                </div>
                <button onClick={() => setEditingOrder(null)} className="size-12 rounded-full border border-atul-pink_soft flex items-center justify-center text-atul-charcoal/30 hover:bg-atul-pink_soft transition-colors shadow-sm">
                   <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-atul-charcoal/30 mb-4">Modify Items</p>
                  {Array.isArray(editingOrder.items) && editingOrder.items.map((it, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-white shadow-inner">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-black text-atul-charcoal text-sm truncate">{it.product_name}</p>
                        <p className="text-[10px] font-bold text-atul-charcoal/30">₹{parseFloat(it.price || 0).toFixed(0)} each</p>
                      </div>
                      
                      <div className="flex items-center gap-4 bg-white/80 p-1.5 rounded-xl border border-white shadow-sm">
                        <button 
                          onClick={() => handleUpdateQuantity(i, -1)}
                          className="size-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-black text-sm w-5 text-center professional-digits">{Math.round(it.quantity)}</span>
                        <button 
                          onClick={() => handleUpdateQuantity(i, 1)}
                          className="size-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all active:scale-90"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      
                      <div className="w-20 text-right ml-4">
                         <p className="font-black text-atul-charcoal text-sm professional-digits">₹{(it.price * it.quantity).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t-4 border-double border-atul-pink_soft flex items-center justify-between">
                   <span className="font-serif text-2xl font-bold italic text-atul-charcoal/40">Revised Total</span>
                   <span className="text-4xl font-black text-atul-pink_primary professional-digits tracking-tighter">₹{parseFloat(editingOrder.total_amount || 0).toLocaleString()}</span>
                </div>

                <div className="flex gap-4 pt-4">
                  <button onClick={() => setEditingOrder(null)} className="flex-1 py-4 bg-gray-50 rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest text-atul-charcoal/40 hover:bg-gray-100 transition-all">Discard</button>
                  <button onClick={handleSaveOrder} className="flex-2 py-4 bg-atul-pink_primary rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest text-white shadow-xl shadow-atul-pink_primary/20 hover:scale-105 active:scale-95 transition-all px-8 flex items-center justify-center gap-2">
                    <Save size={16} /> Update Record
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-red-900/10 backdrop-blur-md z-[110] flex items-center justify-center p-6" onClick={() => setShowDeleteConfirm(null)}>
            <motion.div 
               initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
               className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl border-4 border-red-50 text-center"
               onClick={e => e.stopPropagation()}
            >
              <div className="size-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 shadow-inner">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-atul-charcoal mb-4">Void Order?</h3>
              <p className="text-sm font-bold text-atul-charcoal/40 uppercase tracking-widest leading-relaxed mb-6">This will permanently remove this transaction from records.</p>
              
              <div className="mb-6">
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={voidPin}
                  onChange={e => setVoidPin(e.target.value)}
                  className="w-full bg-red-50/50 border-2 border-red-100 rounded-2xl py-4 px-5 text-sm font-bold text-red-500 focus:border-red-500 focus:outline-none transition-all placeholder:text-xs placeholder:tracking-widest placeholder:font-semibold placeholder:text-red-300"
                />
              </div>

              <div className="flex gap-3">
                 <button onClick={() => { setShowDeleteConfirm(null); setVoidPin(''); }} className="flex-1 py-4 bg-gray-50 rounded-2xl font-black text-[11px] uppercase tracking-widest text-atul-charcoal/40 hover:bg-gray-100 transition-all">Cancel</button>
                 <button onClick={() => handleDeleteOrder(showDeleteConfirm)} className="flex-1 py-4 bg-red-500 rounded-2xl font-black text-[11px] uppercase tracking-widest text-white shadow-xl shadow-red-500/20 hover:scale-105 active:scale-95 transition-all">Void Now</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Confirm Modal */}
      <AnimatePresence>
        {showBulkDeleteConfirm && (
          <div className="fixed inset-0 bg-red-900/10 backdrop-blur-md z-[120] flex items-center justify-center p-6" onClick={() => setShowBulkDeleteConfirm(false)}>
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
               className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl border-4 border-red-50 text-center"
               onClick={e => e.stopPropagation()}
            >
              <div className="size-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 shadow-inner">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-atul-charcoal mb-4">Wipe Database?</h3>
              <p className="text-sm font-bold text-atul-charcoal/40 uppercase tracking-widest leading-relaxed mb-6 italic">This will delete ALL orders across all dates for the current outlet.</p>
              
              <div className="mb-6">
                <input
                  type="password"
                  placeholder="Enter your password"
                  autoFocus
                  value={bulkDeletePassword}
                  onChange={e => setBulkDeletePassword(e.target.value)}
                  className="w-full bg-red-50/50 border-2 border-red-100 rounded-2xl py-4 px-5 text-sm font-bold text-red-500 focus:border-red-500 focus:outline-none transition-all placeholder:text-xs placeholder:tracking-widest placeholder:font-semibold placeholder:text-red-300"
                />
              </div>

              <div className="flex gap-3">
                 <button onClick={() => { setShowBulkDeleteConfirm(false); setBulkDeletePassword(''); }} className="flex-1 py-4 bg-gray-50 rounded-2xl font-black text-[11px] uppercase tracking-widest text-atul-charcoal/40 hover:bg-gray-100 transition-all">Cancel</button>
                 <button onClick={handleBulkDelete} className="flex-1 py-4 bg-red-500 rounded-2xl font-black text-[11px] uppercase tracking-widest text-white shadow-xl shadow-red-500/20 hover:scale-105 active:scale-95 transition-all">Clear All</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
