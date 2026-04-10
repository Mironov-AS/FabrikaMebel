import { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Search, Building2,
  Phone, Mail, MapPin, User, Star, X, AlertTriangle,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import Modal from '../../components/ui/Modal';

const PRIORITY_LABELS = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

const PRIORITY_CLASSES = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const emptyForm = {
  name: '', inn: '', kpp: '', address: '', delivery_address: '', contact: '', phone: '', email: '', priority: 'medium',
};

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Название обязательно';
  if (form.inn && !/^\d{10}(\d{2})?$/.test(form.inn)) errors.inn = 'ИНН должен содержать 10 или 12 цифр';
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Некорректный e-mail';
  return errors;
}

function CounterpartyForm({ form, onChange, errors }) {
  const field = (label, key, placeholder, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => onChange(key, e.target.value)}
        placeholder={placeholder}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-200'
        }`}
      />
      {errors[key] && <p className="text-xs text-red-600 mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Приоритет</label>
        <select
          value={form.priority}
          onChange={e => onChange('priority', e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="high">Высокий</option>
          <option value="medium">Средний</option>
          <option value="low">Низкий</option>
        </select>
      </div>
    </div>
  );
}

export default function CounterpartiesPage() {
  const counterparties = useAppStore(s => s.counterparties);
  const addCounterparty = useAppStore(s => s.addCounterparty);
  const updateCounterparty = useAppStore(s => s.updateCounterparty);
  const deleteCounterparty = useAppStore(s => s.deleteCounterparty);

  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [addErrors, setAddErrors] = useState({});
  const [addLoading, setAddLoading] = useState(false);
  const [addServerError, setAddServerError] = useState('');

  // Edit modal
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editErrors, setEditErrors] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editServerError, setEditServerError] = useState('');

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteServerError, setDeleteServerError] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return counterparties.filter(cp => {
      const matchSearch = !q || cp.name.toLowerCase().includes(q)
        || (cp.inn || '').includes(q)
        || (cp.contact || '').toLowerCase().includes(q)
        || (cp.email || '').toLowerCase().includes(q);
      const matchPriority = !priorityFilter || cp.priority === priorityFilter;
      return matchSearch && matchPriority;
    });
  }, [counterparties, search, priorityFilter]);

  // ── Add handlers ──────────────────────────────────────────
  function openAdd() {
    setAddForm(emptyForm);
    setAddErrors({});
    setAddServerError('');
    setShowAdd(true);
  }

  async function handleAdd() {
    const errors = validate(addForm);
    if (Object.keys(errors).length) { setAddErrors(errors); return; }
    setAddLoading(true);
    setAddServerError('');
    try {
      await addCounterparty(addForm);
      setShowAdd(false);
    } catch (err) {
      setAddServerError(err?.response?.data?.error || 'Ошибка при создании');
    } finally {
      setAddLoading(false);
    }
  }

  // ── Edit handlers ─────────────────────────────────────────
  function openEdit(cp) {
    setEditTarget(cp);
    setEditForm({
      name: cp.name || '',
      inn: cp.inn || '',
      kpp: cp.kpp || '',
      address: cp.address || '',
      delivery_address: cp.delivery_address || '',
      contact: cp.contact || '',
      phone: cp.phone || '',
      email: cp.email || '',
      priority: cp.priority || 'medium',
    });
    setEditErrors({});
    setEditServerError('');
  }

  async function handleEdit() {
    const errors = validate(editForm);
    if (Object.keys(errors).length) { setEditErrors(errors); return; }
    setEditLoading(true);
    setEditServerError('');
    try {
      await updateCounterparty(editTarget.id, editForm);
      setEditTarget(null);
    } catch (err) {
      setEditServerError(err?.response?.data?.error || 'Ошибка при обновлении');
    } finally {
      setEditLoading(false);
    }
  }

  // ── Delete handlers ───────────────────────────────────────
  function openDelete(cp) {
    setDeleteTarget(cp);
    setDeleteServerError('');
  }

  async function handleDelete() {
    setDeleteLoading(true);
    setDeleteServerError('');
    try {
      await deleteCounterparty(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteServerError(err?.response?.data?.error || 'Ошибка при удалении');
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Контрагенты</h1>
          <p className="text-sm text-gray-500 mt-0.5">Управление организациями и партнёрами</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Добавить контрагента
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по названию, ИНН, контакту..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Все приоритеты</option>
          <option value="high">Высокий</option>
          <option value="medium">Средний</option>
          <option value="low">Низкий</option>
        </select>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-gray-500">
        <span>Всего: <strong className="text-gray-900">{counterparties.length}</strong></span>
        {filtered.length !== counterparties.length && (
          <span>Показано: <strong className="text-gray-900">{filtered.length}</strong></span>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            {search || priorityFilter ? 'Ничего не найдено по заданным фильтрам' : 'Контрагентов пока нет'}
          </p>
          {!search && !priorityFilter && (
            <button onClick={openAdd} className="mt-3 text-blue-600 text-sm hover:underline">
              Добавить первого контрагента
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Организация</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ИНН / КПП</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Контакт</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Приоритет</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(cp => (
                <tr key={cp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Building2 size={15} className="text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{cp.name}</div>
                        {cp.address && (
                          <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin size={10} />
                            {cp.address}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{cp.inn || '—'}</div>
                    {cp.kpp && <div className="text-xs text-gray-400">КПП: {cp.kpp}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {cp.contact && (
                      <div className="flex items-center gap-1 text-gray-700">
                        <User size={12} className="text-gray-400" />
                        {cp.contact}
                      </div>
                    )}
                    {cp.phone && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <Phone size={11} className="text-gray-400" />
                        {cp.phone}
                      </div>
                    )}
                    {cp.email && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <Mail size={11} className="text-gray-400" />
                        {cp.email}
                      </div>
                    )}
                    {!cp.contact && !cp.phone && !cp.email && <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${PRIORITY_CLASSES[cp.priority] || PRIORITY_CLASSES.medium}`}>
                      <Star size={10} />
                      {PRIORITY_LABELS[cp.priority] || 'Средний'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(cp)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        title="Редактировать"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => openDelete(cp)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Удалить"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Новый контрагент"
        footer={
          <>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleAdd}
              disabled={addLoading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {addLoading ? 'Сохранение...' : 'Создать'}
            </button>
          </>
        }
      >
        <CounterpartyForm
          form={addForm}
          onChange={(k, v) => { setAddForm(f => ({ ...f, [k]: v })); setAddErrors(e => ({ ...e, [k]: undefined })); }}
          errors={addErrors}
        />
        {addServerError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{addServerError}</p>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Редактировать контрагента"
        footer={
          <>
            <button
              onClick={() => setEditTarget(null)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleEdit}
              disabled={editLoading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {editLoading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </>
        }
      >
        <CounterpartyForm
          form={editForm}
          onChange={(k, v) => { setEditForm(f => ({ ...f, [k]: v })); setEditErrors(e => ({ ...e, [k]: undefined })); }}
          errors={editErrors}
        />
        {editServerError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{editServerError}</p>
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Удалить контрагента"
        footer={
          <>
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {deleteLoading ? 'Удаление...' : 'Удалить'}
            </button>
          </>
        }
      >
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-700">
              Вы уверены, что хотите удалить контрагента{' '}
              <strong className="text-gray-900">{deleteTarget?.name}</strong>?
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Это действие необратимо. Контрагент, связанный с договорами, не может быть удалён.
            </p>
            {deleteServerError && (
              <p className="mt-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{deleteServerError}</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
