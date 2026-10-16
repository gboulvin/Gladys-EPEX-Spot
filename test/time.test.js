import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUR_MS,
  QUARTER_MS,
  addLocalDays,
  localDate,
  localTime,
  quarterStart,
  startOfLocalDay,
} from '../src/time.js';

test('startOfLocalDay returns the UTC instant of the local midnight', () => {
  const at = Date.UTC(2026, 9, 16, 10, 37); // 12:37 in Paris
  assert.equal(startOfLocalDay(at, 'Europe/Paris'), Date.UTC(2026, 9, 15, 22, 0));
  assert.equal(startOfLocalDay(at, 'Europe/Helsinki'), Date.UTC(2026, 9, 15, 21, 0));
});

test('a local day around midnight UTC belongs to the right local date', () => {
  const at = Date.UTC(2026, 9, 15, 23, 30); // 01:30 on the 16th in Paris
  assert.equal(localDate(at, 'Europe/Paris'), '2026-10-16');
  assert.equal(localTime(at, 'Europe/Paris'), '01:30');
});

test('the autumn clock change day lasts 25 hours, the spring one 23 hours', () => {
  const autumn = Date.UTC(2026, 9, 25, 12, 0);
  const autumnLength =
    addLocalDays(autumn, 1, 'Europe/Paris') - addLocalDays(autumn, 0, 'Europe/Paris');
  assert.equal(autumnLength, 25 * HOUR_MS);
  const spring = Date.UTC(2026, 2, 29, 12, 0);
  const springLength =
    addLocalDays(spring, 1, 'Europe/Paris') - addLocalDays(spring, 0, 'Europe/Paris');
  assert.equal(springLength, 23 * HOUR_MS);
});

test('addLocalDays steps whole local days, backwards too', () => {
  const at = Date.UTC(2026, 9, 16, 10, 0);
  assert.equal(localDate(addLocalDays(at, -1, 'Europe/Paris'), 'Europe/Paris'), '2026-10-15');
  assert.equal(localDate(addLocalDays(at, 2, 'Europe/Paris'), 'Europe/Paris'), '2026-10-18');
});

test('quarterStart rounds down to the quarter-hour', () => {
  const at = Date.UTC(2026, 9, 16, 10, 44, 59);
  assert.equal(quarterStart(at), Date.UTC(2026, 9, 16, 10, 30));
  assert.equal(quarterStart(at) % QUARTER_MS, 0);
});
