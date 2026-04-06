import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif;
    font-size: 11pt;
    color: #1a1a2e;
    line-height: 1.6;
  }

  /* ── COVER PAGE ── */
  .cover {
    width: 100%;
    height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    page-break-after: always;
    color: white;
    text-align: center;
    padding: 60px;
  }
  .cover-logo {
    width: 90px; height: 90px;
    background: linear-gradient(135deg, #e94560, #0f3460);
    border-radius: 20px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 30px;
    font-size: 40px;
  }
  .cover h1 { font-size: 36pt; font-weight: 800; letter-spacing: -1px; margin-bottom: 12px; }
  .cover h2 { font-size: 16pt; font-weight: 300; opacity: 0.8; margin-bottom: 40px; }
  .cover-divider { width: 80px; height: 3px; background: #e94560; margin: 0 auto 40px; }
  .cover-info { font-size: 10pt; opacity: 0.6; }

  /* ── TOC PAGE ── */
  .toc-page {
    padding: 60px 70px;
    page-break-after: always;
    min-height: 100vh;
  }
  .toc-page h2 { font-size: 22pt; font-weight: 700; color: #0f3460; margin-bottom: 30px; padding-bottom: 12px; border-bottom: 3px solid #e94560; }
  .toc-section { margin-bottom: 8px; }
  .toc-role { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 8px; margin-bottom: 4px; }
  .toc-role:hover { background: #f0f4ff; }
  .toc-role-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
  .toc-role-name { font-size: 12pt; font-weight: 600; flex: 1; }
  .toc-role-desc { font-size: 9.5pt; color: #666; }
  .toc-page-num { font-size: 10pt; color: #999; font-weight: 500; }
  .toc-intro { background: #f8faff; border-left: 4px solid #0f3460; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 30px; font-size: 10.5pt; color: #444; }

  /* ── SECTION HEADER ── */
  .section-header {
    padding: 50px 70px 40px;
    page-break-before: always;
    page-break-after: avoid;
  }
  .section-header .role-badge {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 8px 18px; border-radius: 30px; margin-bottom: 20px;
    font-size: 10pt; font-weight: 600; color: white;
  }
  .section-header h1 { font-size: 26pt; font-weight: 800; color: #1a1a2e; margin-bottom: 8px; }
  .section-header .subtitle { font-size: 12pt; color: #555; margin-bottom: 24px; }
  .section-header .access-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { padding: 4px 12px; border-radius: 20px; font-size: 9pt; font-weight: 500; background: #eef2ff; color: #3730a3; }

  /* ── BODY CONTENT ── */
  .content {
    padding: 0 70px 50px;
  }
  h2.section-title {
    font-size: 15pt; font-weight: 700; color: #0f3460;
    margin: 32px 0 14px;
    padding-bottom: 6px;
    border-bottom: 2px solid #e8ecf8;
  }
  h3.step-title {
    font-size: 12pt; font-weight: 700; color: #1a1a2e;
    margin: 20px 0 8px;
    display: flex; align-items: center; gap: 8px;
  }
  p { margin-bottom: 10px; font-size: 10.5pt; color: #333; }

  /* ── CARDS ── */
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
  .cards-3 { grid-template-columns: 1fr 1fr 1fr; }
  .card {
    background: #f8faff; border: 1px solid #e0e7ff;
    border-radius: 10px; padding: 16px;
  }
  .card-icon { font-size: 22px; margin-bottom: 8px; }
  .card h4 { font-size: 10.5pt; font-weight: 700; color: #1a1a2e; margin-bottom: 6px; }
  .card p { font-size: 9.5pt; color: #555; margin: 0; }

  /* ── STEPS ── */
  .steps { margin: 14px 0; }
  .step {
    display: flex; gap: 14px; margin-bottom: 14px;
    background: #fafbff; border-radius: 10px; padding: 14px 16px;
    border-left: 4px solid #6366f1;
  }
  .step-num {
    width: 28px; height: 28px; border-radius: 50%;
    background: #6366f1; color: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 11pt; font-weight: 700; flex-shrink: 0;
  }
  .step-body { flex: 1; }
  .step-body strong { display: block; font-size: 10.5pt; margin-bottom: 4px; color: #1a1a2e; }
  .step-body span { font-size: 9.5pt; color: #555; }

  /* ── TABLE ── */
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 9.5pt; }
  th { background: #1a1a2e; color: white; padding: 10px 12px; text-align: left; font-weight: 600; }
  td { padding: 9px 12px; border-bottom: 1px solid #e8ecf8; vertical-align: top; }
  tr:nth-child(even) td { background: #f8faff; }

  /* ── ALERT BOXES ── */
  .alert {
    padding: 12px 16px; border-radius: 8px; margin: 14px 0;
    display: flex; gap: 10px; align-items: flex-start;
    font-size: 9.5pt;
  }
  .alert-info { background: #eff6ff; border-left: 4px solid #3b82f6; color: #1e40af; }
  .alert-warn { background: #fffbeb; border-left: 4px solid #f59e0b; color: #92400e; }
  .alert-success { background: #f0fdf4; border-left: 4px solid #22c55e; color: #166534; }
  .alert-icon { font-size: 14pt; flex-shrink: 0; }

  /* ── PERMISSIONS TABLE ── */
  .perm-yes { color: #16a34a; font-weight: 700; }
  .perm-no  { color: #dc2626; }
  .perm-ro  { color: #d97706; font-weight: 600; }

  /* ── PAGE NUMBER ── */
  @page { margin: 0; }
  .page-footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    height: 40px;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 70px; font-size: 8pt; color: #aaa;
    border-top: 1px solid #eee;
  }

  /* ── ROLE COLORS ── */
  .color-admin { background: #7c3aed; }
  .color-sales { background: #2563eb; }
  .color-accountant { background: #0891b2; }
  .color-prod { background: #16a34a; }
  .color-prodhead { background: #15803d; }
  .color-analyst { background: #d97706; }
  .color-director { background: #dc2626; }
  .color-guest { background: #6b7280; }

  .dot-admin { background: #7c3aed; }
  .dot-sales { background: #2563eb; }
  .dot-accountant { background: #0891b2; }
  .dot-prod { background: #16a34a; }
  .dot-prodhead { background: #15803d; }
  .dot-analyst { background: #d97706; }
  .dot-director { background: #dc2626; }
  .dot-guest { background: #6b7280; }

  ul { margin: 8px 0 12px 20px; }
  li { font-size: 10pt; color: #333; margin-bottom: 4px; }
  strong { color: #1a1a2e; }

  .highlight-box {
    background: linear-gradient(135deg, #f0f4ff, #e8ecff);
    border: 1px solid #c7d2fe;
    border-radius: 10px;
    padding: 16px 20px;
    margin: 14px 0;
  }
  .highlight-box h4 { font-size: 11pt; font-weight: 700; color: #3730a3; margin-bottom: 8px; }

  .login-block {
    background: #1a1a2e;
    color: #e2e8f0;
    border-radius: 10px;
    padding: 16px 20px;
    margin: 14px 0;
    font-family: monospace;
    font-size: 10pt;
  }
  .login-block .label { color: #94a3b8; font-size: 8.5pt; margin-bottom: 4px; }
  .login-block .value { color: #7dd3fc; }

  .permission-matrix { margin: 20px 0; }
</style>
</head>
<body>

<!-- ████ COVER ████ -->
<div class="cover">
  <div class="cover-logo">📋</div>
  <h1>ContractPro</h1>
  <h2>Система управления договорами и производством</h2>
  <div class="cover-divider"></div>
  <p style="font-size:14pt; font-weight:300; opacity:0.9; margin-bottom:16px;">Руководство пользователя</p>
  <p style="font-size:10pt; opacity:0.5;">Версия 1.0 &nbsp;·&nbsp; 2026</p>
</div>

<!-- ████ TABLE OF CONTENTS ████ -->
<div class="toc-page">
  <h2>Содержание</h2>
  <div class="toc-intro">
    Данное руководство описывает работу в системе ContractPro для каждой категории сотрудников.
    Найдите свою роль в списке ниже и перейдите к соответствующему разделу.
  </div>

  <div style="margin-bottom:12px; font-size:9pt; text-transform:uppercase; color:#999; letter-spacing:1px; font-weight:700;">Разделы по ролям</div>

  <div class="toc-section">
    <div class="toc-role">
      <div class="toc-role-dot dot-admin"></div>
      <div class="toc-role-name">1. Системный администратор</div>
      <div class="toc-role-desc">Управление пользователями, интеграции, настройки системы</div>
    </div>
    <div class="toc-role">
      <div class="toc-role-dot dot-sales"></div>
      <div class="toc-role-name">2. Менеджер по продажам</div>
      <div class="toc-role-desc">Договоры, заказы, отгрузки, клиентская переписка</div>
    </div>
    <div class="toc-role">
      <div class="toc-role-dot dot-accountant"></div>
      <div class="toc-role-name">3. Бухгалтер</div>
      <div class="toc-role-desc">Платежи, счета, долги, финансовые отчёты</div>
    </div>
    <div class="toc-role">
      <div class="toc-role-dot dot-prod"></div>
      <div class="toc-role-name">4. Специалист производства</div>
      <div class="toc-role-desc">Производственные задачи, прогресс, качество</div>
    </div>
    <div class="toc-role">
      <div class="toc-role-dot dot-prodhead"></div>
      <div class="toc-role-name">5. Начальник производства</div>
      <div class="toc-role-desc">Планирование, диаграмма Ганта, назначение задач</div>
    </div>
    <div class="toc-role">
      <div class="toc-role-dot dot-analyst"></div>
      <div class="toc-role-name">6. Аналитик</div>
      <div class="toc-role-desc">Отчёты, аудит, аналитические дашборды</div>
    </div>
    <div class="toc-role">
      <div class="toc-role-dot dot-director"></div>
      <div class="toc-role-name">7. Директор</div>
      <div class="toc-role-desc">Полный доступ, стратегический контроль</div>
    </div>
    <div class="toc-role">
      <div class="toc-role-dot dot-guest"></div>
      <div class="toc-role-name">8. Гость</div>
      <div class="toc-role-desc">Просмотр договоров и отгрузок (только чтение)</div>
    </div>
  </div>

  <div style="margin-top:36px; padding-top:24px; border-top:1px solid #eee;">
    <div style="margin-bottom:12px; font-size:9pt; text-transform:uppercase; color:#999; letter-spacing:1px; font-weight:700;">Общие разделы</div>
    <div class="toc-role"><div class="toc-role-dot" style="background:#334155"></div><div class="toc-role-name">Вход в систему и навигация</div><div class="toc-role-desc">Как начать работу — для всех ролей</div></div>
    <div class="toc-role"><div class="toc-role-dot" style="background:#334155"></div><div class="toc-role-name">Матрица прав доступа</div><div class="toc-role-desc">Сводная таблица модулей по ролям</div></div>
  </div>
</div>

<!-- ████████████████████████████████████████ -->
<!-- SECTION 0: LOGIN + NAVIGATION (all roles) -->
<!-- ████████████████████████████████████████ -->
<div class="section-header">
  <div class="role-badge" style="background:#334155">🔐 Общий раздел</div>
  <h1>Вход в систему и навигация</h1>
  <div class="subtitle">Инструкция для всех сотрудников</div>
</div>
<div class="content">

  <h2 class="section-title">Вход в систему</h2>
  <div class="steps">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <strong>Откройте браузер и перейдите по адресу системы</strong>
        <span>Используйте Google Chrome или Yandex Browser (рекомендуется). Введите URL, предоставленный администратором.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <strong>Введите корпоративный e-mail и пароль</strong>
        <span>Логин — это ваш корпоративный адрес электронной почты. Пароль выдаётся администратором при первом входе.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-body">
        <strong>Нажмите «Войти»</strong>
        <span>Система автоматически определит вашу роль и откроет соответствующий дашборд.</span>
      </div>
    </div>
  </div>

  <div class="alert alert-warn">
    <div class="alert-icon">⚠️</div>
    <div>Если вы забыли пароль — обратитесь к системному администратору. Самостоятельный сброс пароля производится только через администратора.</div>
  </div>

  <h2 class="section-title">Интерфейс системы</h2>
  <div class="cards">
    <div class="card">
      <div class="card-icon">📌</div>
      <h4>Боковая панель навигации</h4>
      <p>Слева расположено меню с разделами, доступными вашей роли. Неактивные разделы скрыты автоматически.</p>
    </div>
    <div class="card">
      <div class="card-icon">🔔</div>
      <h4>Уведомления</h4>
      <p>Иконка колокольчика в шапке показывает непрочитанные уведомления: дедлайны, просроченные платежи, новые задачи.</p>
    </div>
    <div class="card">
      <div class="card-icon">👤</div>
      <h4>Профиль пользователя</h4>
      <p>Нажмите на аватар в правом верхнем углу — здесь ваше имя, роль и кнопка выхода из системы.</p>
    </div>
    <div class="card">
      <div class="card-icon">🏠</div>
      <h4>Дашборд</h4>
      <p>Главная страница после входа. Показывает ключевые показатели, задачи и уведомления для вашей роли.</p>
    </div>
  </div>

  <h2 class="section-title">Матрица прав доступа</h2>
  <p>Таблица показывает, какие модули системы доступны каждой роли (✅ полный доступ, 👁 только просмотр, ❌ нет доступа).</p>
  <table class="permission-matrix">
    <thead>
      <tr>
        <th>Модуль</th>
        <th>Администратор</th>
        <th>Менеджер</th>
        <th>Бухгалтер</th>
        <th>Спец. пр-ва</th>
        <th>Нач. пр-ва</th>
        <th>Аналитик</th>
        <th>Директор</th>
        <th>Гость</th>
      </tr>
    </thead>
    <tbody>
      <tr><td><strong>Дашборд</strong></td><td class="perm-yes">✅</td><td class="perm-yes">✅</td><td class="perm-yes">✅</td><td class="perm-yes">✅</td><td class="perm-yes">✅</td><td class="perm-yes">✅</td><td class="perm-yes">✅</td><td class="perm-yes">✅</td></tr>
      <tr><td><strong>Договоры</strong></td><td class="perm-yes">✅</td><td class="perm-yes">✅</td><td class="perm-ro">👁</td><td class="perm-no">❌</td><td class="perm-ro">👁</td><td class="perm-ro">👁</td><td class="perm-yes">✅</td><td class="perm-ro">👁</td></tr>
      <tr><td><strong>Заказы</strong></td><td class="perm-yes">✅</td><td class="perm-yes">✅</td><td class="perm-no">❌</td><td class="perm-ro">👁</td><td class="perm-yes">✅</td><td class="perm-no">❌</td><td class="perm-yes">✅</td><td class="perm-ro">👁</td></tr>
      <tr><td><strong>Производство</strong></td><td class="perm-yes">✅</td><td class="perm-ro">👁</td><td class="perm-no">❌</td><td class="perm-yes">✅</td><td class="perm-yes">✅</td><td class="perm-no">❌</td><td class="perm-yes">✅</td><td class="perm-no">❌</td></tr>
      <tr><td><strong>Отгрузки</strong></td><td class="perm-yes">✅</td><td class="perm-yes">✅</td><td class="perm-ro">👁</td><td class="perm-no">❌</td><td class="perm-ro">👁</td><td class="perm-ro">👁</td><td class="perm-yes">✅</td><td class="perm-ro">👁</td></tr>
      <tr><td><strong>Платежи</strong></td><td class="perm-yes">✅</td><td class="perm-ro">👁</td><td class="perm-yes">✅</td><td class="perm-no">❌</td><td class="perm-no">❌</td><td class="perm-no">❌</td><td class="perm-yes">✅</td><td class="perm-no">❌</td></tr>
      <tr><td><strong>Претензии</strong></td><td class="perm-yes">✅</td><td class="perm-yes">✅</td><td class="perm-ro">👁</td><td class="perm-yes">✅</td><td class="perm-yes">✅</td><td class="perm-ro">👁</td><td class="perm-yes">✅</td><td class="perm-no">❌</td></tr>
      <tr><td><strong>Отчёты</strong></td><td class="perm-yes">✅</td><td class="perm-no">❌</td><td class="perm-yes">✅</td><td class="perm-no">❌</td><td class="perm-no">❌</td><td class="perm-yes">✅</td><td class="perm-yes">✅</td><td class="perm-no">❌</td></tr>
      <tr><td><strong>Чат</strong></td><td class="perm-yes">✅</td><td class="perm-yes">✅</td><td class="perm-no">❌</td><td class="perm-no">❌</td><td class="perm-no">❌</td><td class="perm-no">❌</td><td class="perm-yes">✅</td><td class="perm-no">❌</td></tr>
      <tr><td><strong>Администрирование</strong></td><td class="perm-yes">✅</td><td class="perm-no">❌</td><td class="perm-no">❌</td><td class="perm-no">❌</td><td class="perm-no">❌</td><td class="perm-no">❌</td><td class="perm-no">❌</td><td class="perm-no">❌</td></tr>
    </tbody>
  </table>
</div>


<!-- ████████████████████████████████████████ -->
<!-- SECTION 1: ADMIN -->
<!-- ████████████████████████████████████████ -->
<div class="section-header">
  <div class="role-badge color-admin">⚙️ Роль 1</div>
  <h1>Системный администратор</h1>
  <div class="subtitle">Полный контроль над системой, пользователями и интеграциями</div>
  <div class="access-chips">
    <span class="chip">Все модули</span>
    <span class="chip">Управление пользователями</span>
    <span class="chip">Интеграции</span>
    <span class="chip">Настройки системы</span>
    <span class="chip">Аудит</span>
  </div>
</div>
<div class="content">

  <div class="login-block">
    <div class="label">Тестовый логин</div>
    <div class="value">admin@furniture.ru</div>
  </div>

  <h2 class="section-title">Раздел «Администрирование»</h2>
  <p>Доступен только администратору через пункт меню <strong>«Администрирование»</strong>. Содержит четыре подраздела.</p>

  <h3 class="step-title">👥 Управление пользователями</h3>
  <div class="steps">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <strong>Откройте «Администрирование» → «Пользователи»</strong>
        <span>Таблица со всеми сотрудниками: имя, email, роль, статус активности.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <strong>Создание нового пользователя</strong>
        <span>Нажмите «+ Добавить пользователя», заполните ФИО, email, выберите роль. Временный пароль отправляется на указанный email.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-body">
        <strong>Редактирование / блокировка</strong>
        <span>Иконка карандаша — изменить роль или данные. Переключатель «Активен» — заблокировать доступ без удаления учётной записи.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">4</div>
      <div class="step-body">
        <strong>Удаление пользователя</strong>
        <span>Иконка корзины. Удаление необратимо — история действий пользователя сохраняется в аудит-логе.</span>
      </div>
    </div>
  </div>

  <h3 class="step-title">🔌 Интеграции</h3>
  <p>Мониторинг и управление подключениями с внешними системами:</p>
  <div class="cards">
    <div class="card">
      <div class="card-icon">💼</div>
      <h4>1С Бухгалтерия</h4>
      <p>Статус подключения, дата последней синхронизации. Кнопка «Синхронизировать» для ручного запуска.</p>
    </div>
    <div class="card">
      <div class="card-icon">🏭</div>
      <h4>SAP</h4>
      <p>ERP-интеграция. Контроль состояния обмена данными с производственным модулем.</p>
    </div>
    <div class="card">
      <div class="card-icon">📊</div>
      <h4>CRM</h4>
      <p>Синхронизация клиентской базы и коммуникаций с CRM-системой.</p>
    </div>
    <div class="card">
      <div class="card-icon">🔗</div>
      <h4>REST API</h4>
      <p>Статус внешнего API. Используется для обмена данными со сторонними системами.</p>
    </div>
  </div>

  <h3 class="step-title">📄 Шаблоны документов</h3>
  <p>Библиотека типовых шаблонов договоров, дополнительных соглашений и счетов. Добавление нового шаблона: кнопка «+ Шаблон» → загрузите файл DOCX/PDF → укажите название и категорию.</p>

  <h3 class="step-title">⚙️ Настройки системы</h3>
  <table>
    <tr><th>Параметр</th><th>Описание</th></tr>
    <tr><td>Рабочие смены</td><td>Количество смен, время начала/окончания каждой</td></tr>
    <tr><td>Рабочие часы</td><td>Общий фонд рабочего времени в сутки</td></tr>
    <tr><td>Плановые простои</td><td>Регламентные остановки оборудования (ТО, обслуживание)</td></tr>
    <tr><td>Приоритизация заказов</td><td>Правила автоматической расстановки приоритетов</td></tr>
    <tr><td>Ставки пеней</td><td>Процент неустойки за просрочку платежей по умолчанию</td></tr>
  </table>

  <h3 class="step-title">📋 Аудит-лог</h3>
  <p>Полная история действий всех пользователей: кто, что сделал, когда, с каким объектом. Используйте фильтры по пользователю, дате и типу действия для расследования инцидентов.</p>

  <div class="alert alert-info">
    <div class="alert-icon">ℹ️</div>
    <div>Администратор имеет доступ ко всем модулям системы наравне с другими ролями. Для работы с договорами, платежами и производством — используйте соответствующие разделы меню.</div>
  </div>
</div>


<!-- ████████████████████████████████████████ -->
<!-- SECTION 2: SALES MANAGER -->
<!-- ████████████████████████████████████████ -->
<div class="section-header">
  <div class="role-badge color-sales">💼 Роль 2</div>
  <h1>Менеджер по продажам</h1>
  <div class="subtitle">Ведение договоров, заказов, отгрузок и клиентской коммуникации</div>
  <div class="access-chips">
    <span class="chip">Договоры</span>
    <span class="chip">Заказы</span>
    <span class="chip">Отгрузки</span>
    <span class="chip">Претензии</span>
    <span class="chip">Чат</span>
  </div>
</div>
<div class="content">

  <div class="login-block">
    <div class="label">Тестовый логин</div>
    <div class="value">sales@furniture.ru</div>
  </div>

  <h2 class="section-title">Работа с договорами</h2>
  <div class="steps">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <strong>Откройте раздел «Договоры»</strong>
        <span>Список всех договоров с фильтрацией по статусу: Активный, Выполнен, Просрочен, На согласовании.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <strong>Создание нового договора</strong>
        <span>Нажмите «+ Новый договор». Номер генерируется автоматически. Заполните контрагента, даты, условия оплаты и штрафные ставки.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-body">
        <strong>Загрузка скан-копии договора</strong>
        <span>В карточке договора перетащите PDF или DOCX в зону загрузки. Система автоматически попытается извлечь ключевые данные из документа.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">4</div>
      <div class="step-body">
        <strong>Отслеживание версий и изменений</strong>
        <span>Вкладка «Версии» в карточке договора показывает все изменения с датой и автором. Можно сравнить текущую версию с предыдущей.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">5</div>
      <div class="step-body">
        <strong>Контроль обязательств</strong>
        <span>Вкладка «Обязательства» — перечень ключевых условий договора с дедлайнами. Просроченные позиции выделены красным.</span>
      </div>
    </div>
  </div>

  <h2 class="section-title">Работа с заказами</h2>
  <div class="cards">
    <div class="card">
      <div class="card-icon">📝</div>
      <h4>Создание заказа</h4>
      <p>Раздел «Заказы» → «+ Новый заказ». Привяжите к договору, добавьте позиции спецификации: наименование, количество, цена.</p>
    </div>
    <div class="card">
      <div class="card-icon">🚦</div>
      <h4>Статусы заказа</h4>
      <p>Новый → В производстве → Готов → Отгружен → Закрыт. Текущий статус обновляется автоматически при изменении производства.</p>
    </div>
    <div class="card">
      <div class="card-icon">⚡</div>
      <h4>Приоритеты</h4>
      <p>Установите приоритет заказа (Высокий / Средний / Низкий). Это влияет на очерёдность в производстве.</p>
    </div>
    <div class="card">
      <div class="card-icon">📅</div>
      <h4>Дедлайны</h4>
      <p>Укажите дату готовности. При приближении срока система автоматически отправит уведомление.</p>
    </div>
  </div>

  <h2 class="section-title">Работа с отгрузками</h2>
  <p>Раздел <strong>«Отгрузки»</strong> — журнал всех отправок с привязкой к заказам и счетам на оплату.</p>
  <table>
    <tr><th>Поле</th><th>Описание</th></tr>
    <tr><td>Номер счёта</td><td>Уникальный номер счёта-фактуры, формируется автоматически</td></tr>
    <tr><td>Дата отгрузки</td><td>Фактическая дата отправки товара</td></tr>
    <tr><td>Позиции</td><td>Список товаров в отгрузке с количеством</td></tr>
    <tr><td>Срок оплаты</td><td>Рассчитывается по условиям договора автоматически</td></tr>
    <tr><td>Статус оплаты</td><td>Оплачен / Ожидает / Просрочен</td></tr>
  </table>

  <h2 class="section-title">Чат с клиентами</h2>
  <p>Раздел <strong>«Чат»</strong> — переписка, привязанная к конкретному договору. Выберите договор из списка слева, чтобы увидеть историю переписки с контрагентом. Новые сообщения отображаются в счётчике уведомлений.</p>

  <h2 class="section-title">Претензии по качеству</h2>
  <p>Раздел <strong>«Претензии»</strong> — фиксация и отслеживание рекламаций от клиентов. Создайте претензию: укажите номер отгрузки, описание дефекта, дедлайн устранения и ответственного.</p>

  <div class="alert alert-success">
    <div class="alert-icon">✅</div>
    <div><strong>Совет:</strong> На главном дашборде менеджера отображаются последние сообщения и активные договоры — начинайте рабочий день с его проверки.</div>
  </div>
</div>


<!-- ████████████████████████████████████████ -->
<!-- SECTION 3: ACCOUNTANT -->
<!-- ████████████████████████████████████████ -->
<div class="section-header">
  <div class="role-badge color-accountant">💰 Роль 3</div>
  <h1>Бухгалтер</h1>
  <div class="subtitle">Контроль платежей, дебиторской задолженности и финансовой отчётности</div>
  <div class="access-chips">
    <span class="chip">Платежи</span>
    <span class="chip">Отгрузки (просмотр)</span>
    <span class="chip">Договоры (просмотр)</span>
    <span class="chip">Отчёты</span>
    <span class="chip">Претензии</span>
  </div>
</div>
<div class="content">

  <div class="login-block">
    <div class="label">Тестовый логин</div>
    <div class="value">accountant@furniture.ru</div>
  </div>

  <h2 class="section-title">Дашборд бухгалтера</h2>
  <p>Главная страница показывает сводную таблицу платежей по договорам с текущим статусом. Сразу видно, какие платежи ожидают поступления, а какие просрочены.</p>

  <h2 class="section-title">Раздел «Платежи»</h2>
  <div class="steps">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <strong>Просмотр реестра платежей</strong>
        <span>Список всех ожидаемых поступлений с датой, суммой, контрагентом и статусом (Оплачен / Ожидает / Просрочен).</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <strong>Фиксация поступившего платежа</strong>
        <span>Найдите запись, нажмите «Отметить оплаченным», укажите фактическую дату и сумму поступления. Статус изменится на «Оплачен».</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-body">
        <strong>Контроль просроченных платежей</strong>
        <span>Просроченные позиции выделены красным. Система автоматически рассчитывает пени по ставке, указанной в договоре.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">4</div>
      <div class="step-body">
        <strong>Дебиторская задолженность</strong>
        <span>Сводный показатель на дашборде: общий объём дебиторки с разбивкой по контрагентам.</span>
      </div>
    </div>
  </div>

  <div class="alert alert-warn">
    <div class="alert-icon">⚠️</div>
    <div>Если по просроченному платежу открыта претензия — оплата может быть заморожена до её урегулирования. Проверьте статус претензии перед закрытием платежа.</div>
  </div>

  <h2 class="section-title">Отчёты и аналитика</h2>
  <div class="cards">
    <div class="card">
      <div class="card-icon">📈</div>
      <h4>Динамика выручки</h4>
      <p>График поступлений по месяцам. Фильтрация по договору, контрагенту, периоду.</p>
    </div>
    <div class="card">
      <div class="card-icon">📊</div>
      <h4>Сбор платежей</h4>
      <p>Процент своевременно оплаченных счетов. Помогает оценить надёжность контрагентов.</p>
    </div>
    <div class="card">
      <div class="card-icon">🕐</div>
      <h4>Анализ просрочки</h4>
      <p>Aging-анализ: разбивка долгов по срокам (до 30 дней, 30–60, 60–90, свыше 90 дней).</p>
    </div>
    <div class="card">
      <div class="card-icon">💾</div>
      <h4>Экспорт данных</h4>
      <p>Кнопка «Экспорт» в разделе отчётов — выгрузка в Excel/CSV для дальнейшей обработки.</p>
    </div>
  </div>

  <h2 class="section-title">Просмотр договоров и отгрузок</h2>
  <p>Бухгалтер имеет доступ только на <strong>чтение</strong> в разделах «Договоры» и «Отгрузки». Это позволяет проверять условия оплаты и сверять данные счетов с первичными документами, но без возможности вносить изменения.</p>
</div>


<!-- ████████████████████████████████████████ -->
<!-- SECTION 4: PRODUCTION SPECIALIST -->
<!-- ████████████████████████████████████████ -->
<div class="section-header">
  <div class="role-badge color-prod">🔧 Роль 4</div>
  <h1>Специалист производства</h1>
  <div class="subtitle">Выполнение производственных задач, обновление прогресса, отчёты по качеству</div>
  <div class="access-chips">
    <span class="chip">Производство</span>
    <span class="chip">Заказы (просмотр)</span>
    <span class="chip">Претензии</span>
  </div>
</div>
<div class="content">

  <div class="login-block">
    <div class="label">Тестовый логин</div>
    <div class="value">prod@furniture.ru</div>
  </div>

  <h2 class="section-title">Дашборд специалиста</h2>
  <p>Главная страница показывает сводку производственных задач: <strong>В работе / Запланировано / Завершено</strong>. Сразу видно, что нужно делать сегодня.</p>

  <h2 class="section-title">Раздел «Производство»</h2>
  <div class="steps">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <strong>Список задач</strong>
        <span>Перейдите в «Производство» → вкладка «Задачи». Задачи отсортированы по дедлайну и приоритету. Нажмите на задачу для просмотра деталей.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <strong>Взятие задачи в работу</strong>
        <span>Нажмите кнопку «В работу» на задаче со статусом «Запланировано». Статус изменится на «В процессе».</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-body">
        <strong>Обновление прогресса</strong>
        <span>В открытой задаче передвиньте ползунок прогресса (0–100%). Обновляйте несколько раз в течение смены для отражения реального состояния.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">4</div>
      <div class="step-body">
        <strong>Завершение задачи</strong>
        <span>Установите прогресс 100% и нажмите «Завершить». Начальник производства получит уведомление.</span>
      </div>
    </div>
  </div>

  <h2 class="section-title">Диаграмма Ганта</h2>
  <p>Вкладка <strong>«Диаграмма Ганта»</strong> показывает визуальное расписание всех задач по производственным линиям. Доступны три масштаба: <strong>Неделя / Месяц / Квартал</strong>.</p>
  <div class="alert alert-info">
    <div class="alert-icon">ℹ️</div>
    <div>Специалист видит диаграмму Ганта, но <strong>не может переназначать задачи</strong> — это делает начальник производства. Если задача назначена на другую линию — сообщите начальнику.</div>
  </div>

  <h2 class="section-title">Претензии по качеству</h2>
  <div class="steps">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <strong>Зафиксировать дефект</strong>
        <span>Раздел «Претензии» → «+ Новая претензия». Укажите номер отгрузки, описание дефекта, степень серьёзности.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <strong>Ответить на претензию от клиента</strong>
        <span>Открытые претензии отображаются в списке. Обновите статус решения и добавьте комментарий по результатам проверки.</span>
      </div>
    </div>
  </div>
</div>


<!-- ████████████████████████████████████████ -->
<!-- SECTION 5: PRODUCTION HEAD -->
<!-- ████████████████████████████████████████ -->
<div class="section-header">
  <div class="role-badge color-prodhead">🏭 Роль 5</div>
  <h1>Начальник производства</h1>
  <div class="subtitle">Планирование производства, диаграмма Ганта, управление задачами и загрузкой линий</div>
  <div class="access-chips">
    <span class="chip">Производство (полный)</span>
    <span class="chip">Заказы</span>
    <span class="chip">Договоры (просмотр)</span>
    <span class="chip">Отгрузки (просмотр)</span>
    <span class="chip">Претензии</span>
  </div>
</div>
<div class="content">

  <div class="login-block">
    <div class="label">Тестовый логин</div>
    <div class="value">prodhead@furniture.ru</div>
  </div>

  <h2 class="section-title">Планирование производства</h2>
  <div class="steps">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <strong>Создание производственной задачи</strong>
        <span>«Производство» → «+ Новая задача». Укажите: название, заказ, производственная линия, ответственный специалист, плановые даты.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <strong>Назначение на производственную линию</strong>
        <span>Каждая задача привязывается к конкретной линии. Проверьте загрузку линии на Ганте перед назначением.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-body">
        <strong>Перепланирование задач</strong>
        <span>На диаграмме Ганта перетащите задачу на новую дату (drag & drop). Система пересчитает зависимости автоматически.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">4</div>
      <div class="step-body">
        <strong>Контроль выполнения</strong>
        <span>Прогресс каждой задачи отображается прямо на Ганте. Красная полоса — задача отстаёт от плана.</span>
      </div>
    </div>
  </div>

  <h2 class="section-title">Диаграмма Ганта</h2>
  <div class="cards">
    <div class="card">
      <div class="card-icon">📅</div>
      <h4>Режим «Неделя»</h4>
      <p>Детальный вид с разбивкой по дням. Удобен для оперативного планирования и контроля в текущей неделе.</p>
    </div>
    <div class="card">
      <div class="card-icon">🗓</div>
      <h4>Режим «Месяц»</h4>
      <p>Основной рабочий режим. Показывает весь месяц, позволяет видеть загрузку линий и окна для новых задач.</p>
    </div>
    <div class="card">
      <div class="card-icon">📆</div>
      <h4>Режим «Квартал»</h4>
      <p>Стратегический обзор. Используется для долгосрочного планирования при работе с крупными заказами.</p>
    </div>
    <div class="card">
      <div class="card-icon">🔀</div>
      <h4>Drag & Drop</h4>
      <p>Задачи можно перетаскивать по Ганту для быстрого перепланирования без открытия формы редактирования.</p>
    </div>
  </div>

  <h2 class="section-title">Управление заказами</h2>
  <p>Начальник производства видит все заказы и может обновлять <strong>производственный статус</strong> позиций спецификации — переводить из «В производстве» в «Готово к отгрузке». Это сигнал менеджеру по продажам оформить отгрузку.</p>

  <div class="alert alert-success">
    <div class="alert-icon">✅</div>
    <div><strong>Совет:</strong> Проверяйте входящие заказы с высоким приоритетом каждое утро. Своевременное планирование предотвращает срыв дедлайнов по договорам.</div>
  </div>
</div>


<!-- ████████████████████████████████████████ -->
<!-- SECTION 6: ANALYST -->
<!-- ████████████████████████████████████████ -->
<div class="section-header">
  <div class="role-badge color-analyst">📊 Роль 6</div>
  <h1>Аналитик</h1>
  <div class="subtitle">Отчётность, аналитические дашборды, аудит действий пользователей</div>
  <div class="access-chips">
    <span class="chip">Отчёты</span>
    <span class="chip">Договоры (просмотр)</span>
    <span class="chip">Отгрузки (просмотр)</span>
    <span class="chip">Претензии (просмотр)</span>
    <span class="chip">Аудит-лог</span>
  </div>
</div>
<div class="content">

  <div class="login-block">
    <div class="label">Тестовый логин</div>
    <div class="value">analyst@furniture.ru</div>
  </div>

  <h2 class="section-title">Раздел «Отчёты»</h2>
  <p>Главный инструмент аналитика. Содержит несколько типов аналитических панелей:</p>

  <div class="cards">
    <div class="card">
      <div class="card-icon">💹</div>
      <h4>Динамика выручки</h4>
      <p>Линейный / столбчатый график поступлений по месяцам с возможностью сравнить периоды.</p>
    </div>
    <div class="card">
      <div class="card-icon">✔️</div>
      <h4>Сбор платежей</h4>
      <p>Процент своевременно закрытых счетов. Позволяет выявить ненадёжных контрагентов.</p>
    </div>
    <div class="card">
      <div class="card-icon">⚙️</div>
      <h4>Эффективность производства</h4>
      <p>Процент выполнения плана по производственным линиям. Факт vs. план.</p>
    </div>
    <div class="card">
      <div class="card-icon">🕐</div>
      <h4>Aging-анализ долгов</h4>
      <p>Разбивка дебиторской задолженности по срокам: свежая, зрелая, безнадёжная.</p>
    </div>
  </div>

  <h2 class="section-title">Работа с фильтрами и экспортом</h2>
  <div class="steps">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <strong>Установите период анализа</strong>
        <span>Используйте datepicker для выбора диапазона дат. Стандартные периоды: текущий месяц, квартал, год.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <strong>Фильтрация по контрагенту или договору</strong>
        <span>Выпадающий список позволяет сузить аналитику до конкретного клиента или договора.</span>
      </div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-body">
        <strong>Экспорт данных</strong>
        <span>Кнопка «Экспорт» → выгрузка данных в Excel/CSV для подготовки внешней отчётности или презентаций.</span>
      </div>
    </div>
  </div>

  <h2 class="section-title">Аудит-лог</h2>
  <p>Аналитик имеет доступ к журналу действий на дашборде. Можно отслеживать активность пользователей: создание, изменение и удаление объектов с временными метками. Полезно для контроля корректности работы с данными.</p>

  <div class="alert alert-info">
    <div class="alert-icon">ℹ️</div>
    <div>Аналитик работает только в режиме <strong>чтения</strong> во всех разделах системы, кроме отчётов. Это исключает случайное изменение данных при анализе.</div>
  </div>
</div>


<!-- ████████████████████████████████████████ -->
<!-- SECTION 7: DIRECTOR -->
<!-- ████████████████████████████████████████ -->
<div class="section-header">
  <div class="role-badge color-director">🎯 Роль 7</div>
  <h1>Директор</h1>
  <div class="subtitle">Полный доступ ко всем данным системы, стратегический мониторинг и контроль</div>
  <div class="access-chips">
    <span class="chip">Все модули</span>
    <span class="chip">Полный доступ</span>
    <span class="chip">Отчёты</span>
    <span class="chip">Аудит</span>
  </div>
</div>
<div class="content">

  <div class="login-block">
    <div class="label">Тестовый логин</div>
    <div class="value">director@furniture.ru</div>
  </div>

  <h2 class="section-title">Обзорный дашборд директора</h2>
  <p>Дашборд содержит ключевые метрики по всем направлениям деятельности:</p>

  <div class="cards cards-3">
    <div class="card">
      <div class="card-icon">📋</div>
      <h4>Активные договоры</h4>
      <p>Общее количество действующих договоров с разбивкой по статусам.</p>
    </div>
    <div class="card">
      <div class="card-icon">💵</div>
      <h4>Финансы</h4>
      <p>Текущая дебиторка, ожидаемые поступления, просроченные платежи.</p>
    </div>
    <div class="card">
      <div class="card-icon">🏭</div>
      <h4>Производство</h4>
      <p>Процент выполнения производственного плана в реальном времени.</p>
    </div>
  </div>

  <h2 class="section-title">Приоритеты использования системы</h2>
  <table>
    <tr><th>Задача</th><th>Раздел</th><th>Периодичность</th></tr>
    <tr><td>Контроль финансовых показателей</td><td>Платежи + Отчёты</td><td>Ежедневно</td></tr>
    <tr><td>Мониторинг исполнения договоров</td><td>Договоры</td><td>Еженедельно</td></tr>
    <tr><td>Контроль производства</td><td>Производство → Ганта</td><td>По необходимости</td></tr>
    <tr><td>Стратегическая аналитика</td><td>Отчёты</td><td>Ежемесячно</td></tr>
    <tr><td>Клиентская коммуникация</td><td>Чат</td><td>По запросу</td></tr>
    <tr><td>Контроль качества работы команды</td><td>Отчёты → Аудит</td><td>Ежемесячно</td></tr>
  </table>

  <h2 class="section-title">Доступ ко всем модулям</h2>
  <p>Директор имеет полный доступ ко всем разделам системы — от договоров до администрирования. При необходимости можно заменить любого сотрудника или проверить любой документ без ограничений прав.</p>

  <div class="alert alert-warn">
    <div class="alert-icon">⚠️</div>
    <div>Директор видит все данные, но для создания и редактирования рекомендуется делегировать операционные задачи профильным сотрудникам. Изменения логируются в аудит-журнале.</div>
  </div>
</div>


<!-- ████████████████████████████████████████ -->
<!-- SECTION 8: GUEST -->
<!-- ████████████████████████████████████████ -->
<div class="section-header">
  <div class="role-badge color-guest">👁 Роль 8</div>
  <h1>Гость</h1>
  <div class="subtitle">Ограниченный просмотр договоров и отгрузок без права редактирования</div>
  <div class="access-chips">
    <span class="chip">Договоры (просмотр)</span>
    <span class="chip">Заказы (просмотр)</span>
    <span class="chip">Отгрузки (просмотр)</span>
  </div>
</div>
<div class="content">

  <div class="login-block">
    <div class="label">Тестовый логин</div>
    <div class="value">guest@furniture.ru</div>
  </div>

  <h2 class="section-title">Возможности гостевого доступа</h2>
  <div class="cards">
    <div class="card">
      <div class="card-icon">📋</div>
      <h4>Просмотр договоров</h4>
      <p>Список договоров и детали каждого: статус, контрагент, суммы, условия. Без возможности изменений.</p>
    </div>
    <div class="card">
      <div class="card-icon">📦</div>
      <h4>Просмотр заказов</h4>
      <p>Список заказов с основными параметрами: статус, дедлайн, приоритет. Только чтение.</p>
    </div>
    <div class="card">
      <div class="card-icon">🚚</div>
      <h4>Просмотр отгрузок</h4>
      <p>Журнал отгрузок: номера счетов, даты, статусы. Позволяет отслеживать факт отправки товара.</p>
    </div>
    <div class="card">
      <div class="card-icon">🏠</div>
      <h4>Дашборд</h4>
      <p>Общая стартовая страница без специализированных виджетов для гостевой роли.</p>
    </div>
  </div>

  <div class="alert alert-warn">
    <div class="alert-icon">⚠️</div>
    <div>Роль «Гость» не может создавать, изменять или удалять любые данные в системе. Все попытки редактирования заблокированы. Для расширения прав обратитесь к администратору.</div>
  </div>

  <h2 class="section-title">Типичные сценарии использования</h2>
  <ul>
    <li>Внешний аудитор, проверяющий договорную документацию</li>
    <li>Временный сотрудник, которому нужен доступ к конкретному договору</li>
    <li>Представитель контрагента, которому предоставлен ограниченный доступ к системе</li>
    <li>Стажёр, знакомящийся с процессами компании</li>
  </ul>
</div>

<div class="page-footer">
  <span>ContractPro — Руководство пользователя v1.0</span>
  <span>© 2026 ContractPro. Конфиденциально.</span>
</div>

</body>
</html>`;

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  headless: true
});

const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });

await page.pdf({
  path: '/home/user/contract-management/ContractPro_Руководство_Пользователя.pdf',
  format: 'A4',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' }
});

await browser.close();
console.log('PDF generated successfully!');
