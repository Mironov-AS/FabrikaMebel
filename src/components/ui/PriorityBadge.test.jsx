import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PriorityBadge, { PRIORITY_MAP } from './PriorityBadge';

describe('PriorityBadge', () => {
  it('renders "Высокий" for high priority', () => {
    render(<PriorityBadge priority="high" />);
    expect(screen.getByText('Высокий')).toBeInTheDocument();
  });

  it('renders "Средний" for medium priority', () => {
    render(<PriorityBadge priority="medium" />);
    expect(screen.getByText('Средний')).toBeInTheDocument();
  });

  it('renders "Низкий" for low priority', () => {
    render(<PriorityBadge priority="low" />);
    expect(screen.getByText('Низкий')).toBeInTheDocument();
  });

  it('applies badge-red class for high priority', () => {
    const { container } = render(<PriorityBadge priority="high" />);
    expect(container.firstChild).toHaveClass('badge-red');
  });

  it('applies badge-yellow class for medium priority', () => {
    const { container } = render(<PriorityBadge priority="medium" />);
    expect(container.firstChild).toHaveClass('badge-yellow');
  });

  it('applies badge-green class for low priority', () => {
    const { container } = render(<PriorityBadge priority="low" />);
    expect(container.firstChild).toHaveClass('badge-green');
  });

  it('renders the raw priority and badge-gray for unknown value', () => {
    const { container } = render(<PriorityBadge priority="critical" />);
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('badge-gray');
  });

  it('renders a <span> element', () => {
    const { container } = render(<PriorityBadge priority="high" />);
    expect(container.firstChild?.tagName).toBe('SPAN');
  });

  it.each(Object.keys(PRIORITY_MAP))('renders correctly for priority "%s"', (priority) => {
    const { container } = render(<PriorityBadge priority={priority} />);
    expect(container.firstChild).toHaveClass(PRIORITY_MAP[priority].cls);
    expect(screen.getByText(PRIORITY_MAP[priority].label)).toBeInTheDocument();
  });
});
