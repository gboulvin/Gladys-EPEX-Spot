// Shared fixtures of the tests: a fake price API and a controllable clock.
// Tests never touch the network.

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { PriceService } from '../src/service.js';
import { normalizeConfig } from '../src/config.js';
import { ZONES } from '../src/zones.js';
import { QUARTER_MS, HOUR_MS } from '../src/time.js';

// 2026-10-16 is a Friday; 00:00 in Paris (CEST, UTC+2) is 22:00 UTC the day before.
export const PARIS_MIDNIGHT = Date.UTC(2026, 9, 15, 22, 0);

/**
 * A price curve in EUR/MWh: cheap at night (02:00-05:00 local), expensive at
 * 19:00, negative at 13:00-14:00 local.
 */
export function defaultCurve(start) {
  const localHour = new Date(start + 2 * HOUR_MS).getUTCHours();
  if (localHour >= 13 && localHour < 14) return -5;
  if (localHour >= 2 && localHour < 5) return 40;
  if (localHour === 19) return 250;
  return 100 + localHour;
}

/**
 * API body for [from, to), one point per `step`.
 */
export function apiBody(from, to, { step = QUARTER_MS, curve = defaultCurve } = {}) {
  const unix_seconds = [];
  const price = [];
  for (let start = from; start < to; start += step) {
    unix_seconds.push(start / 1000);
    price.push(curve(start));
  }
  return { license_info: 'test', unix_seconds, price, unit: 'EUR / MWh', deprecated: false };
}

/**
 * A fake `fetch` answering `body()` and recording the requested URLs.
 */
export function fakeFetch(body, { status = 200 } = {}) {
  const calls = [];
  const impl = async (url) => {
    calls.push(String(url));
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => (typeof body === 'function' ? body() : body),
    };
  };
  impl.calls = calls;
  return impl;
}

export function createClock(start) {
  const clock = { now: start };
  clock.fn = () => clock.now;
  return clock;
}

/**
 * A price service on a fake Gladys declaring every spot calendar, with a
 * fake API serving `days` local days of prices from Paris midnight.
 */
export async function createService({
  now = PARIS_MIDNIGHT + 10 * HOUR_MS,
  days = 2,
  config = {},
  fetchImpl,
  dataDir = null,
  gladysOptions = {},
} = {}) {
  const gladys = createFakeGladys({
    energyCalendars: Object.fromEntries(ZONES.map((zone) => [zone.calendar, []])),
    ...gladysOptions,
  });
  const clock = createClock(now);
  const fetchFn =
    fetchImpl ??
    fakeFetch(() => apiBody(PARIS_MIDNIGHT - 24 * HOUR_MS, PARIS_MIDNIGHT + days * 24 * HOUR_MS));
  let widgetNudges = 0;
  const service = new PriceService(gladys, {
    fetchImpl: fetchFn,
    now: clock.fn,
    dataDir,
    onWidgetsChanged: () => {
      widgetNudges += 1;
    },
  });
  await service.setConfig(normalizeConfig(config));
  return { gladys, service, clock, fetchFn, widgetNudges: () => widgetNudges };
}
