import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from './StatusBadge';
import { STATUS_MAP, STATUS_LABELS } from '../../constants/statuses';

describe('StatusBadge', () => {
  it('renders the Russian label for a known status', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Активен')).toBeInTheDocument();
  });

  it('applies the correct CSS class for a known status', () => {
    const { container } = render(<StatusBadge status="active" />);
    expect(container.firstChild).toHaveClass('badge-green');
  });

  it('renders the raw status string for an unknown status', () => {
    render(<StatusBadge status="unknown_xyz" />);
    expect(screen.getByText('unknown_xyz')).toBeInTheDocument();
  });

  it('applies badge-gray class for an unknown status', () => {
    const { container } = render(<StatusBadge status="unknown_xyz" />);
    expect(container.firstChild).toHaveClass('badge-gray');
  });

  it.each(Object.keys(STATUS_MAP))('renders correctly for status "%s"', (status) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(container.firstChild).toHaveClass(STATUS_MAP[status]);
    expect(screen.getByText(STATUS_LABELS[status])).toBeInTheDocument();
  });

  it('renders a <span> element', () => {
    const { container } = render(<StatusBadge status="paid" />);
    expect(container.firstChild?.tagName).toBe('SPAN');
  });
});
