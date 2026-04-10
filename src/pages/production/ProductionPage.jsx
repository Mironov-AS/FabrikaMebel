import { useState, useMemo, useEffect } from 'react';
import {
  addDays, startOfWeek, endOfWeek, eachDayOfInterval, format,
  isToday, parseISO, differenceInDays, startOfMonth, endOfMonth,
  addWeeks, addMonths,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, CheckCircle2, PackageCheck,
  Play, Clock, AlertTriangle, X, SlidersHorizontal,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import { PRODUCTION_LINES, STATUS_LABELS, formatMoney } from '../../data/mockData';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';

// ─── Tab component ────────────────────────────────────────────────────────────

function Tab({ label, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
      {count != null && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
          active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Priority badge ───────────────────────────────────────────────────────────

const PRIORITY_MAP = {
  high:   { cls: 'badge-red',    label: 'Высокий' },
  medium: { cls: 'badge-yellow', label: 'Средний' },
  low:    { cls: 'badge-green',  label: 'Низкий'  },
};

function PriorityBadge({ priority }) {
  const p = PRIORITY_MAP[priority] ?? { cls: 'badge-gray', label: priority };
  return <span className={p.cls}>{p.label}</span>;
}

// ─── Item status badge ────────────────────────────────────────────────────────

const ITEM_STATUS_LABELS = {
  planned:      { cls: 'badge-gray',   label: 'Запланировано' },
  in_production:{ cls: 'badge-blue',   label: 'В работе' },
  done:         { cls: 'badge-green',  label: 'Готово' },
};

// ─── Order card for production queue ─────────────────────────────────────────

function OrderCard({ order, contracts, counterparties, onSendToProduction, onMarkReady }) {
  const contract = contracts.find(c => c.id === order.contractId || c.id === order.contract_id);
  const cp = counterparties.find(c => c.id === (order.counterpartyId || order.counterparty_id));

  const allDone = order.specification?.length > 0 &&
    order.specification.every(i => i.status === 'done');

  const doneCount = order.specification?.filter(i => i.status === 'done').length ?? 0;
  const totalCount = order.specification?.length ?? 0;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{order.number}</p>
          <p className="text-xs text-gray-500 mt-0.5">{cp?.name ?? '—'}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <PriorityBadge priority={order.priority} />
          <StatusBadge status={order.status} />
        </div>
      </div>

      {/* Contract info */}
      {contract && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-4">
          <span>Договор: <strong className="text-gray-700">{contract.number}</strong></span>
          <span>Отсрочка: <strong className="text-blue-600">{contract.paymentDelay ?? contract.payment_delay} дн.</strong></span>
        </div>
      )}

      {/* Deadline */}
      {order.shipmentDeadline || order.shipment_deadline ? (
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <Clock size={12} />
          Срок отгрузки: <span className="font-medium text-gray-700">{order.shipmentDeadline || order.shipment_deadline}</span>
        </div>
      ) : null}

      {/* Items summary */}
      <div className="space-y-1">
        {(order.specification ?? []).map(item => (
          <div key={item.id} className="flex items-center justify-between text-xs gap-2">
            <span className="text-gray-700 truncate flex-1" title={item.name}>
              {item.name}
            </span>
            <span className="text-gray-400 flex-shrink-0">×{item.quantity}</span>
            <span className={`flex-shrink-0 ${
              item.status === 'done' ? 'text-green-600' :
              item.status === 'in_production' ? 'text-blue-600' :
              'text-gray-400'
            }`}>
              {ITEM_STATUS_LABELS[item.status]?.label ?? item.status}
            </span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Готово позиций: {doneCount}/{totalCount}</span>
            <span className="text-xs font-semibold text-gray-700">{pct}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-blue-500' : 'bg-gray-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {order.status === 'planned' && (
          <button
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
            onClick={() => onSendToProduction(order.id)}
          >
            <Play size={12} />
            Взять в работу
          </button>
        )}
        {order.status === 'in_production' && allDone && (
          <button
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 bg-orange-600 hover:bg-orange-700"
            onClick={() => onMarkReady(order.id)}
          >
            <PackageCheck size={12} />
            Готов к отгрузке
          </button>
        )}
        {order.status === 'in_production' && !allDone && (
          <span className="text-xs text-gray-400 italic">Завершите все позиции для отметки</span>
        )}
      </div>
    </div>
  );
}

// ─── Item status update modal ─────────────────────────────────────────────────

function UpdateItemModal({ isOpen, onClose, order, item, onSave }) {
  const [status, setStatus] = useState(item?.status ?? 'planned');

  useEffect(() => {
    if (item) setStatus(item.status);
  }, [item]);

  if (!item || !order) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Обновить статус позиции"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={() => { onSave(order.id, item.id, status); onClose(); }}>
            Сохранить
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 space-y-1">
          <p><span className="font-medium">Заказ:</span> {order.number}</p>
          <p><span className="font-medium">Позиция:</span> {item.name}</p>
          <p><span className="font-medium">Количество:</span> {item.quantity} шт.</p>
        </div>
        <div>
          <label className="label">Статус производства</label>
          <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="planned">Запланировано</option>
            <option value="in_production">В работе</option>
            <option value="done">Готово</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}

// ─── Orders in production tab ─────────────────────────────────────────────────

function OrdersInProductionTab({ orders, contracts, counterparties, onMarkReady, onUpdateItem }) {
  const [editOrder, setEditOrder]   = useState(null);
  const [editItem,  setEditItem]    = useState(null);
  const [modalOpen, setModalOpen]   = useState(false);

  const openItemEdit = (order, item) => {
    setEditOrder(order);
    setEditItem(item);
    setModalOpen(true);
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <PackageCheck size={40} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">Нет заказов в производстве</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {orders.map(order => {
        const cp = counterparties.find(c => c.id === (order.counterpartyId || order.counterparty_id));
        const contract = contracts.find(c => c.id === (order.contractId || order.contract_id));
        const allDone = order.specification?.length > 0 &&
          order.specification.every(i => i.status === 'done');

        return (
          <div key={order.id} className="card overflow-hidden">
            {/* Order header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{order.number}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {cp?.name ?? '—'}
                    {contract && (
                      <span className="ml-2 text-blue-600">
                        · Договор {contract.number} · Отсрочка {contract.paymentDelay ?? contract.payment_delay} дн.
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <PriorityBadge priority={order.priority} />
                {order.shipmentDeadline && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={12} />
                    {order.shipmentDeadline}
                  </span>
                )}
                {allDone ? (
                  <button
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 bg-orange-600 hover:bg-orange-700 border-orange-700"
                    onClick={() => onMarkReady(order.id)}
                  >
                    <PackageCheck size={12} />
                    Готов к отгрузке
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">
                    {order.specification?.filter(i => i.status === 'done').length ?? 0}/{order.specification?.length ?? 0} позиций готово
                  </span>
                )}
              </div>
            </div>

            {/* Items table */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Позиция</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Артикул</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Кол-во</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Статус</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(order.specification ?? []).map(item => (
                    <tr key={item.id} className={`hover:bg-gray-50/60 transition-colors ${item.status === 'done' ? 'bg-green-50/40' : ''}`}>
                      <td className="px-5 py-3 text-gray-800 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{item.article || '—'}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{item.quantity}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status === 'done' ? 'done' : item.status} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1"
                          onClick={() => openItemEdit(order, item)}
                        >
                          <SlidersHorizontal size={12} />
                          Обновить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <UpdateItemModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditOrder(null); setEditItem(null); }}
        order={editOrder}
        item={editItem}
        onSave={onUpdateItem}
      />
    </div>
  );
}

// ─── Ready for shipment tab ───────────────────────────────────────────────────

function ReadyForShipmentTab({ orders, contracts, counterparties }) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <CheckCircle2 size={40} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">Нет заказов, готовых к отгрузке</p>
        <p className="text-xs mt-1">Они появятся здесь после завершения производства</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {orders.map(order => {
        const cp = counterparties.find(c => c.id === (order.counterpartyId || order.counterparty_id));
        const contract = contracts.find(c => c.id === (order.contractId || order.contract_id));
        return (
          <div key={order.id} className="card p-4 border-l-4 border-orange-400 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{order.number}</p>
                <p className="text-xs text-gray-500 mt-0.5">{cp?.name ?? '—'}</p>
              </div>
              <span className="badge-orange">Готов к отгрузке</span>
            </div>
            {contract && (
              <div className="text-xs text-gray-500 bg-orange-50 rounded-lg px-3 py-2">
                Договор <strong>{contract.number}</strong> · Отсрочка <strong className="text-orange-700">{contract.paymentDelay ?? contract.payment_delay} дн.</strong>
              </div>
            )}
            <div className="text-xs text-gray-500 space-y-1">
              {(order.specification ?? []).map(item => (
                <div key={item.id} className="flex items-center gap-1 text-green-700">
                  <CheckCircle2 size={11} />
                  {item.name} × {item.quantity}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 italic">Передайте на отгрузку через раздел «Отгрузки»</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Gantt helpers ────────────────────────────────────────────────────────────

const VIEW_MODES = [
  { id: 'week',    label: 'Неделя' },
  { id: 'month',   label: 'Месяц' },
  { id: 'quarter', label: 'Квартал' },
];

function getRangeForMode(anchor, mode) {
  if (mode === 'week') {
    return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) };
  }
  if (mode === 'month') {
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }
  const start = startOfMonth(anchor);
  return { start, end: endOfMonth(addMonths(anchor, 2)) };
}

function shiftAnchor(anchor, mode, direction) {
  if (mode === 'week')  return direction > 0 ? addWeeks(anchor, 1)  : addWeeks(anchor, -1);
  if (mode === 'month') return direction > 0 ? addMonths(anchor, 1) : addMonths(anchor, -1);
  return direction > 0 ? addMonths(anchor, 3) : addMonths(anchor, -3);
}

function getBarPosition(taskStart, taskEnd, rangeStart, rangeEnd) {
  const totalDays = differenceInDays(rangeEnd, rangeStart) + 1;
  if (totalDays <= 0) return null;
  const start = parseISO(taskStart);
  const end   = parseISO(taskEnd);
  const clampedStart = start < rangeStart ? rangeStart : start;
  const clampedEnd   = end   > rangeEnd   ? rangeEnd   : end;
  if (clampedEnd < rangeStart || clampedStart > rangeEnd) return null;
  const leftDays  = differenceInDays(clampedStart, rangeStart);
  const widthDays = differenceInDays(clampedEnd, clampedStart) + 1;
  return {
    left:  (leftDays  / totalDays) * 100,
    width: (widthDays / totalDays) * 100,
  };
}

function GanttTab({ tasks }) {
  const [viewMode, setViewMode] = useState('month');
  const [anchor,   setAnchor]   = useState(new Date());
  const [popup,    setPopup]    = useState(null);

  const { start: rangeStart, end: rangeEnd } = getRangeForMode(anchor, viewMode);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const today = new Date();

  const tasksByLine = useMemo(() => {
    const map = {};
    PRODUCTION_LINES.forEach(l => { map[l.id] = []; });
    tasks.forEach(t => { if (map[t.lineId]) map[t.lineId].push(t); });
    return map;
  }, [tasks]);

  const todayPos = getBarPosition(
    format(today, 'yyyy-MM-dd'),
    format(today, 'yyyy-MM-dd'),
    rangeStart, rangeEnd
  );

  const orderColors = useMemo(() => {
    const seen = {};
    tasks.forEach(t => { seen[t.orderNumber] = t.color; });
    return Object.entries(seen);
  }, [tasks]);

  const LEFT_WIDTH = 180;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
          {VIEW_MODES.map(vm => (
            <button
              key={vm.id}
              onClick={() => setViewMode(vm.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === vm.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {vm.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
            onClick={() => setAnchor(a => shiftAnchor(a, viewMode, -1))}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[160px] text-center">
            {format(rangeStart, 'd MMM', { locale: ru })} — {format(rangeEnd, 'd MMM yyyy', { locale: ru })}
          </span>
          <button
            className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
            onClick={() => setAnchor(a => shiftAnchor(a, viewMode, 1))}
          >
            <ChevronRight size={16} />
          </button>
          <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => setAnchor(new Date())}>
            Сегодня
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {orderColors.map(([orderNum, color]) => (
          <div key={orderNum} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-600">{orderNum}</span>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${LEFT_WIDTH + days.length * 28}px` }}>
            <div className="flex border-b border-gray-200 bg-gray-50">
              <div className="flex-shrink-0 px-3 py-2 text-xs font-semibold text-gray-500 border-r border-gray-200" style={{ width: LEFT_WIDTH }}>
                Линия
              </div>
              <div className="flex flex-1">
                {days.map(d => (
                  <div
                    key={d.toISOString()}
                    className={`flex-shrink-0 text-center border-r border-gray-100 py-2 ${isToday(d) ? 'bg-blue-50' : ''}`}
                    style={{ width: 28 }}
                  >
                    <span className={`text-[10px] font-medium ${isToday(d) ? 'text-blue-600' : 'text-gray-500'}`}>
                      {format(d, 'd')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {PRODUCTION_LINES.map(line => {
              const lineTasks = tasksByLine[line.id] ?? [];
              return (
                <div key={line.id} className="flex border-b border-gray-100 last:border-0 group">
                  <div
                    className="flex-shrink-0 px-3 py-3 text-xs font-medium text-gray-700 border-r border-gray-200 bg-white group-hover:bg-gray-50 flex items-center"
                    style={{ width: LEFT_WIDTH }}
                  >
                    <span className="truncate">{line.name}</span>
                  </div>
                  <div className="flex-1 relative bg-white group-hover:bg-gray-50/50" style={{ height: 44 }}>
                    <div className="absolute inset-0 flex">
                      {days.map(d => (
                        <div
                          key={d.toISOString()}
                          className={`flex-shrink-0 h-full border-r border-gray-100 ${isToday(d) ? 'bg-blue-50/40' : ''}`}
                          style={{ width: 28 }}
                        />
                      ))}
                    </div>
                    {todayPos && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-blue-400 z-10 opacity-60"
                        style={{ left: `calc(${todayPos.left}% + ${todayPos.width / 2}%)` }}
                      />
                    )}
                    {lineTasks.map(task => {
                      const pos = getBarPosition(task.start, task.end, rangeStart, rangeEnd);
                      if (!pos) return null;
                      return (
                        <button
                          key={task.id}
                          className="absolute top-2 bottom-2 rounded flex items-center px-1.5 overflow-hidden z-20 cursor-pointer hover:brightness-95 focus:outline-none"
                          style={{ left: `${pos.left}%`, width: `${pos.width}%`, backgroundColor: task.color, minWidth: '2px' }}
                          onClick={() => setPopup(task)}
                          title={task.name}
                        >
                          {pos.width > 5 && (
                            <>
                              <span className="text-white text-[9px] font-medium truncate flex-1">{task.name}</span>
                              <span className="text-white/80 text-[9px] ml-1 flex-shrink-0">{task.progress}%</span>
                            </>
                          )}
                          <div className="absolute inset-0 left-0 rounded opacity-30 bg-white" style={{ width: `${task.progress}%` }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {popup && (
        <div className="fixed inset-0 z-40 flex items-center justify-center" onClick={() => setPopup(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 bg-white rounded-xl shadow-xl p-5 w-72 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">{popup.name}</p>
              <button onClick={() => setPopup(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="space-y-1.5 text-xs text-gray-600">
              <p><span className="text-gray-400">Заказ:</span> {popup.orderNumber}</p>
              <p><span className="text-gray-400">Начало:</span> {popup.start}</p>
              <p><span className="text-gray-400">Конец:</span> {popup.end}</p>
              <p><span className="text-gray-400">Ответственный:</span> {popup.responsible}</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Прогресс</span>
                <span className="text-xs font-semibold text-gray-800">{popup.progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${popup.progress}%`, backgroundColor: popup.color }} />
              </div>
            </div>
            <StatusBadge status={popup.status} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductionPage() {
  const orders         = useAppStore(s => s.orders);
  const contracts      = useAppStore(s => s.contracts);
  const counterparties = useAppStore(s => s.counterparties);
  const tasks          = useAppStore(s => s.productionTasks);
  const markOrderReadyForShipment = useAppStore(s => s.markOrderReadyForShipment);
  const sendOrderToProduction     = useAppStore(s => s.sendOrderToProduction);
  const updateOrderItemStatus     = useAppStore(s => s.updateOrderItemStatus);

  const [activeTab, setActiveTab] = useState('queue');

  const queueOrders   = orders.filter(o => o.status === 'planned');
  const inProdOrders  = orders.filter(o => o.status === 'in_production');
  const readyOrders   = orders.filter(o => o.status === 'ready_for_shipment');

  const TABS = [
    { id: 'queue',   label: 'Очередь производства', count: queueOrders.length },
    { id: 'inprod',  label: 'В производстве',        count: inProdOrders.length },
    { id: 'ready',   label: 'Готово к отгрузке',     count: readyOrders.length },
    { id: 'gantt',   label: 'Диаграмма Ганта' },
  ];

  const handleSendToProduction = async (orderId) => {
    try { await sendOrderToProduction(orderId); } catch (e) { console.error(e); }
  };

  const handleMarkReady = async (orderId) => {
    try { await markOrderReadyForShipment(orderId); } catch (e) { console.error(e); }
  };

  const handleUpdateItem = async (orderId, itemId, status) => {
    try { await updateOrderItemStatus(orderId, itemId, status); } catch (e) { console.error(e); }
  };

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Производство</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Управление производственными заказами
          </p>
        </div>
        {readyOrders.length > 0 && (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="text-orange-500" />
            <span className="text-xs text-orange-700 font-medium">
              {readyOrders.length} заказ(а) ожидают отгрузки
            </span>
          </div>
        )}
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
              count={tab.count}
            />
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'queue' && (
          queueOrders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Clock size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Очередь пуста</p>
              <p className="text-xs mt-1">Все запланированные заказы уже взяты в работу</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {queueOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  contracts={contracts}
                  counterparties={counterparties}
                  onSendToProduction={handleSendToProduction}
                  onMarkReady={handleMarkReady}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'inprod' && (
          <OrdersInProductionTab
            orders={inProdOrders}
            contracts={contracts}
            counterparties={counterparties}
            onMarkReady={handleMarkReady}
            onUpdateItem={handleUpdateItem}
          />
        )}

        {activeTab === 'ready' && (
          <ReadyForShipmentTab
            orders={readyOrders}
            contracts={contracts}
            counterparties={counterparties}
          />
        )}

        {activeTab === 'gantt' && <GanttTab tasks={tasks} />}
      </div>
    </div>
  );
}
