import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Upload, Filter,
  Loader2, CheckCircle, File, AlertTriangle, Building2, UserPlus,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import { formatMoney, STATUS_LABELS } from '../../data/mockData';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Table from '../../components/ui/Table';
import SearchInput from '../../components/ui/SearchInput';
import { contractsApi, counterpartiesApi } from '../../services/api';

// ─── Add Counterparty From Import Modal ──────────────────────────────────────

const CP_EMPTY = { name: '', inn: '', kpp: '', address: '', delivery_address: '', contact: '', phone: '', email: '', priority: 'medium' };

function AddCpFromImportModal({ isOpen, initialData, onClose, onSaved }) {
  const [form, setForm] = useState({ ...CP_EMPTY, ...initialData });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({ ...CP_EMPTY, ...initialData });
      setErrors({});
    }
  }, [isOpen, initialData]);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Название обязательно';
    if (form.inn && !/^\d{10}(\d{2})?$/.test(form.inn)) e.inn = 'ИНН: 10 или 12 цифр';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Некорректный e-mail';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const { data } = await counterpartiesApi.create(form);
      onSaved(data);
    } catch (err) {
      setErrors({ name: err.response?.data?.error || 'Ошибка сохранения' });
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, placeholder, type = 'text') => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        value={form[key] ?? ''}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className={`input ${errors[key] ? 'border-red-400 bg-red-50' : ''}`}
      />
      {errors[key] && <p className="text-xs text-red-600 mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Добавить контрагента"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
            Добавить
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
          Поля заполнены данными из договора. Проверьте и при необходимости исправьте.
        </p>
        {field('Название организации *', 'name', 'ООО «Название»')}
        <div className="grid grid-cols-2 gap-3">
          {field('ИНН', 'inn', '7701234567')}
          {field('КПП', 'kpp', '770101001')}
        </div>
        {field('Адрес', 'address', 'г. Москва, ул. Примерная, 1')}
        {field('Адрес доставки', 'delivery_address', 'г. Москва, ул. Складская, 5')}
        {field('Контактное лицо', 'contact', 'Иванов И.И.')}
        <div className="grid grid-cols-2 gap-3">
          {field('Телефон', 'phone', '+7 495 000-00-00')}
          {field('E-mail', 'email', 'info@example.com', 'email')}
        </div>
        <div>
          <label className="label">Приоритет</label>
          <select value={form.priority} onChange={e => set('priority', e.target.value)} className="input">
            <option value="high">Высокий</option>
            <option value="medium">Средний</option>
            <option value="low">Низкий</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}

// ─── Import Modal ────────────────────────────────────────────────────────────

const EMPTY_CONTRACT_FIELDS = { number: '', date: '', validUntil: '', amount: '', subject: '', paymentDelay: '', penaltyRate: '' };

