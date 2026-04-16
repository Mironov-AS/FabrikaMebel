import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock all API modules before importing the store ─────────────────────────
vi.mock('../services/api', () => ({
  contractsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  ordersApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  shipmentsApi: { list: vi.fn(), create: vi.fn(), confirm: vi.fn() },
  paymentsApi: { list: vi.fn(), register: vi.fn() },
  claimsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
  notificationsApi: { list: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() },
  productionApi: {
    tasks: vi.fn(),
    updateTask: vi.fn(),
    markOrderReady: vi.fn(),
    updateOrderItem: vi.fn(),
  },
  chatApi: { list: vi.fn(), send: vi.fn() },
  auditApi: { list: vi.fn() },
  usersApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  counterpartiesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  invoicesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    addPayment: vi.fn(),
    deletePayment: vi.fn(),
    deactivate: vi.fn(),
  },
  nomenclatureApi: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  driversApi: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
  deliveryRoutesApi: { list: vi.fn(), create: vi.fn() },
}));

import useAppStore from './appStore';
import {
  contractsApi, ordersApi, shipmentsApi, paymentsApi,
  claimsApi, notificationsApi, productionApi, chatApi,
  auditApi, usersApi, counterpartiesApi, invoicesApi,
  nomenclatureApi, driversApi, deliveryRoutesApi,
} from '../services/api';

