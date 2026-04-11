import React, { useState, useEffect, useRef, useCallback } from 'react';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, Minus, Trash2, X, Printer, Phone,
  Loader2, ChevronRight, Check, ArrowLeft,
  ShoppingBag, Clock, User, Store, ArrowUpRight,
  Pause, Play, History, Weight, Droplets,
  Banknote, QrCode, CreditCard, CheckCircle2, Sparkles,
  LayoutGrid, Maximize, Minimize
} from 'lucide-react';
import { menuApi, orderApi } from '../services/api';
import { inventoryApi } from '../services/api';
import { offlineService } from '../services/offline';
import { printReceipt, printOrderEscPos } from '../services/printer';
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
      { value: 0.75, label: '750g', unitType: 'weight' },
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

const format100g = (name, qty = 1) => {
  if (!name) return name;
  const is100g = ['100g', '100gm', '100gms', '100gram', '100grams'].includes(name.toLowerCase().replace(/\s/g, ''));
  if (is100g) return qty === 1 ? '1 Cup' : `${qty} Cups`;
  return name;
};

export default function POS({ user }) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stockMap, setStockMap] = useState({}); // product_id -> {quantity, status}
  const [searchQuery, setSearchQuery] = useState('');
  const [orderType, setOrderType] = useState('dine_in');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState('select');
  const [lastOrder, setLastOrder] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
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
  const [posConfig, setPosConfig] = useState({ showAdvancedManager: true });
  const [managerItem, setManagerItem] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Custom Calculator States
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcMode, setCalcMode] = useState('qty'); // 'qty' | 'price'
  const [calcValue, setCalcValue] = useState('0');
  const [calcQty, setCalcQty] = useState('0');
  const [calcPrice, setCalcPrice] = useState('0');

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
    
    // Sycn isFullscreen with actual document state
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
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

  const allProductsRef = useRef([]);

  const loadData = async () => {
    try {
      // Step 1: load from cache instantly (zero wait)
      const [catRes, prodRes] = await Promise.all([
        menuApi.getCategories(),
        menuApi.getProducts(),
      ]);
      const allCats = catRes.data?.data || catRes.data || [];
      const allProds = prodRes.data?.data || prodRes.data || [];
      allProductsRef.current = allProds;

      if (allCats.length > 0) {
        setCategories(allCats);
        const firstCat = allCats[0].id;
        setSelectedCategory(firstCat);
        setProducts(allProds.filter(p => p.category === firstCat));
      }
      setLoading(false);

      // Step 2: if data came from cache, refresh in background silently
      if (catRes.fromCache || prodRes.fromCache) {
        const [freshCat, freshProd] = await Promise.all([
          menuApi.getCategories(true),
          menuApi.getProducts(null, true),
        ]);
        const freshCats = freshCat.data?.data || freshCat.data || [];
        const freshProds = freshProd.data?.data || freshProd.data || [];
        allProductsRef.current = freshProds;
        setCategories(freshCats);
        setSelectedCategory(sc => {
          const activeCat = sc || freshCats[0]?.id;
          setProducts(freshProds.filter(p => p.category === activeCat));
          return activeCat;
        });
      }

      // Step 3: stock levels (non-critical, background)
      try {
        const stockRes = await inventoryApi.getStocks({ outlet: user?.outlet });
        const stocks = stockRes.data?.data || stockRes.data?.results || stockRes.data || [];
        const map = {};
        stocks.forEach(s => { 
          const key = s.variant ? `${s.product}_${s.variant}` : `${s.product}`;
          map[key] = { quantity: s.quantity, status: s.status }; 
        });
        setStockMap(map);
      } catch (_) {}
    } catch (err) {
      console.error("Failed to load POS data", err);
      setLoading(false);
    }
  };

  // Derives the per-gram rate from the 1kg variant, falling back to the product's base/default price
  const getPricePerGram = (item) => {
    if (!item) return 0;
    const variants = item.product?.variants || [];
    // Look for 1kg variant
    const oneKgVariant = variants.find(v =>
      v.name?.toLowerCase().includes('1kg') ||
      v.name?.toLowerCase().includes('1 kg') ||
      v.name?.toLowerCase() === '1000gm' ||
      v.name?.toLowerCase() === '1000g'
    );
    const oneKgPrice = oneKgVariant
      ? Number(oneKgVariant.current_price || oneKgVariant.price_delta || 0)
      : null;
    if (oneKgPrice && oneKgPrice > 0) return oneKgPrice / 1000;
    // Fallback: use selected variant or base price, assume it's a per-kg rate
    const fallbackPrice = calculateItemPrice(item);
    return fallbackPrice > 0 ? fallbackPrice / 1000 : 0;
  };

  const handleCustomPricing = (v) => {
    if (!managerItem) return;
    setCalcMode('qty');
    // Always start at 0 so user types fresh
    setCalcQty('0');
    setCalcPrice('0');
    setCalcValue('0');
    setShowCalculator(true);
  };

  const handleCategorySelect = (id) => {
    setSelectedCategory(id);
    setSearchQuery('');
    setProducts(allProductsRef.current.filter(p => p.category === id));
  };

  const handleProductClick = (product) => {
    const unitInfo = getDefaultUnit(product);
    const defaultQty = (product.category_name || '').toLowerCase().includes('scoop') ? 1 : (unitInfo.type === 'weight' ? 0.25 : 1);
    
    setManagerItem({ 
      product, 
      variant: product.variants?.find(v => v.is_default) || product.variants?.[0] || null, 
      modifiers: [], 
      qty: defaultQty, 
      unitInfo,
      manualPrice: null
    });
  };


  const addToCartFromManager = (explicitItem) => {
    const itemToAdd = (explicitItem && explicitItem.product) ? explicitItem : managerItem;
    if (!itemToAdd) return;
    const { product, variant, modifiers, qty, unitInfo, manualPrice, customPrice } = itemToAdd;
    
    setCart(prev => {
      const variantId = variant ? variant.id : null;
      const modifierIds = Array.isArray(modifiers) ? modifiers.sort((a,b) => a.id - b.id).map(m => m.id).join(',') : '';
      
      const existing = prev.find(item => 
        item.product.id === product.id && 
        item.variant?.id === variantId &&
        ((item.modifiers || []).map(m => m.id).sort((a,b) => a-b).join(',') === modifierIds)
      );

      if (existing) {
        return prev.map(item => {
          const itemModIds = (item.modifiers || []).map(m => m.id).sort((a,b) => a-b).join(',');
          return (item.product.id === product.id && item.variant?.id === variantId && itemModIds === modifierIds) 
            ? { ...item, qty: parseFloat((item.qty + qty).toFixed(2)), manualPrice: manualPrice || item.manualPrice, customPrice: customPrice || item.customPrice } 
            : item;
        });
      }
      return [...prev, { product, variant, modifiers, qty, unitInfo, manualPrice, customPrice }];
    });
    // Reset configuration state after adding to cart
    setManagerItem(null);
  };

  const applyVariation = (v) => {
    setManagerItem(prev => {
      const unitInfo = v.unitType ? UNIT_OPTIONS.find(u => u.type === v.unitType) : prev.unitInfo;
      return {
        ...prev,
        variant: null, // Mutual exclusion: deselect variant when a preset is selected
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
    setManagerItem(prev => ({ 
      ...prev, 
      manualPrice: (price === '' || price === null) ? null : Number(price),
      customPrice: (price !== '' && price !== null)
    }));
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
    if (item.manualPrice !== undefined && item.manualPrice !== null && item.manualPrice !== '') return Number(item.manualPrice);
    
    let base = Number(item.product.display_price || item.product.base_price || 0);
    
    // If base price is 0, attempt to use the default variant's price as the reference
    if (base === 0 && !item.variant) {
      const def = (item.product.variants || []).find(v => v.is_default) || (item.product.variants || [])[0];
      base = Number(def?.current_price || def?.price_delta || 0);
    }

    const varPrice = item.variant ? Number(item.variant.current_price || item.variant.price_delta || 0) : 0;
    const modDelta = (item.modifiers || []).reduce((sum, m) => sum + Number(m.price_delta), 0);
    
    return base + varPrice + modDelta;
  };

  const total = cart.reduce((acc, item) => acc + (calculateItemPrice(item) * item.qty), 0);
  const tax = cart.reduce((acc, item) => {
    const lineTotal = calculateItemPrice(item) * item.qty;
    const rate = parseFloat(item.product.tax_rate || 5.00) / 100;
    // Inclusive Tax: Tax = Total - (Total / (1 + Rate))
    return acc + (lineTotal - (lineTotal / (1 + rate)));
  }, 0);
  const subtotal = total - tax;
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  const handlePlaceOrder = async (mode) => {
    if (cart.length === 0) return;
    const resolvedMode = mode || paymentMode || 'Cash';
    
    const orderData = {
      order_type: orderType,
      table_number: tableNo || null,
      notes: customerName ? `Customer: ${customerName}` : '',
      customer_phone: customerPhone || null,
      payment_mode: resolvedMode,
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
      const offlineOrder = { 
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
      };
      setLastOrder(offlineOrder);
      
      // AUTO-PRINT Logic for Offline
      setTimeout(() => {
        printReceipt({ receiptRef });
      }, 300);

      setStep('select');
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
      const updatedOrder = { ...or, receipt: rr, cartSnapshot: [...cart] };
      setLastOrder(updatedOrder);
      
      // AUTO-PRINT: Pehle Python server (9192) try karo — Electron ho ya browser
      // Agar print_server.py locally chal raha hai to seedha ESC/POS print hoga
      printOrderEscPos(rr);

      // Auto-WhatsApp if phone exists
      if (updatedOrder.customer_phone) {
        sendOrderToWhatsApp(updatedOrder);
      }

      setStep('select'); // Reset to menu immediately
      setCart([]);
      loadData(); // REFRESH STOCK IMMEDIATELY AFTER ORDERING
      setCustomerPhone('');
      setCustomerName('');
      setTableNo('');
    } catch (err) {
      console.error("Failed to place order", err);
      const status = err.response?.status;
      const serverMsg = err.response?.data?.error || err.response?.data?.detail
        || (err.response?.data && typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : null);
      if (!err.response) {
        // Network error — no server response
        alert("Cannot reach server. Order saved offline.");
      } else if (status === 401) {
        alert("Session expired. Please log in again.");
      } else {
        alert(serverMsg || `Order failed (${status}). Please try again.`);
      }
      offlineService.saveOrder(orderData);
    } finally {
      setIsSubmitting(false); 
    }
  };

  const handlePrintBill = useCallback(() => {
    if (!lastOrder) return;
    const isElectron = navigator.userAgent.includes('AtulPOS-Electron');
    if (isElectron && lastOrder.receipt) {
      printOrderEscPos(lastOrder.receipt);
    } else {
      printReceipt({ receiptRef });
    }
  }, [lastOrder]);

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
                <div className="grid grid-cols-1 gap-4">
                  <button onClick={handlePrintBill} className="bg-atul-charcoal text-white py-5 rounded-[2.2rem] font-black text-[12px] tracking-widest uppercase flex items-center justify-center gap-3 hover:translate-y-[-2px] transition-all cursor-pointer shadow-xl shadow-black/10 active:scale-95">
                    <Printer size={18}/> CUSTOMER BILL
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

  const renderCalculatorModal = () => {
    if (!showCalculator) return null;

    const handleDigit = (digit) => {
      const newVal = (() => {
        if (digit === '.' && calcValue.includes('.')) return calcValue;
        if (calcValue === '0' && digit !== '.') return digit;
        return calcValue + digit;
      })();
      setCalcValue(newVal);

      // Auto-sync the other mode's value
      const numVal = parseFloat(newVal) || 0;
      if (calcMode === 'qty') {
        // User is entering grams — auto-calc amount from 1kg rate
        const gramsEntered = numVal >= 10 && Number.isInteger(numVal) ? numVal : numVal * 1000;
        const perGram = getPricePerGram(managerItem);
        const autoPrice = (gramsEntered * perGram).toFixed(2);
        setCalcPrice(autoPrice);
      } else {
        // User is entering price — back-calc grams from 1kg rate
        const perGram = getPricePerGram(managerItem);
        if (perGram > 0) {
          const autoGrams = (numVal / perGram).toFixed(0);
          setCalcQty(autoGrams);
        }
      }
    };

    const handleBackspace = () => {
      setCalcValue(prev => prev.slice(0, -1) || '0');
    };

    const handleApply = () => {
      // Final save for the current active mode's temporary value
      const currentVal = calcValue;
      let finalQty = calcMode === 'qty' ? currentVal : calcQty;
      let finalPrice = calcMode === 'price' ? currentVal : calcPrice;

      let newQty = managerItem.qty;
      let newUnitInfo = managerItem.unitInfo;
      let newManualPrice = null;
      let newCustomPrice = false;

      // Apply QTY changes
      let q = parseFloat(finalQty);
      if (q > 0) {
        // Smart Conversion: If whole number >= 10, assume user meant grams.
        // Otherwise, assume kilograms (intended for 1.2, 1.5, etc.)
        if (q >= 10 && Number.isInteger(q)) {
          q = q / 1000;
        }
        newQty = q;
        newUnitInfo = { value: q };
      }
      
      // Apply Price changes
      const a = parseFloat(finalPrice);
      if (a > 0 && q > 0) {
        // Derive the unit rate from the entered amount and quantity
        newManualPrice = (a / q).toFixed(2);
        newCustomPrice = true;
      } else if (a > 0) {
        // Fallback for q=0 (shouldn't happen)
        newManualPrice = a;
        newCustomPrice = true;
      }
      
      addToCartFromManager({
        ...managerItem,
        variant: null,
        qty: newQty,
        unitInfo: newUnitInfo,
        manualPrice: newManualPrice,
        customPrice: newCustomPrice
      });
      setShowCalculator(false);
    };

    const switchMode = (newMode) => {
      if (newMode === calcMode) return;
      // 1. Save current input to its mode storage
      if (calcMode === 'qty') setCalcQty(calcValue);
      else setCalcPrice(calcValue);
      
      // 2. Load and set the other mode's current state
      setCalcMode(newMode);
      setCalcValue(newMode === 'qty' ? calcQty : calcPrice);
    };

    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-md">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-[3rem] p-8 w-full max-w-[400px] shadow-2xl border border-white relative overflow-hidden"
        >
          {/* Decorative background atoms */}
          <div className="absolute -top-20 -right-20 size-60 bg-atul-pink_primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 size-40 bg-atul-pink_primary/5 rounded-full blur-2xl" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-atul-pink_primary/10 flex items-center justify-center text-atul-pink_primary">
                  <MI name="calculate" className="text-xl" fill />
                </div>
                <h3 className="text-xl font-black text-atul-charcoal tracking-tight font-heading uppercase">Manual Entry</h3>
              </div>
              <button 
                onClick={() => setShowCalculator(false)}
                className="size-10 rounded-2xl bg-gray-50 flex items-center justify-center text-atul-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-gray-50 p-1.5 rounded-2xl gap-2 mb-6 border border-gray-100 shadow-inner">
               <button 
                 onClick={() => switchMode('qty')}
                 className={cn(
                   "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                   calcMode === 'qty' ? "bg-white text-atul-pink_primary shadow-md" : "text-atul-gray-400 hover:text-atul-charcoal"
                 )}
               >
                 Quantity ({managerItem?.unitInfo?.label || 'g'})
               </button>
               <button 
                 onClick={() => switchMode('price')}
                 className={cn(
                   "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                   calcMode === 'price' ? "bg-white text-atul-pink_primary shadow-md" : "text-atul-gray-400 hover:text-atul-charcoal"
                 )}
               >
                 Amount (₹)
               </button>
            </div>

            {/* Display Screen */}
            <div className="bg-atul-charcoal rounded-[2rem] p-8 mb-8 shadow-2xl relative group overflow-hidden border-4 border-white">
               <div className="absolute top-4 right-6 flex items-center gap-1.5">
                  <div className="size-1.5 rounded-full bg-atul-pink_primary animate-pulse" />
                  <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">Processing</span>
               </div>
               <div className="flex items-baseline justify-end gap-2">
                  <span className="text-white/30 text-2xl font-black font-mono">
                    {calcMode === 'qty' ? 'Grams' : '₹'}
                  </span>
                  <span className="text-white text-6xl font-black font-mono tracking-tighter tabular-nums truncate max-w-full">
                    {calcValue || '0'}
                  </span>
               </div>
               {/* Auto-computed counterpart */}
               <div className="flex items-center justify-end mt-3 gap-2">
                 {calcMode === 'qty' && parseFloat(calcPrice) > 0 && (
                   <span className="text-atul-pink_primary/80 text-[13px] font-black font-mono bg-white/10 px-3 py-1 rounded-lg">
                     ≈ ₹{parseFloat(calcPrice).toFixed(0)}
                   </span>
                 )}
                 {calcMode === 'price' && parseFloat(calcQty) > 0 && (
                   <span className="text-atul-pink_primary/80 text-[13px] font-black font-mono bg-white/10 px-3 py-1 rounded-lg">
                     ≈ {calcQty}g
                   </span>
                 )}
               </div>
            </div>


            {/* Keypad Grid */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(n => (
                <button
                  key={n}
                  onClick={() => handleDigit(n.toString())}
                  className="h-16 rounded-2xl bg-white border border-gray-100 text-xl font-black text-atul-charcoal hover:border-atul-pink_primary/30 hover:bg-atul-pink_primary/5 transition-all active:scale-95 shadow-sm"
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setCalcValue('0')}
                className="h-16 rounded-2xl bg-atul-pink_soft/20 border-2 border-atul-pink_soft/40 text-atul-pink_primary text-[10px] font-black uppercase tracking-widest hover:bg-atul-pink_primary hover:text-white hover:border-atul-pink_primary transition-all active:scale-95 shadow-md flex items-center justify-center -mt-px"
              >
                Clear
              </button>
            </div>

            <button
              onClick={handleApply}
              className="w-full bg-atul-pink_primary text-white py-6 rounded-[2rem] font-black text-xs tracking-[0.4em] uppercase shadow-xl shadow-atul-pink_primary/30 hover:bg-atul-pink_deep active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <CheckCircle2 size={18} /> Apply Changes
            </button>
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
                          {item.variant && <div className="text-[11px] text-atul-pink_primary font-black uppercase tracking-[0.2em] mt-1.5 flex items-center gap-1"><Check size={12}/> {format100g(item.variant.name, item.qty)}</div>}
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

  const renderPhoneNumpadModal = () => {
    if (!isPhoneModalOpen) return null;

    const handleDigit = (digit) => {
      if (digit === '.') return;
      setCustomerPhone(prev => {
        const current = (prev || '').replace(/\D/g, '');
        if (current.length >= 10) return current;
        return current + digit;
      });
    };

    const handleClear = () => {
       setCustomerPhone('');
    };

    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-md">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-[3rem] p-8 w-full max-w-[400px] shadow-2xl border border-white relative overflow-hidden"
        >
          <div className="absolute -top-20 -right-20 size-60 bg-atul-pink_primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 size-40 bg-atul-pink_primary/5 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-atul-pink_primary/10 flex items-center justify-center text-atul-pink_primary">
                  <MI name="phone_iphone" className="text-xl" fill />
                </div>
                <h3 className="text-xl font-black text-atul-charcoal tracking-tight font-heading uppercase">Manual Entry</h3>
              </div>
              <button 
                onClick={() => setIsPhoneModalOpen(false)}
                className="size-10 rounded-2xl bg-gray-50 flex items-center justify-center text-atul-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-atul-charcoal/95 rounded-[2.5rem] p-10 mb-8 border border-white/5 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-4 right-8 flex items-center gap-2">
                 <div className="size-1.5 rounded-full bg-atul-pink_primary animate-pulse shadow-[0_0_8px_rgba(214,51,132,0.8)]" />
                 <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em]">Processing</span>
               </div>
               
               <div className="relative z-10 flex flex-col items-center min-h-[60px] justify-center text-center">
                  <span className="text-white/20 text-3xl font-black italic tracking-tighter absolute left-0 bottom-2">
                    Mobile
                  </span>
                  <div className="text-4xl font-black text-white tracking-widest drop-shadow-2xl font-mono">
                    {customerPhone || '----------'}
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-8">
               {[1,2,3,4,5,6,7,8,9,0].map(n => (
                 <button 
                   key={n}
                   onClick={() => handleDigit(n.toString())}
                   className={cn(
                     "h-16 rounded-[2.2rem] bg-white border border-gray-100/50 text-xl font-black text-atul-charcoal hover:bg-atul-cream/50 active:scale-95 transition-all shadow-sm flex items-center justify-center",
                     n === 0 && "col-span-1"
                   )}
                 >
                   {n}
                 </button>
               ))}
               <button 
                 onClick={handleClear}
                 className="h-16 rounded-[2.2rem] bg-red-50/30 text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center"
               >
                 Clear
               </button>
            </div>

            <button 
              onClick={() => setIsPhoneModalOpen(false)}
              className="w-full py-6 rounded-[2.2rem] bg-atul-pink_primary text-white font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-atul-pink_primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <CheckCircle2 size={16} /> Apply Changes
            </button>
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
      {/* Variant Selection Modal removed in favor of Advanced Strip */}

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
      
      {/* ═══ ORDER SIDEBAR — Redesigned ═══ */}
      <aside className="w-[320px] bg-[#FDF3F6] border-r border-atul-pink_soft/40 flex flex-col z-40 relative overflow-hidden">

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
                  {cart.length > 0
                    ? `${cart.length} item${cart.length !== 1 ? 's' : ''} added`
                    : 'No items yet'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button 
                  onClick={() => {
                    Swal.fire({
                      title: 'Clear order?',
                      text: "All items will be removed from your bag.",
                      icon: 'warning',
                      showCancelButton: true,
                      confirmButtonColor: '#e11d48',
                      cancelButtonColor: '#94a3b8',
                      confirmButtonText: 'Yes, clear it',
                      background: '#ffffff',
                      customClass: {
                        popup: 'rounded-2xl border border-atul-pink_soft/20',
                        title: 'text-[18px] font-black font-heading text-atul-charcoal',
                        htmlContainer: 'text-[12px] font-bold text-atul-gray/40',
                        confirmButton: 'rounded-xl px-5 py-2.5 text-[12px] font-black uppercase tracking-wider',
                        cancelButton: 'rounded-xl px-5 py-2.5 text-[12px] font-black uppercase tracking-wider'
                      }
                    }).then((result) => {
                      if (result.isConfirmed) setCart([]);
                    });
                  }}
                  className="size-8 rounded-xl bg-white/60 text-atul-pink_primary border border-atul-pink_soft/40 flex items-center justify-center hover:bg-atul-pink_primary hover:text-white transition-all shadow-sm active:scale-95 group"
                  title="Clear All Items"
                >
                  <Trash2 size={14} />
                </button>
              )}

              {/* Animated item-count badge */}
              <AnimatePresence>
                {cart.length > 0 && (
                  <motion.div
                    key="badge"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="size-8 bg-atul-pink_primary text-white rounded-full flex items-center justify-center text-[12px] font-black shadow-lg shadow-atul-pink_primary/30 border-2 border-white"
                  >
                    {cart.length}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Customer Identification - Phone No for Marketing */}
        <div className="px-5 mb-2">
           <div 
              onClick={() => setIsPhoneModalOpen(true)}
              className="bg-white/80 backdrop-blur-md rounded-2xl border border-white shadow-sm p-3 focus-within:ring-2 focus-within:ring-atul-pink_primary/20 transition-all flex items-center gap-3 cursor-pointer hover:bg-white/90"
           >
              <div className="size-8 rounded-xl bg-atul-pink_primary/10 text-atul-pink_primary flex items-center justify-center">
                 <Phone size={14} />
              </div>
              <div className="flex-1">
                 <p className="text-[8px] font-black text-atul-gray/40 uppercase tracking-widest leading-none mb-1">Capture Presence</p>
                 <div className="text-[13px] font-black text-atul-charcoal h-4 flex items-center">
                    {customerPhone || <span className="text-atul-gray/20">Enter Phone No</span>}
                 </div>
              </div>
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
                              <p className="text-[13.5px] font-bold text-atul-charcoal tracking-wide leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
                                {item.product.name.toLowerCase().split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ')}
                              </p>
                            </div>
                             {(item.variant || item.modifiers?.length > 0 || (ui.type !== 'piece' || item.customPrice)) && (
                               <div className="flex flex-wrap gap-1 mt-1.5 pl-3">
                                 {item.variant && (
                                   <span className="text-[8px] px-1.5 py-0.5 bg-atul-pink_primary/8 text-atul-pink_primary rounded-md font-black uppercase tracking-wide border border-atul-pink_soft/50">
                                     {format100g(item.variant.name, item.qty)}
                                   </span>
                                 )}
                                 {/* Custom weight badge - Unify with variant display */}
                                 {(ui.type !== 'piece' || item.customPrice) && !item.variant && (
                                   <span className="text-[8px] px-1.5 py-0.5 bg-atul-pink_primary/8 text-atul-pink_primary rounded-md font-black uppercase tracking-wide border border-atul-pink_soft/50">
                                     {item.qty < 1 ? `${(item.qty * 1000).toFixed(0)}g` : `${item.qty}kg`}
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
                            <p className="professional-digits text-[15px] font-black text-atul-charcoal leading-none font-mono tracking-tight">
                              ₹{itemTotal.toFixed(0)}
                            </p>
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

                            {(ui.type !== 'piece' || item.customPrice) ? (
                               <span className="professional-digits text-[14px] font-black w-14 text-center text-atul-charcoal tabular-nums">
                                 1
                               </span>
                            ) : (
                               <span className="professional-digits text-[14px] font-black w-10 text-center text-atul-charcoal tabular-nums">
                                 {item.qty}
                               </span>
                            )}

                            {/* Unit cycle badge */}
                            <button
                              onClick={(e) => { e.stopPropagation(); cycleUnit(item.product.id, item.variant?.id, item.modifiers); }}
                              title="Click to change unit"
                              className="text-[9px] font-black text-atul-pink_primary bg-atul-pink_primary/10 px-2 py-1 rounded-xl cursor-pointer hover:bg-atul-pink_primary hover:text-white transition-all select-none"
                            >
                              {ui.type === 'piece' ? ui.label : (item.qty < 1 ? 'g' : 'kg')}
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
            <div className="space-y-1.5 py-2 border-b border-atul-pink_soft/20 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-atul-charcoal/30 uppercase tracking-[0.2em]">CGST (2.5%)</span>
                <span className="professional-digits text-[11px] font-black text-atul-charcoal/60">₹{(tax/2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-atul-charcoal/30 uppercase tracking-[0.2em]">SGST (2.5%)</span>
                <span className="professional-digits text-[11px] font-black text-atul-charcoal/60">₹{(tax/2).toFixed(2)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[13px] font-black text-atul-charcoal uppercase tracking-wider">Payable Total</span>
              <motion.span 
                key={total}
                initial={{ scale: 1.1, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="professional-digits text-[28px] font-black text-atul-pink_primary tracking-tight font-mono"
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
               onClick={() => handlePlaceOrder('Cash')}
               disabled={cart.length === 0 || isSubmitting}
               className="h-16 flex flex-col items-center justify-center bg-[#E7F7EF] text-[#2D9B63] rounded-2xl hover:bg-[#D4F0E2] transition-all active:scale-95 shadow-sm shadow-[#2D9B63]/10 disabled:opacity-30"
            >
               <Banknote size={20} />
               <span className="text-[9px] font-black mt-1 uppercase tracking-widest">Cash</span>
            </button>

            {/* 3. UPI Button */}
            <button 
               onClick={() => { setPaymentMode('UPI'); setShowQRModal(true); handlePlaceOrder('UPI'); }}
               disabled={cart.length === 0 || isSubmitting}
               className="h-16 flex flex-col items-center justify-center bg-[#F3E8FF] text-[#7C3AED] rounded-2xl hover:bg-[#EBD5FF] transition-all active:scale-95 shadow-sm shadow-[#7C3AED]/10 disabled:opacity-30"
            >
               <QrCode size={20} />
               <span className="text-[9px] font-black mt-1 uppercase tracking-widest">UPI</span>
            </button>
          </div>
        </div>
      </aside>

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
                onFocus={(e) => e.target.select()}
                inputMode="search"
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
        <div className={cn(
          "overflow-y-auto px-5 pt-4 pb-5 custom-scrollbar bg-[#F8F9FA]",
          managerItem && posConfig.showAdvancedManager ? "flex-1" : "flex-1"
        )}
        style={{
          height: managerItem && posConfig.showAdvancedManager
            ? 'calc(100% - 172px)'
            : '100%'
        }}>

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
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-11 gap-3">
              {filteredProducts.map(p => {
                const count = getCartItemCount(p.id);
                const inCart = count > 0;
                const isSelected = managerItem?.product?.id === p.id;
                const showBadge = inCart || isSelected;
                const stockInfo = stockMap[p.id];
                const isOutOfStock = stockInfo?.status === 'OUT_OF_STOCK';
                const isLowStock = stockInfo?.status === 'LOW_STOCK';

                return (
                  <motion.div
                    key={p.id}
                    layout
                    whileTap={inCart || isOutOfStock ? {} : { scale: 0.94 }}
                    onClick={() => !isOutOfStock && handleProductClick(p)}
                    className={cn(
                      "group relative flex flex-col h-[105px] bg-white rounded-[24px] overflow-hidden transition-all border-2 select-none px-3.5 py-4",
                      isOutOfStock
                        ? "border-red-100 bg-red-50/30 opacity-60 cursor-not-allowed"
                        : inCart
                          ? "border-atul-pink_primary bg-atul-pink_primary/5 shadow-lg shadow-atul-pink_primary/5 ring-4 ring-atul-pink_primary/5"
                          : "border-gray-50 hover:border-atul-pink_primary/40 cursor-pointer hover:shadow-xl hover:bg-white active:bg-gray-50"
                    )}
                  >
                    {/* Background Pattern/Accent */}
                    <div className="absolute top-0 right-0 p-1 opacity-[0.03] pointer-events-none group-hover:scale-125 transition-transform duration-500">
                       <MI name="icecream" className="text-6xl" fill />
                    </div>

                    {/* Veg/Non-veg Indicator Dot */}
                    <div className="absolute top-1.5 right-1.5 size-1.5 rounded-full z-20 border border-white shadow-sm"
                      style={{ backgroundColor: p.is_veg ? '#10b981' : '#f43f5e' }}
                    />

                    <div className="relative z-10 flex flex-col h-full">
                      <h3 className={cn(
                        "text-[14px] font-bold leading-relaxed tracking-wide transition-colors line-clamp-2 mb-auto break-words",
                        inCart ? "text-atul-pink_primary" : "text-black/85"
                      )} style={{ fontFamily: '"Inter", sans-serif' }}>
                        {p.name.toLowerCase().split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ')}
                      </h3>

                      <div className="flex items-center justify-between mt-auto">
                        <span className={cn(
                          "text-[14px] font-black font-mono tracking-tight",
                          inCart ? "text-atul-pink_primary" : "text-atul-pink_primary/80"
                        )}>
                          ₹{(() => {
                            const base = parseFloat(p.base_price || 0);
                            if (base > 0) return base.toFixed(0);
                            const def = (p.variants || []).find(v => v.is_default) || (p.variants || [])[0];
                            return parseFloat(def?.current_price || def?.price_delta || 0).toFixed(0);
                          })()}
                        </span>
                        
                        {inCart && (
                          <div className="size-4 rounded-full bg-atul-pink_primary text-white flex items-center justify-center text-[10px] font-black">
                            {count}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Low-stock indicator dot */}
                    {isLowStock && !isOutOfStock && (
                      <div className="absolute top-2 left-2 z-30 flex items-center justify-center">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500 border border-white shadow-sm"></span>
                        </span>
                      </div>
                    )}

                    {/* Out of stock overlay */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                        <div className="text-[9px] font-black text-red-500 uppercase tracking-widest">Sold Out</div>
                      </div>
                    )}

                    <AnimatePresence>
                      {showBadge && (
                        <motion.div 
                          initial={{opacity:0}} 
                          animate={{opacity:1}} 
                          exit={{opacity:0}} 
                          className="absolute inset-0 bg-atul-pink_primary/10 flex flex-col items-center justify-center backdrop-blur-sm z-20"
                        >
                           <motion.div initial={{scale:0}} animate={{scale:1}} className="size-7 bg-atul-pink_primary text-white rounded-full flex items-center justify-center shadow-lg mb-0.5">
                              {isSelected && !inCart ? <MI name="weight" className="text-base text-white" fill /> : <Check size={14} strokeWidth={4}/>}
                           </motion.div>
                           <span className="text-[8px] font-black text-white bg-atul-pink_primary px-1.5 py-0.5 rounded-full uppercase">
                              {inCart ? `×${count % 1 === 0 ? count : count.toFixed(2)}` : 'Configuring'}
                           </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* ── Advanced Product Manager Strip ── */}
        <AnimatePresence>
          {posConfig.showAdvancedManager && (
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
                  className="w-full flex items-center justify-between bg-[#FDF3F6]/80 backdrop-blur-xl rounded-[2.5rem] border-2 border-atul-pink_soft/40 p-5 shadow-xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-10 p-2 opacity-10 pointer-events-none">
                     <MI name="icecream" className="text-8xl" fill />
                  </div>

                  <div className="flex gap-10 items-center flex-1">
                    <div className="shrink-0 flex flex-col min-w-[150px]">
                      <div className="flex items-center gap-3">
                        <h4 className="text-[20px] font-extrabold text-atul-charcoal leading-none tracking-tight truncate">
                          {managerItem?.product?.name || '--'}
                        </h4>
                        {managerItem?.product && (
                          <div className={cn(
                            "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white shadow-sm",
                            (() => {
                              const key = managerItem.variant ? `${managerItem.product.id}_${managerItem.variant.id}` : `${managerItem.product.id}`;
                              const info = stockMap[key] || stockMap[managerItem.product.id]; // fallback to product stock
                              return parseFloat(info?.quantity || 0) > 0 ? "bg-emerald-50 text-emerald-500" : "bg-red-50 text-red-500";
                            })()
                          )}>
                             Available Stock: {(() => {
                               const key = managerItem.variant ? `${managerItem.product.id}_${managerItem.variant.id}` : `${managerItem.product.id}`;
                               const info = stockMap[key] || stockMap[managerItem.product.id];
                               const qty = info?.quantity || 0;
                               const unit = managerItem.product?.is_packaged_good ? 'KG' : 'KG'; // User requested KG instead of PCS
                               return `${qty} ${unit}`;
                             })()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {managerItem?.variant && (
                          <span className="text-[10px] font-black text-atul-pink_primary uppercase tracking-widest bg-white px-2 py-0.5 rounded-lg border border-atul-pink_soft/30">
                            {format100g(managerItem.variant.name, managerItem.qty)}
                          </span>
                        )}
                        <span className="text-[12px] font-black text-atul-pink_primary font-mono mt-1">
                          Rate: {managerItem ? (
                            managerItem.customPrice 
                              ? `₹${(calculateItemPrice(managerItem) * managerItem.qty).toFixed(0)} Total`
                              : `₹${calculateItemPrice(managerItem).toFixed(0)}/${managerItem.qty < 1 ? 'g' : (managerItem.unitInfo?.label || 'Qty')}`
                          ) : '--'}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3 items-center min-w-0">
                      {/* Combined Variations Box */}
                      <div className="flex bg-white p-1 rounded-2xl border border-atul-pink_soft/40 shadow-sm items-center gap-1 overflow-x-auto no-scrollbar max-w-[680px] min-h-[56px]">
                        {!managerItem ? (
                           /* Skeletons for fallback */
                           Array.from({ length: 6 }).map((_, i) => (
                             <div key={i} className="min-w-[80px] h-[56px] px-4 rounded-xl border border-gray-50 flex flex-col items-center justify-center opacity-10">
                                <div className="w-10 h-1.5 bg-atul-charcoal rounded-full mb-1" />
                                <div className="w-6 h-1 bg-atul-charcoal rounded-full" />
                             </div>
                           ))
                        ) : managerItem.product.variants?.length > 0 ? (
                           managerItem.product.variants.map(v => (
                             <button 
                               key={v.id}
                               onClick={() => addToCartFromManager({ ...managerItem, variant: v, qty: 1 })}
                               className={cn(
                                 "min-w-[80px] h-[56px] px-4 rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 whitespace-nowrap",
                                 managerItem.variant?.id === v.id
                                   ? "bg-atul-pink_primary text-white shadow-lg shadow-atul-pink_primary/20 z-10" 
                                   : "text-atul-charcoal hover:bg-atul-pink_primary/5 font-extrabold text-[12px]"
                               )}
                             >
                               <span className="leading-none text-[13px]">{format100g(v.name, 1)}</span>
                               <span className={cn("font-bold text-[11px] mt-0.5 transition-all", managerItem.variant?.id === v.id ? "text-white opacity-100" : "text-atul-pink_primary opacity-80")}>
                                 ₹{(Number(managerItem.product.display_price || managerItem.product.base_price) + Number(v.current_price || v.price_delta)).toFixed(0)}
                               </span>
                             </button>
                           ))
                        ) : (
                           getVariationsForItem(managerItem).map(v => (
                             <button 
                               key={`${v.label}-${v.value}`}
                               onClick={() => {
                                 const isCalculatorRequired = v.label.includes('750') || v.label.includes('Custom');
                                 if (isCalculatorRequired) {
                                   handleCustomPricing(v);
                                 } else {
                                   addToCartFromManager({ 
                                     ...managerItem, 
                                     variant: null, 
                                     qty: v.value, 
                                     unitInfo: v,
                                     customPrice: null 
                                   });
                                 }
                               }}
                               className={cn(
                                 "min-w-[80px] h-[56px] px-4 rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 whitespace-nowrap",
                                 managerItem.unitInfo?.label === v.label && !managerItem.customPrice
                                   ? "bg-atul-pink_primary text-white shadow-lg shadow-atul-pink_primary/20 z-10" 
                                   : "text-atul-charcoal hover:bg-atul-pink_primary/5 font-extrabold text-[12px]"
                               )}
                             >
                               <span className="leading-none text-[13px]">{format100g(v.label, 1)}</span>
                               <span className={cn("font-bold text-[11px] mt-0.5 transition-all", (managerItem.unitInfo?.label === v.label && !managerItem.customPrice) ? "text-white opacity-100" : "text-atul-pink_primary opacity-80")}>
                                 ₹{calculateItemPrice({ ...managerItem, qty: v.value, unitInfo: v }).toFixed(0)}
                               </span>
                             </button>
                           ))
                        )}

                        {/* Special Custom Option */}
                        {managerItem && (
                          <button 
                            onClick={() => handleCustomPricing({ label: 'Custom', value: 'custom' })}
                            className={cn(
                              "min-w-[100px] h-[56px] px-4 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-0.5 ml-2",
                              managerItem.customPrice
                                ? "bg-atul-pink_primary border-atul-pink_primary text-white shadow-lg" 
                                : "border-atul-pink_soft/40 text-atul-pink_primary hover:bg-atul-pink_primary/5 font-extrabold text-[12px]"
                            )}
                          >
                            <span className="leading-none text-[13px] uppercase">Custom</span>
                            {managerItem.customPrice && (
                               <span className="text-[10px] font-bold opacity-80">
                                 {managerItem.qty < 1 ? `${(managerItem.qty * 1000).toFixed(0)}g` : `${managerItem.qty}kg`}
                                 {` · ₹${(calculateItemPrice(managerItem) * managerItem.qty).toFixed(0)}`}
                               </span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-6">
                     <button onClick={() => setManagerItem(null)} className="size-14 bg-white border-2 border-gray-50 rounded-[1.5rem] flex items-center justify-center text-atul-gray-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer">
                        <X size={24}/>
                     </button>

                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>



      {/* Modals Overlays */}
      <AnimatePresence>
        {renderReviewModal()}
      </AnimatePresence>
      <AnimatePresence>
        {renderCalculatorModal()}
      </AnimatePresence>
      <AnimatePresence>
        {renderPhoneNumpadModal()}
      </AnimatePresence>

      <PrintTemplates lastOrder={lastOrder} receiptRef={receiptRef} />
    </div>
  );
};


// ── Internal Print Content Utility Component ──────────────────────────────────
// This component stays in the DOM so refs are always available
const PrintTemplates = ({ lastOrder, receiptRef }) => {
  if (!lastOrder) return null;
  const orderDate = new Date(lastOrder.created_at || Date.now());
  const r = lastOrder.receipt || {};

  return (
    <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', height: '0', overflow: 'hidden' }}>
        {/* ── Epson 80mm Premium Receipt Template ── */}
        <div ref={receiptRef} style={{ display: 'block', width: '45mm', fontFamily: "'Courier New', Courier, monospace", background: 'white', color: '#000', margin: '0' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>ATUL ICE CREAM</div>
            <div style={{ fontSize: '8px' }}>{r.outlet?.name || 'Vastrapur Outlet'}</div>
            <div style={{ fontSize: '8px' }}>PH: {r.outlet?.phone || '+91 98257 58887'}</div>
            <div style={{ fontSize: '7px' }}>GST: {r.outlet?.gstin || '24AAAAA0000A1Z5'}</div>
          </div>

          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', textAlign: 'center', fontSize: '10px', padding: '2px 0', margin: '5px 0' }}>
            INVOICE: {lastOrder.order_number?.slice(-6)}
          </div>

          <div style={{ fontSize: '8px', marginBottom: '5px' }}>
            {new Date(lastOrder.created_at).toLocaleDateString()} {new Date(lastOrder.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>

          <div style={{ borderBottom: '1px solid #000', marginBottom: '5px' }}></div>

          {(r.items || []).map((item, i) => (
            <div key={i} style={{ marginBottom: '8px', fontSize: '9px' }}>
              <div style={{ fontWeight: 'bold' }}>{item.product_name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.quantity} x {Number(item.item_subtotal / item.quantity).toFixed(0)}</span>
                <span style={{ fontWeight: 'bold' }}>{Number(item.item_subtotal).toFixed(0)}</span>
              </div>
            </div>
          ))}

          <div style={{ borderTop: '1px solid #000', marginTop: '5px', paddingTop: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
              <span>SUBTOTAL:</span>
              <span>{Number(r.totals?.subtotal).toFixed(0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
              <span>TAX(5%):</span>
              <span>{Number(r.totals?.cgst + r.totals?.sgst).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', marginTop: '5px' }}>
              <span>TOTAL:</span>
              <span>₹{Number(r.totals?.total).toFixed(0)}</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '8px' }}>
            *** THANK YOU ***
            <div style={{ marginTop: '5px' }}>visit again!</div>
          </div>
          <div style={{ height: '30px' }}></div>
        </div>

    </div>
  );
};
