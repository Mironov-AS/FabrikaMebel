import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, X, Trash2 } from 'lucide-react';
import useAppStore from '../../store/appStore';
import { formatMoney, STATUS_LABELS } from '../../data/mockData';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Table from '../../components/ui/Table';

// ─── Priority badge helper ────────────────────────────────────────────────────

const PRIORITY_MAP = {
  high:   { cls: 'badge-red',    label: 'Высокий' },
  medium: { cls: 'badge-yellow', label: 'Средний' },
  low:    { cls: 'badge-green',  label: 'Низкий'  },
};

function PriorityBadge({ priority }) {
  const p = PRIORITY_MAP[priority] ?? { cls: 'badge-gray', label: priority };
  return <span className={p.cls}>{p.label}</span>;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }) {
  const pct = Math.round(Math.min(100, Math.max(0, value)));
  const color =
    pct >= 80 ? 'bg-green-500' :
    pct >= 40 ? 'bg-blue-500' :
    'bg-gray-300';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ─── Compute completion % ─────────────────────────────────────────────────────

function completionPct(spec) {
  if (!spec || spec.length === 0) return 0;
  const done = spec.filter(i => i.shipped >= i.quantity).length;
  return (done / spec.length) * 100;
}

// ─── Empty spec item ──────────────────────────────────────────────────────────

const EMPTY_ITEM = { name: '', article: '', quantity: '', price: '' };

// ─── New Order Modal ──────────────────────────────────────────────────────────

const EMPTY_FORM = {
  number: '',
  contractId: '',
  shipmentDeadline: '',
  priority: 'medium',
};

function NewOrderModal({ isOpen, onClose }) {
  const addOrder = useAppStore(s => s.addOrder);
  const contracts = useAppStore(s => s.contracts);
  const counterparties = useAppStore(s => s.counterparties);

  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState([{ ...EMPTY_ITEM, _key: Date.now() }]);

  const setField = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  // Auto-fill counterparty from selected contract
  const selectedContract = contracts.find(c => c.id === parseInt(form.contractId, 10));
  const counterparty = selectedContract
    ? counterparties.find(cp => cp.id === selectedContract.counterpartyId)
    : null;

  const handleItemChange = (idx, key, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: value } : it));
  };

  const addItem = () => {
    setItems(prev => [...prev, { ...EMPTY_ITEM, _key: Date.now() }]);
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setItems([{ ...EMPTY_ITEM, _key: Date.now() }]);
    onClose();
  };

  const handleSave = () => {
    if (!form.number || !form.contractId) return;
    const spec = items
      .filter(it => it.name.trim())
      .map((it, idx) => ({
        id: Date.now() + idx,
        name: it.name,
        article: it.article,
        quantity: parseInt(it.quantity, 10) || 0,
        price: parseFloat(it.price) || 0,
        status: 'planned',
        shipped: 0,
      }));
    const total = spec.reduce((s, it) => s + it.quantity * it.price, 0);
    addOrder({
      number: form.number,
      contractId: parseInt(form.contractId, 10),
      counterpartyId: selectedContract?.counterpartyId ?? null,
      date: new Date().toISOString().slice(0, 10),
      shipmentDeadline: form.shipmentDeadline,
      priority: form.priority,
      status: 'planned',
      totalAmount: total,
      specification: spec,
    });
    handleClose();
  };

  const canSave = form.number.trim() && form.contractId;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Новый заказ"
      footer={
        <>
          <button className="btn-secondary" onClick={handleClose}>Отмена</button>
          <button className="btn-primary" onClick={handleSave} disabled={!canSave}>
            Создать
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Номер */}
        <div>
          <label className="label">Номер <span className="text-red-400">*</span></label>
          <input
            className="input"
            placeholder="ЗАК-2026-XXXX"
            value={form.number}
            onChange={setField('number')}
          />
        </div>

        {/* Договор */}
        <div>
          <label className="label">Договор <span className="text-red-400">*</span></label>
          <select className="input" value={form.contractId} onChange={setField('contractId')}>
            <option value="">— Выберите договор —</option>
            {contracts.map(c => (
              <option key={c.id} value={c.id}>{c.number} — {c.subject}</option>
            ))}
          </select>
        </div>

        {/* Контрагент (auto-fill) */}
        <div>
          <label className="label">Контрагент</label>
          <input
            className="input bg-gray-50 text-gray-500 cursor-not-allowed"
            readOnly
            value={counterparty?.name ?? '— будет заполнено автоматически —'}
          />
        </div>

        {/* Дата отгрузки */}
        <div>
          <label className="label">Дата отгрузки</label>
          <input
            className="input"
            type="date"
            value={form.shipmentDeadline}
            onChange={setField('shipmentDeadline')}
          />
        </div>

        {/* Приоритет */}
        <div>
          <label className="label">Приоритет</label>
          <select className="input" value={form.priority} onChange={setField('priority')}>
            <option value="high">Высокий</option>
            <option value="medium">Средний</option>
            <option value="low">Низкий</option>
          </select>
        </div>

        {/* Спецификация */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Спецификация</label>
            <button
              type="button"
              className="btn-secondary flex items-center gap-1 py-1 px-2 text-xs"
              onClick={addItem}
            >
              <Plus size={12} /> Добавить позицию
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {items.map((item, idx) => (
              <div key={item._key} className="grid grid-cols-12 gap-1.5 items-center">
                {/* Наименование */}
                <input
                  className="input col-span-4 text-xs py-1.5"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                />
                {/* Артикул */}
                <input
                  className="input col-span-2 text-xs py-1.5"
                  placeholder="Артикул"
                  value={item.article}
                  onChange={(e) => handleItemChange(idx, 'article', e.target.value)}
                />
                {/* Кол-во */}
                <input
                  className="input col-span-2 text-xs py-1.5"
                  type="number"
                  min="1"
                  placeholder="Кол-во"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                />
                {/* Цена */}
                <input
                  className="input col-span-3 text-xs py-1.5"
                  type="number"
                  min="0"
                  placeholder="Цена"
                  value={item.price}
                  onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                />
                {/* Удалить */}
                <button
                  type="button"
                  className="col-span-1 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Наименование / Артикул / Кол-во / Цена</p>
        </div>
      </div>
    </Modal>
  );
}

// ─── Orders List ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['planned', 'in_production', 'ready_for_shipment', 'shipped', 'completed'];
const PRIORITY_OPTIONS = ['high', 'medium', 'low'];

export default function OrdersList() {
  const orders = useAppStore(s => s.orders);
  const contracts = useAppStore(s => s.contracts);
  const counterparties = useAppStore(s => s.counterparties);
  const currentService = useAppStore(s => s.currentService);
  const navigate = useNavigate();

  const isWarehouse = currentService === 'warehouse-logistics';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const filtered = orders.filter(o => {
    // Warehouse only sees ready-for-shipment (not yet shipped) orders
    if (isWarehouse && o.status !== 'ready_for_shipment') return false;

    const contract = contracts.find(c => c.id === o.contractId);
    const cp = counterparties.find(c => c.id === o.counterpartyId);
    const matchSearch =
      !search ||
      o.number.toLowerCase().includes(search.toLowerCase()) ||
      (contract?.number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (cp?.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || o.status === statusFilter;
    const matchPriority = !priorityFilter || o.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const baseColumns = [
    { key: 'number', label: 'Номер' },
    {
      key: 'contractId',
      label: 'Договор',
      render: (val) => {
        const c = contracts.find(c => c.id === val);
        return c ? (
          <span className="text-blue-600 font-medium">{c.number}</span>
        ) : '—';
      },
    },
    {
      key: 'counterpartyId',
      label: 'Контрагент',
      render: (val) => counterparties.find(c => c.id === val)?.name ?? '—',
    },
    {
      key: 'shipmentDeadline',
      label: 'Дата отгрузки',
      render: (val) => val || '—',
    },
    {
      key: 'priority',
      label: 'Приоритет',
      render: (val) => <PriorityBadge priority={val} />,
    },
    {
      key: 'status',
      label: 'Статус',
      render: (val) => <StatusBadge status={val} />,
    },
    // Amount column hidden for warehouse
    ...(!isWarehouse ? [{
      key: 'totalAmount',
      label: 'Сумма',
      render: (val) => formatMoney(val),
    }] : []),
    {
      key: 'specification',
      label: 'Выполнение',
      render: (val) => <ProgressBar value={completionPct(val)} />,
    },
  ];

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Заказы</h1>
          {isWarehouse && (
            <p className="text-sm text-gray-500 mt-0.5">Готовые к отгрузке заказы</p>
          )}
        </div>
        {!isWarehouse && (
          <button
            className="btn-primary flex items-center gap-1.5 self-start sm:self-auto"
            onClick={() => setNewOpen(true)}
          >
            <Plus size={15} />
            Новый заказ
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            className="input pl-8 pr-8"
            placeholder="Поиск по номеру, договору, контрагенту..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setSearch('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status filter — hidden for warehouse since they only see ready_for_shipment */}
        {!isWarehouse && (
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              className="input pl-8 pr-8 min-w-[180px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Все статусы</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Priority filter */}
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            className="input pl-8 pr-8 min-w-[160px]"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">Все приоритеты</option>
            {PRIORITY_OPTIONS.map(p => (
              <option key={p} value={p}>{PRIORITY_MAP[p]?.label ?? p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-500">
        Показано: <strong className="text-gray-800">{filtered.length}</strong> из {isWarehouse ? orders.filter(o => o.status === 'ready_for_shipment').length : orders.length}
      </p>

      {/* Table */}
      <Table
        columns={baseColumns}
        data={filtered}
        onRowClick={(row) => navigate(`/orders/${row.id}`)}
      />

      {/* Modal */}
      {!isWarehouse && <NewOrderModal isOpen={newOpen} onClose={() => setNewOpen(false)} />}
    </div>
  );
}
