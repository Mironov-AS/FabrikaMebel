import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import DayDetailPanel from './DayDetailPanel';

const MONTH_NAMES_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAY_NAMES_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

export default function ShipmentCalendar({ shipments, counterparties, routes, drivers, onCreateRoute, onAddDriver, onPrintWaybill }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));

  const getDateStr = (d) => {
    if (!d) return null;
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  };

  const todayStr = getDateStr(today);

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
      <div className="flex-1 min-w-0">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg" onClick={() => setViewDate(new Date(year, month - 1, 1))}>
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-base font-semibold text-gray-900">
              {MONTH_NAMES_RU[month]} {year}
            </h2>
            <button className="p-2 hover:bg-gray-100 rounded-lg" onClick={() => setViewDate(new Date(year, month + 1, 1))}>
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES_RU.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

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

      {selectedDate && (
        <div className="w-80 flex-shrink-0">
          <div className="card flex flex-col" style={{ maxHeight: 'calc(100vh - 11rem)' }}>
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between flex-shrink-0 rounded-t-xl">
              <h3 className="text-sm font-semibold text-gray-800">Отгрузки на день</h3>
              <button className="p-1 hover:bg-gray-200 rounded" onClick={() => setSelectedDate(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
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
        </div>
      )}
    </div>
  );
}