function ImportModal({ isOpen, onClose }) {
  const addContract = useAppStore(s => s.addContract);
  const loadAll = useAppStore(s => s.loadAll);

  const [file, setFile] = useState(null);
  const [stage, setStage] = useState('drop'); // drop | analyzing | review
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Analysis results
  const [tempFileInfo, setTempFileInfo] = useState(null);
  const [contractFields, setContractFields] = useState(EMPTY_CONTRACT_FIELDS);
  const [matchedCp, setMatchedCp] = useState(null);     // counterparty from DB match
  const [extractedCpData, setExtractedCpData] = useState(null); // raw CP data from AI
  const [counterpartyId, setCounterpartyId] = useState(null);

  const [showAddCp, setShowAddCp] = useState(false);

  const fileInputRef = useRef(null);

  const reset = () => {
    setFile(null);
    setStage('drop');
    setError(null);
    setSaving(false);
    setTempFileInfo(null);
    setContractFields(EMPTY_CONTRACT_FIELDS);
    setMatchedCp(null);
    setExtractedCpData(null);
    setCounterpartyId(null);
    setShowAddCp(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = useCallback(async (f) => {
    if (!f) return;
    setFile(f);
    setStage('analyzing');
    setError(null);
    try {
      const { data } = await contractsApi.analyzeFile(f);
      const ex = data.extracted || {};
      setTempFileInfo({ storedFileName: data.storedFileName, originalName: data.originalName, mimetype: data.mimetype, size: data.size });
      setContractFields({
        number: ex.number || '',
        date: ex.date || '',
        validUntil: ex.validUntil || '',
        amount: ex.amount != null ? String(ex.amount) : '',
        subject: ex.subject || '',
        paymentDelay: ex.paymentDelay != null ? String(ex.paymentDelay) : '',
        penaltyRate: ex.penaltyRate != null ? String(ex.penaltyRate) : '',
      });
      setExtractedCpData(ex.counterparty || null);
      if (data.matchedCounterparty) {
        setMatchedCp(data.matchedCounterparty);
        setCounterpartyId(data.matchedCounterparty.id);
      } else {
        setMatchedCp(null);
        setCounterpartyId(null);
      }
      setStage('review');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка анализа файла');
      setStage('drop');
    }
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleCpAdded = (cp) => {
    loadAll(); // refresh counterparties list in store
    setMatchedCp(cp);
    setCounterpartyId(cp.id);
    setShowAddCp(false);
  };

  const handleSave = async () => {
    if (!counterpartyId) return;
    setSaving(true);
    try {
      await addContract({
        number: contractFields.number || `ДГ-${Date.now()}`,
        counterpartyId,
        date: contractFields.date || new Date().toISOString().slice(0, 10),
        validUntil: contractFields.validUntil || '',
        status: 'draft',
        amount: parseFloat(contractFields.amount) || 0,
        subject: contractFields.subject || 'Импортированный договор',
        paymentDelay: parseInt(contractFields.paymentDelay, 10) || 30,
        penaltyRate: parseFloat(contractFields.penaltyRate) || 0.1,
        conditions: [],
        obligations: [],
        tempFile: tempFileInfo || undefined,
      });
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения договора');
    } finally {
      setSaving(false);
    }
  };

  const setField = (key) => (e) => setContractFields(p => ({ ...p, [key]: e.target.value }));

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Импорт договора"
        footer={
          stage === 'review' ? (
            <>
              <button className="btn-secondary" onClick={handleClose}>Отмена</button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={!counterpartyId || saving}
                title={!counterpartyId ? 'Сначала добавьте контрагента' : ''}
              >
                {saving ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
                Сохранить договор
              </button>
            </>
          ) : null
        }
      >
        {stage === 'drop' && (
          <div className="space-y-3">
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
                <AlertTriangle size={14} />
                {error}
              </div>
            )}
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
          </div>
        )}

        {stage === 'analyzing' && (
          <div className="py-10 flex flex-col items-center gap-4">
            <Loader2 size={40} className="text-blue-500 animate-spin" />
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800">ИИ анализирует документ...</p>
              {file && (
                <p className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                  <File size={12} /> {file.name}
                </p>
              )}
            </div>
          </div>
        )}

        {stage === 'review' && (
          <div className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
                <AlertTriangle size={14} /> {error}
              </div>
            )}

            {/* Counterparty section */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Контрагент</p>
              {counterpartyId && matchedCp ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <CheckCircle size={18} className="text-green-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{matchedCp.name}</p>
                    {matchedCp.inn && <p className="text-xs text-gray-500">ИНН: {matchedCp.inn}</p>}
                  </div>
                  <button
                    className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline shrink-0"
                    onClick={() => { setMatchedCp(null); setCounterpartyId(null); }}
                  >
                    Изменить
                  </button>
                </div>
              ) : (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {extractedCpData?.name
                        ? `«${extractedCpData.name}» не найден в системе`
                        : 'Контрагент не определён'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Необходимо добавить контрагента для сохранения договора</p>
                  </div>
                  <button
                    className="btn-secondary flex items-center gap-1.5 text-xs shrink-0"
                    onClick={() => setShowAddCp(true)}
                  >
                    <UserPlus size={13} />
                    Добавить
                  </button>
                </div>
              )}
            </div>

            {/* Contract fields */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Реквизиты договора</p>
              <div className="space-y-3">
                <div>
                  <label className="label">Номер договора</label>
                  <input className="input" value={contractFields.number} onChange={setField('number')} placeholder="ДГ-2026-XXX" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Дата</label>
                    <input className="input" type="date" value={contractFields.date} onChange={setField('date')} />
                  </div>
                  <div>
                    <label className="label">Срок действия</label>
                    <input className="input" type="date" value={contractFields.validUntil} onChange={setField('validUntil')} />
                  </div>
                </div>
                <div>
                  <label className="label">Предмет договора</label>
                  <input className="input" value={contractFields.subject} onChange={setField('subject')} placeholder="Поставка товаров..." />
                </div>
                <div>
                  <label className="label">Сумма (руб.)</label>
                  <input className="input" type="number" min="0" value={contractFields.amount} onChange={setField('amount')} placeholder="0" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Отсрочка платежа (дней)</label>
                    <input className="input" type="number" min="0" value={contractFields.paymentDelay} onChange={setField('paymentDelay')} placeholder="30" />
                  </div>
                  <div>
                    <label className="label">Ставка штрафа (%)</label>
                    <input className="input" type="number" min="0" step="0.01" value={contractFields.penaltyRate} onChange={setField('penaltyRate')} placeholder="0.1" />
                  </div>
                </div>
              </div>
            </div>

            {tempFileInfo && (
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                <File size={13} />
                <span className="truncate">{tempFileInfo.originalName}</span>
                <span className="shrink-0">— файл будет прикреплён к договору</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <AddCpFromImportModal
        isOpen={showAddCp}
        initialData={extractedCpData || {}}
        onClose={() => setShowAddCp(false)}
        onSaved={handleCpAdded}
      />
    </>
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
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по номеру, контрагенту..."
          className="flex-1 max-w-sm"
        />
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
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
