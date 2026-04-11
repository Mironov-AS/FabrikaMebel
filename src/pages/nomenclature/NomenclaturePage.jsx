import { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Search, X, AlertTriangle,
  Package, Ban, RotateCcw, Tag, ChevronDown,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import Modal from '../../components/ui/Modal';
import { PRODUCT_CATEGORIES, NOMENCLATURE_UNITS } from '../../data/mockData';

const STATUS_CONFIG = {
  active:       { label: 'Активна',               cls: 'bg-green-100 text-green-700' },
  discontinued: { label: 'Снята с производства',  cls: 'bg-red-100 text-red-700' },
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

// ─── Form component ────────────────────────────────────────────────────────────

function NomenclatureForm({ form, onChange, errors }) {
  const field = (label, key, placeholder, type = 'text', required = false) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={e => onChange(key, e.target.value)}
        placeholder={placeholder}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-200'
        }`}
      />
      {errors[key] && <p className="text-xs text-red-600 mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {field('Артикул', 'article', 'KO-001', 'text', true)}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ед. измерения
          </label>
          <select
            value={form.unit}
            onChange={e => onChange('unit', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {NOMENCLATURE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {field('Наименование', 'name', 'Кресло офисное «Комфорт»', 'text', true)}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
        <select
          value={form.category}
          onChange={e => onChange('category', e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {field('Цена за единицу (₽)', 'price', '8500', 'number', true)}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
        <textarea
          value={form.description}
          onChange={e => onChange('description', e.target.value)}
          placeholder="Краткое описание товара..."
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function NomenclaturePage() {
  const nomenclature           = useAppStore(s => s.nomenclature);
  const addNomenclatureItem    = useAppStore(s => s.addNomenclatureItem);
  const updateNomenclatureItem = useAppStore(s => s.updateNomenclatureItem);
  const deleteNomenclatureItem = useAppStore(s => s.deleteNomenclatureItem);
  const discontinueNomenclatureItem = useAppStore(s => s.discontinueNomenclatureItem);
  const restoreNomenclatureItem     = useAppStore(s => s.restoreNomenclatureItem);

  const [search,          setSearch]          = useState('');
  const [categoryFilter,  setCategoryFilter]  = useState('');
  const [statusFilter,    setStatusFilter]    = useState('');

  // Add modal
  const [showAdd,      setShowAdd]      = useState(false);
  const [addForm,      setAddForm]      = useState(EMPTY_FORM);
  const [addErrors,    setAddErrors]    = useState({});

  // Edit modal
  const [editTarget,   setEditTarget]   = useState(null);
  const [editForm,     setEditForm]     = useState(EMPTY_FORM);
  const [editErrors,   setEditErrors]   = useState({});

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Discontinue confirm modal
  const [discontinueTarget, setDiscontinueTarget] = useState(null);

  // ── Filtering ─────────────────────────────────────────────
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

  // ── Add handlers ──────────────────────────────────────────
  function openAdd() {
    setAddForm(EMPTY_FORM);
    setAddErrors({});
    setShowAdd(true);
  }

  function handleAdd() {
    const errors = validate(addForm);
    if (Object.keys(errors).length) { setAddErrors(errors); return; }
    addNomenclatureItem({ ...addForm, price: Number(addForm.price) });
    setShowAdd(false);
  }

  // ── Edit handlers ─────────────────────────────────────────
  function openEdit(item) {
    setEditTarget(item);
    setEditForm({
      article:     item.article     || '',
      name:        item.name        || '',
      category:    item.category    || PRODUCT_CATEGORIES[0],
      unit:        item.unit        || 'шт',
      price:       String(item.price || ''),
      description: item.description || '',
    });
    setEditErrors({});
  }

  function handleEdit() {
    const errors = validate(editForm);
    if (Object.keys(errors).length) { setEditErrors(errors); return; }
    updateNomenclatureItem(editTarget.id, { ...editForm, price: Number(editForm.price) });
    setEditTarget(null);
  }

  // ── Delete handlers ───────────────────────────────────────
  function handleDelete() {
    deleteNomenclatureItem(deleteTarget.id);
    setDeleteTarget(null);
  }

  // ── Discontinue/restore handlers ──────────────────────────
  function handleDiscontinue() {
    discontinueNomenclatureItem(discontinueTarget.id);
    setDiscontinueTarget(null);
  }

  function handleRestore(item) {
    restoreNomenclatureItem(item.id);
  }

  const formChange = (setter, errSetter) => (key, val) => {
    setter(f => ({ ...f, [key]: val }));
    errSetter(e => ({ ...e, [key]: undefined }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Номенклатура</h1>
          <p className="text-sm text-gray-500 mt-0.5">Управление справочником производимых товаров</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Добавить позицию
        </button>
      </div>

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
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по наименованию, артикулу..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="relative">
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white appearance-none"
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
            className="border border-gray-200 rounded-lg px-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white appearance-none"
          >
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="discontinued">Снятые с производства</option>
          </select>
        </div>
      </div>

      {/* Count */}
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>Показано: <strong className="text-gray-900">{filtered.length}</strong> из {nomenclature.length}</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            {search || categoryFilter || statusFilter ? 'Ничего не найдено' : 'Номенклатура пуста'}
          </p>
          {!search && !categoryFilter && !statusFilter && (
            <button onClick={openAdd} className="mt-3 text-indigo-600 text-sm hover:underline">
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
                <th className="px-4 py-3 w-28" />
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                          title="Редактировать"
                        >
                          <Pencil size={14} />
                        </button>
                        {isDiscontinued ? (
                          <button
                            onClick={() => handleRestore(item)}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-green-50 hover:text-green-600 transition-colors"
                            title="Восстановить в производство"
                          >
                            <RotateCcw size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => setDiscontinueTarget(item)}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                            title="Снять с производства"
                          >
                            <Ban size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Новая позиция номенклатуры"
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
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              Создать
            </button>
          </>
        }
      >
        <NomenclatureForm
          form={addForm}
          onChange={formChange(setAddForm, setAddErrors)}
          errors={addErrors}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Редактировать позицию"
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
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              Сохранить
            </button>
          </>
        }
      >
        <NomenclatureForm
          form={editForm}
          onChange={formChange(setEditForm, setEditErrors)}
          errors={editErrors}
        />
      </Modal>

      {/* Discontinue Confirm Modal */}
      <Modal
        isOpen={!!discontinueTarget}
        onClose={() => setDiscontinueTarget(null)}
        title="Снять с производства"
        footer={
          <>
            <button
              onClick={() => setDiscontinueTarget(null)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleDiscontinue}
              className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
            >
              Снять с производства
            </button>
          </>
        }
      >
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <Ban size={18} className="text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-700">
              Перевести позицию{' '}
              <strong className="text-gray-900">«{discontinueTarget?.name}»</strong>{' '}
              в статус «Снята с производства»?
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Снятая позиция не будет доступна для выбора в новых заказах.
              Восстановить можно в любой момент.
            </p>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Удалить позицию"
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
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Удалить
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
              Удалить позицию{' '}
              <strong className="text-gray-900">«{deleteTarget?.name}»</strong>?
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Это действие необратимо. Рекомендуем использовать «Снять с производства» вместо удаления.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
