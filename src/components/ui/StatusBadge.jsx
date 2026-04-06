const STATUS_MAP = {
  // badge-green
  active:      'badge-green',
  shipped:     'badge-green',
  paid:        'badge-green',
  produced:    'badge-green',
  // badge-blue
  in_progress:   'badge-blue',
  in_production: 'badge-blue',
  in_review:     'badge-blue',
  // badge-gray
  planned:  'badge-gray',
  pending:  'badge-gray',
  // badge-purple
  completed: 'badge-purple',
  resolved:  'badge-purple',
  closed:    'badge-purple',
  // badge-red
  overdue:    'badge-red',
  suspended:  'badge-red',
  // badge-yellow
  draft: 'badge-yellow',
  open:  'badge-yellow',
};

const STATUS_LABELS = {
  active:        'Активен',
  shipped:       'Отгружен',
  paid:          'Оплачен',
  produced:      'Произведён',
  in_progress:   'В процессе',
  in_production: 'В производстве',
  in_review:     'На проверке',
  planned:       'Запланирован',
  pending:       'Ожидает',
  completed:     'Завершён',
  resolved:      'Решён',
  closed:        'Закрыт',
  overdue:       'Просрочен',
  suspended:     'Приостановлен',
  draft:         'Черновик',
  open:          'Открыт',
};

export default function StatusBadge({ status }) {
  const cls = STATUS_MAP[status] ?? 'badge-gray';
  const label = STATUS_LABELS[status] ?? status;
  return <span className={cls}>{label}</span>;
}
