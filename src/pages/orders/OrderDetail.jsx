import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, Printer, Plus, Package,
  TruckIcon, ClipboardList, Calendar,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import { formatMoney, STATUS_LABELS } from '../../data/mockData';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Table from '../../components/ui/Table';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_MAP = {
  high:   { cls: 'badge-red',    label: 'Высокий' },
  medium: { cls: 'badge-yellow', label: 'Средний' },
  low:    { cls: 'badge-green',  label: 'Низкий'  },
};

function PriorityBadge({ priority }) {
  const p = PRIORITY_MAP[priority] ?? { cls: 'badge-gray', label: priority };
  return <span className={p.cls}>{p.label}</span>;
}

function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Specification Tab ────────────────────────────────────────────────────────

function SpecificationTab({ order, onCreateShipment, isWarehouse }) {
  const spec = order.specification ?? [];

  const totalQty      = spec.reduce((s, i) => s + i.quantity, 0);
  const totalShipped  = spec.reduce((s, i) => s + (i.shipped ?? 0), 0);
  const totalRemainder = totalQty - totalShipped;
  const totalAmount   = spec.reduce((s, i) => s + i.quantity * i.price, 0);
  const totalShippedAmount = spec.reduce((s, i) => s + (i.shipped ?? 0) * i.price, 0);

  const columns = [
    { key: 'name',     label: 'Наименование' },
    { key: 'article',  label: 'Артикул' },
    { key: 'quantity', label: 'Кол-во' },
    {
      key: 'shipped',
      label: 'Отгружено',
      render: (val) => val ?? 0,
    },
    {
      key: 'quantity',
      label: 'Остаток',
      render: (val, row) => {
        const rem = val - (row.shipped ?? 0);
        return (
          <span className={rem > 0 ? 'text-orange-600 font-medium' : 'text-green-600 font-medium'}>
            {rem}
          </span>
        );
      },
    },
    // Price and Amount columns hidden for warehouse
    ...(!isWarehouse ? [
      { key: 'price',  label: 'Цена',  render: (val) => formatMoney(val) },
      {
        key: 'price',
        label: 'Сумма',
        render: (val, row) => formatMoney(row.quantity * val),
      },
    ] : []),
    {
      key: 'status',
      label: 'Статус',
      render: (val) => <StatusBadge status={val} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Позиций: <strong className="text-gray-800">{spec.length}</strong>
        </p>
        <button
          className="btn-primary flex items-center gap-1.5"
          onClick={onCreateShipment}
        >
          <TruckIcon size={14} />
          Создать отгрузку
        </button>
      </div>

      <Table columns={columns} data={spec} />

      {/* Totals row */}
      {spec.length > 0 && (
        <div className="card p-4">
          <div className={`grid grid-cols-2 ${!isWarehouse ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Итого позиций</p>
              <p className="text-sm font-semibold text-gray-900">{totalQty} шт.</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Отгружено</p>
              <p className="text-sm font-semibold text-green-700">{totalShipped} шт.</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Остаток</p>
              <p className={`text-sm font-semibold ${totalRemainder > 0 ? 'text-orange-600' : 'text-green-700'}`}>
                {totalRemainder} шт.
              </p>
            </div>
            {!isWarehouse && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Сумма договора</p>
                <p className="text-sm font-semibold text-gray-900">{formatMoney(totalAmount)}</p>
              </div>
            )}
          </div>
          {!isWarehouse && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-6">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Сумма отгружено</p>
                <p className="text-sm font-semibold text-blue-700">{formatMoney(totalShippedAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Остаток к отгрузке</p>
                <p className="text-sm font-semibold text-orange-600">
                  {formatMoney(totalAmount - totalShippedAmount)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Packing List Tab ─────────────────────────────────────────────────────────

function PackingListTab({ order, contract, counterparty, isWarehouse }) {
  const spec = order.specification ?? [];
  const totalQty = spec.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = spec.reduce((s, i) => s + i.quantity * i.price, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-gray-500">Упаковочный лист для печати</p>
        <button
          className="btn-secondary flex items-center gap-1.5"
          onClick={() => window.print()}
        >
          <Printer size={14} />
          Печать
        </button>
      </div>

      {/* Print-friendly area */}
      <div className="card p-6 print:shadow-none print:border-0">
        {/* Header info */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            Упаковочный лист
          </h2>
          <p className="text-sm text-gray-600">Заказ: <strong>{order.number}</strong></p>
          {contract && (
            <p className="text-sm text-gray-600">Договор: <strong>{contract.number}</strong></p>
          )}
          {counterparty && (
            <p className="text-sm text-gray-600">Контрагент: <strong>{counterparty.name}</strong></p>
          )}
          {order.shipmentDeadline && (
            <p className="text-sm text-gray-600">
              Дата отгрузки: <strong>{order.shipmentDeadline}</strong>
            </p>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border border-gray-200 w-8">
                  №
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border border-gray-200">
                  Наименование
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border border-gray-200">
                  Артикул
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 border border-gray-200">
                  Кол-во
                </th>
                {!isWarehouse && (
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 border border-gray-200">
                    Цена
                  </th>
                )}
                {!isWarehouse && (
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 border border-gray-200">
                    Сумма
                  </th>
                )}
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border border-gray-200">
                  Статус
                </th>
              </tr>
            </thead>
            <tbody>
              {spec.map((item, idx) => (
                <tr key={item.id} className="border border-gray-200">
                  <td className="px-3 py-2 text-gray-500 border border-gray-200 text-center">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2 text-gray-800 border border-gray-200">
                    {item.name}
                  </td>
                  <td className="px-3 py-2 text-gray-600 border border-gray-200 font-mono text-xs">
                    {item.article}
                  </td>
                  <td className="px-3 py-2 text-center border border-gray-200">
                    {item.quantity}
                  </td>
                  {!isWarehouse && (
                    <td className="px-3 py-2 text-right border border-gray-200">
                      {formatMoney(item.price)}
                    </td>
                  )}
                  {!isWarehouse && (
                    <td className="px-3 py-2 text-right border border-gray-200 font-medium">
                      {formatMoney(item.quantity * item.price)}
                    </td>
                  )}
                  <td className="px-3 py-2 border border-gray-200">
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold border border-gray-200">
                <td className="px-3 py-2 border border-gray-200" />
                <td className="px-3 py-2 border border-gray-200 text-gray-800">ИТОГО</td>
                <td className="px-3 py-2 border border-gray-200" />
                <td className="px-3 py-2 text-center border border-gray-200">{totalQty}</td>
                {!isWarehouse && <td className="px-3 py-2 border border-gray-200" />}
                {!isWarehouse && (
                  <td className="px-3 py-2 text-right border border-gray-200">{formatMoney(totalAmount)}</td>
                )}
                <td className="px-3 py-2 border border-gray-200" />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Signatures */}
        <div className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <p className="text-sm text-gray-600 mb-6">Сдал: ____________________________</p>
            <p className="text-xs text-gray-400">(подпись / дата)</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-6">Принял: ____________________________</p>
            <p className="text-xs text-gray-400">(подпись / дата)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shipment History Tab ─────────────────────────────────────────────────────

const PAYMENT_STATUS_LABELS = {
  paid:    { cls: 'badge-green',  label: 'Оплачен' },
  overdue: { cls: 'badge-red',    label: 'Просрочен' },
  pending: { cls: 'badge-gray',   label: 'Ожидается' },
};

function ShipmentHistoryTab({ orderId, isWarehouse }) {
  const shipments = useAppStore(s => s.shipments);
  const payments  = useAppStore(s => s.payments);

  const orderShipments = shipments.filter(s => s.orderId === orderId);

  if (orderShipments.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        <Package size={36} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">Отгрузок по данному заказу пока нет</p>
      </div>
    );
  }

  const columns = [
    { key: 'date', label: 'Дата' },
    { key: 'invoiceNumber', label: 'Номер накладной' },
    // Amount hidden for warehouse
    ...(!isWarehouse ? [
      { key: 'amount', label: 'Сумма', render: (val) => formatMoney(val) },
    ] : []),
    ...(!isWarehouse ? [
      {
        key: 'id',
        label: 'Статус оплаты',
        render: (val, row) => {
          const payment = payments.find(p => p.shipmentId === row.id);
          if (!payment) return <span className="badge-gray">—</span>;
          const ps = PAYMENT_STATUS_LABELS[payment.status] ?? { cls: 'badge-gray', label: payment.status };
          return <span className={ps.cls}>{ps.label}</span>;
        },
      },
      {
        key: 'id',
        label: 'Срок оплаты',
        render: (val, row) => {
          const payment = payments.find(p => p.shipmentId === row.id);
          return payment?.dueDate ?? '—';
        },
      },
      {
        key: 'id',
        label: 'Оплачено',
        render: (val, row) => {
          const payment = payments.find(p => p.shipmentId === row.id);
          if (!payment) return '—';
          return payment.paidDate
            ? `${payment.paidDate} (${formatMoney(payment.paidAmount ?? 0)})`
            : '—';
        },
      },
    ] : []),
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Отгрузок: <strong className="text-gray-800">{orderShipments.length}</strong>
        {!isWarehouse && (
          <>
            {' · '}
            Итого: <strong className="text-gray-800">
              {formatMoney(orderShipments.reduce((s, sh) => s + sh.amount, 0))}
            </strong>
          </>
        )}
      </p>
      <Table columns={columns} data={orderShipments} />
    </div>
  );
}

// ─── Create Shipment Modal ────────────────────────────────────────────────────

function CreateShipmentModal({ isOpen, onClose, order }) {
  const addShipment = useAppStore(s => s.addShipment);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [shipDate, setShipDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantities, setQuantities] = useState({});

  const spec = order?.specification ?? [];

  const handleQtyChange = (id, val) => {
    setQuantities(prev => ({ ...prev, [id]: val }));
  };

  const handleSave = () => {
    if (!invoiceNumber.trim()) return;
    const items = spec
      .map(it => ({ ...it, qty: parseInt(quantities[it.id] ?? 0, 10) }))
      .filter(it => it.qty > 0);
    if (items.length === 0) return;
    const amount = items.reduce((s, it) => s + it.qty * it.price, 0);
    addShipment({
      orderId: order.id,
      orderNumber: order.number,
      counterpartyId: order.counterpartyId,
      date: shipDate,
      invoiceNumber,
      amount,
      items: items.map(it => ({
        specItemId: it.id,
        name: it.name,
        quantity: it.qty,
        price: it.price,
      })),
      status: 'shipped',
      paymentDueDate: null,
      paidAmount: 0,
      paidDate: null,
    });
    setInvoiceNumber('');
    setQuantities({});
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Создать отгрузку"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!invoiceNumber.trim()}
          >
            Создать
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Номер накладной <span className="text-red-400">*</span></label>
          <input
            className="input"
            placeholder="ТН-2026-XXXX"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Дата отгрузки</label>
          <input
            className="input"
            type="date"
            value={shipDate}
            onChange={(e) => setShipDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Количество к отгрузке по позициям</label>
          <div className="space-y-2 mt-1">
            {spec.map(item => {
              const max = item.quantity - (item.shipped ?? 0);
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">
                      Остаток: {max} шт. · {item.article}
                    </p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={max}
                    className="input w-20 text-center py-1.5 text-sm"
                    placeholder="0"
                    value={quantities[item.id] ?? ''}
                    onChange={(e) => handleQtyChange(item.id, e.target.value)}
                    disabled={max <= 0}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Detail Page ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'spec',     label: 'Спецификация' },
  { id: 'packing',  label: 'Упаковочный лист' },
  { id: 'history',  label: 'История отгрузок' },
];

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate    = useNavigate();
  const orders      = useAppStore(s => s.orders);
  const contracts   = useAppStore(s => s.contracts);
  const counterparties = useAppStore(s => s.counterparties);
  const currentService = useAppStore(s => s.currentService);

  const isWarehouse = currentService === 'warehouse';

  const [activeTab,       setActiveTab]       = useState('spec');
  const [shipmentOpen,    setShipmentOpen]    = useState(false);

  const id    = parseInt(orderId, 10);
  const order = orders.find(o => o.id === id);

  if (!order) {
    return (
      <div className="p-6 text-center space-y-4">
        <AlertTriangle size={40} className="text-yellow-400 mx-auto" />
        <p className="text-gray-600">
          Заказ с идентификатором <strong>{orderId}</strong> не найден.
        </p>
        <button className="btn-secondary" onClick={() => navigate('/orders')}>
          Вернуться к списку
        </button>
      </div>
    );
  }

  const contract    = contracts.find(c => c.id === order.contractId);
  const counterparty = counterparties.find(c => c.id === order.counterpartyId);
  const priorityMeta = PRIORITY_MAP[order.priority] ?? { cls: 'badge-gray', label: order.priority };

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/orders')}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors mt-0.5"
            aria-label="Назад"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{order.number}</h1>
              <StatusBadge status={order.status} />
              <span className={priorityMeta.cls}>{priorityMeta.label}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {counterparty && (
                <p className="text-sm text-gray-500">{counterparty.name}</p>
              )}
              {contract && (
                <p className="text-sm text-gray-400">
                  Договор:{' '}
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => navigate(`/contracts/${contract.id}`)}
                  >
                    {contract.number}
                  </button>
                </p>
              )}
              {order.shipmentDeadline && (
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <ClipboardList size={13} className="text-gray-400" />
                  Срок отгрузки: <strong className="text-gray-700 ml-1">{order.shipmentDeadline}</strong>
                </p>
              )}
            </div>
          </div>
        </div>

        {!isWarehouse && (
          <div className="flex flex-col items-end gap-1 pl-10 sm:pl-0">
            <p className="text-sm text-gray-500">
              Сумма: <strong className="text-gray-900">{formatMoney(order.totalAmount)}</strong>
            </p>
            {contract?.paymentDelay && (
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <Calendar size={11} />
                Отсрочка платежа: <strong>{contract.paymentDelay} дн.</strong>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Business flow indicator */}
      <div className="flex items-center gap-0 text-xs overflow-x-auto pb-1">
        {[
          { status: 'planned',            label: 'Запланирован' },
          { status: 'in_production',      label: 'В производстве' },
          { status: 'ready_for_shipment', label: 'Готов к отгрузке' },
          { status: 'shipped',            label: 'Отгружен' },
          { status: 'completed',          label: 'Завершён' },
        ].map((step, idx, arr) => {
          const statuses = ['planned', 'in_production', 'ready_for_shipment', 'shipped', 'completed'];
          const currentIdx = statuses.indexOf(order.status);
          const stepIdx    = statuses.indexOf(step.status);
          const isPast     = stepIdx < currentIdx;
          const isCurrent  = step.status === order.status;
          return (
            <div key={step.status} className="flex items-center">
              <div className={`px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition-all ${
                isCurrent ? 'bg-blue-600 text-white' :
                isPast    ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-400'
              }`}>
                {step.label}
              </div>
              {idx < arr.length - 1 && (
                <div className={`h-px w-4 flex-shrink-0 ${isPast || isCurrent ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {TABS.map(tab => (
            <Tab
              key={tab.id}
              label={tab.label}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'spec' && (
          <SpecificationTab
            order={order}
            onCreateShipment={() => setShipmentOpen(true)}
            isWarehouse={isWarehouse}
          />
        )}
        {activeTab === 'packing' && (
          <PackingListTab
            order={order}
            contract={contract}
            counterparty={counterparty}
            isWarehouse={isWarehouse}
          />
        )}
        {activeTab === 'history' && (
          <ShipmentHistoryTab orderId={id} isWarehouse={isWarehouse} />
        )}
      </div>

      {/* Create Shipment Modal */}
      <CreateShipmentModal
        isOpen={shipmentOpen}
        onClose={() => setShipmentOpen(false)}
        order={order}
      />
    </div>
  );
}
