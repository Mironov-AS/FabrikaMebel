import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { BarChart2, FileText, CreditCard, Download, FileSpreadsheet, Eye } from 'lucide-react';
import { formatMoney } from '../../data/mockData';
import { downloadCSV, downloadJSON } from '../../utils/export';
import useAppStore from '../../store/appStore';
import Modal from '../../components/ui/Modal';

const TODAY = new Date();

// ── Mock chart data ────────────────────────────────────────────────────────────
const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр'];

const shipmentsByMonth = [
  { month: 'Янв', amount: 850000 },
  { month: 'Фев', amount: 1200000 },
  { month: 'Мар', amount: 980000 },
  { month: 'Апр', amount: 680000 },
];

const cashFlowData = [
  { month: 'Янв', income: 850000, expenses: 610000 },
  { month: 'Фев', income: 1200000, expenses: 890000 },
  { month: 'Мар', income: 980000, expenses: 740000 },
  { month: 'Апр', income: 680000, expenses: 520000 },
];


const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

// ── Report templates ───────────────────────────────────────────────────────────
const REPORT_TEMPLATES = [
  {
    id: 1,
    title: 'Исполнение обязательств',
    description: 'Отчёт о выполнении договорных обязательств в разрезе контрагентов и периодов',
    mockData: [
      { Договор: 'ДГ-2026-001', Контрагент: 'ООО «МебельТорг»', 'Обязательств': 2, 'Выполнено': 1, '%': '50%' },
      { Договор: 'ДГ-2026-002', Контрагент: 'АО «ОфисПлюс»', 'Обязательств': 1, 'Выполнено': 0, '%': '0%' },
      { Договор: 'ДГ-2026-003', Контрагент: 'ЗАО «ГрандМебель»', 'Обязательств': 2, 'Выполнено': 0, '%': '0%' },
    ],
  },
  {
    id: 2,
    title: 'Дебиторская задолженность',
    description: 'Текущая дебиторская задолженность по контрагентам с детализацией просрочки',
    mockData: [
      { Контрагент: 'АО «ОфисПлюс»', 'Сумма': '468 000 ₽', 'Просрочено': '300 000 ₽', 'Дней просрочки': 5 },
      { Контрагент: 'ООО «МебельТорг»', 'Сумма': '0 ₽', 'Просрочено': '0 ₽', 'Дней просрочки': 0 },
    ],
  },
  {
    id: 3,
    title: 'Денежные потоки',
    description: 'Анализ входящих и исходящих денежных потоков по периодам',
    mockData: [
      { Месяц: 'Январь', 'Поступления': '850 000 ₽', 'Расходы': '610 000 ₽', 'Баланс': '240 000 ₽' },
      { Месяц: 'Февраль', 'Поступления': '1 200 000 ₽', 'Расходы': '890 000 ₽', 'Баланс': '310 000 ₽' },
      { Месяц: 'Март', 'Поступления': '980 000 ₽', 'Расходы': '740 000 ₽', 'Баланс': '240 000 ₽' },
      { Месяц: 'Апрель', 'Поступления': '680 000 ₽', 'Расходы': '520 000 ₽', 'Баланс': '160 000 ₽' },
    ],
  },
  {
    id: 4,
    title: 'Анализ соблюдения сроков',
    description: 'Статистика нарушений сроков поставки и оплаты в разрезе контрагентов',
    mockData: [
      { Контрагент: 'ООО «МебельТорг»', 'Нарушений оплаты': 0, 'Нарушений отгрузки': 0 },
      { Контрагент: 'АО «ОфисПлюс»', 'Нарушений оплаты': 1, 'Нарушений отгрузки': 0 },
      { Контрагент: 'ЗАО «ГрандМебель»', 'Нарушений оплаты': 0, 'Нарушений отгрузки': 0 },
    ],
  },
  {
    id: 5,
    title: 'Статистика по контрагентам',
    description: 'Сводная статистика активности и финансовых показателей по каждому контрагенту',
    mockData: [
      { Контрагент: 'ООО «МебельТорг»', 'Договоров': 2, 'Отгрузок': 1, 'Сумма': '2 850 000 ₽' },
      { Контрагент: 'АО «ОфисПлюс»', 'Договоров': 1, 'Отгрузок': 2, 'Сумма': '1 450 000 ₽' },
      { Контрагент: 'ЗАО «ГрандМебель»', 'Договоров': 1, 'Отгрузок': 0, 'Сумма': '5 200 000 ₽' },
    ],
  },
];

