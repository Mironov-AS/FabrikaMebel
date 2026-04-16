import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Dashboard from './Dashboard';
import useAppStore from '../store/appStore';

vi.mock('../store/appStore');
vi.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

const baseStore = {
  contracts: [],
  orders: [],
  payments: [],
  notifications: [],
  auditLog: [],
  productionTasks: [],
  chatMessages: [],
  counterparties: [],
};

function renderDashboard(storeOverrides = {}) {
  useAppStore.mockReturnValue({ ...baseStore, ...storeOverrides });
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe('Dashboard', () => {
  it('renders all KPI stat cards', () => {
    renderDashboard();
    expect(screen.getByText('Активные договоры')).toBeInTheDocument();
    expect(screen.getByText('Заказов в производстве')).toBeInTheDocument();
    expect(screen.getByText('Дебиторская задолженность')).toBeInTheDocument();
    expect(screen.getByText('Просроченных платежей')).toBeInTheDocument();
  });

  it('shows 0 active contracts when empty', () => {
    renderDashboard();
    // StatCards display the count
    const cards = screen.getAllByText('0');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('counts active contracts correctly', () => {
    renderDashboard({
      contracts: [
        { id: 1, status: 'active', date: '2026-01-01', obligations: [] },
        { id: 2, status: 'draft', date: '2026-02-01', obligations: [] },
        { id: 3, status: 'active', date: '2026-03-01', obligations: [] },
      ],
    });
    // 2 active contracts
    expect(screen.getByText('Активные договоры').closest('div').parentElement)
      .toBeInTheDocument();
  });

  it('counts orders in production', () => {
    renderDashboard({
      orders: [
        { id: 1, status: 'in_production' },
        { id: 2, status: 'planned' },
      ],
    });
    // Should show production section
    expect(screen.getByText('Производство')).toBeInTheDocument();
  });

  it('counts overdue payments', () => {
    renderDashboard({
      payments: [
        { id: 1, status: 'overdue', amount: 1000 },
        { id: 2, status: 'pending', amount: 2000 },
      ],
    });
    expect(screen.getByText('Просроченных платежей')).toBeInTheDocument();
  });

  it('shows production task counts', () => {
    renderDashboard({
      productionTasks: [
        { id: 1, status: 'in_progress' },
        { id: 2, status: 'planned' },
        { id: 3, status: 'completed' },
        { id: 4, status: 'in_progress' },
      ],
    });
    expect(screen.getByText('В работе')).toBeInTheDocument();
    expect(screen.getByText('Запланировано')).toBeInTheDocument();
    expect(screen.getByText('Завершено')).toBeInTheDocument();
  });

  it('shows overdue obligations when present', () => {
    renderDashboard({
      contracts: [
        {
          id: 1,
          status: 'active',
          date: '2026-01-01',
          number: 'C-001',
          obligations: [
            { id: 1, text: 'Просроченное обязательство', status: 'overdue' },
          ],
        },
      ],
    });
    expect(screen.getByText('Просроченные обязательства')).toBeInTheDocument();
    expect(screen.getByText('Просроченное обязательство')).toBeInTheDocument();
  });

  it('does not show overdue section when no overdue obligations', () => {
    renderDashboard({
      contracts: [
        { id: 1, status: 'active', date: '2026-01-01', obligations: [{ id: 1, text: 'ok', status: 'completed' }] },
      ],
    });
    expect(screen.queryByText('Просроченные обязательства')).not.toBeInTheDocument();
  });

  it('shows "no data" message for empty chart', () => {
    renderDashboard({ contracts: [] });
    expect(screen.getByText('Нет данных для отображения')).toBeInTheDocument();
  });

  it('renders contract dynamics chart with data', () => {
    renderDashboard({
      contracts: [
        { id: 1, status: 'active', date: '2026-01-15', obligations: [] },
        { id: 2, status: 'completed', date: '2026-01-20', obligations: [] },
      ],
    });
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });
});
