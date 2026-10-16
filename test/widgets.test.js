import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  CHEAPEST_WINDOWS_WIDGET,
  SPOT_PRICE_WIDGET,
  WIDGETS,
  refreshWidgets,
} from '../src/widgets.js';
import { LANGUAGES } from '../src/i18n.js';
import { HOUR_MS } from '../src/time.js';
import { PARIS_MIDNIGHT, createService } from './helpers.js';

const request = { settings: {}, language: 'fr', units: 'metric' };

async function readyService(options) {
  const context = await createService(options);
  await context.service.refresh();
  return context;
}

for (const key of Object.keys(WIDGETS)) {
  test(`the ${key} content is rendered exactly as sent`, async () => {
    const { service } = await readyService();
    assert.deepEqual(validateWidgetContent(await WIDGETS[key].get(service, request)), []);
  });

  test(`the ${key} content without prices is a valid empty state`, async () => {
    const { service } = await createService();
    const content = await WIDGETS[key].get(service, request);
    assert.deepEqual(validateWidgetContent(content), []);
    assert.equal(content.components[0].type, 'text');
  });
}

test('the spot price chart shows today, and tomorrow once published', async () => {
  const { service } = await readyService();
  const content = await WIDGETS[SPOT_PRICE_WIDGET].get(service, request);
  const chart = content.components.find((c) => c.type === 'chart');
  assert.equal(chart.series.length, 2);
  assert.equal(chart.series[0].points.length, 96);
  assert.equal(chart.now_marker, true);
  const todayOnly = await WIDGETS[SPOT_PRICE_WIDGET].get(service, {
    ...request,
    settings: { show_tomorrow: false },
  });
  assert.equal(todayOnly.components.find((c) => c.type === 'chart').series.length, 1);
});

test('the spot price tiles follow the display unit', async () => {
  const { service } = await readyService({ config: { display_unit: 'mwh' } });
  const content = await WIDGETS[SPOT_PRICE_WIDGET].get(service, request);
  const now = content.components[0];
  assert.equal(now.value, 110);
  assert.equal(now.unit, '€/MWh');
  assert.deepEqual(validateWidgetContent(content), []);
});

test('every text of the widgets exists in the four languages', async () => {
  const { service } = await readyService();
  const texts = [];
  const collect = (node) => {
    if (node && typeof node === 'object') {
      if (typeof node.en === 'string') {
        texts.push(node);
        return;
      }
      Object.values(node).forEach(collect);
    }
  };
  for (const widget of Object.values(WIDGETS)) {
    collect(await widget.get(service, request));
  }
  assert.ok(texts.length > 10);
  for (const text of texts) {
    assert.deepEqual(Object.keys(text).sort(), [...LANGUAGES].sort(), JSON.stringify(text));
  }
});

test('the refresh button downloads the prices and answers a short toast', async () => {
  const { service, fetchFn } = await readyService({ now: PARIS_MIDNIGHT + 9 * HOUR_MS });
  const content = await WIDGETS[CHEAPEST_WINDOWS_WIDGET].get(service, request);
  const button = content.components.find((c) => c.type === 'button');
  const toast = await WIDGETS[CHEAPEST_WINDOWS_WIDGET].action(service, {
    actionKey: button.action.key,
    params: {},
    settings: {},
  });
  assert.equal(fetchFn.calls.length, 2);
  for (const lang of LANGUAGES) {
    assert.ok(toast[lang].length <= 200);
  }
  await assert.rejects(
    WIDGETS[CHEAPEST_WINDOWS_WIDGET].action(service, { actionKey: 'nope', params: {} }),
    /Unknown widget action/,
  );
});

test('refreshWidgets nudges every widget', () => {
  const gladys = createFakeGladys();
  refreshWidgets(gladys);
  assert.deepEqual(gladys.fake.widgetRefreshes, Object.keys(WIDGETS));
});
