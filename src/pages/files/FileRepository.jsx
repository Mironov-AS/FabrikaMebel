import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive, Download, Trash2, FileText, Search, Filter,
  RefreshCw, AlertTriangle, Paperclip, ExternalLink,
} from 'lucide-react';
import { contractsApi } from '../../services/api';
import useAppStore from '../../store/appStore';

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function fileIcon(mimetype) {
  if (!mimetype) return '📄';
  if (mimetype === 'application/pdf') return '📕';
  if (mimetype.includes('word')) return '📘';
  if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return '📗';
  if (mimetype.startsWith('image/')) return '🖼️';
  if (mimetype === 'text/plain') return '📄';
  return '📎';
}

function fileTypeBadge(mimetype) {
  if (!mimetype) return { label: 'Файл', cls: 'bg-gray-100 text-gray-600' };
  if (mimetype === 'application/pdf') return { label: 'PDF', cls: 'bg-red-100 text-red-700' };
  if (mimetype.includes('word')) return { label: 'Word', cls: 'bg-blue-100 text-blue-700' };
  if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return { label: 'Excel', cls: 'bg-green-100 text-green-700' };
  if (mimetype.startsWith('image/')) return { label: 'Изображение', cls: 'bg-purple-100 text-purple-700' };
  if (mimetype === 'text/plain') return { label: 'TXT', cls: 'bg-yellow-100 text-yellow-700' };
  return { label: 'Файл', cls: 'bg-gray-100 text-gray-600' };
}

export default function FileRepository() {
  const navigate = useNavigate();
  const user = useAppStore(s => s.user);

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const canDelete = user?.role === 'admin' || user?.role === 'sales_manager' || user?.role === 'director';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await contractsApi.getAllFiles();
      setFiles(data);
    } catch {
      setError('Не удалось загрузить список файлов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async (file) => {
    try {
      const { data } = await contractsApi.downloadFile(file.contract_id, file.id);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Не удалось скачать файл');
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`Удалить файл "${file.original_name}"?`)) return;
    try {
      await contractsApi.deleteFile(file.contract_id, file.id);
      setFiles(prev => prev.filter(f => f.id !== file.id));
    } catch {
      alert('Не удалось удалить файл');
    }
  };

  const FILE_TYPES = [
    { value: 'all', label: 'Все типы' },
    { value: 'pdf', label: 'PDF' },
    { value: 'word', label: 'Word' },
    { value: 'excel', label: 'Excel' },
    { value: 'image', label: 'Изображения' },
    { value: 'txt', label: 'Текст' },
  ];

  function matchesType(mimetype, filter) {
    if (filter === 'all') return true;
    if (filter === 'pdf') return mimetype === 'application/pdf';
    if (filter === 'word') return mimetype?.includes('word');
    if (filter === 'excel') return mimetype?.includes('excel') || mimetype?.includes('spreadsheet');
    if (filter === 'image') return mimetype?.startsWith('image/');
    if (filter === 'txt') return mimetype === 'text/plain';
    return true;
  }

  const filtered = files.filter(f => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      f.original_name?.toLowerCase().includes(q) ||
      f.contract_number?.toLowerCase().includes(q) ||
      f.counterparty_name?.toLowerCase().includes(q);
    return matchesSearch && matchesType(f.mimetype, typeFilter);
  });

  // Summary stats
  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);
  const contractsWithFiles = new Set(files.map(f => f.contract_id)).size;

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Archive size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Хранилище файлов</h1>
            <p className="text-sm text-gray-500">Все документы по договорам</p>
          </div>
        </div>
        <button
          onClick={load}
          className="btn-secondary flex items-center gap-1.5"
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Всего файлов</p>
          <p className="text-2xl font-bold text-gray-900">{files.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Договоров с файлами</p>
          <p className="text-2xl font-bold text-gray-900">{contractsWithFiles}</p>
        </div>
        <div className="card p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500 mb-1">Общий объём</p>
          <p className="text-2xl font-bold text-gray-900">{formatBytes(totalSize)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Поиск по имени файла, договору, контрагенту..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-gray-400 shrink-0" />
          <select
            className="input w-40"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            {FILE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <RefreshCw size={32} className="mx-auto mb-3 animate-spin opacity-50" />
          <p className="text-sm">Загрузка...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Paperclip size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">
            {files.length === 0 ? 'Файлы ещё не загружены' : 'Ничего не найдено'}
          </p>
          {files.length === 0 && (
            <p className="text-xs mt-1">Загружайте документы через карточку договора → вкладка «Файлы»</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            Показано: <strong className="text-gray-700">{filtered.length}</strong> из {files.length}
          </p>
          {filtered.map(file => {
            const badge = fileTypeBadge(file.mimetype);
            return (
              <div
                key={file.id}
                className="card px-4 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors"
              >
                {/* Icon */}
                <div className="text-2xl shrink-0 select-none" aria-hidden>
                  {fileIcon(file.mimetype)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                      {file.original_name}
                    </p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                    <button
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                      onClick={() => navigate(`/contracts/${file.contract_id}`)}
                    >
                      <FileText size={11} />
                      Договор №{file.contract_number || file.contract_id}
                    </button>
                    {file.counterparty_name && (
                      <span className="text-gray-400">{file.counterparty_name}</span>
                    )}
                    <span>{formatBytes(file.size)}</span>
                    <span>{file.uploaded_by_name}</span>
                    <span>{new Date(file.uploaded_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Перейти к договору"
                    onClick={() => navigate(`/contracts/${file.contract_id}`)}
                  >
                    <ExternalLink size={15} />
                  </button>
                  <button
                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Скачать"
                    onClick={() => handleDownload(file)}
                  >
                    <Download size={15} />
                  </button>
                  {canDelete && (
                    <button
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                      title="Удалить"
                      onClick={() => handleDelete(file)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
