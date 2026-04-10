const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Number of whole days between today and a date string (positive = past). */
export function daysDiff(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / MS_PER_DAY);
}

/** Returns a new date string (YYYY-MM-DD) offset by `days` from `date`. */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
