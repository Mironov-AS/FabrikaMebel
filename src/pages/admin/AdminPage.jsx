import { useState, useEffect, useCallback } from 'react';
import {
  Users, Settings, Shield, Plug, Plus, Pencil, Trash2, Lock, Ban, CheckCircle,
  Eye, EyeOff, RefreshCw, ToggleLeft, ToggleRight, Download, Filter, X,
  BrainCircuit, Zap, AlertCircle, ChevronDown, ChevronUp, Sliders,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import { ROLES, ROLE_LABELS } from '../../data/mockData';
import { downloadCSV } from '../../utils/export';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import api from '../../services/api';

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

// ── LLM providers definition ────────────────────────────────────────────────
const LLM_PROVIDERS = [
  {
    id: 'yandex',
    name: 'Yandex GPT',
    description: 'Языковые модели от Яндекс Облако',
    color: 'bg-red-100 text-red-700',
    abbr: 'YG',
    models: ['yandexgpt/latest', 'yandexgpt-lite/latest'],
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'AQVN...' },
      { key: 'folderId', label: 'Folder ID', type: 'text', required: true, placeholder: 'b1g0...' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Модели семейства Claude от Anthropic',
    color: 'bg-orange-100 text-orange-700',
    abbr: 'CL',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-ant-...' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI / совместимые',
    description: 'GPT-4o и другие OpenAI-совместимые API',
    color: 'bg-green-100 text-green-700',
    abbr: 'AI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-...' },
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: false, placeholder: 'https://api.openai.com/v1' },
    ],
  },
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

  // LLM models tab
  const [llmConfig, setLlmConfig] = useState(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmSaved, setLlmSaved] = useState(false);
  const [llmError, setLlmError] = useState('');
  const [llmModalProvider, setLlmModalProvider] = useState(null); // provider id
  const [llmModalFields, setLlmModalFields] = useState({}); // { apiKey, model, temperature, maxTokens, ... }
  const [llmTestStatus, setLlmTestStatus] = useState({}); // { yandex: 'idle'|'loading'|'ok'|'error', error: '...' }
  const [llmKeyVisible, setLlmKeyVisible] = useState({}); // { providerId: bool }

  const loadLlmConfig = useCallback(async () => {
    setLlmLoading(true);
    setLlmError('');
    try {
      const { data } = await api.get('/llm-config');
      setLlmConfig(data);
    } catch (e) {
      setLlmError('Не удалось загрузить конфигурацию моделей');
    } finally {
      setLlmLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'llm' && !llmConfig) loadLlmConfig();
  }, [activeTab, llmConfig, loadLlmConfig]);

  async function handleSetActiveProvider(providerId) {
    setLlmConfig(prev => ({ ...prev, activeProvider: providerId }));
    try {
      await api.put('/llm-config', { activeProvider: providerId });
      setLlmSaved(true);
      setTimeout(() => setLlmSaved(false), 2000);
    } catch {
      setLlmError('Ошибка при сохранении');
    }
  }

  function openLlmModal(provider) {
    const pCfg = llmConfig?.providers?.[provider.id] || {};
    setLlmModalFields({
      model: pCfg.model || provider.models[0],
      temperature: pCfg.temperature ?? 0.7,
      maxTokens: pCfg.maxTokens ?? 4000,
      apiKey: '',
      folderId: pCfg.folderId || '',
      baseUrl: pCfg.baseUrl || '',
    });
    setLlmModalProvider(provider);
  }

  async function handleSaveLlmModal() {
    if (!llmModalProvider) return;
    setLlmSaving(true);
    const patch = {
      model: llmModalFields.model,
      temperature: parseFloat(llmModalFields.temperature) || 0.7,
      maxTokens: parseInt(llmModalFields.maxTokens) || 4000,
    };
    if (llmModalFields.apiKey) patch.apiKey = llmModalFields.apiKey;
    if (llmModalProvider.id === 'yandex' && llmModalFields.folderId) patch.folderId = llmModalFields.folderId;
    if (llmModalProvider.id === 'openai') patch.baseUrl = llmModalFields.baseUrl || '';

    try {
      await api.put('/llm-config', { providers: { [llmModalProvider.id]: patch } });
      await loadLlmConfig();
      setLlmModalProvider(null);
      setLlmSaved(true);
      setTimeout(() => setLlmSaved(false), 2000);
    } catch {
      setLlmError('Ошибка при сохранении конфигурации');
    } finally {
      setLlmSaving(false);
    }
  }

  async function handleTestLlm(providerId) {
    setLlmTestStatus(prev => ({ ...prev, [providerId]: 'loading' }));
    try {
      const { data } = await api.post(`/llm-config/test/${providerId}`);
      setLlmTestStatus(prev => ({ ...prev, [providerId]: data.ok ? 'ok' : 'error', [`${providerId}_error`]: data.error }));
    } catch (e) {
      setLlmTestStatus(prev => ({ ...prev, [providerId]: 'error', [`${providerId}_error`]: 'Сетевая ошибка' }));
    }
    setTimeout(() => setLlmTestStatus(prev => {
      const n = { ...prev };
      delete n[providerId]; delete n[`${providerId}_error`];
      return n;
    }), 5000);
  }

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
    { key: 'llm', label: 'ИИ-модели', icon: BrainCircuit },
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

      {/* ── TAB 5: LLM Models ── */}
      {activeTab === 'llm' && (
        <div className="space-y-6">
          {llmLoading && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <RefreshCw size={15} className="animate-spin" />
              Загрузка конфигурации...
            </div>
          )}

          {llmError && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={15} />
              {llmError}
            </div>
          )}

          {llmSaved && (
            <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle size={15} />
              Настройки сохранены
            </div>
          )}

          {llmConfig && (
            <>
              {/* Active provider selector */}
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={16} className="text-blue-500" />
                  <h3 className="font-semibold text-gray-900">Активный провайдер</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Выберите ЛЛМ-провайдера, который будет использоваться ИИ-ассистентом системы.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {LLM_PROVIDERS.map((p) => {
                    const isActive = llmConfig.activeProvider === p.id;
                    const pCfg = llmConfig.providers?.[p.id] || {};
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSetActiveProvider(p.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                          isActive
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${p.color}`}>
                          {p.abbr}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>
                            {p.name}
                          </p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {pCfg.apiKeySet ? (pCfg.model || p.models[0]) : 'Не настроен'}
                          </p>
                        </div>
                        {isActive && (
                          <CheckCircle size={16} className="text-blue-500 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Provider cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {LLM_PROVIDERS.map((p) => {
                  const isActive = llmConfig.activeProvider === p.id;
                  const pCfg = llmConfig.providers?.[p.id] || {};
                  const testStatus = llmTestStatus[p.id];
                  return (
                    <div
                      key={p.id}
                      className={`card flex flex-col gap-4 ${isActive ? 'ring-2 ring-blue-200' : ''}`}
                    >
                      {/* Header */}
                      <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${p.color}`}>
                          {p.abbr}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 text-sm">{p.name}</h3>
                            {isActive && (
                              <span className="text-xs font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                                Активен
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Статус</span>
                          <span className={pCfg.apiKeySet ? 'text-green-600 font-medium' : 'text-gray-400'}>
                            {pCfg.apiKeySet ? 'Настроен' : 'Не настроен'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Модель</span>
                          <span className="text-gray-700 font-mono text-xs truncate max-w-[140px]" title={pCfg.model}>
                            {pCfg.model || p.models[0]}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Температура</span>
                          <span className="text-gray-700">{pCfg.temperature ?? 0.7}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Макс. токенов</span>
                          <span className="text-gray-700">{(pCfg.maxTokens ?? 4000).toLocaleString()}</span>
                        </div>
                        {pCfg.apiKeyMasked && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">API Key</span>
                            <span className="text-gray-400 font-mono text-xs">{pCfg.apiKeyMasked}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-auto">
                        <button
                          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                          onClick={() => openLlmModal(p)}
                        >
                          <Sliders size={12} />
                          Настроить
                        </button>
                        <button
                          className={`btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 ${
                            testStatus === 'loading' ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                          disabled={testStatus === 'loading'}
                          onClick={() => handleTestLlm(p.id)}
                        >
                          <RefreshCw size={12} className={testStatus === 'loading' ? 'animate-spin' : ''} />
                          {testStatus === 'loading' ? 'Проверка...' : 'Тест'}
                        </button>
                        {testStatus === 'ok' && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle size={12} /> OK
                          </span>
                        )}
                        {testStatus === 'error' && (
                          <span className="text-xs text-red-500 truncate max-w-[100px]" title={llmTestStatus[`${p.id}_error`]}>
                            ✗ Ошибка
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Modal: LLM provider config ── */}
      <Modal
        isOpen={!!llmModalProvider}
        onClose={() => setLlmModalProvider(null)}
        title={llmModalProvider ? `Настройка — ${llmModalProvider.name}` : ''}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setLlmModalProvider(null)}>Отмена</button>
            <button className="btn-primary flex items-center gap-2" onClick={handleSaveLlmModal} disabled={llmSaving}>
              {llmSaving && <RefreshCw size={14} className="animate-spin" />}
              Сохранить
            </button>
          </>
        }
      >
        {llmModalProvider && (
          <div className="space-y-4">
            {/* API Key fields */}
            {llmModalProvider.fields.map((field) => (
              <div key={field.key}>
                <label className="form-label">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.type === 'password' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type={llmKeyVisible[field.key] ? 'text' : 'password'}
                      className="form-input font-mono text-sm flex-1"
                      placeholder={
                        llmConfig?.providers?.[llmModalProvider.id]?.apiKeySet
                          ? llmConfig?.providers?.[llmModalProvider.id]?.apiKeyMasked || '••••••••'
                          : field.placeholder
                      }
                      value={llmModalFields[field.key] || ''}
                      onChange={(e) => setLlmModalFields((f) => ({ ...f, [field.key]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500"
                      onClick={() => setLlmKeyVisible((v) => ({ ...v, [field.key]: !v[field.key] }))}
                    >
                      {llmKeyVisible[field.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    placeholder={field.placeholder}
                    value={llmModalFields[field.key] || ''}
                    onChange={(e) => setLlmModalFields((f) => ({ ...f, [field.key]: e.target.value }))}
                  />
                )}
                {field.key === 'apiKey' && llmConfig?.providers?.[llmModalProvider.id]?.apiKeySet && (
                  <p className="text-xs text-gray-400 mt-1">Оставьте пустым, чтобы не менять текущий ключ</p>
                )}
              </div>
            ))}

            {/* Model selector */}
            <div>
              <label className="form-label">Модель</label>
              <select
                className="form-input"
                value={llmModalFields.model || llmModalProvider.models[0]}
                onChange={(e) => setLlmModalFields((f) => ({ ...f, model: e.target.value }))}
              >
                {llmModalProvider.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Temperature */}
            <div>
              <label className="form-label flex items-center justify-between">
                <span>Температура</span>
                <span className="font-mono text-blue-600">{Number(llmModalFields.temperature).toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                className="w-full accent-blue-500"
                value={llmModalFields.temperature}
                onChange={(e) => setLlmModalFields((f) => ({ ...f, temperature: e.target.value }))}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Точный (0)</span>
                <span>Случайный (1)</span>
              </div>
            </div>

            {/* Max tokens */}
            <div>
              <label className="form-label">Макс. токенов</label>
              <input
                type="number"
                className="form-input"
                min={100}
                max={32000}
                step={100}
                value={llmModalFields.maxTokens}
                onChange={(e) => setLlmModalFields((f) => ({ ...f, maxTokens: e.target.value }))}
              />
            </div>
          </div>
        )}
      </Modal>

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
