import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressBar from './ProgressBar';

describe('ProgressBar', () => {
  it('renders the percentage label', () => {
    render(<ProgressBar value={50} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('clamps value above 100 to 100%', () => {
    render(<ProgressBar value={150} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('clamps negative values to 0%', () => {
    render(<ProgressBar value={-10} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('rounds fractional values', () => {
    render(<ProgressBar value={33.6} />);
    expect(screen.getByText('34%')).toBeInTheDocument();
  });

  it('applies green color for value >= 80', () => {
    const { container } = render(<ProgressBar value={80} />);
    const bar = container.querySelector('.bg-green-500');
    expect(bar).toBeInTheDocument();
  });

  it('applies blue color for value in [40, 79]', () => {
    const { container } = render(<ProgressBar value={60} />);
    const bar = container.querySelector('.bg-blue-500');
    expect(bar).toBeInTheDocument();
  });

  it('applies gray color for value < 40', () => {
    const { container } = render(<ProgressBar value={20} />);
    const bar = container.querySelector('.bg-gray-300');
    expect(bar).toBeInTheDocument();
  });

  it('sets the inner bar width via inline style', () => {
    const { container } = render(<ProgressBar value={75} />);
    const bar = container.querySelector('.bg-blue-500');
    expect(bar.style.width).toBe('75%');
  });

  it('renders 0% bar with correct width style', () => {
    const { container } = render(<ProgressBar value={0} />);
    const bar = container.querySelector('.bg-gray-300');
    expect(bar.style.width).toBe('0%');
  });
});
