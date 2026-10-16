// -----------------------------------------------------------------------------
// Entry point of the EPEX Spot integration for Gladys Assistant.
//
// Role of this file: wire the SDK to the price service (src/service.js). It
// holds no market logic, it only:
//   1. instantiates the SDK (connection, auth, reconnection: handled for you);
//   2. registers the handlers BEFORE connect();
//   3. connects, publishes the spot price device and starts the service.
//
// Environment variables provided by the Gladys supervisor to the container:
//   GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN, GLADYS_INTEGRATION_SELECTOR.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import { spotPrice } from './src/devices/spotPrice.js';
import { PriceService } from './src/service.js';
import { ACTIONS } from './src/actions.js';
import { SCENE_ACTIONS } from './src/scenes.js';
import { WIDGETS, refreshWidgets } from './src/widgets.js';
import { t } from './src/i18n.js';

const gladys = new GladysIntegration();

// /data is the only writable volume of the sandboxed container.
const service = new PriceService(gladys, {
  dataDir: process.env.DATA_DIR ?? '/data',
  onWidgetsChanged: () => refreshWidgets(gladys),
});

async function applyConfig(rawConfig) {
  const config = normalizeConfig(rawConfig);
  await service.setConfig(config);
  await gladys.publishDiscoveredDevices([spotPrice.buildDevice(gladys, config)]);
  return config;
}

// --- Discovery: Gladys asks for the list of devices --------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> publishing the spot price device');
  await gladys.publishDiscoveredDevices([
    spotPrice.buildDevice(gladys, service.config ?? normalizeConfig()),
  ]);
});

// --- Manifest actions: buttons in the Configuration screen -------------------
for (const [actionKey, handler] of Object.entries(ACTIONS)) {
  gladys.onAction(actionKey, (fields) => handler(service, { fields }));
}

// --- Scene actions -----------------------------------------------------------
// The scene TRIGGERS need no handler: the service fires them.
for (const [actionKey, handler] of Object.entries(SCENE_ACTIONS)) {
  gladys.onSceneAction(actionKey, (fields) => handler(service, { fields }));
}

// --- Dashboard widgets -------------------------------------------------------
for (const [widgetKey, widget] of Object.entries(WIDGETS)) {
  gladys.onWidgetGet(widgetKey, (request) => widget.get(service, request));
  if (typeof widget.action === 'function') {
    gladys.onWidgetAction(widgetKey, (actionKey, params, { settings }) =>
      widget.action(service, { actionKey, params, settings }),
    );
  }
}

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');
  await applyConfig(newConfig);
  // A new zone or interval: download now, the widgets follow.
  service.nextFetchAt = 0;
  await service.tick();
  refreshWidgets(gladys);
});

// --- Connection lifecycle ----------------------------------------------------
gladys.on('connected', async () => {
  try {
    await applyConfig(await gladys.getConfig());
    service.forgetPublished();
    service.start();
    refreshWidgets(gladys);
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
    await gladys.setConnectionStatus(false, t('status.init_failed')).catch(() => {});
  }
});

gladys.on('disconnected', () => {
  service.stop();
});

// --- Graceful shutdown -------------------------------------------------------
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  service.stop();
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the EPEX Spot integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
