import { useState } from 'react';
import { Calendar, PackageCheck, Truck, Car, Users, MapPin, Phone, Printer, X } from 'lucide-react';
import DriverAssignmentModal from './DriverAssignmentModal';

export default function DayDetailPanel({ date, shipments, counterparties, routes, drivers, onCreateRoute, onAddDriver, onPrintWaybill }) {
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
