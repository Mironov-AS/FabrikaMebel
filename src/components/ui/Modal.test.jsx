import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Modal from './Modal';

afterEach(cleanup);

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  title: 'Test Modal',
  children: <p>Modal body</p>,
};

describe('Modal rendering', () => {
  it('renders nothing when isOpen is false', () => {
    render(<Modal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders dialog when isOpen is true', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('displays the title', () => {
    render(<Modal {...defaultProps} title="My Title" />);
    expect(screen.getByText('My Title')).toBeInTheDocument();
  });

  it('renders children inside the dialog', () => {
    render(<Modal {...defaultProps}><span>Child content</span></Modal>);
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders footer when footer prop is provided', () => {
    render(<Modal {...defaultProps} footer={<button>OK</button>} />);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('does not render footer section when footer prop is omitted', () => {
    render(<Modal {...defaultProps} />);
    // No footer button outside the close button
    expect(screen.queryByText('OK')).toBeNull();
  });

  it('has aria-modal="true" on the dialog element', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('close button has aria-label "Закрыть"', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByLabelText('Закрыть')).toBeInTheDocument();
  });
});

describe('Modal interactions', () => {
  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal {...defaultProps} onClose={onClose} />);
    // Backdrop is the absolute div with aria-hidden
    const backdrop = container.querySelector('[aria-hidden="true"]');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for non-Escape keys', () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Modal body scroll lock', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('sets body overflow to hidden when open', () => {
    render(<Modal {...defaultProps} isOpen={true} />);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body overflow when closed', () => {
    const { rerender } = render(<Modal {...defaultProps} isOpen={true} />);
    rerender(<Modal {...defaultProps} isOpen={false} />);
    expect(document.body.style.overflow).toBe('');
  });
});
