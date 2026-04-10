const PRIORITY_MAP = {
  high:   { cls: 'badge-red',    label: 'Высокий' },
  medium: { cls: 'badge-yellow', label: 'Средний' },
  low:    { cls: 'badge-green',  label: 'Низкий'  },
};

export default function PriorityBadge({ priority }) {
  const p = PRIORITY_MAP[priority] ?? { cls: 'badge-gray', label: priority };
  return <span className={p.cls}>{p.label}</span>;
}
