import { useState } from 'react';
import { CreditCard, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import useAppStore from '../../store/appStore';
import { COUNTERPARTIES, formatMoney } from '../../data/mockData';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import StatCard from '../../components/ui/StatCard';

const TODAY = new Date(2026, 3, 6);

function daysDiff(dateStr) {
  const d = new Date(dateStr);
  return Math.floor((TODAY - d) / (1000 * 60 * 60 * 24));
}

const emptyPaymentForm = {
  amount: '',
  date: '',
  note: '',
};

export default function PaymentsPage() {
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);

  const { payments, registerPayment } = useAppStore();

  const getCounterparty = (id) => COUNTERPARTIES.find((c) => c.id === id);

  // Summary
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

  const calcPenalty = (payment) => {
    if (payment.status !== 'overdue') return 0;
    const days = daysDiff(payment.dueDate);
    return Math.max(0, days) * payment.amount * 0.001;
  };

  function handlePaymentSubmit() {
    if (!paymentModal || !paymentForm.amount) return;
    registerPayment(
      paymentModal.id,
      Number(paymentForm.amount),
      paymentForm.date || new Date().toISOString().slice(0, 10),
    );
    setPaymentModal(null);
    setPaymentForm(emptyPaymentForm);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Платежи</h1>
        <p className="text-sm text-gray-500 mt-0.5">График платежей и контроль задолженностей</p>
      </div>

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

      {/* Payments table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Контрагент', 'Счёт', 'Сумма', 'Срок', 'Оплачено', 'Статус', 'Штраф', ''].map((h) => (
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
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    Нет данных
                  </td>
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
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {penalty > 0 ? (
                          <span className="text-red-600 font-semibold text-xs">
                            {formatMoney(penalty)}
                            <br />
                            <span className="text-gray-500 font-normal">{daysDiff(p.dueDate)} дн.</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {p.status !== 'paid' && (
                          <button
                            className="btn-secondary text-xs py-1 px-2"
                            onClick={() => {
                              setPaymentModal(p);
                              setPaymentForm({ ...emptyPaymentForm, amount: String(p.amount) });
                            }}
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

      {/* Modal: Register Payment */}
      <Modal
        isOpen={!!paymentModal}
        onClose={() => {
          setPaymentModal(null);
          setPaymentForm(emptyPaymentForm);
        }}
        title="Зарегистрировать оплату"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setPaymentModal(null)}>
              Отмена
            </button>
            <button className="btn-primary" onClick={handlePaymentSubmit}>
              Сохранить
            </button>
          </>
        }
      >
        {paymentModal && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 space-y-1">
              <p>
                <span className="font-medium">Счёт:</span> {paymentModal.invoiceNumber}
              </p>
              <p>
                <span className="font-medium">Сумма к оплате:</span> {formatMoney(paymentModal.amount)}
              </p>
              {paymentModal.status === 'overdue' && (
                <p className="text-red-600">
                  <span className="font-medium">Штраф:</span> {formatMoney(calcPenalty(paymentModal))}
                </p>
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
