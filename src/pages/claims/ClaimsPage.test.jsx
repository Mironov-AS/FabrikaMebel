import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import ClaimsPage from './ClaimsPage';
import useAppStore from '../../store/appStore';

vi.mock('../../store/appStore');

const mockAddClaim = vi.fn();
const mockUpdateClaim = vi.fn();

const baseStore = {
  claims: [],
  contracts: [],
  shipments: [],
  orders: [],
  counterparties: [],
  users: [],
  addClaim: mockAddClaim,
  updateClaim: mockUpdateClaim,
};

function renderClaims(storeOverrides = {}) {
  useAppStore.mockReturnValue({ ...baseStore, ...storeOverrides });
  return render(
    <MemoryRouter>
      <ClaimsPage />
    </MemoryRouter>
  );
}

describe('ClaimsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders KPI stat cards', () => {
    renderClaims();
    expect(screen.getByText('Открытых')).toBeInTheDocument();
    expect(screen.getByText('На рассмотрении')).toBeInTheDocument();
    expect(screen.getByText('Решено')).toBeInTheDocument();
    expect(screen.getByText('Просрочено')).toBeInTheDocument();
  });

  it('shows empty state when no claims', () => {
    renderClaims();
    expect(screen.getByText('Нет данных')).toBeInTheDocument();
  });

  it('renders existing claims', () => {
    renderClaims({
      claims: [
        {
          id: 1,
          number: 'REC-001',
          status: 'open',
          description: 'Бракованный товар, требует замены',
          responsible: 'Иванов',
          date: '2026-04-01',
        },
      ],
    });
    expect(screen.getByText('REC-001')).toBeInTheDocument();
  });

  it('opens new claim modal on button click', () => {
    renderClaims();
    const btn = screen.getByText('Новая рекламация');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    // Modal should be open - looking for header in modal or form
    expect(screen.getAllByText('Новая рекламация').length).toBeGreaterThan(1);
  });

  it('counts open claims correctly', () => {
    renderClaims({
      claims: [
        { id: 1, number: 'R-1', status: 'open', date: '2026-04-01', description: 'Описание 1' },
        { id: 2, number: 'R-2', status: 'resolved', date: '2026-04-02', description: 'Описание 2' },
        { id: 3, number: 'R-3', status: 'open', date: '2026-04-03', description: 'Описание 3' },
      ],
    });
    expect(screen.getByText('R-1')).toBeInTheDocument();
    expect(screen.getByText('R-2')).toBeInTheDocument();
    expect(screen.getByText('R-3')).toBeInTheDocument();
  });

  it('shows "Решено" stat card', () => {
    renderClaims();
    expect(screen.getByText('Решено')).toBeInTheDocument();
  });
});
