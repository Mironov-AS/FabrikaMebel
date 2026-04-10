/**
 * A single tab button. Supports an optional `count` badge.
 *
 * Usage:
 *   <Tab label="Позиции" active={tab === 'spec'} onClick={() => setTab('spec')} />
 *   <Tab label="Заказы" count={orders.length} active={tab === 'orders'} onClick={() => setTab('orders')} />
 */
export default function Tab({ label, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
      {count != null && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
          active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}
