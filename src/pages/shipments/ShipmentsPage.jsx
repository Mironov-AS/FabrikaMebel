import { useState, useMemo } from 'react';
import { Truck, Plus, AlertCircle, Calendar, Clock, CheckCircle, PackageCheck } from 'lucide-react';
import useAppStore from '../../store/appStore';
import { formatMoney } from '../../data/mockData';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import StatCard from '../../components/ui/StatCard';

const TODAY = new Date();

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysDiff(dateStr) {
  const d = new Date(dateStr);
  return Math.floor((TODAY - d) / (1000 * 60 * 60 * 24));
}

function isOverdue(paymentDueDate, paidAmount, amount) {
  if (!paymentDueDate || paidAmount >= amount) return false;
  return new Date(paymentDueDate) < TODAY;
}

const emptyForm = {
  orderId: '',
  date: new Date().toISOString().slice(0, 10),
  invoiceNumber: '',
  amount: '',
};

// ─── New Shipment Modal ───────────────────────────────────────────────────────

function NewShipmentModal({ isOpen, onClose, orders, contracts, counterparties, onSave, isWarehouse }) {
  const [form, setForm] = useState(emptyForm);

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  // Resolve selected order and contract
  const selectedOrder = orders.find(o => o.id === parseInt(form.orderId, 10));
  const selectedContract = selectedOrder
    ? contracts.find(c => c.id === (selectedOrder.contractId || selectedOrder.contract_id))
    : null;
  const cp = selectedOrder
    ? counterparties.find(c => c.id === (selectedOrder.counterpartyId || selectedOrder.counterparty_id))
    : null;

  // Auto-calculate payment due date
  const paymentDelay = selectedContract?.paymentDelay ?? selectedContract?.payment_delay ?? 30;
  const paymentDueDate = form.date ? addDays(form.date, paymentDelay) : null;

  // For warehouse: auto-calculate amount from order totalAmount
  const autoAmount = selectedOrder?.totalAmount ?? 0;

  const handleClose = () => {
    setForm(emptyForm);
    onClose();
  };

  const handleSave = () => {
    if (!form.orderId || !form.invoiceNumber) return;
    const effectiveAmount = isWarehouse ? autoAmount : parseFloat(form.amount);
    if (!isWarehouse && !effectiveAmount) return;
    const order = selectedOrder;
    onSave({
      orderId: order.id,
      orderNumber: order.number,
      counterpartyId: order.counterpartyId || order.counterparty_id,
      date: form.date,
      invoiceNumber: form.invoiceNumber,
      amount: effectiveAmount,
      items: (order.specification ?? []).map(i => ({
        specItemId: i.id,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
    });
    handleClose();
  };

  const canSave = isWarehouse
    ? form.orderId && form.invoiceNumber
    : form.orderId && form.invoiceNumber && parseFloat(form.amount) > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Зарегистрировать отгрузку"
      footer={
        <>
          <button className="btn-secondary" onClick={handleClose}>Отмена</button>
          <button className="btn-primary" onClick={handleSave} disabled={!canSave}>
            Зарегистрировать
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Order selection */}
        <div>
          <label className="label">Заказ <span className="text-red-400">*</span></label>
          {orders.length === 0 ? (
            <div className="input bg-gray-50 text-gray-400 flex items-center gap-2">
              <PackageCheck size={14} />
              Нет заказов, готовых к отгрузке
            </div>
          ) : (
            <select className="input" value={form.orderId} onChange={set('orderId')}>
              <option value="">— Выберите заказ —</option>
              {orders.map(o => {
                const c = contracts.find(c => c.id === (o.contractId || o.contract_id));
                const cp = counterparties.find(cp => cp.id === (o.counterpartyId || o.counterparty_id));
                return (
                  <option key={o.id} value={o.id}>
                    {isWarehouse
                      ? `${o.number} — ${cp?.name ?? '?'}`
                      : `${o.number} — ${cp?.name ?? '?'} (отсрочка ${c?.paymentDelay ?? c?.payment_delay ?? '?'} дн.)`}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* Selected order info */}
        {selectedOrder && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 space-y-1.5 text-sm">
            <p className="font-medium text-orange-800">{selectedOrder.number}</p>
            <p className="text-orange-700 text-xs">Контрагент: {cp?.name ?? '—'}</p>
            {selectedContract && !isWarehouse && (
              <p className="text-orange-700 text-xs">
                Договор: <strong>{selectedContract.number}</strong> · Отсрочка: <strong>{paymentDelay} дн.</strong>
              </p>
            )}
            {selectedContract && isWarehouse && (
              <p className="text-orange-700 text-xs">
                Договор: <strong>{selectedContract.number}</strong>
              </p>
            )}
            <div className="pt-1 text-xs text-orange-700">
              <p className="font-medium mb-1">Позиции:</p>
              {(selectedOrder.specification ?? []).map(i => (
                <p key={i.id} className="ml-2">· {i.name} × {i.quantity} шт.</p>
              ))}
            </div>
          </div>
        )}

        {/* Shipment date */}
        <div>
          <label className="label">Дата отгрузки <span className="text-red-400">*</span></label>
          <input className="input" type="date" value={form.date} onChange={set('date')} />
        </div>

        {/* Payment due date preview — Finance only */}
        {!isWarehouse && paymentDueDate && selectedOrder && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <Calendar size={16} className="text-blue-500 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-800">Дата оплаты рассчитана автоматически</p>
              <p className="text-blue-700 text-xs mt-0.5">
                {form.date} + {paymentDelay} дн. отсрочки = <strong>{paymentDueDate}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Invoice number */}
        <div>
          <label className="label">Номер накладной <span className="text-red-400">*</span></label>
          <input className="input" placeholder="ТН-2026-XXXX" value={form.invoiceNumber} onChange={set('invoiceNumber')} />
        </div>

        {/* Amount — hidden for warehouse, auto-calculated */}
        {!isWarehouse && (
          <div>
            <label className="label">Сумма отгрузки (₽) <span className="text-red-400">*</span></label>
            <input
              className="input"
              type="number"
              min="1"
              placeholder="0"
              value={form.amount}
              onChange={set('amount')}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ShipmentsPage() {
  const [showModal, setShowModal] = useState(false);

  const { shipments, orders, contracts, counterparties, addShipment } = useAppStore();
  const currentService = useAppStore(s => s.currentService);
  const isWarehouse = currentService === 'warehouse-logistics';

  // Only ready_for_shipment orders can be shipped
  const readyOrders = orders.filter(o => o.status === 'ready_for_shipment');

  const getCounterparty = (id) => counterparties.find(c => c.id === id);
  const getOrder        = (id) => orders.find(o => o.id === id);
  const getContract     = (orderId) => {
    const o = getOrder(orderId);
    return o ? contracts.find(c => c.id === (o.contractId || o.contract_id)) : null;
  };

  const enriched = shipments.map(s => ({
    ...s,
    overdue:      isOverdue(s.paymentDueDate, s.paidAmount, s.amount),
    counterparty: getCounterparty(s.counterpartyId),
    order:        getOrder(s.orderId),
    contract:     getContract(s.orderId),
  }));

  // Summary stats
  const totalShipped   = enriched.reduce((sum, s) => sum + s.amount, 0);
  const overdueItems   = enriched.filter(s => s.overdue);
  const totalOverdue   = overdueItems.reduce((sum, s) => sum + s.amount - s.paidAmount, 0);
  const pendingItems   = enriched.filter(s => s.paidAmount < s.amount && !s.overdue);
  const totalPending   = pendingItems.reduce((sum, s) => sum + s.amount - s.paidAmount, 0);

  const handleSave = async (data) => {
    try { await addShipment(data); } catch (e) { console.error(e); }
  };

  // Table columns vary by service
  const tableHeaders = isWarehouse
    ? ['Дата', 'Накладная', 'Заказ', 'Контрагент', 'Позиции']
    : ['Дата', 'Накладная', 'Заказ', 'Контрагент', 'Позиции', 'Сумма', 'Статус оплаты', 'Срок оплаты', 'Отсрочка'];

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Отгрузки</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isWarehouse
              ? 'Реестр отгрузок: что, кому и когда отгружено.'
              : 'Реестр отгрузок. Срок оплаты исчисляется от даты отгрузки по условиям договора.'}
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
          onClick={() => setShowModal(true)}
        >
          <Plus size={15} />
          Зарегистрировать отгрузку
        </button>
      </div>

      {/* Ready for shipment banner */}
      {readyOrders.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <PackageCheck size={18} className="text-orange-500 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-orange-800">{readyOrders.length} заказ(а) готовы к отгрузке: </span>
            <span className="text-orange-700">{readyOrders.map(o => o.number).join(', ')}</span>
          </div>
          <button
            className="text-orange-700 hover:text-orange-900 text-xs font-medium underline flex-shrink-0"
            onClick={() => setShowModal(true)}
          >
            Оформить отгрузку
          </button>
        </div>
      )}

      {/* Summary stats */}
      {isWarehouse ? (
        // Warehouse: operational metrics only, no financial data
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={Truck}        label="Всего отгрузок"            value={String(enriched.length)}                                                     color="blue" />
          <StatCard icon={PackageCheck} label="Контрагентов обслужено"    value={String(new Set(enriched.map(s => s.counterpartyId).filter(Boolean)).size)}  color="teal" />
          <StatCard icon={Clock}        label="Заказов готово к отгрузке" value={String(readyOrders.length)}                                                  color="orange" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={Truck}       label="Всего отгружено"  value={formatMoney(totalShipped)}  color="blue" />
          <StatCard icon={Clock}       label="Ожидает оплаты"   value={formatMoney(totalPending)}  color="yellow" trend={pendingItems.length > 0 ? `${pendingItems.length} счёт(а)` : undefined} />
          <StatCard icon={AlertCircle} label="Просрочено"        value={formatMoney(totalOverdue)}  color="red"    trend={overdueItems.length > 0 ? `${overdueItems.length} счёт(а)` : undefined} />
        </div>
      )}

      {/* Shipments table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {tableHeaders.map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enriched.length === 0 ? (
                <tr>
                  <td colSpan={tableHeaders.length} className="px-4 py-12 text-center text-gray-400">
                    <Truck size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Отгрузок пока нет</p>
                  </td>
                </tr>
              ) : (
                enriched.map(s => (
                  <tr
                    key={s.id}
                    className={!isWarehouse && s.overdue ? 'bg-red-50' : 'hover:bg-gray-50 transition-colors'}
                  >
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{s.date}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{s.invoiceNumber}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{s.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{s.counterparty?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px]">
                      <ul className="space-y-0.5">
                        {(s.items ?? []).map((item, i) => (
                          <li key={i} className="truncate text-xs">{item.name} × {item.quantity}</li>
                        ))}
                      </ul>
                    </td>
                    {!isWarehouse && (
                      <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                        {formatMoney(s.amount)}
                      </td>
                    )}
                    {!isWarehouse && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {s.paidAmount >= s.amount ? (
                            <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                              <CheckCircle size={12} /> Оплачено {s.paidDate}
                            </span>
                          ) : s.overdue ? (
                            <>
                              <StatusBadge status="overdue" />
                              <span className="text-xs text-red-600 flex items-center gap-1">
                                <AlertCircle size={11} />
                                {daysDiff(s.paymentDueDate)} дн. просрочки
                              </span>
                            </>
                          ) : (
                            <StatusBadge status="pending" />
                          )}
                        </div>
                      </td>
                    )}
                    {!isWarehouse && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        {s.paymentDueDate ? (
                          <span className={s.overdue ? 'text-red-600 font-medium text-sm' : 'text-gray-700 text-sm'}>
                            {s.paymentDueDate}
                          </span>
                        ) : '—'}
                      </td>
                    )}
                    {!isWarehouse && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        {s.contract ? (
                          <span className="text-xs text-blue-600 font-medium">
                            {s.contract.paymentDelay ?? s.contract.payment_delay} дн.
                          </span>
                        ) : '—'}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <NewShipmentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        orders={readyOrders}
        contracts={contracts}
        counterparties={counterparties}
        onSave={handleSave}
        isWarehouse={isWarehouse}
      />
    </div>
  );
}
