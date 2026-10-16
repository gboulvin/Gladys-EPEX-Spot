import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LANGUAGES, formatPrice, priceInUnit, t } from '../src/i18n.js';
import { PRICE_LEVELS } from '../src/prices.js';
import { ZONES } from '../src/zones.js';

test('t substitutes plain and multi-language variables in every language', () => {
  const text = t('action.refreshed', { count: 288, tomorrow: t('tomorrow.available') });
  assert.deepEqual(Object.keys(text), LANGUAGES);
  assert.equal(text.en, 'Prices refreshed: 288 quarter-hours known, tomorrow available.');
  assert.equal(text.de, 'Preise aktualisiert: 288 Viertelstunden bekannt, morgen verfügbar.');
  assert.throws(() => t('nope'), /Unknown message key/);
});

test('every price level has a translated name', () => {
  for (const level of Object.values(PRICE_LEVELS)) {
    const text = t(`level.${level}`);
    for (const lang of LANGUAGES) {
      assert.ok(text[lang]);
    }
  }
});

test('every zone label exists in the four languages', () => {
  for (const zone of ZONES) {
    assert.deepEqual(Object.keys(zone.label).sort(), [...LANGUAGES].sort());
  }
});

test('formatPrice uses the decimal separator of each language', () => {
  assert.deepEqual(formatPrice(0.12345), {
    en: '0.1235 €/kWh',
    fr: '0,1235 €/kWh',
    de: '0,1235 €/kWh',
    es: '0,1235 €/kWh',
  });
  assert.equal(formatPrice(0.1, 'mwh').en, '100.00 €/MWh');
  assert.equal(priceInUnit(0.12345, 'mwh'), 123.45);
});

test('the user documentation exists in the four languages', async () => {
  for (const lang of LANGUAGES) {
    const doc = await readFile(new URL(`../docs/${lang}.md`, import.meta.url), 'utf8');
    assert.ok(doc.length > 500, `docs/${lang}.md`);
  }
});
