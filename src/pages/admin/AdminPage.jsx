import { useState } from 'react';
import {
  Users, Settings, Shield, Plug, Plus, Pencil, Trash2, Lock, Ban, CheckCircle,
  Eye, EyeOff, RefreshCw, ToggleLeft, ToggleRight, Download, Filter, X,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import { ROLES, ROLE_LABELS } from '../../data/mockData';
import { downloadCSV } from '../../utils/export';
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
    configFields: [
      { key: 'host', label: 'Хост сервера', value: 'http://1c.furniture.local:8080' },
      { key: 'db', label: 'База данных', value: 'furniture_accounting' },
      { key: 'user', label: 'Пользователь', value: 'integration_user' },
    ],
  },
  {
    id: 2,
    name: 'SAP',
    description: 'Интеграция с корпоративной ERP-системой',
    active: false,
    lastSync: null,
    color: 'bg-blue-100 text-blue-700',
    abbr: 'SAP',
    configFields: [
      { key: 'host', label: 'SAP Application Server', value: '' },
      { key: 'client', label: 'Client', value: '' },
      { key: 'sysnr', label: 'System Number', value: '' },
    ],
  },
  {
    id: 3,
    name: 'CRM система',
    description: 'Двусторонняя синхронизация сделок и контактов',
    active: true,
    lastSync: '2026-04-05 22:30',
    color: 'bg-green-100 text-green-700',
    abbr: 'CRM',
    configFields: [
      { key: 'url', label: 'CRM URL', value: 'https://crm.furniture.ru' },
      { key: 'apiKey', label: 'API Key', value: 'crm_key_***' },
    ],
  },
  {
    id: 4,
    name: 'REST API',
    description: 'Внешнее API для сторонних интеграций',
    active: true,
    lastSync: '2026-04-06 09:12',
    color: 'bg-purple-100 text-purple-700',
    abbr: 'API',
    configFields: [
      { key: 'webhookUrl', label: 'Webhook URL', value: 'https://hooks.furniture.ru/events' },
      { key: 'secret', label: 'Secret', value: 'wh_secret_***' },
    ],
  },
];

const DOCUMENT_TEMPLATES = [
  { id: 1, name: 'Шаблон договора поставки', updated: '2026-03-01', ext: 'docx' },
  { id: 2, name: 'Дополнительное соглашение', updated: '2026-02-15', ext: 'docx' },
  { id: 3, name: 'Акт сдачи-приёмки', updated: '2026-01-20', ext: 'docx' },
  { id: 4, name: 'Счёт-фактура', updated: '2026-03-10', ext: 'xlsx' },
  { id: 5, name: 'Товарная накладная', updated: '2026-02-28', ext: 'xlsx' },
];

const emptyUserForm = { name: '', email: '', role: ROLES.SALES_MANAGER, password: '' };

