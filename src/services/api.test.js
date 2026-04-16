import { vi, describe, it, expect, beforeEach } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios', () => {
  const instance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
  };
  return {
    default: {
      create: vi.fn(() => instance),
      ...instance,
    },
  };
});

// Import after mock
import api, {
  setApiAuthToken,
  contractsApi,
  ordersApi,
  invoicesApi,
  paymentsApi,
  shipmentsApi,
  claimsApi,
  usersApi,
  counterpartiesApi,
  productionApi,
  notificationsApi,
  chatApi,
  auditApi,
  nomenclatureApi,
  settingsApi,
  authApi,
  driversApi,
  deliveryRoutesApi,
} from './api';

describe('API service', () => {
  describe('setApiAuthToken', () => {
    it('sets Authorization header when token provided', () => {
      setApiAuthToken('my-token');
      expect(api.defaults.headers.common['Authorization']).toBe('Bearer my-token');
    });

    it('removes Authorization header when token is falsy', () => {
      api.defaults.headers.common['Authorization'] = 'Bearer old-token';
      setApiAuthToken(null);
      expect(api.defaults.headers.common['Authorization']).toBeUndefined();
    });
  });

  describe('contractsApi', () => {
    it('list() calls GET /contracts', () => {
      contractsApi.list();
      expect(api.get).toHaveBeenCalledWith('/contracts');
    });

    it('get(id) calls GET /contracts/:id', () => {
      contractsApi.get(42);
      expect(api.get).toHaveBeenCalledWith('/contracts/42');
    });

    it('create(data) calls POST /contracts', () => {
      const data = { number: 'C-001' };
      contractsApi.create(data);
      expect(api.post).toHaveBeenCalledWith('/contracts', data);
    });

    it('update(id, data) calls PUT /contracts/:id', () => {
      const data = { status: 'active' };
      contractsApi.update(5, data);
      expect(api.put).toHaveBeenCalledWith('/contracts/5', data);
    });

    it('delete(id) calls DELETE /contracts/:id', () => {
      contractsApi.delete(7);
      expect(api.delete).toHaveBeenCalledWith('/contracts/7');
    });

    it('getAllFiles() calls GET /contracts/files/all', () => {
      contractsApi.getAllFiles();
      expect(api.get).toHaveBeenCalledWith('/contracts/files/all');
    });

    it('getFiles(contractId) calls GET /contracts/:id/files', () => {
      contractsApi.getFiles(3);
      expect(api.get).toHaveBeenCalledWith('/contracts/3/files');
    });
  });

  describe('ordersApi', () => {
    it('list() calls GET /orders', () => {
      ordersApi.list();
      expect(api.get).toHaveBeenCalledWith('/orders');
    });

    it('get(id) calls GET /orders/:id', () => {
      ordersApi.get(10);
      expect(api.get).toHaveBeenCalledWith('/orders/10');
    });

    it('create(data) calls POST /orders', () => {
      const data = { number: 'ORD-001' };
      ordersApi.create(data);
      expect(api.post).toHaveBeenCalledWith('/orders', data);
    });

    it('update(id, data) calls PUT /orders/:id', () => {
      ordersApi.update(2, { status: 'planned' });
      expect(api.put).toHaveBeenCalledWith('/orders/2', { status: 'planned' });
    });

    it('delete(id) calls DELETE /orders/:id', () => {
      ordersApi.delete(3);
      expect(api.delete).toHaveBeenCalledWith('/orders/3');
    });
  });

  describe('invoicesApi', () => {
    it('list() calls GET /invoices', () => {
      invoicesApi.list();
      expect(api.get).toHaveBeenCalledWith('/invoices');
    });

    it('create(data) calls POST /invoices', () => {
      invoicesApi.create({ orderId: 1 });
      expect(api.post).toHaveBeenCalledWith('/invoices', { orderId: 1 });
    });

    it('addPayment() calls POST /invoices/:id/payments', () => {
      invoicesApi.addPayment(5, 1000, '2026-05-01', 'note');
      expect(api.post).toHaveBeenCalledWith('/invoices/5/payments', {
        amount: 1000,
        paidDate: '2026-05-01',
        notes: 'note',
      });
    });

    it('deactivate(id) calls PATCH /invoices/:id/deactivate', () => {
      invoicesApi.deactivate(3);
      expect(api.patch).toHaveBeenCalledWith('/invoices/3/deactivate');
    });
  });

  describe('paymentsApi', () => {
    it('list() calls GET /payments', () => {
      paymentsApi.list();
      expect(api.get).toHaveBeenCalledWith('/payments');
    });

    it('update(id, data) calls PUT /payments/:id', () => {
      paymentsApi.update(1, { status: 'paid' });
      expect(api.put).toHaveBeenCalledWith('/payments/1', { status: 'paid' });
    });
  });

  describe('shipmentsApi', () => {
    it('list() calls GET /shipments', () => {
      shipmentsApi.list();
      expect(api.get).toHaveBeenCalledWith('/shipments');
    });

    it('confirm(id) calls PUT /shipments/:id/confirm', () => {
      shipmentsApi.confirm(8);
      expect(api.put).toHaveBeenCalledWith('/shipments/8/confirm');
    });
  });

  describe('claimsApi', () => {
    it('list() calls GET /claims', () => {
      claimsApi.list();
      expect(api.get).toHaveBeenCalledWith('/claims');
    });

    it('create(data) calls POST /claims', () => {
      claimsApi.create({ number: 'REC-001' });
      expect(api.post).toHaveBeenCalledWith('/claims', { number: 'REC-001' });
    });
  });

  describe('usersApi', () => {
    it('list() calls GET /users', () => {
      usersApi.list();
      expect(api.get).toHaveBeenCalledWith('/users');
    });

    it('resetPassword(id) calls POST /users/:id/reset-password', () => {
      usersApi.resetPassword(4);
      expect(api.post).toHaveBeenCalledWith('/users/4/reset-password');
    });
  });

  describe('counterpartiesApi', () => {
    it('list() calls GET /counterparties', () => {
      counterpartiesApi.list();
      expect(api.get).toHaveBeenCalledWith('/counterparties');
    });

    it('delete(id) calls DELETE /counterparties/:id', () => {
      counterpartiesApi.delete(9);
      expect(api.delete).toHaveBeenCalledWith('/counterparties/9');
    });
  });

  describe('productionApi', () => {
    it('tasks() calls GET /production/tasks', () => {
      productionApi.tasks();
      expect(api.get).toHaveBeenCalledWith('/production/tasks');
    });

    it('lines() calls GET /production/lines', () => {
      productionApi.lines();
      expect(api.get).toHaveBeenCalledWith('/production/lines');
    });

    it('markOrderReady(id) calls PUT /production/orders/:id/ready', () => {
      productionApi.markOrderReady(2);
      expect(api.put).toHaveBeenCalledWith('/production/orders/2/ready');
    });
  });

  describe('notificationsApi', () => {
    it('list() calls GET /notifications', () => {
      notificationsApi.list();
      expect(api.get).toHaveBeenCalledWith('/notifications');
    });

    it('markAllRead() calls PUT /notifications/read-all', () => {
      notificationsApi.markAllRead();
      expect(api.put).toHaveBeenCalledWith('/notifications/read-all');
    });
  });

  describe('chatApi', () => {
    it('list() calls GET /chat with no params', () => {
      chatApi.list();
      expect(api.get).toHaveBeenCalledWith('/chat', { params: {} });
    });

    it('list(contractId) calls GET /chat with contractId param', () => {
      chatApi.list(5);
      expect(api.get).toHaveBeenCalledWith('/chat', { params: { contractId: 5 } });
    });

    it('send(data) calls POST /chat', () => {
      chatApi.send({ text: 'hello' });
      expect(api.post).toHaveBeenCalledWith('/chat', { text: 'hello' });
    });
  });

  describe('auditApi', () => {
    it('list() calls GET /audit with defaults', () => {
      auditApi.list();
      expect(api.get).toHaveBeenCalledWith('/audit', { params: { limit: 50, offset: 0 } });
    });

    it('list(limit, offset) passes custom params', () => {
      auditApi.list(10, 20);
      expect(api.get).toHaveBeenCalledWith('/audit', { params: { limit: 10, offset: 20 } });
    });
  });

  describe('nomenclatureApi', () => {
    it('list() calls GET /nomenclature', () => {
      nomenclatureApi.list();
      expect(api.get).toHaveBeenCalledWith('/nomenclature');
    });

    it('delete(id) calls DELETE /nomenclature/:id', () => {
      nomenclatureApi.delete(3);
      expect(api.delete).toHaveBeenCalledWith('/nomenclature/3');
    });
  });

  describe('settingsApi', () => {
    it('get() calls GET /settings', () => {
      settingsApi.get();
      expect(api.get).toHaveBeenCalledWith('/settings');
    });

    it('update(data) calls PUT /settings', () => {
      settingsApi.update({ company_name: 'Acme' });
      expect(api.put).toHaveBeenCalledWith('/settings', { company_name: 'Acme' });
    });
  });

  describe('authApi', () => {
    it('login() calls POST /auth/login', () => {
      authApi.login('user@test.com', 'pass');
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'user@test.com',
        password: 'pass',
      });
    });

    it('logout() calls POST /auth/logout', () => {
      authApi.logout();
      expect(api.post).toHaveBeenCalledWith('/auth/logout');
    });

    it('me() calls GET /auth/me', () => {
      authApi.me();
      expect(api.get).toHaveBeenCalledWith('/auth/me');
    });

    it('refresh() calls POST /auth/refresh', () => {
      authApi.refresh();
      expect(api.post).toHaveBeenCalledWith('/auth/refresh');
    });
  });

  describe('driversApi', () => {
    it('list() calls GET /drivers', () => {
      driversApi.list();
      expect(api.get).toHaveBeenCalledWith('/drivers');
    });

    it('create(data) calls POST /drivers', () => {
      driversApi.create({ name: 'Иванов' });
      expect(api.post).toHaveBeenCalledWith('/drivers', { name: 'Иванов' });
    });
  });

  describe('deliveryRoutesApi', () => {
    it('list() calls GET /delivery-routes with no date', () => {
      deliveryRoutesApi.list();
      expect(api.get).toHaveBeenCalledWith('/delivery-routes', { params: {} });
    });

    it('list(date) calls GET /delivery-routes with date param', () => {
      deliveryRoutesApi.list('2026-05-01');
      expect(api.get).toHaveBeenCalledWith('/delivery-routes', { params: { date: '2026-05-01' } });
    });
  });
});
