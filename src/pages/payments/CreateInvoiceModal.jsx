import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { formatMoney } from '../../data/mockData';

export default function CreateInvoiceModal({ isOpen, onClose, order, contracts, onSave }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ invoiceNumber: '', invoiceDate: today, dueDate: '', notes: '' });
  const [errors, setErrors] = useState({});

  const contract = order ? contracts.find(c => c.id === (order.contractId || order.contract_id)) : null;
  const paymentDelay = contract?.paymentDelay ?? contract?.payment_delay ?? 30;

  const calcDueDate = (invoiceDate) => {
    if (!invoiceDate) return '';
    const base = new Date(invoiceDate);
    base.setDate(base.getDate() + paymentDelay);
    return base.toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (order && isOpen) {
      setForm({ invoiceNumber: '', invoiceDate: today, dueDate: calcDueDate(today), notes: '' });
      setErrors({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, isOpen]);

  const handleInvoiceDateChange = (e) => {
    const invoiceDate = e.target.value;
    setForm(f => ({ ...f, invoiceDate, dueDate: calcDueDate(invoiceDate) }));
    setErrors(err => ({ ...err, invoiceDate: '' }));
  };

  const handleSave = () => {
    const errs = {};
    if (!form.invoiceNumber.trim()) errs.invoiceNumber = 'Укажите номер счёта';
    if (!form.invoiceDate) errs.invoiceDate = 'Укажите дату счёта';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave({
      orderId: order.id,
      invoiceNumber: form.invoiceNumber.trim(),
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate || undefined,
      amount: order.totalAmount || order.total_amount || 0,
      notes: form.notes,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Создать счёт на заказ"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={handleSave}>Создать</button>
        </>
      }
    >
      {order && (
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
            <p><span className="font-medium">Заказ:</span> {order.number}</p>
            <p><span className="font-medium">Сумма заказа:</span> {formatMoney(order.totalAmount || order.total_amount || 0)}</p>
            {contract && (
              <p><span className="font-medium">Отсрочка по договору:</span> {paymentDelay} дн.</p>
            )}
          </div>
          <div>
            <label className="form-label">Номер счёта <span className="text-red-500">*</span></label>
            <input
              className={`form-input${errors.invoiceNumber ? ' border-red-400' : ''}`}
              placeholder="Например: СЧ-2024-001"
              value={form.invoiceNumber}
              onChange={e => { setForm(f => ({ ...f, invoiceNumber: e.target.value })); setErrors(e => ({ ...e, invoiceNumber: '' })); }}
            />
            {errors.invoiceNumber && <p className="text-red-500 text-xs mt-1">{errors.invoiceNumber}</p>}
          </div>
          <div>
            <label className="form-label">Дата счёта <span className="text-red-500">*</span></label>
            <input
              type="date"
              className={`form-input${errors.invoiceDate ? ' border-red-400' : ''}`}
              value={form.invoiceDate}
              onChange={handleInvoiceDateChange}
            />
            {errors.invoiceDate && <p className="text-red-500 text-xs mt-1">{errors.invoiceDate}</p>}
          </div>
          <div>
            <label className="form-label">
              Срок оплаты
              {contract && <span className="text-gray-400 font-normal ml-1">(дата счёта + {paymentDelay} дн.)</span>}
            </label>
            <input
              type="date" className="form-input"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Примечание</label>
            <textarea
              className="form-input resize-none" rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
