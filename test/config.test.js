import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, DEFAULT_CONFIG } from '../src/config.js';

test('normalizeConfig returns the defaults when called with no argument', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('normalizeConfig keeps a known zone and refuses an unknown one', () => {
  assert.equal(normalizeConfig({ bidding_zone: 'DE-LU' }).bidding_zone, 'DE-LU');
  assert.equal(normalizeConfig({ bidding_zone: 'XX' }).bidding_zone, 'FR');
});

test('normalizeConfig coerces numbers typed as strings and bounds the interval', () => {
  const config = normalizeConfig({ refresh_interval: '30', markup: '0.12', vat: '20' });
  assert.equal(config.refresh_interval, 30);
  assert.equal(config.markup, 0.12);
  assert.equal(config.vat, 20);
  assert.equal(normalizeConfig({ refresh_interval: 1 }).refresh_interval, 15);
  assert.equal(normalizeConfig({ refresh_interval: 9999 }).refresh_interval, 360);
  assert.equal(normalizeConfig({ markup: '' }).markup, 0);
});

test('normalizeConfig only knows the two display units', () => {
  assert.equal(normalizeConfig({ display_unit: 'mwh' }).display_unit, 'mwh');
  assert.equal(normalizeConfig({ display_unit: 'gwh' }).display_unit, 'kwh');
});
