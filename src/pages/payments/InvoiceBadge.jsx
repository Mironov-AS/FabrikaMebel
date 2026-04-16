const INV_STYLES = {
  paid:     'bg-green-100 text-green-700 border border-green-200',
  overdue:  'bg-red-100 text-red-700 border border-red-200',
  partial:  'bg-blue-100 text-blue-700 border border-blue-200',
  pending:  'bg-yellow-100 text-yellow-700 border border-yellow-200',
  inactive: 'bg-gray-100 text-gray-400 border border-gray-200',
};

const INV_LABELS = {
  paid:     'Оплачен',
  overdue:  'Просрочен',
  partial:  'Частично',
  pending:  'Ожидается',
  inactive: 'Аннулирован',
};

export default function InvoiceBadge({ status, inactive }) {
  const key = inactive ? 'inactive' : status;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INV_STYLES[key] || INV_STYLES.pending}`}>
      {INV_LABELS[key] || status}
    </span>
  );
}
