import { useState } from 'react';
import { Truck, Calendar, PackageCheck, CheckCircle } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { addDays } from '../../utils/date';

export default function NewShipmentModal({ isOpen, onClose, orders, contracts, counterparties, onSave, isWarehouse, shipments }) {
  const [form, setForm] = useState({
    orderId: '',
    scheduledDate: new Date().toISOString().slice(0, 10),
    invoiceNumber: '',
    amount: '',
    deliveryType: 'pickup',
    deliveryAddress: '',
  });
  const [shipQuantities, setShipQuantities] = useState({});

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
    if (ord) {
      const initQtys = {};
      (ord.specification ?? []).forEach(i => {
        const rem = i.quantity - (i.shipped || 0);
        if (rem > 0) initQtys[i.id] = rem;
      });
      setShipQuantities(initQtys);
    } else {
      setShipQuantities({});
    }
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

  const remainingItems = (selectedOrder?.specification ?? [])
    .map(i => ({ ...i, remaining: i.quantity - (i.shipped || 0) }))
    .filter(i => i.remaining > 0);
  const isPartiallyShipped = selectedOrder && (selectedOrder.specification ?? []).some(i => (i.shipped || 0) > 0);

  const itemsToShip = remainingItems.map(i => ({ ...i, qty: i.remaining })).filter(i => i.qty > 0);
  const autoAmount = itemsToShip.reduce((sum, i) => sum + i.qty * (i.price || 0), 0);

  const handleClose = () => {
    setForm({
      orderId: '',
      scheduledDate: new Date().toISOString().slice(0, 10),
      invoiceNumber: '',
      amount: '',
      deliveryType: 'pickup',
      deliveryAddress: '',
    });
    setShipQuantities({});
    onClose();
  };

  const handleSave = () => {
    if (!form.orderId || itemsToShip.length === 0) return;
    const effectiveAmount = isWarehouse ? autoAmount : parseFloat(form.amount);
    if (!isWarehouse && !(effectiveAmount > 0)) return;
    onSave({
      orderId: selectedOrder.id,
      orderNumber: selectedOrder.number,
      counterpartyId: selectedOrder.counterpartyId || selectedOrder.counterparty_id,
      date: form.scheduledDate,
      scheduledDate: form.scheduledDate,
      invoiceNumber: form.invoiceNumber,
      amount: effectiveAmount,
      deliveryType: form.deliveryType,
      deliveryAddress: form.deliveryAddress,
      items: itemsToShip.map(i => ({
        specItemId: i.id,
        name: i.name,
        quantity: i.qty,
        price: i.price,
      })),
    });
    handleClose();
  };

  const canSave = isWarehouse
    ? form.orderId && itemsToShip.length > 0
    : form.orderId && parseFloat(form.amount) > 0 && itemsToShip.length > 0;

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

        {selectedOrder && isPartiallyShipped && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-2 text-sm">
            <CheckCircle size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-blue-800 text-xs">По этому заказу уже оформлены отгрузки — показаны остатки к отгрузке.</p>
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
            <div className="pt-1">
              <p className="text-xs font-medium text-orange-800 mb-1.5">Позиции к отгрузке:</p>
              {remainingItems.length === 0 ? (
                <p className="text-xs text-red-600 font-medium ml-1">Все позиции по этому заказу уже отгружены</p>
              ) : (
                <div className="space-y-1.5">
                  {remainingItems.map(i => (
                    <div key={i.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-orange-800 truncate">{i.name}</p>
                        {i.shipped > 0 && (
                          <p className="text-xs text-orange-500">отгружено ранее: {i.shipped} из {i.quantity}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs font-semibold text-orange-900">{i.remaining} шт.</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {isWarehouse && itemsToShip.length > 0 && (
                <p className="text-xs text-orange-700 mt-2 font-medium">
                  Сумма отгрузки: {new Intl.NumberFormat('ru-RU').format(autoAmount)} ₽
                </p>
              )}
            </div>
          </div>
        )}

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

        <div>
          <label className="label">Номер накладной</label>
          <input className="input" placeholder="ТН-2026-XXXX (необязательно)" value={form.invoiceNumber} onChange={setField('invoiceNumber')} />
        </div>

        {!isWarehouse && (
          <div>
            <label className="label">Сумма отгрузки (₽) <span className="text-red-400">*</span></label>
            <input
              className="input" type="number" min="1" placeholder="0"
              value={form.amount}
              onChange={setField('amount')}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
