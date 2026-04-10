import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Contracts API
export const contractsApi = {
  list: () => api.get('/contracts'),
  get: (id) => api.get(`/contracts/${id}`),
  create: (data) => api.post('/contracts', data),
  update: (id, data) => api.put(`/contracts/${id}`, data),
  delete: (id) => api.delete(`/contracts/${id}`),
};

// Orders API
export const ordersApi = {
  list: () => api.get('/orders'),
  get: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  delete: (id) => api.delete(`/orders/${id}`),
};

// Payments API
export const paymentsApi = {
  list: () => api.get('/payments'),
  get: (id) => api.get(`/payments/${id}`),
  create: (data) => api.post('/payments', data),
  update: (id, data) => api.put(`/payments/${id}`, data),
  register: (id, amount, date) => api.put(`/payments/${id}/register`, { paidAmount: amount, paidDate: date }),
};

// Shipments API
export const shipmentsApi = {
  list: () => api.get('/shipments'),
  get: (id) => api.get(`/shipments/${id}`),
  create: (data) => api.post('/shipments', data),
  update: (id, data) => api.put(`/shipments/${id}`, data),
};

// Claims API
export const claimsApi = {
  list: () => api.get('/claims'),
  get: (id) => api.get(`/claims/${id}`),
  create: (data) => api.post('/claims', data),
  update: (id, data) => api.put(`/claims/${id}`, data),
};

// Users API
export const usersApi = {
  list: () => api.get('/users'),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

// Counterparties API
export const counterpartiesApi = {
  list: () => api.get('/counterparties'),
  get: (id) => api.get(`/counterparties/${id}`),
  create: (data) => api.post('/counterparties', data),
  update: (id, data) => api.put(`/counterparties/${id}`, data),
};

// Production API
export const productionApi = {
  tasks: () => api.get('/production/tasks'),
  lines: () => api.get('/production/lines'),
  createTask: (data) => api.post('/production/tasks', data),
  updateTask: (id, data) => api.put(`/production/tasks/${id}`, data),
  // Order-centric production endpoints
  productionOrders: () => api.get('/production/orders'),
  markOrderReady: (id) => api.put(`/production/orders/${id}/ready`),
  updateOrderItem: (orderId, itemId, data) => api.put(`/production/orders/${orderId}/items/${itemId}`, data),
};

// Notifications API
export const notificationsApi = {
  list: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// Chat API
export const chatApi = {
  list: (contractId) => api.get('/chat', { params: contractId ? { contractId } : {} }),
  send: (data) => api.post('/chat', data),
  markRead: (id) => api.put(`/chat/${id}/read`),
};

// Audit API
export const auditApi = {
  list: (limit = 50, offset = 0) => api.get('/audit', { params: { limit, offset } }),
};

export default api;
