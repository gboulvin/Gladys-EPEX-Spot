// -----------------------------------------------------------------------------
// Price service: the runtime of the integration.
//
// Every 30 seconds (`tick`):
//   1. downloads the day-ahead prices when due (the configured interval, every
//      15 minutes while tomorrow's prices are awaited, a back-off on errors);
//   2. feeds the Gladys spot calendar of the zone (`publishEnergyCalendar`):
//      the contract templates of the manifest price the consumption from it;
//   3. publishes the states of the spot price device (changed values only);
//   4. at every quarter-hour, fires the scene triggers (level change, start
//      of a cheapest window) and nudges the dashboard widgets;
//   5. fires `tomorrow_prices_available` once tomorrow's prices are complete.
//
// The known prices are kept in /data (the one writable volume) so a restart
// neither hammers the API nor re-announces tomorrow's prices.
// -----------------------------------------------------------------------------

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';
import { findZone } from './zones.js';
import {
  PRICE_LEVELS,
  cheapestWindow,
  fetchPrices,
  isComplete,
  mergeSlots,
  priceLevel,
  seriesStats,
  slotAt,
  slotsBetween,
} from './prices.js';
import { MINUTE_MS, QUARTER_MS, addLocalDays, localDate, localTime, quarterStart } from './time.js';
import { spotPrice } from './devices/spotPrice.js';
import { t } from './i18n.js';

const logger = createLogger({ name: 'price-service' });

// Scene trigger keys, as declared in the manifest `scene_triggers` field.
// Keys are forever: scenes store them.
export const SCENE_TRIGGERS = {
  PRICE_LEVEL_CHANGED: 'price_level_changed',
  CHEAPEST_WINDOW_STARTED: 'cheapest_window_started',
  TOMORROW_PRICES_AVAILABLE: 'tomorrow_prices_available',
};

// Window lengths (hours) of the `cheapest_window_started` trigger: the
// options of its `duration` filter in the manifest.
export const WINDOW_DURATIONS = [1, 2, 3, 4, 6];

const TICK_MS = 30 * 1000;
const AWAITING_TOMORROW_RETRY_MS = 15 * MINUTE_MS;
const ERROR_RETRY_MS = 5 * MINUTE_MS;
const RATE_LIMIT_RETRY_MS = 20 * MINUTE_MS;
// Day-ahead results are published around 12:45 CET (10:45-11:45 UTC).
const DAY_AHEAD_PUBLICATION_UTC_HOUR = 11;
// Prices kept in memory and on disk: from the day before yesterday.
const KEPT_DAYS = 2;
const MAX_CALENDAR_ENTRIES = 2000;
const STATES_HEARTBEAT_MS = 30 * MINUTE_MS;

export class PriceService {
  /**
   * @param {object} gladys - The SDK client.
   * @param {object} [options]
   * @param {Function} [options.fetchImpl] - `fetch`, injected by the tests.
   * @param {Function} [options.now] - Clock, injected by the tests.
   * @param {string|null} [options.dataDir] - Persistence directory, null for none.
   * @param {Function} [options.onWidgetsChanged] - Called when the widgets content changed.
   */
  constructor(
    gladys,
    { fetchImpl = fetch, now = Date.now, dataDir = null, onWidgetsChanged } = {},
  ) {
    this.gladys = gladys;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.dataDir = dataDir;
    this.onWidgetsChanged = onWidgetsChanged ?? (() => {});
    this.config = null;
    this.zone = null;
    this.timer = null;
    this.ticking = null;
    this.resetZoneState();
  }

  resetZoneState() {
    this.slots = [];
    this.lastFetchAt = null;
    this.nextFetchAt = 0;
    this.lastError = null;
    this.publishedCalendar = new Map();
    this.calendarRefused = false;
    this.lastSlotStart = null;
    this.lastLevel = null;
    this.firedWindows = new Set();
    this.tomorrowAnnouncedFor = null;
    this.connectionOk = null;
  }

