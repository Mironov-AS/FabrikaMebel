import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { formatMoney } from '../../data/mockData';

export default function AddPaymentModal({ isOpen, onClose, invoice, onSave }) {
  const [form, setForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (invoice && isOpen) {
      const remaining = invoice.amount - invoice.paidAmount;
      setForm({ amount: String(remaining > 0 ? remaining.toFixed(2) : ''), date: new Date().toISOString().slice(0, 10), notes: '' });
      setErrors({});
    }
  }, [invoice?.id, isOpen]);

  const remaining = invoice ? invoice.amount - invoice.paidAmount : 0;

  const handleSave = () => {
    const errs = {};
    const amt = Number(form.amount);
    if (!amt || amt <= 0) errs.amount = 'Введите корректную сумму';
    else if (amt > remaining + 0.01) errs.amount = `Не может превышать остаток ${formatMoney(remaining)}`;
    if (!form.date) errs.date = 'Укажите дату оплаты';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave(invoice.id, amt, form.date, form.notes);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Зарегистрировать оплату"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={handleSave}>Сохранить</button>
        </>
      }
    >
      {invoice && (
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
            <p><span className="font-medium">Счёт:</span> {invoice.invoiceNumber}</p>
            <p><span className="font-medium">Всего по счёту:</span> {formatMoney(invoice.amount)}</p>
            <p><span className="font-medium">Уже оплачено:</span> <span className="text-green-700">{formatMoney(invoice.paidAmount)}</span></p>
            <p><span className="font-medium">Остаток:</span> <span className={remaining > 0 ? 'text-orange-600 font-semibold' : 'text-green-600'}>{formatMoney(remaining)}</span></p>
          </div>
          <div>
            <label className="form-label">Сумма оплаты (₽) <span className="text-red-500">*</span></label>
            <input
              type="number" min={0.01} step={0.01}
              className={`form-input${errors.amount ? ' border-red-400' : ''}`}
              value={form.amount}
              onChange={e => { setForm(f => ({ ...f, amount: e.target.value })); setErrors(e => ({ ...e, amount: '' })); }}
            />
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
          </div>
          <div>
            <label className="form-label">Дата оплаты <span className="text-red-500">*</span></label>
            <input
              type="date"
              className={`form-input${errors.date ? ' border-red-400' : ''}`}
              value={form.date}
              onChange={e => { setForm(f => ({ ...f, date: e.target.value })); setErrors(e => ({ ...e, date: '' })); }}
            />
            {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
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