function validateUserForm(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Введите имя';
  if (!form.email.trim()) {
    errors.email = 'Введите email';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Некорректный формат email';
  }
  if (!form.password) {
    errors.password = 'Введите пароль';
  } else if (form.password.length < 8) {
    errors.password = 'Пароль должен содержать не менее 8 символов';
  }
  return errors;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users');

  // Users tab
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editRoleModal, setEditRoleModal] = useState(null);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [userFormErrors, setUserFormErrors] = useState({});
  const [editRoleValue, setEditRoleValue] = useState('');
  const [resetPasswordModal, setResetPasswordModal] = useState(null); // user object
  const [resetPasswordResult, setResetPasswordResult] = useState(null);

  // System settings
  const [settings, setSettings] = useState({
    shifts: 2,
    hoursPerShift: 8,
    downtimes: 'Плановое ТО каждую субботу с 08:00 до 12:00',
    prioritizationRule: 'deadline',
    defaultPenaltyRate: 0.1,
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Templates
  const [templates, setTemplates] = useState(DOCUMENT_TEMPLATES);
  const [editTemplateModal, setEditTemplateModal] = useState(null);
  const [editTemplateName, setEditTemplateName] = useState('');

  // Audit log filters
  const [auditFilters, setAuditFilters] = useState({ user: '', entity: '', dateFrom: '', dateTo: '' });

  // Integrations
  const [integrations, setIntegrations] = useState(INTEGRATIONS_INITIAL);
  const [configModal, setConfigModal] = useState(null); // integration object
  const [configFields, setConfigFields] = useState([]);
  const [pingStatus, setPingStatus] = useState({}); // id -> 'ok'|'error'|'loading'

  // API keys
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_API_KEY ?? 'sk-furniture-' + Math.random().toString(36).slice(2, 18));
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  const { users, auditLog, addUser, updateUser, deleteUser } = useAppStore();

  // ── User handlers ──────────────────────────────────────────
  function handleAddUser() {
    const errors = validateUserForm(userForm);
    if (Object.keys(errors).length > 0) {
      setUserFormErrors(errors);
      return;
    }
    addUser({ name: userForm.name.trim(), email: userForm.email.trim(), role: userForm.role, password: userForm.password });
    setUserForm(emptyUserForm);
    setUserFormErrors({});
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

  function handleResetPasswordOpen(user) {
    setResetPasswordModal(user);
    setResetPasswordResult(null);
  }

  function handleResetPasswordGenerate() {
    // Generate a demo reset token (in production this would be sent by email)
    const token = Math.random().toString(36).slice(2, 18) + Math.random().toString(36).slice(2, 18);
    setResetPasswordResult(token);
  }

  // ── Settings handler ──────────────────────────────────────
  function handleSaveSettings() {
    // Persist to localStorage so the setting survives page refresh
    try { localStorage.setItem('contractpro_settings', JSON.stringify(settings)); } catch {}
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  }

  // ── Template handlers ──────────────────────────────────────
  function openEditTemplate(tpl) {
    setEditTemplateModal(tpl);
    setEditTemplateName(tpl.name);
  }

  function handleSaveTemplate() {
    if (!editTemplateName.trim()) return;
    setTemplates(prev => prev.map(t =>
      t.id === editTemplateModal.id
        ? { ...t, name: editTemplateName.trim(), updated: new Date().toISOString().slice(0, 10) }
        : t
    ));
    setEditTemplateModal(null);
  }

  function handleDownloadTemplate(tpl) {
    // In a real system this would download the actual file.
    // Here we create a placeholder text file with the template name.
    const content = `Шаблон: ${tpl.name}\nОбновлён: ${tpl.updated}\n\n[Содержимое шаблона будет здесь]`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tpl.name}.${tpl.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Integrations ──────────────────────────────────────────
  function toggleIntegration(id) {
    setIntegrations(prev =>
      prev.map(intg => intg.id === id ? { ...intg, active: !intg.active } : intg),
    );
  }

  function openConfig(intg) {
    setConfigModal(intg);
    setConfigFields(intg.configFields.map(f => ({ ...f })));
  }

  function handleSaveConfig() {
    setIntegrations(prev =>
      prev.map(intg => intg.id === configModal.id
        ? { ...intg, configFields: configFields }
        : intg
      )
    );
    setConfigModal(null);
  }

  async function handlePingIntegration(id) {
    setPingStatus(prev => ({ ...prev, [id]: 'loading' }));
    // Simulate a ping
    await new Promise(r => setTimeout(r, 1200));
    const intg = integrations.find(i => i.id === id);
    // Active integrations "succeed", inactive "fail"
    setPingStatus(prev => ({ ...prev, [id]: intg?.active ? 'ok' : 'error' }));
    setTimeout(() => setPingStatus(prev => { const n = { ...prev }; delete n[id]; return n; }), 4000);
  }

  // ── API key ───────────────────────────────────────────────
  function handleRefreshApiKey() {
    const newKey = 'sk-furniture-' + Math.random().toString(36).slice(2, 18) + Math.random().toString(36).slice(2, 8);
    setApiKey(newKey);
  }

  function handleCopyApiKey() {
    navigator.clipboard.writeText(apiKey).catch(() => {});
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  }

  // ── Audit filtering ───────────────────────────────────────
  const filteredAudit = auditLog.filter((entry) => {
    if (auditFilters.user && !entry.user.toLowerCase().includes(auditFilters.user.toLowerCase())) return false;
    if (auditFilters.entity && entry.entity !== auditFilters.entity) return false;
    return true;
  });

  function handleExportAudit() {
    const rows = filteredAudit.map(e => ({
      Пользователь: e.user,
      Действие: e.action,
      Объект: e.entity,
      Дата: e.date,
      'IP-адрес': e.ip,
    }));
    downloadCSV('Аудит_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
  }

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
                            onClick={() => handleResetPasswordOpen(user)}
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
          {/* Document templates */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Шаблоны документов</h3>
            <div className="space-y-2">
              {templates.map((tpl) => (
                <div key={tpl.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tpl.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Обновлён: {tpl.updated}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                      onClick={() => openEditTemplate(tpl)}
                    >
                      <Pencil size={12} />
                      Редактировать
                    </button>
                    <button
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                      onClick={() => handleDownloadTemplate(tpl)}
                    >
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
              <button
                className="btn-secondary flex items-center gap-2 py-2 ml-auto"
                onClick={handleExportAudit}
              >
                <Download size={14} />
                Экспорт CSV
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
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${intg.color}`}>
                    {intg.abbr}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-gray-900">{intg.name}</h3>
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
                  <button
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    onClick={() => openConfig(intg)}
                  >
                    <Settings size={12} />
                    Настроить
                  </button>
                  <button
                    className={`btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 ${
                      pingStatus[intg.id] === 'loading' ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                    disabled={pingStatus[intg.id] === 'loading'}
                    onClick={() => handlePingIntegration(intg.id)}
                  >
                    <RefreshCw size={12} className={pingStatus[intg.id] === 'loading' ? 'animate-spin' : ''} />
                    {pingStatus[intg.id] === 'loading' ? 'Проверка...' : 'Проверить подключение'}
                  </button>
                  {pingStatus[intg.id] === 'ok' && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle size={12} /> Доступно
                    </span>
                  )}
                  {pingStatus[intg.id] === 'error' && (
                    <span className="text-xs text-red-500">✗ Недоступно</span>
                  )}
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
                    title="Копировать ключ"
                    onClick={handleCopyApiKey}
                  >
                    {apiKeyCopied ? <CheckCircle size={16} className="text-green-500" /> : <Eye size={16} />}
                  </button>
                  <button
                    className="p-2.5 border border-gray-200 rounded-xl hover:bg-yellow-50 transition-colors text-gray-500 hover:text-yellow-600"
                    title="Сгенерировать новый ключ"
                    onClick={handleRefreshApiKey}
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
                {apiKeyCopied && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle size={11} /> Ключ скопирован в буфер обмена
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Shield size={12} />
                Храните API-ключ в безопасном месте. Не передавайте третьим лицам.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add user ── */}
      <Modal
        isOpen={showAddUserModal}
        onClose={() => { setShowAddUserModal(false); setUserForm(emptyUserForm); setUserFormErrors({}); }}
        title="Добавить пользователя"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setShowAddUserModal(false); setUserFormErrors({}); }}>Отмена</button>
            <button className="btn-primary" onClick={handleAddUser}>Создать</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Имя <span className="text-red-500">*</span></label>
            <input
              type="text"
              className={`form-input${userFormErrors.name ? ' border-red-400 focus:ring-red-400' : ''}`}
              placeholder="Иванов И.И."
              value={userForm.name}
              onChange={(e) => { setUserForm((f) => ({ ...f, name: e.target.value })); setUserFormErrors((er) => ({ ...er, name: '' })); }}
            />
            {userFormErrors.name && <p className="text-red-500 text-xs mt-1">{userFormErrors.name}</p>}
          </div>
          <div>
            <label className="form-label">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              className={`form-input${userFormErrors.email ? ' border-red-400 focus:ring-red-400' : ''}`}
              placeholder="user@company.ru"
              value={userForm.email}
              onChange={(e) => { setUserForm((f) => ({ ...f, email: e.target.value })); setUserFormErrors((er) => ({ ...er, email: '' })); }}
            />
            {userFormErrors.email && <p className="text-red-500 text-xs mt-1">{userFormErrors.email}</p>}
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
            <label className="form-label">Пароль <span className="text-red-500">*</span></label>
            <input
              type="password"
              className={`form-input${userFormErrors.password ? ' border-red-400 focus:ring-red-400' : ''}`}
              placeholder="Минимум 8 символов"
              value={userForm.password}
              onChange={(e) => { setUserForm((f) => ({ ...f, password: e.target.value })); setUserFormErrors((er) => ({ ...er, password: '' })); }}
            />
            {userFormErrors.password && <p className="text-red-500 text-xs mt-1">{userFormErrors.password}</p>}
          </div>
        </div>
      </Modal>

      {/* ── Modal: Edit role ── */}
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

      {/* ── Modal: Reset password ── */}
      <Modal
        isOpen={!!resetPasswordModal}
        onClose={() => { setResetPasswordModal(null); setResetPasswordResult(null); }}
        title={`Сброс пароля — ${resetPasswordModal?.name ?? ''}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setResetPasswordModal(null); setResetPasswordResult(null); }}>
              Закрыть
            </button>
            {!resetPasswordResult && (
              <button className="btn-primary flex items-center gap-2" onClick={handleResetPasswordGenerate}>
                <Lock size={14} />
                Создать токен сброса
              </button>
            )}
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Будет создан одноразовый токен сброса пароля для пользователя <strong>{resetPasswordModal?.email}</strong>.
            В продакшне токен отправляется на email пользователя.
          </p>
          {resetPasswordResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
              <p className="text-sm text-green-700 font-medium flex items-center gap-1.5">
                <CheckCircle size={15} /> Токен сброса создан
              </p>
              <p className="text-xs text-gray-500">Отправьте пользователю следующий токен:</p>
              <code className="block text-xs font-mono bg-white border border-green-200 rounded px-2 py-1.5 break-all select-all">
                {resetPasswordResult}
              </code>
              <p className="text-xs text-gray-400">Токен действителен 1 час.</p>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modal: Edit template ── */}
      <Modal
        isOpen={!!editTemplateModal}
        onClose={() => setEditTemplateModal(null)}
        title="Редактировать шаблон"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditTemplateModal(null)}>Отмена</button>
            <button className="btn-primary" onClick={handleSaveTemplate} disabled={!editTemplateName.trim()}>
              Сохранить
            </button>
          </>
        }
      >
        <div>
          <label className="form-label">Название шаблона</label>
          <input
            className="form-input"
            value={editTemplateName}
            onChange={e => setEditTemplateName(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      {/* ── Modal: Integration config ── */}
      <Modal
        isOpen={!!configModal}
        onClose={() => setConfigModal(null)}
        title={configModal ? `Настройка — ${configModal.name}` : ''}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfigModal(null)}>Отмена</button>
            <button className="btn-primary" onClick={handleSaveConfig}>Сохранить</button>
          </>
        }
      >
        {configModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{configModal.description}</p>
            {configFields.map((field, i) => (
              <div key={field.key}>
                <label className="form-label">{field.label}</label>
                <input
                  className="form-input"
                  value={field.value}
                  onChange={e => setConfigFields(prev =>
                    prev.map((f, j) => j === i ? { ...f, value: e.target.value } : f)
                  )}
                  placeholder={field.label}
                />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
