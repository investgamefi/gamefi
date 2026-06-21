/* US market hours helper. The TopBar's "MARKET OPEN" pill used to be
   a hardcoded JSX string regardless of clock or day — pulses red at
   2am Sunday promising a live exchange. This computes the real state.

   Hours used (NYSE regular session):
     Mon–Fri, 09:30 – 16:00 America/New_York
   Pre-market (04:00–09:30) and after-hours (16:00–20:00) are reported
   separately so the UI can show a yellow "PRE-MARKET" / "AFTER-HOURS"
   pill if it wants. Holidays are NOT honored — that needs a calendar
   feed and isn't in scope for the P0 fix. Worst case: a Memorial Day
   tradeable-looking pill appears when the market is actually closed;
   the user clicks through and sees no data move. */

export type MarketStatus = 'open' | 'pre-market' | 'after-hours' | 'closed' | 'holiday' | 'early-close';

/* NYSE holiday calendar — full closures and early-close (1pm ET) days
   for 2025-2027. Refresh annually. Dates are ISO YYYY-MM-DD in
   America/New_York (we compare against the ET-formatted date below
   so DST and timezone don't matter). Source: NYSE official calendar. */
const NYSE_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2025
  '2025-01-01', // New Year's Day
  '2025-01-09', // Day of mourning Jimmy Carter
  '2025-01-20', // MLK Day
  '2025-02-17', // Presidents Day
  '2025-04-18', // Good Friday
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-11-27', // Thanksgiving
  '2025-12-25', // Christmas
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);

/* Early-close days (close at 13:00 ET instead of 16:00). */
const NYSE_EARLY_CLOSE: ReadonlySet<string> = new Set([
  '2025-07-03', '2025-11-28', '2025-12-24',
  '2026-07-02', '2026-11-27', '2026-12-24',
  '2027-07-02', '2027-11-26',
]);

/* Returns the current NYSE wall-clock as { day, hours, minutes, ymd }.
   ymd is YYYY-MM-DD in America/New_York — used to look up holiday
   tables without timezone drift. Intl.DateTimeFormat handles DST. */
function nyNow(now: Date = new Date()): { day: number; hours: number; minutes: number; ymd: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const wdLabel = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[wdLabel] ?? 1;
  const hours = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minutes = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const dayStr = parts.find((p) => p.type === 'day')?.value ?? '01';
  return { day, hours, minutes, ymd: `${year}-${month}-${dayStr}` };
}

export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const { day, hours, minutes, ymd } = nyNow(now);
  if (day === 0 || day === 6) return 'closed';     // weekend
  if (NYSE_HOLIDAYS.has(ymd)) return 'holiday';
  const minutesSinceMidnight = hours * 60 + minutes;
  const PRE_OPEN  = 4 * 60;          // 04:00 ET
  const REG_OPEN  = 9 * 60 + 30;     // 09:30 ET
  /* Early-close days close at 13:00 ET; everything else 16:00 ET. */
  const REG_CLOSE = NYSE_EARLY_CLOSE.has(ymd) ? 13 * 60 : 16 * 60;
  const AFTER_END = 20 * 60;         // 20:00 ET
  if (minutesSinceMidnight < PRE_OPEN)  return 'closed';
  if (minutesSinceMidnight < REG_OPEN)  return 'pre-market';
  if (minutesSinceMidnight < REG_CLOSE) {
    return NYSE_EARLY_CLOSE.has(ymd) ? 'early-close' : 'open';
  }
  if (minutesSinceMidnight < AFTER_END) return 'after-hours';
  return 'closed';
}

/* Pretty label + colour role for the pill. Roles map to existing
   stadium tokens — ref-red for live, whistle (amber) for pre/after,
   text-mute for closed. */
export interface MarketPillSpec {
  label: string;
  role: 'live' | 'amber' | 'muted';
}

export function getMarketPillSpec(status: MarketStatus): MarketPillSpec {
  switch (status) {
    case 'open':         return { label: 'MARKET OPEN',     role: 'live' };
    case 'early-close':  return { label: 'EARLY-CLOSE',     role: 'live' };
    case 'pre-market':   return { label: 'PRE-MARKET',      role: 'amber' };
    case 'after-hours':  return { label: 'AFTER-HOURS',     role: 'amber' };
    case 'holiday':      return { label: 'MARKET HOLIDAY',  role: 'muted' };
    default:             return { label: 'MARKET CLOSED',   role: 'muted' };
  }
}
