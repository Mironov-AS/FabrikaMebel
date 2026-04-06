import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,   // send httpOnly refresh-token cookie automatically
});

// Track if we're currently refreshing to avoid loops
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

// Request interceptor — attach access token
api.interceptors.request.use((config) => {
  const token = window.__accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle token expiry via cookie-based refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Cookie is sent automatically — no body needed
        const response = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const { accessToken } = response.data;
        window.__accessToken = accessToken;
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        window.__accessToken = null;
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  verifyMfa: (mfaToken, code) => api.post('/auth/mfa/verify', { mfaToken, code }),
  setupMfa: (mfaToken) => api.post('/auth/mfa/setup', { mfaToken }),
  enableMfa: (mfaToken, code) => api.post('/auth/mfa/enable', { mfaToken, code }),
  refresh: () => api.post('/auth/refresh', {}),
  logout: () => api.post('/auth/logout', {}),
  me: () => api.get('/auth/me'),
  resetPasswordRequest: (email) => api.post('/auth/reset-password/request', { email }),
  resetPasswordConfirm: (token, password) => api.post('/auth/reset-password/confirm', { token, password }),
};

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
