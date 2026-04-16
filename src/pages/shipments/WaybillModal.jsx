import { useRef } from 'react';
import { Printer, MapPin, Phone, Car } from 'lucide-react';
import Modal from '../../components/ui/Modal';

export default function WaybillModal({ isOpen, onClose, route }) {
  const printRef = useRef();

  if (!route) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Путевой лист" size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Закрыть</button>
          <button className="btn-primary flex items-center gap-2" onClick={() => window.print()}>
            <Printer size={14} /> Печать
          </button>
        </>
      }
    >
      <div ref={printRef} className="waybill-content">
        <div className="text-center mb-6 border-b pb-4">
          <h2 className="text-xl font-bold">ПУТЕВОЙ ЛИСТ</h2>
          <p className="text-sm text-gray-600 mt-1">Дата: {route.routeDate}</p>
        </div>

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
