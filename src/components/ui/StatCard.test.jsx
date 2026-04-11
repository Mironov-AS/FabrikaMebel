import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendingUp } from 'lucide-react';
import StatCard from './StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total Contracts" value={42} color="blue" />);
    expect(screen.getByText('Total Contracts')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders the icon when provided', () => {
    const { container } = render(
      <StatCard icon={TrendingUp} label="Revenue" value="100k" color="green" />
    );
    // lucide renders an svg
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders without icon when icon prop is omitted', () => {
    const { container } = render(<StatCard label="Count" value={5} color="blue" />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders trend text when provided', () => {
    render(<StatCard label="Orders" value={10} trend="+5%" color="blue" />);
    expect(screen.getByText('+5%')).toBeInTheDocument();
  });

  it('does not render trend when omitted', () => {
    render(<StatCard label="Orders" value={10} color="blue" />);
    expect(screen.queryByText(/\+/)).toBeNull();
    expect(screen.queryByText(/-/)).toBeNull();
  });

  it('applies red text class for negative trend', () => {
    const { container } = render(<StatCard label="X" value={0} trend="-3%" color="blue" />);
    const trendEl = container.querySelector('.text-red-500');
    expect(trendEl).toBeInTheDocument();
    expect(trendEl.textContent).toBe('-3%');
  });

  it('applies positive trend color (not red) for non-negative trend', () => {
    const { container } = render(<StatCard label="X" value={0} trend="+10%" color="green" />);
    expect(container.querySelector('.text-red-500')).toBeNull();
    expect(container.querySelector('.text-green-600')).toBeInTheDocument();
  });

  it('defaults to blue color when color prop is omitted', () => {
    const { container } = render(<StatCard icon={TrendingUp} label="X" value={1} />);
    expect(container.querySelector('.bg-blue-50')).toBeInTheDocument();
    expect(container.querySelector('.text-blue-600')).toBeInTheDocument();
  });

  it('applies correct background for unknown color (falls back to blue)', () => {
    const { container } = render(<StatCard icon={TrendingUp} label="X" value={1} color="purple" />);
    // COLOR_MAP has no purple → falls back to blue
    expect(container.querySelector('.bg-blue-50')).toBeInTheDocument();
  });

  it.each(['blue', 'green', 'red', 'yellow'])('applies correct bg class for color="%s"', (color) => {
    const { container } = render(<StatCard icon={TrendingUp} label="X" value={1} color={color} />);
    expect(container.querySelector(`.bg-${color}-50`)).toBeInTheDocument();
  });
});
