import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, FileText, AlertTriangle, CheckCircle,
  Clock, Plus, User, Building,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import { formatMoney } from '../../data/mockData';
import { STATUS_LABELS } from '../../constants/statuses';
import StatusBadge from '../../components/ui/StatusBadge';
import Tab from '../../components/ui/Tabs';
import Modal from '../../components/ui/Modal';
import Table from '../../components/ui/Table';

// ─── Edit Contract Modal ──────────────────────────────────────────────────────

function EditContractModal({ isOpen, onClose, contract, onSave }) {
  const counterparties = useAppStore(s => s.counterparties);
  const [form, setForm] = useState({
    number: contract.number ?? '',
    date: contract.date ?? '',
    validUntil: contract.validUntil ?? '',
    status: contract.status ?? 'active',
    subject: contract.subject ?? '',
    amount: contract.amount ?? '',
    paymentDelay: contract.paymentDelay ?? '',
    penaltyRate: contract.penaltyRate ?? '',
    counterpartyId: contract.counterpartyId ?? '',
  });
  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSave = () => {
    if (!form.number || !form.date) return;
    onSave({
      ...form,
      amount: Number(form.amount),
      paymentDelay: form.paymentDelay ? Number(form.paymentDelay) : null,
      penaltyRate: form.penaltyRate ? Number(form.penaltyRate) : null,
      counterpartyId: Number(form.counterpartyId),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Редактировать договор"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={handleSave} disabled={!form.number || !form.date}>
            Сохранить
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Номер договора <span className="text-red-400">*</span></label>
            <input className="input" value={form.number} onChange={set('number')} />
          </div>
          <div>
            <label className="label">Статус</label>
            <select className="input" value={form.status} onChange={set('status')}>
              {Object.entries(STATUS_LABELS).filter(([k]) =>
                ['active','completed','suspended','draft'].includes(k)
              ).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Предмет договора</label>
          <input className="input" value={form.subject} onChange={set('subject')} />
        </div>
        <div>
          <label className="label">Контрагент</label>
          <select className="input" value={form.counterpartyId} onChange={set('counterpartyId')}>
            <option value="">— выберите —</option>
            {counterparties.map(cp => (
              <option key={cp.id} value={cp.id}>{cp.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Дата заключения <span className="text-red-400">*</span></label>
            <input className="input" type="date" value={form.date} onChange={set('date')} />
          </div>
          <div>
            <label className="label">Срок действия до</label>
            <input className="input" type="date" value={form.validUntil} onChange={set('validUntil')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Сумма (₽)</label>
            <input className="input" type="number" min="0" value={form.amount} onChange={set('amount')} />
          </div>
          <div>
            <label className="label">Отсрочка платежа (дней)</label>
            <input className="input" type="number" min="0" value={form.paymentDelay} onChange={set('paymentDelay')} />
          </div>
        </div>
        <div>
          <label className="label">Ставка штрафа (%/день)</label>
          <input className="input" type="number" min="0" step="0.01" value={form.penaltyRate} onChange={set('penaltyRate')} />
        </div>
      </div>
    </Modal>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-900 break-words">{value ?? '—'}</dd>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function InfoTab({ contract }) {
  const counterparties = useAppStore(s => s.counterparties);
  const cp = counterparties.find(c => c.id === contract.counterpartyId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Contract fields */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <FileText size={15} className="text-blue-500" />
          Реквизиты договора
        </h3>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow label="Номер" value={contract.number} />
          <InfoRow label="Дата" value={contract.date} />
          <InfoRow label="Срок действия" value={contract.validUntil} />
          <InfoRow label="Статус" value={<StatusBadge status={contract.status} />} />
          <InfoRow label="Предмет" value={contract.subject} />
          <InfoRow label="Сумма" value={formatMoney(contract.amount)} />
          <InfoRow label="Отсрочка платежа" value={contract.paymentDelay ? `${contract.paymentDelay} дн.` : null} />
          <InfoRow label="Ставка штрафа" value={contract.penaltyRate ? `${contract.penaltyRate}%` : null} />
        </dl>
      </div>

      {/* Counterparty */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Building size={15} className="text-purple-500" />
          Контрагент
        </h3>
        {cp ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoRow label="Наименование" value={cp.name} />
            <InfoRow label="ИНН" value={cp.inn} />
            <InfoRow label="КПП" value={cp.kpp} />
            <InfoRow label="Адрес" value={cp.address} />
            <InfoRow label="Контактное лицо" value={cp.contact} />
            <InfoRow label="Телефон" value={cp.phone} />
          </dl>
        ) : (
          <p className="text-sm text-gray-400">Контрагент не найден</p>
        )}
      </div>

      {/* Conditions */}
      {contract.conditions?.length > 0 && (
        <div className="card p-5 md:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Условия договора</h3>
          <ul className="space-y-2">
            {contract.conditions.map(cond => (
              <li key={cond.id} className="flex items-start gap-2.5">
                {cond.fulfilled ? (
                  <CheckCircle size={15} className="text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <Clock size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
                )}
                <span className={`text-sm ${cond.fulfilled ? 'text-gray-600' : 'text-gray-800'}`}>
                  {cond.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Add Obligation Modal ────────────────────────────────────────────────────

const OBLIGATION_EMPTY = { party: 'seller', text: '', deadline: '', status: 'pending' };

function AddObligationModal({ isOpen, onClose, onSave }) {
  const [form, setForm] = useState(OBLIGATION_EMPTY);
  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSave = () => {
    if (!form.text) return;
    onSave({ ...form, id: Date.now() });
    setForm(OBLIGATION_EMPTY);
    onClose();
  };

  const handleClose = () => {
    setForm(OBLIGATION_EMPTY);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Добавить обязательство"
      footer={
        <>
          <button className="btn-secondary" onClick={handleClose}>Отмена</button>
          <button className="btn-primary" onClick={handleSave} disabled={!form.text}>
            Добавить
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Сторона</label>
          <select className="input" value={form.party} onChange={set('party')}>
            <option value="seller">Продавец</option>
            <option value="buyer">Покупатель</option>
          </select>
        </div>
        <div>
          <label className="label">Описание обязательства <span className="text-red-400">*</span></label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Текст обязательства..."
            value={form.text}
            onChange={set('text')}
          />
        </div>
        <div>
          <label className="label">Срок исполнения</label>
          <input className="input" type="date" value={form.deadline} onChange={set('deadline')} />
        </div>
        <div>
          <label className="label">Статус</label>
          <select className="input" value={form.status} onChange={set('status')}>
            <option value="pending">Ожидается</option>
            <option value="in_progress">В работе</option>
            <option value="overdue">Просрочено</option>
            <option value="completed">Выполнено</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}

function ObligationsTab({ contract, contractId }) {
  const updateContract = useAppStore(s => s.updateContract);
  const [addOpen, setAddOpen] = useState(false);

  const obligations = contract.obligations ?? [];

  const PARTY_LABEL = { seller: 'Продавец', buyer: 'Покупатель' };

  const columns = [
    {
      key: 'party',
      label: 'Сторона',
      render: (val) => (
        <span className="flex items-center gap-1.5">
          <User size={13} className="text-gray-400" />
          {PARTY_LABEL[val] ?? val}
        </span>
      ),
    },
    { key: 'text', label: 'Обязательство' },
    { key: 'deadline', label: 'Срок', render: (val) => val || '—' },
    { key: 'status', label: 'Статус', render: (val) => <StatusBadge status={val} /> },
  ];

  const handleAdd = (obligation) => {
    updateContract(contractId, {
      obligations: [...obligations, obligation],
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Всего обязательств: <strong className="text-gray-800">{obligations.length}</strong>
        </p>
        <button
          className="btn-primary flex items-center gap-1.5"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={14} />
          Добавить
        </button>
      </div>
      <Table columns={columns} data={obligations} />
      <AddObligationModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAdd}
      />
    </div>
  );
}

function OrdersTab({ contractId }) {
  const orders = useAppStore(s => s.orders);
  const navigate = useNavigate();

  const linked = orders.filter(o => o.contractId === contractId);

  const columns = [
    { key: 'number', label: 'Номер заказа' },
    { key: 'date', label: 'Дата' },
    { key: 'shipmentDeadline', label: 'Срок отгрузки' },
    {
      key: 'totalAmount',
      label: 'Сумма',
      render: (val) => formatMoney(val),
    },
    {
      key: 'priority',
      label: 'Приоритет',
      render: (val) => {
        const map = { high: 'badge-red', medium: 'badge-yellow', low: 'badge-gray' };
        const labels = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
        return <span className={map[val] ?? 'badge-gray'}>{labels[val] ?? val}</span>;
      },
    },
    { key: 'status', label: 'Статус', render: (val) => <StatusBadge status={val} /> },
    {
      key: 'id',
      label: '',
      render: (val) => (
        <button
          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
          onClick={(e) => { e.stopPropagation(); navigate(`/orders/${val}`); }}
        >
          Открыть
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Заказов по договору: <strong className="text-gray-800">{linked.length}</strong>
      </p>
      <Table
        columns={columns}
        data={linked}
        onRowClick={(row) => navigate(`/orders/${row.id}`)}
      />
    </div>
  );
}

function VersionsTab({ contract }) {
  const versions = [...(contract.versions ?? [])].reverse();

  if (versions.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">История версий пуста</p>;
  }

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-gray-200" />

      <div className="space-y-6">
        {versions.map((v, idx) => (
          <div key={v.version} className="relative">
            {/* Dot */}
            <div className={`absolute -left-6 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
              idx === 0 ? 'bg-blue-500' : 'bg-gray-300'
            }`}>
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-blue-600">
                  Версия {v.version}
                </span>
                <span className="text-xs text-gray-400">{v.date}</span>
              </div>
              <p className="text-sm text-gray-800">{v.changes}</p>
              {v.author && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <User size={11} />
                  {v.author}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Detail Page ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'info', label: 'Информация' },
  { id: 'obligations', label: 'Обязательства' },
  { id: 'orders', label: 'Спецификация / Заказы' },
  { id: 'versions', label: 'Версии' },
];

export default function ContractDetail() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const contracts = useAppStore(s => s.contracts);
  const counterparties = useAppStore(s => s.counterparties);
  const updateContract = useAppStore(s => s.updateContract);
  const [activeTab, setActiveTab] = useState('info');
  const [editOpen, setEditOpen] = useState(false);

  const id = parseInt(contractId, 10);
  const contract = contracts.find(c => c.id === id);

  if (!contract) {
    return (
      <div className="p-6 text-center space-y-4">
        <AlertTriangle size={40} className="text-yellow-400 mx-auto" />
        <p className="text-gray-600">Договор с идентификатором <strong>{contractId}</strong> не найден.</p>
        <button className="btn-secondary" onClick={() => navigate('/contracts')}>
          Вернуться к списку
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/contracts')}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Назад"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{contract.number}</h1>
              <StatusBadge status={contract.status} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {counterparties.find(c => c.id === contract.counterpartyId)?.name ?? '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => setEditOpen(true)}>
            <Edit size={14} />
            Редактировать
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 -mx-0">
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
        {activeTab === 'info' && <InfoTab contract={contract} />}
        {activeTab === 'obligations' && (
          <ObligationsTab contract={contract} contractId={id} />
        )}
        {activeTab === 'orders' && <OrdersTab contractId={id} />}
        {activeTab === 'versions' && <VersionsTab contract={contract} />}
      </div>

      {/* Edit modal */}
      {editOpen && (
        <EditContractModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          contract={contract}
          onSave={async (updates) => {
            await updateContract(id, updates);
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}
