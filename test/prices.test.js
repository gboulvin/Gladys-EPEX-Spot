import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRICE_LEVELS,
  PriceApiError,
  cheapRank,
  cheapestWindow,
  displayPrice,
  fetchPrices,
  isComplete,
  mergeSlots,
  parsePriceResponse,
  priceLevel,
  seriesStats,
  slotAt,
} from '../src/prices.js';
import { HOUR_MS, QUARTER_MS } from '../src/time.js';
import { findZone } from '../src/zones.js';
import { PARIS_MIDNIGHT, apiBody, fakeFetch } from './helpers.js';

const series = (prices, from = PARIS_MIDNIGHT) =>
  prices.map((price, i) => ({ start: from + i * QUARTER_MS, price }));

test('parsePriceResponse converts EUR/MWh to EUR/kWh on the quarter-hour grid', () => {
  const slots = parsePriceResponse({
    unix_seconds: [PARIS_MIDNIGHT / 1000, PARIS_MIDNIGHT / 1000 + 900],
    price: [123.45, -7.5],
    unit: 'EUR / MWh',
  });
  assert.deepEqual(slots, [
    { start: PARIS_MIDNIGHT, price: 0.12345 },
    { start: PARIS_MIDNIGHT + QUARTER_MS, price: -0.0075 },
  ]);
});

test('parsePriceResponse spreads hourly products over their four quarters', () => {
  const body = apiBody(PARIS_MIDNIGHT, PARIS_MIDNIGHT + 2 * HOUR_MS, {
    step: HOUR_MS,
    curve: () => 80,
  });
  const slots = parsePriceResponse(body);
  assert.equal(slots.length, 8);
  assert.ok(slots.every((slot) => slot.price === 0.08));
  assert.equal(slots[3].start, PARIS_MIDNIGHT + 3 * QUARTER_MS);
});

test('parsePriceResponse skips missing prices and refuses another unit', () => {
  const slots = parsePriceResponse({
    unix_seconds: [PARIS_MIDNIGHT / 1000, PARIS_MIDNIGHT / 1000 + 900],
    price: [null, 50],
    unit: 'EUR / MWh',
  });
  assert.equal(slots.length, 1);
  assert.throws(
    () => parsePriceResponse({ unix_seconds: [], price: [], unit: 'SEK / MWh' }),
    PriceApiError,
  );
  assert.throws(() => parsePriceResponse({}), PriceApiError);
});

test('fetchPrices asks for yesterday to tomorrow, in local dates of the zone', async () => {
  const fetchImpl = fakeFetch(apiBody(PARIS_MIDNIGHT, PARIS_MIDNIGHT + HOUR_MS));
  const slots = await fetchPrices(findZone('FR'), { now: PARIS_MIDNIGHT + HOUR_MS, fetchImpl });
  assert.equal(slots.length, 4);
  const url = new URL(fetchImpl.calls[0]);
  assert.equal(url.hostname, 'api.energy-charts.info');
  assert.equal(url.searchParams.get('bzn'), 'FR');
  assert.equal(url.searchParams.get('start'), '2026-10-15');
  assert.equal(url.searchParams.get('end'), '2026-10-17');
});

test('fetchPrices reports the rate limit and the HTTP errors', async () => {
  await assert.rejects(
    fetchPrices(findZone('FR'), { fetchImpl: fakeFetch({}, { status: 429 }) }),
    (err) => err.rateLimited === true,
  );
  await assert.rejects(
    fetchPrices(findZone('FR'), { fetchImpl: fakeFetch({}, { status: 500 }) }),
    /HTTP 500/,
  );
  await assert.rejects(
    fetchPrices(findZone('FR'), {
      fetchImpl: async () => {
        throw new Error('getaddrinfo ENOTFOUND');
      },
    }),
    /unreachable/,
  );
});

test('mergeSlots keeps one entry per quarter, the newest price winning', () => {
  const merged = mergeSlots(series([0.1, 0.2]), series([0.3], PARIS_MIDNIGHT + QUARTER_MS));
  assert.deepEqual(
    merged.map((slot) => slot.price),
    [0.1, 0.3],
  );
});

