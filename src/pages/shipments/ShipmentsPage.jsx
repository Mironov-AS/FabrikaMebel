import { useState, useMemo, useRef } from 'react';
import {
  Truck, Plus, Calendar, Clock, CheckCircle, AlertCircle,
  PackageCheck, ChevronLeft, ChevronRight, MapPin, User,
  Phone, Printer, X, Users, Car, List,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import { formatMoney } from '../../data/mockData';
import { daysDiff, addDays } from '../../utils/date';
import { WAREHOUSE_SERVICE_ID } from '../../constants/services';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import StatCard from '../../components/ui/StatCard';

function isOverdue(paymentDueDate, paidAmount, amount) {
  if (!paymentDueDate || paidAmount >= amount) return false;
  return new Date(paymentDueDate) < new Date();
}

const MONTH_NAMES_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAY_NAMES_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

// ─── New Shipment Modal ───────────────────────────────────────────────────────
function NewShipmentModal({ isOpen, onClose, orders, contracts, counterparties, onSave, isWarehouse, shipments }) {
  const [form, setForm] = useState({
    orderId: '',
    scheduledDate: new Date().toISOString().slice(0, 10),
    invoiceNumber: '',
    amount: '',
    deliveryType: 'pickup',
    deliveryAddress: '',
  });

  const setField = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const selectedOrder = orders.find(o => o.id === parseInt(form.orderId, 10));
  const selectedContract = selectedOrder
    ? contracts.find(c => c.id === (selectedOrder.contractId || selectedOrder.contract_id))
    : null;
  const cp = selectedOrder
    ? counterparties.find(c => c.id === (selectedOrder.counterpartyId || selectedOrder.counterparty_id))
    : null;

  const handleOrderChange = (e) => {
    const ordId = e.target.value;
    const ord = orders.find(o => o.id === parseInt(ordId, 10));
    const cpForOrder = ord ? counterparties.find(c => c.id === (ord.counterpartyId || ord.counterparty_id)) : null;
    // Check if a shipment already exists for this order — pre-fill its data
    const existingShipment = ord && shipments ? shipments.find(s => s.orderId === ord.id || s.order_id === ord.id) : null;
    if (existingShipment) {
      setForm(prev => ({
        ...prev,
        orderId: ordId,
        scheduledDate: existingShipment.scheduledDate || existingShipment.date || ord?.shipmentDeadline || ord?.shipment_deadline || prev.scheduledDate,
        invoiceNumber: existingShipment.invoiceNumber || existingShipment.invoice_number || '',
        amount: existingShipment.amount ? String(existingShipment.amount) : prev.amount,
        deliveryType: existingShipment.deliveryType || existingShipment.delivery_type || 'pickup',
        deliveryAddress: existingShipment.deliveryAddress || existingShipment.delivery_address || (cpForOrder?.address || ''),
      }));
    } else {
      setForm(prev => ({
        ...prev,
        orderId: ordId,
        scheduledDate: ord?.shipmentDeadline || ord?.shipment_deadline || prev.scheduledDate,
        deliveryAddress: prev.deliveryType === 'delivery' ? (cpForOrder?.address || '') : prev.deliveryAddress,
      }));
    }
  };

  const handleDeliveryTypeChange = (type) => {
    setForm(prev => ({
      ...prev,
      deliveryType: type,
      deliveryAddress: type === 'delivery' ? (cp?.address || '') : '',
    }));
  };

  const paymentDelay = selectedContract?.paymentDelay ?? selectedContract?.payment_delay ?? 30;
  const paymentDueDate = form.scheduledDate ? addDays(form.scheduledDate, paymentDelay) : null;
  const autoAmount = selectedOrder?.totalAmount ?? 0;

  const handleClose = () => {
    setForm({
      orderId: '',
      scheduledDate: new Date().toISOString().slice(0, 10),
      invoiceNumber: '',
      amount: '',
      deliveryType: 'pickup',
      deliveryAddress: '',
    });
    onClose();
  };

  const handleSave = () => {
    if (!form.orderId || !form.invoiceNumber) return;
    const effectiveAmount = isWarehouse ? autoAmount : parseFloat(form.amount);
    if (!isWarehouse && !(effectiveAmount > 0)) return;
    const order = selectedOrder;
    onSave({
      orderId: order.id,
      orderNumber: order.number,
      counterpartyId: order.counterpartyId || order.counterparty_id,
      date: form.scheduledDate,
      scheduledDate: form.scheduledDate,
      invoiceNumber: form.invoiceNumber,
      amount: effectiveAmount,
      deliveryType: form.deliveryType,
      deliveryAddress: form.deliveryAddress,
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
            <select className="input" value={form.orderId} onChange={handleOrderChange}>
              <option value="">— Выберите заказ —</option>
              {orders.map(o => {
                const c = contracts.find(c => c.id === (o.contractId || o.contract_id));
                const cp2 = counterparties.find(cp2 => cp2.id === (o.counterpartyId || o.counterparty_id));
                return (
                  <option key={o.id} value={o.id}>
                    {isWarehouse
                      ? `${o.number} — ${cp2?.name ?? '?'}`
                      : `${o.number} — ${cp2?.name ?? '?'} (отсрочка ${c?.paymentDelay ?? c?.payment_delay ?? '?'} дн.)`}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {selectedOrder && shipments?.find(s => s.orderId === selectedOrder.id || s.order_id === selectedOrder.id) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-2 text-sm">
            <CheckCircle size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-blue-800 text-xs">По этому заказу уже оформлена отгрузка — данные подтянуты автоматически.</p>
          </div>
        )}

        {selectedOrder && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 space-y-1.5 text-sm">
            <p className="font-medium text-orange-800">{selectedOrder.number}</p>
            <p className="text-orange-700 text-xs">Контрагент: {cp?.name ?? '—'}</p>
            {selectedContract && (
              <p className="text-orange-700 text-xs">
                Договор: <strong>{selectedContract.number}</strong>
                {!isWarehouse && ` · Отсрочка: ${paymentDelay} дн.`}
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

        {/* Delivery type toggle */}
        <div>
          <label className="label">Способ доставки <span className="text-red-400">*</span></label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleDeliveryTypeChange('pickup')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
                form.deliveryType === 'pickup'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <PackageCheck size={16} />
              Самовывоз
            </button>
            <button
              type="button"
              onClick={() => handleDeliveryTypeChange('delivery')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
                form.deliveryType === 'delivery'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Truck size={16} />
              Доставка
            </button>
          </div>
        </div>

        {/* Delivery address */}
        {form.deliveryType === 'delivery' && (
          <div>
            <label className="label">Адрес доставки</label>
            <input
              className="input"
              placeholder="Укажите адрес доставки"
              value={form.deliveryAddress}
              onChange={setField('deliveryAddress')}
            />
            {cp?.address && form.deliveryAddress !== cp.address && (
              <button
                type="button"
                className="mt-1 text-xs text-blue-600 hover:underline"
                onClick={() => setForm(prev => ({ ...prev, deliveryAddress: cp.address }))}
              >
                Использовать адрес контрагента: {cp.address}
              </button>
            )}
          </div>
        )}

        {/* Scheduled date */}
        <div>
          <label className="label">Планируемая дата отгрузки <span className="text-red-400">*</span></label>
          <input className="input" type="date" value={form.scheduledDate} onChange={setField('scheduledDate')} />
          {selectedOrder && (selectedOrder.shipmentDeadline || selectedOrder.shipment_deadline) && (
            <p className="text-xs text-gray-500 mt-1">
              Срок по заказу: {selectedOrder.shipmentDeadline || selectedOrder.shipment_deadline}
            </p>
          )}
        </div>

        {!isWarehouse && paymentDueDate && selectedOrder && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <Calendar size={16} className="text-blue-500 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-800">Дата оплаты рассчитана автоматически</p>
              <p className="text-blue-700 text-xs mt-0.5">
                {form.scheduledDate} + {paymentDelay} дн. = <strong>{paymentDueDate}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Invoice number */}
        <div>
          <label className="label">Номер накладной <span className="text-red-400">*</span></label>
          <input className="input" placeholder="ТН-2026-XXXX" value={form.invoiceNumber} onChange={setField('invoiceNumber')} />
        </div>

        {!isWarehouse && (
          <div>
            <label className="label">Сумма отгрузки (₽) <span className="text-red-400">*</span></label>
            <input
              className="input"
              type="number"
              min="1"
              placeholder="0"
              value={form.amount}
              onChange={setField('amount')}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Waybill Print Modal ──────────────────────────────────────────────────────
function WaybillModal({ isOpen, onClose, route, counterparties }) {
  const printRef = useRef();

  if (!route) return null;

  const handlePrint = () => window.print();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Путевой лист" size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Закрыть</button>
          <button className="btn-primary flex items-center gap-2" onClick={handlePrint}>
            <Printer size={14} /> Печать
          </button>
        </>
      }
    >
      <div ref={printRef} className="waybill-content">
        {/* Header */}
        <div className="text-center mb-6 border-b pb-4">
          <h2 className="text-xl font-bold">ПУТЕВОЙ ЛИСТ</h2>
          <p className="text-sm text-gray-600 mt-1">Дата: {route.routeDate}</p>
        </div>

        {/* Driver info */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Car size={16} /> Водитель
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">ФИО:</span>
              <span className="ml-2 font-medium">{route.driver?.name || '—'}</span>
            </div>
            <div>
              <span className="text-gray-500">Телефон:</span>
              <span className="ml-2 font-medium">{route.driver?.phone || '—'}</span>
            </div>
            {route.driver?.vehicle && (
              <div className="col-span-2">
                <span className="text-gray-500">Автомобиль:</span>
                <span className="ml-2 font-medium">{route.driver.vehicle}</span>
              </div>
            )}
          </div>
        </div>

        {/* Deliveries */}
        <h3 className="font-semibold text-gray-800 mb-3">Адреса доставки:</h3>
        <div className="space-y-4">
          {(route.shipments || []).map((shipment, idx) => (
            <div key={shipment.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{shipment.counterpartyName}</p>
                    <p className="text-sm text-gray-500">{shipment.invoiceNumber} · {shipment.orderNumber}</p>
                  </div>
                </div>
              </div>
              <div className="ml-11 space-y-2 text-sm">
                <div className="flex items-start gap-2 text-gray-700">
                  <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <span>{shipment.deliveryAddress || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone size={14} className="text-gray-400 flex-shrink-0" />
                  <span>{shipment.counterpartyPhone || '—'}</span>
                </div>
                {shipment.items && shipment.items.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-1">Товары:</p>
                    {shipment.items.map((item, i) => (
                      <p key={i} className="text-xs text-gray-600 ml-2">
                        · {item.name} — {item.quantity} шт.
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-3 ml-11 flex items-center gap-8 text-sm text-gray-400">
                <span>Подпись получателя: ________________</span>
                <span>Время: _______</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer signature */}
        <div className="mt-8 pt-4 border-t grid grid-cols-2 gap-8 text-sm text-gray-600">
          <div>
            <p>Водитель: _________________ / {route.driver?.name || '____'} /</p>
          </div>
          <div>
            <p>Диспетчер: _________________________</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Driver Assignment Modal ──────────────────────────────────────────────────
function DriverAssignmentModal({ isOpen, onClose, shipments, routeDate, drivers, onCreateRoute, onAddDriver }) {
  const [selectedShipmentIds, setSelectedShipmentIds] = useState(shipments.map(s => s.id));
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: '', phone: '', vehicle: '' });
  const [saving, setSaving] = useState(false);

  const toggleShipment = (id) => {
    setSelectedShipmentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAddDriver = async () => {
    if (!newDriver.name) return;
    const driver = await onAddDriver(newDriver);
    setSelectedDriverId(String(driver.id));
    setShowAddDriver(false);
    setNewDriver({ name: '', phone: '', vehicle: '' });
  };

  const handleSave = async () => {
    if (selectedShipmentIds.length === 0) return;
    setSaving(true);
    try {
      await onCreateRoute({
        driverId: selectedDriverId ? parseInt(selectedDriverId) : null,
        routeDate,
        shipmentIds: selectedShipmentIds,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Создать маршрут на ${routeDate}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || selectedShipmentIds.length === 0}>
            {saving ? 'Сохранение...' : 'Создать маршрут'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Shipment selection */}
        <div>
          <label className="label">Отгрузки для включения в маршрут</label>
          <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
            {shipments.map(s => (
              <label key={s.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedShipmentIds.includes(s.id)}
                  onChange={() => toggleShipment(s.id)}
                  className="mt-0.5"
                />
                <div className="text-sm">
                  <p className="font-medium text-gray-800">{s.counterparty?.name || '—'}</p>
                  <p className="text-gray-500 text-xs">{s.invoiceNumber} · {s.orderNumber}</p>
                  {s.deliveryAddress && (
                    <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> {s.deliveryAddress}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Driver selection */}
        <div>
          <label className="label">Водитель</label>
          {!showAddDriver ? (
            <div className="flex gap-2">
              <select className="input flex-1" value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}>
                <option value="">— Выберите водителя —</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}{d.phone ? ` (${d.phone})` : ''}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary px-3 whitespace-nowrap"
                onClick={() => setShowAddDriver(true)}
              >
                + Новый
              </button>
            </div>
          ) : (
            <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
              <p className="text-xs font-medium text-gray-600">Новый водитель</p>
              <input className="input" placeholder="ФИО *" value={newDriver.name} onChange={e => setNewDriver(p => ({ ...p, name: e.target.value }))} />
              <input className="input" placeholder="Телефон" value={newDriver.phone} onChange={e => setNewDriver(p => ({ ...p, phone: e.target.value }))} />
              <input className="input" placeholder="Автомобиль (марка, гос. номер)" value={newDriver.vehicle} onChange={e => setNewDriver(p => ({ ...p, vehicle: e.target.value }))} />
              <div className="flex gap-2">
                <button className="btn-primary text-xs px-3 py-1.5" onClick={handleAddDriver} disabled={!newDriver.name}>Добавить</button>
                <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => setShowAddDriver(false)}>Отмена</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Day Detail Panel ─────────────────────────────────────────────────────────
function DayDetailPanel({ date, shipments, counterparties, routes, drivers, onCreateRoute, onAddDriver, onPrintWaybill }) {
  const [showDriverModal, setShowDriverModal] = useState(false);

  const dayShipments = shipments.filter(s => (s.scheduledDate || s.date) === date);
  const pickupShipments = dayShipments.filter(s => s.deliveryType === 'pickup' || !s.deliveryType);
  const deliveryShipments = dayShipments.filter(s => s.deliveryType === 'delivery');

  const enriched = dayShipments.map(s => ({
    ...s,
    counterparty: counterparties.find(c => c.id === s.counterpartyId),
  }));
  const enrichedDeliveries = enriched.filter(s => s.deliveryType === 'delivery');

  const dayRoutes = routes.filter(r => r.routeDate === date);

  const formatDate = (d) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (dayShipments.length === 0) {
    return (
      <div className="p-6 text-center text-gray-400">
        <Calendar size={32} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">На {formatDate(date)} отгрузок не запланировано</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-semibold text-gray-900">{formatDate(date)}</h3>

      {/* Pickup shipments */}
      {pickupShipments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <PackageCheck size={13} /> Самовывоз ({pickupShipments.length})
          </p>
          <div className="space-y-2">
            {enriched.filter(s => s.deliveryType === 'pickup' || !s.deliveryType).map(s => (
              <div key={s.id} className="border rounded-lg p-3 bg-blue-50 border-blue-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{s.counterparty?.name || '—'}</p>
                    <p className="text-xs text-gray-500">{s.invoiceNumber} · {s.orderNumber}</p>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Самовывоз</span>
                </div>
                <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                  {(s.items || []).slice(0, 3).map((item, i) => (
                    <p key={i} className="truncate">· {item.name} × {item.quantity}</p>
                  ))}
                  {(s.items || []).length > 3 && <p className="text-gray-400">...ещё {s.items.length - 3}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery shipments */}
      {deliveryShipments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Truck size={13} /> Доставка ({deliveryShipments.length})
            </p>
            {enrichedDeliveries.length > 0 && (
              <button
                className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 flex items-center gap-1"
                onClick={() => setShowDriverModal(true)}
              >
                <Users size={11} /> Назначить водителя
              </button>
            )}
          </div>
          <div className="space-y-2">
            {enrichedDeliveries.map(s => (
              <div key={s.id} className="border rounded-lg p-3 bg-green-50 border-green-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{s.counterparty?.name || '—'}</p>
                    <p className="text-xs text-gray-500">{s.invoiceNumber} · {s.orderNumber}</p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Доставка</span>
                </div>
                {s.deliveryAddress && (
                  <p className="mt-1.5 text-xs text-gray-600 flex items-start gap-1">
                    <MapPin size={11} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    {s.deliveryAddress}
                  </p>
                )}
                {s.counterparty?.phone && (
                  <p className="mt-0.5 text-xs text-gray-600 flex items-center gap-1">
                    <Phone size={11} className="text-gray-400 flex-shrink-0" />
                    {s.counterparty.phone}
                  </p>
                )}
                <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                  {(s.items || []).slice(0, 3).map((item, i) => (
                    <p key={i} className="truncate">· {item.name} × {item.quantity}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing routes */}
      {dayRoutes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Car size={13} /> Маршруты ({dayRoutes.length})
          </p>
          {dayRoutes.map(route => (
            <div key={route.id} className="border rounded-lg p-3 bg-yellow-50 border-yellow-200 mb-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-gray-900">
                    Маршрут #{route.id}
                    {route.driver && <span className="text-gray-600 font-normal"> · {route.driver.name}</span>}
                  </p>
                  <p className="text-xs text-gray-500">{route.shipments?.length || 0} адресов доставки</p>
                </div>
                <button
                  className="text-xs bg-yellow-600 text-white px-2.5 py-1 rounded-lg hover:bg-yellow-700 flex items-center gap-1"
                  onClick={() => onPrintWaybill(route)}
                >
                  <Printer size={11} /> Путевой лист
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Driver assignment modal */}
      {showDriverModal && (
        <DriverAssignmentModal
          isOpen={showDriverModal}
          onClose={() => setShowDriverModal(false)}
          shipments={enrichedDeliveries}
          routeDate={date}
          drivers={drivers}
          onCreateRoute={onCreateRoute}
          onAddDriver={onAddDriver}
        />
      )}
    </div>
  );
}

// ─── Shipment Calendar ────────────────────────────────────────────────────────
function ShipmentCalendar({ shipments, counterparties, routes, drivers, onCreateRoute, onAddDriver, onPrintWaybill }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Start from Monday
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // Convert to Mon=0

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(new Date(year, month, d));
  }

  const getDateStr = (d) => {
    if (!d) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const todayStr = (() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();

  const shipmentsByDate = useMemo(() => {
    const map = {};
    shipments.forEach(s => {
      const d = s.scheduledDate || s.date;
      if (!d) return;
      if (!map[d]) map[d] = { pickup: 0, delivery: 0 };
      if (s.deliveryType === 'delivery') map[d].delivery++;
      else map[d].pickup++;
    });
    return map;
  }, [shipments]);

  return (
    <div className="flex gap-4">
      {/* Calendar grid */}
      <div className="flex-1 min-w-0">
        <div className="card p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg" onClick={prevMonth}>
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-base font-semibold text-gray-900">
              {MONTH_NAMES_RU[month]} {year}
            </h2>
            <button className="p-2 hover:bg-gray-100 rounded-lg" onClick={nextMonth}>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day name headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES_RU.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
            {cells.map((date, idx) => {
              const dateStr = getDateStr(date);
              const counts = dateStr ? shipmentsByDate[dateStr] : null;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const hasShipments = counts && (counts.pickup + counts.delivery) > 0;

              return (
                <div
                  key={idx}
                  className={`bg-white min-h-[70px] p-1.5 ${date ? 'cursor-pointer hover:bg-gray-50' : ''} ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
                  onClick={() => date && setSelectedDate(dateStr)}
                >
                  {date && (
                    <>
                      <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
                      }`}>
                        {date.getDate()}
                      </div>
                      {hasShipments && (
                        <div className="space-y-0.5">
                          {counts.delivery > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></div>
                              <span className="text-xs text-green-700 font-medium truncate">{counts.delivery} дост.</span>
                            </div>
                          )}
                          {counts.pickup > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></div>
                              <span className="text-xs text-blue-700 font-medium truncate">{counts.pickup} выв.</span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              Доставка
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
              Самовывоз
            </div>
          </div>
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDate && (
        <div className="w-96 flex-shrink-0">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Отгрузки на день</h3>
              <button className="p-1 hover:bg-gray-200 rounded" onClick={() => setSelectedDate(null)}>
                <X size={14} />
              </button>
            </div>
            <DayDetailPanel
              date={selectedDate}
              shipments={shipments}
              counterparties={counterparties}
              routes={routes}
              drivers={drivers}
              onCreateRoute={onCreateRoute}
              onAddDriver={onAddDriver}
              onPrintWaybill={onPrintWaybill}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ShipmentsPage() {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [waybillRoute, setWaybillRoute] = useState(null);
  const [deliveryRoutes, setDeliveryRoutes] = useState([]);

  const { shipments, orders, contracts, counterparties, addShipment, addDriver } = useAppStore();
  const drivers = useAppStore(s => s.drivers) || [];
  const currentService = useAppStore(s => s.currentService);
  const isWarehouse = currentService === WAREHOUSE_SERVICE_ID;

  const readyOrders = orders.filter(o => o.status === 'ready_for_shipment');

  const getCounterparty = (id) => counterparties.find(c => c.id === id);
  const getOrder = (id) => orders.find(o => o.id === id);
  const getContract = (orderId) => {
    const o = getOrder(orderId);
    return o ? contracts.find(c => c.id === (o.contractId || o.contract_id)) : null;
  };

  const enriched = shipments.map(s => ({
    ...s,
    overdue: isOverdue(s.paymentDueDate, s.paidAmount, s.amount),
    counterparty: getCounterparty(s.counterpartyId),
    order: getOrder(s.orderId),
    contract: getContract(s.orderId),
  }));

  const totalShipped = enriched.reduce((sum, s) => sum + s.amount, 0);
  const overdueItems = enriched.filter(s => s.overdue);
  const totalOverdue = overdueItems.reduce((sum, s) => sum + s.amount - s.paidAmount, 0);
  const pendingItems = enriched.filter(s => s.paidAmount < s.amount && !s.overdue);
  const totalPending = pendingItems.reduce((sum, s) => sum + s.amount - s.paidAmount, 0);

  const handleSave = async (data) => {
    try { await addShipment(data); } catch (e) { console.error(e); }
  };

  const handleCreateRoute = async (data) => {
    try {
      const { deliveryRoutesApi } = await import('../../services/api');
      const res = await deliveryRoutesApi.create(data);
      setDeliveryRoutes(prev => [...prev, res.data]);
    } catch (e) {
      console.error(e);
      // Fallback: build local route object for immediate UI feedback
      setDeliveryRoutes(prev => [...prev, {
        id: Date.now(),
        driverId: data.driverId,
        driver: drivers.find(d => d.id === data.driverId) || null,
        routeDate: data.routeDate,
        status: 'planned',
        shipments: (data.shipmentIds || []).map(id => {
          const s = enriched.find(sh => sh.id === id);
          return s ? {
            id: s.id,
            orderNumber: s.orderNumber,
            invoiceNumber: s.invoiceNumber,
            counterpartyName: s.counterparty?.name || '',
            counterpartyPhone: s.counterparty?.phone || '',
            deliveryAddress: s.deliveryAddress || s.counterparty?.address || '',
            items: s.items || [],
          } : null;
        }).filter(Boolean),
      }]);
    }
  };

  const handleAddDriver = async (driverData) => {
    try {
      if (addDriver) return await addDriver(driverData);
      const { driversApi } = await import('../../services/api');
      const res = await driversApi.create(driverData);
      return res.data;
    } catch (e) {
      console.error(e);
      return { id: Date.now(), ...driverData };
    }
  };

  // Load delivery routes on mount
  useMemo(() => {
    import('../../services/api').then(({ deliveryRoutesApi }) => {
      deliveryRoutesApi.list().then(res => setDeliveryRoutes(res.data || [])).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tableHeaders = isWarehouse
    ? ['Дата', 'Накладная', 'Заказ', 'Контрагент', 'Способ', 'Адрес', 'Позиции']
    : ['Дата', 'Накладная', 'Заказ', 'Контрагент', 'Способ', 'Позиции', 'Сумма', 'Статус оплаты', 'Срок оплаты'];

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Отгрузки</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isWarehouse
              ? 'Планирование и учёт отгрузок.'
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

      {/* Stats */}
      {isWarehouse ? (
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

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('list')}
        >
          <List size={15} /> Список отгрузок
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'calendar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('calendar')}
        >
          <Calendar size={15} /> Календарь отгрузок
        </button>
      </div>

      {/* List tab */}
      {activeTab === 'list' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {tableHeaders.map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
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
                    <tr key={s.id} className={!isWarehouse && s.overdue ? 'bg-red-50' : 'hover:bg-gray-50 transition-colors'}>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{s.scheduledDate || s.date}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{s.invoiceNumber}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{s.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{s.counterparty?.name ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {s.deliveryType === 'delivery' ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            <Truck size={10} /> Доставка
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            <PackageCheck size={10} /> Самовывоз
                          </span>
                        )}
                      </td>
                      {isWarehouse && (
                        <td className="px-4 py-3 text-gray-600 text-xs max-w-[200px] truncate">
                          {s.deliveryType === 'delivery' ? (s.deliveryAddress || s.counterparty?.address || '—') : '—'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-600 max-w-[200px]">
                        <ul className="space-y-0.5">
                          {(s.items ?? []).map((item, i) => (
                            <li key={i} className="truncate text-xs">{item.name} × {item.quantity}</li>
                          ))}
                        </ul>
                      </td>
                      {!isWarehouse && (
                        <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{formatMoney(s.amount)}</td>
                      )}
                      {!isWarehouse && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          {s.paidAmount >= s.amount ? (
                            <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                              <CheckCircle size={12} /> Оплачено {s.paidDate}
                            </span>
                          ) : s.overdue ? (
                            <>
                              <StatusBadge status="overdue" />
                              <span className="text-xs text-red-600 flex items-center gap-1 mt-1">
                                <AlertCircle size={11} />
                                {daysDiff(s.paymentDueDate)} дн. просрочки
                              </span>
                            </>
                          ) : (
                            <StatusBadge status="pending" />
                          )}
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calendar tab */}
      {activeTab === 'calendar' && (
        <ShipmentCalendar
          shipments={enriched}
          counterparties={counterparties}
          routes={deliveryRoutes}
          drivers={drivers}
          onCreateRoute={handleCreateRoute}
          onAddDriver={handleAddDriver}
          onPrintWaybill={setWaybillRoute}
        />
      )}

      <NewShipmentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        orders={readyOrders}
        contracts={contracts}
        counterparties={counterparties}
        shipments={shipments}
        onSave={handleSave}
        isWarehouse={isWarehouse}
      />

      {waybillRoute && (
        <WaybillModal
          isOpen={!!waybillRoute}
          onClose={() => setWaybillRoute(null)}
          route={waybillRoute}
          counterparties={counterparties}
        />
      )}
    </div>
  );
}
