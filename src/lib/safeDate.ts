import { format as dfFormat } from 'date-fns';

/**
 * Coerce an arbitrary value (Date, ISO string, timestamp, …) into a *valid*
 * Date, or null when it can't be parsed. `new Date('garbage')` and
 * `new Date(undefined)` both yield an "Invalid Date" whose getTime() is NaN —
 * feeding those into date-fns `format()` / `Date.toISOString()` throws a
 * `RangeError: Invalid time value`, which is exactly what was blanking the
 * whole calendar via the panel error boundary. Funnelling every date through
 * here keeps one bad row from taking down the entire view.
 */
export function toValidDate(value: unknown): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

type FormatOptions = Parameters<typeof dfFormat>[2];

/**
 * date-fns `format()` that never throws. Returns `fallback` for missing or
 * unparseable dates instead of crashing the render.
 */
export function formatSafe(
  value: unknown,
  formatStr: string,
  options?: FormatOptions,
  fallback = '',
): string {
  const d = toValidDate(value);
  if (!d) return fallback;
  try {
    return dfFormat(d, formatStr, options);
  } catch {
    return fallback;
  }
}
