import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Sidebar from './Sidebar';
import useAppStore from '../../store/appStore';

vi.mock('../../store/appStore');

function renderSidebar(props = {}, currentService = null) {
  useAppStore.mockReturnValue(currentService);
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Sidebar isCollapsed={false} onToggle={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ContractPro logo when expanded', () => {
    renderSidebar();
    expect(screen.getByText('ContractPro')).toBeInTheDocument();
  });

  it('hides logo text when collapsed', () => {
    renderSidebar({ isCollapsed: true });
    expect(screen.queryByText('ContractPro')).not.toBeInTheDocument();
  });

  it('renders navigation items', () => {
    renderSidebar();
    // Should have navigation links
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
  });

  it('renders collapse/expand button', () => {
    renderSidebar();
    expect(screen.getByTitle('Свернуть меню')).toBeInTheDocument();
  });

  it('shows expand button when collapsed', () => {
    renderSidebar({ isCollapsed: true });
    expect(screen.getByTitle('Развернуть меню')).toBeInTheDocument();
  });

  it('calls onToggle when collapse button clicked', () => {
    const onToggle = vi.fn();
    renderSidebar({ onToggle });
    fireEvent.click(screen.getByTitle('Свернуть меню'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders "На главную" button', () => {
    renderSidebar();
    expect(screen.getAllByText('На главную').length).toBeGreaterThan(0);
  });
});
