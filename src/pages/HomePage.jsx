import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { SERVICES } from '../data/services';
import useAppStore from '../store/appStore';

export default function HomePage() {
  const navigate = useNavigate();
  const setService = useAppStore(s => s.setService);
  const clearService = useAppStore(s => s.clearService);

  useEffect(() => {
    clearService();
  }, []);

  function handleSelect(service) {
    setService(service.id);
    navigate(service.defaultPath);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-8 py-5 border-b border-white/60 bg-white/70 backdrop-blur-sm">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
          <FileText size={18} className="text-white" />
        </div>
        <span className="text-xl font-bold text-blue-700 tracking-tight">ContractPro</span>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Выберите рабочее место</h1>
            <p className="text-gray-500 text-base">Перейдите в нужный сервис для работы</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {SERVICES.map((service) => {
              const Icon = service.icon;
              return (
                <button
                  key={service.id}
                  onClick={() => handleSelect(service)}
                  className={`
                    group relative flex flex-col items-center gap-3 p-6 rounded-2xl
                    border-2 ${service.borderColor} ${service.lightBg}
                    hover:shadow-lg hover:-translate-y-0.5
                    transition-all duration-200 cursor-pointer text-left
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  `}
                >
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${service.gradientClass} flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow`}>
                    <Icon size={26} className="text-white" />
                  </div>
                  <div className="text-center">
                    <p className={`font-semibold text-sm ${service.textColor} leading-tight`}>
                      {service.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 leading-snug">{service.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-xs text-gray-400">
        ContractPro — система управления договорами и производством
      </footer>
    </div>
  );
}
