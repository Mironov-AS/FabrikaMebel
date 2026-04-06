const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   trend_pos: 'text-blue-600' },
  green:  { bg: 'bg-green-50',  icon: 'text-green-600',  trend_pos: 'text-green-600' },
  red:    { bg: 'bg-red-50',    icon: 'text-red-600',    trend_pos: 'text-red-600' },
  yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', trend_pos: 'text-yellow-600' },
};

export default function StatCard({ icon: Icon, label, value, trend, color = 'blue' }) {
  const colors = COLOR_MAP[color] ?? COLOR_MAP.blue;
  const isNegative = typeof trend === 'string' && trend.startsWith('-');

  return (
    <div className="card flex items-start gap-4">
      {Icon && (
        <div className={`p-3 rounded-xl ${colors.bg} flex-shrink-0`}>
          <Icon size={22} className={colors.icon} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5 leading-none">{value}</p>
        {trend && (
          <p className={`text-xs font-medium mt-1.5 ${isNegative ? 'text-red-500' : colors.trend_pos}`}>
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}
