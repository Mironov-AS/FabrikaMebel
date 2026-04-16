import { useState } from 'react';
import { Plus, Pencil, Trash2, Lock, Ban, CheckCircle } from 'lucide-react';
import useAppStore from '../../../store/appStore';
import { ROLES, ROLE_LABELS } from '../../../data/mockData';
import StatusBadge from '../../../components/ui/StatusBadge';
import Modal from '../../../components/ui/Modal';

const emptyUserForm = { name: '', email: '', role: ROLES.SALES_MANAGER, password: '' };

function validateUserForm(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Введите имя';
  if (!form.email.trim()) {
    errors.email = 'Введите email';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Некорректный формат email';
  }
  if (!form.password) {
    errors.password = 'Введите пароль';
  } else if (form.password.length < 8) {
    errors.password = 'Пароль должен содержать не менее 8 символов';
  }
  return errors;
}

export default function UsersTab() {
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editRoleModal, setEditRoleModal] = useState(null);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [userFormErrors, setUserFormErrors] = useState({});
  const [editRoleValue, setEditRoleValue] = useState('');
  const [resetPasswordModal, setResetPasswordModal] = useState(null);
  const [resetPasswordResult, setResetPasswordResult] = useState(null);

  const { users, addUser, updateUser, deleteUser } = useAppStore();

  function handleAddUser() {
    const errors = validateUserForm(userForm);
    if (Object.keys(errors).length > 0) { setUserFormErrors(errors); return; }
    addUser({ name: userForm.name.trim(), email: userForm.email.trim(), role: userForm.role, password: userForm.password });
    setUserForm(emptyUserForm);
    setUserFormErrors({});
    setShowAddUserModal(false);
  }

  function handleEditRoleSubmit() {
    if (!editRoleModal) return;
    updateUser(editRoleModal.id, { role: editRoleValue });
    setEditRoleModal(null);
  }

  function handleResetPasswordGenerate() {
    const token = Math.random().toString(36).slice(2, 18) + Math.random().toString(36).slice(2, 18);
    setResetPasswordResult(token);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => { setUserForm(emptyUserForm); setShowAddUserModal(true); }}
        >
          <Plus size={16} />
          Добавить пользователя
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Имя', 'Email', 'Роль', 'Статус', 'Последний вход', 'Действия'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{user.name}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{user.email}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{ROLE_LABELS[user.role] ?? user.role}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={user.active ? 'active' : 'suspended'} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{user.lastLogin ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button
                        title="Изменить роль"
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        onClick={() => { setEditRoleModal(user); setEditRoleValue(user.role); }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        title={user.active ? 'Заблокировать' : 'Разблокировать'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          user.active
                            ? 'text-gray-400 hover:bg-red-50 hover:text-red-600'
                            : 'text-green-500 hover:bg-green-50 hover:text-green-700'
                        }`}
                        onClick={() => updateUser(user.id, { active: !user.active })}
                      >
                        {user.active ? <Ban size={14} /> : <CheckCircle size={14} />}
                      </button>
                      <button
                        title="Сбросить пароль"
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-yellow-50 hover:text-yellow-600 transition-colors"
                        onClick={() => { setResetPasswordModal(user); setResetPasswordResult(null); }}
                      >
                        <Lock size={14} />
                      </button>
                      <button
                        title="Удалить"
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        onClick={() => deleteUser(user.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showAddUserModal}
        onClose={() => { setShowAddUserModal(false); setUserForm(emptyUserForm); setUserFormErrors({}); }}
        title="Добавить пользователя"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setShowAddUserModal(false); setUserFormErrors({}); }}>Отмена</button>
            <button className="btn-primary" onClick={handleAddUser}>Создать</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Имя <span className="text-red-500">*</span></label>
            <input
              type="text"
              className={`form-input${userFormErrors.name ? ' border-red-400 focus:ring-red-400' : ''}`}
              placeholder="Иванов И.И."
              value={userForm.name}
              onChange={(e) => { setUserForm((f) => ({ ...f, name: e.target.value })); setUserFormErrors((er) => ({ ...er, name: '' })); }}
            />
            {userFormErrors.name && <p className="text-red-500 text-xs mt-1">{userFormErrors.name}</p>}
          </div>
          <div>
            <label className="form-label">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              className={`form-input${userFormErrors.email ? ' border-red-400 focus:ring-red-400' : ''}`}
              placeholder="user@company.ru"
              value={userForm.email}
              onChange={(e) => { setUserForm((f) => ({ ...f, email: e.target.value })); setUserFormErrors((er) => ({ ...er, email: '' })); }}
            />
            {userFormErrors.email && <p className="text-red-500 text-xs mt-1">{userFormErrors.email}</p>}
          </div>
          <div>
            <label className="form-label">Роль</label>
            <select
              className="form-input"
              value={userForm.role}
              onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
            >
              {Object.entries(ROLES).map(([, value]) => (
                <option key={value} value={value}>{ROLE_LABELS[value]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Пароль <span className="text-red-500">*</span></label>
            <input
              type="password"
              className={`form-input${userFormErrors.password ? ' border-red-400 focus:ring-red-400' : ''}`}
              placeholder="Минимум 8 символов"
              value={userForm.password}
              onChange={(e) => { setUserForm((f) => ({ ...f, password: e.target.value })); setUserFormErrors((er) => ({ ...er, password: '' })); }}
            />
            {userFormErrors.password && <p className="text-red-500 text-xs mt-1">{userFormErrors.password}</p>}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!editRoleModal}
        onClose={() => setEditRoleModal(null)}
        title={`Изменить роль — ${editRoleModal?.name ?? ''}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditRoleModal(null)}>Отмена</button>
            <button className="btn-primary" onClick={handleEditRoleSubmit}>Сохранить</button>
          </>
        }
      >
        <div>
          <label className="form-label">Роль</label>
          <select
            className="form-input"
            value={editRoleValue}
            onChange={(e) => setEditRoleValue(e.target.value)}
          >
            {Object.entries(ROLES).map(([, value]) => (
              <option key={value} value={value}>{ROLE_LABELS[value]}</option>
            ))}
          </select>
        </div>
      </Modal>

      <Modal
        isOpen={!!resetPasswordModal}
        onClose={() => { setResetPasswordModal(null); setResetPasswordResult(null); }}
        title={`Сброс пароля — ${resetPasswordModal?.name ?? ''}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setResetPasswordModal(null); setResetPasswordResult(null); }}>
              Закрыть
            </button>
            {!resetPasswordResult && (
              <button className="btn-primary flex items-center gap-2" onClick={handleResetPasswordGenerate}>
                <Lock size={14} />
                Создать токен сброса
              </button>
            )}
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Будет создан одноразовый токен сброса пароля для пользователя <strong>{resetPasswordModal?.email}</strong>.
            В продакшне токен отправляется на email пользователя.
          </p>
          {resetPasswordResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
              <p className="text-sm text-green-700 font-medium flex items-center gap-1.5">
                <CheckCircle size={15} /> Токен сброса создан
              </p>
              <p className="text-xs text-gray-500">Отправьте пользователю следующий токен:</p>
              <code className="block text-xs font-mono bg-white border border-green-200 rounded px-2 py-1.5 break-all select-all">
                {resetPasswordResult}
              </code>
              <p className="text-xs text-gray-400">Токен действителен 1 час.</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
