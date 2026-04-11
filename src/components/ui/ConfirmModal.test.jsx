import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ConfirmModal from './ConfirmModal';

afterEach(cleanup);

const base = {
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  title: 'Delete item',
  message: 'Are you sure?',
};

describe('ConfirmModal rendering', () => {
  it('renders nothing when isOpen is false', () => {
    render(<ConfirmModal {...base} isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the title', () => {
    render(<ConfirmModal {...base} />);
    expect(screen.getByText('Delete item')).toBeInTheDocument();
  });

  it('renders the message', () => {
    render(<ConfirmModal {...base} />);
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders subMessage when provided', () => {
    render(<ConfirmModal {...base} subMessage="This cannot be undone." />);
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('does not render subMessage when omitted', () => {
    render(<ConfirmModal {...base} />);
    expect(screen.queryByText('This cannot be undone.')).toBeNull();
  });

  it('renders serverError when provided', () => {
    render(<ConfirmModal {...base} serverError="Server failed" />);
    expect(screen.getByText('Server failed')).toBeInTheDocument();
  });

  it('does not render serverError block when empty', () => {
    render(<ConfirmModal {...base} serverError="" />);
    expect(screen.queryByText('Server failed')).toBeNull();
  });

  it('renders default confirm label "Подтвердить"', () => {
    render(<ConfirmModal {...base} />);
    expect(screen.getByText('Подтвердить')).toBeInTheDocument();
  });

  it('renders custom confirmLabel', () => {
    render(<ConfirmModal {...base} confirmLabel="Удалить" />);
    expect(screen.getByText('Удалить')).toBeInTheDocument();
  });

  it('renders "Загрузка..." when loading is true', () => {
    render(<ConfirmModal {...base} loading={true} />);
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();
  });

  it('disables confirm button when loading', () => {
    render(<ConfirmModal {...base} loading={true} />);
    expect(screen.getByText('Загрузка...')).toBeDisabled();
  });
});

describe('ConfirmModal interactions', () => {
  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...base} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Подтвердить'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<ConfirmModal {...base} onClose={onClose} />);
    fireEvent.click(screen.getByText('Отмена'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<ConfirmModal {...base} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
