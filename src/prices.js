// -----------------------------------------------------------------------------
// Day-ahead prices: the driver of the price API, and the pure functions that
// read a price series (current price, daily statistics, cheapest windows,
// price levels).
//
// Source: the public API of energy-charts.info (Fraunhofer ISE), which
// republishes the day-ahead auction results of the European bidding zones
// coupled through SDAC (EPEX SPOT, Nord Pool, OMIE...). No account, no key.
// Prices arrive in EUR/MWh, on 15-minute products since October 2025 (some
// zones still on hourly products): they are converted to EUR/kWh and spread on
// a quarter-hour grid, the granularity of the Gladys spot calendars.
//
// A series is an array of `{ start, price }` sorted by `start` (UTC
// milliseconds), one entry per quarter-hour, `price` in EUR/kWh (may be
// negative).
// -----------------------------------------------------------------------------

import { QUARTER_MS, addLocalDays, localDate } from './time.js';

export const PRICE_API_URL = 'https://api.energy-charts.info/price';

// Price levels of a quarter-hour, relative to the prices of its local day.
// Keys are forever: scenes store them (`price_level_changed` trigger filter).
export const PRICE_LEVELS = {
  NEGATIVE: 'negative',
  VERY_CHEAP: 'very_cheap',
  CHEAP: 'cheap',
  NORMAL: 'normal',
  EXPENSIVE: 'expensive',
  VERY_EXPENSIVE: 'very_expensive',
};

// Below this spread (EUR/kWh) between the cheapest and the dearest quarter of
// a day, the day is flat: every quarter reads `normal`.
const FLAT_DAY_SPREAD = 0.005;

export class PriceApiError extends Error {
  constructor(message, { status, rateLimited = false } = {}) {
    super(message);
    this.name = 'PriceApiError';
    this.status = status;
    this.rateLimited = rateLimited;
  }
}

/**
 * Turn an API answer into a quarter-hour series in EUR/kWh.
 * Hourly (or half-hourly) products are spread over their quarter-hours.
 * @param {object} body - `{ unix_seconds: number[], price: number[], unit }`.
 * @returns {{start: number, price: number}[]}
 */
export function parsePriceResponse(body) {
  if (!body || !Array.isArray(body.unix_seconds) || !Array.isArray(body.price)) {
    throw new PriceApiError('Unexpected answer from the price API');
  }
  if (body.unit && !/EUR\s*\/\s*MWh/i.test(body.unit)) {
    throw new PriceApiError(`Unexpected price unit: ${body.unit}`);
  }
  const points = body.unix_seconds
    .map((seconds, i) => ({ start: seconds * 1000, mwh: body.price[i] }))
    .filter((p) => Number.isFinite(p.start) && p.start % QUARTER_MS === 0);
  // The product length: the smallest step of the series (15 or 60 minutes).
  let step = QUARTER_MS;
  if (points.length > 1) {
    step = Math.min(...points.slice(1).map((p, i) => p.start - points[i].start));
    if (!(step > 0) || step % QUARTER_MS !== 0) {
      step = QUARTER_MS;
    }
  }
  const slots = [];
  for (const point of points) {
    if (typeof point.mwh !== 'number' || !Number.isFinite(point.mwh)) {
      continue;
    }
    const price = Math.round(point.mwh * 100) / 100000; // EUR/MWh -> EUR/kWh, 5 decimals
    for (let start = point.start; start < point.start + step; start += QUARTER_MS) {
      slots.push({ start, price });
    }
  }
  return mergeSlots([], slots);
}

/**
 * Fetch the prices of yesterday, today and tomorrow (local days of the zone).
 * Tomorrow is only there once the day-ahead auction is published (about
 * 12:45 CET).
 * @param {object} zone - A zone of src/zones.js.
 * @param {object} [options]
 * @param {number} [options.now] - Current instant (ms).
 * @param {Function} [options.fetchImpl] - `fetch` (injected by the tests).
 * @param {number} [options.timeoutMs] - Request timeout.
 */
export async function fetchPrices(
  zone,
  { now = Date.now(), fetchImpl = fetch, timeoutMs = 20000 } = {},
) {
  const url = new URL(PRICE_API_URL);
  url.searchParams.set('bzn', zone.code);
  url.searchParams.set('start', localDate(addLocalDays(now, -1, zone.timezone), zone.timezone));
  url.searchParams.set('end', localDate(addLocalDays(now, 1, zone.timezone), zone.timezone));
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new PriceApiError(`Price API unreachable: ${err.message}`);
  }
  if (response.status === 429) {
    throw new PriceApiError('Price API rate limit reached', { status: 429, rateLimited: true });
  }
  if (!response.ok) {
    throw new PriceApiError(`Price API answered HTTP ${response.status}`, {
      status: response.status,
    });
  }
  return parsePriceResponse(await response.json());
}

