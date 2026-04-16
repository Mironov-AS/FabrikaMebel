import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import HomePage from './HomePage';
import useAppStore from '../store/appStore';

vi.mock('../store/appStore');

const mockSetService = vi.fn();
const mockClearService = vi.fn();

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderHomePage() {
  useAppStore.mockImplementation((selector) => {
    const store = {
      setService: mockSetService,
      clearService: mockClearService,
    };
    return selector ? selector(store) : store;
  });
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
}

describe('HomePage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders page title', () => {
    renderHomePage();
    expect(screen.getByText('Выберите рабочее место')).toBeInTheDocument();
  });

  it('renders ContractPro logo', () => {
    renderHomePage();
    expect(screen.getByText('ContractPro')).toBeInTheDocument();
  });

  it('renders service selection buttons', () => {
    renderHomePage();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('calls clearService on mount', () => {
    renderHomePage();
    expect(mockClearService).toHaveBeenCalledTimes(1);
  });

  it('calls setService and navigate when service selected', () => {
    renderHomePage();
    const buttons = screen.getAllByRole('button');
    if (buttons.length > 0) {
      fireEvent.click(buttons[0]);
      expect(mockSetService).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    }
  });

  it('renders footer text', () => {
    renderHomePage();
    expect(screen.getByText(/ContractPro — система управления/i)).toBeInTheDocument();
  });
});
