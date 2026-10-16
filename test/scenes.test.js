import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { HOUR_MS, MINUTE_MS } from '../src/time.js';
import { PARIS_MIDNIGHT, createService } from './helpers.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const declaredOutputs = (key) =>
  manifest.scene_actions.find((action) => action.key === key).outputs.map((o) => o.key);

function assertDeclared(key, outputs) {
  const declared = declaredOutputs(key);
  for (const [name, value] of Object.entries(outputs)) {
    assert.ok(declared.includes(name), `output "${name}" of ${key} is not declared`);
    assert.ok(value === null || typeof value !== 'object', `output "${name}" must be a scalar`);
  }
}

async function readyService(options) {
  const context = await createService(options);
  await context.service.refresh();
  return context;
}

test('get_current_price returns the current and next prices with the level', async () => {
  const { service } = await readyService();
  const outputs = await SCENE_ACTIONS.get_current_price(service, { fields: {} });
  assertDeclared('get_current_price', outputs);
  assert.deepEqual(outputs, {
    found: true,
    price: 0.11,
    spot_price: 0.11,
    level: 'normal',
    next_price: 0.11,
  });
});

test('get_current_price without prices answers found: false', async () => {
  const { service } = await createService();
  const outputs = await SCENE_ACTIONS.get_current_price(service, { fields: {} });
  assertDeclared('get_current_price', outputs);
  assert.equal(outputs.found, false);
});

test('find_cheapest_window finds the negative hour of the next 24 hours', async () => {
  const { service } = await readyService();
  const outputs = await SCENE_ACTIONS.find_cheapest_window(service, {
    fields: { duration_hours: 1, period: 'next_24h' },
  });
  assertDeclared('find_cheapest_window', outputs);
  assert.equal(outputs.found, true);
  assert.equal(outputs.start_time, '13:00');
  assert.equal(outputs.end_time, '14:00');
  assert.equal(outputs.minutes_until_start, 180);
  assert.equal(outputs.average_price, -0.005);
  assert.equal(outputs.starts_now, false);
});

test('find_cheapest_window searches tomorrow, and never in the past', async () => {
  const { service } = await readyService({ now: PARIS_MIDNIGHT + 15 * HOUR_MS });
  const today = await SCENE_ACTIONS.find_cheapest_window(service, {
    fields: { duration_hours: 3, period: 'today' },
  });
  assert.ok(today.starts_at >= new Date(PARIS_MIDNIGHT + 15 * HOUR_MS).toISOString());
  const tomorrow = await SCENE_ACTIONS.find_cheapest_window(service, {
    fields: { duration_hours: 3, period: 'tomorrow' },
  });
  assert.equal(tomorrow.start_time, '02:00', 'the cheap night of tomorrow');
  const tooLong = await SCENE_ACTIONS.find_cheapest_window(service, {
    fields: { duration_hours: 24, period: 'today' },
  });
  assert.deepEqual(tooLong, { found: false });
});

test('check_cheap_hours tells whether now is among the cheapest hours', async () => {
  const { service, clock } = await readyService({
    now: PARIS_MIDNIGHT + 13 * HOUR_MS + 5 * MINUTE_MS,
  });
  const cheap = await SCENE_ACTIONS.check_cheap_hours(service, { fields: { hours: 1 } });
  assertDeclared('check_cheap_hours', cheap);
  assert.deepEqual(cheap, { found: true, is_cheap: true, rank: 1 });
  clock.now = PARIS_MIDNIGHT + 19 * HOUR_MS;
  const dear = await SCENE_ACTIONS.check_cheap_hours(service, { fields: { hours: 4 } });
  assert.equal(dear.is_cheap, false);
});

test('refresh_prices downloads and reports what is known', async () => {
  const { service, fetchFn } = await createService();
  const outputs = await SCENE_ACTIONS.refresh_prices(service, { fields: {} });
  assertDeclared('refresh_prices', outputs);
  assert.deepEqual(outputs, { count: 3 * 96, tomorrow_available: true });
  assert.equal(fetchFn.calls.length, 1);
});
