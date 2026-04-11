import { Search, X } from 'lucide-react';

/**
 * Search input with a leading search icon and a clear (×) button when non-empty.
 * Uses the global `.input` CSS class for styling.
 */
export default function SearchInput({ value, onChange, placeholder, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        className="input pl-9 pr-8"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          onClick={() => onChange('')}
          aria-label="Очистить"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
