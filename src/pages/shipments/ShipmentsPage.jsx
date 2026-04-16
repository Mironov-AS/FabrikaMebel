import { useState, useMemo } from 'react';
import {
  Truck, Clock, AlertCircle, PackageCheck, CheckCircle, List, Calendar,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import { formatMoney } from '../../data/mockData';
import { daysDiff } from '../../utils/date';
import { WAREHOUSE_SERVICE_ID } from '../../constants/services';
import StatusBadge from '../../components/ui/StatusBadge';
import StatCard from '../../components/ui/StatCard';
import NewShipmentModal from './NewShipmentModal';
import WaybillModal from './WaybillModal';
import ShipmentCalendar from './ShipmentCalendar';

function isOverdue(paymentDueDate, paidAmount, amount) {
  if (!paymentDueDate || paidAmount >= amount) return false;
  return new Date(paymentDueDate) < new Date();
}

export default function ShipmentsPage() {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [waybillRoute, setWaybillRoute] = useState(null);
  const [deliveryRoutes, setDeliveryRoutes] = useState([]);

  const { shipments, orders, contracts, counterparties, addShipment, addDriver, confirmShipment } = useAppStore();
  const drivers = useAppStore(s => s.drivers) || [];
  const currentService = useAppStore(s => s.currentService);
  const isWarehouse = currentService === WAREHOUSE_SERVICE_ID;

  const readyOrders = orders.filter(o =>
    ['ready_for_shipment', 'scheduled_for_shipment'].includes(o.status)
  );

  const enriched = shipments.map(s => ({
    ...s,
    overdue: isOverdue(s.paymentDueDate, s.paidAmount, s.amount),
    counterparty: counterparties.find(c => c.id === s.counterpartyId),
    order: orders.find(o => o.id === s.orderId),
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
    } catch {
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
    } catch {
      return { id: Date.now(), ...driverData };
    }
  };

  useMemo(() => {
    import('../../services/api').then(({ deliveryRoutesApi }) => {
      deliveryRoutesApi.list().then(res => setDeliveryRoutes(res.data || [])).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirmShipment = async (id) => {
    try { await confirmShipment(id); } catch (e) { console.error(e); }
  };

  const tableHeaders = isWarehouse
    ? ['Дата', 'Накладная', 'Заказ', 'Контрагент', 'Способ', 'Адрес', 'Позиции', 'Статус', 'Действие']
    : ['Дата', 'Накладная', 'Заказ', 'Контрагент', 'Способ', 'Позиции', 'Сумма', 'Статус отгрузки', 'Статус оплаты', 'Срок оплаты'];

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Отгрузки</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isWarehouse
              ? 'Планирование и учёт отгрузок.'
              : 'Реестр отгрузок. Срок оплаты исчисляется от даты отгрузки по условиям договора.'}
          </p>
        </div>
      </div>

      {readyOrders.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <PackageCheck size={18} className="text-orange-500 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-orange-800">{readyOrders.length} заказ(а) готовы к отгрузке: </span>
            <span className="text-orange-700">{readyOrders.map(o => o.number).join(', ')}</span>
          </div>
          {isWarehouse && (
            <button
              className="text-orange-700 hover:text-orange-900 text-xs font-medium underline flex-shrink-0"
              onClick={() => setShowModal(true)}
            >
              Оформить отгрузку
            </button>
          )}
        </div>
      )}

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

      <div className="flex gap-1 border-b border-gray-200">
        {[['list', List, 'Список отгрузок'], ['calendar', Calendar, 'Календарь отгрузок']].map(([key, Icon, label]) => (
          <button
            key={key}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'list' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {tableHeaders.map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap${
                        isWarehouse && i === tableHeaders.length - 1
                          ? ' sticky right-0 bg-gray-50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]'
                          : ''
                      }`}
                    >
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={s.status || 'scheduled'} />
                      </td>
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
                      {isWarehouse && (
                        <td className="px-4 py-3 whitespace-nowrap sticky right-0 bg-white shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                          {s.status !== 'shipped' ? (
                            <button
                              className="inline-flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium transition-colors"
                              onClick={() => handleConfirmShipment(s.id)}
                            >
                              <CheckCircle size={12} /> Подтвердить отгрузку
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                              <CheckCircle size={12} /> Отгружено
                            </span>
                          )}
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

      <WaybillModal
        isOpen={!!waybillRoute}
        onClose={() => setWaybillRoute(null)}
        route={waybillRoute}
      />
    </div>
  );
}
