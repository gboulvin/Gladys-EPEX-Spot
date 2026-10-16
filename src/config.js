// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of
// `gladys-assistant-integration.json`. This module provides the defaults and
// normalizes the received object, so the rest of the code never deals with
// `undefined` or numbers typed as strings.
// -----------------------------------------------------------------------------

import { DEFAULT_ZONE, ZONES } from './zones.js';

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (checked by test/manifest.test.js).
export const DEFAULT_CONFIG = {
  // Bidding zone of the day-ahead market (see src/zones.js).
  bidding_zone: DEFAULT_ZONE,
  // Minutes between two downloads of the prices. Day-ahead prices change once
  // a day: an hour is plenty, and the integration retries every 15 minutes
  // on its own while tomorrow's prices are awaited.
  refresh_interval: 60,
  // Markup added to the displayed prices (EUR/kWh: supplier margin, grid
  // fees...) and VAT applied on top (%). Display only: the contract costs
  // are computed by Gladys from the raw spot calendar and the contract
  // template.
  markup: 0,
  vat: 0,
  // Unit of the prices shown in the widgets and the action messages.
  display_unit: 'kwh', // 'kwh' | 'mwh'
};

export const REFRESH_INTERVAL_BOUNDS = { min: 15, max: 360 };

function numberOr(value, fallback) {
  const n = Number(value);
  return value === undefined || value === null || value === '' || !Number.isFinite(n)
    ? fallback
    : n;
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const zone = ZONES.some((z) => z.code === raw.bidding_zone)
    ? raw.bidding_zone
    : DEFAULT_CONFIG.bidding_zone;
  const refresh = numberOr(raw.refresh_interval, DEFAULT_CONFIG.refresh_interval);
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    bidding_zone: zone,
    refresh_interval: Math.min(
      REFRESH_INTERVAL_BOUNDS.max,
      Math.max(REFRESH_INTERVAL_BOUNDS.min, refresh),
    ),
    markup: numberOr(raw.markup, DEFAULT_CONFIG.markup),
    vat: Math.max(0, numberOr(raw.vat, DEFAULT_CONFIG.vat)),
    display_unit: raw.display_unit === 'mwh' ? 'mwh' : 'kwh',
  };
}
