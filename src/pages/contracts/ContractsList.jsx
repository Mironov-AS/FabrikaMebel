import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Upload, Search, Filter, FileText,
  Loader2, CheckCircle, X, File,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import { formatMoney, STATUS_LABELS } from '../../data/mockData';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Table from '../../components/ui/Table';

// ─── Import Modal ────────────────────────────────────────────────────────────

const MOCK_EXTRACTED = {
  number: 'ДГ-2026-005',
  parties: 'ООО «МебельТорг» и ООО «НоваяФирма»',
  date: '2026-04-06',
  amount: '750000',
  paymentTerms: 'Оплата в течение 30 дней с момента поставки',
  penaltyTerms: '0,1% от суммы долга за каждый день просрочки',
};

function ImportModal({ isOpen, onClose }) {
  const addContract = useAppStore(s => s.addContract);
  const [file, setFile] = useState(null);
  const [stage, setStage] = useState('drop'); // drop | analyzing | extracted
  const [fields, setFields] = useState(MOCK_EXTRACTED);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleClose = () => {
    setFile(null);
    setStage('drop');
    setFields(MOCK_EXTRACTED);
    onClose();
  };

  const handleFile = useCallback((f) => {
    if (!f) return;
    setFile(f);
    setStage('analyzing');
    setTimeout(() => {
      setFields({ ...MOCK_EXTRACTED, number: `ДГ-2026-${String(Math.floor(Math.random() * 900) + 100)}` });
      setStage('extracted');
    }, 2000);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSave = () => {
    addContract({
      number: fields.number,
      counterpartyId: 1,
      date: fields.date,
      validUntil: '',
      status: 'draft',
      amount: parseFloat(fields.amount) || 0,
      subject: fields.paymentTerms,
      paymentDelay: 30,
      penaltyRate: 0.1,
      conditions: [],
      obligations: [],
    });
    handleClose();
  };

  const extractedFields = [
    { key: 'number', label: 'Номер договора' },
    { key: 'parties', label: 'Стороны' },
    { key: 'date', label: 'Дата' },
    { key: 'amount', label: 'Сумма' },
    { key: 'paymentTerms', label: 'Условия оплаты' },
    { key: 'penaltyTerms', label: 'Штрафные санкции' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Импорт договора"
      footer={
        stage === 'extracted' ? (
          <>
            <button className="btn-secondary" onClick={handleClose}>Отмена</button>
            <button className="btn-primary" onClick={handleSave}>Сохранить</button>
          </>
        ) : null
      }
    >
      {stage === 'drop' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center
            cursor-pointer transition-colors gap-3
            ${isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Upload size={36} className={isDragOver ? 'text-blue-500' : 'text-gray-400'} />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">Перетащите файл или нажмите для выбора</p>
            <p className="text-xs text-gray-400 mt-1">Поддерживаются форматы: PDF, DOCX</p>
          </div>
        </div>
      )}

      {stage === 'analyzing' && (
        <div className="py-10 flex flex-col items-center gap-4">
          <Loader2 size={40} className="text-blue-500 animate-spin" />
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800">Анализ документа...</p>
            {file && (
              <p className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                <File size={12} /> {file.name}
              </p>
            )}
          </div>
        </div>
      )}

      {stage === 'extracted' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <CheckCircle size={16} />
            <span className="text-sm font-medium">Поля успешно извлечены</span>
          </div>
          {extractedFields.map(({ key, label }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                className="input"
                value={fields[key] ?? ''}
                onChange={(e) => setFields(prev => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ─── New Contract Modal ───────────────────────────────────────────────────────

const EMPTY_FORM = {
  number: '',
  counterpartyId: '',
  date: '',
  validUntil: '',
  subject: '',
  amount: '',
  paymentDelay: '',
  penaltyRate: '',
};

function NewContractModal({ isOpen, onClose }) {
  const addContract = useAppStore(s => s.addContract);
  const counterparties = useAppStore(s => s.counterparties);
  const [form, setForm] = useState(EMPTY_FORM);

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleClose = () => {
    setForm(EMPTY_FORM);
    onClose();
  };

  const handleSave = () => {
    if (!form.number || !form.counterpartyId) return;
    addContract({
      number: form.number,
      counterpartyId: parseInt(form.counterpartyId, 10),
      date: form.date,
      validUntil: form.validUntil,
      status: 'draft',
      amount: parseFloat(form.amount) || 0,
      subject: form.subject,
      paymentDelay: parseInt(form.paymentDelay, 10) || 0,
      penaltyRate: parseFloat(form.penaltyRate) || 0,
      conditions: [],
      obligations: [],
    });
    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Новый договор"
      footer={
        <>
          <button className="btn-secondary" onClick={handleClose}>Отмена</button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!form.number || !form.counterpartyId}
          >
            Создать
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Номер <span className="text-red-400">*</span></label>
          <input className="input" placeholder="ДГ-2026-XXX" value={form.number} onChange={set('number')} />
        </div>
        <div>
          <label className="label">Контрагент <span className="text-red-400">*</span></label>
          <select className="input" value={form.counterpartyId} onChange={set('counterpartyId')}>
            <option value="">— Выберите контрагента —</option>
            {counterparties.map(cp => (
              <option key={cp.id} value={cp.id}>{cp.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Дата</label>
            <input className="input" type="date" value={form.date} onChange={set('date')} />
          </div>
          <div>
            <label className="label">Срок действия</label>
            <input className="input" type="date" value={form.validUntil} onChange={set('validUntil')} />
          </div>
        </div>
        <div>
          <label className="label">Предмет договора</label>
          <input className="input" placeholder="Поставка мебели..." value={form.subject} onChange={set('subject')} />
        </div>
        <div>
          <label className="label">Сумма (руб.)</label>
          <input className="input" type="number" min="0" placeholder="0" value={form.amount} onChange={set('amount')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Отсрочка платежа (дней)</label>
            <input className="input" type="number" min="0" placeholder="30" value={form.paymentDelay} onChange={set('paymentDelay')} />
          </div>
          <div>
            <label className="label">Ставка штрафа (%)</label>
            <input className="input" type="number" min="0" step="0.01" placeholder="0.1" value={form.penaltyRate} onChange={set('penaltyRate')} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Contracts List ───────────────────────────────────────────────────────────

export default function ContractsList() {
  const contracts = useAppStore(s => s.contracts);
  const counterparties = useAppStore(s => s.counterparties);
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const findCp = (id) => counterparties.find(p => p.id === id);

  const filtered = contracts.filter(c => {
    const cp = findCp(c.counterpartyId);
    const matchSearch =
      !search ||
      c.number.toLowerCase().includes(search.toLowerCase()) ||
      (cp?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.subject ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const columns = [
    { key: 'number', label: 'Номер' },
    {
      key: 'counterpartyId',
      label: 'Контрагент',
      render: (val) => findCp(val)?.name ?? '—',
    },
    { key: 'date', label: 'Дата' },
    { key: 'validUntil', label: 'Срок действия', render: (val) => val || '—' },
    {
      key: 'subject',
      label: 'Предмет',
      render: (val) => (
        <span className="block max-w-xs truncate" title={val}>{val || '—'}</span>
      ),
    },
    { key: 'amount', label: 'Сумма', render: (val) => formatMoney(val) },
    { key: 'status', label: 'Статус', render: (val) => <StatusBadge status={val} /> },
    {
      key: 'id',
      label: 'Действия',
      render: (val) => (
        <button
          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
          onClick={(e) => { e.stopPropagation(); navigate(`/contracts/${val}`); }}
        >
          Открыть
        </button>
      ),
    },
  ];

  const statusOptions = [...new Set(contracts.map(c => c.status))];

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Договоры</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="btn-secondary flex items-center gap-1.5"
            onClick={() => setImportOpen(true)}
          >
            <Upload size={15} />
            Импорт договора
          </button>
          <button
            className="btn-primary flex items-center gap-1.5"
            onClick={() => setNewOpen(true)}
          >
            <Plus size={15} />
            Новый договор
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8"
            placeholder="Поиск по номеру, контрагенту..."
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
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            className="input pl-8 pr-8 min-w-[180px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Все статусы</option>
            {statusOptions.map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={filtered}
        onRowClick={(row) => navigate(`/contracts/${row.id}`)}
      />

      {/* Modals */}
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
      <NewContractModal isOpen={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
