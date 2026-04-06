import { useState } from 'react';
import {
  Users, Settings, Shield, Plug, Plus, Pencil, Trash2, Lock, Ban, CheckCircle,
  Eye, EyeOff, RefreshCw, ToggleLeft, ToggleRight, Download, Filter,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import { ROLES, ROLE_LABELS } from '../../data/mockData';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';

// ── Integrations mock data ──────────────────────────────────────────────────
const INTEGRATIONS_INITIAL = [
  {
    id: 1,
    name: '1С Бухгалтерия',
    description: 'Синхронизация финансовых данных и контрагентов',
    active: true,
    lastSync: '2026-04-06 08:00',
    color: 'bg-red-100 text-red-700',
    abbr: '1С',
  },
  {
    id: 2,
    name: 'SAP',
    description: 'Интеграция с корпоративной ERP-системой',
    active: false,
    lastSync: null,
    color: 'bg-blue-100 text-blue-700',
    abbr: 'SAP',
  },
  {
    id: 3,
    name: 'CRM система',
    description: 'Двусторонняя синхронизация сделок и контактов',
    active: true,
    lastSync: '2026-04-05 22:30',
    color: 'bg-green-100 text-green-700',
    abbr: 'CRM',
  },
  {
    id: 4,
    name: 'REST API',
    description: 'Внешнее API для сторонних интеграций',
    active: true,
    lastSync: '2026-04-06 09:12',
    color: 'bg-purple-100 text-purple-700',
    abbr: 'API',
  },
];

const DOCUMENT_TEMPLATES = [
  { id: 1, name: 'Шаблон договора поставки', updated: '2026-03-01' },
  { id: 2, name: 'Дополнительное соглашение', updated: '2026-02-15' },
  { id: 3, name: 'Акт сдачи-приёмки', updated: '2026-01-20' },
  { id: 4, name: 'Счёт-фактура', updated: '2026-03-10' },
  { id: 5, name: 'Товарная накладная', updated: '2026-02-28' },
];

const emptyUserForm = { name: '', email: '', role: ROLES.SALES_MANAGER, password: '' };

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users');

  // Users tab
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editRoleModal, setEditRoleModal] = useState(null); // user object
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [editRoleValue, setEditRoleValue] = useState('');

  // System settings
  const [settings, setSettings] = useState({
    shifts: 2,
    hoursPerShift: 8,
    downtimes: 'Плановое ТО каждую субботу с 08:00 до 12:00',
    prioritizationRule: 'deadline',
    defaultPenaltyRate: 0.1,
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Audit log filters
  const [auditFilters, setAuditFilters] = useState({ user: '', entity: '', dateFrom: '', dateTo: '' });

  // Integrations
  const [integrations, setIntegrations] = useState(INTEGRATIONS_INITIAL);

  // API keys
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKey] = useState('sk-live-aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890');

  const { users, auditLog, addUser, updateUser, deleteUser } = useAppStore();

  // ── User handlers ──────────────────────────────────────────
  function handleAddUser() {
    if (!userForm.name || !userForm.email) return;
    addUser({ name: userForm.name, email: userForm.email, role: userForm.role, password: userForm.password || 'password123' });
    setUserForm(emptyUserForm);
    setShowAddUserModal(false);
  }

  function handleEditRoleSubmit() {
    if (!editRoleModal) return;
    updateUser(editRoleModal.id, { role: editRoleValue });
    setEditRoleModal(null);
  }

  function handleToggleBlock(user) {
    updateUser(user.id, { active: !user.active });
  }

  // ── Settings handler ──────────────────────────────────────
  function handleSaveSettings() {
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  }

  // ── Integrations ──────────────────────────────────────────
  function toggleIntegration(id) {
    setIntegrations((prev) =>
      prev.map((intg) => (intg.id === id ? { ...intg, active: !intg.active } : intg)),
    );
  }

  // ── Audit filtering ───────────────────────────────────────
  const filteredAudit = auditLog.filter((entry) => {
    if (auditFilters.user && !entry.user.toLowerCase().includes(auditFilters.user.toLowerCase())) return false;
    if (auditFilters.entity && entry.entity !== auditFilters.entity) return false;
    return true;
  });

  const auditEntities = [...new Set(auditLog.map((e) => e.entity))];
  const auditUsers = [...new Set(auditLog.map((e) => e.user))];

  // ── Tabs config ──────────────────────────────────────────
  const TABS = [
    { key: 'users', label: 'Пользователи', icon: Users },
    { key: 'settings', label: 'Настройки системы', icon: Settings },
    { key: 'audit', label: 'Безопасность и аудит', icon: Shield },
    { key: 'integrations', label: 'Интеграции', icon: Plug },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Панель администратора</h1>
        <p className="text-sm text-gray-500 mt-0.5">Управление пользователями, настройки и аудит</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Users ── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => { setUserForm(emptyUserForm); setShowAddUserModal(true); }}
            >
              <Plus size={16} />
              Добавить пользователя
            </button>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Имя', 'Email', 'Роль', 'Статус', 'Последний вход', 'Действия'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{user.name}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{user.email}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{ROLE_LABELS[user.role] ?? user.role}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={user.active ? 'active' : 'suspended'} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{user.lastLogin ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {/* Edit role */}
                          <button
                            title="Изменить роль"
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            onClick={() => { setEditRoleModal(user); setEditRoleValue(user.role); }}
                          >
                            <Pencil size={14} />
                          </button>
                          {/* Block/unblock */}
                          <button
                            title={user.active ? 'Заблокировать' : 'Разблокировать'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              user.active
                                ? 'text-gray-400 hover:bg-red-50 hover:text-red-600'
                                : 'text-green-500 hover:bg-green-50 hover:text-green-700'
                            }`}
                            onClick={() => handleToggleBlock(user)}
                          >
                            {user.active ? <Ban size={14} /> : <CheckCircle size={14} />}
                          </button>
                          {/* Reset password */}
                          <button
                            title="Сбросить пароль"
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-yellow-50 hover:text-yellow-600 transition-colors"
                          >
                            <Lock size={14} />
                          </button>
                          {/* Delete */}
                          <button
                            title="Удалить"
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            onClick={() => deleteUser(user.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: System settings ── */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-2xl">
          {/* Production settings */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Производственные параметры</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Количество смен</label>
                  <input
                    type="number"
                    className="form-input"
                    value={settings.shifts}
                    onChange={(e) => setSettings((s) => ({ ...s, shifts: Number(e.target.value) }))}
                    min={1}
                    max={3}
                  />
                </div>
                <div>
                  <label className="form-label">Рабочих часов в смену</label>
                  <input
                    type="number"
                    className="form-input"
                    value={settings.hoursPerShift}
                    onChange={(e) => setSettings((s) => ({ ...s, hoursPerShift: Number(e.target.value) }))}
                    min={1}
                    max={12}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Плановые простои</label>
                <textarea
                  className="form-input resize-none"
                  rows={3}
                  value={settings.downtimes}
                  onChange={(e) => setSettings((s) => ({ ...s, downtimes: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label">Правила приоритизации</label>
                <select
                  className="form-input"
                  value={settings.prioritizationRule}
                  onChange={(e) => setSettings((s) => ({ ...s, prioritizationRule: e.target.value }))}
                >
                  <option value="deadline">По сроку дедлайна</option>
                  <option value="client_priority">По приоритету клиента</option>
                  <option value="combined">Комбинированный</option>
                </select>
              </div>

              <div>
                <label className="form-label">Ставка штрафа по умолчанию (%)</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings.defaultPenaltyRate}
                  onChange={(e) => setSettings((s) => ({ ...s, defaultPenaltyRate: Number(e.target.value) }))}
                  step={0.01}
                  min={0}
                  max={10}
                />
              </div>

              <div className="flex items-center gap-3">
                <button className="btn-primary" onClick={handleSaveSettings}>
                  Сохранить настройки
                </button>
                {settingsSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                    <CheckCircle size={15} />
                    Настройки сохранены
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Document templates */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Шаблоны документов</h3>
            <div className="space-y-2">
              {DOCUMENT_TEMPLATES.map((tpl) => (
                <div key={tpl.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tpl.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Обновлён: {tpl.updated}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                      <Pencil size={12} />
                      Редактировать
                    </button>
                    <button className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                      <Download size={12} />
                      Скачать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Audit log ── */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="card">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="form-label">С даты</label>
                <input
                  type="date"
                  className="form-input w-40"
                  value={auditFilters.dateFrom}
                  onChange={(e) => setAuditFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">По дату</label>
                <input
                  type="date"
                  className="form-input w-40"
                  value={auditFilters.dateTo}
                  onChange={(e) => setAuditFilters((f) => ({ ...f, dateTo: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Пользователь</label>
                <select
                  className="form-input w-48"
                  value={auditFilters.user}
                  onChange={(e) => setAuditFilters((f) => ({ ...f, user: e.target.value }))}
                >
                  <option value="">Все пользователи</option>
                  {auditUsers.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Тип объекта</label>
                <select
                  className="form-input w-40"
                  value={auditFilters.entity}
                  onChange={(e) => setAuditFilters((f) => ({ ...f, entity: e.target.value }))}
                >
                  <option value="">Все типы</option>
                  {auditEntities.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <button
                className="btn-secondary flex items-center gap-2 py-2"
                onClick={() => setAuditFilters({ user: '', entity: '', dateFrom: '', dateTo: '' })}
              >
                <Filter size={14} />
                Сбросить
              </button>
              <button className="btn-secondary flex items-center gap-2 py-2 ml-auto">
                <Download size={14} />
                Экспорт
              </button>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Пользователь', 'Действие', 'Объект', 'Дата', 'IP-адрес'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAudit.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-400">Нет записей</td>
                    </tr>
                  ) : (
                    filteredAudit.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{entry.user}</td>
                        <td className="px-4 py-3 text-gray-700 max-w-[280px] truncate" title={entry.action}>{entry.action}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="badge-gray">{entry.entity}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{entry.date}</td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap font-mono text-xs">{entry.ip}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: Integrations ── */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          {/* Integration cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations.map((intg) => (
              <div key={intg.id} className="card">
                <div className="flex items-start gap-4">
                  {/* Logo placeholder */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${intg.color}`}>
                    {intg.abbr}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-gray-900">{intg.name}</h3>
                      {/* Toggle */}
                      <button
                        onClick={() => toggleIntegration(intg.id)}
                        className={`flex-shrink-0 transition-colors ${intg.active ? 'text-green-500' : 'text-gray-300'}`}
                        title={intg.active ? 'Отключить' : 'Включить'}
                      >
                        {intg.active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{intg.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs font-medium ${intg.active ? 'text-green-600' : 'text-gray-400'}`}>
                        {intg.active ? 'Активна' : 'Отключена'}
                      </span>
                      {intg.lastSync && (
                        <span className="text-xs text-gray-400">· Синхр.: {intg.lastSync}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                    <Settings size={12} />
                    Настроить
                  </button>
                  <button className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                    <RefreshCw size={12} />
                    Проверить подключение
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* API keys */}
          <div className="card max-w-xl">
            <h3 className="font-semibold text-gray-900 mb-4">API-ключи</h3>
            <div className="space-y-3">
              <div>
                <label className="form-label">Основной API-ключ</label>
                <div className="flex items-center gap-2">
                  <input
                    type={apiKeyVisible ? 'text' : 'password'}
                    className="form-input font-mono text-sm flex-1"
                    value={apiKey}
                    readOnly
                  />
                  <button
                    className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-500"
                    onClick={() => setApiKeyVisible((v) => !v)}
                    title={apiKeyVisible ? 'Скрыть' : 'Показать'}
                  >
                    {apiKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-500"
                    title="Обновить ключ"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Shield size={12} />
                Храните API-ключ в безопасном месте. Не передавайте третьим лицам.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add user */}
      <Modal
        isOpen={showAddUserModal}
        onClose={() => { setShowAddUserModal(false); setUserForm(emptyUserForm); }}
        title="Добавить пользователя"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowAddUserModal(false)}>Отмена</button>
            <button className="btn-primary" onClick={handleAddUser}>Создать</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Имя</label>
            <input
              type="text"
              className="form-input"
              placeholder="Иванов И.И."
              value={userForm.name}
              onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="user@company.ru"
              value={userForm.email}
              onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Роль</label>
            <select
              className="form-input"
              value={userForm.role}
              onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
            >
              {Object.entries(ROLES).map(([, value]) => (
                <option key={value} value={value}>{ROLE_LABELS[value]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Пароль</label>
            <input
              type="password"
              className="form-input"
              placeholder="Минимум 8 символов"
              value={userForm.password}
              onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* Modal: Edit role */}
      <Modal
        isOpen={!!editRoleModal}
        onClose={() => setEditRoleModal(null)}
        title={`Изменить роль — ${editRoleModal?.name ?? ''}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditRoleModal(null)}>Отмена</button>
            <button className="btn-primary" onClick={handleEditRoleSubmit}>Сохранить</button>
          </>
        }
      >
        <div>
          <label className="form-label">Роль</label>
          <select
            className="form-input"
            value={editRoleValue}
            onChange={(e) => setEditRoleValue(e.target.value)}
          >
            {Object.entries(ROLES).map(([, value]) => (
              <option key={value} value={value}>{ROLE_LABELS[value]}</option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}
