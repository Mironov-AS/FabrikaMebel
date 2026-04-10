import { useState, useMemo } from 'react';
import { addDays, startOfWeek, endOfWeek, eachDayOfInterval, format, isToday, parseISO, differenceInDays, startOfMonth, endOfMonth, addWeeks, addMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { GripVertical, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import useAppStore from '../../store/appStore';
import { PRODUCTION_LINES, STATUS_LABELS } from '../../data/mockData';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';

// ─── Shared Tab component ─────────────────────────────────────────────────────

function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Gantt helpers ────────────────────────────────────────────────────────────

const VIEW_MODES = [
  { id: 'week',    label: 'Неделя' },
  { id: 'month',   label: 'Месяц' },
  { id: 'quarter', label: 'Квартал' },
];

function getRangeForMode(anchor, mode) {
  if (mode === 'week') {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    return { start, end: endOfWeek(anchor, { weekStartsOn: 1 }) };
  }
  if (mode === 'month') {
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }
  // quarter — 3 months
  const start = startOfMonth(anchor);
  return { start, end: endOfMonth(addMonths(anchor, 2)) };
}

function shiftAnchor(anchor, mode, direction) {
  if (mode === 'week')    return direction > 0 ? addWeeks(anchor, 1)  : addWeeks(anchor, -1);
  if (mode === 'month')   return direction > 0 ? addMonths(anchor, 1) : addMonths(anchor, -1);
  return direction > 0 ? addMonths(anchor, 3) : addMonths(anchor, -3);
}

// Task bar positioning: returns left% and width% within [rangeStart, rangeEnd]
function getBarPosition(taskStart, taskEnd, rangeStart, rangeEnd) {
  const totalDays = differenceInDays(rangeEnd, rangeStart) + 1;
  if (totalDays <= 0) return null;

  const start = parseISO(taskStart);
  const end   = parseISO(taskEnd);

  // Clamp to range
  const clampedStart = start < rangeStart ? rangeStart : start;
  const clampedEnd   = end   > rangeEnd   ? rangeEnd   : end;

  if (clampedEnd < rangeStart || clampedStart > rangeEnd) return null;

  const leftDays  = differenceInDays(clampedStart, rangeStart);
  const widthDays = differenceInDays(clampedEnd, clampedStart) + 1;

  return {
    left:  (leftDays / totalDays) * 100,
    width: (widthDays / totalDays) * 100,
  };
}

// ─── Task Detail Popup ────────────────────────────────────────────────────────

function TaskPopup({ task, onClose }) {
  if (!task) return null;
  const line = PRODUCTION_LINES.find(l => l.id === task.lineId);
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative z-10 bg-white rounded-xl shadow-xl p-5 w-72 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900 leading-tight">{task.name}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-1.5 text-xs text-gray-600">
          <p><span className="text-gray-400">Заказ:</span> {task.orderNumber}</p>
          <p><span className="text-gray-400">Линия:</span> {line?.name ?? '—'}</p>
          <p><span className="text-gray-400">Начало:</span> {task.start}</p>
          <p><span className="text-gray-400">Конец:</span> {task.end}</p>
          <p><span className="text-gray-400">Ответственный:</span> {task.responsible}</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Прогресс</span>
            <span className="text-xs font-semibold text-gray-800">{task.progress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${task.progress}%`, backgroundColor: task.color }}
            />
          </div>
        </div>
        <StatusBadge status={task.status} />
      </div>
    </div>
  );
}

// ─── Gantt Tab ────────────────────────────────────────────────────────────────

function GanttTab({ tasks }) {
  const [viewMode, setViewMode] = useState('month');
  const [anchor,   setAnchor]   = useState(new Date(2026, 3, 6));
  const [popup,    setPopup]    = useState(null);

  const { start: rangeStart, end: rangeEnd } = getRangeForMode(anchor, viewMode);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  // Group tasks by line
  const tasksByLine = useMemo(() => {
    const map = {};
    PRODUCTION_LINES.forEach(l => { map[l.id] = []; });
    tasks.forEach(t => {
      if (map[t.lineId]) map[t.lineId].push(t);
    });
    return map;
  }, [tasks]);

  // Today's indicator position
  const today = new Date(2026, 3, 6);
  const todayPos = getBarPosition(
    format(today, 'yyyy-MM-dd'),
    format(today, 'yyyy-MM-dd'),
    rangeStart, rangeEnd
  );

  // Unique orders for legend
  const orderColors = useMemo(() => {
    const seen = {};
    tasks.forEach(t => { seen[t.orderNumber] = t.color; });
    return Object.entries(seen);
  }, [tasks]);

  const LEFT_WIDTH = 180; // px for line label column

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        {/* View mode */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
          {VIEW_MODES.map(vm => (
            <button
              key={vm.id}
              onClick={() => setViewMode(vm.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === vm.id
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {vm.label}
            </button>
          ))}
        </div>

        {/* Navigator */}
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            onClick={() => setAnchor(a => shiftAnchor(a, viewMode, -1))}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[160px] text-center">
            {format(rangeStart, 'd MMM', { locale: ru })} — {format(rangeEnd, 'd MMM yyyy', { locale: ru })}
          </span>
          <button
            className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            onClick={() => setAnchor(a => shiftAnchor(a, viewMode, 1))}
          >
            <ChevronRight size={16} />
          </button>
          <button
            className="btn-secondary text-xs py-1.5 px-3"
            onClick={() => setAnchor(new Date(2026, 3, 6))}
          >
            Сегодня
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {orderColors.map(([orderNum, color]) => (
          <div key={orderNum} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-600">{orderNum}</span>
          </div>
        ))}
      </div>

      {/* Gantt grid */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${LEFT_WIDTH + days.length * 28}px` }}>
            {/* Header row: day columns */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              {/* Line label header */}
              <div
                className="flex-shrink-0 px-3 py-2 text-xs font-semibold text-gray-500 border-r border-gray-200"
                style={{ width: LEFT_WIDTH }}
              >
                Линия
              </div>
              {/* Day headers */}
              <div className="flex flex-1 relative">
                {days.map(d => (
                  <div
                    key={d.toISOString()}
                    className={`flex-shrink-0 text-center border-r border-gray-100 py-2 ${
                      isToday(d) ? 'bg-blue-50' : ''
                    }`}
                    style={{ width: 28 }}
                  >
                    <span className={`text-[10px] font-medium ${
                      isToday(d) ? 'text-blue-600' : 'text-gray-500'
                    }`}>
                      {format(d, 'd')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rows: one per production line */}
            {PRODUCTION_LINES.map(line => {
              const lineTasks = tasksByLine[line.id] ?? [];
              return (
                <div key={line.id} className="flex border-b border-gray-100 last:border-0 group">
                  {/* Line label */}
                  <div
                    className="flex-shrink-0 px-3 py-3 text-xs font-medium text-gray-700 border-r border-gray-200 bg-white group-hover:bg-gray-50 transition-colors flex items-center"
                    style={{ width: LEFT_WIDTH }}
                  >
                    <span className="truncate">{line.name}</span>
                  </div>

                  {/* Task grid area */}
                  <div
                    className="flex-1 relative bg-white group-hover:bg-gray-50/50 transition-colors"
                    style={{ height: 44 }}
                  >
                    {/* Day grid lines */}
                    <div className="absolute inset-0 flex">
                      {days.map(d => (
                        <div
                          key={d.toISOString()}
                          className={`flex-shrink-0 h-full border-r border-gray-100 ${
                            isToday(d) ? 'bg-blue-50/40' : ''
                          }`}
                          style={{ width: 28 }}
                        />
                      ))}
                    </div>

                    {/* Today indicator */}
                    {todayPos && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-blue-400 z-10 opacity-60"
                        style={{ left: `calc(${todayPos.left}% + ${todayPos.width / 2}%)` }}
                      />
                    )}

                    {/* Task bars */}
                    {lineTasks.map(task => {
                      const pos = getBarPosition(task.start, task.end, rangeStart, rangeEnd);
                      if (!pos) return null;
                      return (
                        <button
                          key={task.id}
                          className="absolute top-2 bottom-2 rounded flex items-center px-1.5 overflow-hidden z-20 cursor-pointer hover:brightness-95 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
                          style={{
                            left:            `${pos.left}%`,
                            width:           `${pos.width}%`,
                            backgroundColor: task.color,
                            minWidth:        '2px',
                          }}
                          onClick={() => setPopup(task)}
                          title={task.name}
                        >
                          {pos.width > 5 && (
                            <>
                              <span className="text-white text-[9px] font-medium truncate flex-1">
                                {task.name}
                              </span>
                              <span className="text-white/80 text-[9px] ml-1 flex-shrink-0">
                                {task.progress}%
                              </span>
                            </>
                          )}
                          {/* Progress fill */}
                          <div
                            className="absolute inset-0 left-0 rounded opacity-30 bg-white"
                            style={{ width: `${task.progress}%` }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Task popup */}
      {popup && <TaskPopup task={popup} onClose={() => setPopup(null)} />}
    </div>
  );
}

// ─── Line Load Tab ────────────────────────────────────────────────────────────

// Compute load % for a line in a given week (naive: task overlaps week → adds load)
function computeWeekLoad(lineId, weekStart, tasks) {
  const weekEnd = addDays(weekStart, 6);
  const lineTasks = tasks.filter(t => t.lineId === lineId);
  if (lineTasks.length === 0) return 0;

  // Count days each task overlaps with this week
  let overlapDays = 0;
  lineTasks.forEach(t => {
    const ts = parseISO(t.start);
    const te = parseISO(t.end);
    const cs = ts < weekStart ? weekStart : ts;
    const ce = te > weekEnd   ? weekEnd   : te;
    if (ce >= cs) {
      overlapDays += differenceInDays(ce, cs) + 1;
    }
  });

  // Load: overlap / (7 * capacity * 0.01), clamp 0-100
  const line = PRODUCTION_LINES.find(l => l.id === lineId);
  if (!line) return 0;
  const maxDays = 7;
  return Math.min(100, Math.round((overlapDays / maxDays) * 100));
}

function LoadCell({ value }) {
  const cls =
    value > 80 ? 'bg-red-100 text-red-700 font-semibold' :
    value > 60 ? 'bg-yellow-100 text-yellow-700 font-semibold' :
    value > 0  ? 'bg-green-100 text-green-700' :
    'text-gray-400';
  return (
    <td className={`px-3 py-2 text-center text-xs border-r border-gray-100 last:border-0 ${cls}`}>
      {value > 0 ? `${value}%` : '—'}
    </td>
  );
}

const BASE_DATE = new Date(2026, 3, 6);

function LineLoadTab({ tasks }) {
  // Generate 8 weeks starting from current week
  const weeks = useMemo(() => {
    const ws = startOfWeek(BASE_DATE, { weekStartsOn: 1 });
    return Array.from({ length: 8 }, (_, i) => addWeeks(ws, i - 1));
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Загрузка производственных линий по неделям.{' '}
        <span className="inline-flex items-center gap-2 ml-2">
          <span className="w-3 h-3 rounded-sm bg-green-200 inline-block" /> &lt;60%
          <span className="w-3 h-3 rounded-sm bg-yellow-200 inline-block ml-2" /> 60–80%
          <span className="w-3 h-3 rounded-sm bg-red-200 inline-block ml-2" /> &gt;80%
        </span>
      </p>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-48">
                  Линия
                </th>
                {weeks.map(ws => (
                  <th
                    key={ws.toISOString()}
                    className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap border-l border-gray-100"
                  >
                    {format(ws, 'd MMM', { locale: ru })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {PRODUCTION_LINES.map(line => (
                <tr key={line.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap border-r border-gray-100">
                    {line.name}
                  </td>
                  {weeks.map(ws => (
                    <LoadCell
                      key={ws.toISOString()}
                      value={computeWeekLoad(line.id, ws, tasks)}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Update Progress Modal ────────────────────────────────────────────────────

function UpdateProgressModal({ isOpen, onClose, task, onSave }) {
  const [progress, setProgress] = useState(task?.progress ?? 0);
  const [status,   setStatus]   = useState(task?.status ?? 'planned');

  // Sync when task changes
  useState(() => {
    if (task) { setProgress(task.progress); setStatus(task.status); }
  });

  const handleSave = () => {
    onSave(task.id, { progress: parseInt(progress, 10), status });
    onClose();
  };

  if (!task) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Обновить задачу"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={handleSave}>Сохранить</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-800 mb-1">{task.name}</p>
          <p className="text-xs text-gray-500">{task.orderNumber} · {task.start} — {task.end}</p>
        </div>

        {/* Progress slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Прогресс</label>
            <span className="text-sm font-semibold text-blue-600">{progress}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
            className="w-full h-2 rounded-full appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Progress bar preview */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Status */}
        <div>
          <label className="label">Статус</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="planned">Запланирован</option>
            <option value="in_progress">В работе</option>
            <option value="completed">Завершён</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

function TasksTab({ tasks }) {
  const updateProductionTask = useAppStore(s => s.updateProductionTask);
  const isProductionHead = true; // all users can manage tasks

  const [statusFilter, setStatusFilter] = useState('');
  const [lineFilter,   setLineFilter]   = useState('');
  const [orderFilter,  setOrderFilter]  = useState('');
  const [editTask,     setEditTask]     = useState(null);
  const [modalOpen,    setModalOpen]    = useState(false);

  // Unique orders for filter
  const orderNumbers = [...new Set(tasks.map(t => t.orderNumber))];

  const filtered = tasks.filter(t => {
    const matchStatus = !statusFilter || t.status === statusFilter;
    const matchLine   = !lineFilter   || t.lineId === parseInt(lineFilter, 10);
    const matchOrder  = !orderFilter  || t.orderNumber === orderFilter;
    return matchStatus && matchLine && matchOrder;
  });

  const openEdit = (task) => {
    setEditTask(task);
    setModalOpen(true);
  };

  const handleSave = (id, updates) => {
    updateProductionTask(id, updates);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Status */}
        <select
          className="input max-w-[180px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="planned">Запланирован</option>
          <option value="in_progress">В работе</option>
          <option value="completed">Завершён</option>
        </select>

        {/* Line */}
        <select
          className="input max-w-[200px]"
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value)}
        >
          <option value="">Все линии</option>
          {PRODUCTION_LINES.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        {/* Order */}
        <select
          className="input max-w-[180px]"
          value={orderFilter}
          onChange={(e) => setOrderFilter(e.target.value)}
        >
          <option value="">Все заказы</option>
          {orderNumbers.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {isProductionHead && (
                  <th className="px-3 py-3 w-8" />
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Задача
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Заказ
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Линия
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Начало
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Конец
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap min-w-[140px]">
                  Прогресс
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Статус
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Ответственный
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={isProductionHead ? 10 : 9}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    Нет данных
                  </td>
                </tr>
              ) : (
                filtered.map(task => {
                  const line = PRODUCTION_LINES.find(l => l.id === task.lineId);
                  return (
                    <tr key={task.id} className="hover:bg-blue-50/40 transition-colors">
                      {/* Drag handle — production_head only, visual */}
                      {isProductionHead && (
                        <td className="px-3 py-3">
                          <GripVertical
                            size={14}
                            className="text-gray-300 cursor-grab active:cursor-grabbing"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-800">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: task.color }}
                          />
                          <span className="max-w-[200px] truncate" title={task.name}>
                            {task.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {task.orderNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {line?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {task.start}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {task.end}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden min-w-[80px]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width:           `${task.progress}%`,
                                backgroundColor: task.color,
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">
                            {task.progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {task.responsible}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1"
                          onClick={() => openEdit(task)}
                        >
                          <SlidersHorizontal size={12} />
                          Обновить
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Progress Modal */}
      {editTask && (
        <UpdateProgressModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setEditTask(null); }}
          task={editTask}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'gantt', label: 'Диаграмма Ганта' },
  { id: 'load',  label: 'Загрузка линий' },
  { id: 'tasks', label: 'Производственные задачи' },
];

export default function ProductionPage() {
  const tasks     = useAppStore(s => s.productionTasks);
  const [activeTab, setActiveTab] = useState('gantt');

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Производство</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Задач: <strong className="text-gray-800">{tasks.length}</strong>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {TABS.map(tab => (
            <Tab
              key={tab.id}
              label={tab.label}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'gantt' && <GanttTab tasks={tasks} />}
        {activeTab === 'load'  && <LineLoadTab tasks={tasks} />}
        {activeTab === 'tasks' && <TasksTab tasks={tasks} />}
      </div>
    </div>
  );
}
