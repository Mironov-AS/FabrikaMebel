import { create } from 'zustand';
import {
  contractsApi, ordersApi, paymentsApi, shipmentsApi,
  claimsApi, usersApi, productionApi, notificationsApi, chatApi, auditApi, counterpartiesApi,
  nomenclatureApi, driversApi, deliveryRoutesApi,
} from '../services/api';
import { NOMENCLATURE } from '../data/mockData';

const useAppStore = create((set, get) => ({
  // ─── Service selection ───────────────────────────────────
  currentService: null,   // id of active service workspace
  setService: (id) => set({ currentService: id }),
  clearService: () => set({ currentService: null }),

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
  nomenclature: NOMENCLATURE,
  drivers: [],
  deliveryRoutes: [],
  isLoading: false,
  error: null,

  // Load all data in parallel; guarded against concurrent calls
  loadAll: async () => {
    if (get().isLoading) return;
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

      let users = [];
      try { const res = await usersApi.list(); users = res.data; } catch {}

      let auditLog = [];
      try { const res = await auditApi.list(); auditLog = res.data.data; } catch {}

      let chatMessages = [];
      try { const res = await chatApi.list(); chatMessages = res.data; } catch {}

      let drivers = [];
      try { const res = await driversApi.list(); drivers = res.data; } catch {}

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
        drivers,
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
    const [paymentsRes, ordersRes] = await Promise.all([paymentsApi.list(), ordersApi.list()]);
    set({ payments: paymentsRes.data, orders: ordersRes.data });
    return data;
  },

  // ─── Drivers ─────────────────────────────────────────────
  addDriver: async (driverData) => {
    const { data } = await driversApi.create(driverData);
    set(s => ({ drivers: [...s.drivers, data] }));
    return data;
  },
  updateDriver: async (id, updates) => {
    const { data } = await driversApi.update(id, updates);
    set(s => ({ drivers: s.drivers.map(d => d.id === id ? data : d) }));
    return data;
  },

  // ─── Delivery Routes ──────────────────────────────────────
  loadDeliveryRoutes: async (date) => {
    const { data } = await deliveryRoutesApi.list(date);
    set({ deliveryRoutes: data });
    return data;
  },
  createDeliveryRoute: async (routeData) => {
    const { data } = await deliveryRoutesApi.create(routeData);
    set(s => ({ deliveryRoutes: [...s.deliveryRoutes, data] }));
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
  markOrderReadyForShipment: async (orderId) => {
    await productionApi.markOrderReady(orderId);
    // refresh orders list
    const { data } = await ordersApi.list();
    set({ orders: data });
  },
  updateOrderItemStatus: async (orderId, itemId, status) => {
    await productionApi.updateOrderItem(orderId, itemId, { status });
    // refresh orders list
    const { data } = await ordersApi.list();
    set({ orders: data });
  },
  sendOrderToProduction: async (orderId) => {
    const { data } = await ordersApi.update(orderId, { status: 'in_production' });
    set(s => ({ orders: s.orders.map(o => o.id === orderId ? data : o) }));
    return data;
  },

  // ─── Chat ────────────────────────────────────────────────
  sendMessage: async (message) => {
    const { data } = await chatApi.send(message);
    set(s => ({ chatMessages: [...s.chatMessages, data] }));
    return data;
  },

  // ─── Counterparties ──────────────────────────────────────
  addCounterparty: async (counterparty) => {
    const { data } = await counterpartiesApi.create(counterparty);
    set(s => ({ counterparties: [...s.counterparties, data] }));
    return data;
  },
  updateCounterparty: async (id, updates) => {
    const { data } = await counterpartiesApi.update(id, updates);
    set(s => ({ counterparties: s.counterparties.map(c => c.id === id ? data : c) }));
    return data;
  },
  deleteCounterparty: async (id) => {
    await counterpartiesApi.delete(id);
    set(s => ({ counterparties: s.counterparties.filter(c => c.id !== id) }));
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

  // ─── Nomenclature ────────────────────────────────────────
  addNomenclatureItem: (item) => {
    const id = Date.now();
    const newItem = { ...item, id, status: 'active' };
    set(s => ({ nomenclature: [...s.nomenclature, newItem] }));
    try { nomenclatureApi.create(newItem); } catch {}
    return newItem;
  },
  updateNomenclatureItem: (id, updates) => {
    set(s => ({
      nomenclature: s.nomenclature.map(n => n.id === id ? { ...n, ...updates } : n),
    }));
    try { nomenclatureApi.update(id, updates); } catch {}
  },
  deleteNomenclatureItem: (id) => {
    set(s => ({ nomenclature: s.nomenclature.filter(n => n.id !== id) }));
    try { nomenclatureApi.delete(id); } catch {}
  },
  discontinueNomenclatureItem: (id) => {
    set(s => ({
      nomenclature: s.nomenclature.map(n => n.id === id ? { ...n, status: 'discontinued' } : n),
    }));
    try { nomenclatureApi.update(id, { status: 'discontinued' }); } catch {}
  },
  restoreNomenclatureItem: (id) => {
    set(s => ({
      nomenclature: s.nomenclature.map(n => n.id === id ? { ...n, status: 'active' } : n),
    }));
    try { nomenclatureApi.update(id, { status: 'active' }); } catch {}
  },
}));

export default useAppStore;
