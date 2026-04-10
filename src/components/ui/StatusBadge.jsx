import { STATUS_MAP, STATUS_LABELS } from '../../constants/statuses';

export default function StatusBadge({ status }) {
  const cls = STATUS_MAP[status] ?? 'badge-gray';
  const label = STATUS_LABELS[status] ?? status;
  return <span className={cls}>{label}</span>;
}
