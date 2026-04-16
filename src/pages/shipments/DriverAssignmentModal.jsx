import { useState } from 'react';
import { MapPin } from 'lucide-react';
import Modal from '../../components/ui/Modal';

export default function DriverAssignmentModal({ isOpen, onClose, shipments, routeDate, drivers, onCreateRoute, onAddDriver }) {
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
