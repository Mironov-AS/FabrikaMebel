import { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Building2,
  Phone, Mail, MapPin, User, Star, AlertTriangle,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import Modal from '../../components/ui/Modal';
import SearchInput from '../../components/ui/SearchInput';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useAddModal, useEditModal, useDeleteModal } from '../../hooks/useModalState';

const PRIORITY_LABELS = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
const PRIORITY_CLASSES = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const EMPTY_FORM = {
  name: '', inn: '', kpp: '', address: '', delivery_address: '',
  contact: '', phone: '', email: '', priority: 'medium',
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
      <label className="label">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => onChange(key, e.target.value)}
        placeholder={placeholder}
        className={`input ${errors[key] ? 'border-red-400 bg-red-50' : ''}`}
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
        <label className="label">Приоритет</label>
        <select value={form.priority} onChange={e => onChange('priority', e.target.value)} className="input">
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

  const addModal = useAddModal(EMPTY_FORM);
  const editModal = useEditModal(EMPTY_FORM);
  const deleteModal = useDeleteModal();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return counterparties.filter(cp => {
      const matchSearch = !q
        || cp.name.toLowerCase().includes(q)
        || (cp.inn || '').includes(q)
        || (cp.contact || '').toLowerCase().includes(q)
        || (cp.email || '').toLowerCase().includes(q);
      const matchPriority = !priorityFilter || cp.priority === priorityFilter;
      return matchSearch && matchPriority;
    });
  }, [counterparties, search, priorityFilter]);

  async function handleAdd() {
    const errors = validate(addModal.form);
    if (Object.keys(errors).length) { addModal.setErrors(errors); return; }
    addModal.setLoading(true);
    addModal.setServerError('');
    try {
      await addCounterparty(addModal.form);
      addModal.close();
    } catch (err) {
      addModal.setServerError(err?.response?.data?.error || 'Ошибка при создании');
    } finally {
      addModal.setLoading(false);
    }
  }

  async function handleEdit() {
    const errors = validate(editModal.form);
    if (Object.keys(errors).length) { editModal.setErrors(errors); return; }
    editModal.setLoading(true);
    editModal.setServerError('');
    try {
      await updateCounterparty(editModal.target.id, editModal.form);
      editModal.close();
    } catch (err) {
      editModal.setServerError(err?.response?.data?.error || 'Ошибка при обновлении');
    } finally {
      editModal.setLoading(false);
    }
  }

  async function handleDelete() {
    deleteModal.setLoading(true);
    deleteModal.setServerError('');
    try {
      await deleteCounterparty(deleteModal.target.id);
      deleteModal.close();
    } catch (err) {
      deleteModal.setServerError(err?.response?.data?.error || 'Ошибка при удалении');
    } finally {
      deleteModal.setLoading(false);
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
        <button onClick={addModal.open} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Добавить контрагента
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по названию, ИНН, контакту..."
          className="flex-1 min-w-48"
        />
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="input w-auto min-w-40"
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
            <button onClick={addModal.open} className="mt-3 text-blue-600 text-sm hover:underline">
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
                        <User size={12} className="text-gray-400" /> {cp.contact}
                      </div>
                    )}
                    {cp.phone && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <Phone size={11} className="text-gray-400" /> {cp.phone}
                      </div>
                    )}
                    {cp.email && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <Mail size={11} className="text-gray-400" /> {cp.email}
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
                        onClick={() => editModal.open(cp)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        title="Редактировать"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => deleteModal.open(cp)}
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
        isOpen={addModal.isOpen}
        onClose={addModal.close}
        title="Новый контрагент"
        footer={
          <>
            <button className="btn-secondary" onClick={addModal.close}>Отмена</button>
            <button className="btn-primary" onClick={handleAdd} disabled={addModal.loading}>
              {addModal.loading ? 'Сохранение...' : 'Создать'}
            </button>
          </>
        }
      >
        <CounterpartyForm form={addModal.form} onChange={addModal.setField} errors={addModal.errors} />
        {addModal.serverError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{addModal.serverError}</p>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={editModal.close}
        title="Редактировать контрагента"
        footer={
          <>
            <button className="btn-secondary" onClick={editModal.close}>Отмена</button>
            <button className="btn-primary" onClick={handleEdit} disabled={editModal.loading}>
              {editModal.loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </>
        }
      >
        <CounterpartyForm form={editModal.form} onChange={editModal.setField} errors={editModal.errors} />
        {editModal.serverError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{editModal.serverError}</p>
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        onConfirm={handleDelete}
        title="Удалить контрагента"
        message={<>Вы уверены, что хотите удалить контрагента{' '}<strong className="text-gray-900">{deleteModal.target?.name}</strong>?</>}
        subMessage="Это действие необратимо. Контрагент, связанный с договорами, не может быть удалён."
        confirmLabel="Удалить"
        loading={deleteModal.loading}
        serverError={deleteModal.serverError}
        icon={AlertTriangle}
      />
    </div>
  );
}
