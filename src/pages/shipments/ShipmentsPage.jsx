import { useState } from 'react';
import { Truck, CreditCard, Plus, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import useAppStore from '../../store/appStore';
import { COUNTERPARTIES, CONTRACTS, ORDERS, SHIPMENTS, formatMoney, STATUS_LABELS } from '../../data/mockData';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import StatCard from '../../components/ui/StatCard';

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

const emptyPaymentForm = {
  amount: '',
  date: '',
  note: '',
};

export default function ShipmentsPage() {
  const [activeTab, setActiveTab] = useState('shipments');
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [shipmentForm, setShipmentForm] = useState(emptyShipmentForm);
  const [paymentModal, setPaymentModal] = useState(null); // payment record
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);

  const { shipments, payments, addShipment, registerPayment } = useAppStore();

  const getCounterparty = (id) => COUNTERPARTIES.find((c) => c.id === id);
  const getOrder = (id) => ORDERS.find((o) => o.id === id);

  // ── helpers ────────────────────────────────────────────────
  const shipmentsWithMeta = shipments.map((s) => ({
    ...s,
    overdue: isOverdue(s.paymentDueDate, s.paidAmount, s.amount),
    counterparty: getCounterparty(s.counterpartyId),
    order: getOrder(s.orderId),
  }));

  // Payment schedule summary
  const totalReceivable = payments
    .filter((p) => p.status !== 'paid')
    .reduce((acc, p) => acc + p.amount, 0);

  const overduePayments = payments.filter((p) => p.status === 'overdue');
  const totalOverdue = overduePayments.reduce((acc, p) => acc + p.amount, 0);

  const in7Days = new Date(TODAY);
  in7Days.setDate(in7Days.getDate() + 7);
  const upcomingPayments = payments.filter((p) => {
    if (p.status === 'paid') return false;
    const d = new Date(p.dueDate);
    return d >= TODAY && d <= in7Days;
  });
  const totalUpcoming = upcomingPayments.reduce((acc, p) => acc + p.amount, 0);

  // ── handlers ───────────────────────────────────────────────
  function handleShipmentSubmit() {
    if (!shipmentForm.orderId || !shipmentForm.invoiceNumber || !shipmentForm.amount) return;
    const order = getOrder(Number(shipmentForm.orderId));
    addShipment({
      orderId: order.id,
      orderNumber: order.number,
      counterpartyId: order.counterpartyId,
      date: shipmentForm.date || new Date().toISOString().slice(0, 10),
      invoiceNumber: shipmentForm.invoiceNumber,
      amount: Number(shipmentForm.amount),
      items: [{ name: 'Позиция', quantity: Number(shipmentForm.itemQty) || 1, price: Number(shipmentForm.amount) }],
      status: 'shipped',
      paymentDueDate: '',
      paidAmount: 0,
      paidDate: null,
    });
    setShipmentForm(emptyShipmentForm);
    setShowShipmentModal(false);
  }

  function handlePaymentSubmit() {
    if (!paymentModal || !paymentForm.amount) return;
    registerPayment(paymentModal.id, Number(paymentForm.amount), paymentForm.date || new Date().toISOString().slice(0, 10));
    setPaymentModal(null);
    setPaymentForm(emptyPaymentForm);
  }

  const calcPenalty = (payment) => {
    if (payment.status !== 'overdue') return 0;
    const days = daysDiff(payment.dueDate);
    return Math.max(0, days) * payment.amount * 0.001;
  };

  // ── render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Отгрузки и платежи</h1>
          <p className="text-sm text-gray-500 mt-0.5">Управление отгрузками и графиком платежей</p>
        </div>
        {activeTab === 'shipments' && (
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowShipmentModal(true)}
          >
            <Plus size={16} />
            Зарегистрировать отгрузку
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'shipments', label: 'Отгрузки', icon: Truck },
          { key: 'payments', label: 'График платежей', icon: CreditCard },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Shipments ── */}
      {activeTab === 'shipments' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Дата', 'Накладная', 'Заказ', 'Контрагент', 'Номенклатура', 'Сумма', 'Статус оплаты', 'Срок оплаты'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shipmentsWithMeta.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-400">Нет данных</td>
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
      )}

      {/* ── TAB 2: Payment schedule ── */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={CreditCard}
              label="К получению"
              value={formatMoney(totalReceivable)}
              color="blue"
            />
            <StatCard
              icon={AlertCircle}
              label="Просрочено"
              value={formatMoney(totalOverdue)}
              color="red"
              trend={overduePayments.length > 0 ? `${overduePayments.length} счёт(а)` : undefined}
            />
            <StatCard
              icon={Clock}
              label="Ближайшие 7 дней"
              value={formatMoney(totalUpcoming)}
              color="yellow"
              trend={upcomingPayments.length > 0 ? `${upcomingPayments.length} счёт(а)` : undefined}
            />
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Контрагент', 'Счёт', 'Сумма', 'Срок', 'Оплачено', 'Статус', 'Штраф', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-gray-400">Нет данных</td>
                    </tr>
                  ) : (
                    payments.map((p) => {
                      const cp = getCounterparty(p.counterpartyId);
                      const penalty = calcPenalty(p);
                      const overdue = p.status === 'overdue';
                      return (
                        <tr key={p.id} className={overdue ? 'bg-red-50' : 'hover:bg-gray-50 transition-colors'}>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{cp?.name ?? '—'}</td>
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{p.invoiceNumber}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{formatMoney(p.amount)}</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                            <span className={overdue ? 'text-red-600 font-medium' : ''}>{p.dueDate}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                            {p.paidDate ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle size={13} />
                                {p.paidDate}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={p.status} /></td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {penalty > 0 ? (
                              <span className="text-red-600 font-semibold text-xs">
                                {formatMoney(penalty)}
                                <br />
                                <span className="text-gray-500 font-normal">{daysDiff(p.dueDate)} дн.</span>
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {p.status !== 'paid' && (
                              <button
                                className="btn-secondary text-xs py-1 px-2"
                                onClick={() => { setPaymentModal(p); setPaymentForm({ ...emptyPaymentForm, amount: String(p.amount) }); }}
                              >
                                Зарегистрировать оплату
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Register Shipment ── */}
      <Modal
        isOpen={showShipmentModal}
        onClose={() => { setShowShipmentModal(false); setShipmentForm(emptyShipmentForm); }}
        title="Зарегистрировать отгрузку"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowShipmentModal(false)}>Отмена</button>
            <button className="btn-primary" onClick={handleShipmentSubmit}>Сохранить</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Дата отгрузки</label>
            <input
              type="date"
              className="form-input"
              value={shipmentForm.date}
              onChange={(e) => setShipmentForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Заказ</label>
            <select
              className="form-input"
              value={shipmentForm.orderId}
              onChange={(e) => setShipmentForm((f) => ({ ...f, orderId: e.target.value }))}
            >
              <option value="">— Выберите заказ —</option>
              {ORDERS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.number} — {COUNTERPARTIES.find((c) => c.id === o.counterpartyId)?.name}
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
              value={shipmentForm.invoiceNumber}
              onChange={(e) => setShipmentForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Количество позиций</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={shipmentForm.itemQty}
              onChange={(e) => setShipmentForm((f) => ({ ...f, itemQty: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Сумма отгрузки (₽)</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={shipmentForm.amount}
              onChange={(e) => setShipmentForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal: Register Payment ── */}
      <Modal
        isOpen={!!paymentModal}
        onClose={() => { setPaymentModal(null); setPaymentForm(emptyPaymentForm); }}
        title="Зарегистрировать оплату"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setPaymentModal(null)}>Отмена</button>
            <button className="btn-primary" onClick={handlePaymentSubmit}>Сохранить</button>
          </>
        }
      >
        {paymentModal && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 space-y-1">
              <p><span className="font-medium">Счёт:</span> {paymentModal.invoiceNumber}</p>
              <p><span className="font-medium">Сумма к оплате:</span> {formatMoney(paymentModal.amount)}</p>
              {paymentModal.status === 'overdue' && (
                <p className="text-red-600"><span className="font-medium">Штраф:</span> {formatMoney(calcPenalty(paymentModal))}</p>
              )}
            </div>
            <div>
              <label className="form-label">Сумма оплаты (₽)</label>
              <input
                type="number"
                className="form-input"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Дата оплаты</label>
              <input
                type="date"
                className="form-input"
                value={paymentForm.date}
                onChange={(e) => setPaymentForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Примечание</label>
              <textarea
                className="form-input resize-none"
                rows={2}
                placeholder="Необязательно"
                value={paymentForm.note}
                onChange={(e) => setPaymentForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
