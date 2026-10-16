import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GladysApiError } from '@gladysassistant/integration-sdk';
import { SCENE_TRIGGERS } from '../src/service.js';
import { FEATURE, spotPrice } from '../src/devices/spotPrice.js';
import { HOUR_MS, MINUTE_MS, QUARTER_MS } from '../src/time.js';
import { PARIS_MIDNIGHT, apiBody, createService, fakeFetch } from './helpers.js';

const eventsOf = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);

test('a download feeds the spot calendar of the zone with EUR/kWh prices', async () => {
  const { gladys, service } = await createService();
  await service.refresh();
  const calendar = gladys.fake.energyCalendars['spot-fr'];
  // yesterday, today and tomorrow: 3 local days of 96 quarters
  assert.equal(calendar.length, 3 * 96);
  const first = calendar.find(
    (entry) => entry.starts_at === new Date(PARIS_MIDNIGHT).toISOString(),
  );
  assert.equal(first.value, 0.1);
  assert.equal(gladys.fake.energyCalendars['spot-de'].length, 0, 'only the chosen zone is fed');
});

test('an unchanged price is never re-sent to the calendar', async () => {
  const { service } = await createService();
  await service.refresh();
  assert.equal(await service.publishCalendar(), 0);
});

test('a calendar owned by another integration is reported, not retried', async () => {
  const { gladys, service } = await createService();
  gladys.publishEnergyCalendar = async () => {
    throw new GladysApiError(403, 'FORBIDDEN', 'calendar owned by another integration');
  };
  await service.refresh();
  assert.equal(service.calendarRefused, true);
  assert.equal(await service.publishCalendar(), 0);
});

test('a tick publishes the states of the spot price device', async () => {
  const { gladys, service } = await createService();
  await gladys.publishDiscoveredDevices([spotPrice.buildDevice(gladys, service.config)]);
  await service.tick();
  const ids = spotPrice.ids(gladys, service.config);
  // 10:00 local: 100 + 10 EUR/MWh
  assert.equal(gladys.fake.lastState(ids.feature(FEATURE.PRICE)), 0.11);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURE.TODAY_MIN)), -0.005);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURE.TODAY_MAX)), 0.25);
  assert.ok(gladys.fake.lastState(ids.feature(FEATURE.TOMORROW_AVERAGE)) > 0);
});

test('the shown states include the configured markup and VAT', async () => {
  const { gladys, service } = await createService({ config: { markup: 0.1, vat: 20 } });
  await service.tick();
  const ids = spotPrice.ids(gladys, service.config);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURE.PRICE)), 0.252);
});

test('price_level_changed fires on a change of level only, never at start-up', async () => {
  // 12:50 local: normal price, then 13:00 negative, then 13:15 still negative.
  const { gladys, service, clock } = await createService({
    now: PARIS_MIDNIGHT + 12 * HOUR_MS + 50 * MINUTE_MS,
  });
  await service.tick();
  assert.equal(eventsOf(gladys, SCENE_TRIGGERS.PRICE_LEVEL_CHANGED).length, 0);
  clock.now = PARIS_MIDNIGHT + 13 * HOUR_MS;
  await service.tick();
  const [event] = eventsOf(gladys, SCENE_TRIGGERS.PRICE_LEVEL_CHANGED);
  assert.equal(event.data.level, 'negative');
  assert.equal(event.data.price, -0.005);
  assert.ok(event.data.previous_level !== 'negative');
  clock.now = PARIS_MIDNIGHT + 13 * HOUR_MS + QUARTER_MS;
  await service.tick();
  assert.equal(eventsOf(gladys, SCENE_TRIGGERS.PRICE_LEVEL_CHANGED).length, 1);
});

test('cheapest_window_started fires once at the start of the cheapest window', async () => {
  // The cheapest hour of the day is 13:00 (negative prices).
  const { gladys, service, clock } = await createService({
    now: PARIS_MIDNIGHT + 12 * HOUR_MS + 50 * MINUTE_MS,
  });
  await service.tick();
  clock.now = PARIS_MIDNIGHT + 13 * HOUR_MS + 10 * 1000;
  await service.tick();
  await service.tick();
  const events = eventsOf(gladys, SCENE_TRIGGERS.CHEAPEST_WINDOW_STARTED);
  const oneHour = events.filter((event) => event.data.duration === '1');
  assert.equal(oneHour.length, 1);
  assert.equal(oneHour[0].data.ends_at, '14:00');
  assert.equal(oneHour[0].data.average_price, -0.005);
});

test('tomorrow_prices_available fires once per delivery day, and survives a restart', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'epex-'));
  try {
    const first = await createService({ dataDir });
    await first.service.tick();
    await first.service.tick();
    const events = eventsOf(first.gladys, SCENE_TRIGGERS.TOMORROW_PRICES_AVAILABLE);
    assert.equal(events.length, 1);
    assert.equal(events[0].data.negative_prices, true);
    assert.equal(events[0].data.cheapest_hour, '13:00');

    const saved = JSON.parse(await readFile(path.join(dataDir, 'prices-fr.json'), 'utf8'));
    assert.equal(saved.tomorrowAnnouncedFor, '2026-10-17');

    const restarted = await createService({ dataDir });
    assert.ok(restarted.service.slots.length > 0, 'the known prices are reloaded');
    await restarted.service.tick();
    assert.equal(eventsOf(restarted.gladys, SCENE_TRIGGERS.TOMORROW_PRICES_AVAILABLE).length, 0);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('without tomorrow, the service retries every 15 minutes after the publication', async () => {
  // Only today is served; 14:00 local = 12:00 UTC, after the publication.
  const { service, clock } = await createService({ days: 1, now: PARIS_MIDNIGHT + 14 * HOUR_MS });
  await service.refresh();
  assert.equal(service.nextFetchAt - clock.now, 15 * MINUTE_MS);
  // In the morning, the configured interval applies.
  const morning = await createService({ days: 1, now: PARIS_MIDNIGHT + 8 * HOUR_MS });
  await morning.service.refresh();
  assert.equal(morning.service.nextFetchAt - morning.clock.now, 60 * MINUTE_MS);
});

test('a failed download backs off and reports the connection status', async () => {
  const { gladys, service, clock } = await createService({
    fetchImpl: fakeFetch({}, { status: 503 }),
  });
  await service.tick();
  assert.equal(service.nextFetchAt - clock.now, 5 * MINUTE_MS);
  const status = gladys.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.match(status.message.fr, /API des prix/);
});

test('a rate limit backs off longer', async () => {
  const { service, clock } = await createService({ fetchImpl: fakeFetch({}, { status: 429 }) });
  await service.tick();
  assert.equal(service.nextFetchAt - clock.now, 20 * MINUTE_MS);
});

test('changing the bidding zone starts over with its own calendar', async () => {
  const { gladys, service } = await createService({
    fetchImpl: fakeFetch(() =>
      apiBody(PARIS_MIDNIGHT - 24 * HOUR_MS, PARIS_MIDNIGHT + 48 * HOUR_MS, { step: HOUR_MS }),
    ),
  });
  await service.refresh();
  await service.setConfig({ ...service.config, bidding_zone: 'CH' });
  assert.equal(service.slots.length, 0);
  await service.refresh();
  assert.equal(
    gladys.fake.energyCalendars['spot-ch'].length,
    3 * 96,
    'hourly prices spread on quarters',
  );
});
