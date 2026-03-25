import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, Minus, Trash2, X, Printer,
  Loader2, ChevronRight, Check, ArrowLeft,
  ShoppingBag, Clock, User, Store, ArrowUpRight,
  Pause, Play, History, ChefHat, Weight, Droplets,
  Banknote, QrCode, CreditCard, CheckCircle2, Sparkles,
  LayoutGrid, Maximize, Minimize
} from 'lucide-react';
import { menuApi, orderApi } from '../services/api';
import { offlineService } from '../services/offline';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Fullscreen } from 'lucide-react';

const cn = (...inputs) => twMerge(clsx(inputs));

const MI = ({ name, className = "", fill = false }) => (
  <span className={cn("material-symbols-outlined", className, fill && "fill-1")} style={{ fontSize: 'inherit' }}>
    {name}
  </span>
);

// Unit options available per cart item
const UNIT_OPTIONS = [
  { type: 'piece', step: 1,    min: 1,    label: 'Qty' },
  { type: 'weight', step: 0.25, min: 0.25, label: 'Kg' },
  { type: 'liquid', step: 0.25, min: 0.25, label: 'L' },
];

const getDefaultUnit = (product) => {
  if (!product) return UNIT_OPTIONS[0];
  const cat = (product.category_name || '').toLowerCase();
  // If it's a scoop, default to Piece (1 Scoop = 100g)
  if (cat.includes('scoop')) return UNIT_OPTIONS.find(u => u.type === 'piece') || UNIT_OPTIONS[0];
  if (cat.includes('shake')) return UNIT_OPTIONS.find(u => u.type === 'piece') || UNIT_OPTIONS[0];
  return UNIT_OPTIONS[0];
};

const getVariationsForItem = (item) => {
  const unit = item.unitInfo?.type || 'piece';
  const cat = (item.product.category_name || '').toLowerCase();
  
  if (cat.includes('scoop')) {
    return [
      { value: 1, label: '100g', unitType: 'piece', fullName: '100 Grams' },
      { value: 0.25, label: '250g', unitType: 'weight' },
      { value: 0.50, label: '500g', unitType: 'weight' },
      { value: 1.00, label: '1kg', unitType: 'weight' },
    ];
  }

  if (unit === 'weight') return [
    { value: 0.25, label: '250g' },
    { value: 0.50, label: '500g' },
    { value: 0.75, label: '750g' },
    { value: 1.00, label: '1kg' },
  ];
  if (unit === 'liquid') return [
    { value: 0.25, label: '250ml' },
    { value: 0.50, label: '500ml' },
    { value: 0.75, label: '750ml' },
    { value: 1.00, label: '1L' },
  ];
  // Piece variations
  return [
    { value: 1, label: '1 Qty' },
    { value: 2, label: '2 Qty' },
    { value: 3, label: '3 Qty' },
    { value: 4, label: '4 Qty' },
    { value: 5, label: '5 Qty' },
  ];
};

