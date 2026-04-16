import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Clock, Navigation, AlertCircle, Loader2, RefreshCw, Warehouse } from 'lucide-react';
import Modal from '../ui/Modal';

// Fix Leaflet default marker icons with Vite
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Constants ─────────────────────────────────────────────────────────────
const OSRM_BASE = 'https://router.project-osrm.org';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const STOP_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#ea580c', '#6d28d9',
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatDuration(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}

function formatDistance(meters) {
  if (!meters) return '—';
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

function addSeconds(timeStr, seconds) {
  if (!timeStr || !seconds) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = h * 60 + m + Math.round(seconds / 60);
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ─── Geocode single address via Nominatim ──────────────────────────────────
async function geocodeAddress(address) {
  if (!address?.trim()) return null;
  try {
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'ru' } });
    const data = await res.json();
    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── OSRM Trip (optimise + route) ─────────────────────────────────────────
async function buildOsrmTrip(coords) {
  // coords: [{lat, lng}, ...] — first is warehouse (source=first, destination=last)
  const coordStr = coords.map(c => `${c.lng},${c.lat}`).join(';');
  const url = `${OSRM_BASE}/trip/v1/driving/${coordStr}?source=first&destination=last&roundtrip=false&geometries=geojson&overview=full&annotations=false`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error(data.message || 'OSRM error');
  return data;
}

// ─── Map renderer (pure Leaflet, no react-leaflet to avoid SSR issues) ─────
function LeafletMap({ waypoints, routeGeometry, optimizedOrder }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, { zoomControl: true }).setView([55.75, 37.62], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous layers (except tile layer)
    map.eachLayer(layer => { if (layer instanceof L.Marker || layer instanceof L.Polyline) map.removeLayer(layer); });

    if (!waypoints?.length) return;

    const bounds = [];

    // Route polyline
    if (routeGeometry) {
      const latlngs = routeGeometry.coordinates.map(([lng, lat]) => [lat, lng]);
      L.polyline(latlngs, { color: '#2563eb', weight: 4, opacity: 0.8 }).addTo(map);
      bounds.push(...latlngs);
    }

    // Markers
    waypoints.forEach((wp, idx) => {
      if (!wp.coords) return;
      const isWarehouse = idx === 0;
      const stopIdx = isWarehouse ? null : (optimizedOrder ? optimizedOrder.indexOf(idx) : idx - 1);
      const color = isWarehouse ? '#374151' : STOP_COLORS[(stopIdx ?? idx - 1) % STOP_COLORS.length];
      const label = isWarehouse ? 'С' : String((stopIdx ?? idx - 1) + 1);

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          background:${color};color:#fff;
          width:30px;height:30px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          font-size:13px;font-weight:700;
          border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);
        ">${label}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([wp.coords.lat, wp.coords.lng], { icon });
      marker.bindTooltip(
        `<b>${isWarehouse ? 'Склад (отправление)' : `Точка ${label}: ${wp.name}`}</b>${wp.eta ? `<br>Прибытие: ${wp.eta}` : ''}`,
        { permanent: false, direction: 'top' }
      );
      marker.addTo(map);
      bounds.push([wp.coords.lat, wp.coords.lng]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [waypoints, routeGeometry, optimizedOrder]);

  return <div ref={containerRef} style={{ width: '100%', height: '420px', borderRadius: '8px', overflow: 'hidden' }} />;
}

// ─── Main Modal ────────────────────────────────────────────────────────────
export default function RouteMapModal({ route, onClose }) {
  const [warehouseAddress, setWarehouseAddress] = useState('');
  const [departureTime, setDepartureTime] = useState('09:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { waypoints, routeGeometry, legs, optimizedOrder, totalDist, totalDur }

  const shipments = route?.shipments || [];

  const buildRoute = useCallback(async () => {
    setError('');
    setResult(null);
    setLoading(true);

    try {
      // 1. Geocode warehouse
      const warehouseCoords = await geocodeAddress(warehouseAddress || 'Москва, склад');
      if (!warehouseCoords) throw new Error('Не удалось определить координаты склада. Уточните адрес.');

      // 2. Geocode all delivery addresses
      const geocoded = await Promise.all(
        shipments.map(s => geocodeAddress(s.deliveryAddress || s.counterpartyName))
      );

      const failedIdx = geocoded.findIndex(g => !g);
      if (failedIdx !== -1) {
        throw new Error(`Не удалось геокодировать адрес: "${shipments[failedIdx].deliveryAddress || shipments[failedIdx].counterpartyName}". Проверьте адрес доставки.`);
      }

      // 3. Build OSRM trip [warehouse, ...stops]
      const allCoords = [warehouseCoords, ...geocoded];
      const tripData = await buildOsrmTrip(allCoords);

      // OSRM returns waypoints in original order but with waypoint_index showing optimised order
      const osrmWaypoints = tripData.waypoints; // [{waypoint_index, trips_index, ...}]
      const trip = tripData.trips[0];
      const legs = trip.legs; // legs[i] = travel from optimised stop i to i+1

      // Build optimised order of client stops (excluding warehouse at position 0)
      // waypoints[0] = warehouse (source=first, so it stays at index 0 in osrm output)
      // remaining waypoints sorted by waypoint_index give the optimised client order
      const clientWaypoints = osrmWaypoints.slice(1); // skip warehouse
      const sorted = [...clientWaypoints].sort((a, b) => a.waypoint_index - b.waypoint_index);
      // sorted[i].location gives original shipment index (1-based in allCoords → 0-based in shipments)
      // We map original index (index in osrmWaypoints array, 1-based) to position in trip
      const optimisedClientOrder = sorted.map(wp => {
        // Find original index in osrmWaypoints
        return osrmWaypoints.indexOf(wp) - 1; // 0-based shipment index
      });

      // 4. Build cumulative ETAs
      // legs[0] = warehouse → first client, legs[1] = first → second, etc.
      let cumulativeSeconds = 0;
      const stopsWithEta = optimisedClientOrder.map((shipIdx, i) => {
        cumulativeSeconds += legs[i]?.duration || 0;
        const eta = addSeconds(departureTime, cumulativeSeconds);
        const legDist = legs[i]?.distance || 0;
        const legDur = legs[i]?.duration || 0;
        return {
          shipIdx,
          name: shipments[shipIdx]?.counterpartyName || `Клиент ${shipIdx + 1}`,
          address: shipments[shipIdx]?.deliveryAddress || '—',
          coords: geocoded[shipIdx],
          eta,
          legDist,
          legDur,
          cumulativeSeconds,
        };
      });

      // 5. Build waypoints for map (warehouse first, then optimised stops)
      const mapWaypoints = [
        { name: 'Склад', coords: warehouseCoords, eta: departureTime, isWarehouse: true },
        ...stopsWithEta.map(s => ({ name: s.name, coords: s.coords, eta: s.eta })),
      ];

      setResult({
        waypoints: mapWaypoints,
        routeGeometry: trip.geometry,
        legs,
        stopsWithEta,
        optimizedOrder: optimisedClientOrder,
        totalDist: trip.distance,
        totalDur: trip.duration,
      });
    } catch (err) {
      setError(err.message || 'Ошибка при построении маршрута');
    } finally {
      setLoading(false);
    }
  }, [warehouseAddress, departureTime, shipments]);

  return (
    <Modal
      isOpen={!!route}
      onClose={onClose}
      title="Карта маршрута"
      size="2xl"
      footer={
        <button className="btn-secondary" onClick={onClose}>Закрыть</button>
      }
    >
      <div className="space-y-5">
        {/* Settings row */}
        <div className="bg-gray-50 rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Navigation size={15} className="text-blue-600" /> Параметры маршрута
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <Warehouse size={12} /> Адрес склада (точка отправления)
              </label>
              <input
                className="input w-full text-sm"
                placeholder="например: Москва, ул. Складская, 5"
                value={warehouseAddress}
                onChange={e => setWarehouseAddress(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <Clock size={12} /> Время выезда со склада
              </label>
              <input
                type="time"
                className="input w-full text-sm"
                value={departureTime}
                onChange={e => setDepartureTime(e.target.value)}
              />
            </div>
          </div>
          <button
            className="btn-primary flex items-center gap-2 text-sm"
            onClick={buildRoute}
            disabled={loading || shipments.length === 0}
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Строим маршрут...</>
              : result
                ? <><RefreshCw size={14} /> Перестроить</>
                : <><MapPin size={14} /> Построить маршрут</>
            }
          </button>
          {shipments.length === 0 && (
            <p className="text-xs text-amber-600">В путевом листе нет адресов доставки.</p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Map */}
        {result && (
          <>
            <LeafletMap
              waypoints={result.waypoints}
              routeGeometry={result.routeGeometry}
              optimizedOrder={result.optimizedOrder}
            />

            {/* Summary */}
            <div className="flex items-center gap-6 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
              <span className="flex items-center gap-1.5">
                <Navigation size={13} className="text-blue-500" />
                Расстояние: <strong>{formatDistance(result.totalDist)}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="text-blue-500" />
                В пути: <strong>{formatDuration(result.totalDur)}</strong>
              </span>
              <span className="text-gray-500">
                Выезд: <strong>{departureTime}</strong>
              </span>
            </div>

            {/* Stops ETA table */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Clock size={14} className="text-blue-600" /> Прогноз прибытия
              </h3>
              <div className="space-y-2">
                {/* Warehouse row */}
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-gray-700 text-white flex items-center justify-center text-xs font-bold shrink-0">С</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Склад (отправление)</p>
                    <p className="text-xs text-gray-500 truncate">{warehouseAddress || 'Адрес склада'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-800">{departureTime}</p>
                    <p className="text-xs text-gray-400">выезд</p>
                  </div>
                </div>

                {result.stopsWithEta.map((stop, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50 transition-colors">
                    <div
                      className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: STOP_COLORS[i % STOP_COLORS.length] }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{stop.name}</p>
                      <p className="text-xs text-gray-500 truncate">{stop.address}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div className="text-xs text-gray-400">
                        <p>{formatDistance(stop.legDist)}</p>
                        <p>{formatDuration(stop.legDur)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-blue-700">{stop.eta}</p>
                        <p className="text-xs text-gray-400">прибытие</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="text-center py-10 text-gray-400">
            <MapPin size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Укажите адрес склада и время выезда, затем нажмите «Построить маршрут»</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
