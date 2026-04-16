import { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, AlertTriangle,
  Package, Ban, RotateCcw, Tag, ChevronDown,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import Modal from '../../components/ui/Modal';
import SearchInput from '../../components/ui/SearchInput';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useAddModal, useEditModal, useDeleteModal } from '../../hooks/useModalState';
import { PRODUCT_CATEGORIES, NOMENCLATURE_UNITS } from '../../data/mockData';

const STATUS_CONFIG = {
  active:       { label: 'Активна',              cls: 'bg-green-100 text-green-700' },
  discontinued: { label: 'Снята с производства', cls: 'bg-red-100 text-red-700' },
};

const EMPTY_FORM = {
  article: '',
  name: '',
  category: PRODUCT_CATEGORIES[0],
  unit: 'шт',
  price: '',
  description: '',
};

function validate(form) {
  const errors = {};
  if (!form.name.trim())    errors.name    = 'Наименование обязательно';
  if (!form.article.trim()) errors.article = 'Артикул обязателен';
  if (!form.price || isNaN(Number(form.price)) || Number(form.price) < 0)
    errors.price = 'Укажите корректную цену';
  return errors;
}

function NomenclatureForm({ form, onChange, errors }) {
  const field = (label, key, placeholder, type = 'text', required = false) => (
    <div>
      <label className="label">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
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
      <div className="grid grid-cols-2 gap-3">
        {field('Артикул', 'article', 'KO-001', 'text', true)}
        <div>
          <label className="label">Ед. измерения</label>
          <select value={form.unit} onChange={e => onChange('unit', e.target.value)} className="input">
            {NOMENCLATURE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
      {field('Наименование', 'name', 'Кресло офисное «Комфорт»', 'text', true)}
      <div>
        <label className="label">Категория</label>
        <select value={form.category} onChange={e => onChange('category', e.target.value)} className="input">
          {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {field('Цена за единицу (₽)', 'price', '8500', 'number', true)}
      <div>
        <label className="label">Описание</label>
        <textarea
          value={form.description}
          onChange={e => onChange('description', e.target.value)}
          placeholder="Краткое описание товара..."
          rows={3}
          className="input resize-none"
        />
      </div>
    </div>
  );
}

export default function NomenclaturePage() {
  const nomenclature                = useAppStore(s => s.nomenclature);
  const currentService              = useAppStore(s => s.currentService);
  const addNomenclatureItem         = useAppStore(s => s.addNomenclatureItem);
  const updateNomenclatureItem      = useAppStore(s => s.updateNomenclatureItem);
  const deleteNomenclatureItem      = useAppStore(s => s.deleteNomenclatureItem);
  const discontinueNomenclatureItem = useAppStore(s => s.discontinueNomenclatureItem);
  const restoreNomenclatureItem     = useAppStore(s => s.restoreNomenclatureItem);

  const canEdit = currentService === 'nomenclature';

  const [search, setSearch]                 = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter]     = useState('');

  const addModal         = useAddModal(EMPTY_FORM);
  const editModal        = useEditModal(EMPTY_FORM);
  const deleteModal      = useDeleteModal();
  const discontinueModal = useDeleteModal(); // reuse for discontinue confirm

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return nomenclature.filter(n => {
      const matchSearch = !q
        || n.name.toLowerCase().includes(q)
        || n.article.toLowerCase().includes(q)
        || (n.description || '').toLowerCase().includes(q);
      const matchCat    = !categoryFilter || n.category === categoryFilter;
      const matchStatus = !statusFilter   || n.status   === statusFilter;
      return matchSearch && matchCat && matchStatus;
    });
  }, [nomenclature, search, categoryFilter, statusFilter]);

  const stats = useMemo(() => ({
    total:        nomenclature.length,
    active:       nomenclature.filter(n => n.status === 'active').length,
    discontinued: nomenclature.filter(n => n.status === 'discontinued').length,
  }), [nomenclature]);

  function handleAdd() {
    const errors = validate(addModal.form);
    if (Object.keys(errors).length) { addModal.setErrors(errors); return; }
    addNomenclatureItem({ ...addModal.form, price: Number(addModal.form.price) });
    addModal.close();
  }

  function handleEdit() {
    const errors = validate(editModal.form);
    if (Object.keys(errors).length) { editModal.setErrors(errors); return; }
    updateNomenclatureItem(editModal.target.id, { ...editModal.form, price: Number(editModal.form.price) });
    editModal.close();
  }

  function handleDelete() {
    deleteNomenclatureItem(deleteModal.target.id);
    deleteModal.close();
  }

  function handleDiscontinue() {
    discontinueNomenclatureItem(discontinueModal.target.id);
    discontinueModal.close();
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Номенклатура</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {canEdit ? 'Управление справочником производимых товаров' : 'Просмотр справочника производимых товаров'}
          </p>
        </div>
        {canEdit && (
          <button onClick={addModal.open} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Добавить позицию
          </button>
        )}
      </div>

      {/* Read-only notice */}
      {!canEdit && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <AlertTriangle size={15} className="shrink-0" />
          Создание и редактирование номенклатуры доступно только в сервисе <strong className="ml-1">«Номенклатура»</strong>.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Package size={18} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Всего позиций</p>
            <p className="text-lg font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
            <Tag size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Активных</p>
            <p className="text-lg font-bold text-green-700">{stats.active}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
            <Ban size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Снято с производства</p>
            <p className="text-lg font-bold text-red-600">{stats.discontinued}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по наименованию, артикулу..."
          className="flex-1 min-w-48"
        />
        <div className="relative">
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="input w-auto pr-8 appearance-none"
          >
            <option value="">Все категории</option>
            {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="relative">
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input w-auto pr-8 appearance-none"
          >
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="discontinued">Снятые с производства</option>
          </select>
        </div>
      </div>

      {/* Count */}
      <div className="text-sm text-gray-500">
        Показано: <strong className="text-gray-900">{filtered.length}</strong> из {nomenclature.length}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            {search || categoryFilter || statusFilter ? 'Ничего не найдено' : 'Номенклатура пуста'}
          </p>
          {!search && !categoryFilter && !statusFilter && canEdit && (
            <button onClick={addModal.open} className="mt-3 text-indigo-600 text-sm hover:underline">
              Добавить первую позицию
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Артикул</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Наименование</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">Категория</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-20">Ед.</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Цена</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-44">Статус</th>
                {canEdit && <th className="px-4 py-3 w-28" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(item => {
                const sc = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.active;
                const isDiscontinued = item.status === 'discontinued';
                return (
                  <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${isDiscontinued ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.article}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{item.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.category}</td>
                    <td className="px-4 py-3 text-gray-600">{item.unit}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {new Intl.NumberFormat('ru-RU').format(item.price)} ₽
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${sc.cls}`}>
                        {isDiscontinued ? <Ban size={10} /> : <Tag size={10} />}
                        {sc.label}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => editModal.open(item, it => ({
                              article:     it.article     || '',
                              name:        it.name        || '',
                              category:    it.category    || PRODUCT_CATEGORIES[0],
                              unit:        it.unit        || 'шт',
                              price:       String(it.price || ''),
                              description: it.description || '',
                            }))}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            title="Редактировать"
                          >
                            <Pencil size={14} />
                          </button>
                          {isDiscontinued ? (
                            <button
                              onClick={() => restoreNomenclatureItem(item.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-green-50 hover:text-green-600 transition-colors"
                              title="Восстановить в производство"
                            >
                              <RotateCcw size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={() => discontinueModal.open(item)}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                              title="Снять с производства"
                            >
                              <Ban size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => deleteModal.open(item)}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Удалить"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={addModal.isOpen}
        onClose={addModal.close}
        title="Новая позиция номенклатуры"
        footer={
          <>
            <button className="btn-secondary" onClick={addModal.close}>Отмена</button>
            <button className="btn-primary" onClick={handleAdd}>Создать</button>
          </>
        }
      >
        <NomenclatureForm form={addModal.form} onChange={addModal.setField} errors={addModal.errors} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={editModal.close}
        title="Редактировать позицию"
        footer={
          <>
            <button className="btn-secondary" onClick={editModal.close}>Отмена</button>
            <button className="btn-primary" onClick={handleEdit}>Сохранить</button>
          </>
        }
      >
        <NomenclatureForm form={editModal.form} onChange={editModal.setField} errors={editModal.errors} />
      </Modal>

      {/* Discontinue Confirm */}
      <ConfirmModal
        isOpen={discontinueModal.isOpen}
        onClose={discontinueModal.close}
        onConfirm={handleDiscontinue}
        title="Снять с производства"
        message={<>Перевести позицию{' '}<strong className="text-gray-900">«{discontinueModal.target?.name}»</strong>{' '}в статус «Снята с производства»?</>}
        subMessage="Снятая позиция не будет доступна для выбора в новых заказах. Восстановить можно в любой момент."
        confirmLabel="Снять с производства"
        confirmClassName="bg-orange-600 hover:bg-orange-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
        icon={Ban}
        iconBgClass="bg-orange-100"
        iconColorClass="text-orange-600"
      />

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        onConfirm={handleDelete}
        title="Удалить позицию"
        message={<>Удалить позицию{' '}<strong className="text-gray-900">«{deleteModal.target?.name}»</strong>?</>}
        subMessage="Это действие необратимо. Рекомендуем использовать «Снять с производства» вместо удаления."
        confirmLabel="Удалить"
        icon={AlertTriangle}
      />
    </div>
  );
}
