import { useState } from 'react';
import { Filter, Download } from 'lucide-react';
import useAppStore from '../../../store/appStore';
import { downloadCSV } from '../../../utils/export';

export default function AuditTab() {
  const [auditFilters, setAuditFilters] = useState({ user: '', entity: '', dateFrom: '', dateTo: '' });
  const { auditLog } = useAppStore();

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

  return (
    <div className="space-y-4">
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
  );
}
