import { create } from 'zustand';
import {
  authApi, contractsApi, ordersApi, paymentsApi, shipmentsApi,
  claimsApi, usersApi, productionApi, notificationsApi, chatApi, auditApi, counterpartiesApi,
} from '../services/api';

const useAppStore = create((set, get) => ({
  // ─── Auth ────────────────────────────────────────────────
  currentUser: null,
  accessToken: null,
  isInitializing: true, // checking stored session on app load

  // Initialize session from stored refresh token
  initializeAuth: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      set({ isInitializing: false });
      return;
    }
    try {
      const { data } = await authApi.refresh(refreshToken);
      window.__accessToken = data.accessToken;
      set({ currentUser: data.user, accessToken: data.accessToken, isInitializing: false });
      await get().loadAll();
    } catch {
      localStorage.removeItem('refreshToken');
      set({ currentUser: null, accessToken: null, isInitializing: false });
    }
  },

  // Login — returns { requiresMfa, requiresMfaSetup, mfaToken, user } or sets currentUser
  login: async (email, password) => {
    const { data } = await authApi.login(email, password);
    if (data.accessToken) {
      // No MFA — direct login
      window.__accessToken = data.accessToken;
      localStorage.setItem('refreshToken', data.refreshToken);
      set({ currentUser: data.user, accessToken: data.accessToken });
      await get().loadAll();
    }
    return data; // caller handles MFA flow
  },

  // Complete MFA verification
  completeMfa: async (mfaToken, code) => {
    const { data } = await authApi.verifyMfa(mfaToken, code);
    window.__accessToken = data.accessToken;
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ currentUser: data.user, accessToken: data.accessToken });
    await get().loadAll();
    return data;
  },

  // Enable MFA after setup
  enableMfa: async (mfaToken, code) => {
    const { data } = await authApi.enableMfa(mfaToken, code);
    window.__accessToken = data.accessToken;
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ currentUser: data.user, accessToken: data.accessToken });
    await get().loadAll();
    return data;
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try { await authApi.logout(refreshToken); } catch {}
    window.__accessToken = null;
    localStorage.removeItem('refreshToken');
    set({
      currentUser: null, accessToken: null,
      contracts: [], orders: [], shipments: [], payments: [],
      claims: [], notifications: [], chatMessages: [], productionTasks: [],
      users: [], auditLog: [], counterparties: [],
    });
  },

  // ─── Data ────────────────────────────────────────────────
  contracts: [],
  orders: [],
  shipments: [],
  payments: [],
  claims: [],
  notifications: [],
  chatMessages: [],
  productionTasks: [],
  users: [],
  auditLog: [],
  counterparties: [],
  isLoading: false,
  error: null,

  // Load all data in parallel
  loadAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const [contracts, orders, shipments, payments, claims, notifications, tasks, counterparties] = await Promise.all([
        contractsApi.list(),
        ordersApi.list(),
        shipmentsApi.list(),
        paymentsApi.list(),
        claimsApi.list(),
        notificationsApi.list(),
        productionApi.tasks(),
        counterpartiesApi.list(),
      ]);

      // Users only for admin/director
      const { currentUser } = get();
      let users = [];
      if (currentUser && ['admin', 'director'].includes(currentUser.role)) {
        try { const res = await usersApi.list(); users = res.data; } catch {}
      }

      // Audit log only for admin/director/analyst
      let auditLog = [];
      if (currentUser && ['admin', 'director', 'analyst'].includes(currentUser.role)) {
        try { const res = await auditApi.list(); auditLog = res.data.data; } catch {}
      }

      // Chat messages
      let chatMessages = [];
      try { const res = await chatApi.list(); chatMessages = res.data; } catch {}

      set({
        contracts: contracts.data,
        orders: orders.data,
        shipments: shipments.data,
        payments: payments.data,
        claims: claims.data,
        notifications: notifications.data,
        productionTasks: tasks.data,
        counterparties: counterparties.data,
        users,
        auditLog,
        chatMessages,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: err.message });
    }
  },

  // ─── Notifications ───────────────────────────────────────
  markNotificationRead: async (id) => {
    await notificationsApi.markRead(id);
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n)
    }));
  },
  markAllRead: async () => {
    await notificationsApi.markAllRead();
    set(s => ({
      notifications: s.notifications.map(n => ({ ...n, read: true }))
    }));
  },

  // ─── Contracts ───────────────────────────────────────────
  addContract: async (contract) => {
    const { data } = await contractsApi.create(contract);
    set(s => ({ contracts: [data, ...s.contracts] }));
    return data;
  },
  updateContract: async (id, updates) => {
    const { data } = await contractsApi.update(id, updates);
    set(s => ({ contracts: s.contracts.map(c => c.id === id ? data : c) }));
    return data;
  },

  // ─── Orders ──────────────────────────────────────────────
  addOrder: async (order) => {
    const { data } = await ordersApi.create(order);
    set(s => ({ orders: [data, ...s.orders] }));
    return data;
  },
  updateOrder: async (id, updates) => {
    const { data } = await ordersApi.update(id, updates);
    set(s => ({ orders: s.orders.map(o => o.id === id ? data : o) }));
    return data;
  },

  // ─── Shipments ───────────────────────────────────────────
  addShipment: async (shipment) => {
    const { data } = await shipmentsApi.create(shipment);
    set(s => ({ shipments: [data, ...s.shipments] }));
    // Reload payments since a new one is auto-created
    const res = await paymentsApi.list();
    set({ payments: res.data });
    return data;
  },

  // ─── Payments ────────────────────────────────────────────
  registerPayment: async (id, amount, date) => {
    const { data } = await paymentsApi.register(id, amount, date);
    set(s => ({ payments: s.payments.map(p => p.id === id ? data : p) }));
    return data;
  },

  // ─── Claims ──────────────────────────────────────────────
  addClaim: async (claim) => {
    const { data } = await claimsApi.create(claim);
    set(s => ({ claims: [data, ...s.claims] }));
    return data;
  },
  updateClaim: async (id, updates) => {
    const { data } = await claimsApi.update(id, updates);
    set(s => ({ claims: s.claims.map(c => c.id === id ? data : c) }));
    return data;
  },

  // ─── Production ──────────────────────────────────────────
  updateProductionTask: async (id, updates) => {
    const { data } = await productionApi.updateTask(id, updates);
    set(s => ({ productionTasks: s.productionTasks.map(t => t.id === id ? data : t) }));
    return data;
  },

  // ─── Chat ────────────────────────────────────────────────
  sendMessage: async (message) => {
    const { data } = await chatApi.send(message);
    set(s => ({ chatMessages: [...s.chatMessages, data] }));
    return data;
  },

  // ─── Users ───────────────────────────────────────────────
  addUser: async (user) => {
    const { data } = await usersApi.create(user);
    set(s => ({ users: [...s.users, data] }));
    return data;
  },
  updateUser: async (id, updates) => {
    const { data } = await usersApi.update(id, updates);
    set(s => ({ users: s.users.map(u => u.id === id ? data : u) }));
    return data;
  },
  deleteUser: async (id) => {
    await usersApi.delete(id);
    set(s => ({ users: s.users.map(u => u.id === id ? { ...u, active: false } : u) }));
  },
}));

export default useAppStore;
