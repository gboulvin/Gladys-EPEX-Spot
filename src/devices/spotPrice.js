// -----------------------------------------------------------------------------
// Device type: SPOT PRICE
// One device per bidding zone, carrying the current day-ahead price and the
// statistics of the day. Read-only sensors: states are pushed by the price
// service (src/service.js) at every quarter-hour and after every download,
// no polling.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { findZone } from '../zones.js';
import { displayPrice } from '../prices.js';

const DEVICE_TYPE = 'spot-price';

// Feature keys: part of the external ids, never renamed.
export const FEATURE = {
  PRICE: 'price',
  NEXT_PRICE: 'next-price',
  TODAY_MIN: 'today-min',
  TODAY_AVERAGE: 'today-average',
  TODAY_MAX: 'today-max',
  TOMORROW_AVERAGE: 'tomorrow-average',
};

const FEATURE_NAMES = {
  [FEATURE.PRICE]: 'Current price (€/kWh)',
  [FEATURE.NEXT_PRICE]: 'Next quarter-hour price (€/kWh)',
  [FEATURE.TODAY_MIN]: 'Today minimum (€/kWh)',
  [FEATURE.TODAY_AVERAGE]: 'Today average (€/kWh)',
  [FEATURE.TODAY_MAX]: 'Today maximum (€/kWh)',
  [FEATURE.TOMORROW_AVERAGE]: 'Tomorrow average (€/kWh)',
};

// The platform id is the bidding zone itself: stable, unique per zone.
const platformId = (config) => findZone(config.bidding_zone).code.toLowerCase();

export const spotPrice = {
  key: DEVICE_TYPE,

  ids(gladys, config) {
    return gladys.externalIds(DEVICE_TYPE, platformId(config));
  },

  deviceExternalId(gladys, config) {
    return this.ids(gladys, config).device;
  },

  buildDevice(gladys, config) {
    const ids = this.ids(gladys, config);
    return {
      name: `EPEX Spot ${findZone(config.bidding_zone).code}`,
      external_id: ids.device,
      features: Object.values(FEATURE).map((key) => ({
        name: FEATURE_NAMES[key],
        external_id: ids.feature(key),
        category: DEVICE_FEATURE_CATEGORIES.CURRENCY,
        type: DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL,
        unit: DEVICE_FEATURE_UNITS.EURO,
        // The harmonised day-ahead limits are -500 / +4000 EUR/MWh.
        min: -1,
        max: 5,
        read_only: true,
        has_feedback: false,
        keep_history: key !== FEATURE.NEXT_PRICE,
      })),
    };
  },

  /**
   * States of the device from a price snapshot (see PriceService.snapshot):
   * the prices shown to the user, markup and VAT of the config included.
   * Unknown values are simply not sent.
   */
  buildStates(gladys, config, snapshot) {
    const ids = this.ids(gladys, config);
    const values = {
      [FEATURE.PRICE]: snapshot.current?.price,
      [FEATURE.NEXT_PRICE]: snapshot.next?.price,
      [FEATURE.TODAY_MIN]: snapshot.today?.min,
      [FEATURE.TODAY_AVERAGE]: snapshot.today?.average,
      [FEATURE.TODAY_MAX]: snapshot.today?.max,
      [FEATURE.TOMORROW_AVERAGE]: snapshot.tomorrowComplete
        ? snapshot.tomorrow?.average
        : undefined,
    };
    return Object.entries(values)
      .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
      .map(([key, value]) => ({
        device_feature_external_id: ids.feature(key),
        state: displayPrice(value, config),
      }));
  },
};
