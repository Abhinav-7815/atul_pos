const OFFLINE_ORDERS_KEY = 'atul_offline_orders';

export const offlineService = {
  saveOrder: (orderData) => {
    const orders = JSON.parse(localStorage.getItem(OFFLINE_ORDERS_KEY) || '[]');
    orders.push({
      ...orderData,
      id: `offline_${Date.now()}`,
      offline: true,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(OFFLINE_ORDERS_KEY, JSON.stringify(orders));
  },

  getOrders: () => {
    return JSON.parse(localStorage.getItem(OFFLINE_ORDERS_KEY) || '[]');
  },

  clearOrders: () => {
    localStorage.removeItem(OFFLINE_ORDERS_KEY);
  },

  removeOrder: (id) => {
    const orders = JSON.parse(localStorage.getItem(OFFLINE_ORDERS_KEY) || '[]');
    const filtered = orders.filter(o => o.id !== id);
    localStorage.setItem(OFFLINE_ORDERS_KEY, JSON.stringify(filtered));
  }
};
