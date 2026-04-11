import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

/**
 * A reusable confirmation dialog for destructive actions (delete, discontinue, etc.).
 *
 * @param {boolean}   isOpen
 * @param {function}  onClose
 * @param {function}  onConfirm
 * @param {string}    title
 * @param {ReactNode} message       - main body text (can include JSX)
 * @param {string}    [subMessage]  - secondary hint text
 * @param {string}    [confirmLabel]
 * @param {string}    [confirmClassName] - CSS class for confirm button (default: btn-danger)
 * @param {boolean}   [loading]
 * @param {string}    [serverError]
 * @param {Component} [icon]        - lucide icon component (default: AlertTriangle)
 * @param {string}    [iconBgClass]
 * @param {string}    [iconColorClass]
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  subMessage,
  confirmLabel = 'Подтвердить',
  confirmClassName = 'btn-danger',
  loading = false,
  serverError = '',
  icon: Icon = AlertTriangle,
  iconBgClass = 'bg-red-100',
  iconColorClass = 'text-red-600',
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className={confirmClassName} onClick={onConfirm} disabled={loading}>
            {loading ? 'Загрузка...' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className={`w-10 h-10 rounded-full ${iconBgClass} flex items-center justify-center flex-shrink-0`}>
          <Icon size={18} className={iconColorClass} />
        </div>
        <div>
          <p className="text-sm text-gray-700">{message}</p>
          {subMessage && <p className="text-xs text-gray-500 mt-1">{subMessage}</p>}
          {serverError && (
            <p className="mt-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{serverError}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
