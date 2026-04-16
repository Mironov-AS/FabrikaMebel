import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, AlertCircle, CheckCircle, Zap, Sliders, Eye, EyeOff, Plus, X,
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
      { key: 'folderId', label: 'Folder ID', type: 'text', required: true, placeholder: 'b1g0i9ec4ojktqk4t58k', hint: 'Только ID папки, без gpt://' },
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

function getModelDisplayName(model, providerId) {
  if (providerId === 'yandex' && model?.startsWith('gpt://')) {
    const parts = model.slice(6).split('/');
    return parts.slice(1).join('/');
  }
  return model || '';
}

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
    let initCustomModels = pCfg.customModels || [];
    let initModel = pCfg.model || '';

    if (provider.id === 'yandex') {
      // Auto-populate list from existing folderId + model if list is empty
      if (initCustomModels.length === 0 && pCfg.folderId && initModel && !initModel.startsWith('gpt://')) {
        initCustomModels = [`gpt://${pCfg.folderId}/${initModel}`];
      }
      // Upgrade model to full URI if we have folderId
      if (initModel && pCfg.folderId && !initModel.startsWith('gpt://')) {
        initModel = `gpt://${pCfg.folderId}/${initModel}`;
      }
      if (!initModel && initCustomModels.length > 0) {
        initModel = initCustomModels[0];
      }
    } else {
      initModel = initModel || provider.models[0];
    }

    setLlmModalFields({
      model: initModel,
      temperature: pCfg.temperature ?? 0.7,
      maxTokens: pCfg.maxTokens ?? 4000,
      apiKey: '',
      folderId: pCfg.folderId || '',
      baseUrl: pCfg.baseUrl || '',
      customModels: initCustomModels,
      newModelUri: '',
    });
    setLlmModalProvider(provider);
  }

  function addCustomModel() {
    const uri = (llmModalFields.newModelUri || '').trim();
    if (!uri.startsWith('gpt://') || uri.split('/').length < 4) return;
    if ((llmModalFields.customModels || []).includes(uri)) {
      setLlmModalFields(f => ({ ...f, newModelUri: '' }));
      return;
    }
    setLlmModalFields(f => ({
      ...f,
      customModels: [...(f.customModels || []), uri],
      model: f.model || uri,
      newModelUri: '',
    }));
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
    if (llmModalProvider.id === 'yandex') patch.customModels = llmModalFields.customModels || [];
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
                        {pCfg.apiKeySet ? (getModelDisplayName(pCfg.model, p.id) || p.models[0]) : 'Не настроен'}
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
                        {getModelDisplayName(pCfg.model, p.id) || p.models[0]}
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
                {field.hint && (
                  <p className="text-xs text-gray-400 mt-1">{field.hint}</p>
                )}
              </div>
            ))}

            {llmModalProvider.id === 'yandex' ? (
              <div>
                <label className="form-label">Модели Яндекс</label>
                <div className="space-y-2 mb-3">
                  {(llmModalFields.customModels || []).length === 0 ? (
                    <p className="text-sm text-gray-400 py-1">Нет добавленных моделей. Введите путь ниже.</p>
                  ) : (
                    (llmModalFields.customModels || []).map((uri) => (
                      <div
                        key={uri}
                        className={`flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer transition-colors ${
                          llmModalFields.model === uri
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                        }`}
                        onClick={() => setLlmModalFields(f => ({ ...f, model: uri }))}
                      >
                        <input
                          type="radio"
                          name="activeYandexModel"
                          checked={llmModalFields.model === uri}
                          onChange={() => setLlmModalFields(f => ({ ...f, model: uri }))}
                          className="accent-blue-500 flex-shrink-0"
                        />
                        <span className="flex-1 font-mono text-xs text-gray-700 truncate" title={uri}>{uri}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLlmModalFields(f => {
                              const next = f.customModels.filter(m => m !== uri);
                              return { ...f, customModels: next, model: f.model === uri ? (next[0] || '') : f.model };
                            });
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 p-0.5"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="form-input flex-1 font-mono text-sm"
                    placeholder="gpt://folder-id/yandexgpt/latest"
                    value={llmModalFields.newModelUri || ''}
                    onChange={(e) => setLlmModalFields(f => ({ ...f, newModelUri: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomModel(); } }}
                  />
                  <button
                    type="button"
                    className="btn-secondary px-3 flex items-center gap-1.5 text-sm whitespace-nowrap"
                    onClick={addCustomModel}
                  >
                    <Plus size={14} /> Добавить
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Формат: <span className="font-mono">gpt://folder-id/model-name/version</span></p>
              </div>
            ) : (
              <div>
                <label className="form-label">Модель</label>
                <select
                  className="form-input"
                  value={llmModalProvider.models.includes(llmModalFields.model) ? llmModalFields.model : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setLlmModalFields((f) => ({ ...f, model: '' }));
                    } else {
                      setLlmModalFields((f) => ({ ...f, model: e.target.value }));
                    }
                  }}
                >
                  {llmModalProvider.models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="__custom__">Своя модель...</option>
                </select>
                {!llmModalProvider.models.includes(llmModalFields.model) && (
                  <input
                    type="text"
                    className="form-input mt-2"
                    placeholder="Например: aliceai-llm/latest"
                    value={llmModalFields.model}
                    onChange={(e) => setLlmModalFields((f) => ({ ...f, model: e.target.value }))}
                  />
                )}
              </div>
            )}

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
