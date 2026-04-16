import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Info, Download } from 'lucide-react';
import useAppStore from '../../store/appStore';

export default function ImportPaymentsModal({ onClose }) {
  const { importPayments } = useAppStore();

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  function handleFileChange(f) {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setError('Поддерживаются форматы: .xlsx, .xls, .csv');
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
  }

  function onInputChange(e) {
    handleFileChange(e.target.files[0]);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFileChange(e.dataTransfer.files[0]);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const data = await importPayments(file, (evt) => {
        if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
      });
      setResult(data);
    } catch (e) {
      setError(e?.response?.data?.error || 'Ошибка при импорте файла');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }

  function downloadTemplate() {
    const XLSX = window._XLSX;
    // Create template data
    const rows = [
      ['Номер счёта', 'Сумма оплаты', 'Дата оплаты', 'Примечание'],
      ['СЧ-2024-001', 50000, '15.04.2025', 'п/п № 123'],
      ['СЧ-2024-002', 120000, '2025-04-16', ''],
    ];
    // Use CSV as fallback (no XLSX in browser)
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'шаблон_оплаты.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const allDone = result && result.processed > 0 && result.errors.length === 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Импорт оплат от бухгалтера</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Format hint */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
            <Info size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">Формат файла (Excel или CSV)</p>
              <p className="text-blue-600">Обязательные колонки: <strong>Номер счёта · Сумма оплаты · Дата оплаты</strong></p>
              <p className="text-blue-600 mt-0.5">Опционально: <strong>Примечание</strong></p>
              <p className="text-blue-600 mt-0.5">Дата: ДД.ММ.ГГГГ или ГГГГ-ММ-ДД</p>
            </div>
          </div>

          {/* Download template */}
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <Download size={15} />
            Скачать шаблон CSV
          </button>

          {/* Drop zone */}
          {!result && (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                ${dragging ? 'border-blue-400 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={onInputChange}
              />
              {file ? (
                <div className="space-y-1">
                  <CheckCircle size={32} className="mx-auto text-green-500" />
                  <p className="font-medium text-gray-800">{file.name}</p>
                  <p className="text-sm text-gray-400">{(file.size / 1024).toFixed(1)} КБ · нажмите чтобы заменить</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload size={32} className="mx-auto text-gray-300" />
                  <p className="text-gray-500 font-medium">Перетащите файл сюда</p>
                  <p className="text-sm text-gray-400">или нажмите для выбора · .xlsx .xls .csv</p>
                </div>
              )}
            </div>
          )}

          {/* Progress */}
          {loading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Обработка...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress || 30}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-600">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3">
              <div className={`rounded-xl p-4 ${allDone ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {allDone
                    ? <CheckCircle size={18} className="text-green-600" />
                    : <AlertCircle size={18} className="text-yellow-600" />
                  }
                  <span className={`font-semibold ${allDone ? 'text-green-700' : 'text-yellow-700'}`}>
                    {allDone ? 'Импорт завершён' : 'Импорт завершён с замечаниями'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{result.processed}</div>
                    <div className="text-xs text-gray-500">Проведено оплат</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">{result.skipped}</div>
                    <div className="text-xs text-gray-500">Пропущено строк</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-600">{result.totalRows}</div>
                    <div className="text-xs text-gray-500">Всего строк</div>
                  </div>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="border border-red-100 rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    Строки с ошибками ({result.errors.length})
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-gray-50">
                    {result.errors.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <span className="text-gray-400 w-8 flex-shrink-0">#{e.row}</span>
                        <span className="font-mono text-gray-700 truncate flex-1">{e.invoiceNumber || '—'}</span>
                        <span className="text-red-500 text-xs">{e.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => { setResult(null); setFile(null); }}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                Импортировать ещё один файл
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            {result ? 'Закрыть' : 'Отмена'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Импорт...' : 'Провести оплаты'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
