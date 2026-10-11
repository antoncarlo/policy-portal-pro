const DAY_MS = 24 * 60 * 60 * 1000;

const isoDate = (time: number) => new Date(time).toISOString().slice(0, 10);
const parseDay = (value: string) => Date.parse(`${value.slice(0, 10)}T00:00:00Z`);

/**
 * The period of a renewal: it starts the day the old policy ends and lasts as long as the old one did
 * (when that is known and sensible), otherwise one year. Used by the server to create the renewal and by
 * the browser to say what the renewal will be before it is created.
 */
export function renewalPeriod(oldStart: string | null, oldEnd: string): { start: string; end: string } {
  const start = parseDay(oldEnd);
  const oldLength = oldStart ? start - parseDay(oldStart) : NaN;
  const days = Number.isFinite(oldLength) && oldLength >= 28 * DAY_MS && oldLength <= 3 * 366 * DAY_MS ? Math.round(oldLength / DAY_MS) : null;
  if (days !== null) return { start: isoDate(start), end: isoDate(start + days * DAY_MS) };
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  return { start: isoDate(start), end: isoDate(end.getTime()) };
}
