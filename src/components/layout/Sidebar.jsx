import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, ShoppingCart, Factory,
  Truck, CreditCard, AlertCircle, BarChart3,
  MessageSquare, Settings, LogOut, User,
} from 'lucide-react';
import useAppStore from '../../store/appStore';
import { ROLE_LABELS } from '../../data/mockData';

const NAV_ITEMS = [
  { label: 'Dashboard',        icon: LayoutDashboard, path: '/dashboard',   roles: null },
  { label: 'Договоры',         icon: FileText,        path: '/contracts',   roles: ['admin','sales_manager','accountant','production_head','analyst','director','guest'] },
  { label: 'Заказы',           icon: ShoppingCart,    path: '/orders',      roles: ['admin','sales_manager','production_specialist','production_head','director','guest'] },
  { label: 'Производство',     icon: Factory,         path: '/production',  roles: ['production_specialist','production_head','admin','sales_manager','director'] },
  { label: 'Отгрузки',         icon: Truck,           path: '/shipments',   roles: ['admin','sales_manager','accountant','production_head','analyst','director','guest'] },
  { label: 'Платежи',          icon: CreditCard,      path: '/payments',    roles: ['accountant','admin','director','sales_manager'] },
  { label: 'Рекламации',       icon: AlertCircle,     path: '/claims',      roles: ['admin','sales_manager','accountant','production_specialist','production_head','analyst','director'] },
  { label: 'Отчёты',           icon: BarChart3,       path: '/reports',     roles: ['analyst','director','admin','accountant'] },
  { label: 'Чат',              icon: MessageSquare,   path: '/chat',        roles: ['sales_manager','admin','director'] },
  { label: 'Администрирование',icon: Settings,        path: '/admin',       roles: ['admin'] },
];

export default function Sidebar() {
  const { currentUser, logout } = useAppStore();
  const location = useLocation();

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles === null || (currentUser && item.roles.includes(currentUser.role))
  );

  return (
    <aside className="flex flex-col fixed left-0 top-0 h-screen w-60 bg-white border-r border-gray-200 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <FileText size={16} className="text-white" />
        </div>
        <span className="text-lg font-bold text-blue-600 tracking-tight">ContractPro</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <User size={15} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{currentUser?.name}</p>
            <p className="text-xs text-gray-500 truncate">{ROLE_LABELS[currentUser?.role] ?? currentUser?.role}</p>
          </div>
          <button
            onClick={logout}
            title="Выйти"
            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
