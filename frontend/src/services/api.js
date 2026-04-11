import axios from 'axios';

// Electron mein file:// protocol hota hai — absolute URL chahiye
const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('AtulPOS-Electron');
const API_URL = isElectron ? 'https://atulicecream.com/api/v1' : '/api/v1';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  // Skip adding token for auth routes to avoid validation errors on stale tokens
  const skipAuth = config.url.includes('/auth/login/') || config.url.includes('/auth/refresh/');

  if (token && !skipAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh JWT token on 401 responses
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refresh = localStorage.getItem('refresh_token');
      if (!refresh) {
        isRefreshing = false;
        // No refresh token — redirect to login
        localStorage.removeItem('access_token');
        window.location.href = '/pos/login';
        return Promise.reject(error);
      }

      try {
        const res = await axios.post('/api/v1/auth/refresh/', { refresh });
        const newAccess = res.data.access;
        localStorage.setItem('access_token', newAccess);
        api.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
        processQueue(null, newAccess);
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/pos/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  login: (credentials) => api.post('/auth/login/', credentials),
  pinLogin: (pin) => api.post('/auth/login/', { pin }),
  refreshToken: (refresh) => api.post('/auth/refresh/', { refresh }),
};

// ── Persistent Menu Caching ──
const CACHE_KEYS = {
  CATEGORIES: 'pos_cache_categories',
  PRODUCTS: 'pos_cache_products',
};

const getCached = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) { return null; }
};

const setCached = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
};

export const menuApi = {
  getCategories: async (force = false) => {
    const cached = !force && getCached(CACHE_KEYS.CATEGORIES);
    if (cached) return { data: cached, fromCache: true };
    try {
      const res = await api.get('/menu/categories/');
      setCached(CACHE_KEYS.CATEGORIES, res.data);
      return res;
    } catch (e) { return { data: getCached(CACHE_KEYS.CATEGORIES) || [] }; }
  },

  getProducts: async (params, force = false) => {
    // If no category filter, cache all products globally
    const cacheKey = params?.category ? null : CACHE_KEYS.PRODUCTS;
    const cached = cacheKey && !force && getCached(cacheKey);
    if (cached) return { data: cached, fromCache: true };
    try {
      const res = await api.get('/menu/products/', { params });
      if (cacheKey) setCached(cacheKey, res.data);
      return res;
    } catch (e) {
      const fallback = cacheKey ? getCached(cacheKey) : null;
      return { data: fallback || [] };
    }
  },

  createCategory: async (data) => {
    const res = await api.post('/menu/categories/', data);
    localStorage.removeItem(CACHE_KEYS.CATEGORIES);
    return res;
  },
  updateCategory: async (id, data) => {
    const res = await api.patch(`/menu/categories/${id}/`, data);
    localStorage.removeItem(CACHE_KEYS.CATEGORIES);
    return res;
  },
  deleteCategory: async (id) => {
    const res = await api.delete(`/menu/categories/${id}/`);
    localStorage.removeItem(CACHE_KEYS.CATEGORIES);
    return res;
  },
  createProduct: async (data) => {
    const res = await api.post('/menu/products/', data);
    localStorage.removeItem(CACHE_KEYS.PRODUCTS);
    return res;
  },
  updateProduct: async (id, data) => {
    const res = await api.patch(`/menu/products/${id}/`, data);
    localStorage.removeItem(CACHE_KEYS.PRODUCTS);
    return res;
  },
  deleteProduct: async (id) => {
    const res = await api.delete(`/menu/products/${id}/`);
    localStorage.removeItem(CACHE_KEYS.PRODUCTS);
    return res;
  },
  createVariant: (data) => api.post('/menu/variants/', data),
  updateVariant: async (id, data) => {
    const res = await api.patch(`/menu/variants/${id}/`, data);
    localStorage.removeItem(CACHE_KEYS.PRODUCTS);
    return res;
  },
  deleteVariant: async (id) => {
    const res = await api.delete(`/menu/variants/${id}/`);
    localStorage.removeItem(CACHE_KEYS.PRODUCTS);
    return res;
  },
};

export const orderApi = {
  createOrder: (data) => api.post('/orders/', data),
  getOrder: (id) => api.get(`/orders/${id}/`),
  addItem: (orderId, data) => api.post(`/orders/${orderId}/items/`, data),
  updateItem: (orderId, itemId, data) => api.patch(`/orders/${orderId}/items/${itemId}/`, data),
  confirmOrder: (orderId) => api.post(`/orders/${orderId}/confirm/`),
  recordPayment: (orderId, data) => api.post(`/orders/${orderId}/payment/`, data),
  getOrders: (params) => api.get('/orders/', { params }),
  bulkDeleteOrders: (data) => api.post('/orders/bulk-delete/', data),
  deleteOrder: (orderId, data) => api.post(`/orders/${orderId}/delete_order/`, data),
  voidOrder: (orderId, data) => api.post(`/orders/${orderId}/void/`, data),
  getReceipt: (orderId) => api.get(`/orders/${orderId}/receipt/`),
};

export const analyticsApi = {
  getDashboardStats: (params) => api.get('/analytics/dashboard/', { params }),
  getReports: (params) => api.get('/analytics/reports/', { params }),
  getAdvancedAnalytics: (params) => api.get('/analytics/advanced/', { params }),
  getExportUrl: (params) => `${api.defaults.baseURL}/analytics/reports/?${new URLSearchParams(params).toString()}&export=csv`,
};

