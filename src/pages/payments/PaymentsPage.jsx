import { useState, useEffect } from 'react';
import {
  CreditCard, AlertCircle, Clock, CheckCircle,
  ChevronDown, ChevronRight, Building2, FileText,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import { formatMoney } from '../../data/mockData';
import { daysDiff } from '../../utils/date';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import StatCard from '../../components/ui/StatCard';

const emptyPaymentForm = { amount: '', date: '', note: '' };

const ORDER_PAY_STYLES = {
  paid:        'bg-green-100 text-green-700 border border-green-200',
  overdue:     'bg-red-100 text-red-700 border border-red-200',
  pending:     'bg-yellow-100 text-yellow-700 border border-yellow-200',
  partial:     'bg-blue-100 text-blue-700 border border-blue-200',
  not_shipped: 'bg-gray-100 text-gray-500 border border-gray-200',
};
const ORDER_PAY_LABELS = {
  paid:        'Оплачен',
  overdue:     'Просрочен',
  pending:     'Ожидается',
  partial:     'Частично',
  not_shipped: 'Не отгружен',
};

function OrderPayBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_PAY_STYLES[status] || ORDER_PAY_STYLES.not_shipped}`}>
      {ORDER_PAY_LABELS[status] || status}
    </span>
  );
}

export default function PaymentsPage() {
  const [viewMode, setViewMode] = useState('grouped');
  const [expandedCps, setExpandedCps] = useState(new Set());
  const [expandedContracts, setExpandedContracts] = useState(new Set());
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [paymentFormErrors, setPaymentFormErrors] = useState({});

  const { payments, shipments, orders, contracts, counterparties, registerPayment } = useAppStore();

  // Default: expand all counterparties and contracts
  useEffect(() => {
    if (counterparties.length > 0) setExpandedCps(new Set(counterparties.map(c => c.id)));
  }, [counterparties.length]);
  useEffect(() => {
    if (contracts.length > 0) setExpandedContracts(new Set(contracts.map(c => c.id)));
  }, [contracts.length]);

  // ── Helpers ──────────────────────────────────────────────────────────
  const orderShipments = (orderId) => shipments.filter(s => s.orderId === orderId);
  const shipmentPayments = (shipmentId) => payments.filter(p => p.shipmentId === shipmentId);

  const orderPaymentSummary = (order) => {
    const shs = orderShipments(order.id);
    if (shs.length === 0) return { status: 'not_shipped', shippedAmount: 0, paidAmount: 0, paymentRecords: [] };

    const shippedAmount = shs.reduce((s, sh) => s + sh.amount, 0);
    const paidAmount    = shs.reduce((s, sh) => s + (sh.paidAmount || 0), 0);
    const paymentRecords = shs.flatMap(sh => shipmentPayments(sh.id).map(p => ({ ...p, shipment: sh })));

    let status;
    if (shippedAmount > 0 && paidAmount >= shippedAmount)          status = 'paid';
    else if (paymentRecords.some(p => p.status === 'overdue'))     status = 'overdue';
    else if (paidAmount > 0 && paidAmount < shippedAmount)         status = 'partial';
    else if (shippedAmount > 0)                                    status = 'pending';
    else                                                           status = 'not_shipped';

    return { status, shippedAmount, paidAmount, paymentRecords };
  };

  const calcPenalty = (payment) => {
    if (payment.status !== 'overdue') return 0;
    return Math.max(0, daysDiff(payment.dueDate)) * payment.amount * 0.001;
  };

  // ── Summary stats ────────────────────────────────────────────────────
  const totalReceivable = payments.filter(p => p.status !== 'paid').reduce((s, p) => s + p.amount, 0);
  const overduePayments = payments.filter(p => p.status === 'overdue');
  const totalOverdue    = overduePayments.reduce((s, p) => s + p.amount, 0);
  const in7Days = new Date(TODAY); in7Days.setDate(in7Days.getDate() + 7);
  const upcomingPayments = payments.filter(p => {
    if (p.status === 'paid') return false;
    const d = new Date(p.dueDate);
    return d >= TODAY && d <= in7Days;
  });
  const totalUpcoming = upcomingPayments.reduce((s, p) => s + p.amount, 0);

  // ── Build hierarchy ───────────────────────────────────────────────────
  const grouped = counterparties
    .map(cp => {
      const cpContracts = contracts
        .filter(c => c.counterpartyId === cp.id)
        .map(contract => {
          const contractOrders = orders
            .filter(o => o.contractId === contract.id)
            .map(order => ({ ...order, summary: orderPaymentSummary(order) }));
          const totalShipped = contractOrders.reduce((s, o) => s + o.summary.shippedAmount, 0);
          const totalPaid    = contractOrders.reduce((s, o) => s + o.summary.paidAmount, 0);
          return { ...contract, orders: contractOrders, totalShipped, totalPaid };
        });
      const totalOrders  = cpContracts.reduce((s, c) => s + c.orders.length, 0);
      const totalShipped = cpContracts.reduce((s, c) => s + c.totalShipped, 0);
      const totalPaid    = cpContracts.reduce((s, c) => s + c.totalPaid, 0);
      return { ...cp, contracts: cpContracts, totalOrders, totalShipped, totalPaid };
    })
    .filter(cp => cp.contracts.length > 0);

  // ── Toggle helpers ────────────────────────────────────────────────────
  const toggle = (setter) => (id) => setter(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleCp       = toggle(setExpandedCps);
  const toggleContract = toggle(setExpandedContracts);
  const toggleOrder    = toggle(setExpandedOrders);

  // ── Payment registration ──────────────────────────────────────────────
  function openPaymentModal(payment) {
    setPaymentModal(payment);
    setPaymentForm({ ...emptyPaymentForm, amount: String(payment.amount), date: new Date().toISOString().slice(0, 10) });
    setPaymentFormErrors({});
  }
  function closePaymentModal() {
    setPaymentModal(null);
    setPaymentForm(emptyPaymentForm);
    setPaymentFormErrors({});
  }
  function handlePaymentSubmit() {
    const errors = {};
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) errors.amount = 'Введите корректную сумму';
    if (!paymentForm.date) errors.date = 'Укажите дату оплаты';
    if (Object.keys(errors).length) { setPaymentFormErrors(errors); return; }
    registerPayment(paymentModal.id, Number(paymentForm.amount), paymentForm.date);
    closePaymentModal();
  }

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Платежи</h1>
        <p className="text-sm text-gray-500 mt-0.5">Контроль оплаты заказов по контрагентам и договорам</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={CreditCard} label="К получению" value={formatMoney(totalReceivable)} color="blue" />
        <StatCard
          icon={AlertCircle} label="Просрочено" value={formatMoney(totalOverdue)} color="red"
          trend={overduePayments.length > 0 ? `${overduePayments.length} счёт(а)` : undefined}
        />
        <StatCard
          icon={Clock} label="Ближайшие 7 дней" value={formatMoney(totalUpcoming)} color="yellow"
          trend={upcomingPayments.length > 0 ? `${upcomingPayments.length} счёт(а)` : undefined}
        />
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[['grouped', 'По контрагентам'], ['flat', 'Все платежи']].map(([key, label]) => (
          <button
            key={key}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${viewMode === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setViewMode(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── GROUPED VIEW ─────────────────────────────────────────────── */}
      {viewMode === 'grouped' && (
        <div className="space-y-3">
          {grouped.length === 0 ? (
            <div className="card p-10 text-center text-gray-400">Нет данных</div>
          ) : grouped.map(cp => (
            <div key={cp.id} className="card p-0 overflow-hidden">

              {/* Counterparty header */}
              <button
                className="w-full flex items-center gap-3 px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                onClick={() => toggleCp(cp.id)}
              >
                <Building2 size={17} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{cp.name}</span>
                    {cp.priority === 'high' && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">Приоритет</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {cp.totalOrders} заказ(а) · {cp.contracts.length} договор(а)
                    {cp.totalShipped > 0 && (
                      <> · Отгружено {formatMoney(cp.totalShipped)} · Оплачено {formatMoney(cp.totalPaid)}</>
                    )}
                  </p>
                </div>
                {cp.totalShipped > cp.totalPaid ? (
                  <div className="text-right flex-shrink-0 mr-3">
                    <div className="text-sm font-semibold text-orange-600">{formatMoney(cp.totalShipped - cp.totalPaid)}</div>
                    <div className="text-xs text-gray-400">к оплате</div>
                  </div>
                ) : cp.totalShipped > 0 ? (
                  <div className="flex items-center gap-1 mr-3 text-green-600 text-sm font-medium flex-shrink-0">
                    <CheckCircle size={14} /> Всё оплачено
                  </div>
                ) : null}
                {expandedCps.has(cp.id)
                  ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                  : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
              </button>

              {/* Contracts */}
              {expandedCps.has(cp.id) && (
                <div className="divide-y divide-gray-100">
                  {cp.contracts.map(contract => (
                    <div key={contract.id}>

                      {/* Contract sub-header */}
                      <button
                        className="w-full flex items-center gap-3 px-7 py-3 bg-white hover:bg-gray-50 transition-colors text-left border-b border-gray-100"
                        onClick={() => toggleContract(contract.id)}
                      >
                        <FileText size={14} className="text-blue-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-800 text-sm">{contract.number}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-sm text-gray-600 truncate max-w-xs">{contract.subject}</span>
                            <StatusBadge status={contract.status} />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Оплата через {contract.paymentDelay} дн. · Штраф {contract.penaltyRate}%/день
                            {contract.orders.length > 0 && ` · ${contract.orders.length} заказ(а)`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 mr-3">
                          <div className="text-xs font-medium text-gray-600">{formatMoney(contract.amount)}</div>
                          <div className="text-xs text-gray-400">сумма договора</div>
                        </div>
                        {expandedContracts.has(contract.id)
                          ? <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
                          : <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />}
                      </button>

                      {/* Orders table */}
                      {expandedContracts.has(contract.id) && (
                        <div className="bg-gray-50/40">
                          {contract.orders.length === 0 ? (
                            <p className="px-10 py-4 text-sm text-gray-400 italic">Нет заказов по этому договору</p>
                          ) : (
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  {['Заказ', 'Статус заказа', 'Сумма заказа', 'Отгружено', 'Оплачено', 'Оплата', ''].map(h => (
                                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap first:pl-10">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {contract.orders.map(order => {
                                  const { status: payStatus, shippedAmount, paidAmount, paymentRecords } = order.summary;
                                  const isExpanded  = expandedOrders.has(order.id);
                                  const hasRecords  = paymentRecords.length > 0;
                                  const unpaidCount = paymentRecords.filter(p => p.status !== 'paid').length;
                                  return (
                                    <OrderRow
                                      key={order.id}
                                      order={order}
                                      payStatus={payStatus}
                                      shippedAmount={shippedAmount}
                                      paidAmount={paidAmount}
                                      paymentRecords={paymentRecords}
                                      isExpanded={isExpanded}
                                      hasRecords={hasRecords}
                                      unpaidCount={unpaidCount}
                                      onToggle={() => hasRecords && toggleOrder(order.id)}
                                      onOpenPayment={openPaymentModal}
                                      calcPenalty={calcPenalty}
                                    />
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── FLAT VIEW ────────────────────────────────────────────────── */}
      {viewMode === 'flat' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Контрагент', 'Счёт', 'Сумма', 'Срок', 'Оплачено', 'Статус', 'Штраф', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Нет данных</td></tr>
                ) : payments.map(p => {
                  const cp      = counterparties.find(c => c.id === p.counterpartyId);
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        {p.paidDate
                          ? <span className="flex items-center gap-1 text-green-600"><CheckCircle size={13} />{p.paidDate}</span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {penalty > 0 ? (
                          <span className="text-red-600 font-semibold text-xs">
                            {formatMoney(penalty)}<br />
                            <span className="text-gray-500 font-normal">{daysDiff(p.dueDate)} дн.</span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {p.status !== 'paid' && (
                          <button className="btn-secondary text-xs py-1 px-2" onClick={() => openPaymentModal(p)}>
                            Зарегистрировать оплату
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── REGISTER PAYMENT MODAL ───────────────────────────────────── */}
      <Modal
        isOpen={!!paymentModal}
        onClose={closePaymentModal}
        title="Зарегистрировать оплату"
        footer={
          <>
            <button className="btn-secondary" onClick={closePaymentModal}>Отмена</button>
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
              <label className="form-label">Сумма оплаты (₽) <span className="text-red-500">*</span></label>
              <input
                type="number" min={1}
                className={`form-input${paymentFormErrors.amount ? ' border-red-400 focus:ring-red-400' : ''}`}
                value={paymentForm.amount}
                onChange={e => { setPaymentForm(f => ({ ...f, amount: e.target.value })); setPaymentFormErrors(e => ({ ...e, amount: '' })); }}
              />
              {paymentFormErrors.amount && <p className="text-red-500 text-xs mt-1">{paymentFormErrors.amount}</p>}
            </div>
            <div>
              <label className="form-label">Дата оплаты <span className="text-red-500">*</span></label>
              <input
                type="date"
                className={`form-input${paymentFormErrors.date ? ' border-red-400 focus:ring-red-400' : ''}`}
                value={paymentForm.date}
                onChange={e => { setPaymentForm(f => ({ ...f, date: e.target.value })); setPaymentFormErrors(e => ({ ...e, date: '' })); }}
              />
              {paymentFormErrors.date && <p className="text-red-500 text-xs mt-1">{paymentFormErrors.date}</p>}
            </div>
            <div>
              <label className="form-label">Примечание</label>
              <textarea
                className="form-input resize-none" rows={2} placeholder="Необязательно"
                value={paymentForm.note}
                onChange={e => setPaymentForm(f => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── OrderRow: renders order row + expandable payment rows ────────────────
function OrderRow({ order, payStatus, shippedAmount, paidAmount, paymentRecords, isExpanded, hasRecords, unpaidCount, onToggle, onOpenPayment, calcPenalty }) {
  return (
    <>
      <tr
        className={`border-b border-gray-100 transition-colors ${hasRecords ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-indigo-50/40' : 'hover:bg-gray-100/60'}`}
        onClick={onToggle}
      >
        {/* Order number */}
        <td className="pl-10 pr-3 py-3">
          <div className="flex items-center gap-2">
            {hasRecords
              ? isExpanded
                ? <ChevronDown size={14} className="text-indigo-400 flex-shrink-0" />
                : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
              : <span className="inline-block w-3.5" />}
            <div>
              <div className="font-medium text-gray-900 whitespace-nowrap">{order.number}</div>
              <div className="text-xs text-gray-400 whitespace-nowrap">от {order.date}</div>
            </div>
          </div>
        </td>
        {/* Order status */}
        <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={order.status} /></td>
        {/* Total amount */}
        <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{formatMoney(order.totalAmount)}</td>
        {/* Shipped */}
        <td className="px-4 py-3 whitespace-nowrap text-gray-600">
          {shippedAmount > 0 ? formatMoney(shippedAmount) : <span className="text-gray-300">—</span>}
        </td>
        {/* Paid */}
        <td className="px-4 py-3 whitespace-nowrap">
          {paidAmount > 0
            ? <span className="text-green-700 font-medium">{formatMoney(paidAmount)}</span>
            : <span className="text-gray-300">—</span>}
        </td>
        {/* Payment status */}
        <td className="px-4 py-3 whitespace-nowrap"><OrderPayBadge status={payStatus} /></td>
        {/* Action hint */}
        <td className="px-4 py-3 text-right whitespace-nowrap">
          {hasRecords && !isExpanded && unpaidCount > 0 && (
            <span className="text-xs text-indigo-400 font-medium">{unpaidCount} счёт(а)</span>
          )}
        </td>
      </tr>

      {/* Payment records (expanded) */}
      {isExpanded && paymentRecords.map(payment => {
        const overdue = payment.status === 'overdue';
        const penalty = calcPenalty(payment);
        return (
          <tr
            key={`pay-${payment.id}`}
            className={`border-b border-gray-100 text-xs ${overdue ? 'bg-red-50' : 'bg-indigo-50/20'}`}
          >
            <td className="pl-14 pr-3 py-2.5" colSpan={1}>
              <div className="flex items-center gap-1.5 text-gray-500">
                <span className="text-gray-300 text-base leading-none">└</span>
                <span className="font-medium text-gray-700">{payment.invoiceNumber}</span>
              </div>
            </td>
            <td className="px-4 py-2.5"><StatusBadge status={payment.status} /></td>
            <td className="px-4 py-2.5 font-semibold text-gray-800">{formatMoney(payment.amount)}</td>
            <td className="px-4 py-2.5 text-gray-500">
              Срок: <span className={overdue ? 'text-red-600 font-medium' : 'text-gray-700'}>{payment.dueDate}</span>
              {overdue && <span className="ml-1 text-red-500">({daysDiff(payment.dueDate)} дн.)</span>}
            </td>
            <td className="px-4 py-2.5">
              {payment.paidDate
                ? <span className="flex items-center gap-1 text-green-600"><CheckCircle size={11} />{payment.paidDate}</span>
                : <span className="text-gray-400">—</span>}
            </td>
            <td className="px-4 py-2.5">
              {penalty > 0 && <span className="text-red-600 font-medium">+{formatMoney(penalty)}</span>}
            </td>
            <td className="px-4 py-2.5 text-right">
              {payment.status !== 'paid' && (
                <button
                  className="btn-secondary text-xs py-1 px-2.5"
                  onClick={e => { e.stopPropagation(); onOpenPayment(payment); }}
                >
                  Зарегистрировать
                </button>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
