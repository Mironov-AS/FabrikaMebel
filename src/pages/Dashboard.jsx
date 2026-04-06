import { useMemo } from 'react';
import {
  FileText, Package, DollarSign, AlertTriangle,
  Bell, MessageSquare, Activity, CheckCircle, Clock,
  TrendingUp, Users, ChevronRight,
} from 'lucide-react';
import useAppStore from '../store/appStore';
import { COUNTERPARTIES, formatMoney, ROLES } from '../data/mockData';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import Table from '../components/ui/Table';

// ─── Helpers ───────────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <h2 className="text-base font-semibold text-gray-800 mb-3">{children}</h2>
  );
}

function NotificationItem({ n }) {
  const borderColor = {
    warning: 'border-orange-400',
    info: 'border-blue-400',
    success: 'border-green-400',
  }[n.type] ?? 'border-gray-300';

  const bgColor = {
    warning: 'bg-orange-50',
    info: 'bg-blue-50',
    success: 'bg-green-50',
  }[n.type] ?? 'bg-gray-50';

  return (
    <div className={`flex gap-3 p-3 rounded-lg border-l-4 ${borderColor} ${bgColor}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.text}</p>
      </div>
      <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">{n.date}</span>
    </div>
  );
}

function OverdueObligationCard({ contract, obligation }) {
  const cp = COUNTERPARTIES.find(c => c.id === contract.counterpartyId);
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-orange-200 bg-orange-50">
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
}

// ─── Role-specific sections ─────────────────────────────────────────────────

function DirectorAnalystSection({ auditLog, notifications }) {
  const recentLog = useMemo(() => [...auditLog].reverse().slice(0, 5), [auditLog]);
  const topNotifications = useMemo(
    () => notifications.filter(n => !n.read).slice(0, 5),
    [notifications],
  );

  const auditColumns = [
    { key: 'user', label: 'Пользователь' },
    { key: 'action', label: 'Действие' },
    { key: 'date', label: 'Дата' },
  ];

  return (
    <div className="space-y-6">
      {/* Charts placeholder */}
      <div>
        <SectionTitle>Аналитика</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5 flex flex-col items-center justify-center h-40 gap-2">
            <TrendingUp size={32} className="text-blue-300" />
            <p className="text-sm text-gray-400">График динамики договоров</p>
            <span className="text-xs text-gray-300">— в разработке —</span>
          </div>
          <div className="card p-5 flex flex-col items-center justify-center h-40 gap-2">
            <DollarSign size={32} className="text-green-300" />
            <p className="text-sm text-gray-400">График поступления платежей</p>
            <span className="text-xs text-gray-300">— в разработке —</span>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <SectionTitle>Последние действия</SectionTitle>
        <Table columns={auditColumns} data={recentLog} />
      </div>

      {/* Notifications */}
      {topNotifications.length > 0 && (
        <div>
          <SectionTitle>Непрочитанные уведомления</SectionTitle>
          <div className="space-y-2">
            {topNotifications.map(n => (
              <NotificationItem key={n.id} n={n} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SalesSection({ contracts, orders, chatMessages }) {
  const recentChats = useMemo(
    () => [...chatMessages].reverse().slice(0, 5),
    [chatMessages],
  );

  return (
    <div className="space-y-6">
      {/* Recent chat messages */}
      <div>
        <SectionTitle>Последние сообщения</SectionTitle>
        <div className="card divide-y divide-gray-100">
          {recentChats.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Нет сообщений</p>
          )}
          {recentChats.map(msg => {
            const contract = contracts.find(c => c.id === msg.contractId);
            const cp = COUNTERPARTIES.find(c => c.id === msg.counterpartyId);
            return (
              <div key={msg.id} className="flex items-start gap-3 px-4 py-3">
                <MessageSquare size={15} className={`mt-0.5 flex-shrink-0 ${msg.from === 'client' ? 'text-blue-500' : 'text-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-gray-700">{msg.author}</span>
                    {contract && (
                      <span className="text-xs text-gray-400">{contract.number}</span>
                    )}
                    {cp && (
                      <span className="text-xs text-blue-500">{cp.name}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{msg.text}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{msg.date}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active contracts quick list */}
      <div>
        <SectionTitle>Активные договоры</SectionTitle>
        <div className="card divide-y divide-gray-100">
          {contracts.filter(c => c.status === 'active').map(c => {
            const cp = COUNTERPARTIES.find(p => p.id === c.counterpartyId);
            return (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.number}</p>
                  <p className="text-xs text-gray-500">{cp?.name ?? '—'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700">{formatMoney(c.amount)}</span>
                  <StatusBadge status={c.status} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AccountantSection({ payments, contracts }) {
  const paymentColumns = [
    { key: 'invoiceNumber', label: 'Счёт' },
    {
      key: 'counterpartyId',
      label: 'Контрагент',
      render: (val) => COUNTERPARTIES.find(c => c.id === val)?.name ?? '—',
    },
    { key: 'amount', label: 'Сумма', render: (val) => formatMoney(val) },
    { key: 'dueDate', label: 'Срок оплаты' },
    { key: 'paidDate', label: 'Дата оплаты', render: (val) => val ?? '—' },
    { key: 'status', label: 'Статус', render: (val) => <StatusBadge status={val} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Платежи</SectionTitle>
        <Table columns={paymentColumns} data={payments} />
      </div>
    </div>
  );
}

function ProductionSection({ productionTasks, orders }) {
  const byStatus = useMemo(() => {
    const inProgress = productionTasks.filter(t => t.status === 'in_progress');
    const planned = productionTasks.filter(t => t.status === 'planned');
    const done = productionTasks.filter(t => t.status === 'completed');
    return { inProgress, planned, done };
  }, [productionTasks]);

  const taskColumns = [
    { key: 'name', label: 'Задача' },
    { key: 'orderNumber', label: 'Заказ' },
    { key: 'responsible', label: 'Ответственный' },
    { key: 'end', label: 'Срок' },
    {
      key: 'progress',
      label: 'Прогресс',
      render: (val) => (
        <div className="flex items-center gap-2">
          <div className="w-24 bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full"
              style={{ width: `${val}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{val}%</span>
        </div>
      ),
    },
    { key: 'status', label: 'Статус', render: (val) => <StatusBadge status={val} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div>
        <SectionTitle>Сводка производства</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Activity size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">В работе</p>
              <p className="text-xl font-bold text-gray-900">{byStatus.inProgress.length}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-50">
              <Clock size={18} className="text-gray-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Запланировано</p>
              <p className="text-xl font-bold text-gray-900">{byStatus.planned.length}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50">
              <CheckCircle size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Завершено</p>
              <p className="text-xl font-bold text-gray-900">{byStatus.done.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tasks table */}
      <div>
        <SectionTitle>Производственные задачи</SectionTitle>
        <Table columns={taskColumns} data={productionTasks} />
      </div>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const {
    currentUser,
    contracts,
    orders,
    payments,
    notifications,
    auditLog,
    productionTasks,
    chatMessages,
  } = useAppStore();

  const role = currentUser?.role;

  // ── KPI computations ──
  const activeContracts = useMemo(
    () => contracts.filter(c => c.status === 'active').length,
    [contracts],
  );
  const ordersInProduction = useMemo(
    () => orders.filter(o => o.status === 'in_production').length,
    [orders],
  );
  const receivableDebt = useMemo(
    () => payments.filter(p => p.status !== 'paid').reduce((sum, p) => sum + p.amount, 0),
    [payments],
  );
  const overduePayments = useMemo(
    () => payments.filter(p => p.status === 'overdue').length,
    [payments],
  );

  // ── Overdue obligations ──
  const overdueObligations = useMemo(() => {
    const result = [];
    contracts.forEach(c => {
      (c.obligations ?? []).forEach(o => {
        if (o.status === 'overdue') result.push({ contract: c, obligation: o });
      });
    });
    return result;
  }, [contracts]);

  // ── KPI cards per role ──
  const isDirectorLike = [ROLES.DIRECTOR, ROLES.ANALYST, ROLES.ADMIN].includes(role);
  const isSales = role === ROLES.SALES_MANAGER;
  const isAccountant = role === ROLES.ACCOUNTANT;
  const isProduction = [ROLES.PRODUCTION_HEAD, ROLES.PRODUCTION_SPECIALIST].includes(role);

  const showAllKpis = isDirectorLike;
  const showContractsKpi = isDirectorLike || isSales;
  const showOrdersKpi = isDirectorLike || isSales;
  const showDebtKpi = isDirectorLike || isAccountant;
  const showOverdueKpi = isDirectorLike || isAccountant;

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Главная</h1>
        {currentUser && (
          <p className="text-sm text-gray-500 mt-0.5">
            Добро пожаловать, {currentUser.name}
          </p>
        )}
      </div>

      {/* KPI stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {showContractsKpi && (
          <StatCard
            icon={FileText}
            label="Активные договоры"
            value={activeContracts}
            color="blue"
          />
        )}
        {showOrdersKpi && (
          <StatCard
            icon={Package}
            label="Заказов в работе"
            value={ordersInProduction}
            color="green"
          />
        )}
        {showDebtKpi && (
          <StatCard
            icon={DollarSign}
            label="Дебиторская задолженность"
            value={formatMoney(receivableDebt)}
            color="yellow"
          />
        )}
        {showOverdueKpi && (
          <StatCard
            icon={AlertTriangle}
            label="Просроченных платежей"
            value={overduePayments}
            color="red"
          />
        )}
      </div>

      {/* Overdue obligations warning */}
      {overdueObligations.length > 0 && (
        <div>
          <SectionTitle>Просроченные обязательства</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overdueObligations.map(({ contract, obligation }) => (
              <OverdueObligationCard
                key={`${contract.id}-${obligation.id}`}
                contract={contract}
                obligation={obligation}
              />
            ))}
          </div>
        </div>
      )}

      {/* Role-specific content */}
      {isDirectorLike && (
        <DirectorAnalystSection
          auditLog={auditLog}
          notifications={notifications}
        />
      )}

      {isSales && (
        <SalesSection
          contracts={contracts}
          orders={orders}
          chatMessages={chatMessages}
        />
      )}

      {isAccountant && (
        <AccountantSection
          payments={payments}
          contracts={contracts}
        />
      )}

      {isProduction && (
        <ProductionSection
          productionTasks={productionTasks}
          orders={orders}
        />
      )}

      {/* Guest / unknown role fallback */}
      {!isDirectorLike && !isSales && !isAccountant && !isProduction && (
        <div className="card p-8 text-center">
          <Users size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Нет данных для отображения в вашей роли.</p>
        </div>
      )}
    </div>
  );
}