export default function POS({ user }) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderType, setOrderType] = useState('dine_in');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState('select');
  const [lastOrder, setLastOrder] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [tableNo, setTableNo] = useState('');
  const [activeProduct, setActiveProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  
  // Hold Orders Feature
  const [heldOrders, setHeldOrders] = useState([]);
  const [isHoldingModalOpen, setIsHoldingModalOpen] = useState(false);

  const receiptRef = useRef(null);
  const kotRef = useRef(null);
  const [posConfig, setPosConfig] = useState({ showAdvancedManager: true });
  const [managerItem, setManagerItem] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };


  useEffect(() => {
    const config = JSON.parse(localStorage.getItem('atul_pos_config') || '{}');
    setPosConfig({
      showAdvancedManager: config.showAdvancedManager ?? true
    });
    
    // Auto-fullscreen on first user interaction since browsers block silent fullscreen
    const autoFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      }
      window.removeEventListener('click', autoFullscreen);
    };
    window.addEventListener('click', autoFullscreen);
    return () => window.removeEventListener('click', autoFullscreen);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isOnline && !syncing) {
      syncOfflineOrders();
    }
  }, [isOnline]);

  const syncOfflineOrders = async () => {
    const offlineOrders = offlineService.getOrders();
    if (offlineOrders.length === 0) return;

    setSyncing(true);
    for (const order of offlineOrders) {
      try {
        await orderApi.createOrder(order);
        offlineService.removeOrder(order.id);
      } catch (err) {
        console.error("Failed to sync order", order.id, err);
      }
    }
    setSyncing(false);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const catRes = await menuApi.getCategories();
      const allCats = catRes.data?.data || catRes.data || [];
      setCategories(allCats);
      if (allCats.length > 0) {
        setSelectedCategory(allCats[0].id);
        const prodRes = await menuApi.getProducts({ category: allCats[0].id });
        setProducts(prodRes.data?.data || prodRes.data || []);
      }
    } catch (err) { console.error("Failed to load POS data", err); }
    finally { setLoading(false); }
  };

  const handleCategorySelect = async (id) => {
    setSelectedCategory(id);
    setSearchQuery('');
    try {
      setLoading(true);
      const prodRes = await menuApi.getProducts({ category: id });
      setProducts(prodRes.data?.data || prodRes.data || []);
    } catch (err) { console.error("Failed to load products", err); }
    finally { setLoading(false); }
  };

  const handleProductClick = (product) => {
    if ((product.variants && product.variants.length > 0) || (product.modifier_groups && product.modifier_groups.length > 0)) {
      setActiveProduct(product);
      setSelectedVariant(product.variants?.find(v => v.is_default) || product.variants?.[0] || null);
      setSelectedModifiers([]);
    } else {
      const unitInfo = getDefaultUnit(product);
      // Default for scoop-based is 1 (100g), for others follows unit min
      const defaultQty = (product.category_name || '').toLowerCase().includes('scoop') ? 1 : (unitInfo.type === 'weight' ? 0.25 : 1);
      setManagerItem({ 
        product, 
        variant: null, 
        modifiers: [], 
        qty: defaultQty, 
        unitInfo,
        manualPrice: null
      });
    }
  };


  const addToCartFromManager = () => {
    if (!managerItem) return;
    const { product, variant, modifiers, qty, unitInfo, manualPrice } = managerItem;
    
    setCart(prev => {
      const variantId = variant ? variant.id : null;
      const modifierIds = [...modifiers].sort((a,b) => a.id - b.id).map(m => m.id).join(',');
      
      const existing = prev.find(item => 
        item.product.id === product.id && 
        item.variant?.id === variantId &&
        (item.modifiers?.map(m => m.id).sort((a,b) => a-b).join(',') === modifierIds)
      );

      if (existing) {
        return prev.map(item => {
          const itemModIds = (item.modifiers || []).map(m => m.id).sort((a,b) => a-b).join(',');
          return (item.product.id === product.id && item.variant?.id === variantId && itemModIds === modifierIds) 
            ? { ...item, qty: parseFloat((item.qty + qty).toFixed(2)), manualPrice: manualPrice || item.manualPrice } 
            : item;
        });
      }
      return [...prev, { product, variant, modifiers, qty, unitInfo, manualPrice }];
    });
    setManagerItem(null);
  };

  const applyVariation = (v) => {
    setManagerItem(prev => {
      const unitInfo = v.unitType ? UNIT_OPTIONS.find(u => u.type === v.unitType) : prev.unitInfo;
      return {
        ...prev,
        qty: parseFloat(parseFloat(v.value).toFixed(2)),
        unitInfo
      };
    });
  };

  const cycleManagerUnit = () => {
    setManagerItem(prev => {
      const currentIdx = UNIT_OPTIONS.findIndex(u => u.type === (prev.unitInfo?.type || 'piece'));
      const nextIdx = (currentIdx + 1) % UNIT_OPTIONS.length;
      const nextUnit = UNIT_OPTIONS[nextIdx];
      return { ...prev, unitInfo: nextUnit, qty: nextUnit.min };
    });
  };

  const setManagerManualPrice = (price) => {
    setManagerItem(prev => ({ ...prev, manualPrice: price === '' ? null : Number(price) }));
  };


  const updateQty = (productId, variantId, delta, modifiers = []) => {
    const modifierIds = [...modifiers].sort((a,b) => a.id - b.id).map(m => m.id).join(',');
    setCart(prev => prev.map(item => {
      const itemModIds = (item.modifiers || []).map(m => m.id).sort((a,b) => a-b).join(',');
      if (item.product.id === productId && item.variant?.id === variantId && itemModIds === modifierIds) {
        const ui = item.unitInfo || getDefaultUnit();
        const step = ui.step * (delta > 0 ? 1 : -1);
        const newQty = parseFloat((item.qty + step).toFixed(2));
        return { ...item, qty: Math.max(0, newQty) };
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const setExactQty = (productId, variantId, val, modifiers = []) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) return;
    const modifierIds = [...modifiers].sort((a,b) => a.id - b.id).map(m => m.id).join(',');
    setCart(prev => prev.map(item => {
      const itemModIds = (item.modifiers || []).map(m => m.id).sort((a,b) => a-b).join(',');
      return (item.product.id === productId && item.variant?.id === variantId && itemModIds === modifierIds)
      ? { ...item, qty: parseFloat(num.toFixed(2)) }
      : item;
    }).filter(item => item.qty > 0));
  };

  const cycleUnit = (productId, variantId, modifiers = []) => {
    const modifierIds = [...modifiers].sort((a,b) => a.id - b.id).map(m => m.id).join(',');
    setCart(prev => prev.map(item => {
      const itemModIds = (item.modifiers || []).map(m => m.id).sort((a,b) => a-b).join(',');
      if (item.product.id === productId && item.variant?.id === variantId && itemModIds === modifierIds) {
        const currentIdx = UNIT_OPTIONS.findIndex(u => u.type === (item.unitInfo?.type || 'piece'));
        const nextIdx = (currentIdx + 1) % UNIT_OPTIONS.length;
        const nextUnit = UNIT_OPTIONS[nextIdx];
        return { ...item, unitInfo: nextUnit, qty: nextUnit.min };
      }
      return item;
    }));
  };

  const removeFromCart = (productId, variantId, modifiers = []) => {
    const modifierIds = [...modifiers].sort((a,b) => a.id - b.id).map(m => m.id).join(',');
    setCart(prev => prev.filter(item => {
      const itemModIds = (item.modifiers || []).map(m => m.id).sort((a,b) => a-b).join(',');
      return !(item.product.id === productId && item.variant?.id === variantId && itemModIds === modifierIds);
    }));
  };

  const getCartItemCount = (productId) => {
    return cart.filter(i => i.product.id === productId).reduce((sum, item) => sum + item.qty, 0);
  };

  const setManualPrice = (productId, variantId, price, modifiers = []) => {
    const modifierIds = [...modifiers].sort((a,b) => a.id - b.id).map(m => m.id).join(',');
    setCart(prev => prev.map(item => {
      const itemModIds = (item.modifiers || []).map(m => m.id).sort((a,b) => a-b).join(',');
      if (item.product.id === productId && item.variant?.id === variantId && itemModIds === modifierIds) {
        return { ...item, manualPrice: price === '' ? null : Number(price) };
      }
      return item;
    }));
  };

  const calculateItemPrice = (item) => {
    if (item.manualPrice !== undefined && item.manualPrice !== null) return item.manualPrice;
    const base = Number(item.product.base_price);
    const varPrice = item.variant ? Number(item.variant.current_price || item.variant.price_delta) : 0;
    const modDelta = (item.modifiers || []).reduce((sum, m) => sum + Number(m.price_delta), 0);
    return base + varPrice + modDelta;
  };

  const subtotal = cart.reduce((acc, item) => acc + (calculateItemPrice(item) * item.qty), 0);
  const tax = cart.reduce((acc, item) => {
    const itemPrice = calculateItemPrice(item) * item.qty;
    const rate = parseFloat(item.product.tax_rate || 5.00) / 100;
    return acc + (itemPrice * rate);
  }, 0);
  const total = subtotal + tax;
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    
    const orderData = {
      order_type: orderType,
      table_number: tableNo || null,
      notes: customerName ? `Customer: ${customerName}` : '',
      payment_mode: paymentMode === 'Select' ? 'Cash' : paymentMode, // Use current state or default
      items: cart.map(item => ({
        product: item.product.id,
        variant: item.variant ? item.variant.id : null,
        quantity: item.qty,
        modifiers: (item.modifiers || []).map(m => m.id)
      })),
      cartSnapshot: [...cart] // For KOT/Offline preview
    };

    if (!isOnline) {
      offlineService.saveOrder(orderData);
      setLastOrder({ 
        ...orderData, 
        order_number: `OFF-${Date.now().toString().slice(-4)}`,
        created_at: new Date().toISOString(),
        total_amount: total,
        receipt: {
          items: cart.map(i => ({
            product_name: i.product.name,
            variant_name: i.variant?.name,
            quantity: i.qty,
            unit_price: calculateItemPrice(i),
            item_subtotal: calculateItemPrice(i) * i.qty
          })),
          totals: { subtotal, total, cgst: tax/2, sgst: tax/2 }
        }
      });
      setStep('success');
      setCart([]);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await orderApi.createOrder(orderData);
      const or = response.data?.data || response.data;
      const orderId = or.id;
      const receiptRes = await orderApi.getReceipt(orderId);
      const rr = receiptRes.data?.data || receiptRes.data;
      // CRITICAL: Merge the API data with our local cart snapshot for KOT printing
      setLastOrder({ ...or, receipt: rr, cartSnapshot: [...cart] });
      setStep('success');
      setCart([]);
    } catch (err) { 
      console.error("Failed to place order", err); 
      alert(err.response?.data?.error || "Failed to place order. Saving offline...");
      offlineService.saveOrder(orderData);
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handlePrintBill = useCallback(() => {
    if (!receiptRef.current) return;
    
    // Create hidden iframe for printing
    let iframe = document.getElementById('print-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const content = `
      <html><head><title>Receipt</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Inter',sans-serif;width:80mm;padding:4mm;color:#000;font-size:11px;line-height:1.2;background:white;}
        .center{text-align:center;} .bold{font-weight:700;} .mono{font-family:'JetBrains Mono',monospace;}
        .divider{border-top:1px dashed #999;margin:6px 0;} .double-divider{border-top:2px solid #000;margin:6px 0;}
        .row{display:flex;justify-content:space-between;padding:2px 0;}
        .items-table{width:100%;border-collapse:collapse;margin:4px 0;}
        .items-table td{padding:3px 0;vertical-align:top;}
        .items-table .qty{width:30px;text-align:center;} .items-table .price{text-align:right;width:70px;}
        .total-row{font-size:14px;font-weight:800;} .header-logo{font-size:18px;font-weight:800;letter-spacing:-0.5px;margin-bottom:2px;}
        .small{font-size:9px;color:#666;} .variant{font-size:9px;color:#444;display:block;margin-top:2px;}
        @media print{@page{margin:0;size:80mm auto;} body{width:80mm;}}
      </style></head><body>
        ${receiptRef.current.innerHTML}
        <script>window.onload=function(){window.focus();window.print();};</script>
      </body></html>
    `;

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(content);
    doc.close();
  }, []);

  const handlePrintKOT = useCallback(() => {
    if (!kotRef.current) return;
    
    let iframe = document.getElementById('print-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const content = `
      <html><head><title>KOT</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Inter',sans-serif;width:58mm;padding:4mm;color:#000;background:white;}
        .center{text-align:center;} .bold{font-weight:700;} .heavy{font-weight:900;font-size:18px;text-transform:uppercase;}
        .divider{border-top:2px solid #000;margin:8px 0;}
        .row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;}
        .items-table{width:100%;border-collapse:collapse;margin:10px 0;}
        .items-table td{padding:5px 0;font-size:16px;font-weight:900;vertical-align:top;}
        .qty{font-size:20px;width:35px;text-align:center;border:2px solid #000;display:inline-block;margin-right:8px;}
        .variant{font-size:10px;font-weight:700;display:block;margin-top:2px;}
        @media print{@page{margin:0;size:58mm auto;} body{width:58mm;}}
      </style></head><body>
        ${kotRef.current.innerHTML}
        <script>window.onload=function(){window.focus();window.print();};</script>
      </body></html>
    `;

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(content);
    doc.close();
  }, []);


  // Hold Order Methods
  const handleHoldOrder = () => {
    if (cart.length === 0) return;
    const newHold = {
      id: Date.now(),
      cart: [...cart],
      orderType,
      customerName: customerName || `Slot \${heldOrders.length + 1}`,
      tableNo,
      time: new Date()
    };
    setHeldOrders(prev => [...prev, newHold]);
    setCart([]);
    setCustomerName('');
    setTableNo('');
  };

  const resumeOrder = (held) => {
    if (cart.length > 0) {
      handleHoldOrder();
    }
    setCart(held.cart);
    setOrderType(held.orderType);
    setCustomerName(held.customerName);
    setTableNo(held.tableNo);
    setHeldOrders(prev => prev.filter(h => h.id !== held.id));
    setIsHoldingModalOpen(false);
  };

  const handleNewOrder = () => { setStep('select'); setLastOrder(null); setCart([]); setCustomerName(''); setTableNo(''); };

  const filteredProducts = searchQuery ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())) : products;

  // Modals are rendered as inline JSX (not as inner components) to prevent re-mount flicker

  // ═══════════════════════════════════════════
  // STEP 3: SUCCESS + RECEIPT
  // ═══════════════════════════════════════════
  // ═══════════════════════════════════════════
  // MODAL RENDERERS
  // ═══════════════════════════════════════════

  const renderSuccessModal = () => {
    if (step !== 'success' || !lastOrder) return null;
    const orderDate = new Date(lastOrder.created_at || Date.now());
    const r = lastOrder.receipt || {};

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl select-none overflow-hidden">
        {/* Hidden Print Templates */}
        {/* ── Epson 80mm Premium Receipt Template ── */}
        <div ref={receiptRef} style={{ display: 'none', width: '80mm', fontFamily: "'Inter', sans-serif" }}>
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            <div style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-1px', marginBottom: '2px' }}>ATUL ICE CREAM</div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>{r.outlet?.name || 'Vastrapur Outlet'}</div>
            <div style={{ fontSize: '9px', color: '#888' }}>{r.outlet?.address || 'Ahmedabad, Gujarat'}</div>
            <div style={{ fontSize: '10px', fontWeight: '800', marginTop: '4px' }}>PH: {r.outlet?.phone || '+91 99999 99999'}</div>
            <div style={{ fontSize: '9px', fontWeight: '700', marginTop: '2px' }}>GSTIN: {r.outlet?.gstin || '24AAAAA0000A1Z5'}</div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: '900', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '10px 0' }}>
            TAX INVOICE
          </div>

          <div style={{ fontSize: '10px', lineHeight: '1.5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '700' }}>Bill No: {lastOrder.order_number}</span>
              <span>{lastOrder.order_type === 'dine_in' ? 'DINE-IN' : 'TAKEAWAY'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Date: {orderDate.toLocaleDateString('en-IN')}</span>
              <span>Time: {orderDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {lastOrder.table_number && <div style={{ fontWeight: '800' }}>TABLE: {lastOrder.table_number}</div>}
          </div>

          <div style={{ borderTop: '1px solid #000', margin: '8px 0' }}></div>

          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000', fontWeight: '900' }}>
                <td style={{ padding: '4px 0' }}>ITEM Description</td>
                <td style={{ textAlign: 'center' }}>QTY</td>
                <td style={{ textAlign: 'right' }}>AMT</td>
              </tr>
            </thead>
            <tbody>
              {(r.items || []).map((item, i) => (
                <tr key={i} style={{ verticalAlign: 'top' }}>
                  <td style={{ padding: '6px 0' }}>
                    <div style={{ fontWeight: '800', fontSize: '12px' }}>{item.product_name}</div>
                    {item.variant_name && <div style={{ fontSize: '9px', color: '#555' }}>Size: {item.variant_name}</div>}
                  </td>
                  <td style={{ textAlign: 'center', padding: '6px 0', fontWeight: '700' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '700' }}>{Number(item.item_subtotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: '1px dashed #000', marginTop: '8px', paddingTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span>Subtotal</span>
              <span style={{ fontWeight: '700' }}>₹{Number(r.totals?.subtotal).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#444' }}>
              <span>CGST (2.5%)</span>
              <span>₹{Number(r.totals?.cgst).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#444' }}>
              <span>SGST (2.5%)</span>
              <span>₹{Number(r.totals?.sgst).toFixed(2)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '900', borderTop: '2px solid #000', marginTop: '10px', paddingTop: '8px', paddingBottom: '8px', borderBottom: '2px solid #000' }}>
            <span>NET PAYABLE</span>
            <span>₹{Number(r.totals?.total).toFixed(0)}</span>
          </div>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '10px' }}>
             <div style={{ fontWeight: '800', marginBottom: '4px' }}>THANK YOU! VISIT AGAIN</div>
             <div style={{ color: '#666' }}>Powered by Atul POS</div>
             <div style={{ fontSize: '8px', marginTop: '10px' }}>* Items once sold cannot be returned *</div>
          </div>
          <div style={{ height: '30px' }}></div> {/* Spacer for tear-off */}
        </div>

        {/* ── Epson 80mm Premium KOT Template ── */}
        <div ref={kotRef} style={{ display: 'none', width: '80mm', fontFamily: "'Inter', sans-serif" }}>
          <div style={{ textAlign: 'center', padding: '10px', border: '3px solid #000', marginBottom: '15px' }}>
             <div style={{ fontSize: '28px', fontWeight: '900' }}>KOT</div>
             <div style={{ fontSize: '14px', fontWeight: '700' }}>Order #{lastOrder.order_number?.slice(-4)}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '800', marginBottom: '10px' }}>
             <span>{lastOrder.order_type === 'dine_in' ? 'DINE-IN' : 'TAKE-AWAY'}</span>
             <span>TABLE: {lastOrder.table_number || 'STATION'}</span>
          </div>

          <div style={{ borderTop: '2px solid #000' }}></div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
             <tbody>
              {(lastOrder.cartSnapshot || []).map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ fontSize: '24px', fontWeight: '900', padding: '10px 0', width: '50px' }}>{item.qty}x</td>
                  <td style={{ fontSize: '18px', fontWeight: '800', padding: '10px 0' }}>
                    {item.product.name}
                    {item.variant && <div style={{ fontSize: '12px', fontWeight: '700', color: '#444' }}>[{item.variant.name}]</div>}
                  </td>
                </tr>
              ))}
             </tbody>
          </table>

          <div style={{ borderTop: '2px solid #000', marginTop: '20px', paddingTop: '10px' }}>
             <div style={{ fontSize: '12px', fontWeight: '700', textAlign: 'center' }}>
                Time: {orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
             </div>
          </div>
          <div style={{ height: '50px' }}></div> {/* Spacer for tear-off */}
        </div>

        <motion.div initial={{scale:0.9, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.9, opacity:0, y:20}}
          className="relative w-full max-w-[480px] bg-white rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.4)] overflow-hidden group">
          
          <div className="bg-atul-pink_primary pt-14 pb-12 px-10 text-center relative overflow-hidden">
             <div className="absolute top-[-20%] left-[-20%] w-[100%] h-[150%] bg-white/10 rounded-[40%] rotate-45 blur-3xl animate-pulse" />
             <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[120%] bg-black/5 rounded-[50%] -rotate-12 blur-3xl" />

             <div className="relative z-10 flex flex-col items-center">
                <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:'spring', stiffness:300, damping:20, delay:0.2}}
                  className="size-20 bg-white rounded-full flex items-center justify-center text-atul-pink_primary shadow-2xl mb-8">
                  <Check size={40} strokeWidth={4}/>
                </motion.div>
                <h2 className="text-4xl font-black text-white font-serif mb-2 tracking-tight">Order Placed</h2>
                <div className="text-[10px] text-white/70 font-black tracking-[0.5em] uppercase font-sans">Token Number: {lastOrder.order_number?.slice(-3) || '000'}</div>
             </div>
          </div>

          <div className="w-full p-10 flex-1 relative z-10 bg-white">
             <div className="flex flex-col items-center bg-atul-pink_soft/20 py-10 px-14 rounded-[3rem] border border-atul-pink_soft/30 shadow-inner group-hover:bg-atul-pink_soft/30 transition-colors">
                <div className="text-[10px] text-atul-gray/50 font-black tracking-[0.5em] uppercase mb-4 font-sans">Grand Total Received</div>
                <div className="professional-digits text-7xl font-black text-atul-charcoal tracking-tighter leading-none">₹{Number(lastOrder.total_amount).toFixed(2)}</div>
              </div>

             <div className="space-y-4 mt-10">
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={handlePrintBill} className="bg-atul-charcoal text-white py-5 rounded-[2.2rem] font-black text-[12px] tracking-widest uppercase flex items-center justify-center gap-3 hover:translate-y-[-2px] transition-all cursor-pointer shadow-xl shadow-black/10 active:scale-95">
                    <Printer size={18}/> CUSTOMER BILL
                  </button>
                  <button onClick={handlePrintKOT} className="bg-white border-2 border-atul-charcoal text-atul-charcoal py-5 rounded-[2.2rem] font-black text-[12px] tracking-widest uppercase flex items-center justify-center gap-3 hover:bg-atul-charcoal hover:text-white transition-all cursor-pointer active:scale-95">
                    <ChefHat size={18}/> PRINT KOT
                  </button>
                </div>
                <button onClick={handleNewOrder} className="w-full bg-atul-pink_primary text-white py-5 rounded-[2.2rem] font-black text-[12px] tracking-widest uppercase flex items-center justify-center gap-3 hover:bg-atul-pink_deep transition-all cursor-pointer shadow-xl shadow-atul-pink_primary/20 active:scale-95">
                  <History size={18}/> GO BACK TO MENU
                </button>
             </div>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderReviewModal = () => {
    if (step !== 'review') return null;
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-end bg-black/40 backdrop-blur-xl group">
        <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring', damping:30, stiffness:200}}
          className="w-full max-w-[1280px] h-[95vh] bg-[#FAFAFC] rounded-l-[4rem] shadow-[-40px_0_80px_rgba(0,0,0,0.2)] overflow-hidden flex border-l border-white/20">
          
          <div className="flex-1 flex flex-col p-8 lg:p-12 overflow-hidden">
            <div className="flex items-center gap-6 mb-10">
              <button onClick={() => setStep('select')} className="size-14 bg-white rounded-3xl flex items-center justify-center text-atul-charcoal hover:shadow-2xl hover:border-atul-pink_primary transition-all cursor-pointer border border-atul-pink_soft shadow-sm group">
                <ArrowLeft size={24}/>
              </button>
              <div>
                <h1 className="text-3xl font-black text-atul-charcoal tracking-tight font-serif uppercase">Finalizing Order</h1>
                <p className="text-atul-pink_primary text-[11px] tracking-[0.5em] font-black uppercase flex items-center gap-2">Checkout Logic Process</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-10">
              <div className="bg-white rounded-[2.5rem] p-8 border border-atul-pink_soft shadow-sm">
                <label className="text-[11px] text-atul-gray font-black tracking-[0.3em] uppercase block mb-5">Order Context</label>
                <div className="flex bg-atul-cream p-2 rounded-2xl gap-2">
                  <button onClick={() => setOrderType('dine_in')} className={cn("flex-1 py-4 rounded-xl text-[11px] font-black tracking-widest transition-all uppercase", orderType==='dine_in' ? "bg-white text-atul-pink_primary shadow-md" : "text-atul-gray-400 hover:text-atul-charcoal")}>Dine-In Unit</button>
                  <button onClick={() => setOrderType('takeaway')} className={cn("flex-1 py-4 rounded-xl text-[11px] font-black tracking-widest transition-all uppercase", orderType==='takeaway' ? "bg-white text-atul-pink_primary shadow-md" : "text-atul-gray-400 hover:text-atul-charcoal")}>Takeaway Unit</button>
                </div>
              </div>
              <div className="bg-white rounded-[2.5rem] p-8 border border-atul-pink_soft shadow-sm flex flex-col justify-between">
                <label className="text-[11px] text-atul-gray font-black tracking-[0.3em] uppercase block">Location Identifier</label>
                <input value={tableNo} onChange={e=>setTableNo(e.target.value)} placeholder="01" className="w-full bg-transparent text-atul-charcoal text-4xl font-black outline-none placeholder:text-atul-gray/10 font-mono tracking-tighter" />
              </div>
              <div className="bg-white rounded-[2.5rem] p-8 border border-atul-pink_soft shadow-sm flex flex-col justify-between">
                <label className="text-[11px] text-atul-gray font-black tracking-[0.3em] uppercase block">Guest Identity</label>
                <input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Walk-in" className="w-full bg-transparent text-atul-charcoal text-xl font-black outline-none placeholder:text-atul-gray/10" />
              </div>
            </div>

            <div className="flex-1 bg-white rounded-[3rem] border border-atul-pink_soft shadow-xl overflow-hidden flex flex-col">
              <div className="grid grid-cols-[1fr_140px_140px_160px_80px] gap-6 px-12 py-6 text-[11px] font-black tracking-[0.4em] text-atul-gray uppercase border-b border-atul-pink_soft/40 bg-atul-cream/20">
                <span>Menu Item</span><span className="text-center">Qty</span><span className="text-right">Unit Rate</span><span className="text-right">Line Total</span><span></span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
                <AnimatePresence mode="popLayout">
                  {cart.map((item) => (
                    <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, scale:0.95}} key={`${item.product.id}-${item.variant?.id}`}
                      className="grid grid-cols-[1fr_140px_140px_160px_80px] gap-6 px-10 py-8 items-center border-b border-atul-pink_soft/10 hover:bg-atul-cream/10 transition-colors group">
                      <div className="flex items-center gap-6">
                        <div className={cn("size-3 rounded-full shadow-lg", item.product.is_veg ? "bg-emerald-500" : "bg-red-500")} />
                        <div>
                          <div className="text-atul-charcoal text-[19px] font-black tracking-tight">{item.product.name}</div>
                          {item.variant && <div className="text-[11px] text-atul-pink_primary font-black uppercase tracking-[0.2em] mt-1.5 flex items-center gap-1"><Check size={12}/> {item.variant.name}</div>}
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-5">
                        <button onClick={()=>updateQty(item.product.id,item.variant?.id,-1)} className="size-11 rounded-2xl bg-atul-cream flex items-center justify-center text-atul-gray hover:text-atul-pink_primary hover:bg-white hover:shadow-lg transition-all active:scale-75 cursor-pointer"><Minus size={18}/></button>
                        <span className="professional-digits text-atul-charcoal text-2xl font-black w-10 text-center">{item.qty}</span>
                        <button onClick={()=>updateQty(item.product.id,item.variant?.id,1)} className="size-11 rounded-2xl bg-atul-cream flex items-center justify-center text-atul-gray hover:text-atul-pink_primary hover:bg-white hover:shadow-lg transition-all active:scale-75 cursor-pointer"><Plus size={18}/></button>
                      </div>
                      <div className="professional-digits text-atul-gray text-right font-black text-lg">₹{calculateItemPrice(item)}</div>
                      <div className="professional-digits text-atul-charcoal text-2xl font-black text-right">₹{(calculateItemPrice(item)*item.qty).toFixed(2)}</div>
                      <button onClick={()=>removeFromCart(item.product.id,item.variant?.id)} className="size-12 flex items-center justify-center text-atul-gray/20 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all cursor-pointer"><Trash2 size={22}/></button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="w-[450px] bg-white/95 backdrop-blur-3xl border-l border-atul-pink_soft/30 flex flex-col p-10 lg:p-14 justify-between shadow-2xl relative">
            <div className="absolute inset-0 bg-gradient-to-br from-atul-pink_soft/20 up-to-white/5 pointer-events-none" />
            <div className="space-y-10 relative z-10">
              <h3 className="text-3xl font-black text-atul-charcoal font-serif tracking-tight border-b-4 border-atul-charcoal pb-8">Settlement</h3>
              <div className="space-y-6">
                <div className="flex justify-between items-center font-sans">
                  <span className="text-atul-gray font-black uppercase tracking-[0.4em] text-[11px]">Net Amount</span>
                  <span className="professional-digits text-atul-charcoal font-black text-2xl">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center font-sans">
                  <span className="text-atul-gray font-black uppercase tracking-[0.4em] text-[11px]">Tax Charges</span>
                  <span className="professional-digits text-atul-charcoal font-black text-2xl">₹{tax.toFixed(2)}</span>
                </div>
                
                <div className="pt-6 mt-6 border-t border-gray-100">
                  <label className="text-[10px] text-atul-gray font-black tracking-[0.3em] uppercase block mb-4 font-sans">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Cash', 'UPI', 'Card', 'Credit'].map(mode => (
                      <button key={mode} onClick={() => setPaymentMode(mode)}
                        className={cn("py-4 rounded-2xl text-[10px] font-black tracking-widest uppercase border-2 transition-all font-sans",
                          paymentMode === mode ? "bg-atul-pink_primary text-white border-atul-pink_primary shadow-md" : "bg-white text-atul-charcoal border-gray-50 hover:border-atul-pink_primary/20")}>
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMode === 'UPI' && (
                  <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="bg-atul-cream/40 p-5 rounded-[2rem] border border-atul-pink_soft/50 flex flex-col items-center gap-4">
                     <img 
                       src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=atulicecream@okaxis&pn=Atul%20Ice%20Cream&am=${total.toFixed(0)}&cu=INR&tn=Order%20POS`)}`} 
                       alt="UPI QR Code" 
                       className="size-40 mix-blend-multiply"
                     />
                     <div className="flex items-center gap-2 px-4 py-1.5 bg-white/80 rounded-full border border-atul-pink_soft/30">
                        <div className="size-2 rounded-full bg-atul-pink_primary animate-ping"/>
                        <span className="text-[9px] font-black text-atul-pink_primary uppercase tracking-wider">Awaiting Scan</span>
                     </div>
                  </motion.div>
                )}

                <div className="pt-10 mt-10 border-t-4 border-atul-charcoal">
                  <div className="flex justify-between items-baseline mb-2"><span className="font-black text-atul-charcoal text-xs tracking-[0.5em] uppercase">Grand Sum Total</span></div>
                  <div className="professional-digits text-7xl font-black text-atul-pink_primary tracking-tighter -ml-1">₹{total.toFixed(2)}</div>
                </div>
              </div>
            </div>
            <div className="space-y-6 relative z-10">
               <button onClick={handlePlaceOrder} disabled={cart.length===0||isSubmitting} className="w-full bg-atul-pink_primary text-white py-8 rounded-[3rem] font-black text-[15px] tracking-[0.5em] uppercase hover:bg-atul-pink_deep transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-4 cursor-pointer shadow-[0_20px_60px_rgba(214,51,132,0.3)]">
                 {isSubmitting ? <Loader2 className="animate-spin size-6"/> : <><MI name="rocket_launch" className="text-3xl"/> COMPLETE & BILL</>}
               </button>
               <button onClick={()=>{setCart([]);setStep('select');}} className="w-full text-atul-gray-300 py-2 rounded-2xl text-[11px] font-black tracking-[0.5em] uppercase hover:text-atul-pink_primary transition-all cursor-pointer">Discard Transaction</button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  // ═══════════════════════════════════════════
  // STEP 1: SELECT ITEMS
  // ═══════════════════════════════════════════
  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden font-sans select-none relative">
      {/* Variant Selection Modal - Inline JSX */}
      <AnimatePresence>
        {activeProduct && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} 
            onClick={()=>setActiveProduct(null)}
            className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm">
            <motion.div initial={{scale:0.95, y:10}} animate={{scale:1, y:0}} exit={{scale:0.95, y:10}} 
              onClick={e=>e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100">
              <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-extrabold text-atul-charcoal">{activeProduct.name}</h3>
                    <p className="text-atul-pink_primary text-[11px] font-semibold mt-0.5">Customize your order</p>
                  </div>
                  <button onClick={()=>setActiveProduct(null)} className="size-8 bg-gray-100 rounded-lg flex items-center justify-center text-atul-gray hover:text-atul-charcoal hover:bg-gray-200 transition-all"><X size={16}/></button>
                </div>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-6">
                {/* Variants */}
                {activeProduct.variants?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-atul-charcoal/40 uppercase tracking-widest mb-3">Select Size/Type</p>
                    <div className="grid grid-cols-1 gap-2">
                      {activeProduct.variants.map(v => (
                        <button key={v.id} onClick={() => setSelectedVariant(v)}
                          className={clsx(
                            "w-full flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer",
                            selectedVariant?.id === v.id ? "bg-atul-pink_primary/5 border-atul-pink_primary ring-1 ring-atul-pink_primary/20" : "bg-gray-50 border-gray-100"
                          )}>
                          <span className={clsx("font-bold text-sm", selectedVariant?.id === v.id ? "text-atul-pink_primary" : "text-atul-charcoal")}>{v.name}</span>
                          <span className="professional-digits font-extrabold text-atul-charcoal text-sm">₹{Number(activeProduct.base_price) + Number(v.current_price || v.price_delta)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modifiers */}
                {activeProduct.modifier_groups?.map(group => (
                  <div key={group.id}>
                    <p className="text-[10px] font-bold text-atul-charcoal/40 uppercase tracking-widest mb-3">{group.name} 
                      {group.is_required && <span className="text-atul-pink_primary ml-1">(Required)</span>}
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {group.modifiers.map(mod => {
                        const isSelected = selectedModifiers.find(m => m.id === mod.id);
                        return (
                          <button key={mod.id} 
                            onClick={() => {
                              if (isSelected) {
                                setSelectedModifiers(selectedModifiers.filter(m => m.id !== mod.id));
                              } else {
                                setSelectedModifiers([...selectedModifiers, mod]);
                              }
                            }}
                            className={clsx(
                              "w-full flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer",
                              isSelected ? "bg-atul-pink_primary/5 border-atul-pink_primary ring-1 ring-atul-pink_primary/20" : "bg-gray-50 border-gray-100"
                            )}>
                            <div className="flex items-center gap-3">
                              <div className={clsx("size-4 rounded border flex items-center justify-center transition-all", isSelected ? "bg-atul-pink_primary border-atul-pink_primary" : "border-gray-300")}>
                                {isSelected && <Check size={10} className="text-white"/>}
                              </div>
                              <span className={clsx("font-bold text-sm", isSelected ? "text-atul-pink_primary" : "text-atul-charcoal")}>{mod.name}</span>
                            </div>
                            <span className="professional-digits font-extrabold text-atul-charcoal/60 text-xs">+₹{mod.price_delta}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <button 
                  onClick={() => {
                    const unitInfo = getDefaultUnit(activeProduct);
                    setManagerItem({
                      product: activeProduct,
                      variant: selectedVariant,
                      modifiers: selectedModifiers,
                      qty: unitInfo.type === 'weight' ? 0.25 : 1,
                      unitInfo,
                      manualPrice: null
                    });
                    setActiveProduct(null);
                  }}
                  className="w-full bg-atul-pink_primary text-white font-extrabold py-4 rounded-xl shadow-lg shadow-atul-pink_primary/25 hover:bg-atul-rose_deep transition-all transform active:scale-[0.98] flex justify-between px-6">
                  <span>Select Item</span>
                  <span>₹{
                    Number(activeProduct.base_price) + 
                    (selectedVariant ? Number(selectedVariant.price_delta) : 0) + 
                    selectedModifiers.reduce((s, m) => s + Number(m.price_delta), 0)
                  }</span>
                </button>


              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Held Orders Modal - Inline JSX */}
      <AnimatePresence>
        {isHoldingModalOpen && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} 
            onClick={()=>setIsHoldingModalOpen(false)}
            className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm">
            <motion.div initial={{scale:0.95, y:10}} animate={{scale:1, y:0}} exit={{scale:0.95, y:10}} 
              onClick={e=>e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
              <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="size-9 bg-atul-charcoal rounded-xl flex items-center justify-center text-white"><Pause size={16}/></div>
                   <div>
                      <h3 className="text-lg font-extrabold text-atul-charcoal">Held Orders</h3>
                      <p className="text-[11px] font-medium text-atul-gray/50">{heldOrders.length} paused</p>
                   </div>
                </div>
                <button onClick={()=>setIsHoldingModalOpen(false)} className="size-8 bg-gray-100 rounded-lg flex items-center justify-center text-atul-gray hover:text-atul-charcoal hover:bg-gray-200 transition-all"><X size={16}/></button>
              </div>
              <div className="p-4">
                {heldOrders.length === 0 ? (
                   <div className="py-12 text-center">
                      <ShoppingBag size={32} className="mx-auto mb-3 text-gray-200"/>
                      <p className="text-sm font-medium text-atul-gray/30">No orders on hold</p>
                   </div>
                ) : (
                   <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                     {heldOrders.map(h => (
                       <div key={h.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex justify-between items-center hover:border-atul-pink_primary/30 transition-all">
                          <div>
                            <div className="font-bold text-atul-charcoal text-sm">{h.customerName} {h.tableNo && `• Table ${h.tableNo}`}</div>
                            <div className="text-[11px] text-atul-gray/50 font-medium mt-0.5 flex items-center gap-2">
                               <span>{h.cart.reduce((s,i)=>s+i.qty,0)} Items</span>
                               <span>•</span>
                               <span className="professional-digits">₹{h.cart.reduce((s,i)=>s+(calculateItemPrice(i)*i.qty),0).toFixed(0)}</span>
                               <span>•</span>
                               <span>{new Date(h.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={()=>setHeldOrders(prev=>prev.filter(x=>x.id!==h.id))} className="size-9 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:border-red-300 transition-all active:scale-90"><Trash2 size={14}/></button>
                             <button onClick={()=>resumeOrder(h)} className="px-4 bg-atul-charcoal text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-black transition-all active:scale-95"><Play size={12}/> Resume</button>
                          </div>
                       </div>
                     ))}
                   </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <main className={cn("flex-1 flex flex-col min-w-0 transition-all duration-700", step!=='select' && "blur-2xl scale-[0.98] opacity-50")}>
        {/* ── Header ── */}
        <header className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-gray-100/80 z-30 gap-4">

          {/* Brand + Outlet */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="size-9 bg-atul-pink_primary rounded-xl flex items-center justify-center text-white shadow-sm shadow-atul-pink_primary/30">
              <MI name="icecream" className="text-[18px]" fill />
            </div>
            <div>
              <h1 className="text-[14px] font-black font-heading tracking-tight leading-none text-atul-charcoal">
                Atul Ice Cream
              </h1>
              <p className="text-[9px] font-bold text-atul-gray/40 mt-0.5 uppercase tracking-widest leading-none">
                {user?.outlet_name || 'Main Outlet'} &bull; POS
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-atul-gray/30 size-3.5 group-focus-within:text-atul-pink_primary transition-colors" />
              <input
                type="text"
                placeholder="Search products, codes…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#F8F9FA] rounded-xl py-3.5 pl-11 pr-4 text-[14px] font-medium border border-gray-100 focus:border-atul-pink_primary/30 focus:bg-white focus:ring-2 focus:ring-atul-pink_primary/5 transition-all outline-none placeholder:text-atul-gray/25"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-atul-gray/30 hover:text-atul-pink_primary transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3 shrink-0">
            
            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="size-10 rounded-xl bg-gray-50 text-atul-gray hover:text-atul-pink_primary hover:bg-atul-pink_primary/5 transition-all flex items-center justify-center border border-gray-100"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>

            {/* Status chips */}
            {syncing && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-500 rounded-lg">
                <Loader2 size={11} className="animate-spin" />
                <span className="text-[9px] font-black uppercase tracking-wider">Syncing</span>
              </div>
            )}
            {!isOnline && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-500 rounded-lg border border-amber-100">
                <MI name="cloud_off" className="text-xs" />
                <span className="text-[9px] font-black uppercase tracking-wider">Offline</span>
              </div>
            )}

            {/* Clock */}
            <div className="text-right pl-3 border-l border-gray-100">
              <div className="text-[13px] font-black text-atul-charcoal tabular-nums leading-none font-mono tracking-tight">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>
              <div className="text-[9px] text-atul-gray/40 font-bold mt-0.5 uppercase tracking-wide">
                {currentTime.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>

            {/* Cashier avatar */}
            {user && (
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'User')}&background=D63384&color=fff&bold=true&size=64`}
                className="size-8 rounded-xl object-cover border-2 border-atul-pink_soft shadow-sm"
                alt={user.full_name}
                title={`${user.full_name} · ${user.role}`}
              />
            )}

            {/* Hold orders button */}
            <button
              onClick={() => setIsHoldingModalOpen(true)}
              className="size-9 rounded-xl bg-atul-charcoal text-white hover:bg-black active:scale-95 transition-all cursor-pointer flex items-center justify-center relative shadow-sm"
            >
              <History size={15} />
              <AnimatePresence>
                {heldOrders.length > 0 && (
                  <motion.span
                    key="hold-badge"
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="absolute -top-1 -right-1 bg-atul-pink_primary text-white size-4 rounded-full flex items-center justify-center text-[8px] font-black border-2 border-white"
                  >
                    {heldOrders.length}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </header>

        {/* ── Category Bar ── */}
        <div className="flex items-center px-5 py-2 overflow-x-auto scrollbar-none bg-white gap-1.5 border-b border-gray-100/80 shrink-0">
          {categories.map(cat => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={cn(
                   "relative flex items-center gap-2 px-6 py-4 rounded-2xl min-w-fit transition-all text-[14px] font-bold cursor-pointer whitespace-nowrap shadow-sm",
                  isActive
                    ? "bg-atul-pink_primary text-white shadow-lg shadow-atul-pink_primary/25"
                    : "bg-gray-50 text-atul-gray/50 hover:text-atul-pink_primary hover:bg-atul-pink_primary/10 border border-transparent hover:border-atul-pink_primary/10"
                )}
              >
                {cat.icon_emoji && (
                  <span className={cn("text-sm leading-none transition-all", isActive ? "grayscale-0" : "grayscale opacity-60")}>
                    {cat.icon_emoji}
                  </span>
                )}
                {cat.name}
                {isActive && (
                  <motion.span
                    layoutId="cat-indicator"
                    className="absolute inset-0 rounded-xl bg-atul-pink_primary -z-10"
                    transition={{ type: 'spring', damping: 22, stiffness: 250 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Product Grid ── */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-5 custom-scrollbar bg-[#F8F9FA]">

          {/* Section label */}
          {!loading && filteredProducts.length > 0 && !searchQuery && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-atul-charcoal/30 uppercase tracking-[0.3em]">
                {filteredProducts.length} items
              </p>
            </div>
          )}

          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 opacity-30">
              <Loader2 className="animate-spin size-8" strokeWidth={1.5} />
              <span className="text-[11px] font-bold text-atul-gray uppercase tracking-widest">Loading…</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 opacity-25">
              <MI name="search_off" className="text-5xl text-atul-charcoal" />
              <span className="text-sm font-bold text-atul-gray">No products found</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
              {filteredProducts.map(p => {
                const count = getCartItemCount(p.id);
                const inCart = count > 0;

                const getProductImage = (product) => {
                  if (product.image_url) return product.image_url;
                  const n = product.name.toUpperCase();
                  if (n.includes('CHOCOLATE')) return "https://images.unsplash.com/photo-1558500204-9110ca213444?q=80&w=240&auto=format&fit=crop";
                  if (n.includes('MANGO'))     return "https://images.unsplash.com/photo-1563805039227-9aba624c3017?q=80&w=240&auto=format&fit=crop";
                  if (n.includes('PISTA') || n.includes('RAJBHA') || n.includes('KESAR')) return "https://images.unsplash.com/photo-1501443762994-82bd5dabb89a?q=80&w=240&auto=format&fit=crop";
                  if (n.includes('VANILLA') || n.includes('COCONUT')) return "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?q=80&w=240&auto=format&fit=crop";
                  if (n.includes('STRAWBERRY')) return "https://images.unsplash.com/photo-1570197788417-0e82375c9371?q=80&w=240&auto=format&fit=crop";
                  if (n.includes('BUTTER'))    return "https://images.unsplash.com/photo-1633933358116-a27b902fad35?q=80&w=240&auto=format&fit=crop";
                  return "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?q=80&w=240&auto=format&fit=crop";
                };

                return (
                  <motion.div
                    key={p.id}
                    layout
                    whileTap={inCart ? {} : { scale: 0.96 }}
                    onClick={() => handleProductClick(p)}
                    className={cn(
                      "group flex flex-col bg-white rounded-xl overflow-hidden transition-all border select-none",
                      inCart
                        ? "border-atul-pink_primary/50 border-2 cursor-default shadow-lg shadow-atul-pink_primary/10 ring-4 ring-atul-pink_primary/5"
                        : "border-gray-100 hover:border-atul-pink_primary/25 cursor-pointer hover:shadow-lg hover:-translate-y-0.5"
                    )}
                  >
                    {/* Product image - Smaller aspect ratio for compact cards */}
                    <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-50">
                      <img
                        src={getProductImage(p)}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      {/* Tags container */}
                      <div className="absolute top-1 left-1.5 flex flex-col gap-1">
                        {p.is_veg && (
                          <div className={cn("size-3 rounded-sm border-[1px] flex items-center justify-center bg-white", p.is_veg ? "border-emerald-500" : "border-red-500")}>
                            <div className={cn("size-1.5 rounded-full", p.is_veg ? "bg-emerald-500" : "bg-red-500")} />
                          </div>
                        )}
                      </div>
                      
                      {/* Badge for multiple variations */}
                      {(p.variants?.length > 0) && (
                         <div className="absolute top-1 right-1.5 bg-atul-charcoal/80 text-white text-[7px] px-1 py-0.5 rounded-md font-black uppercase tracking-tight backdrop-blur-sm">
                            {p.variants.length} Sizes
                         </div>
                      )}

                      {/* Overlays for selected items */}
                      <AnimatePresence>
                        {inCart && (
                          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-atul-pink_primary/10 flex flex-col items-center justify-center backdrop-blur-sm">
                             <motion.div initial={{scale:0}} animate={{scale:1}} className="size-8 bg-atul-pink_primary text-white rounded-full flex items-center justify-center shadow-lg mb-1">
                                <Check size={16} strokeWidth={4}/>
                             </motion.div>
                             <span className="text-[9px] font-black text-white bg-atul-pink_primary px-2 py-0.5 rounded-full uppercase">
                               ×{count % 1 === 0 ? count : count.toFixed(2)}
                             </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="p-2 flex flex-col justify-between flex-1">
                      <p className="text-[10px] font-bold text-atul-charcoal truncate tracking-tight leading-tight mb-0.5">
                        {p.name}
                      </p>
                      <div className="flex items-center justify-between mt-auto">
                        <p className="professional-digits text-[12px] font-bold text-atul-pink_primary">
                          ₹{Number(p.base_price).toFixed(0)}
                          <span className="text-[8px] opacity-30 ml-0.5 font-bold tracking-normal">+</span>
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* ── Advanced Product Manager Strip ── */}
        <AnimatePresence>
          {managerItem && posConfig.showAdvancedManager && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 200 }}
              className="shrink-0 bg-white border-t border-gray-100 shadow-[0_-12px_40px_rgba(0,0,0,0.05)] z-50 overflow-hidden"
              style={{ height: 172 }}
            >
              {/* Strip header */}
              <div className="px-5 py-1.5 flex items-center justify-between border-b border-gray-50 bg-gradient-to-r from-atul-pink_soft/10 to-transparent">
                <div className="flex items-center gap-2">
                  <div className="size-5 rounded-md bg-atul-pink_primary/10 flex items-center justify-center">
                    <Weight size={11} className="text-atul-pink_primary" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-atul-charcoal/70">
                    Item Configuration
                  </span>
                  <span className="text-[9px] font-bold text-atul-gray/30 uppercase tracking-wider hidden sm:block">
                    — Configure variation and tap add to bill
                  </span>
                </div>
              </div>

              {/* Configure panel */}
              <div className="flex items-center px-5 h-[130px] gap-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-1 flex items-center justify-between bg-[#FDF3F6]/80 backdrop-blur-xl rounded-[2.5rem] border-2 border-atul-pink_soft/40 p-5 shadow-xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-10 p-2 opacity-10 pointer-events-none">
                     <MI name="icecream" className="text-8xl" fill />
                  </div>

                  <div className="flex gap-6 items-center flex-1">
                    <div className="shrink-0 flex flex-col min-w-[150px]">
                      <h4 className="text-[20px] font-extrabold text-atul-charcoal leading-none tracking-tight truncate">
                        {managerItem.product.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-2">
                        {managerItem.variant && (
                          <span className="text-[10px] font-black text-atul-pink_primary uppercase tracking-widest bg-white px-2 py-0.5 rounded-lg border border-atul-pink_soft/30">
                            {managerItem.variant.name}
                          </span>
                        )}
                        <span className="text-[10px] font-black text-atul-gray-400 font-mono">
                          ₹{calculateItemPrice(managerItem).toFixed(0)}/{managerItem.unitInfo?.label || 'Qty'}
                        </span>
                      </div>
                    </div>

                    {/* Variations Box - Grouped and Fixed */}
                    <div className="flex gap-4 items-center h-[70px]">
                      {/* Fixed Scoop Box */}
                      <div className="flex bg-white p-1 rounded-2xl border border-atul-pink_soft/40 shadow-sm">
                        {getVariationsForItem(managerItem).filter(v => v.unitType === 'piece').map(v => (
                          <button 
                            key={`${v.label}-${v.value}`}
                            onClick={() => {
                               // Increment if already selected
                               if (managerItem.unitInfo?.type === 'piece') {
                                  applyVariation({ ...v, value: managerItem.qty + 1 });
                               } else {
                                  applyVariation(v);
                               }
                            }}
                            className={cn(
                               "min-w-[70px] h-[56px] px-3 rounded-xl transition-all uppercase tracking-tighter flex flex-col items-center justify-center gap-0.5",
                               managerItem.unitInfo?.type === 'piece'
                                 ? "bg-atul-pink_primary text-white shadow-lg shadow-atul-pink_primary/20 scale-[1.02] z-10" 
                                 : "text-atul-gray-400 hover:text-atul-pink_primary hover:bg-atul-pink_primary/5 font-black text-[13px]"
                            )}
                          >
                            <span className={cn("leading-none", managerItem.unitInfo?.type === 'piece' ? "text-[22px] font-black" : "text-[16px] font-black")}>
                               {managerItem.unitInfo?.type === 'piece' ? managerItem.qty : '1'}
                            </span>
                            <span className={cn("font-bold tracking-widest", managerItem.unitInfo?.type === 'piece' ? "text-[8px] opacity-80" : "text-[8px] opacity-40")}>
                               100gms
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Weight Variation Box */}
                      <div className="flex bg-white p-1 rounded-2xl border border-atul-pink_soft/40 shadow-sm">
                        {getVariationsForItem(managerItem).filter(v => v.unitType === 'weight' || (!v.unitType && managerItem.unitInfo?.type === 'weight')).map(v => (
                          <button 
                            key={`${v.label}-${v.value}`}
                            onClick={() => applyVariation(v)}
                            className={cn(
                               "min-w-[60px] h-[56px] px-3 rounded-xl text-[13px] font-black transition-all uppercase tracking-tighter flex items-center justify-center",
                               Math.abs(managerItem.qty - v.value) < 0.001 && managerItem.unitInfo?.type === 'weight'
                                 ? "bg-atul-pink_primary text-white shadow-lg shadow-atul-pink_primary/20 scale-[1.02] z-10" 
                                 : "text-atul-gray-400 hover:text-atul-pink_primary hover:bg-atul-pink_primary/5"
                            )}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Slider Type Input Box */}
                    <div className="flex-1 flex flex-col gap-2 bg-white px-5 py-3 rounded-2xl border border-atul-pink_soft/40 shadow-sm hover:border-atul-pink_primary/30 transition-all min-w-[200px]">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-atul-pink_primary uppercase tracking-widest">{managerItem.unitInfo?.label} Adjust</span>
                         <span className="text-[18px] font-mono font-black text-atul-charcoal">{managerItem.qty}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <button onClick={() => applyVariation({ value: Math.max(0, managerItem.qty - 0.25) })} className="text-atul-pink_primary p-1 hover:bg-atul-pink_primary/5 rounded-lg"><Minus size={16} strokeWidth={3} /></button>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          step={managerItem.unitInfo?.type === 'weight' ? 0.25 : 1}
                          value={managerItem.qty}
                          onChange={(e) => applyVariation({ value: e.target.value })}
                          className="flex-1 h-2 bg-atul-pink_soft/30 rounded-lg appearance-none cursor-pointer accent-atul-pink_primary"
                        />
                        <button onClick={() => applyVariation({ value: managerItem.qty + 0.25 })} className="text-atul-pink_primary p-1 hover:bg-atul-pink_primary/5 rounded-lg"><Plus size={16} strokeWidth={3} /></button>
                      </div>
                    </div>

                    {/* Manual Rate */}
                    <div className="flex flex-col items-center gap-1 ml-2 group/rate">
                       <span className="text-[8px] font-black text-atul-gray-300 uppercase tracking-widest group-hover/rate:text-atul-pink_primary transition-colors">Rate</span>
                       <div className="relative">
                         <input
                           type="number"
                           placeholder="Rate"
                           value={managerItem.manualPrice || ''}
                           onChange={(e) => setManagerManualPrice(e.target.value)}
                           className={cn(
                             "w-16 h-[56px] bg-white border border-gray-100 rounded-xl text-center font-black text-sm outline-none transition-all",
                             managerItem.manualPrice ? "text-atul-pink_primary border-atul-pink_primary/50 bg-atul-pink_primary/5" : "text-atul-charcoal focus:border-atul-pink_primary/30"
                           )}
                         />
                         {managerItem.manualPrice && (
                            <button onClick={() => setManagerManualPrice('')} className="absolute -top-1 -right-1 size-3.5 bg-atul-pink_primary text-white rounded-full flex items-center justify-center border border-white">
                               <X size={8}/>
                            </button>
                         )}
                       </div>
                    </div>
                  </div>


                  <div className="flex items-center gap-3 ml-6">
                     <button onClick={() => setManagerItem(null)} className="size-14 bg-white border-2 border-gray-50 rounded-[1.5rem] flex items-center justify-center text-atul-gray-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer">
                        <X size={24}/>
                     </button>
                     <button 
                       onClick={addToCartFromManager}
                       className="h-14 px-10 bg-atul-pink_primary text-white rounded-[1.5rem] font-black text-sm uppercase flex items-center gap-3 shadow-[0_15px_35px_rgba(214,51,132,0.3)] hover:bg-atul-pink_deep active:scale-95 transition-all"
                     >
                       <Plus size={20} strokeWidth={3}/> ADD TO BILL
                     </button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ═══ ORDER SIDEBAR — Redesigned ═══ */}
      <aside className="w-[320px] bg-[#FDF3F6] border-l border-atul-pink_soft/40 flex flex-col z-40 relative overflow-hidden">

        {/* Decorative ambient blobs */}
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-atul-pink_primary/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-24 -left-8 w-28 h-28 bg-atul-pink_primary/5 rounded-full blur-2xl pointer-events-none" />

        {/* ── Header ── */}
        <div className="relative px-5 pt-5 pb-4 shrink-0">
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "size-10 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm",
                cart.length > 0
                  ? "bg-atul-pink_primary text-white shadow-atul-pink_primary/25"
                  : "bg-white/70 text-atul-charcoal/20 border border-white"
              )}>
                <ShoppingBag size={17} />
              </div>
              <div>
                <h2 className="text-[15px] font-black font-heading text-atul-charcoal tracking-tight leading-none">
                  Current Order
                </h2>
                <p className="text-[10px] font-bold text-atul-gray/40 mt-0.5 uppercase tracking-widest">
                  {totalItems > 0
                    ? `${totalItems} item${totalItems !== 1 ? 's' : ''} added`
                    : 'No items yet'}
                </p>
              </div>
            </div>
            {/* Animated item-count badge */}
            <AnimatePresence>
              {totalItems > 0 && (
                <motion.div
                  key="badge"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="size-8 bg-atul-pink_primary text-white rounded-full flex items-center justify-center text-[12px] font-black shadow-lg shadow-atul-pink_primary/30 border-2 border-white"
                >
                  {totalItems}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order-type toggle */}
          <div className="flex bg-white/60 backdrop-blur-sm p-1 rounded-2xl border border-white gap-1 shadow-inner">
            {[
              { key: 'dine_in', label: 'Dine-In',   icon: <Store size={11}/> },
              { key: 'takeaway', label: 'Takeaway', icon: <ShoppingBag size={11}/> },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setOrderType(key)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5",
                  orderType === key
                    ? "bg-atul-pink_primary text-white shadow-md shadow-atul-pink_primary/30"
                    : "text-atul-gray/40 hover:text-atul-charcoal"
                )}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        {/* Thin divider */}
        <div className="h-px bg-white/80 mx-5 shrink-0" />

        {/* ── Cart Items ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 min-h-0">
          {cart.length === 0 ? (
            /* ── Empty state ── */
            <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="size-20 bg-white/70 rounded-3xl flex items-center justify-center border border-white shadow-sm"
              >
                <ShoppingBag size={28} className="text-atul-pink_primary/20" />
              </motion.div>
              <div>
                <p className="text-sm font-black text-atul-charcoal/20">Cart is empty</p>
                <p className="text-[10px] text-atul-gray/30 mt-1 font-medium">Tap any product to start</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {cart.map(item => {
                  const ui = item.unitInfo || getDefaultUnit();
                  const itemKey = `${item.product.id}-${item.variant?.id}-${(item.modifiers || []).map(m => m.id).sort().join(',')}`;
                  const itemTotal = calculateItemPrice(item) * item.qty;
                  return (
                    <motion.div
                      layout
                      key={itemKey}
                      initial={{ opacity: 0, x: 24, scale: 0.96 }}
                      animate={{ opacity: 1, x: 0,  scale: 1    }}
                      exit={{    opacity: 0, x: -16, scale: 0.94 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 220 }}
                      className="group relative bg-white rounded-2xl border border-white hover:border-atul-pink_primary/20 hover:shadow-md transition-all overflow-hidden shadow-sm"
                    >
                      {/* Left accent strip */}
                      <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-gradient-to-b from-atul-pink_primary to-atul-pink_primary/40 rounded-r-full" />

                      <div className="pl-4 pr-3 pt-3 pb-3">
                        {/* Row 1: Name + Line Total */}
                        <div className="flex justify-between items-start gap-2 mb-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <div className={cn("size-1.5 rounded-full shrink-0 mt-px", item.product.is_veg ? "bg-emerald-500" : "bg-red-400")} />
                              <p className="text-[12.5px] font-extrabold text-atul-charcoal truncate leading-tight">
                                {item.product.name}
                              </p>
                            </div>
                            {(item.variant || item.modifiers?.length > 0) && (
                              <div className="flex flex-wrap gap-1 mt-1.5 pl-3">
                                {item.variant && (
                                  <span className="text-[8px] px-1.5 py-0.5 bg-atul-pink_primary/8 text-atul-pink_primary rounded-md font-black uppercase tracking-wide border border-atul-pink_soft/50">
                                    {item.variant.name}
                                  </span>
                                )}
                                {item.modifiers?.map(m => (
                                  <span key={m.id} className="text-[8px] px-1.5 py-0.5 bg-gray-100 text-atul-charcoal/50 rounded-md font-bold uppercase">
                                    {m.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Price column */}
                          <div className="text-right shrink-0">
                            <p className="professional-digits text-[14px] font-black text-atul-charcoal leading-tight">
                              ₹{itemTotal.toFixed(0)}
                            </p>
                            {item.qty > 1 && (
                              <p className="text-[9px] text-atul-gray/30 font-bold leading-none mt-0.5">
                                ₹{calculateItemPrice(item).toFixed(0)} ea
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Row 2: Qty stepper + Delete */}
                        <div className="flex items-center justify-between">
                          {/* Stepper */}
                          <div className="flex items-center gap-1.5 bg-gray-50 rounded-2xl border border-gray-100/80 p-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); updateQty(item.product.id, item.variant?.id, -1, item.modifiers); }}
                              className="size-10 rounded-xl flex items-center justify-center text-atul-gray-400 hover:text-atul-pink_primary hover:bg-white hover:shadow-sm transition-all active:scale-90"
                            >
                              <Minus size={18} strokeWidth={3} />
                            </button>

                            {ui.type === 'piece' ? (
                              <span className="professional-digits text-[14px] font-black w-10 text-center text-atul-charcoal tabular-nums">
                                {item.qty}
                              </span>
                            ) : (
                              <input
                                type="number"
                                step={ui.step}
                                min={ui.min}
                                value={item.qty}
                                onClick={e => e.stopPropagation()}
                                onChange={e => { e.stopPropagation(); setExactQty(item.product.id, item.variant?.id, e.target.value, item.modifiers); }}
                                className="professional-digits text-[14px] font-black w-14 text-center outline-none bg-transparent tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            )}

                            {/* Unit cycle badge */}
                            <button
                              onClick={(e) => { e.stopPropagation(); cycleUnit(item.product.id, item.variant?.id, item.modifiers); }}
                              title="Click to change unit (Qty / Kg / L)"
                              className="text-[9px] font-black text-atul-pink_primary bg-atul-pink_primary/10 px-2 py-1 rounded-xl cursor-pointer hover:bg-atul-pink_primary hover:text-white transition-all select-none"
                            >
                              {ui.label}
                            </button>

                            <button
                              onClick={(e) => { e.stopPropagation(); updateQty(item.product.id, item.variant?.id, 1, item.modifiers); }}
                              className="size-10 rounded-xl flex items-center justify-center text-atul-gray-400 hover:text-atul-pink_primary hover:bg-white hover:shadow-sm transition-all active:scale-90"
                            >
                              <Plus size={18} strokeWidth={3} />
                            </button>
                          </div>

                          {/* Delete */}
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFromCart(item.product.id, item.variant?.id, item.modifiers); }}
                            className="size-10 rounded-2xl flex items-center justify-center text-gray-200 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Bottom spacer so last item isn't hidden under footer gradient */}
              <div className="h-2" />
            </div>
          )}
        </div>

        <div className="p-4 pt-0 bg-[#FDF3F6] shrink-0 relative z-20 space-y-4">
          {/* Breakdown card */}
          <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white p-4 shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black text-atul-charcoal/30 uppercase tracking-[0.2em]">Subtotal</span>
              <span className="professional-digits text-[12px] font-black text-atul-charcoal/60">₹{subtotal.toFixed(0)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-atul-pink_soft/20 mb-3">
              <span className="text-[10px] font-black text-atul-charcoal/30 uppercase tracking-[0.2em]">GST (5%)</span>
              <span className="professional-digits text-[12px] font-black text-atul-charcoal/60">₹{tax.toFixed(0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[13px] font-black text-atul-charcoal uppercase tracking-wider">Payable Total</span>
              <motion.span 
                key={total}
                initial={{ scale: 1.1, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="professional-digits text-[26px] font-black text-atul-pink_primary tracking-tighter"
              >
                ₹{total.toFixed(0)}
              </motion.span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {/* 1. Hold Button */}
            <button 
               onClick={handleHoldOrder}
               disabled={cart.length === 0 || isSubmitting}
               className="h-16 flex flex-col items-center justify-center bg-white border border-atul-pink_soft/40 text-atul-charcoal/40 rounded-2xl hover:bg-atul-pink_primary/5 transition-all active:scale-95 disabled:opacity-30 group"
            >
               <Pause size={20} className="group-hover:text-atul-pink_primary" />
               <span className="text-[9px] font-black mt-1 uppercase tracking-widest group-hover:text-atul-pink_primary">Hold</span>
            </button>
            
            {/* 2. Cash Button */}
            <button 
               onClick={() => { setPaymentMode('Cash'); handlePlaceOrder(); }}
               disabled={cart.length === 0 || isSubmitting}
               className="h-16 flex flex-col items-center justify-center bg-[#E7F7EF] text-[#2D9B63] rounded-2xl hover:bg-[#D4F0E2] transition-all active:scale-95 shadow-sm shadow-[#2D9B63]/10 disabled:opacity-30"
            >
               <Banknote size={20} />
               <span className="text-[9px] font-black mt-1 uppercase tracking-widest">Cash</span>
            </button>

            {/* 3. QR Button */}
            <button 
               onClick={() => { setPaymentMode('UPI'); setShowQRModal(true); }}
               disabled={cart.length === 0 || isSubmitting}
               className="h-16 flex flex-col items-center justify-center bg-[#F3E8FF] text-[#7C3AED] rounded-2xl hover:bg-[#EBD5FF] transition-all active:scale-95 shadow-sm shadow-[#7C3AED]/10 disabled:opacity-30"
            >
               <QrCode size={20} />
               <span className="text-[9px] font-black mt-1 uppercase tracking-widest">QR CODE</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Modals Overlays */}
      <AnimatePresence>
        {renderReviewModal()}
      </AnimatePresence>
      <AnimatePresence>
        {renderSuccessModal()}
      </AnimatePresence>
    </div>
  );
}
