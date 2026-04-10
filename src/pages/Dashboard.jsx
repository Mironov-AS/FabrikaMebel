import { useMemo } from 'react';
import {
  FileText, Package, DollarSign, AlertTriangle,
  MessageSquare, Activity, CheckCircle, Clock, TrendingUp,
} from 'lucide-react';
import useAppStore from '../store/appStore';
import { formatMoney } from '../data/mockData';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import Table from '../components/ui/Table';

function SectionTitle({ children }) {
  return <h2 className="text-base font-semibold text-gray-800 mb-3">{children}</h2>;
}

export default function Dashboard() {
  const {
    contracts, orders, payments, notifications,
    auditLog, productionTasks, chatMessages, counterparties,
  } = useAppStore();

  const activeContracts = useMemo(() => contracts.filter(c => c.status === 'active').length, [contracts]);
  const ordersInProduction = useMemo(() => orders.filter(o => o.status === 'in_production').length, [orders]);
  const receivableDebt = useMemo(
    () => payments.filter(p => p.status !== 'paid').reduce((sum, p) => sum + p.amount, 0),
    [payments],
  );
  const overduePayments = useMemo(() => payments.filter(p => p.status === 'overdue').length, [payments]);

  const inProgressTasks = useMemo(() => productionTasks.filter(t => t.status === 'in_progress').length, [productionTasks]);
  const plannedTasks = useMemo(() => productionTasks.filter(t => t.status === 'planned').length, [productionTasks]);
  const completedTasks = useMemo(() => productionTasks.filter(t => t.status === 'completed').length, [productionTasks]);

  const recentLog = useMemo(() => [...auditLog].reverse().slice(0, 5), [auditLog]);
  const recentChats = useMemo(() => [...chatMessages].reverse().slice(0, 4), [chatMessages]);
  const unreadNotifications = useMemo(() => notifications.filter(n => !n.read).slice(0, 5), [notifications]);

  const overdueObligations = useMemo(() => {
    const result = [];
    contracts.forEach(c => {
      (c.obligations ?? []).forEach(o => {
        if (o.status === 'overdue') result.push({ contract: c, obligation: o });
      });
    });
    return result;
  }, [contracts]);

  const auditColumns = [
    { key: 'user', label: 'Пользователь' },
    { key: 'action', label: 'Действие' },
    { key: 'date', label: 'Дата' },
  ];

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={FileText}      label="Активные договоры"         value={activeContracts}           color="blue" />
        <StatCard icon={Package}       label="Заказов в производстве"     value={ordersInProduction}        color="green" />
        <StatCard icon={DollarSign}    label="Дебиторская задолженность"  value={formatMoney(receivableDebt)} color="yellow" />
        <StatCard icon={AlertTriangle} label="Просроченных платежей"      value={overduePayments}           color="red" />
      </div>

      {/* Production summary */}
      <div>
        <SectionTitle>Производство</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Activity size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">В работе</p>
              <p className="text-xl font-bold text-gray-900">{inProgressTasks}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-50">
              <Clock size={18} className="text-gray-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Запланировано</p>
              <p className="text-xl font-bold text-gray-900">{plannedTasks}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50">
              <CheckCircle size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Завершено</p>
              <p className="text-xl font-bold text-gray-900">{completedTasks}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Overdue obligations */}
      {overdueObligations.length > 0 && (
        <div>
          <SectionTitle>Просроченные обязательства</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overdueObligations.map(({ contract, obligation }) => {
              const cp = counterparties.find(c => c.id === contract.counterpartyId);
              return (
                <div key={`${contract.id}-${obligation.id}`} className="flex items-start gap-3 p-3 rounded-lg border border-orange-200 bg-orange-50">
                  <AlertTriangle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {contract.number}
                      {cp && <span className="text-gray-500 font-normal"> — {cp.name}</span>}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{obligation.text}</p>
                    {obligation.deadline && (
                      <p className="text-xs text-orange-600 mt-1">Срок: {obligation.deadline}</p>
                    )}
                  </div>
                  <StatusBadge status={obligation.status} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent chat */}
        <div>
          <SectionTitle>Последние сообщения</SectionTitle>
          <div className="card divide-y divide-gray-100">
            {recentChats.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">Нет сообщений</p>
            ) : recentChats.map(msg => {
              const contract = contracts.find(c => c.id === msg.contractId);
              const cp = counterparties.find(c => c.id === msg.counterpartyId);
              return (
                <div key={msg.id} className="flex items-start gap-3 px-4 py-3">
                  <MessageSquare size={15} className={`mt-0.5 flex-shrink-0 ${msg.from === 'client' ? 'text-blue-500' : 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-gray-700">{msg.author}</span>
                      {contract && <span className="text-xs text-gray-400">{contract.number}</span>}
                      {cp && <span className="text-xs text-blue-500">{cp.name}</span>}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{msg.text}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{msg.date}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Analytics placeholder */}
        <div>
          <SectionTitle>Аналитика</SectionTitle>
          <div className="grid grid-cols-1 gap-4">
            <div className="card p-5 flex flex-col items-center justify-center h-40 gap-2">
              <TrendingUp size={32} className="text-blue-300" />
              <p className="text-sm text-gray-400">График динамики договоров</p>
              <span className="text-xs text-gray-300">— в разработке —</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      {recentLog.length > 0 && (
        <div>
          <SectionTitle>Последние действия</SectionTitle>
          <Table columns={auditColumns} data={recentLog} />
        </div>
      )}

      {/* Unread notifications */}
      {unreadNotifications.length > 0 && (
        <div>
          <SectionTitle>Непрочитанные уведомления</SectionTitle>
          <div className="space-y-2">
            {unreadNotifications.map(n => {
              const borderColor = { warning: 'border-orange-400', info: 'border-blue-400', success: 'border-green-400' }[n.type] ?? 'border-gray-300';
              const bgColor = { warning: 'bg-orange-50', info: 'bg-blue-50', success: 'bg-green-50' }[n.type] ?? 'bg-gray-50';
              return (
                <div key={n.id} className={`flex gap-3 p-3 rounded-lg border-l-4 ${borderColor} ${bgColor}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.text}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">{n.date}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
