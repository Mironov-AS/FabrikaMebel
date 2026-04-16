import { useState } from 'react';
import { Users, Settings, Shield, Plug, BrainCircuit } from 'lucide-react';
import UsersTab from './tabs/UsersTab';
import SettingsTab from './tabs/SettingsTab';
import AuditTab from './tabs/AuditTab';
import IntegrationsTab from './tabs/IntegrationsTab';
import LLMTab from './tabs/LLMTab';

const TABS = [
  { key: 'users',        label: 'Пользователи',       icon: Users,       component: UsersTab },
  { key: 'settings',     label: 'Настройки системы',  icon: Settings,    component: SettingsTab },
  { key: 'audit',        label: 'Безопасность и аудит', icon: Shield,    component: AuditTab },
  { key: 'integrations', label: 'Интеграции',          icon: Plug,        component: IntegrationsTab },
  { key: 'llm',          label: 'ИИ-модели',           icon: BrainCircuit, component: LLMTab },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users');
  const ActiveComponent = TABS.find(t => t.key === activeTab)?.component ?? UsersTab;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Панель администратора</h1>
        <p className="text-sm text-gray-500 mt-0.5">Управление пользователями, настройки и аудит</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <ActiveComponent />
    </div>
  );
}
