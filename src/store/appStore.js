import { create } from 'zustand';
import {
  USERS, CONTRACTS, ORDERS, SHIPMENTS, PAYMENTS, CLAIMS,
  NOTIFICATIONS, CHAT_MESSAGES, PRODUCTION_TASKS, AUDIT_LOG,
} from '../data/mockData';

const useAppStore = create((set, get) => ({
  // Auth
  currentUser: null,
  login: (user) => set({ currentUser: user }),
  logout: () => set({ currentUser: null }),

  // Data
  contracts: CONTRACTS,
  orders: ORDERS,
  shipments: SHIPMENTS,
  payments: PAYMENTS,
  claims: CLAIMS,
  notifications: NOTIFICATIONS,
  chatMessages: CHAT_MESSAGES,
  productionTasks: PRODUCTION_TASKS,
  users: USERS,
  auditLog: AUDIT_LOG,

  // Notifications
  markNotificationRead: (id) => set(s => ({
    notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n)
  })),
  markAllRead: () => set(s => ({
    notifications: s.notifications.map(n => ({ ...n, read: true }))
  })),

  // Contracts
  addContract: (contract) => set(s => ({
    contracts: [...s.contracts, { ...contract, id: Date.now(), versions: [{ version: 1, date: new Date().toISOString().slice(0, 10), author: s.currentUser?.name, changes: 'Создание договора' }] }]
  })),
  updateContract: (id, updates) => set(s => ({
    contracts: s.contracts.map(c => c.id === id ? { ...c, ...updates } : c)
  })),

  // Orders
  addOrder: (order) => set(s => ({
    orders: [...s.orders, { ...order, id: Date.now() }]
  })),
  updateOrder: (id, updates) => set(s => ({
    orders: s.orders.map(o => o.id === id ? { ...o, ...updates } : o)
  })),

  // Shipments
  addShipment: (shipment) => set(s => ({
    shipments: [...s.shipments, { ...shipment, id: Date.now() }]
  })),

  // Payments
  registerPayment: (id, amount, date) => set(s => ({
    payments: s.payments.map(p => p.id === id ? { ...p, paidAmount: amount, paidDate: date, status: 'paid' } : p)
  })),

  // Claims
  addClaim: (claim) => set(s => ({
    claims: [...s.claims, { ...claim, id: Date.now() }]
  })),
  updateClaim: (id, updates) => set(s => ({
    claims: s.claims.map(c => c.id === id ? { ...c, ...updates } : c)
  })),

  // Production
  updateProductionTask: (id, updates) => set(s => ({
    productionTasks: s.productionTasks.map(t => t.id === id ? { ...t, ...updates } : t)
  })),

  // Chat
  sendMessage: (message) => set(s => ({
    chatMessages: [...s.chatMessages, { ...message, id: Date.now() }]
  })),

  // Users
  addUser: (user) => set(s => ({
    users: [...s.users, { ...user, id: Date.now(), active: true }]
  })),
  updateUser: (id, updates) => set(s => ({
    users: s.users.map(u => u.id === id ? { ...u, ...updates } : u)
  })),
  deleteUser: (id) => set(s => ({
    users: s.users.filter(u => u.id !== id)
  })),
}));

export default useAppStore;
