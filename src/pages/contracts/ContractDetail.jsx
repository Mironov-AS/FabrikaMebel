import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, FileText, AlertTriangle, CheckCircle,
  Clock, Plus, User, Building, Upload, Download, Trash2, Paperclip,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import { formatMoney } from '../../data/mockData';
import { STATUS_LABELS } from '../../constants/statuses';
import StatusBadge from '../../components/ui/StatusBadge';
import Tab from '../../components/ui/Tabs';
import Modal from '../../components/ui/Modal';
import Table from '../../components/ui/Table';
import { contractsApi } from '../../services/api';

// ─── Edit Contract Modal ──────────────────────────────────────────────────────

function EditContractModal({ isOpen, onClose, contract, onSave }) {
  const counterparties = useAppStore(s => s.counterparties);
  const [form, setForm] = useState({
    number: contract?.number ?? '',
    date: contract?.date ?? '',
    validUntil: contract?.validUntil ?? '',
    status: contract?.status ?? 'active',
    subject: contract?.subject ?? '',
    amount: contract?.amount ?? '',
    paymentDelay: contract?.paymentDelay ?? '',
    penaltyRate: contract?.penaltyRate ?? '',
    counterpartyId: contract?.counterpartyId ?? '',
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

// ─── Files Tab ────────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function FilesTab({ contractId }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const loadFiles = useCallback(async () => {
    try {
      const { data } = await contractsApi.getFiles(contractId);
      setFiles(data);
    } catch {
      setError('Не удалось загрузить список файлов');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      const { data } = await contractsApi.uploadFile(contractId, file, (e) => {
        if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      });
      setFiles(prev => [data, ...prev]);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Ошибка загрузки файла';
      setError(msg);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId, name) => {
    if (!window.confirm(`Удалить файл "${name}"?`)) return;
    try {
      await contractsApi.deleteFile(contractId, fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch {
      setError('Не удалось удалить файл');
    }
  };

  const handleDownload = async (fileId, name) => {
    try {
      const { data } = await contractsApi.downloadFile(contractId, fileId);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Не удалось скачать файл');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  if (loading) {
    return <p className="text-sm text-gray-400 py-6 text-center">Загрузка...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS}
          className="hidden"
          onChange={(e) => handleUpload(e.target.files[0])}
        />
        <Upload size={24} className="mx-auto text-gray-400 mb-2" />
        {uploading ? (
          <div className="space-y-2">
            <p className="text-sm text-blue-600 font-medium">Загрузка... {uploadProgress}%</p>
            <div className="w-full bg-gray-200 rounded-full h-1.5 max-w-xs mx-auto">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 font-medium">Перетащите файл или нажмите для выбора</p>
            <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, изображения — до 20 МБ</p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {/* Files list */}
      {files.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Paperclip size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Файлы договора не загружены</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            Файлов: <strong className="text-gray-700">{files.length}</strong>
          </p>
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between gap-3 card px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={18} className="text-blue-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{file.original_name}</p>
                  <p className="text-xs text-gray-400">
                    {formatBytes(file.size)} &nbsp;·&nbsp; {file.uploaded_by_name}
                    &nbsp;·&nbsp; {new Date(file.uploaded_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Скачать"
                  onClick={() => handleDownload(file.id, file.original_name)}
                >
                  <Download size={16} />
                </button>
                <button
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                  title="Удалить"
                  onClick={() => handleDelete(file.id, file.original_name)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Detail Page ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'info', label: 'Информация' },
  { id: 'obligations', label: 'Обязательства' },
  { id: 'orders', label: 'Спецификация / Заказы' },
  { id: 'versions', label: 'Версии' },
  { id: 'files', label: 'Файлы' },
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
        {activeTab === 'files' && <FilesTab contractId={id} />}
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
