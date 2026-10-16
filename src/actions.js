// -----------------------------------------------------------------------------
// Manifest actions: the buttons of the Configuration screen (manifest
// `actions` field). The resolved multi-language message is displayed under
// the button; a thrown error is displayed too.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { displayPrice, fetchPrices, slotAt } from './prices.js';
import { formatPrice, t } from './i18n.js';

const logger = createLogger({ name: 'actions' });

export const ACTIONS = {
  // Live request to the price API, without touching the known prices.
  async test_connection(service) {
    logger.info('Action test_connection -> live request to the price API');
    const slots = await fetchPrices(service.zone, {
      now: service.now(),
      fetchImpl: service.fetchImpl,
    });
    const current = slotAt(slots, service.now());
    const vars = { zone: service.zone.code, count: slots.length };
    if (!current) {
      return t('action.test_no_current', vars);
    }
    return t('action.test_ok', {
      ...vars,
      price: formatPrice(displayPrice(current.price, service.config), service.config.display_unit),
    });
  },

  // Download now and feed the Gladys calendar.
  async refresh_prices(service) {
    logger.info('Action refresh_prices');
    const snapshot = await service.refresh();
    return t('action.refreshed', {
      count: service.slots.length,
      tomorrow: t(snapshot.tomorrowComplete ? 'tomorrow.available' : 'tomorrow.pending'),
    });
  },
};
