// -----------------------------------------------------------------------------
// Scene actions (Gladys 5.1+).
//
// Each action is declared in the manifest `scene_actions` field (key, label,
// `fields`, scalar `outputs`) and handled here under the same key; index.js
// registers every entry with `gladys.onSceneAction(key, ...)`.
//
//   - `fields` arrive RESOLVED (scene variables substituted, defaults applied);
//   - the handler resolves the declared `outputs` only (scalars);
//   - a scene action is never a condition: "no price known" is an output
//     (`found: false`), the scene author gates on it;
//   - an action never fires a scene event (no loop through the integration).
//
// The scene TRIGGERS are fired by the price service (src/service.js).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { cheapRank, displayPrice } from './prices.js';
import { addLocalDays, localTime, MINUTE_MS } from './time.js';

const logger = createLogger({ name: 'scenes' });

// `period` options of `find_cheapest_window`.
export const WINDOW_PERIODS = {
  NEXT_24H: 'next_24h',
  TODAY: 'today',
  TOMORROW: 'tomorrow',
};

const round4 = (value) => Math.round(value * 10000) / 10000;

function periodBounds(service, period) {
  const now = service.now();
  const tz = service.zone.timezone;
  if (period === WINDOW_PERIODS.TODAY) {
    return [addLocalDays(now, 0, tz), addLocalDays(now, 1, tz)];
  }
  if (period === WINDOW_PERIODS.TOMORROW) {
    return [addLocalDays(now, 1, tz), addLocalDays(now, 2, tz)];
  }
  return [now, now + 24 * 60 * MINUTE_MS];
}

/**
 * Scene action handlers, keyed by the manifest key. Each receives the price
 * service (src/service.js) and the resolved fields.
 */
export const SCENE_ACTIONS = {
  // Current price, its level and the next quarter-hour price.
  async get_current_price(service) {
    const { current, next, level } = service.snapshot();
    const { config } = service;
    logger.info('Scene action get_current_price');
    return {
      found: Boolean(current),
      price: current ? displayPrice(current.price, config) : null,
      spot_price: current ? current.price : null,
      level: level ?? 'unknown',
      next_price: next ? displayPrice(next.price, config) : null,
    };
  },

  // The cheapest contiguous window of `duration_hours` in a period.
  async find_cheapest_window(service, { fields }) {
    const hours = Math.min(24, Math.max(0.25, Number(fields.duration_hours) || 1));
    const period = Object.values(WINDOW_PERIODS).includes(fields.period)
      ? fields.period
      : WINDOW_PERIODS.NEXT_24H;
    logger.info(`Scene action find_cheapest_window <- ${hours} h, ${period}`);
    const [from, to] = periodBounds(service, period);
    const window = service.findCheapestWindow(hours, from, to);
    if (!window) {
      return { found: false };
    }
    const tz = service.zone.timezone;
    return {
      found: true,
      start_time: localTime(window.start, tz),
      end_time: localTime(window.end, tz),
      starts_at: new Date(window.start).toISOString(),
      minutes_until_start: Math.max(0, Math.round((window.start - service.now()) / MINUTE_MS)),
      average_price: round4(displayPrice(window.average, service.config)),
      starts_now: window.start <= service.now(),
    };
  },

  // Is the current quarter-hour among the N cheapest hours of the day?
  async check_cheap_hours(service, { fields }) {
    const hours = Math.min(24, Math.max(0.25, Number(fields.hours) || 4));
    const now = service.now();
    const tz = service.zone.timezone;
    const rank = cheapRank(service.slots, now, addLocalDays(now, 0, tz), addLocalDays(now, 1, tz));
    logger.info(`Scene action check_cheap_hours <- ${hours} h: rank ${rank}`);
    return {
      found: rank !== null,
      is_cheap: rank !== null && rank <= Math.round(hours * 4),
      rank: rank ?? null,
    };
  },

  // Download the prices now.
  async refresh_prices(service) {
    logger.info('Scene action refresh_prices');
    const snapshot = await service.refresh();
    return {
      count: service.slots.length,
      tomorrow_available: snapshot.tomorrowComplete,
    };
  },
};
