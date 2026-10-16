// -----------------------------------------------------------------------------
// Local clock helpers, built on Intl only (no date library).
//
// The market works on the local days of a zone (a day-ahead auction delivers
// the next local day, 92, 96 or 100 quarter-hours long), while the price API
// and Gladys exchange UTC instants. These helpers convert between the two.
// -----------------------------------------------------------------------------

export const MINUTE_MS = 60 * 1000;
export const QUARTER_MS = 15 * MINUTE_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

const formatters = new Map();

function formatterFor(timezone) {
  if (!formatters.has(timezone)) {
    formatters.set(
      timezone,
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
  }
  return formatters.get(timezone);
}

/**
 * Local calendar fields of an instant.
 * @param {number} ms - UTC instant, in milliseconds.
 * @param {string} timezone - IANA timezone.
 * @returns {{year: number, month: number, day: number, hour: number, minute: number}}
 */
export function localParts(ms, timezone) {
  const parts = {};
  for (const { type, value } of formatterFor(timezone).formatToParts(new Date(ms))) {
    if (type !== 'literal') {
      parts[type] = Number(value);
    }
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

/**
 * Offset of the local clock from UTC at an instant, in milliseconds.
 */
export function offsetMs(ms, timezone) {
  const p = localParts(ms, timezone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(ms / MINUTE_MS) * MINUTE_MS;
}

/**
 * UTC instant of the local midnight starting the local day of `ms`.
 */
export function startOfLocalDay(ms, timezone) {
  const p = localParts(ms, timezone);
  const midnightAsUtc = Date.UTC(p.year, p.month - 1, p.day);
  // Two passes: the offset at midnight may differ from the one at `ms` (a
  // clock change happens at night).
  let guess = midnightAsUtc - offsetMs(midnightAsUtc, timezone);
  guess = midnightAsUtc - offsetMs(guess, timezone);
  return guess;
}

/**
 * Start of the local day `days` days after the local day of `ms`.
 */
export function addLocalDays(ms, days, timezone) {
  // Noon of the local day is never ambiguous: step from there.
  const noon = startOfLocalDay(ms, timezone) + 12 * HOUR_MS;
  return startOfLocalDay(noon + days * DAY_MS, timezone);
}

/**
 * Local `YYYY-MM-DD` of an instant.
 */
export function localDate(ms, timezone) {
  const p = localParts(ms, timezone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Local `HH:MM` of an instant.
 */
export function localTime(ms, timezone) {
  const p = localParts(ms, timezone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/**
 * Start of the quarter-hour containing `ms`. Every European zone is offset
 * from UTC by whole hours, so UTC and local quarters coincide.
 */
export function quarterStart(ms) {
  return Math.floor(ms / QUARTER_MS) * QUARTER_MS;
}
