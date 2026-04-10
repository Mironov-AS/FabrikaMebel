import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FileText, Home } from 'lucide-react';
import useAppStore from '../../store/appStore';
import { SERVICES, ALL_NAV_ITEMS } from '../../data/services';

export default function Sidebar() {
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
    <aside className="flex flex-col fixed left-0 top-0 h-screen w-60 bg-white border-r border-gray-200 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <FileText size={16} className="text-white" />
        </div>
        <span className="text-lg font-bold text-blue-600 tracking-tight">ContractPro</span>
      </div>

      {/* Service badge + Home button */}
      {service && (
        <div className={`mx-3 mt-3 mb-1 px-3 py-2 rounded-xl ${service.lightBg} border ${service.borderColor} flex items-center gap-2`}>
          <service.icon size={15} className={service.textColor} />
          <span className={`text-xs font-semibold truncate flex-1 ${service.textColor}`}>{service.name}</span>
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

      {/* Home button */}
      <div className="border-t border-gray-100 p-3">
        <button
          onClick={goHome}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
        >
          <Home size={16} className="text-gray-400" />
          <span>На главную</span>
        </button>
      </div>
    </aside>
  );
}
