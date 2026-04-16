import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FileText, Home, ChevronLeft, ChevronRight } from 'lucide-react';
import useAppStore from '../../store/appStore';
import { SERVICES, ALL_NAV_ITEMS } from '../../data/services';

export default function Sidebar({ isCollapsed, onToggle }) {
  const currentServiceId = useAppStore(s => s.currentService);
  const clearService = useAppStore(s => s.clearService);
  const location = useLocation();
  const navigate = useNavigate();

  const service = SERVICES.find(s => s.id === currentServiceId);
  const visibleItems = service
    ? ALL_NAV_ITEMS.filter(item => service.navPaths.includes(item.path))
    : ALL_NAV_ITEMS;

  function goHome() {
    clearService();
    navigate('/');
  }

  return (
    <aside
      className={`flex flex-col fixed left-0 top-0 h-screen bg-white border-r border-gray-200 z-30 transition-all duration-300 ${
        isCollapsed ? 'w-14' : 'w-60'
      }`}
    >
      {/* Logo */}
      <button
        onClick={goHome}
        className="flex items-center gap-2 px-3 py-4 border-b border-gray-100 hover:bg-blue-50 transition-colors w-full text-left overflow-hidden"
        title={isCollapsed ? 'ContractPro' : undefined}
      >
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <FileText size={16} className="text-white" />
        </div>
        {!isCollapsed && (
          <span className="text-lg font-bold text-blue-600 tracking-tight whitespace-nowrap">ContractPro</span>
        )}
      </button>

      {/* Service badge */}
      {service && (
        <div
          className={`mx-2 mt-3 mb-1 rounded-xl border flex items-center overflow-hidden transition-all duration-300 ${service.lightBg} ${service.borderColor} ${
            isCollapsed ? 'px-2 py-2 justify-center' : 'px-3 py-2 gap-2'
          }`}
          title={isCollapsed ? service.name : undefined}
        >
          <service.icon size={15} className={`${service.textColor} shrink-0`} />
          {!isCollapsed && (
            <span className={`text-xs font-semibold truncate flex-1 ${service.textColor}`}>{service.name}</span>
          )}
        </div>
      )}

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
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center rounded-lg text-sm font-medium transition-colors overflow-hidden ${
                    isCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon size={18} className={`shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Home + Toggle button */}
      <div className="border-t border-gray-100 p-2 flex flex-col gap-1">
        <button
          onClick={goHome}
          title={isCollapsed ? 'На главную' : undefined}
          className={`w-full flex items-center rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors ${
            isCollapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2'
          }`}
        >
          <Home size={16} className="text-gray-400 shrink-0" />
          {!isCollapsed && <span>На главную</span>}
        </button>

        <button
          onClick={onToggle}
          title={isCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
          className={`w-full flex items-center rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors ${
            isCollapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2'
          }`}
        >
          {isCollapsed
            ? <ChevronRight size={16} className="shrink-0" />
            : (
              <>
                <ChevronLeft size={16} className="shrink-0" />
                <span>Свернуть</span>
              </>
            )
          }
        </button>
      </div>
    </aside>
  );
}
