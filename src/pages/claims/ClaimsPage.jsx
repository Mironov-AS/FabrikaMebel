import { useState } from 'react';
import {
  AlertTriangle, Plus, Clock, CheckCircle, XCircle, Eye, ChevronRight,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import { STATUS_LABELS } from '../../data/mockData';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import StatCard from '../../components/ui/StatCard';

const TODAY = new Date(2026, 3, 6);

function isClaimOverdue(claim) {
  if (['resolved', 'closed'].includes(claim.status)) return false;
  return new Date(claim.deadline) < TODAY;
}

const MOCK_TIMELINE = (claim) => [
  { date: claim.date, event: 'Рекламация создана', icon: Plus, color: 'text-blue-600 bg-blue-50' },
  { date: claim.date, event: `Назначен ответственный: ${claim.responsible}`, icon: Eye, color: 'text-purple-600 bg-purple-50' },
  ...(claim.status === 'in_review' ? [{ date: claim.date, event: 'Передана на рассмотрение', icon: Clock, color: 'text-yellow-600 bg-yellow-50' }] : []),
];

const emptyClaimForm = {
  contractId: '',
  shipmentId: '',
  specItemId: '',
  description: '',
  responsible: '',
  pausePayments: false,
};

const emptyResolutionForm = {
  status: 'resolved',
  resolution: '',
};

export default function ClaimsPage() {
  const [showNewModal, setShowNewModal] = useState(false);
  const [claimForm, setClaimForm] = useState(emptyClaimForm);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [resolutionForm, setResolutionForm] = useState(emptyResolutionForm);

  const { claims, contracts, shipments, orders, counterparties, users, addClaim, updateClaim } = useAppStore();

  const getCounterparty = (id) => counterparties.find((c) => c.id === id);
  const getContract = (id) => contracts.find((c) => c.id === id);
  const getShipment = (id) => shipments.find((s) => s.id === id);

  // KPIs
  const openCount = claims.filter((c) => c.status === 'open').length;
  const inReviewCount = claims.filter((c) => c.status === 'in_review').length;
  const resolvedCount = claims.filter((c) => ['resolved', 'closed'].includes(c.status)).length;
  const overdueCount = claims.filter(isClaimOverdue).length;

  // Filtered shipments for selected contract
  const contractShipments = claimForm.contractId
    ? shipments.filter((s) => {
        const order = orders.find((o) => o.id === s.orderId);
        return order?.contractId === Number(claimForm.contractId);
      })
    : [];

  // Spec items for selected shipment
  const shipmentItems = claimForm.shipmentId
    ? (shipments.find((s) => s.id === Number(claimForm.shipmentId))?.items ?? [])
    : [];

  function handleNewClaimSubmit() {
    if (!claimForm.contractId || !claimForm.description) return;
    const contract = getContract(Number(claimForm.contractId));
    addClaim({
      number: `РЕК-2026-00${Date.now() % 100}`,
      contractId: Number(claimForm.contractId),
      shipmentId: claimForm.shipmentId ? Number(claimForm.shipmentId) : null,
      counterpartyId: contract?.counterpartyId,
      specItemId: claimForm.specItemId ? Number(claimForm.specItemId) : null,
      date: new Date().toISOString().slice(0, 10),
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      description: claimForm.description,
      status: 'open',
      responsible: claimForm.responsible,
      resolution: null,
      pausePayments: claimForm.pausePayments,
      affectedPaymentId: null,
    });
    setClaimForm(emptyClaimForm);
    setShowNewModal(false);
  }

  function handleResolutionSubmit() {
    if (!selectedClaim) return;
    updateClaim(selectedClaim.id, {
      status: resolutionForm.status,
      resolution: resolutionForm.resolution,
    });
    const updated = { ...selectedClaim, status: resolutionForm.status, resolution: resolutionForm.resolution };
    setSelectedClaim(updated);
    setResolutionForm(emptyResolutionForm);
  }

  // ── Detail view ────────────────────────────────────────────
  if (selectedClaim) {
    const cp = getCounterparty(selectedClaim.counterpartyId);
    const contract = getContract(selectedClaim.contractId);
    const shipment = getShipment(selectedClaim.shipmentId);
    const overdue = isClaimOverdue(selectedClaim);
    const timeline = MOCK_TIMELINE(selectedClaim);
    const canResolve = ['open', 'in_review'].includes(selectedClaim.status);

    return (
      <div className="space-y-6">
        {/* Back */}
        <button
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          onClick={() => setSelectedClaim(null)}
        >
          ← Назад к списку рекламаций
        </button>

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{selectedClaim.number}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{cp?.name} — {contract?.number}</p>
          </div>
          <div className="flex items-center gap-3">
            {overdue && (
              <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium bg-red-50 px-3 py-1.5 rounded-lg">
                <AlertTriangle size={14} />
                Просрочена
              </span>
            )}
            <StatusBadge status={selectedClaim.status} />
          </div>
        </div>

        {/* Payments paused banner */}
        {selectedClaim.pausePayments && !['resolved', 'closed'].includes(selectedClaim.status) && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <AlertTriangle size={15} />
            Платежи по данной рекламации приостановлены до разрешения
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Details */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">Детали рекламации</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Дата создания</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">{selectedClaim.date}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Дедлайн</dt>
                  <dd className={`font-medium mt-0.5 ${overdue ? 'text-red-600' : 'text-gray-900'}`}>{selectedClaim.deadline}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Контрагент</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">{cp?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Договор</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">{contract?.number ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Отгрузка</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">{shipment?.invoiceNumber ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Ответственный</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">{selectedClaim.responsible || '—'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-gray-500">Описание</dt>
                  <dd className="font-medium text-gray-900 mt-0.5 leading-relaxed">{selectedClaim.description}</dd>
                </div>
                {selectedClaim.resolution && (
                  <div className="col-span-2">
                    <dt className="text-gray-500">Решение</dt>
                    <dd className="font-medium text-green-700 mt-0.5 leading-relaxed">{selectedClaim.resolution}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Resolution form */}
            {canResolve && (
              <div className="card border-blue-100">
                <h3 className="font-semibold text-gray-900 mb-3">Закрыть рекламацию</h3>
                <div className="space-y-3">
                  <div>
                    <label className="form-label">Статус</label>
                    <select
                      className="form-input"
                      value={resolutionForm.status}
                      onChange={(e) => setResolutionForm((f) => ({ ...f, status: e.target.value }))}
                    >
                      <option value="resolved">Решена</option>
                      <option value="closed">Закрыта</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Текст решения</label>
                    <textarea
                      className="form-input resize-none"
                      rows={3}
                      placeholder="Опишите принятое решение..."
                      value={resolutionForm.resolution}
                      onChange={(e) => setResolutionForm((f) => ({ ...f, resolution: e.target.value }))}
                    />
                  </div>
                  <button className="btn-primary" onClick={handleResolutionSubmit}>
                    Сохранить решение
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">История событий</h3>
            <ol className="relative border-l border-gray-200 space-y-6 ml-2">
              {timeline.map((event, i) => {
                const Icon = event.icon;
                return (
                  <li key={i} className="ml-5">
                    <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ${event.color}`}>
                      <Icon size={12} />
                    </span>
                    <p className="text-sm font-medium text-gray-900">{event.event}</p>
                    <time className="text-xs text-gray-400 mt-0.5 block">{event.date}</time>
                  </li>
                );
              })}
              {['resolved', 'closed'].includes(selectedClaim.status) && (
                <li className="ml-5">
                  <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full text-green-600 bg-green-50">
                    <CheckCircle size={12} />
                  </span>
                  <p className="text-sm font-medium text-gray-900">{STATUS_LABELS[selectedClaim.status] ?? selectedClaim.status}</p>
                  <time className="text-xs text-gray-400 mt-0.5 block">{new Date().toISOString().slice(0, 10)}</time>
                </li>
              )}
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Рекламации</h1>
          <p className="text-sm text-gray-500 mt-0.5">Управление претензиями и жалобами</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowNewModal(true)}>
          <Plus size={16} />
          Новая рекламация
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={AlertTriangle} label="Открытых" value={openCount} color="yellow" />
        <StatCard icon={Clock} label="На рассмотрении" value={inReviewCount} color="blue" />
        <StatCard icon={CheckCircle} label="Решено" value={resolvedCount} color="green" />
        <StatCard icon={XCircle} label="Просрочено" value={overdueCount} color="red" />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Номер', 'Договор', 'Контрагент', 'Дата', 'Дедлайн', 'Описание', 'Статус', 'Ответственный', 'Действия'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {claims.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400">Нет данных</td>
                </tr>
              ) : (
                claims.map((claim) => {
                  const cp = getCounterparty(claim.counterpartyId);
                  const contract = getContract(claim.contractId);
                  const overdue = isClaimOverdue(claim);
                  return (
                    <tr
                      key={claim.id}
                      className={`${overdue ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors cursor-pointer`}
                      onClick={() => setSelectedClaim(claim)}
                    >
                      <td className="px-4 py-3 font-medium text-blue-600 whitespace-nowrap">{claim.number}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{contract?.number ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{cp?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{claim.date}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={overdue ? 'text-red-600 font-medium' : 'text-gray-700'}>{claim.deadline}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[220px] truncate" title={claim.description}>
                        {claim.description.length > 60 ? claim.description.slice(0, 60) + '...' : claim.description}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={claim.status} /></td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{claim.responsible || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={(e) => { e.stopPropagation(); setSelectedClaim(claim); }}
                        >
                          Открыть <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Claim */}
      <Modal
        isOpen={showNewModal}
        onClose={() => { setShowNewModal(false); setClaimForm(emptyClaimForm); }}
        title="Новая рекламация"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowNewModal(false)}>Отмена</button>
            <button className="btn-primary" onClick={handleNewClaimSubmit}>Создать</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Договор</label>
            <select
              className="form-input"
              value={claimForm.contractId}
              onChange={(e) => setClaimForm((f) => ({ ...f, contractId: e.target.value, shipmentId: '', specItemId: '' }))}
            >
              <option value="">— Выберите договор —</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.number} — {counterparties.find((cp) => cp.id === c.counterpartyId)?.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Отгрузка</label>
            <select
              className="form-input"
              value={claimForm.shipmentId}
              onChange={(e) => setClaimForm((f) => ({ ...f, shipmentId: e.target.value, specItemId: '' }))}
              disabled={!claimForm.contractId}
            >
              <option value="">— Выберите отгрузку —</option>
              {contractShipments.map((s) => (
                <option key={s.id} value={s.id}>{s.invoiceNumber} ({s.date})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Позиция спецификации</label>
            <select
              className="form-input"
              value={claimForm.specItemId}
              onChange={(e) => setClaimForm((f) => ({ ...f, specItemId: e.target.value }))}
              disabled={!claimForm.shipmentId}
            >
              <option value="">— Выберите позицию —</option>
              {shipmentItems.map((item, i) => (
                <option key={i} value={item.specItemId ?? i}>{item.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Описание</label>
            <textarea
              className="form-input resize-none"
              rows={3}
              placeholder="Опишите суть рекламации..."
              value={claimForm.description}
              onChange={(e) => setClaimForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="form-label">Ответственный</label>
            <select
              className="form-input"
              value={claimForm.responsible}
              onChange={(e) => setClaimForm((f) => ({ ...f, responsible: e.target.value }))}
            >
              <option value="">— Выберите —</option>
              {users.map((u) => (
                <option key={u.id} value={u.name}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pausePayments"
              checked={claimForm.pausePayments}
              onChange={(e) => setClaimForm((f) => ({ ...f, pausePayments: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="pausePayments" className="text-sm text-gray-700">Влияет на платежи (приостановить оплату)</label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
