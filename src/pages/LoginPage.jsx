import { useState } from 'react';
import { Building2, Lock, User } from 'lucide-react';
import useAppStore from '../store/appStore';
import { USERS, ROLE_LABELS } from '../data/mockData';

export default function LoginPage() {
  const login = useAppStore(s => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [showDemo, setShowDemo] = useState(true);

  const handleLogin = (e) => {
    e.preventDefault();
    const user = USERS.find(u => u.email === email);
    if (user && user.active) {
      login(user);
    } else {
      setError('Неверный email или пароль');
    }
  };

  const quickLogin = (user) => login(user);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-white">ContractPro</h1>
          <p className="text-blue-200 text-sm mt-1">Система управления договорами и производством</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Вход в систему</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  className="input pl-9"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@company.ru"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Пароль</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  className="input pl-9"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" className="btn-primary w-full py-2.5 text-base">
              Войти
            </button>
          </form>

          {/* Demo quick login */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={() => setShowDemo(!showDemo)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {showDemo ? '▲' : '▼'} Демо-доступ (выбор роли)
            </button>
            {showDemo && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {USERS.map(u => (
                  <button
                    key={u.id}
                    onClick={() => quickLogin(u)}
                    className="text-left p-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div className="text-xs font-medium text-gray-800 truncate">{u.name}</div>
                    <div className="text-xs text-gray-500">{ROLE_LABELS[u.role]}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
