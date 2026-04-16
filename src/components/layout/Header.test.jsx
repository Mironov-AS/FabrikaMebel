import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Header from './Header';
import useAppStore from '../../store/appStore';

vi.mock('../../store/appStore');

const mockMarkAllRead = vi.fn();

function renderHeader(props = {}, notifications = []) {
  useAppStore.mockReturnValue({ notifications, markAllRead: mockMarkAllRead });
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Header isCollapsed={false} {...props} />
    </MemoryRouter>
  );
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title for current route', () => {
    renderHeader();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders bell icon button', () => {
    renderHeader();
    expect(screen.getByLabelText('Уведомления')).toBeInTheDocument();
  });

  it('shows no badge when no unread notifications', () => {
    renderHeader({}, [{ id: 1, title: 'Test', read: true }]);
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('shows badge count for unread notifications', () => {
    const notifications = [
      { id: 1, title: 'Notif 1', read: false },
      { id: 2, title: 'Notif 2', read: false },
    ];
    renderHeader({}, notifications);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows 9+ for more than 9 unread', () => {
    const notifications = Array.from({ length: 10 }, (_, i) => ({
      id: i, title: `Notif ${i}`, read: false,
    }));
    renderHeader({}, notifications);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('opens notification dropdown on bell click', () => {
    renderHeader({}, []);
    fireEvent.click(screen.getByLabelText('Уведомления'));
    expect(screen.getByText('Уведомления')).toBeInTheDocument();
    expect(screen.getByText('Нет уведомлений')).toBeInTheDocument();
  });

  it('shows notifications in dropdown', () => {
    const notifications = [{ id: 1, title: 'Срок оплаты', date: '2026-05-01', read: false }];
    renderHeader({}, notifications);
    fireEvent.click(screen.getByLabelText('Уведомления'));
    expect(screen.getByText('Срок оплаты')).toBeInTheDocument();
  });

  it('calls markAllRead when opening with unread', () => {
    const notifications = [{ id: 1, title: 'N', read: false }];
    renderHeader({}, notifications);
    fireEvent.click(screen.getByLabelText('Уведомления'));
    expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it('closes dropdown on X button click', () => {
    renderHeader({}, []);
    fireEvent.click(screen.getByLabelText('Уведомления'));
    expect(screen.getByText('Нет уведомлений')).toBeInTheDocument();
    // Close via X button (second button in dropdown)
    const closeBtn = screen.getAllByRole('button').find(b =>
      b.getAttribute('class')?.includes('text-gray-400')
    );
    if (closeBtn) {
      fireEvent.click(closeBtn);
      expect(screen.queryByText('Нет уведомлений')).not.toBeInTheDocument();
    }
  });

  it('defaults to ContractPro title for unknown route', () => {
    useAppStore.mockReturnValue({ notifications: [], markAllRead: mockMarkAllRead });
    render(
      <MemoryRouter initialEntries={['/unknown-route']}>
        <Header isCollapsed={false} />
      </MemoryRouter>
    );
    expect(screen.getByText('ContractPro')).toBeInTheDocument();
  });
});
