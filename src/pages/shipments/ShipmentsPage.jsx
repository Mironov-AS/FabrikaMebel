import { useState } from 'react';
import { Truck, Plus, AlertCircle } from 'lucide-react';
import useAppStore from '../../store/appStore';
import { formatMoney } from '../../data/mockData';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';

const TODAY = new Date(2026, 3, 6);

function isOverdue(paymentDueDate, paidAmount, amount) {
  if (paidAmount >= amount) return false;
  return new Date(paymentDueDate) < TODAY;
}

function daysDiff(dateStr) {
  const d = new Date(dateStr);
  return Math.floor((TODAY - d) / (1000 * 60 * 60 * 24));
}

const emptyShipmentForm = {
  date: '',
  orderId: '',
  invoiceNumber: '',
  amount: '',
  itemQty: '',
};

export default function ShipmentsPage() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyShipmentForm);

  const { shipments, orders, counterparties, addShipment } = useAppStore();

  const getCounterparty = (id) => counterparties.find((c) => c.id === id);
  const getOrder = (id) => orders.find((o) => o.id === id);

  const shipmentsWithMeta = shipments.map((s) => ({
    ...s,
    overdue: isOverdue(s.paymentDueDate, s.paidAmount, s.amount),
    counterparty: getCounterparty(s.counterpartyId),
    order: getOrder(s.orderId),
  }));

  function handleSubmit() {
    if (!form.orderId || !form.invoiceNumber || !form.amount) return;
    const order = getOrder(Number(form.orderId));
    addShipment({
      orderId: order.id,
      orderNumber: order.number,
      counterpartyId: order.counterpartyId,
      date: form.date || new Date().toISOString().slice(0, 10),
      invoiceNumber: form.invoiceNumber,
      amount: Number(form.amount),
      items: [{ name: 'Позиция', quantity: Number(form.itemQty) || 1, price: Number(form.amount) }],
      status: 'shipped',
      paymentDueDate: '',
      paidAmount: 0,
      paidDate: null,
    });
    setForm(emptyShipmentForm);
    setShowModal(false);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Отгрузки</h1>
          <p className="text-sm text-gray-500 mt-0.5">Реестр отгрузок по заказам</p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} />
          Зарегистрировать отгрузку
        </button>
      </div>

      {/* Shipments table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Дата', 'Накладная', 'Заказ', 'Контрагент', 'Номенклатура', 'Сумма', 'Статус оплаты', 'Срок оплаты'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shipmentsWithMeta.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    Нет данных
                  </td>
                </tr>
              ) : (
                shipmentsWithMeta.map((s) => (
                  <tr
                    key={s.id}
                    className={s.overdue ? 'bg-red-50' : 'hover:bg-gray-50 transition-colors'}
                  >
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{s.date}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{s.invoiceNumber}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{s.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{s.counterparty?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                      <ul className="space-y-0.5">
                        {s.items.map((item, i) => (
                          <li key={i} className="truncate text-xs">
                            {item.name} × {item.quantity}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{formatMoney(s.amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={s.paidAmount >= s.amount ? 'paid' : s.overdue ? 'overdue' : 'pending'} />
                        {s.overdue && (
                          <span className="text-xs text-red-600 flex items-center gap-1">
                            <AlertCircle size={11} />
                            {daysDiff(s.paymentDueDate)} дн. просрочки
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{s.paymentDueDate || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Register Shipment */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setForm(emptyShipmentForm); }}
        title="Зарегистрировать отгрузку"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowModal(false)}>Отмена</button>
            <button className="btn-primary" onClick={handleSubmit}>Сохранить</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Дата отгрузки</label>
            <input
              type="date"
              className="form-input"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Заказ</label>
            <select
              className="form-input"
              value={form.orderId}
              onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value }))}
            >
              <option value="">— Выберите заказ —</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.number} — {counterparties.find((c) => c.id === o.counterpartyId)?.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Номер накладной</label>
            <input
              type="text"
              className="form-input"
              placeholder="ТН-2026-XXXX"
              value={form.invoiceNumber}
              onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Количество позиций</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={form.itemQty}
              onChange={(e) => setForm((f) => ({ ...f, itemQty: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Сумма отгрузки (₽)</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
