import { useState } from 'react';
import {
  Settings, RefreshCw, ToggleLeft, ToggleRight, CheckCircle, Shield,
  Eye, EyeOff,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';

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

export default function IntegrationsTab() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS_INITIAL);
  const [configModal, setConfigModal] = useState(null);
  const [configFields, setConfigFields] = useState([]);
  const [pingStatus, setPingStatus] = useState({});
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKey, setApiKey] = useState(
    import.meta.env.VITE_API_KEY ?? 'sk-furniture-' + Math.random().toString(36).slice(2, 18)
  );
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  function toggleIntegration(id) {
    setIntegrations(prev =>
      prev.map(intg => intg.id === id ? { ...intg, active: !intg.active } : intg)
    );
  }

  function openConfig(intg) {
    setConfigModal(intg);
    setConfigFields(intg.configFields.map(f => ({ ...f })));
  }

  function handleSaveConfig() {
    setIntegrations(prev =>
      prev.map(intg => intg.id === configModal.id ? { ...intg, configFields } : intg)
    );
    setConfigModal(null);
  }

  async function handlePingIntegration(id) {
    setPingStatus(prev => ({ ...prev, [id]: 'loading' }));
    await new Promise(r => setTimeout(r, 1200));
    const intg = integrations.find(i => i.id === id);
    setPingStatus(prev => ({ ...prev, [id]: intg?.active ? 'ok' : 'error' }));
    setTimeout(() => setPingStatus(prev => { const n = { ...prev }; delete n[id]; return n; }), 4000);
  }

  function handleRefreshApiKey() {
    setApiKey('sk-furniture-' + Math.random().toString(36).slice(2, 18) + Math.random().toString(36).slice(2, 8));
  }

  function handleCopyApiKey() {
    navigator.clipboard.writeText(apiKey).catch(() => {});
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
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

      {/* Integration config modal */}
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
