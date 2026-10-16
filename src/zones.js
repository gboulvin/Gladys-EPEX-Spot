// -----------------------------------------------------------------------------
// Bidding zones of the day-ahead market supported by the integration.
//
// Each zone maps:
//   - `code`      : the bidding zone code of the price API (energy-charts.info);
//   - `calendar`  : the Gladys tariff calendar key fed with its prices. Calendar
//                   keys are GLOBAL per Gladys instance and carry no provider
//                   prefix, so a contract template written for `spot-fr` works
//                   whichever integration feeds it. Keys are forever;
//   - `country`   : ISO 3166-1 alpha-2 country of the contract template;
//   - `timezone`  : local clock of the zone (days, displayed hours);
//   - `vat`       : default VAT rate (%) pre-filled in the contract template.
//
// The manifest `energy_contracts` declares one calendar and one template per
// zone: test/manifest.test.js keeps both lists in sync with this one.
// -----------------------------------------------------------------------------

export const ZONES = [
  {
    code: 'FR',
    calendar: 'spot-fr',
    country: 'FR',
    timezone: 'Europe/Paris',
    vat: 20,
    label: { en: 'France', fr: 'France', de: 'Frankreich', es: 'Francia' },
  },
  {
    code: 'DE-LU',
    calendar: 'spot-de',
    country: 'DE',
    timezone: 'Europe/Berlin',
    vat: 19,
    label: {
      en: 'Germany / Luxembourg',
      fr: 'Allemagne / Luxembourg',
      de: 'Deutschland / Luxemburg',
      es: 'Alemania / Luxemburgo',
    },
  },
  {
    code: 'BE',
    calendar: 'spot-be',
    country: 'BE',
    timezone: 'Europe/Brussels',
    vat: 6,
    label: { en: 'Belgium', fr: 'Belgique', de: 'Belgien', es: 'Bélgica' },
  },
  {
    code: 'NL',
    calendar: 'spot-nl',
    country: 'NL',
    timezone: 'Europe/Amsterdam',
    vat: 21,
    label: { en: 'Netherlands', fr: 'Pays-Bas', de: 'Niederlande', es: 'Países Bajos' },
  },
  {
    code: 'AT',
    calendar: 'spot-at',
    country: 'AT',
    timezone: 'Europe/Vienna',
    vat: 20,
    label: { en: 'Austria', fr: 'Autriche', de: 'Österreich', es: 'Austria' },
  },
  {
    code: 'CH',
    calendar: 'spot-ch',
    country: 'CH',
    timezone: 'Europe/Zurich',
    vat: 8.1,
    label: { en: 'Switzerland', fr: 'Suisse', de: 'Schweiz', es: 'Suiza' },
  },
  {
    code: 'ES',
    calendar: 'spot-es',
    country: 'ES',
    timezone: 'Europe/Madrid',
    vat: 21,
    label: { en: 'Spain', fr: 'Espagne', de: 'Spanien', es: 'España' },
  },
  {
    code: 'PL',
    calendar: 'spot-pl',
    country: 'PL',
    timezone: 'Europe/Warsaw',
    vat: 23,
    label: { en: 'Poland', fr: 'Pologne', de: 'Polen', es: 'Polonia' },
  },
  {
    code: 'DK1',
    calendar: 'spot-dk1',
    country: 'DK',
    timezone: 'Europe/Copenhagen',
    vat: 25,
    label: {
      en: 'Denmark West (DK1)',
      fr: 'Danemark Ouest (DK1)',
      de: 'Dänemark West (DK1)',
      es: 'Dinamarca Oeste (DK1)',
    },
  },
  {
    code: 'FI',
    calendar: 'spot-fi',
    country: 'FI',
    timezone: 'Europe/Helsinki',
    vat: 25.5,
    label: { en: 'Finland', fr: 'Finlande', de: 'Finnland', es: 'Finlandia' },
  },
];

export const DEFAULT_ZONE = 'FR';

/**
 * The zone of a bidding zone code, the default zone for an unknown one.
 * @param {string} code - Bidding zone code, e.g. "FR".
 */
export function findZone(code) {
  return ZONES.find((zone) => zone.code === code) ?? ZONES.find((z) => z.code === DEFAULT_ZONE);
}