// ── Receivables computation ────────────────────────────────────────────────────
function buildReceivables(counterparties, shipments) {
  return counterparties.map((cp) => {
    const cpShipments = shipments.filter((s) => s.counterpartyId === cp.id);
    const totalShipped = cpShipments.reduce((acc, s) => acc + s.amount, 0);
    const totalPaid = cpShipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
    const debt = totalShipped - totalPaid;
    const overdueShipments = cpShipments.filter((s) => {
      if (s.paidAmount >= s.amount) return false;
      return s.paymentDueDate && new Date(s.paymentDueDate) < TODAY;
    });
    let maxOverdueDays = 0;
    let totalPenalty = 0;
    overdueShipments.forEach((s) => {
      const days = Math.floor((TODAY - new Date(s.paymentDueDate)) / (1000 * 60 * 60 * 24));
      if (days > maxOverdueDays) maxOverdueDays = days;
      totalPenalty += days * (s.amount - (s.paidAmount || 0)) * 0.001;
    });
    return {
      id: cp.id,
      name: cp.name,
      totalShipped,
      totalPaid,
      debt,
      overdueDays: maxOverdueDays,
      penalty: Math.round(totalPenalty),
    };
  }).filter((r) => r.totalShipped > 0);
}

const CHART_TOOLTIP_FORMATTER = (value) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₽';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [previewReport, setPreviewReport] = useState(null);
  const contracts = useAppStore(s => s.contracts);
  const shipments = useAppStore(s => s.shipments);
  const counterparties = useAppStore(s => s.counterparties);

  const receivables = buildReceivables(counterparties, shipments);
  const totals = receivables.reduce(
    (acc, r) => ({
      totalShipped: acc.totalShipped + r.totalShipped,
      totalPaid: acc.totalPaid + r.totalPaid,
      debt: acc.debt + r.debt,
      penalty: acc.penalty + r.penalty,
    }),
    { totalShipped: 0, totalPaid: 0, debt: 0, penalty: 0 },
  );

  // Pie chart data from contracts
  const contractStatusMap = {};
  contracts.forEach((c) => {
    contractStatusMap[c.status] = (contractStatusMap[c.status] || 0) + 1;
  });
  const contractStatusLabels = { active: 'Активен', completed: 'Завершён', suspended: 'Приостановлен', draft: 'Черновик' };
  const pieData = Object.entries(contractStatusMap).map(([status, count]) => ({
    name: contractStatusLabels[status] ?? status,
    value: count,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Аналитика и отчёты</h1>
        <p className="text-sm text-gray-500 mt-0.5">Графики, шаблоны отчётов и дебиторская задолженность</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {[
          { key: 'dashboard', label: 'Дашборд', icon: BarChart2 },
          { key: 'templates', label: 'Шаблоны отчётов', icon: FileText },
          { key: 'receivables', label: 'Дебиторская задолженность', icon: CreditCard },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Dashboard ── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar: Shipments by month */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Отгрузки по месяцам</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={shipmentsByMonth} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + 'к'} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={CHART_TOOLTIP_FORMATTER} />
                  <Bar dataKey="amount" name="Отгрузки" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Line: Cash flows */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Денежные потоки</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={cashFlowData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + 'к'} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={CHART_TOOLTIP_FORMATTER} />
                  <Legend />
                  <Line type="monotone" dataKey="income" name="Поступления" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="expenses" name="Расходы" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie: Contract statuses */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Статусы договоров</h3>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {pieData.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-gray-600">{entry.name}</span>
                      <span className="ml-auto font-semibold text-gray-900">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Templates ── */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {REPORT_TEMPLATES.map((tpl) => (
            <div key={tpl.id} className="card flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-blue-50 rounded-xl flex-shrink-0">
                  <FileText size={18} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{tpl.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{tpl.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-auto">
                <button
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  onClick={() => setPreviewReport(tpl)}
                >
                  <Eye size={13} />
                  Сформировать
                </button>
                <button
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  title="Скачать как CSV (открывается в Excel)"
                  onClick={() => downloadCSV(`${tpl.title}.csv`, tpl.mockData)}
                >
                  <FileSpreadsheet size={13} />
                  Excel / CSV
                </button>
                <button
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  onClick={() => downloadJSON(`${tpl.title}.json`, tpl.mockData)}
                >
                  <Download size={13} />
                  JSON
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB 3: Receivables ── */}
      {activeTab === 'receivables' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              className="btn-secondary flex items-center gap-2"
              onClick={() => {
                const rows = receivables.map(r => ({
                  Контрагент: r.name,
                  'Сумма отгрузок': formatMoney(r.totalShipped),
                  Оплачено: formatMoney(r.totalPaid),
                  Задолженность: formatMoney(r.debt),
                  'Дней просрочки': r.overdueDays || 0,
                  Штрафы: formatMoney(r.penalty),
                }));
                downloadCSV('Дебиторская задолженность.csv', rows);
              }}
            >
              <Download size={14} />
              Экспорт в CSV
            </button>
          </div>
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Контрагент', 'Сумма отгрузок', 'Оплачено', 'Задолженность', 'Дней просрочки', 'Штрафы'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {receivables.map((r) => (
                  <tr key={r.id} className={r.overdueDays > 0 ? 'bg-red-50' : 'hover:bg-gray-50 transition-colors'}>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.name}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatMoney(r.totalShipped)}</td>
                    <td className="px-4 py-3 text-green-700 whitespace-nowrap">{formatMoney(r.totalPaid)}</td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      <span className={r.debt > 0 ? 'text-red-600' : 'text-gray-400'}>{formatMoney(r.debt)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.overdueDays > 0 ? (
                        <span className="text-red-600 font-semibold">{r.overdueDays} дн.</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.penalty > 0 ? <span className="text-red-600 font-semibold">{formatMoney(r.penalty)}</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                  <td className="px-4 py-3 text-gray-900">Итого</td>
                  <td className="px-4 py-3 text-gray-900">{formatMoney(totals.totalShipped)}</td>
                  <td className="px-4 py-3 text-green-700">{formatMoney(totals.totalPaid)}</td>
                  <td className="px-4 py-3 text-red-600">{formatMoney(totals.debt)}</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3 text-red-600">{formatMoney(totals.penalty)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        </div>
      )}

      {/* Modal: Report Preview */}
      <Modal
        isOpen={!!previewReport}
        onClose={() => setPreviewReport(null)}
        title={previewReport ? `Отчёт: ${previewReport.title}` : ''}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setPreviewReport(null)}>Закрыть</button>
            <button
              className="btn-secondary flex items-center gap-2"
              onClick={() => previewReport && downloadJSON(`${previewReport.title}.json`, previewReport.mockData)}
            >
              <Download size={14} />
              JSON
            </button>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => previewReport && downloadCSV(`${previewReport.title}.csv`, previewReport.mockData)}
            >
              <FileSpreadsheet size={14} />
              Excel / CSV
            </button>
          </>
        }
      >
        {previewReport && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {Object.keys(previewReport.mockData[0] ?? {}).map((col) => (
                    <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewReport.mockData.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap">{String(val)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
