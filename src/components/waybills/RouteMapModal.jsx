import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Clock, Navigation, AlertCircle, Loader2, RefreshCw, Warehouse, Sparkles, Info } from 'lucide-react';
import Modal from '../ui/Modal';
import api from '../../services/api';

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

// ─── Normalize Russian address abbreviations for Nominatim ───────────────────
function normalizeAddress(address) {
  if (!address) return address;
  return address
    .replace(/\bг\.\s*/gi, '')
    .replace(/\bгород\s+/gi, '')
    .replace(/\bул\.\s*/gi, 'улица ')
    .replace(/\bпр-кт\.?\s*/gi, 'проспект ')
    .replace(/\bпр-т\.?\s*/gi, 'проспект ')
    .replace(/\bпроезд\s+/gi, 'проезд ')
    .replace(/\bпер\.\s*/gi, 'переулок ')
    .replace(/\bнаб\.\s*/gi, 'набережная ')
    .replace(/\bш\.\s*/gi, 'шоссе ')
    .replace(/\bб-р\.?\s*/gi, 'бульвар ')
    .replace(/\bпл\.\s*/gi, 'площадь ')
    .replace(/\bд\.\s*(?=\d)/gi, '')
    .replace(/\bкорп?\.\s*(?=\d)/gi, 'корпус ')
    .replace(/\bстр\.\s*(?=\d)/gi, 'строение ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Geocode single address via Nominatim ──────────────────────────────────
async function geocodeWithNominatim(address) {
  if (!address?.trim()) return null;
  const normalized = normalizeAddress(address);
  try {
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(normalized)}&format=json&limit=1&addressdetails=1&countrycodes=ru`;
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

// ─── LLM address normalization via /api/ai-chat (SSE) ────────────────────────
// Sends a geocoding-specific prompt and collects the full streamed response.
async function normalizeBatchWithLLM(addresses) {
  const authHeader = api.defaults.headers.common['Authorization'] || '';

  const message = `ЗАДАЧА: Нормализуй адреса для геокодирования через OpenStreetMap Nominatim. Ответь ТОЛЬКО JSON-объектом без пояснений и без markdown-блоков.

ПРАВИЛА:
- Раскрывай сокращения: "ул." → "улица", "пр-кт"/"пр-т" → "проспект", "пер." → "переулок", "наб." → "набережная", "ш." → "шоссе", "б-р" → "бульвар", "пл." → "площадь"
- Убирай "г." / "город" перед городом; убирай "д." перед номером дома
- "корп."/"к." → "корпус", "стр." → "строение"
- Не придумывай детали которых нет
- Если строка — название компании, оставь как есть

ФОРМАТ ОТВЕТА (строго JSON):
{"results":[{"original":"...","normalized":"..."}]}

АДРЕСА:
${JSON.stringify(addresses)}`;

  const response = await fetch('/api/ai-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({ message, history: [] }),
  });

  if (!response.ok) {
    throw new Error(`LLM HTTP ${response.status}`);
  }

  // Consume SSE stream and collect full text
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let done = false;

  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      buffer += decoder.decode(result.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        const dataPart = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
        try {
          const json = JSON.parse(dataPart);
          if (json.text) fullText += json.text;
          if (json.error) throw new Error(json.error);
        } catch (parseErr) {
          if (parseErr.message && !parseErr.message.startsWith('JSON')) throw parseErr;
        }
      }
    }
  }

  // Parse JSON from collected text (strip markdown fences if present)
  const cleaned = fullText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Extract JSON object from text (LLM may add extra explanation around it)
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM вернула неверный формат');

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed?.results)) throw new Error('LLM вернула неверную структуру');

  const map = new Map(parsed.results.map(r => [r.original, r.normalized]));
  return { map };
}

// ─── Geocode address with optional LLM fallback ───────────────────────────
async function geocodeAddress(address, llmNormalizedMap) {
  if (!address?.trim()) return { coords: null, llmUsed: false };

  // 1. Try direct Nominatim
  const direct = await geocodeWithNominatim(address);
  if (direct) return { coords: direct, llmUsed: false, normalizedAddress: null };

  // 2. If LLM map provided, try LLM-normalized version
  if (llmNormalizedMap) {
    const normalized = llmNormalizedMap.get(address);
    if (normalized && normalized !== address) {
      const llmResult = await geocodeWithNominatim(normalized);
      if (llmResult) return { coords: llmResult, llmUsed: true, normalizedAddress: normalized };
    }
  }

  return { coords: null, llmUsed: false, normalizedAddress: null };
}

// ─── OSRM Trip (optimise + route) ─────────────────────────────────────────
async function buildOsrmTrip(coords) {
  const coordStr = coords.map(c => `${c.lng},${c.lat}`).join(';');
  const url = `${OSRM_BASE}/trip/v1/driving/${coordStr}?source=first&destination=last&roundtrip=false&geometries=geojson&overview=full&annotations=false`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error(data.message || 'OSRM error');
  return data;
}

// ─── Map renderer ──────────────────────────────────────────────────────────
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

    map.eachLayer(layer => { if (layer instanceof L.Marker || layer instanceof L.Polyline) map.removeLayer(layer); });

    if (!waypoints?.length) return;

    const bounds = [];

    if (routeGeometry) {
      const latlngs = routeGeometry.coordinates.map(([lng, lat]) => [lat, lng]);
      L.polyline(latlngs, { color: '#2563eb', weight: 4, opacity: 0.8 }).addTo(map);
      bounds.push(...latlngs);
    }

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
        `<b>${isWarehouse ? 'Склад (отправление)' : `Точка ${label}: ${wp.name}`}</b>${wp.eta ? `<br>Прибытие: ${wp.eta}` : ''}${wp.llmUsed ? '<br><i>✨ адрес уточнён через ИИ</i>' : ''}`,
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

// ─── LLM status badge ──────────────────────────────────────────────────────
function LlmBadge({ provider }) {
  const labels = { anthropic: 'Claude', openai: 'OpenAI', yandex: 'YandexGPT' };
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
      <Sparkles size={10} />
      {labels[provider] || provider || 'ИИ'}
    </span>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────
export default function RouteMapModal({ route, onClose }) {
  const [warehouseAddress, setWarehouseAddress] = useState('');
  const [departureTime, setDepartureTime] = useState('09:00');
  const [useLlm, setUseLlm] = useState(false);
  const [llmStatus, setLlmStatus] = useState(null); // { configured, provider, model }
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const shipments = route?.shipments || [];

  // Check LLM config on mount
  useEffect(() => {
    api.get('/ai-chat/status')
      .then(({ data }) => {
        setLlmStatus(data);
        if (data.configured) setUseLlm(true);
      })
      .catch(() => setLlmStatus({ configured: false }));
  }, []);

  const buildRoute = useCallback(async () => {
    setError('');
    setResult(null);
    setLoading(true);
    setLoadingStep('Подготовка адресов...');

    try {
      const allAddresses = [
        warehouseAddress || 'Москва',
        ...shipments.map(s => s.deliveryAddress || s.counterpartyName),
      ];

      // ── Step 1: LLM normalization (if enabled and configured) ────────────
      let llmMap = null;

      if (useLlm && llmStatus?.configured) {
        setLoadingStep('ИИ нормализует адреса...');
        try {
          const { map } = await normalizeBatchWithLLM(allAddresses);
          llmMap = map;
        } catch (llmErr) {
          console.warn('LLM normalization skipped:', llmErr.message);
          // Non-fatal: continue with standard geocoding
        }
      }

      // ── Step 2: Geocode warehouse ────────────────────────────────────────
      setLoadingStep('Геокодирование склада...');
      const warehouseInput = warehouseAddress || 'Москва';
      const warehouseResult = await geocodeAddress(warehouseInput, llmMap);
      if (!warehouseResult.coords) {
        throw new Error(
          warehouseResult.normalizedAddress
            ? `Не удалось определить координаты склада.\nИсходный: "${warehouseInput}"\nНормализован ИИ: "${warehouseResult.normalizedAddress}"`
            : `Не удалось определить координаты склада: "${warehouseInput}". Уточните адрес.`
        );
      }

      // ── Step 3: Geocode delivery addresses ───────────────────────────────
      setLoadingStep(`Геокодирование ${shipments.length} адресов доставки...`);
      const geocodedResults = await Promise.all(
        shipments.map(s => geocodeAddress(s.deliveryAddress || s.counterpartyName, llmMap))
      );

      const failedIdx = geocodedResults.findIndex(g => !g.coords);
      if (failedIdx !== -1) {
        const failedAddr = shipments[failedIdx].deliveryAddress || shipments[failedIdx].counterpartyName;
        const norm = geocodedResults[failedIdx].normalizedAddress;
        throw new Error(
          norm
            ? `Не удалось геокодировать адрес:\nИсходный: "${failedAddr}"\nНормализован ИИ: "${norm}"`
            : `Не удалось геокодировать адрес: "${failedAddr}". Проверьте адрес доставки.`
        );
      }

      const geocoded = geocodedResults.map(r => r.coords);
      const llmUsedFlags = geocodedResults.map(r => r.llmUsed);

      // ── Step 4: Build OSRM route ─────────────────────────────────────────
      setLoadingStep('Строим оптимальный маршрут...');
      const allCoords = [warehouseResult.coords, ...geocoded];
      const tripData = await buildOsrmTrip(allCoords);

      const osrmWaypoints = tripData.waypoints;
      const trip = tripData.trips[0];
      const legs = trip.legs;

      const clientWaypoints = osrmWaypoints.slice(1);
      const sorted = [...clientWaypoints].sort((a, b) => a.waypoint_index - b.waypoint_index);
      const optimisedClientOrder = sorted.map(wp => osrmWaypoints.indexOf(wp) - 1);

      // ── Step 5: ETAs ─────────────────────────────────────────────────────
      let cumulativeSeconds = 0;
      const stopsWithEta = optimisedClientOrder.map((shipIdx, i) => {
        cumulativeSeconds += legs[i]?.duration || 0;
        return {
          shipIdx,
          name: shipments[shipIdx]?.counterpartyName || `Клиент ${shipIdx + 1}`,
          address: shipments[shipIdx]?.deliveryAddress || '—',
          coords: geocoded[shipIdx],
          eta: addSeconds(departureTime, cumulativeSeconds),
          legDist: legs[i]?.distance || 0,
          legDur: legs[i]?.duration || 0,
          cumulativeSeconds,
          llmUsed: llmUsedFlags[shipIdx] || false,
          normalizedAddress: geocodedResults[shipIdx]?.normalizedAddress || null,
        };
      });

      const mapWaypoints = [
        { name: 'Склад', coords: warehouseResult.coords, eta: departureTime, isWarehouse: true, llmUsed: warehouseResult.llmUsed },
        ...stopsWithEta.map(s => ({ name: s.name, coords: s.coords, eta: s.eta, llmUsed: s.llmUsed })),
      ];

      const llmCount = (warehouseResult.llmUsed ? 1 : 0) + llmUsedFlags.filter(Boolean).length;

      setResult({
        waypoints: mapWaypoints,
        routeGeometry: trip.geometry,
        legs,
        stopsWithEta,
        optimizedOrder: optimisedClientOrder,
        totalDist: trip.distance,
        totalDur: trip.duration,
        llmCount,
        llmProvider: llmStatus?.provider,
      });
    } catch (err) {
      setError(err.message || 'Ошибка при построении маршрута');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  }, [warehouseAddress, departureTime, shipments, useLlm, llmStatus]);

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

          {/* LLM geocoding toggle */}
          <div className="flex items-start gap-3 bg-white border border-violet-100 rounded-lg px-3 py-2.5">
            <div className="flex items-center pt-0.5">
              <input
                id="llm-toggle"
                type="checkbox"
                checked={useLlm}
                onChange={e => setUseLlm(e.target.checked)}
                disabled={!llmStatus?.configured}
                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer disabled:opacity-50"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label
                htmlFor="llm-toggle"
                className="flex items-center gap-2 text-sm font-medium text-gray-700 select-none"
                style={{ cursor: llmStatus?.configured ? 'pointer' : 'default' }}
              >
                <Sparkles size={14} className="text-violet-500 shrink-0" />
                Геокодирование через ИИ
                {llmStatus?.configured && llmStatus.provider && <LlmBadge provider={llmStatus.provider} />}
                {llmStatus?.configured === false && (
                  <span className="text-xs text-amber-600 font-normal">(ИИ не настроен)</span>
                )}
              </label>
              <p className="text-xs text-gray-400 mt-0.5">
                ИИ нормализует адреса перед геокодированием — улучшает распознавание сокращений и нестандартных форматов
              </p>
              {llmStatus?.configured === false && (
                <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                  <Info size={11} className="shrink-0" />
                  Настройте модель в разделе «Администрирование → Языковые модели»
                </p>
              )}
            </div>
          </div>

          <button
            className="btn-primary flex items-center gap-2 text-sm"
            onClick={buildRoute}
            disabled={loading || shipments.length === 0}
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> {loadingStep || 'Строим маршрут...'}</>
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
            <span className="whitespace-pre-wrap">{error}</span>
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
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
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
              {result.llmCount > 0 && (
                <span className="flex items-center gap-1.5 text-violet-600">
                  <Sparkles size={12} />
                  ИИ уточнил {result.llmCount} {result.llmCount === 1 ? 'адрес' : result.llmCount < 5 ? 'адреса' : 'адресов'}
                  {result.llmProvider && <LlmBadge provider={result.llmProvider} />}
                </span>
              )}
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
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                      Склад (отправление)
                      {result.waypoints[0]?.llmUsed && (
                        <span title="Адрес уточнён через ИИ">
                          <Sparkles size={11} className="text-violet-500" />
                        </span>
                      )}
                    </p>
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
                      <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                        {stop.name}
                        {stop.llmUsed && (
                          <span title={`Адрес нормализован через ИИ: ${stop.normalizedAddress}`}>
                            <Sparkles size={11} className="text-violet-500 cursor-help" />
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{stop.address}</p>
                      {stop.llmUsed && stop.normalizedAddress && (
                        <p className="text-xs text-violet-500 truncate">
                          → {stop.normalizedAddress}
                        </p>
                      )}
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
