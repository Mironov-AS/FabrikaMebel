import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Filter, Trash2 } from 'lucide-react';
import useAppStore from '../../store/appStore';
import { formatMoney } from '../../data/mockData';
import { STATUS_LABELS } from '../../constants/statuses';
import { WAREHOUSE_SERVICE_ID } from '../../constants/services';
import StatusBadge from '../../components/ui/StatusBadge';
import PriorityBadge, { PRIORITY_MAP } from '../../components/ui/PriorityBadge';
import Modal from '../../components/ui/Modal';
import Table from '../../components/ui/Table';
import SearchInput from '../../components/ui/SearchInput';
import ProgressBar from '../../components/ui/ProgressBar';

// ─── Compute completion % ─────────────────────────────────────────────────────

function completionPct(spec) {
  if (!spec || spec.length === 0) return 0;
  const done = spec.filter(i => i.shipped >= i.quantity).length;
  return (done / spec.length) * 100;
}

// ─── Empty spec item ──────────────────────────────────────────────────────────

let _itemKeyCounter = 0;
const nextKey = () => ++_itemKeyCounter;

const emptySpecItem = () => ({ nomenclatureId: '', quantity: '', _key: nextKey() });

// ─── New Order Modal ──────────────────────────────────────────────────────────

const EMPTY_FORM = {
  number: '',
  contractId: '',
  shipmentDeadline: '',
  priority: 'medium',
};

function NewOrderModal({ isOpen, onClose }) {
  const addOrder       = useAppStore(s => s.addOrder);
  const contracts      = useAppStore(s => s.contracts);
  const counterparties = useAppStore(s => s.counterparties);
  const nomenclature   = useAppStore(s => s.nomenclature);

  // Only active items can be added to orders
  const activeItems = nomenclature.filter(n => n.status === 'active');

  const [form,  setForm]  = useState(EMPTY_FORM);
  const [items, setItems] = useState([emptySpecItem()]);

  const setField = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const selectedContract = contracts.find(c => c.id === parseInt(form.contractId, 10));
  const counterparty = selectedContract
    ? counterparties.find(cp => cp.id === selectedContract.counterpartyId)
    : null;

  const handleItemChange = (idx, key, value) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [key]: value };
      // When nomenclature item is selected, carry over its price
      if (key === 'nomenclatureId') {
        const nom = activeItems.find(n => n.id === parseInt(value, 10));
        updated._nom = nom ?? null;
      }
      return updated;
    }));
  };

  const addItem = () => setItems(prev => [...prev, emptySpecItem()]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setItems([emptySpecItem()]);
    onClose();
  };

  const handleSave = () => {
    if (!form.number || !form.contractId) return;
    const spec = items
      .filter(it => it.nomenclatureId && parseInt(it.quantity, 10) > 0)
      .map((it, idx) => {
        const nom = it._nom ?? activeItems.find(n => n.id === parseInt(it.nomenclatureId, 10));
        return {
          id: Date.now() + idx,
          nomenclatureId: nom?.id ?? null,
          name:     nom?.name     ?? '',
          article:  nom?.article  ?? '',
          category: nom?.category ?? '',
          unit:     nom?.unit     ?? 'шт',
          quantity: parseInt(it.quantity, 10),
          price:    nom?.price    ?? 0,
          status:   'planned',
          shipped:  0,
        };
      });
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

  const canSave = form.number.trim() && form.contractId
    && items.some(it => it.nomenclatureId && parseInt(it.quantity, 10) > 0);

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
          <input className="input" placeholder="ЗАК-2026-XXXX" value={form.number} onChange={setField('number')} />
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
          <input className="input" type="date" value={form.shipmentDeadline} onChange={setField('shipmentDeadline')} />
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

        {/* Спецификация — из номенклатуры */}
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

          {activeItems.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-2">
              Нет активных позиций в номенклатуре. Добавьте товары в разделе «Номенклатура».
            </p>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {items.map((item, idx) => {
              const nom = item._nom ?? activeItems.find(n => n.id === parseInt(item.nomenclatureId, 10));
              return (
                <div key={item._key} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <select
                      className="input flex-1 text-xs py-1.5"
                      value={item.nomenclatureId}
                      onChange={e => handleItemChange(idx, 'nomenclatureId', e.target.value)}
                    >
                      <option value="">— Выберите из номенклатуры —</option>
                      {activeItems.map(n => (
                        <option key={n.id} value={n.id}>
                          [{n.article}] {n.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input w-20 text-xs py-1.5 text-center"
                      type="number"
                      min="1"
                      placeholder="Кол-во"
                      value={item.quantity}
                      onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                    />
                    <button
                      type="button"
                      className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors p-1"
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {nom && (
                    <div className="flex items-center gap-3 px-1 text-xs text-gray-400">
                      <span>{nom.category}</span>
                      <span>·</span>
                      <span>{new Intl.NumberFormat('ru-RU').format(nom.price)} ₽ / {nom.unit}</span>
                      {item.quantity > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-gray-600 font-medium">
                            Итого: {new Intl.NumberFormat('ru-RU').format(nom.price * parseInt(item.quantity, 10))} ₽
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Товары выбираются из справочника номенклатуры
          </p>
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

  const isWarehouse = currentService === WAREHOUSE_SERVICE_ID;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const filtered = orders.filter(o => {
    // Warehouse sees orders ready for shipment or already scheduled (shipment registered but not confirmed)
    if (isWarehouse && o.status !== 'ready_for_shipment' && o.status !== 'scheduled_for_shipment') return false;

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
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по номеру, договору, контрагенту..."
          className="flex-1 min-w-[200px] max-w-sm"
        />

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
        Показано: <strong className="text-gray-800">{filtered.length}</strong> из {isWarehouse ? orders.filter(o => o.status === 'ready_for_shipment' || o.status === 'scheduled_for_shipment').length : orders.length}
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
