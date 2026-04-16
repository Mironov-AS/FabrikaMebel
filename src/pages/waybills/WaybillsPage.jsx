import { useState, useEffect, useMemo } from 'react';
import {
  FileText, Plus, Pencil, Search,
  MapPin, Phone, ChevronDown, X, Printer, Calendar, User,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import Modal from '../../components/ui/Modal';

// ─── Status badge ──────────────────────────────────────────────────────────
const STATUS_MAP = {
  planned:     { label: 'Запланирован', cls: 'bg-blue-100 text-blue-700' },
  active:      { label: 'В пути',       cls: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'В пути',       cls: 'bg-amber-100 text-amber-700' },
  completed:   { label: 'Выполнен',     cls: 'bg-green-100 text-green-700' },
  done:        { label: 'Выполнен',     cls: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'Отменён',      cls: 'bg-red-100 text-red-700' },
};

function RouteStatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status || 'Неизвестно', cls: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function vehicleDisplay(driver) {
  if (!driver) return '—';
  const parts = [driver.vehicle_brand, driver.vehicle_model, driver.vehicle].filter(Boolean);
  return parts.join(' ') || '—';
}

// ─── WaybillDetailModal ───────────────────────────────────────────────────
function WaybillDetailModal({ route, onClose }) {
  if (!route) return null;
  return (
    <Modal isOpen={!!route} onClose={onClose} title="Путевой лист" size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Закрыть</button>
          <button className="btn-primary flex items-center gap-2" onClick={() => window.print()}>
            <Printer size={14} /> Печать
          </button>
        </>
      }
    >
      <div className="waybill-content space-y-5">
        <div className="text-center border-b pb-4">
          <h2 className="text-xl font-bold uppercase tracking-wide">Путевой лист</h2>
          <p className="text-sm text-gray-500 mt-1">Дата: {route.routeDate}</p>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border space-y-2">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-2">
            <User size={15} /> Водитель и транспорт
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-500">ФИО:</span> <span className="font-medium">{route.driver?.name || '—'}</span></div>
            <div><span className="text-gray-500">Телефон:</span> <span className="font-medium">{route.driver?.phone || '—'}</span></div>
            {route.driver?.license && (
              <div><span className="text-gray-500">Номер ВУ:</span> <span className="font-medium">{route.driver.license}</span></div>
            )}
            {vehicleDisplay(route.driver) !== '—' && (
              <div className="col-span-2">
                <span className="text-gray-500">Автомобиль:</span>{' '}
                <span className="font-medium">{vehicleDisplay(route.driver)}</span>
                {route.driver?.vehicle_year && <span className="text-gray-400 ml-1">({route.driver.vehicle_year} г.)</span>}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-800 mb-3">Адреса доставки:</h3>
          <div className="space-y-3">
            {(route.shipments || []).map((s, idx) => (
              <div key={s.id || idx} className="border rounded-lg p-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">{idx + 1}</div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{s.counterpartyName}</p>
                    <p className="text-xs text-gray-500">{s.invoiceNumber} · {s.orderNumber}</p>
                  </div>
                </div>
                <div className="ml-10 space-y-1 text-sm">
                  <div className="flex items-start gap-2 text-gray-700">
                    <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
                    <span>{s.deliveryAddress || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone size={13} className="text-gray-400 shrink-0" />
                    <span>{s.counterpartyPhone || '—'}</span>
                  </div>
                  {s.items?.length > 0 && (
                    <div className="pt-1 border-t border-gray-100 mt-1">
                      {s.items.map((it, i) => (
                        <p key={i} className="text-xs text-gray-600">· {it.name} — {it.quantity} шт.</p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-2 ml-10 flex items-center gap-8 text-xs text-gray-400">
                  <span>Подпись: ________________</span>
                  <span>Время: _______</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t grid grid-cols-2 gap-6 text-sm text-gray-600">
          <p>Водитель: __________ / {route.driver?.name || '____'} /</p>
          <p>Диспетчер: __________________________</p>
        </div>
      </div>
    </Modal>
  );
}

// ─── DriverModal ──────────────────────────────────────────────────────────
function DriverModal({ driver, onSave, onClose }) {
  const [form, setForm] = useState(driver ? { ...driver } : {
    name: '', phone: '', license: '',
    vehicle: '', vehicle_brand: '', vehicle_model: '', vehicle_year: '', vehicle_notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <Modal isOpen onClose={onClose} title={driver ? 'Редактировать водителя' : 'Добавить водителя'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={handleSubmit}>Сохранить</button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Водитель</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ФИО *</label>
          <input className="input w-full" value={form.name} onChange={set('name')} placeholder="Иванов Иван Иванович" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
            <input className="input w-full" value={form.phone} onChange={set('phone')} placeholder="+7 900 000 00 00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Номер ВУ</label>
            <input className="input w-full" value={form.license} onChange={set('license')} placeholder="77 00 000000" />
          </div>
        </div>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Транспортное средство</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Гос. номер</label>
          <input className="input w-full" value={form.vehicle} onChange={set('vehicle')} placeholder="А123ВГ 77" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Марка</label>
            <input className="input w-full" value={form.vehicle_brand} onChange={set('vehicle_brand')} placeholder="ГАЗ" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Модель</label>
            <input className="input w-full" value={form.vehicle_model} onChange={set('vehicle_model')} placeholder="Газель Next" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Год выпуска</label>
          <input className="input w-full" value={form.vehicle_year} onChange={set('vehicle_year')} placeholder="2020" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Примечания к машине</label>
          <textarea className="input w-full" rows={2} value={form.vehicle_notes} onChange={set('vehicle_notes')} placeholder="Доп. информация..." />
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function WaybillsPage() {
  const drivers = useAppStore(s => s.drivers) || [];
  const deliveryRoutes = useAppStore(s => s.deliveryRoutes) || [];
  const { addDriver, updateDriver, loadDeliveryRoutes } = useAppStore();

  const [tab, setTab] = useState('waybills'); // 'waybills' | 'drivers'

  // Filters
  const [filterDriver, setFilterDriver] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [detailRoute, setDetailRoute] = useState(null);
  const [driverModal, setDriverModal] = useState(null); // null | 'new' | driver object

  useEffect(() => {
    loadDeliveryRoutes().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enrich routes with driver data
  const enrichedRoutes = useMemo(() => deliveryRoutes.map(r => ({
    ...r,
    driver: r.driver || drivers.find(d => d.id === r.driverId) || null,
  })), [deliveryRoutes, drivers]);

  // Filtered waybills
  const filteredRoutes = useMemo(() => {
    let list = enrichedRoutes;
    if (filterDriver) list = list.filter(r => String(r.driverId) === filterDriver || r.driver?.name === filterDriver);
    if (filterVehicle) list = list.filter(r => vehicleDisplay(r.driver).toLowerCase().includes(filterVehicle.toLowerCase()));
    if (filterDateFrom) list = list.filter(r => r.routeDate >= filterDateFrom);
    if (filterDateTo) list = list.filter(r => r.routeDate <= filterDateTo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.driver?.name?.toLowerCase().includes(q) ||
        vehicleDisplay(r.driver).toLowerCase().includes(q) ||
        r.routeDate?.includes(q) ||
        (r.shipments || []).some(s => s.counterpartyName?.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => (b.routeDate || '').localeCompare(a.routeDate || ''));
  }, [enrichedRoutes, filterDriver, filterVehicle, filterDateFrom, filterDateTo, search]);

  // ── Driver handlers ──────────────────────────────────────────────────────
  const handleSaveDriver = async (form) => {
    try {
      if (driverModal && driverModal !== 'new') {
        await updateDriver(driverModal.id, form);
      } else {
        await addDriver(form);
      }
    } catch {
      // fallback: update local store optimistically (already done in store)
    }
    setDriverModal(null);
  };

  const clearFilters = () => {
    setFilterDriver('');
    setFilterVehicle('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearch('');
  };

  const hasFilters = filterDriver || filterVehicle || filterDateFrom || filterDateTo || search;

  // Vehicle options for filter (from driver records)
  const vehicleOptions = useMemo(() => {
    const seen = new Set();
    return drivers
      .map(d => ({ key: d.vehicle, label: vehicleDisplay(d) }))
      .filter(({ key, label }) => key && label !== '—' && !seen.has(key) && seen.add(key));
  }, [drivers]);

  const tabs = [
    { key: 'waybills', label: 'Путевые листы', icon: FileText },
    { key: 'drivers', label: 'Водители',       icon: User },
  ];

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Путевые листы</h1>
        <p className="text-sm text-gray-500 mt-0.5">Реестр путевых листов и справочник водителей</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── Waybills tab ─────────────────────────────────────────────────── */}
      {tab === 'waybills' && (
        <>
          {/* Filters */}
          <div className="card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative lg:col-span-2">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-9 w-full"
                  placeholder="Поиск..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              <div className="relative">
                <select
                  className="input w-full appearance-none pr-8"
                  value={filterDriver}
                  onChange={e => setFilterDriver(e.target.value)}
                >
                  <option value="">Все водители</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  className="input w-full appearance-none pr-8"
                  value={filterVehicle}
                  onChange={e => setFilterVehicle(e.target.value)}
                >
                  <option value="">Все машины</option>
                  {vehicleOptions.map(({ key, label }) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              <div className="flex gap-2">
                <input
                  type="date"
                  className="input flex-1 min-w-0"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  title="Дата от"
                />
                <input
                  type="date"
                  className="input flex-1 min-w-0"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  title="Дата до"
                />
              </div>
            </div>

            {hasFilters && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">Показано: {filteredRoutes.length}</span>
                <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                  <X size={12} /> Сбросить фильтры
                </button>
              </div>
            )}
          </div>

          {/* Waybills table */}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Дата', 'Водитель', 'Автомобиль', 'Маршруты (адреса)', 'Статус', 'Действия'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRoutes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <Calendar size={32} className="mx-auto mb-3 text-gray-300" />
                        <p className="text-sm text-gray-400">Путевых листов не найдено</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRoutes.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                          {r.routeDate || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-gray-800">{r.driver?.name || '—'}</div>
                          {r.driver?.phone && <div className="text-xs text-gray-500">{r.driver.phone}</div>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                          {vehicleDisplay(r.driver)}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          {(r.shipments || []).length === 0 ? (
                            <span className="text-gray-400 text-xs">Нет адресов</span>
                          ) : (
                            <div className="space-y-0.5">
                              {(r.shipments || []).slice(0, 3).map((s, i) => (
                                <div key={i} className="text-xs text-gray-600 flex items-start gap-1">
                                  <span className="inline-flex w-4 h-4 rounded-full bg-blue-100 text-blue-700 items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                                  <span className="truncate">{s.counterpartyName}{s.deliveryAddress ? ` — ${s.deliveryAddress}` : ''}</span>
                                </div>
                              ))}
                              {(r.shipments || []).length > 3 && (
                                <span className="text-xs text-gray-400">+{(r.shipments || []).length - 3} ещё</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <RouteStatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            className="inline-flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium transition-colors"
                            onClick={() => setDetailRoute(r)}
                          >
                            <FileText size={12} /> Открыть
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Drivers tab ──────────────────────────────────────────────────── */}
      {tab === 'drivers' && (
        <>
          <div className="flex justify-end">
            <button className="btn-primary flex items-center gap-2" onClick={() => setDriverModal('new')}>
              <Plus size={15} /> Добавить водителя
            </button>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['ФИО', 'Телефон', 'Номер ВУ', 'Гос. номер', 'Автомобиль', 'Год', 'Действия'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {drivers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center">
                        <User size={28} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-sm text-gray-400">Водители не добавлены</p>
                      </td>
                    </tr>
                  ) : (
                    drivers.map(d => (
                      <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                        <td className="px-4 py-3 text-gray-600">{d.phone || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{d.license || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{d.vehicle || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {[d.vehicle_brand, d.vehicle_model].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{d.vehicle_year || '—'}</td>
                        <td className="px-4 py-3">
                          <button
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                            onClick={() => setDriverModal(d)}
                          >
                            <Pencil size={12} /> Редактировать
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <WaybillDetailModal route={detailRoute} onClose={() => setDetailRoute(null)} />

      {driverModal && (
        <DriverModal
          driver={driverModal === 'new' ? null : driverModal}
          onSave={handleSaveDriver}
          onClose={() => setDriverModal(null)}
        />
      )}
    </div>
  );
}
