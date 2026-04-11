import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Tab from './Tabs';

describe('Tab', () => {
  it('renders the label', () => {
    render(<Tab label="Позиции" active={false} onClick={vi.fn()} />);
    expect(screen.getByText('Позиции')).toBeInTheDocument();
  });

  it('renders a button element', () => {
    render(<Tab label="Test" active={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Tab label="Click me" active={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies active styles when active=true', () => {
    const { container } = render(<Tab label="Active" active={true} onClick={vi.fn()} />);
    expect(container.firstChild).toHaveClass('border-blue-600');
    expect(container.firstChild).toHaveClass('text-blue-600');
  });

  it('applies inactive styles when active=false', () => {
    const { container } = render(<Tab label="Inactive" active={false} onClick={vi.fn()} />);
    expect(container.firstChild).toHaveClass('border-transparent');
    expect(container.firstChild).toHaveClass('text-gray-500');
  });

  it('does not render count badge when count is not provided', () => {
    render(<Tab label="No count" active={false} onClick={vi.fn()} />);
    // No span badge should appear
    const spans = screen.queryAllByText(/^\d+$/);
    expect(spans).toHaveLength(0);
  });

  it('renders count badge when count is 0', () => {
    render(<Tab label="With zero" active={false} onClick={vi.fn()} count={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders count badge with correct value', () => {
    render(<Tab label="Заказы" active={false} onClick={vi.fn()} count={7} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('applies active badge styles when active=true and count provided', () => {
    render(<Tab label="X" active={true} onClick={vi.fn()} count={3} />);
    const badge = screen.getByText('3');
    expect(badge).toHaveClass('bg-blue-100');
    expect(badge).toHaveClass('text-blue-700');
  });

  it('applies inactive badge styles when active=false and count provided', () => {
    render(<Tab label="X" active={false} onClick={vi.fn()} count={3} />);
    const badge = screen.getByText('3');
    expect(badge).toHaveClass('bg-gray-100');
    expect(badge).toHaveClass('text-gray-600');
  });
});
