import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, AlertCircle, CheckCircle, Zap, Sliders, Eye, EyeOff,
} from 'lucide-react';
import api from '../../../services/api';
import Modal from '../../../components/ui/Modal';

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

export default function LLMTab() {
  const [llmConfig, setLlmConfig] = useState(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmSaved, setLlmSaved] = useState(false);
  const [llmError, setLlmError] = useState('');
  const [llmModalProvider, setLlmModalProvider] = useState(null);
  const [llmModalFields, setLlmModalFields] = useState({});
  const [llmTestStatus, setLlmTestStatus] = useState({});
  const [llmKeyVisible, setLlmKeyVisible] = useState({});

  const loadLlmConfig = useCallback(async () => {
    setLlmLoading(true);
    setLlmError('');
    try {
      const { data } = await api.get('/llm-config');
      setLlmConfig(data);
    } catch {
      setLlmError('Не удалось загрузить конфигурацию моделей');
    } finally {
      setLlmLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!llmConfig) loadLlmConfig();
  }, [llmConfig, loadLlmConfig]);

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
    } catch {
      setLlmTestStatus(prev => ({ ...prev, [providerId]: 'error', [`${providerId}_error`]: 'Сетевая ошибка' }));
    }
    setTimeout(() => setLlmTestStatus(prev => {
      const n = { ...prev };
      delete n[providerId]; delete n[`${providerId}_error`];
      return n;
    }), 5000);
  }

  return (
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
                    {isActive && <CheckCircle size={16} className="text-blue-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {LLM_PROVIDERS.map((p) => {
              const isActive = llmConfig.activeProvider === p.id;
              const pCfg = llmConfig.providers?.[p.id] || {};
              const testStatus = llmTestStatus[p.id];
              return (
                <div key={p.id} className={`card flex flex-col gap-4 ${isActive ? 'ring-2 ring-blue-200' : ''}`}>
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

            <div>
              <label className="form-label flex items-center justify-between">
                <span>Температура</span>
                <span className="font-mono text-blue-600">{Number(llmModalFields.temperature).toFixed(1)}</span>
              </label>
              <input
                type="range" min="0" max="1" step="0.1"
                className="w-full accent-blue-500"
                value={llmModalFields.temperature}
                onChange={(e) => setLlmModalFields((f) => ({ ...f, temperature: e.target.value }))}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Точный (0)</span>
                <span>Случайный (1)</span>
              </div>
            </div>

            <div>
              <label className="form-label">Макс. токенов</label>
              <input
                type="number" className="form-input"
                min={100} max={32000} step={100}
                value={llmModalFields.maxTokens}
                onChange={(e) => setLlmModalFields((f) => ({ ...f, maxTokens: e.target.value }))}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
