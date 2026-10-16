// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The store indexer validates the manifest itself, but nothing there can know
// which handlers the code registers: these tests keep both sides in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACTIONS } from '../src/actions.js';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { WIDGETS } from '../src/widgets.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { SCENE_TRIGGERS, WINDOW_DURATIONS } from '../src/service.js';
import { PRICE_LEVELS } from '../src/prices.js';
import { ZONES } from '../src/zones.js';
import { LANGUAGES } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const allFields = [
  ...(manifest.config_schema ?? []),
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

const keysOf = (list) => (list ?? []).map((entry) => entry.key);

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

function isAtLeast(version, required) {
  for (let i = 0; i < required.length; i += 1) {
    if (version[i] !== required[i]) {
      return version[i] > required[i];
    }
  }
  return true;
}

test('every manifest action has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions).sort(), Object.keys(ACTIONS).sort());
});

test('every scene_actions key has an onSceneAction handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_actions).sort(), Object.keys(SCENE_ACTIONS).sort());
});

test('every widgets key has an onWidgetGet handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.widgets).sort(), Object.keys(WIDGETS).sort());
  for (const widget of Object.values(WIDGETS)) {
    assert.equal(typeof widget.get, 'function');
  }
});

test('every scene trigger the service fires is declared, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), Object.values(SCENE_TRIGGERS).sort());
});

test('the trigger filters offer exactly the values the service sends', () => {
  const trigger = (key) => manifest.scene_triggers.find((t) => t.key === key);
  const levels = trigger(SCENE_TRIGGERS.PRICE_LEVEL_CHANGED).fields.find((f) => f.key === 'level');
  assert.deepEqual(levels.options.map((o) => o.value).sort(), Object.values(PRICE_LEVELS).sort());
  const durations = trigger(SCENE_TRIGGERS.CHEAPEST_WINDOW_STARTED).fields.find(
    (f) => f.key === 'duration',
  );
  assert.deepEqual(
    durations.options.map((o) => o.value),
    WINDOW_DURATIONS.map(String),
  );
});

test('the capability fields require Gladys >= 5.2.0 (energy contracts)', () => {
  assert.ok(manifest.energy_contracts, 'the integration declares energy contracts');
  assert.ok(manifest.widgets && manifest.scene_triggers && manifest.scene_actions);
  assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
  assert.ok(
    isAtLeast(minGladysVersion(), [5, 2, 0]),
    `energy_contracts requires gladys_version >= 5.2.0, got "${manifest.gladys_version}"`,
  );
});

test('the integration is tagged cloud: it reads a public internet API', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
});

test('one spot calendar and one contract template per bidding zone', () => {
  const { calendars, templates } = manifest.energy_contracts;
  assert.deepEqual(
    calendars.map((c) => c.key),
    ZONES.map((z) => z.calendar),
  );
  for (const calendar of calendars) {
    assert.equal(calendar.granularity, 'fifteen_minutes', 'the day-ahead product is 15 minutes');
    assert.equal(calendar.currency, 'EUR');
    assert.equal(calendar.timezone, ZONES.find((z) => z.calendar === calendar.key).timezone);
  }
  assert.equal(templates.length, ZONES.length);
  for (const zone of ZONES) {
    const template = templates.find((t) => t.key === `epex-spot-${zone.code.toLowerCase()}`);
    assert.ok(template, `no template for ${zone.code}`);
    assert.equal(template.country, zone.country);
    assert.deepEqual(template.calendars, [zone.calendar]);
    assert.deepEqual(template.tariff.calendars, [zone.calendar]);
    const energy = template.tariff.components.find((c) => c.key === 'energy');
    assert.equal(energy.rules[0].price_from_calendar, zone.calendar);
    assert.ok(energy.fallback, 'an interval without spot price is still priced');
    const vat = template.inputs.find((input) => input.key === 'vat');
    assert.equal(vat.default, zone.vat);
  }
});

test('the bidding zone select lists every zone', () => {
  const field = manifest.config_schema.find((f) => f.key === 'bidding_zone');
  assert.deepEqual(
    field.options.map((o) => o.value),
    ZONES.map((z) => z.code),
  );
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  for (const field of manifest.config_schema) {
    if (field.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[field.key], field.default, `DEFAULT_CONFIG.${field.key}`);
    }
  }
});

test('section fields are purely presentational', () => {
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    assert.ok(!(section.key in DEFAULT_CONFIG));
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version, 'manifest version must match package.json');
  assert.ok(
    manifest.docker_image.endsWith(`:${manifest.version}`),
    `docker_image must be tagged :${manifest.version}, got "${manifest.docker_image}"`,
  );
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});

test('field placeholders are multi-language objects', () => {
  for (const field of allFields.filter((f) => f.placeholder !== undefined)) {
    assert.equal(typeof field.placeholder, 'object', `field "${field.key}": placeholder`);
  }
});

test('every manifest text exists in English, French, German and Spanish', () => {
  const missing = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
    } else if (node && typeof node === 'object') {
      if (typeof node.en === 'string') {
        for (const lang of LANGUAGES) {
          if (typeof node[lang] !== 'string' || node[lang].length === 0) {
            missing.push(`${path}.${lang}`);
          }
        }
        return;
      }
      for (const [key, value] of Object.entries(node)) {
        walk(value, `${path}.${key}`);
      }
    }
  };
  walk(manifest, 'manifest');
  assert.deepEqual(missing, []);
});