/**
 * Merge a new series into a known one (newer prices win), sorted by start.
 */
export function mergeSlots(known, fresh) {
  const byStart = new Map(known.map((slot) => [slot.start, slot]));
  for (const slot of fresh) {
    byStart.set(slot.start, { start: slot.start, price: slot.price });
  }
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}

/**
 * The slots starting in [from, to).
 */
export function slotsBetween(slots, from, to) {
  return slots.filter((slot) => slot.start >= from && slot.start < to);
}

/**
 * The slot containing the instant `ms`, or undefined.
 */
export function slotAt(slots, ms) {
  return slots.find((slot) => ms >= slot.start && ms < slot.start + QUARTER_MS);
}

/**
 * True when every quarter-hour of [from, to) has a price.
 */
export function isComplete(slots, from, to) {
  return slotsBetween(slots, from, to).length === Math.round((to - from) / QUARTER_MS);
}

/**
 * Min / max / average of a series, with the start of the min and max slots.
 * @returns {null | {min: number, max: number, average: number, minStart: number, maxStart: number, count: number}}
 */
export function seriesStats(slots) {
  if (slots.length === 0) {
    return null;
  }
  let min = slots[0];
  let max = slots[0];
  let sum = 0;
  for (const slot of slots) {
    if (slot.price < min.price) min = slot;
    if (slot.price > max.price) max = slot;
    sum += slot.price;
  }
  return {
    min: min.price,
    max: max.price,
    average: round5(sum / slots.length),
    minStart: min.start,
    maxStart: max.start,
    count: slots.length,
  };
}

/**
 * Level of a price, relative to the statistics of its day: its position
 * between the cheapest and the dearest quarter, in fifths.
 */
export function priceLevel(price, stats) {
  if (price < 0) {
    return PRICE_LEVELS.NEGATIVE;
  }
  if (!stats || stats.max - stats.min < FLAT_DAY_SPREAD) {
    return PRICE_LEVELS.NORMAL;
  }
  const position = (price - stats.min) / (stats.max - stats.min);
  if (position < 0.2) return PRICE_LEVELS.VERY_CHEAP;
  if (position < 0.4) return PRICE_LEVELS.CHEAP;
  if (position < 0.6) return PRICE_LEVELS.NORMAL;
  if (position < 0.8) return PRICE_LEVELS.EXPENSIVE;
  return PRICE_LEVELS.VERY_EXPENSIVE;
}

/**
 * The cheapest contiguous window of `durationMinutes` starting at or after
 * `from` and ending at or before `to`, every quarter priced. Ties go to the
 * earliest window.
 * @returns {null | {start: number, end: number, average: number}}
 */
export function cheapestWindow(slots, durationMinutes, from, to) {
  const quarters = Math.max(1, Math.round(durationMinutes / 15));
  const candidates = slotsBetween(slots, from, to);
  let best = null;
  let sum = 0;
  let runStart = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    // A hole in the series restarts the run.
    if (i > 0 && candidates[i].start !== candidates[i - 1].start + QUARTER_MS) {
      runStart = i;
      sum = 0;
    }
    sum += candidates[i].price;
    if (i - runStart + 1 > quarters) {
      sum -= candidates[i - quarters].price;
    }
    if (i - runStart + 1 >= quarters) {
      const average = sum / quarters;
      if (best === null || average < best.average - 1e-12) {
        best = {
          start: candidates[i - quarters + 1].start,
          end: candidates[i].start + QUARTER_MS,
          average,
        };
      }
    }
  }
  return best && { ...best, average: round5(best.average) };
}

/**
 * Rank of the slot at `ms` among the slots of [from, to), cheapest first
 * (1 = the cheapest quarter), or null when unknown.
 */
export function cheapRank(slots, ms, from, to) {
  const current = slotAt(slots, ms);
  if (!current) {
    return null;
  }
  const day = slotsBetween(slots, from, to);
  return day.filter((slot) => slot.price < current.price).length + 1;
}

/**
 * Price shown to the user: the spot price plus the configured markup, VAT
 * included. Contract costs are computed by Gladys from the raw calendar.
 */
export function displayPrice(price, config) {
  return round5((price + (config.markup ?? 0)) * (1 + (config.vat ?? 0) / 100));
}

export function round5(value) {
  return Math.round(value * 100000) / 100000;
}
