/** Horizontal progress bar with percentage label. */
export default function ProgressBar({ value }) {
  const pct = Math.round(Math.min(100, Math.max(0, value)));
  const color =
    pct >= 80 ? 'bg-green-500' :
    pct >= 40 ? 'bg-blue-500' :
    'bg-gray-300';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}
