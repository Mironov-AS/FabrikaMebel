import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Lock, User, ShieldCheck, Smartphone, Eye, EyeOff, KeyRound, ArrowLeft } from 'lucide-react';
import useAppStore from '../store/appStore';
import { authApi } from '../services/api';

const ROLE_LABELS = {
  admin: 'Системный администратор',
  sales_manager: 'Менеджер по продажам',
  accountant: 'Бухгалтер',
  production_specialist: 'Специалист производства',
  production_head: 'Начальник производства',
  analyst: 'Аналитик',
  director: 'Директор',
  guest: 'Гость',
};

// Steps: 'login' | 'mfa' | 'mfa_setup' | 'forgot' | 'reset_confirm'
export default function LoginPage() {
  const { login, completeMfa, enableMfa } = useAppStore();
  const navigate = useNavigate();

  const [step, setStep] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [mfaPending, setMfaPending] = useState(null);
  const [qrCode, setQrCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [generatedResetToken, setGeneratedResetToken] = useState('');

  const goToLogin = () => { setStep('login'); setError(''); setInfo(''); };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.requiresMfaSetup) {
        setMfaToken(result.mfaToken);
        setMfaPending(result);
        const setupRes = await authApi.setupMfa(result.mfaToken);
        setQrCode(setupRes.data.qrCode);
        setMfaSecret(setupRes.data.secret);
        setStep('mfa_setup');
      } else if (result.requiresMfa) {
        setMfaToken(result.mfaToken);
        setMfaPending(result);
        setStep('mfa');
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  // ── MFA verify ────────────────────────────────────────────────────────────
  const handleMfaVerify = async (e) => {
    e.preventDefault();
    if (!mfaCode.trim()) { setError('Введите код'); return; }
    setError('');
    setLoading(true);
    try {
      await completeMfa(mfaToken, mfaCode.trim());
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Неверный код');
      setMfaCode('');
    } finally {
      setLoading(false);
    }
  };

  // ── MFA enable ────────────────────────────────────────────────────────────
  const handleMfaEnable = async (e) => {
    e.preventDefault();
    if (!mfaCode.trim()) { setError('Введите код из приложения'); return; }
    setError('');
    setLoading(true);
    try {
      await enableMfa(mfaToken, mfaCode.trim());
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Неверный код');
      setMfaCode('');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password — request token ───────────────────────────────────────
  const handleForgotRequest = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.resetPasswordRequest(forgotEmail);
      // In a real system, the token would be emailed; here it's returned directly
      if (res.data.resetToken) {
        setGeneratedResetToken(res.data.resetToken);
        setResetToken(res.data.resetToken);   // pre-fill for convenience
      }
      setInfo(res.data.message || 'Токен создан.');
      setStep('reset_confirm');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка запроса сброса пароля');
    } finally {
      setLoading(false);
    }
  };

  // ── Reset password — confirm ───────────────────────────────────────────────
  const handleResetConfirm = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    if (newPassword.length < 8) {
      setError('Пароль должен содержать не менее 8 символов');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.resetPasswordConfirm(resetToken, newPassword);
      setInfo(res.data.message || 'Пароль изменён.');
      setStep('login');
      setEmail(forgotEmail);
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сброса пароля');
    } finally {
      setLoading(false);
    }
  };

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

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* ── Step: Login ── */}
          {step === 'login' && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Вход в систему</h2>
              {info && <p className="text-green-600 text-sm mb-4 bg-green-50 rounded-lg px-3 py-2">{info}</p>}
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
                      className="input pl-9 pr-10"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-base disabled:opacity-60">
                  {loading ? 'Вход...' : 'Войти'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('forgot'); setForgotEmail(email); setError(''); setInfo(''); }}
                  className="w-full text-sm text-blue-600 hover:text-blue-800 text-center"
                >
                  Забыли пароль?
                </button>
              </form>
            </>
          )}

          {/* ── Step: MFA Code ── */}
          {step === 'mfa' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Двухфакторная аутентификация</h2>
                  <p className="text-sm text-gray-500">{mfaPending?.user?.name}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Введите 6-значный код из приложения аутентификатора (Google Authenticator, Authy и т.п.)
              </p>
              <form onSubmit={handleMfaVerify} className="space-y-4">
                <div>
                  <label className="label">Код подтверждения</label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      className="input pl-9 text-center text-xl tracking-widest font-mono"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={mfaCode}
                      onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      autoFocus
                    />
                  </div>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button type="submit" disabled={loading || mfaCode.length !== 6} className="btn-primary w-full py-2.5 disabled:opacity-60">
                  {loading ? 'Проверка...' : 'Подтвердить'}
                </button>
                <button type="button" onClick={goToLogin} className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Вернуться ко входу
                </button>
              </form>
            </>
          )}

          {/* ── Step: MFA Setup ── */}
          {step === 'mfa_setup' && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Настройка MFA</h2>
                  <p className="text-sm text-gray-500">Для роли {ROLE_LABELS[mfaPending?.user?.role]}</p>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Для защиты аккаунта требуется двухфакторная аутентификация. Выполните следующие шаги:
                </p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex gap-2 text-sm"><span className="font-bold text-blue-600 w-5">1.</span><span>Установите <strong>Google Authenticator</strong>, <strong>Authy</strong> или аналог</span></div>
                  <div className="flex gap-2 text-sm"><span className="font-bold text-blue-600 w-5">2.</span><span>Отсканируйте QR-код или введите ключ вручную</span></div>
                  <div className="flex gap-2 text-sm"><span className="font-bold text-blue-600 w-5">3.</span><span>Введите 6-значный код из приложения</span></div>
                </div>
                {qrCode && (
                  <div className="flex flex-col items-center gap-3">
                    <img src={qrCode} alt="QR Code" className="w-40 h-40 border rounded-lg" />
                    <div className="text-xs text-gray-500 text-center">
                      <span className="block mb-1">Или введите ключ вручную:</span>
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono break-all">{mfaSecret}</code>
                    </div>
                  </div>
                )}
                <form onSubmit={handleMfaEnable} className="space-y-3">
                  <div>
                    <label className="label">Код из приложения</label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input
                        className="input pl-9 text-center text-xl tracking-widest font-mono"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={mfaCode}
                        onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        autoFocus
                      />
                    </div>
                  </div>
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <button type="submit" disabled={loading || mfaCode.length !== 6} className="btn-primary w-full py-2.5 disabled:opacity-60">
                    {loading ? 'Активация...' : 'Активировать MFA и войти'}
                  </button>
                  <button type="button" onClick={goToLogin} className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
                    <ArrowLeft className="w-3 h-3" /> Вернуться ко входу
                  </button>
                </form>
              </div>
            </>
          )}

          {/* ── Step: Forgot password ── */}
          {step === 'forgot' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-yellow-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Сброс пароля</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Введите email вашей учётной записи. Будет создан токен для сброса пароля.
              </p>
              <form onSubmit={handleForgotRequest} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      className="input pl-9"
                      type="email"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="user@company.ru"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 disabled:opacity-60">
                  {loading ? 'Создание токена...' : 'Получить токен сброса'}
                </button>
                <button type="button" onClick={goToLogin} className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Вернуться ко входу
                </button>
              </form>
            </>
          )}

          {/* ── Step: Reset confirm ── */}
          {step === 'reset_confirm' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-yellow-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Новый пароль</h2>
              </div>

              {generatedResetToken && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-700 font-medium mb-1">Токен сброса (в продакшне отправляется на email):</p>
                  <code className="text-xs font-mono break-all text-blue-900 select-all">{generatedResetToken}</code>
                </div>
              )}

              <form onSubmit={handleResetConfirm} className="space-y-4">
                <div>
                  <label className="label">Токен сброса</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      className="input pl-9 font-mono text-sm"
                      type="text"
                      value={resetToken}
                      onChange={e => setResetToken(e.target.value)}
                      placeholder="Вставьте токен из email"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Новый пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      className="input pl-9 pr-10"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Минимум 8 символов"
                      required
                      minLength={8}
                    />
                    <button type="button" onClick={() => setShowNewPassword(v => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Повторите пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      className="input pl-9"
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 disabled:opacity-60">
                  {loading ? 'Сохранение...' : 'Установить новый пароль'}
                </button>
                <button type="button" onClick={goToLogin} className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Вернуться ко входу
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
