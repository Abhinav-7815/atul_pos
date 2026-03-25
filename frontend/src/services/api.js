import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

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

export const authApi = {
  login: (credentials) => api.post('/auth/login/', credentials),
  pinLogin: (pin) => api.post('/auth/login/', { pin }),
  refreshToken: (refresh) => api.post('/auth/refresh/', { refresh }),
};

export const menuApi = {
  getCategories: () => api.get('/menu/categories/'),
  createCategory: (data) => api.post('/menu/categories/', data),
  updateCategory: (id, data) => api.patch(`/menu/categories/${id}/`, data),
  deleteCategory: (id) => api.delete(`/menu/categories/${id}/`),
  getProducts: (params) => api.get('/menu/products/', { params }),
  createProduct: (data) => api.post('/menu/products/', data),
  updateProduct: (id, data) => api.patch(`/menu/products/${id}/`, data),
  deleteProduct: (id) => api.delete(`/menu/products/${id}/`),
  createVariant: (data) => api.post('/menu/variants/', data), // Need to check if this exists
  updateVariant: (id, data) => api.patch(`/menu/variants/${id}/`, data),
  deleteVariant: (id) => api.delete(`/menu/variants/${id}/`),
};

export const orderApi = {
  createOrder: (data) => api.post('/orders/', data),
  getOrder: (id) => api.get(`/orders/${id}/`),
  addItem: (orderId, data) => api.post(`/orders/${orderId}/items/`, data),
  updateItem: (orderId, itemId, data) => api.patch(`/orders/${orderId}/items/${itemId}/`, data),
  confirmOrder: (orderId) => api.post(`/orders/${orderId}/confirm/`),
  recordPayment: (orderId, data) => api.post(`/orders/${orderId}/payment/`, data),
  getOrders: (params) => api.get('/orders/', { params }),
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
  batchAdjust: (data) => api.post('/inventory/stocks/batch_adjust/', data),
  getSuppliers: (params) => api.get('/inventory/suppliers/', { params }),
  createSupplier: (data) => api.post('/inventory/suppliers/', data),
  getPurchaseOrders: (params) => api.get('/inventory/purchase-orders/', { params }),
  createPurchaseOrder: (data) => api.post('/inventory/purchase-orders/', data),
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
  createUser:  (data)         => api.post('/users/', data),
  updateUser:  (id, data)     => api.patch(`/users/${id}/`, data),
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