  /**
   * Apply a (new) configuration. A zone change starts over: other prices,
   * another calendar, another device.
   */
  async setConfig(config) {
    const previousZone = this.zone;
    this.config = config;
    this.zone = findZone(config.bidding_zone);
    if (previousZone?.code !== this.zone.code) {
      this.resetZoneState();
      await this.load();
    }
  }

  // --- Persistence -----------------------------------------------------------

  get dataFile() {
    return this.dataDir && path.join(this.dataDir, `prices-${this.zone.code.toLowerCase()}.json`);
  }

  async load() {
    if (!this.dataFile) {
      return;
    }
    try {
      const data = JSON.parse(await readFile(this.dataFile, 'utf8'));
      if (Array.isArray(data.slots)) {
        this.slots = mergeSlots(
          [],
          data.slots.filter((s) => Number.isFinite(s?.start) && Number.isFinite(s?.price)),
        );
      }
      this.tomorrowAnnouncedFor = data.tomorrowAnnouncedFor ?? null;
      logger.info(`${this.slots.length} known prices loaded for ${this.zone.code}`);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn(`Cannot read ${this.dataFile}: ${err.message}`);
      }
    }
  }

  async save() {
    if (!this.dataFile) {
      return;
    }
    try {
      await mkdir(this.dataDir, { recursive: true });
      await writeFile(
        this.dataFile,
        JSON.stringify({ slots: this.slots, tomorrowAnnouncedFor: this.tomorrowAnnouncedFor }),
      );
    } catch (err) {
      logger.warn(`Cannot write ${this.dataFile}: ${err.message}`);
    }
  }

  // --- Reading the prices ----------------------------------------------------

  /**
   * Everything the device, the widgets and the scene actions read, computed
   * at an instant from the known prices.
   */
  snapshot(at = this.now()) {
    const tz = this.zone.timezone;
    const todayFrom = addLocalDays(at, 0, tz);
    const tomorrowFrom = addLocalDays(at, 1, tz);
    const tomorrowTo = addLocalDays(at, 2, tz);
    const todaySlots = slotsBetween(this.slots, todayFrom, tomorrowFrom);
    const tomorrowSlots = slotsBetween(this.slots, tomorrowFrom, tomorrowTo);
    const today = seriesStats(todaySlots);
    const tomorrow = seriesStats(tomorrowSlots);
    const current = slotAt(this.slots, at);
    const next = current ? slotAt(this.slots, current.start + QUARTER_MS) : undefined;
    return {
      at,
      zone: this.zone,
      todayFrom,
      tomorrowFrom,
      tomorrowTo,
      todaySlots,
      tomorrowSlots,
      today,
      tomorrow,
      tomorrowComplete: isComplete(this.slots, tomorrowFrom, tomorrowTo),
      current,
      next,
      level: current ? priceLevel(current.price, today) : null,
      lastFetchAt: this.lastFetchAt,
      lastError: this.lastError,
    };
  }

  /**
   * The cheapest window of `hours` within [from, to), cut to the future:
   * a window never starts before the current quarter-hour.
   */
  findCheapestWindow(hours, from, to) {
    const start = Math.max(from, quarterStart(this.now()));
    return cheapestWindow(this.slots, hours * 60, start, to);
  }

  // --- Downloading -----------------------------------------------------------

  isRefreshDue(at = this.now()) {
    return at >= this.nextFetchAt;
  }

  /**
   * Download the prices now, feed the calendar, persist. Throws the download
   * error (the caller decides how to report it).
   */
  async refresh() {
    const at = this.now();
    try {
      const fresh = await fetchPrices(this.zone, { now: at, fetchImpl: this.fetchImpl });
      const keepFrom = addLocalDays(at, -KEPT_DAYS, this.zone.timezone);
      this.slots = mergeSlots(this.slots, fresh).filter((slot) => slot.start >= keepFrom);
      this.lastFetchAt = at;
      this.lastError = null;
      this.nextFetchAt = at + this.nextInterval(at);
      logger.info(`${fresh.length} prices downloaded for ${this.zone.code}`);
    } catch (err) {
      this.lastError = err;
      this.nextFetchAt = at + (err.rateLimited ? RATE_LIMIT_RETRY_MS : ERROR_RETRY_MS);
      throw err;
    }
    await this.save();
    await this.publishCalendar();
    this.onWidgetsChanged();
    return this.snapshot(at);
  }

  // Wait until the next download: the configured interval, shortened to 15
  // minutes after the day-ahead publication while tomorrow is incomplete.
  nextInterval(at) {
    const configured = this.config.refresh_interval * MINUTE_MS;
    const { tomorrowComplete } = this.snapshot(at);
    const afterPublication = new Date(at).getUTCHours() >= DAY_AHEAD_PUBLICATION_UTC_HOUR;
    if (!tomorrowComplete && afterPublication) {
      return Math.min(configured, AWAITING_TOMORROW_RETRY_MS);
    }
    return configured;
  }

  // --- Gladys tariff calendar ----------------------------------------------------

  /**
   * Upsert the prices Gladys does not have yet into the spot calendar of the
   * zone. Gladys recomputes the contract costs that read a changed price.
   */
  async publishCalendar() {
    if (this.calendarRefused) {
      return 0;
    }
    const entries = this.slots
      .filter((slot) => this.publishedCalendar.get(slot.start) !== slot.price)
      .map((slot) => ({ starts_at: new Date(slot.start).toISOString(), price: slot.price }));
    let published = 0;
    for (let i = 0; i < entries.length; i += MAX_CALENDAR_ENTRIES) {
      const chunk = entries.slice(i, i + MAX_CALENDAR_ENTRIES);
      try {
        await this.gladys.publishEnergyCalendar(this.zone.calendar, chunk);
      } catch (err) {
        if (err.status === 403) {
          // Another integration owns the key: Gladys keeps its calendar.
          this.calendarRefused = true;
          logger.warn(`Calendar ${this.zone.calendar} refused by Gladys: ${err.message}`);
          await this.setConnection(
            false,
            t('status.calendar_refused', { calendar: this.zone.calendar }),
          );
          return published;
        }
        throw err;
      }
      for (const entry of chunk) {
        this.publishedCalendar.set(Date.parse(entry.starts_at), entry.price);
      }
      published += chunk.length;
    }
    return published;
  }

  // --- The clock -------------------------------------------------------------------

  /**
   * One step of the service: download when due, publish states and events.
   * Never throws: errors are logged and reported in the connection status.
   */
  async tick() {
    // One tick at a time: a slow download must not overlap the next one.
    if (this.ticking) {
      return this.ticking;
    }
    this.ticking = this.runTick().finally(() => {
      this.ticking = null;
    });
    return this.ticking;
  }

  async runTick() {
    try {
      if (this.isRefreshDue()) {
        try {
          await this.refresh();
        } catch (err) {
          logger.error(`Price download failed: ${err.message}`);
        }
      }
      const snapshot = this.snapshot();
      await this.publishStates(snapshot);
      await this.fireSceneEvents(snapshot);
      await this.reportConnection(snapshot);
    } catch (err) {
      logger.error('Price service tick failed', err);
    }
  }

  async publishStates(snapshot) {
    const states = spotPrice.buildStates(this.gladys, this.config, snapshot);
    if (states.length > 0) {
      await this.gladys.publishChangedStates(states, { heartbeat: STATES_HEARTBEAT_MS });
    }
  }

  async fireSceneEvents(snapshot) {
    const { current, level, today, zone } = snapshot;
    const tz = zone.timezone;
    const slotStart = quarterStart(snapshot.at);
    const isNewSlot = this.lastSlotStart !== null && slotStart !== this.lastSlotStart;
    const firstObservation = this.lastSlotStart === null;
    if (firstObservation || isNewSlot) {
      this.lastSlotStart = slotStart;
    }

    if (isNewSlot) {
      this.onWidgetsChanged();
      // One event per transition of level, never one per quarter-hour.
      if (current && this.lastLevel !== null && level !== this.lastLevel) {
        await this.publishSceneEvent(SCENE_TRIGGERS.PRICE_LEVEL_CHANGED, {
          level,
          previous_level: this.lastLevel,
          price: current.price,
        });
      }
      // The start of the cheapest window of the day, per window length.
      const date = localDate(snapshot.at, tz);
      for (const hours of WINDOW_DURATIONS) {
        const window = cheapestWindow(
          this.slots,
          hours * 60,
          snapshot.todayFrom,
          snapshot.tomorrowFrom,
        );
        const key = `${date}:${hours}`;
        if (window && window.start === slotStart && !this.firedWindows.has(key)) {
          this.firedWindows.add(key);
          await this.publishSceneEvent(SCENE_TRIGGERS.CHEAPEST_WINDOW_STARTED, {
            duration: String(hours),
            average_price: window.average,
            ends_at: localTime(window.end, tz),
          });
        }
      }
      // Forget the windows of the past days.
      for (const key of this.firedWindows) {
        if (!key.startsWith(`${date}:`)) {
          this.firedWindows.delete(key);
        }
      }
    }
    if (current && (firstObservation || isNewSlot)) {
      this.lastLevel = level;
    } else if (!current) {
      this.lastLevel = null;
    }

    // Once per delivery day, persisted: a restart does not announce it again.
    const tomorrowDate = localDate(snapshot.tomorrowFrom, tz);
    if (snapshot.tomorrowComplete && this.tomorrowAnnouncedFor !== tomorrowDate) {
      this.tomorrowAnnouncedFor = tomorrowDate;
      await this.save();
      const cheapest = cheapestWindow(this.slots, 60, snapshot.tomorrowFrom, snapshot.tomorrowTo);
      await this.publishSceneEvent(SCENE_TRIGGERS.TOMORROW_PRICES_AVAILABLE, {
        min_price: snapshot.tomorrow.min,
        max_price: snapshot.tomorrow.max,
        average_price: snapshot.tomorrow.average,
        cheapest_hour: cheapest ? localTime(cheapest.start, tz) : null,
        negative_prices: snapshot.tomorrow.min < 0,
      });
      this.onWidgetsChanged();
    }
    return today;
  }

  async publishSceneEvent(key, data) {
    try {
      await this.gladys.publishSceneEvent(key, data);
    } catch (err) {
      logger.warn(`Scene event ${key} refused: ${err.message}`);
    }
  }

  // --- Connection status ---------------------------------------------------------

  async reportConnection(snapshot) {
    if (this.calendarRefused) {
      return;
    }
    if (snapshot.current) {
      await this.setConnection(true);
    } else if (this.lastError) {
      await this.setConnection(
        false,
        t('status.api_down', { error: this.lastError.message.slice(0, 120) }),
      );
    }
  }

  async setConnection(ok, message) {
    const signature = ok ? 'ok' : JSON.stringify(message);
    if (this.connectionOk === signature) {
      return;
    }
    this.connectionOk = signature;
    try {
      await this.gladys.setConnectionStatus(ok, ok ? undefined : message);
    } catch (err) {
      logger.warn(`Connection status not reported: ${err.message}`);
    }
  }

  // --- Lifecycle -----------------------------------------------------------------

  start() {
    this.stop();
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    return () => this.stop();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // After a reconnection: Gladys may have lost nothing, but re-sending the
  // calendar is a cheap idempotent upsert and the connection status must be
  // reported again.
  forgetPublished() {
    this.publishedCalendar.clear();
    this.connectionOk = null;
    this.calendarRefused = false;
  }
}

export { PRICE_LEVELS };
