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
  shipmentsApi: { list: vi.fn(), create: vi.fn() },
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
}));

import useAppStore from './appStore';
import {
  contractsApi, ordersApi, shipmentsApi, paymentsApi,
  claimsApi, notificationsApi, productionApi, chatApi,
  auditApi, usersApi, counterpartiesApi,
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