export const staffApi = {
  getCurrentShift: () => api.get('/staff/shifts/current/'),
  openShift: (data) => api.post('/staff/shifts/open/', data),
  closeShift: (data) => api.post('/staff/shifts/close/', data),
  addCashEntry: (data) => api.post('/staff/shifts/cash-entry/', data),
  getShifts: (params) => api.get('/staff/shifts/', { params }),
};

export const inventoryApi = {
  getStocks: (params) => api.get('/inventory/stocks/', { params }),
  updateStock: (id, data) => api.patch(`/inventory/stocks/${id}/`, data),
  setQuantity: (data) => api.post('/inventory/stocks/set_quantity/', data),
  batchAdjust: (data) => api.post('/inventory/stocks/batch_adjust/', data),
  getTransactions: (params) => api.get('/inventory/transactions/', { params }),
  getSuppliers: (params) => api.get('/inventory/suppliers/', { params }),
  createSupplier: (data) => api.post('/inventory/suppliers/', data),
  updateSupplier: (id, data) => api.patch(`/inventory/suppliers/${id}/`, data),
  deleteSupplier: (id) => api.delete(`/inventory/suppliers/${id}/`),
  getPurchaseOrders: (params) => api.get('/inventory/purchase-orders/', { params }),
  createPurchaseOrder: (data) => api.post('/inventory/purchase-orders/', data),
  updatePurchaseOrder: (id, data) => api.patch(`/inventory/purchase-orders/${id}/`, data),
  deletePurchaseOrder: (id) => api.delete(`/inventory/purchase-orders/${id}/`),
  receivePurchaseOrder: (id) => api.post(`/inventory/purchase-orders/${id}/receive/`),
};

export const customerApi = {
  getCustomers: (params) => api.get('/customers/', { params }),
  createCustomer: (data) => api.post('/customers/', data),
  updateCustomer: (id, data) => api.put(`/customers/${id}/`, data),
};

export const outletApi = {
  getOutlets: () => api.get('/outlets/'),
  getOutlet: (id) => api.get(`/outlets/${id}/`),
  createOutlet: (data) => api.post('/outlets/', data),
  updateOutlet: (id, data) => api.patch(`/outlets/${id}/`, data),
};

export const userApi = {
  getUsers: (params) => api.get('/users/', { params }),
  getUser: (id) => api.get(`/users/${id}/`),
  createUser: (data) => api.post('/users/', data),
  updateUser: (id, data) => api.patch(`/users/${id}/`, data),
  deleteUser: (id) => api.delete(`/users/${id}/`),
};

export const distributorMgmtApi = {
  // List distributors with optional filters
  getDistributors: (params) => api.get('/outlets/', { params: { outlet_type: 'distributor', ...params } }),
  getDistributor:  (id)     => api.get(`/outlets/${id}/`),

  // Create outlet + manager in one shot
  createDistributor: (data) => api.post('/outlets/create_distributor/', data),

  // Update outlet fields (credit limit, discount, branch_type, etc.)
  updateDistributor: (id, data) => api.patch(`/outlets/${id}/`, data),

  // Toggle active status
  toggleActive: (id, is_active) => api.patch(`/outlets/${id}/`, { is_active }),

  // Delete distributor outlet
  deleteDistributor: (id) => api.delete(`/outlets/${id}/`),

  // Stats summary
  getStats: () => api.get('/outlets/distributor_stats/'),

  // Staff/manager for an outlet
  getOutletStaff: (outlet_id) => api.get('/users/', { params: { outlet: outlet_id } }),
};

export const distributionApi = {
  // Dashboard stats (works for both main branch and distributor)
  getDashboard: () => api.get('/distribution/dashboard/'),

  // Distributor Orders — CRUD
  getOrders:   (params) => api.get('/distribution/orders/', { params }),
  getOrder:    (id)     => api.get(`/distribution/orders/${id}/`),
  createOrder: (data)   => api.post('/distribution/orders/', data),
  updateOrder: (id, data) => api.patch(`/distribution/orders/${id}/`, data),
  deleteOrder: (id)     => api.delete(`/distribution/orders/${id}/`),

  // Workflow actions
  submitOrder:  (id)        => api.post(`/distribution/orders/${id}/submit/`),
  approveOrder: (id)        => api.post(`/distribution/orders/${id}/approve/`),
  processOrder: (id)        => api.post(`/distribution/orders/${id}/process/`),
  dispatchOrder:(id, data)  => api.post(`/distribution/orders/${id}/dispatch/`, data),
  receiveOrder: (id)        => api.post(`/distribution/orders/${id}/receive/`),
  cancelOrder:  (id, data)  => api.post(`/distribution/orders/${id}/cancel/`, data),

  // Dispatches (read-only)
  getDispatches: (params) => api.get('/distribution/dispatches/', { params }),
  getDispatch:   (id)     => api.get(`/distribution/dispatches/${id}/`),

  // Distributor outlets (filtered from outletApi)
  getDistributorOutlets: () => api.get('/outlets/', { params: { outlet_type: 'distributor' } }),
};

export default api;
