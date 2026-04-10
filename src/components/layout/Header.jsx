import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, X, LogOut, User } from 'lucide-react';
import useAppStore from '../../store/appStore';

const ROUTE_TITLES = {
  '/dashboard':  'Dashboard',
  '/contracts':  'Договоры',
  '/orders':     'Заказы',
  '/production': 'Производство',
  '/shipments':  'Отгрузки',
  '/payments':   'Платежи',
  '/claims':     'Рекламации',
  '/reports':    'Отчёты',
  '/chat':       'Чат',
  '/admin':      'Администрирование',
};

function getTitle(pathname) {
  const match = Object.keys(ROUTE_TITLES).find(
    (key) => pathname === key || pathname.startsWith(key + '/')
  );
  return match ? ROUTE_TITLES[match] : 'ContractPro';
}

function formatDate(date) {
  return date.toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function Header() {
  const { notifications, markAllRead, logout, currentUser } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const unread = notifications.filter((n) => !n.read).length;
  const title = getTitle(location.pathname);

  function toggleDropdown() {
    setOpen((v) => !v);
    if (!open && unread > 0) markAllRead();
  }

  return (
    <header className="fixed top-0 left-60 right-0 h-14 bg-white border-b border-gray-200 z-20 flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400 capitalize hidden sm:block">
          {formatDate(new Date())}
        </span>

        {/* Current user */}
        {currentUser && (
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
            <User size={15} className="text-gray-400" />
            <span className="font-medium">{currentUser.name}</span>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Выйти"
          className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={18} />
        </button>

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={toggleDropdown}
            className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Уведомления"
          >
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="font-semibold text-sm text-gray-800">Уведомления</span>
                  <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={16} />
                  </button>
                </div>
                <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <li className="px-4 py-6 text-center text-sm text-gray-400">Нет уведомлений</li>
                  ) : (
                    notifications.map((n) => (
                      <li key={n.id} className={`px-4 py-3 text-sm ${n.read ? 'text-gray-500' : 'text-gray-800 bg-blue-50/40'}`}>
                        <p className="font-medium">{n.title ?? n.message ?? n.text ?? 'Уведомление'}</p>
                        {n.body && <p className="text-xs text-gray-400 mt-0.5">{n.body}</p>}
                        {n.time && <p className="text-xs text-gray-300 mt-1">{n.time}</p>}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
