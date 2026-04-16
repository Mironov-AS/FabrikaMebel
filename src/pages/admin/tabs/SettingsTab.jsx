import { useState, useEffect } from 'react';
import { Pencil, Download, Building2, Save, CheckCircle } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { settingsApi } from '../../../services/api';

const DOCUMENT_TEMPLATES = [
  { id: 1, name: 'Шаблон договора поставки', updated: '2026-03-01', ext: 'docx' },
  { id: 2, name: 'Дополнительное соглашение', updated: '2026-02-15', ext: 'docx' },
  { id: 3, name: 'Акт сдачи-приёмки', updated: '2026-01-20', ext: 'docx' },
  { id: 4, name: 'Счёт-фактура', updated: '2026-03-10', ext: 'xlsx' },
  { id: 5, name: 'Товарная накладная', updated: '2026-02-28', ext: 'xlsx' },
];

export default function SettingsTab() {
  const [templates, setTemplates] = useState(DOCUMENT_TEMPLATES);
  const [editTemplateModal, setEditTemplateModal] = useState(null);
  const [editTemplateName, setEditTemplateName] = useState('');

  // Company settings
  const [companyName, setCompanyName] = useState('');
  const [companyNameSaved, setCompanyNameSaved] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);

  useEffect(() => {
    settingsApi.get().then(({ data }) => {
      const name = data.company_name || '';
      setCompanyName(name);
      setCompanyNameSaved(name);
    }).catch(() => {});
  }, []);

  async function handleSaveCompany() {
    setSavingCompany(true);
    try {
      const { data } = await settingsApi.update({ company_name: companyName.trim() });
      const saved = data.company_name || '';
      setCompanyName(saved);
      setCompanyNameSaved(saved);
      setCompanySaved(true);
      setTimeout(() => setCompanySaved(false), 2500);
    } catch {
      // ignore
    } finally {
      setSavingCompany(false);
    }
  }

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
    const content = `Шаблон: ${tpl.name}\nОбновлён: ${tpl.updated}\n\n[Содержимое шаблона будет здесь]`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tpl.name}.${tpl.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Company settings */}
      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={16} className="text-blue-500" />
          <h3 className="font-semibold text-gray-900">Наша компания</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Укажите официальное название вашей компании. Оно используется при импорте договоров — ИИ будет знать, что это ваша сторона, и правильно определит контрагента (покупателя).
        </p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder='Например: ООО "АРТМЕБЕЛЬ"'
          />
          <button
            className="btn-primary flex items-center gap-1.5 shrink-0"
            onClick={handleSaveCompany}
            disabled={savingCompany || companyName.trim() === companyNameSaved}
          >
            {companySaved
              ? <><CheckCircle size={14} />Сохранено</>
              : <><Save size={14} />Сохранить</>
            }
          </button>
        </div>
        {companyNameSaved && (
          <p className="text-xs text-green-600 mt-2">
            Текущее значение: <span className="font-medium">{companyNameSaved}</span>
          </p>
        )}
      </div>

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
    </div>
  );
}