test('seriesStats, slotAt and isComplete read a series', () => {
  const slots = series([0.1, 0.05, 0.3, 0.2]);
  const stats = seriesStats(slots);
  assert.equal(stats.min, 0.05);
  assert.equal(stats.max, 0.3);
  assert.equal(stats.average, 0.1625);
  assert.equal(stats.minStart, PARIS_MIDNIGHT + QUARTER_MS);
  assert.equal(seriesStats([]), null);
  assert.equal(slotAt(slots, PARIS_MIDNIGHT + 20 * 60 * 1000).price, 0.05);
  assert.equal(slotAt(slots, PARIS_MIDNIGHT + HOUR_MS), undefined);
  assert.ok(isComplete(slots, PARIS_MIDNIGHT, PARIS_MIDNIGHT + HOUR_MS));
  assert.ok(!isComplete(slots, PARIS_MIDNIGHT, PARIS_MIDNIGHT + 2 * HOUR_MS));
});

test('cheapestWindow finds the cheapest contiguous run, earliest on a tie', () => {
  const slots = series([0.3, 0.1, 0.1, 0.3, 0.1, 0.1, 0.3]);
  const window = cheapestWindow(slots, 30, PARIS_MIDNIGHT, PARIS_MIDNIGHT + 2 * HOUR_MS);
  assert.equal(window.start, PARIS_MIDNIGHT + QUARTER_MS);
  assert.equal(window.end, PARIS_MIDNIGHT + 3 * QUARTER_MS);
  assert.equal(window.average, 0.1);
  assert.equal(cheapestWindow(slots, 4 * 60, PARIS_MIDNIGHT, PARIS_MIDNIGHT + 2 * HOUR_MS), null);
});

test('cheapestWindow never spans a hole in the series', () => {
  const slots = [...series([0.3, 0.01]), ...series([0.02, 0.3], PARIS_MIDNIGHT + 3 * QUARTER_MS)];
  const window = cheapestWindow(slots, 30, PARIS_MIDNIGHT, PARIS_MIDNIGHT + 2 * HOUR_MS);
  // 0.01 + 0.02 would be cheaper, but a quarter is missing between them.
  assert.equal(window.average, 0.155);
});

test('priceLevel places a price within its day, negatives apart', () => {
  const stats = { min: 0, max: 1 };
  assert.equal(priceLevel(-0.01, stats), PRICE_LEVELS.NEGATIVE);
  assert.equal(priceLevel(0.1, stats), PRICE_LEVELS.VERY_CHEAP);
  assert.equal(priceLevel(0.3, stats), PRICE_LEVELS.CHEAP);
  assert.equal(priceLevel(0.5, stats), PRICE_LEVELS.NORMAL);
  assert.equal(priceLevel(0.7, stats), PRICE_LEVELS.EXPENSIVE);
  assert.equal(priceLevel(1, stats), PRICE_LEVELS.VERY_EXPENSIVE);
  assert.equal(priceLevel(0.1, { min: 0.1, max: 0.101 }), PRICE_LEVELS.NORMAL, 'a flat day');
});

test('cheapRank ranks the current quarter among the day', () => {
  const slots = series([0.3, 0.1, 0.2]);
  assert.equal(cheapRank(slots, PARIS_MIDNIGHT, PARIS_MIDNIGHT, PARIS_MIDNIGHT + HOUR_MS), 3);
  assert.equal(
    cheapRank(slots, PARIS_MIDNIGHT + QUARTER_MS, PARIS_MIDNIGHT, PARIS_MIDNIGHT + HOUR_MS),
    1,
  );
  assert.equal(
    cheapRank(slots, PARIS_MIDNIGHT + HOUR_MS, PARIS_MIDNIGHT, PARIS_MIDNIGHT + HOUR_MS),
    null,
  );
});

test('displayPrice adds the markup then the VAT', () => {
  assert.equal(displayPrice(0.1, { markup: 0, vat: 0 }), 0.1);
  assert.equal(displayPrice(0.1, { markup: 0.05, vat: 20 }), 0.18);
});
