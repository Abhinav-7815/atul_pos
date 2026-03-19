import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, Minus, Trash2, X, Printer,
  Loader2, ChevronRight, Check, ArrowLeft,
  ShoppingBag, Clock, User, Store, ArrowUpRight,
  Pause, Play, History, ChefHat, Weight, Droplets
} from 'lucide-react';
import { menuApi, orderApi } from '../services/api';
import { offlineService } from '../services/offline';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

const getDefaultUnit = () => UNIT_OPTIONS[0];

export default function POS() {
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

  useEffect(() => {
    const config = JSON.parse(localStorage.getItem('atul_pos_config') || '{}');
    setPosConfig({
      showAdvancedManager: config.showAdvancedManager ?? true
    });
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
    // If the item is already in the cart, we don't allow selecting it again from the grid
    // as per user request to use the sidebar for quantity management.
    if (getCartItemCount(product.id) > 0) return;

    if ((product.variants && product.variants.length > 0) || (product.modifier_groups && product.modifier_groups.length > 0)) {
      setActiveProduct(product);
      setSelectedVariant(product.variants?.find(v => v.is_default) || product.variants?.[0] || null);
      setSelectedModifiers([]);
    } else {
      addToCart(product, null, []);
    }
  };

  const addToCart = (product, variant, modifiers = []) => {
    setCart(prev => {
      const variantId = variant ? variant.id : null;
      const modifierIds = [...modifiers].sort((a,b) => a.id - b.id).map(m => m.id).join(',');
      
      const existing = prev.find(item => 
        item.product.id === product.id && 
        item.variant?.id === variantId &&
        (item.modifiers?.map(m => m.id).sort((a,b) => a-b).join(',') === modifierIds)
      );

      if (existing) {
        const ui = existing.unitInfo || getDefaultUnit();
        return prev.map(item => {
          const itemModIds = (item.modifiers || []).map(m => m.id).sort((a,b) => a-b).join(',');
          return (item.product.id === product.id && item.variant?.id === variantId && itemModIds === modifierIds) 
            ? { ...item, qty: parseFloat((item.qty + ui.step).toFixed(2)) } 
            : item;
        });
      }
      return [...prev, { product, variant, modifiers, qty: 1, unitInfo: getDefaultUnit() }];
    });
    setActiveProduct(null);
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
    const varDelta = item.variant ? Number(item.variant.price_delta) : 0;
    const modDelta = (item.modifiers || []).reduce((sum, m) => sum + Number(m.price_delta), 0);
    return base + varDelta + modDelta;
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
      payment_mode: paymentMode,
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
      setLastOrder({ ...or, receipt: rr });
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
        \${receiptRef.current.innerHTML}
        <script>window.onload=function(){window.focus();window.print();};<\/script>
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
        \${kotRef.current.innerHTML}
        <script>window.onload=function(){window.focus();window.print();};<\/script>
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
        <div ref={receiptRef} style={{ display: 'none' }}>
          <div className="center" style={{ marginBottom: '8px' }}>
            <div className="header-logo" style={{fontSize: '18px', fontWeight: '800'}}>ATUL ICE CREAM</div>
            <div className="small">{r.outlet?.name || 'Vastrapur Outlet'}</div>
            <div className="small">{r.outlet?.address || 'Ahmedabad'}</div>
            <div className="small bold">GSTIN: {r.outlet?.gstin || '24AAAAA0000A1Z5'}</div>
            <div className="small">PH: {r.outlet?.phone || '+91 99999 99999'}</div>
          </div>
          <div className="center bold" style={{fontSize: '14px', margin: '10px 0', border: '1px solid #000', padding: '2px'}}>TAX INVOICE</div>
          <div className="divider"></div>
          <div className="row"><span className="bold">Bill No:</span><span className="mono">{lastOrder.order_number}</span></div>
          <div className="row"><span>Date:</span><span className="mono">{orderDate.toLocaleDateString('en-IN')} {orderDate.toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'})}</span></div>
          <div className="row"><span>Type:</span><span>{lastOrder.order_type==='dine_in'?'Dine-In':'Takeaway'}</span></div>
          {lastOrder.table_number && <div className="row"><span>Table:</span><span>{lastOrder.table_number}</span></div>}
          <div className="double-divider"></div>
          <table className="items-table" style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr style={{fontWeight:700,borderBottom:'1px solid #000'}}><td style={{width:'40%'}}>Item / HSN</td><td className="qty">Qty</td><td className="price">Rate</td><td className="price">Amount</td></tr>
            </thead>
            <tbody>
              {(r.items || []).map((item,i)=>(
                <tr key={i} style={{borderBottom:'1px dashed #eee'}}>
                  <td>
                    <span className="bold">{item.product_name}</span>
                    {item.variant_name && <span className="variant" style={{fontSize:'8px'}}>({item.variant_name})</span>}
                  </td>
                  <td className="qty mono">{item.quantity}</td>
                  <td className="price mono">{Number(item.unit_price).toFixed(2)}</td>
                  <td className="price mono">{Number(item.item_subtotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="divider"></div>
          <div className="row"><span>Subtotal (Excl. Tax)</span><span className="mono bold">₹{Number(r.totals?.subtotal).toFixed(2)}</span></div>
          <div className="row"><span>CGST</span><span className="mono">₹{Number(r.totals?.cgst).toFixed(2)}</span></div>
          <div className="row"><span>SGST</span><span className="mono">₹{Number(r.totals?.sgst).toFixed(2)}</span></div>
          <div className="double-divider"></div>
          <div className="row total-row" style={{fontSize: '16px', fontWeight: '800'}}><span>GRAND TOTAL</span><span className="mono">₹{Number(r.totals?.total).toFixed(2)}</span></div>
        </div>

        <div ref={kotRef} style={{ display: 'none' }}>
           <div className="center">
              <div className="heavy">KITCHEN ORDER</div>
              <div className="divider"></div>
              <div className="row"><span className="bold">Order # {lastOrder.order_number}</span><span>{orderDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>
              <div className="row"><span className="bold">Type: {lastOrder.order_type === 'dine_in' ? 'DINE-IN' : 'TAKEOUT'}</span><span className="bold">Table: {lastOrder.table_number || 'N/A'}</span></div>
              <div className="divider"></div>
              <table className="items-table"><tbody>
                 { (lastOrder.cartSnapshot||[]).map((item, i) => (
                    <tr key={i}><td className="qty">{item.qty}</td><td style={{paddingLeft: '10px'}}>{item.product.name} {item.variant && <span style={{fontSize: '11px', display: 'block'}}>[{item.variant.name}]</span>}</td></tr>
                 )) }
              </tbody></table>
              <div className="divider"></div>
           </div>
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
                          <span className="professional-digits font-extrabold text-atul-charcoal text-sm">₹{Number(activeProduct.base_price) + Number(v.price_delta)}</span>
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
                  onClick={() => addToCart(activeProduct, selectedVariant, selectedModifiers)}
                  className="w-full bg-atul-pink_primary text-white font-extrabold py-4 rounded-xl shadow-lg shadow-atul-pink_primary/25 hover:bg-atul-rose_deep transition-all transform active:scale-[0.98] flex justify-between px-6">
                  <span>Add to Cart</span>
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
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100 z-30">
           <div className="flex items-center gap-3">
              <div className="size-9 bg-atul-pink_primary rounded-xl flex items-center justify-center text-white">
                 <MI name="storefront" className="text-lg" fill />
              </div>
              <div>
                 <h1 className="text-[15px] font-extrabold font-heading tracking-tight leading-none text-atul-charcoal">Atul Ice Cream</h1>
                 <p className="text-[9px] font-semibold text-atul-gray/50 mt-0.5">Vastrapur Outlet • POS Terminal</p>
              </div>
           </div>

           <div className="flex-1 max-w-md mx-8">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-atul-gray/30 size-4 group-focus-within:text-atul-pink_primary transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search products, codes..." 
                  value={searchQuery} 
                  onChange={e=>setSearchQuery(e.target.value)}
                  className="w-full bg-gray-50 rounded-xl py-2.5 pl-11 pr-5 text-sm font-medium border border-gray-100 focus:border-atul-pink_primary/30 focus:bg-white focus:ring-2 focus:ring-atul-pink_primary/5 transition-all outline-none placeholder:text-atul-gray/30" 
                />
              </div>
           </div>

           <div className="flex items-center gap-4">
              {syncing && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg animate-pulse">
                  <Loader2 size={12} className="animate-spin"/>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Syncing</span>
                </div>
              )}
              {!isOnline && (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-lg">
                  <MI name="cloud_off" className="text-sm"/>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Offline Mode</span>
                </div>
              )}
              <div className="text-right pr-4 border-r border-gray-100">
                 <div className="text-sm font-bold text-atul-charcoal tabular-nums leading-none font-mono">
                   {currentTime.toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit', hour12: true})}
                 </div>
                 <div className="text-[10px] text-atul-gray/50 font-medium mt-0.5">
                   {currentTime.toLocaleDateString('en-US', {day:'2-digit', month:'short', year:'numeric'})}
                 </div>
              </div>
              <button 
                onClick={() => setIsHoldingModalOpen(true)}
                className="size-9 rounded-xl bg-atul-charcoal text-white hover:bg-black active:scale-95 transition-all cursor-pointer flex items-center justify-center relative">
                <History size={16}/>
                {heldOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-atul-pink_primary text-white size-4 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-white">
                    {heldOrders.length}
                  </span>
                )}
              </button>
           </div>
        </header>

        {/* Categories */}
        <div className="flex items-center px-6 py-2.5 overflow-x-auto scrollbar-none bg-white/60 gap-2 border-b border-gray-100">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => handleCategorySelect(cat.id)}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-xl min-w-fit transition-all text-xs font-semibold cursor-pointer border",
                selectedCategory === cat.id ? "bg-atul-pink_primary text-white border-atul-pink_primary shadow-md shadow-atul-pink_primary/20" : "bg-white text-atul-gray/60 border-gray-100 hover:border-atul-pink_primary/30 hover:text-atul-pink_primary")}>
              {cat.icon_emoji && <span className="text-sm">{cat.icon_emoji}</span>}
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-6 custom-scrollbar">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
               <Loader2 className="animate-spin size-7 mb-2" strokeWidth={2}/>
               <span className="text-xs font-medium text-atul-gray">Loading products...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
               <MI name="search_off" className="text-4xl mb-2"/>
               <span className="text-xs font-medium text-atul-gray">No products found</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
              {filteredProducts.map(p => {
                const count = getCartItemCount(p.id);
                const getProductImage = (product) => {
                  if (product.image_url) return product.image_url;
                  const n = product.name.toUpperCase();
                  if (n.includes('CHOCOLATE')) return "https://images.unsplash.com/photo-1558500204-9110ca213444?q=80&w=240&auto=format&fit=crop";
                  if (n.includes('MANGO')) return "https://images.unsplash.com/photo-1563805039227-9aba624c3017?q=80&w=240&auto=format&fit=crop";
                  if (n.includes('PISTA') || n.includes('RAJBHA') || n.includes('KESAR')) return "https://images.unsplash.com/photo-1501443762994-82bd5dabb89a?q=80&w=240&auto=format&fit=crop";
                  if (n.includes('VANILLA') || n.includes('COCONUT')) return "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?q=80&w=240&auto=format&fit=crop";
                  if (n.includes('STRAWBERRY')) return "https://images.unsplash.com/photo-1570197788417-0e82375c9371?q=80&w=240&auto=format&fit=crop";
                  if (n.includes('BUTTER')) return "https://images.unsplash.com/photo-1633933358116-a27b902fad35?q=80&w=240&auto=format&fit=crop";
                  return "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?q=80&w=240&auto=format&fit=crop";
                }

                return (
                  <motion.div key={p.id} layout whileTap={count > 0 ? {} : {scale:0.97}} onClick={()=>handleProductClick(p)}
                    className={cn("group flex flex-col bg-white rounded-2xl overflow-hidden transition-all border select-none shadow-sm",
                      count > 0 ? "border-atul-pink_primary border-2 cursor-default ring-4 ring-atul-pink_primary/5 shadow-xl" : "border-gray-100 hover:border-atul-pink_primary/20 cursor-pointer hover:shadow-lg")}>
                    
                    {/* Image */}
                    <div className="relative w-full aspect-square overflow-hidden bg-gray-50">
                       <img src={getProductImage(p)} alt={p.name} loading="lazy" className={cn("w-full h-full object-cover transition-all duration-500", count > 0 ? "scale-105 saturate-[0.2] opacity-40 blur-[1px]" : "group-hover:scale-105")} />
                       {count > 0 && (
                         <motion.div initial={{scale:0.5, opacity:0}} animate={{scale:1, opacity:1}}
                           className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-atul-pink_primary/10">
                           <div className="size-12 bg-atul-pink_primary text-white rounded-full flex items-center justify-center shadow-lg shadow-atul-pink_primary/30">
                              <Check size={28} strokeWidth={4}/>
                           </div>
                           <span className="bg-white/90 backdrop-blur-md text-atul-pink_primary px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm">Selected ×{count}</span>
                         </motion.div>
                       )}
                    </div>
                    
                    {/* Info */}
                    <div className="p-3 flex flex-col gap-1 relative overflow-hidden">
                       {count > 0 && <div className="absolute top-0 left-0 w-1 h-full bg-atul-pink_primary" />}
                       <div className="flex items-start justify-between gap-1">
                          <h3 className={cn("text-[12px] font-bold leading-tight line-clamp-2 transition-colors", count > 0 ? "text-atul-pink_primary" : "text-atul-charcoal group-hover:text-atul-pink_primary")}>
                            {p.name}
                          </h3>
                          <span className={cn("size-2 rounded-full mt-1 shrink-0", p.is_veg ? "bg-emerald-500" : "bg-red-500")}/>
                       </div>
                       <div className="flex items-baseline gap-1">
                          <span className={cn("text-[10px] font-medium", count > 0 ? "text-atul-pink_primary/40" : "text-atul-gray/40")}>₹</span>
                          <span className={cn("professional-digits text-[15px] font-extrabold tracking-tight", count > 0 ? "text-atul-pink_primary" : "text-atul-charcoal")}>{p.base_price}</span>
                          {p.variants?.length > 0 && <span className="text-atul-pink_primary text-xs font-bold">+</span>}
                       </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Advanced Product Manager - Horizontal Bar */}
        {cart.length > 0 && posConfig.showAdvancedManager && (
           <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className="h-[190px] bg-white border-t border-gray-100 flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.06)] z-50 overflow-hidden">
              <div className="px-6 py-2 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                 <div className="flex items-center gap-2">
                    <Weight size={12} className="text-atul-pink_primary"/>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-atul-charcoal/80">Advanced Product Manager</span>
                 </div>
                 <div className="text-[9px] font-bold text-atul-gray/40 uppercase tracking-widest hidden sm:block">Manage weights & price overrides</div>
              </div>
              <div className="flex-1 overflow-x-auto flex items-center px-6 gap-4 custom-scrollbar-h overflow-y-hidden">
                 <AnimatePresence mode="popLayout">
                    {cart.map((item) => (
                       <motion.div 
                          key={`${item.product.id}-${item.variant?.id}-${(item.modifiers||[]).map(m=>m.id).join('-')}`}
                          initial={{ opacity: 0, scale: 0.9, x: 20 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="min-w-[320px] h-[120px] bg-white rounded-2xl border border-atul-pink_soft/60 p-3.5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all group relative ring-1 ring-atul-pink_soft/5"
                       >
                          <div className="flex justify-between items-start">
                             <div className="flex-1 min-w-0 pr-4">
                                <h4 className="text-[11px] font-extrabold text-atul-charcoal truncate">{item.product.name}</h4>
                                {item.variant && <p className="text-[8px] font-bold text-atul-pink_primary uppercase tracking-tighter">{item.variant.name}</p>}
                             </div>
                             <button onClick={() => removeFromCart(item.product.id, item.variant?.id, item.modifiers)} className="size-5 bg-red-50 text-red-400 hover:bg-red-500 hover:text-white rounded-md flex items-center justify-center transition-all active:scale-90"><X size={10}/></button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 mt-1">
                             {/* Quantity Entry */}
                             <div className="flex flex-col gap-1">
                                <label className="text-[7px] font-black text-atul-gray/60 uppercase tracking-widest pl-1">Quantity Entry</label>
                                <div className="flex bg-atul-cream/40 rounded-xl p-1 items-center gap-1 border border-atul-pink_soft/30 focus-within:border-atul-pink_primary/40 transition-colors">
                                   <input 
                                      type="number" 
                                      step={item.unitInfo?.step || 1}
                                      value={item.qty} 
                                      onChange={(e) => setExactQty(item.product.id, item.variant?.id, e.target.value, item.modifiers)}
                                      className="w-full bg-transparent text-center font-mono font-black text-[12px] outline-none text-atul-charcoal"
                                   />
                                   <button 
                                      onClick={() => cycleUnit(item.product.id, item.variant?.id, item.modifiers)}
                                      className="px-2 py-1 bg-white rounded-lg text-[9px] font-black text-atul-pink_primary shadow-sm hover:shadow-md active:scale-95 transition-all border border-atul-pink_soft/10"
                                   >
                                      {item.unitInfo?.label || 'Qty'}
                                   </button>
                                </div>
                             </div>
                             
                             {/* Rate Override */}
                             <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center pr-1">
                                   <label className="text-[7px] font-black text-atul-gray/60 uppercase tracking-widest pl-1">Rate Adjustment</label>
                                    {item.manualPrice && <span className="text-[6px] font-black text-atul-pink_primary uppercase tracking-widest">Fixed</span>}
                                </div>
                                <div className="flex bg-atul-cream/40 rounded-xl p-1 items-center gap-1 border border-atul-pink_soft/30 focus-within:border-atul-pink_primary/40 transition-colors">
                                   <span className="text-[9px] font-black text-atul-pink_primary/40 pl-1 font-mono">₹</span>
                                   <input 
                                      type="number" 
                                      placeholder={calculateItemPrice({...item, manualPrice: null}).toFixed(0)}
                                      value={item.manualPrice || ''} 
                                      onChange={(e) => setManualPrice(item.product.id, item.variant?.id, e.target.value, item.modifiers)}
                                      className="w-full bg-transparent font-mono font-black text-[12px] outline-none text-atul-charcoal placeholder:text-atul-gray/20"
                                   />
                                   {item.manualPrice && (
                                      <button onClick={() => setManualPrice(item.product.id, item.variant?.id, '', item.modifiers)} className="p-0.5 text-atul-pink_primary hover:text-atul-charcoal transition-colors"><X size={10}/></button>
                                   )}
                                </div>
                             </div>
                          </div>
                       </motion.div>
                    ))}
                 </AnimatePresence>
                 <div className="min-w-[40px] h-full" />
              </div>
           </motion.div>
        )}
      </main>

      {/* Order Sidebar */}
      <aside className="w-[320px] bg-white border-l border-gray-100 flex flex-col z-40">
        {/* Sidebar Header */}
        <div className="px-5 py-4 border-b border-gray-100">
           <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-base font-extrabold font-heading text-atul-charcoal tracking-tight">Current Order</h2>
                <p className="text-[10px] font-medium text-atul-gray/50 mt-0.5">{totalItems} item{totalItems !== 1 ? 's' : ''} added</p>
              </div>
              <div className="size-8 bg-atul-cream/50 rounded-lg flex items-center justify-center text-atul-charcoal/20">
                 <ShoppingBag size={16} />
              </div>
           </div>
           <div className="flex bg-gray-50 p-1 rounded-xl">
              <button onClick={()=>setOrderType('dine_in')} className={cn("flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all", orderType==='dine_in'?"bg-white text-atul-pink_primary shadow-sm":"text-atul-gray/40 hover:text-atul-charcoal")}>Dine-In</button>
              <button onClick={()=>setOrderType('takeaway')} className={cn("flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all", orderType==='takeaway'?"bg-white text-atul-pink_primary shadow-sm":"text-atul-gray/40 hover:text-atul-charcoal")}>Takeaway</button>
           </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3">
           {cart.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center">
                <ShoppingBag size={32} className="text-gray-200 mb-3"/>
                <p className="text-xs font-medium text-atul-gray/30">No items yet</p>
                <p className="text-[10px] text-atul-gray/20 mt-1">Tap products to add</p>
             </div>
           ) : (
             <div className="space-y-2">
                {cart.map(item => {
                  const ui = item.unitInfo || getDefaultUnit();
                  const itemKey = `${item.product.id}-${item.variant?.id}-${(item.modifiers || []).map(m => m.id).sort().join(',')}`;
                  return (
                  <motion.div layout key={itemKey} className="p-3 rounded-xl bg-gray-50/80 border border-gray-100 hover:border-atul-pink_primary/10 transition-all">
                     <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                           <p className="text-[12px] font-bold text-atul-charcoal truncate leading-tight">{item.product.name}</p>
                           <div className="flex flex-wrap gap-1 mt-0.5">
                             {item.variant && <span className="text-[8px] px-1.5 py-0.5 bg-atul-pink_primary/5 text-atul-pink_primary rounded font-bold uppercase">{item.variant.name}</span>}
                             {item.modifiers?.map(m => (
                               <span key={m.id} className="text-[8px] px-1.5 py-0.5 bg-gray-200/50 text-atul-charcoal/60 rounded font-bold uppercase">{m.name}</span>
                             ))}
                           </div>
                        </div>
                        <span className="professional-digits text-[13px] font-extrabold text-atul-charcoal shrink-0">
                           ₹{(calculateItemPrice(item) * item.qty).toFixed(0)}
                        </span>
                     </div>
                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-100 p-0.5">
                           <button onClick={(e)=>{e.stopPropagation();updateQty(item.product.id,item.variant?.id,-1, item.modifiers)}} className="size-7 rounded-md flex items-center justify-center text-atul-gray/40 hover:text-atul-pink_primary hover:bg-atul-pink_soft/20 transition-all active:scale-90"><Minus size={12} strokeWidth={2.5}/></button>
                           {ui.type === 'piece' ? (
                             <span className="professional-digits text-[12px] font-bold w-7 text-center tabular-nums">{item.qty}</span>
                           ) : (
                             <input
                               type="number"
                               step={ui.step}
                               min={ui.min}
                               value={item.qty}
                               onClick={e=>e.stopPropagation()}
                               onChange={e=>{e.stopPropagation();setExactQty(item.product.id,item.variant?.id,e.target.value, item.modifiers)}}
                               className="professional-digits text-[12px] font-bold w-12 text-center outline-none bg-transparent tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                             />
                           )}
                           <button 
                             onClick={(e)=>{e.stopPropagation();cycleUnit(item.product.id,item.variant?.id, item.modifiers)}} 
                             title="Click to change unit (Qty / Kg / L)"
                             className="text-[9px] font-bold text-atul-pink_primary bg-atul-pink_primary/10 px-1.5 py-0.5 rounded cursor-pointer hover:bg-atul-pink_primary/20 transition-all select-none">
                             {ui.label}
                           </button>
                           <button onClick={(e)=>{e.stopPropagation();updateQty(item.product.id,item.variant?.id,1, item.modifiers)}} className="size-7 rounded-md flex items-center justify-center text-atul-gray/40 hover:text-atul-pink_primary hover:bg-atul-pink_soft/20 transition-all active:scale-90"><Plus size={12} strokeWidth={2.5}/></button>
                        </div>
                         <button onClick={(e)=>{e.stopPropagation();removeFromCart(item.product.id,item.variant?.id, item.modifiers)}} className="size-7 rounded-md flex items-center justify-center text-gray-200 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"><Trash2 size={13}/></button>
                     </div>
                  </motion.div>
                  );
                })}
             </div>
           )}
        </div>

        {/* Totals & Actions */}
        <div className="p-5 bg-white border-t border-gray-100 relative z-50">
           <div className="space-y-1.5 mb-5">
              <div className="flex justify-between items-center text-xs text-atul-gray/40">
                 <span className="font-medium">Subtotal</span>
                 <span className="professional-digits font-bold">₹{subtotal.toFixed(0)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-atul-gray/40">
                 <span className="font-medium">GST</span>
                 <span className="professional-digits font-bold">₹{tax.toFixed(0)}</span>
              </div>
              <div className="pt-3 border-t border-gray-100 mt-2">
                 <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold text-atul-charcoal/50">Total</span>
                    <span className="professional-digits text-3xl font-extrabold text-atul-pink_primary tracking-tight">
                       ₹{total.toFixed(0)}
                    </span>
                 </div>
              </div>
           </div>
           
           <div className="flex gap-2">
              <button 
                onClick={handleHoldOrder}
                disabled={cart.length === 0}
                className="size-11 rounded-xl bg-atul-charcoal text-white flex items-center justify-center hover:bg-black transition-all active:scale-95 disabled:opacity-20 shrink-0">
                <Pause size={16} />
              </button>
              <button 
                onClick={() => setStep('review')} 
                disabled={cart.length === 0} 
                className="flex-1 bg-atul-pink_primary text-white py-3 rounded-xl font-bold text-sm hover:bg-atul-pink_deep transition-all active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-2 group shadow-lg shadow-atul-pink_primary/20">
                Proceed <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform"/>
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