// Helper: reset Zustand store state between tests
function resetStore() {
  useAppStore.setState({
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
    currentService: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

// ── Service selection ────────────────────────────────────────────────────────
describe('setService / clearService', () => {
  it('setService updates currentService', () => {
    useAppStore.getState().setService('logistics');
    expect(useAppStore.getState().currentService).toBe('logistics');
  });

  it('clearService resets currentService to null', () => {
    useAppStore.setState({ currentService: 'logistics' });
    useAppStore.getState().clearService();
    expect(useAppStore.getState().currentService).toBeNull();
  });
});

// ── loadAll ──────────────────────────────────────────────────────────────────
describe('loadAll', () => {
  it('populates store with data from API', async () => {
    contractsApi.list.mockResolvedValue({ data: [{ id: 1, number: 'C-001' }] });
    ordersApi.list.mockResolvedValue({ data: [{ id: 10 }] });
    shipmentsApi.list.mockResolvedValue({ data: [] });
    invoicesApi.list.mockResolvedValue({ data: [] });
    paymentsApi.list.mockResolvedValue({ data: [] });
    claimsApi.list.mockResolvedValue({ data: [] });
    notificationsApi.list.mockResolvedValue({ data: [] });
    productionApi.tasks.mockResolvedValue({ data: [] });
    counterpartiesApi.list.mockResolvedValue({ data: [] });
    usersApi.list.mockResolvedValue({ data: [{ id: 99 }] });
    auditApi.list.mockResolvedValue({ data: { data: [] } });
    chatApi.list.mockResolvedValue({ data: [] });

    await useAppStore.getState().loadAll();

    const state = useAppStore.getState();
    expect(state.contracts).toEqual([{ id: 1, number: 'C-001' }]);
    expect(state.orders).toEqual([{ id: 10 }]);
    expect(state.users).toEqual([{ id: 99 }]);
    expect(state.isLoading).toBe(false);
  });

  it('does not reload if already loading (concurrent guard)', async () => {
    useAppStore.setState({ isLoading: true });
    await useAppStore.getState().loadAll();
    expect(contractsApi.list).not.toHaveBeenCalled();
  });

  it('sets error on failure', async () => {
    contractsApi.list.mockRejectedValue(new Error('Network error'));
    ordersApi.list.mockRejectedValue(new Error('Network error'));
    shipmentsApi.list.mockRejectedValue(new Error('Network error'));
    invoicesApi.list.mockRejectedValue(new Error('Network error'));
    paymentsApi.list.mockRejectedValue(new Error('Network error'));
    claimsApi.list.mockRejectedValue(new Error('Network error'));
    notificationsApi.list.mockRejectedValue(new Error('Network error'));
    productionApi.tasks.mockRejectedValue(new Error('Network error'));
    counterpartiesApi.list.mockRejectedValue(new Error('Network error'));

    await useAppStore.getState().loadAll();

    const state = useAppStore.getState();
    expect(state.error).toBe('Network error');
    expect(state.isLoading).toBe(false);
  });
});

// ── Contracts ────────────────────────────────────────────────────────────────
describe('addContract', () => {
  it('prepends new contract to the list', async () => {
    useAppStore.setState({ contracts: [{ id: 1 }] });
    contractsApi.create.mockResolvedValue({ data: { id: 2, number: 'C-002' } });

    const result = await useAppStore.getState().addContract({ number: 'C-002' });

    expect(result).toEqual({ id: 2, number: 'C-002' });
    expect(useAppStore.getState().contracts[0]).toEqual({ id: 2, number: 'C-002' });
    expect(useAppStore.getState().contracts).toHaveLength(2);
  });
});

describe('updateContract', () => {
  it('replaces the contract with matching id', async () => {
    useAppStore.setState({ contracts: [{ id: 1, status: 'draft' }, { id: 2, status: 'active' }] });
    contractsApi.update.mockResolvedValue({ data: { id: 1, status: 'active' } });

    await useAppStore.getState().updateContract(1, { status: 'active' });

    const c = useAppStore.getState().contracts.find(c => c.id === 1);
    expect(c.status).toBe('active');
  });
});

// ── Notifications ────────────────────────────────────────────────────────────
describe('markNotificationRead', () => {
  it('sets read=true on the target notification only', async () => {
    useAppStore.setState({
      notifications: [
        { id: 1, read: false },
        { id: 2, read: false },
      ],
    });
    notificationsApi.markRead.mockResolvedValue({});

    await useAppStore.getState().markNotificationRead(1);

    const notifs = useAppStore.getState().notifications;
    expect(notifs.find(n => n.id === 1).read).toBe(true);
    expect(notifs.find(n => n.id === 2).read).toBe(false);
  });
});

describe('markAllRead', () => {
  it('sets read=true on all notifications', async () => {
    useAppStore.setState({
      notifications: [
        { id: 1, read: false },
        { id: 2, read: false },
      ],
    });
    notificationsApi.markAllRead.mockResolvedValue({});

    await useAppStore.getState().markAllRead();

    const notifs = useAppStore.getState().notifications;
    expect(notifs.every(n => n.read)).toBe(true);
  });
});

// ── Claims ───────────────────────────────────────────────────────────────────
describe('addClaim', () => {
  it('prepends new claim', async () => {
    useAppStore.setState({ claims: [{ id: 1 }] });
    claimsApi.create.mockResolvedValue({ data: { id: 2, number: 'CLM-001' } });

    await useAppStore.getState().addClaim({ number: 'CLM-001' });

    expect(useAppStore.getState().claims[0]).toEqual({ id: 2, number: 'CLM-001' });
  });
});

describe('updateClaim', () => {
  it('replaces the claim with matching id', async () => {
    useAppStore.setState({ claims: [{ id: 1, status: 'open' }] });
    claimsApi.update.mockResolvedValue({ data: { id: 1, status: 'resolved' } });

    await useAppStore.getState().updateClaim(1, { status: 'resolved' });

    expect(useAppStore.getState().claims[0].status).toBe('resolved');
  });
});

// ── Counterparties ───────────────────────────────────────────────────────────
describe('deleteCounterparty', () => {
  it('removes the counterparty from the list', async () => {
    useAppStore.setState({ counterparties: [{ id: 1 }, { id: 2 }] });
    counterpartiesApi.delete.mockResolvedValue({});

    await useAppStore.getState().deleteCounterparty(1);

    const cps = useAppStore.getState().counterparties;
    expect(cps).toHaveLength(1);
    expect(cps[0].id).toBe(2);
  });
});

// ── Chat ─────────────────────────────────────────────────────────────────────
describe('sendMessage', () => {
  it('appends message to chatMessages', async () => {
    useAppStore.setState({ chatMessages: [{ id: 1, text: 'hello' }] });
    chatApi.send.mockResolvedValue({ data: { id: 2, text: 'world' } });

    await useAppStore.getState().sendMessage({ text: 'world' });

    const msgs = useAppStore.getState().chatMessages;
    expect(msgs).toHaveLength(2);
    expect(msgs[1]).toEqual({ id: 2, text: 'world' });
  });
});

// ── Orders ───────────────────────────────────────────────────────────────────
describe('addOrder', () => {
  it('prepends new order to the list', async () => {
    useAppStore.setState({ orders: [{ id: 1 }] });
    ordersApi.create.mockResolvedValue({ data: { id: 2, number: 'ORD-002' } });

    const result = await useAppStore.getState().addOrder({ number: 'ORD-002' });

    expect(result).toEqual({ id: 2, number: 'ORD-002' });
    expect(useAppStore.getState().orders[0]).toEqual({ id: 2, number: 'ORD-002' });
    expect(useAppStore.getState().orders).toHaveLength(2);
  });
});

describe('updateOrder', () => {
  it('replaces the order with matching id', async () => {
    useAppStore.setState({ orders: [{ id: 1, status: 'planned' }] });
    ordersApi.update.mockResolvedValue({ data: { id: 1, status: 'in_production' } });

    await useAppStore.getState().updateOrder(1, { status: 'in_production' });

    expect(useAppStore.getState().orders[0].status).toBe('in_production');
  });
});

// ── Shipments ────────────────────────────────────────────────────────────────
describe('addShipment', () => {
  it('prepends new shipment and refreshes payments and orders', async () => {
    useAppStore.setState({ shipments: [], payments: [], orders: [] });
    shipmentsApi.create.mockResolvedValue({ data: { id: 1, invoiceNumber: 'INV-001' } });
    paymentsApi.list.mockResolvedValue({ data: [{ id: 10 }] });
    ordersApi.list.mockResolvedValue({ data: [{ id: 5 }] });

    const result = await useAppStore.getState().addShipment({ invoiceNumber: 'INV-001' });

    expect(result).toEqual({ id: 1, invoiceNumber: 'INV-001' });
    expect(useAppStore.getState().shipments).toHaveLength(1);
    expect(useAppStore.getState().payments).toEqual([{ id: 10 }]);
    expect(useAppStore.getState().orders).toEqual([{ id: 5 }]);
  });
});

describe('confirmShipment', () => {
  it('updates the shipment in list and refreshes orders', async () => {
    useAppStore.setState({ shipments: [{ id: 1, status: 'scheduled' }], orders: [] });
    shipmentsApi.confirm.mockResolvedValue({ data: { id: 1, status: 'shipped' } });
    ordersApi.list.mockResolvedValue({ data: [{ id: 5, status: 'shipped' }] });

    await useAppStore.getState().confirmShipment(1);

    const sh = useAppStore.getState().shipments.find(s => s.id === 1);
    expect(sh.status).toBe('shipped');
    expect(useAppStore.getState().orders).toEqual([{ id: 5, status: 'shipped' }]);
  });
});

// ── Invoices ─────────────────────────────────────────────────────────────────
describe('createInvoice', () => {
  it('prepends new invoice to the list', async () => {
    useAppStore.setState({ invoices: [] });
    invoicesApi.create.mockResolvedValue({ data: { id: 1, invoiceNumber: 'INV-001' } });

    const result = await useAppStore.getState().createInvoice({ orderId: 1 });

    expect(result).toEqual({ id: 1, invoiceNumber: 'INV-001' });
    expect(useAppStore.getState().invoices[0]).toEqual({ id: 1, invoiceNumber: 'INV-001' });
  });
});

describe('updateInvoice', () => {
  it('replaces the invoice with matching id', async () => {
    useAppStore.setState({ invoices: [{ id: 1, amount: 1000 }] });
    invoicesApi.update.mockResolvedValue({ data: { id: 1, amount: 2000 } });

    await useAppStore.getState().updateInvoice(1, { amount: 2000 });

    expect(useAppStore.getState().invoices[0].amount).toBe(2000);
  });
});

describe('addInvoicePayment', () => {
  it('updates invoice in list and refreshes orders/payments', async () => {
    useAppStore.setState({ invoices: [{ id: 1, paidAmount: 0 }], orders: [], payments: [] });
    invoicesApi.addPayment.mockResolvedValue({ data: { id: 1, paidAmount: 500, status: 'partial' } });
    ordersApi.list.mockResolvedValue({ data: [{ id: 5 }] });
    paymentsApi.list.mockResolvedValue({ data: [{ id: 20 }] });

    await useAppStore.getState().addInvoicePayment(1, 500, '2026-05-01', '');

    const inv = useAppStore.getState().invoices.find(i => i.id === 1);
    expect(inv.paidAmount).toBe(500);
    expect(useAppStore.getState().orders).toHaveLength(1);
    expect(useAppStore.getState().payments).toHaveLength(1);
  });
});

describe('deactivateInvoice', () => {
  it('replaces the deactivated invoice in the list', async () => {
    useAppStore.setState({ invoices: [{ id: 1, isActive: true }] });
    invoicesApi.deactivate.mockResolvedValue({ data: { id: 1, isActive: false } });

    await useAppStore.getState().deactivateInvoice(1);

    expect(useAppStore.getState().invoices[0].isActive).toBe(false);
  });
});

// ── Production ───────────────────────────────────────────────────────────────
describe('updateProductionTask', () => {
  it('replaces the task with matching id', async () => {
    useAppStore.setState({ productionTasks: [{ id: 1, status: 'planned' }] });
    productionApi.updateTask.mockResolvedValue({ data: { id: 1, status: 'in_progress' } });

    await useAppStore.getState().updateProductionTask(1, { status: 'in_progress' });

    expect(useAppStore.getState().productionTasks[0].status).toBe('in_progress');
  });
});

describe('markOrderReadyForShipment', () => {
  it('calls markOrderReady API and refreshes orders', async () => {
    useAppStore.setState({ orders: [{ id: 5, status: 'in_production' }] });
    productionApi.markOrderReady.mockResolvedValue({});
    ordersApi.list.mockResolvedValue({ data: [{ id: 5, status: 'ready_for_shipment' }] });

    await useAppStore.getState().markOrderReadyForShipment(5);

    expect(productionApi.markOrderReady).toHaveBeenCalledWith(5);
    expect(useAppStore.getState().orders[0].status).toBe('ready_for_shipment');
  });
});

describe('sendOrderToProduction', () => {
  it('updates the order status to in_production', async () => {
    useAppStore.setState({ orders: [{ id: 3, status: 'planned' }] });
    ordersApi.update.mockResolvedValue({ data: { id: 3, status: 'in_production' } });

    await useAppStore.getState().sendOrderToProduction(3);

    expect(useAppStore.getState().orders[0].status).toBe('in_production');
  });
});

// ── Counterparties ───────────────────────────────────────────────────────────
describe('addCounterparty', () => {
  it('appends new counterparty to the list', async () => {
    useAppStore.setState({ counterparties: [{ id: 1 }] });
    counterpartiesApi.create.mockResolvedValue({ data: { id: 2, name: 'ООО Ромашка' } });

    const result = await useAppStore.getState().addCounterparty({ name: 'ООО Ромашка' });

    expect(result).toEqual({ id: 2, name: 'ООО Ромашка' });
    expect(useAppStore.getState().counterparties).toHaveLength(2);
    expect(useAppStore.getState().counterparties[1]).toEqual({ id: 2, name: 'ООО Ромашка' });
  });
});

describe('updateCounterparty', () => {
  it('replaces the counterparty with matching id', async () => {
    useAppStore.setState({ counterparties: [{ id: 1, name: 'Старое имя' }] });
    counterpartiesApi.update.mockResolvedValue({ data: { id: 1, name: 'Новое имя' } });

    await useAppStore.getState().updateCounterparty(1, { name: 'Новое имя' });

    expect(useAppStore.getState().counterparties[0].name).toBe('Новое имя');
  });
});

// ── Users ────────────────────────────────────────────────────────────────────
describe('addUser', () => {
  it('appends new user to the list', async () => {
    useAppStore.setState({ users: [] });
    usersApi.create.mockResolvedValue({ data: { id: 10, name: 'Иванов' } });

    await useAppStore.getState().addUser({ name: 'Иванов' });

    expect(useAppStore.getState().users).toHaveLength(1);
    expect(useAppStore.getState().users[0].name).toBe('Иванов');
  });
});

describe('updateUser', () => {
  it('replaces the user with matching id', async () => {
    useAppStore.setState({ users: [{ id: 10, role: 'guest' }] });
    usersApi.update.mockResolvedValue({ data: { id: 10, role: 'admin' } });

    await useAppStore.getState().updateUser(10, { role: 'admin' });

    expect(useAppStore.getState().users[0].role).toBe('admin');
  });
});

describe('deleteUser', () => {
  it('marks user as inactive instead of removing', async () => {
    useAppStore.setState({ users: [{ id: 10, active: true }] });
    usersApi.delete.mockResolvedValue({});

    await useAppStore.getState().deleteUser(10);

    const user = useAppStore.getState().users.find(u => u.id === 10);
    expect(user).toBeDefined();
    expect(user.active).toBe(false);
  });
});

// ── Drivers ──────────────────────────────────────────────────────────────────
describe('addDriver', () => {
  it('appends new driver to the list', async () => {
    useAppStore.setState({ drivers: [] });
    driversApi.create.mockResolvedValue({ data: { id: 1, name: 'Петров' } });

    await useAppStore.getState().addDriver({ name: 'Петров' });

    expect(useAppStore.getState().drivers).toHaveLength(1);
    expect(useAppStore.getState().drivers[0].name).toBe('Петров');
  });
});

describe('updateDriver', () => {
  it('replaces the driver with matching id', async () => {
    useAppStore.setState({ drivers: [{ id: 1, name: 'Старый' }] });
    driversApi.update.mockResolvedValue({ data: { id: 1, name: 'Новый' } });

    await useAppStore.getState().updateDriver(1, { name: 'Новый' });

    expect(useAppStore.getState().drivers[0].name).toBe('Новый');
  });
});

// ── Nomenclature ─────────────────────────────────────────────────────────────
describe('addNomenclatureItem', () => {
  it('adds new item with status active to nomenclature', () => {
    nomenclatureApi.create.mockResolvedValue({});
    const initialLen = useAppStore.getState().nomenclature.length;

    const result = useAppStore.getState().addNomenclatureItem({ name: 'Стул Люкс', price: 5000 });

    expect(result.name).toBe('Стул Люкс');
    expect(result.status).toBe('active');
    expect(result.id).toBeDefined();
    expect(useAppStore.getState().nomenclature).toHaveLength(initialLen + 1);
  });
});

describe('updateNomenclatureItem', () => {
  it('updates the nomenclature item in the list', () => {
    nomenclatureApi.update.mockResolvedValue({});
    const item = useAppStore.getState().addNomenclatureItem({ name: 'Диван Стандарт', price: 10000 });

    useAppStore.getState().updateNomenclatureItem(item.id, { price: 12000 });

    const updated = useAppStore.getState().nomenclature.find(n => n.id === item.id);
    expect(updated.price).toBe(12000);
  });
});

describe('deleteNomenclatureItem', () => {
  it('removes the nomenclature item from the list', () => {
    nomenclatureApi.delete.mockResolvedValue({});
    nomenclatureApi.create.mockResolvedValue({});
    const item = useAppStore.getState().addNomenclatureItem({ name: 'Удаляемый товар', price: 1 });

    useAppStore.getState().deleteNomenclatureItem(item.id);

    const found = useAppStore.getState().nomenclature.find(n => n.id === item.id);
    expect(found).toBeUndefined();
  });
});

describe('discontinueNomenclatureItem / restoreNomenclatureItem', () => {
  it('toggles item status between active and discontinued', () => {
    nomenclatureApi.create.mockResolvedValue({});
    nomenclatureApi.update.mockResolvedValue({});
    const item = useAppStore.getState().addNomenclatureItem({ name: 'Кресло', price: 3000 });

    useAppStore.getState().discontinueNomenclatureItem(item.id);
    let found = useAppStore.getState().nomenclature.find(n => n.id === item.id);
    expect(found.status).toBe('discontinued');

    useAppStore.getState().restoreNomenclatureItem(item.id);
    found = useAppStore.getState().nomenclature.find(n => n.id === item.id);
    expect(found.status).toBe('active');
  });
});
