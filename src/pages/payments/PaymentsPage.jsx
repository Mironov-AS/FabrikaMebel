import React, { useState, useEffect } from 'react';
import {
  CreditCard, AlertCircle, Clock, CheckCircle,
  ChevronDown, ChevronRight, Building2, FileText,
  Plus, Trash2, Receipt, XCircle,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import { formatMoney } from '../../data/mockData';
import { daysDiff } from '../../utils/date';
import StatusBadge from '../../components/ui/StatusBadge';
import StatCard from '../../components/ui/StatCard';
import InvoiceBadge from './InvoiceBadge';
import CreateInvoiceModal from './CreateInvoiceModal';
import AddPaymentModal from './AddPaymentModal';
import OrderRow from './OrderRow';

export default function PaymentsPage() {
  const [viewMode, setViewMode] = useState('grouped');
  const [expandedCps, setExpandedCps] = useState(new Set());
  const [expandedContracts, setExpandedContracts] = useState(new Set());
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [createInvoiceFor, setCreateInvoiceFor] = useState(null);
  const [addPaymentFor, setAddPaymentFor] = useState(null);

  const { invoices, orders, contracts, counterparties, createInvoice, addInvoicePayment, deleteInvoicePayment, deactivateInvoice } = useAppStore();

  useEffect(() => {
    if (counterparties.length > 0) setExpandedCps(new Set(counterparties.map(c => c.id)));
  }, [counterparties.length]);
  useEffect(() => {
    if (contracts.length > 0) setExpandedContracts(new Set(contracts.map(c => c.id)));
  }, [contracts.length]);

  const orderInvoice = (orderId) => invoices.find(inv => inv.orderId === orderId && inv.isActive);
  const orderVoidedInvoices = (orderId) => invoices.filter(inv => inv.orderId === orderId && !inv.isActive);

  const calcPenalty = (invoice) => {
    if (invoice.status !== 'overdue') return 0;
    const days = Math.max(0, daysDiff(invoice.dueDate));
    return days * (invoice.amount - invoice.paidAmount) * 0.001;
  };

  const TODAY = new Date();
  const activeInvoices = invoices.filter(inv => inv.isActive);
  const unpaidInvoices = activeInvoices.filter(inv => inv.status !== 'paid');
  const totalReceivable = unpaidInvoices.reduce((s, inv) => s + Math.max(0, inv.amount - inv.paidAmount), 0);
  const overdueInvoices = activeInvoices.filter(inv => inv.status === 'overdue');
  const totalOverdue = overdueInvoices.reduce((s, inv) => s + Math.max(0, inv.amount - inv.paidAmount), 0);
  const in7Days = new Date(TODAY);
  in7Days.setDate(in7Days.getDate() + 7);
  const upcomingInvoices = activeInvoices.filter(inv => {
    if (inv.status === 'paid') return false;
    const d = new Date(inv.dueDate);
    return d >= TODAY && d <= in7Days;
  });
  const totalUpcoming = upcomingInvoices.reduce((s, inv) => s + Math.max(0, inv.amount - inv.paidAmount), 0);

  const grouped = counterparties
    .map(cp => {
      const cpContracts = contracts
        .filter(c => c.counterpartyId === cp.id)
        .map(contract => {
          const contractOrders = orders
            .filter(o => o.contractId === contract.id)
            .map(order => ({ ...order, invoice: orderInvoice(order.id) || null }));
          const totalInvoiced = contractOrders.reduce((s, o) => s + (o.invoice?.amount || 0), 0);
          const totalPaid = contractOrders.reduce((s, o) => s + (o.invoice?.paidAmount || 0), 0);
          return { ...contract, orders: contractOrders, totalInvoiced, totalPaid };
        });
      const totalOrders = cpContracts.reduce((s, c) => s + c.orders.length, 0);
      const totalInvoiced = cpContracts.reduce((s, c) => s + c.totalInvoiced, 0);
      const totalPaid = cpContracts.reduce((s, c) => s + c.totalPaid, 0);
      return { ...cp, contracts: cpContracts, totalOrders, totalInvoiced, totalPaid };
    })
    .filter(cp => cp.contracts.length > 0);

  const toggle = (setter) => (id) => setter(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleCp = toggle(setExpandedCps);
  const toggleContract = toggle(setExpandedContracts);
  const toggleOrder = toggle(setExpandedOrders);

  async function handleDeletePayment(invoiceId, paymentId) {
    if (!confirm('Удалить эту запись об оплате?')) return;
    await deleteInvoicePayment(invoiceId, paymentId);
  }

  async function handleDeactivateInvoice(invoice) {
    if (!confirm(`Аннулировать счёт ${invoice.invoiceNumber}?\n\nЭтот счёт станет неактивным, и вы сможете выставить новый счёт для этого заказа.`)) return;
    try {
      await deactivateInvoice(invoice.id);
    } catch (e) {
      alert(e?.response?.data?.error || 'Ошибка при аннулировании счёта');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Финансы</h1>
        <p className="text-sm text-gray-500 mt-0.5">Счета на заказы и контроль оплаты</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={CreditCard} label="К получению" value={formatMoney(totalReceivable)} color="blue" />
        <StatCard
          icon={AlertCircle} label="Просрочено" value={formatMoney(totalOverdue)} color="red"
          trend={overdueInvoices.length > 0 ? `${overdueInvoices.length} счёт(а)` : undefined}
        />
        <StatCard
          icon={Clock} label="Ближайшие 7 дней" value={formatMoney(totalUpcoming)} color="yellow"
          trend={upcomingInvoices.length > 0 ? `${upcomingInvoices.length} счёт(а)` : undefined}
        />
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[['grouped', 'По контрагентам'], ['orders', 'По заказам'], ['flat', 'Все счета']].map(([key, label]) => (
          <button
            key={key}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${viewMode === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setViewMode(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grouped view */}
      {viewMode === 'grouped' && (
        <div className="space-y-3">
          {grouped.length === 0 ? (
            <div className="card p-10 text-center text-gray-400">Нет данных</div>
          ) : grouped.map(cp => (
            <div key={cp.id} className="card p-0 overflow-hidden">
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
                    {cp.totalInvoiced > 0 && (
                      <> · Выставлено {formatMoney(cp.totalInvoiced)} · Оплачено {formatMoney(cp.totalPaid)}</>
                    )}
                  </p>
                </div>
                {cp.totalInvoiced > cp.totalPaid ? (
                  <div className="text-right flex-shrink-0 mr-3">
                    <div className="text-sm font-semibold text-orange-600">{formatMoney(cp.totalInvoiced - cp.totalPaid)}</div>
                    <div className="text-xs text-gray-400">к оплате</div>
                  </div>
                ) : cp.totalInvoiced > 0 ? (
                  <div className="flex items-center gap-1 mr-3 text-green-600 text-sm font-medium flex-shrink-0">
                    <CheckCircle size={14} /> Всё оплачено
                  </div>
                ) : null}
                {expandedCps.has(cp.id)
                  ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                  : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
              </button>

              {expandedCps.has(cp.id) && (
                <div className="divide-y divide-gray-100">
                  {cp.contracts.map(contract => (
                    <div key={contract.id}>
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

                      {expandedContracts.has(contract.id) && (
                        <div className="bg-gray-50/40">
                          {contract.orders.length === 0 ? (
                            <p className="px-10 py-4 text-sm text-gray-400 italic">Нет заказов по этому договору</p>
                          ) : (
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  {['Заказ', 'Статус заказа', 'Сумма заказа', 'Счёт', 'Оплачено / Остаток', 'Статус оплаты', ''].map(h => (
                                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap first:pl-10">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {contract.orders.map(order => (
                                  <OrderRow
                                    key={order.id}
                                    order={order}
                                    invoice={order.invoice}
                                    voidedInvoices={orderVoidedInvoices(order.id)}
                                    isExpanded={expandedOrders.has(order.id)}
                                    onToggle={() => (order.invoice || orderVoidedInvoices(order.id).length > 0) && toggleOrder(order.id)}
                                    onCreateInvoice={() => setCreateInvoiceFor(order)}
                                    onAddPayment={(inv) => setAddPaymentFor(inv)}
                                    onDeletePayment={handleDeletePayment}
                                    onDeactivate={handleDeactivateInvoice}
                                    calcPenalty={calcPenalty}
                                  />
                                ))}
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

      {/* Orders view */}
      {viewMode === 'orders' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Заказ', 'Контрагент', 'Договор', 'Статус заказа', 'Сумма заказа', 'Счёт', 'Оплачено', 'Остаток', 'Срок', 'Статус оплаты', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-400">Нет заказов</td></tr>
                ) : orders.map(order => {
                  const inv = orderInvoice(order.id);
                  const contract = contracts.find(c => c.id === order.contractId);
                  const cp = counterparties.find(c => c.id === order.counterpartyId);
                  const remaining = inv ? Math.max(0, inv.amount - inv.paidAmount) : 0;
                  const overdue = inv?.status === 'overdue';
                  const isExp = expandedOrders.has(order.id);
                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        className={`border-b border-gray-100 transition-colors ${inv ? 'cursor-pointer' : ''} ${isExp ? 'bg-indigo-50/40' : overdue ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                        onClick={() => inv && toggleOrder(order.id)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {inv
                              ? isExp
                                ? <ChevronDown size={14} className="text-indigo-400 flex-shrink-0" />
                                : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                              : <span className="inline-block w-3.5" />}
                            <div>
                              <div className="font-medium text-gray-900">{order.number}</div>
                              <div className="text-xs text-gray-400">от {order.date}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{cp?.name ?? '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {contract
                            ? <div>
                                <div className="font-medium text-gray-800">{contract.number}</div>
                                <div className="text-xs text-gray-400 truncate max-w-[180px]">{contract.subject}</div>
                              </div>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={order.status} /></td>
                        <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                          {formatMoney(order.totalAmount || order.total_amount || 0)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {inv
                            ? <div className="flex items-center gap-1.5 text-gray-700">
                                <Receipt size={13} className="text-gray-400" />
                                <span className="font-medium">{inv.invoiceNumber}</span>
                              </div>
                            : <button
                                className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                                onClick={e => { e.stopPropagation(); setCreateInvoiceFor(order); }}
                              >
                                <Plus size={13} /> Создать счёт
                              </button>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {inv?.paidAmount > 0
                            ? <span className="text-green-700 font-medium">{formatMoney(inv.paidAmount)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {inv
                            ? remaining > 0
                              ? <span className={`${overdue ? 'text-red-500' : 'text-orange-600'} font-medium`}>{formatMoney(remaining)}</span>
                              : <span className="text-green-600 text-xs font-medium flex items-center gap-1"><CheckCircle size={12} /> Оплачен</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {inv?.dueDate
                            ? <span className={overdue ? 'text-red-600 font-medium' : ''}>
                                {inv.dueDate}
                                {overdue && <span className="ml-1 text-xs">({daysDiff(inv.dueDate)} дн.)</span>}
                              </span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {inv ? <InvoiceBadge status={inv.status} /> : <span className="text-gray-300 text-xs">Нет счёта</span>}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          {inv && inv.status !== 'paid' && (
                            <button className="btn-secondary text-xs py-1 px-2" onClick={() => setAddPaymentFor(inv)}>
                              + Оплата
                            </button>
                          )}
                        </td>
                      </tr>

                      {isExp && inv && (
                        <>
                          <tr className="bg-indigo-50/30 border-b border-indigo-100/50">
                            <td className="pl-10 pr-3 py-2 text-xs text-gray-500" colSpan={5}>
                              {inv.invoiceDate && (
                                <span className="mr-4">
                                  <span className="font-medium text-gray-700">Дата счёта:</span>{' '}
                                  <span className="text-gray-700">{inv.invoiceDate}</span>
                                </span>
                              )}
                              <span className="font-medium text-gray-700">Срок оплаты:</span>{' '}
                              <span className={overdue ? 'text-red-600 font-medium' : 'text-gray-700'}>
                                {inv.dueDate || '—'}
                                {overdue && ` (просрочено ${daysDiff(inv.dueDate)} дн.)`}
                              </span>
                              {overdue && (
                                <span className="ml-3 text-red-500 font-medium">
                                  Штраф ≈ {formatMoney(calcPenalty(inv))}
                                </span>
                              )}
                            </td>
                            <td colSpan={6} />
                          </tr>
                          {inv.installments?.length > 0 ? inv.installments.map(inst => (
                            <tr key={`inst-${inst.id}`} className="border-b border-gray-100 text-xs bg-indigo-50/20">
                              <td className="pl-10 pr-3 py-2.5" colSpan={4}>
                                <div className="flex items-center gap-1.5 text-gray-500">
                                  <span className="text-gray-300 text-base leading-none">└</span>
                                  <CheckCircle size={11} className="text-green-500" />
                                  <span>Оплата от {inst.paidDate}</span>
                                  {inst.notes && <span className="text-gray-400 italic">— {inst.notes}</span>}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-green-700">{formatMoney(inst.amount)}</td>
                              <td colSpan={5} />
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  className="text-red-400 hover:text-red-600 transition-colors"
                                  title="Отменить оплату"
                                  onClick={e => { e.stopPropagation(); handleDeletePayment(inv.id, inst.id); }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          )) : (
                            <tr className="border-b border-gray-100 text-xs bg-indigo-50/20">
                              <td className="pl-10 pr-3 py-2.5 text-gray-400 italic" colSpan={11}>Платежей ещё нет</td>
                            </tr>
                          )}
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Flat view */}
      {viewMode === 'flat' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Контрагент', 'Заказ', 'Счёт', 'Сумма', 'Оплачено', 'Остаток', 'Срок', 'Статус', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Нет счетов</td></tr>
                ) : invoices.map(inv => {
                  const order = orders.find(o => o.id === inv.orderId);
                  const cp = counterparties.find(c => c.id === inv.counterpartyId);
                  const remaining = Math.max(0, inv.amount - inv.paidAmount);
                  const overdue = inv.status === 'overdue';
                  const isInactive = !inv.isActive;
                  return (
                    <tr key={inv.id} className={isInactive ? 'bg-gray-50 opacity-60' : overdue ? 'bg-red-50' : 'hover:bg-gray-50 transition-colors'}>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{cp?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{order?.number ?? '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Receipt size={13} className={isInactive ? 'text-gray-300' : 'text-gray-400'} />
                          <span className={isInactive ? 'line-through text-gray-400' : ''}>{inv.invoiceNumber}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 font-semibold whitespace-nowrap ${isInactive ? 'text-gray-400' : 'text-gray-900'}`}>{formatMoney(inv.amount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {inv.paidAmount > 0
                          ? <span className="text-green-700 font-medium">{formatMoney(inv.paidAmount)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {!isInactive && remaining > 0
                          ? <span className="text-orange-600 font-medium">{formatMoney(remaining)}</span>
                          : <span className="text-green-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        <span className={overdue && !isInactive ? 'text-red-600 font-medium' : ''}>
                          {inv.dueDate || '—'}
                          {overdue && !isInactive && <span className="ml-1 text-xs">({daysDiff(inv.dueDate)} дн.)</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><InvoiceBadge status={inv.status} inactive={isInactive} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {!isInactive && inv.status !== 'paid' && (
                          <div className="flex items-center gap-2">
                            <button className="btn-secondary text-xs py-1 px-2" onClick={() => setAddPaymentFor(inv)}>
                              Оплата
                            </button>
                            <button
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              title="Аннулировать счёт"
                              onClick={() => handleDeactivateInvoice(inv)}
                            >
                              <XCircle size={15} />
                            </button>
                          </div>
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

      <CreateInvoiceModal
        isOpen={!!createInvoiceFor}
        onClose={() => setCreateInvoiceFor(null)}
        order={createInvoiceFor}
        contracts={contracts}
        onSave={createInvoice}
      />
      <AddPaymentModal
        isOpen={!!addPaymentFor}
        onClose={() => setAddPaymentFor(null)}
        invoice={addPaymentFor}
        onSave={addInvoicePayment}
      />
    </div>
  );
}
