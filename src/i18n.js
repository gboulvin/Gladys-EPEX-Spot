// -----------------------------------------------------------------------------
// User-facing texts, in the four languages of the integration: English
// (mandatory fallback of Gladys), French, German and Spanish.
//
// Gladys picks the language of the user from a multi-language object
// `{ en, fr, de, es }`, everywhere: action messages, connection status,
// widget contents, toasts. `t(key, vars)` builds that object from the
// catalogue below; a variable is either a plain value or itself a
// multi-language object (a formatted price, a level name...).
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

const MESSAGES = {
  'level.negative': { en: 'Negative', fr: 'Négatif', de: 'Negativ', es: 'Negativo' },
  'level.very_cheap': { en: 'Very cheap', fr: 'Très bas', de: 'Sehr günstig', es: 'Muy barato' },
  'level.cheap': { en: 'Cheap', fr: 'Bas', de: 'Günstig', es: 'Barato' },
  'level.normal': { en: 'Normal', fr: 'Normal', de: 'Normal', es: 'Normal' },
  'level.expensive': { en: 'Expensive', fr: 'Élevé', de: 'Teuer', es: 'Caro' },
  'level.very_expensive': {
    en: 'Very expensive',
    fr: 'Très élevé',
    de: 'Sehr teuer',
    es: 'Muy caro',
  },
  'level.unknown': { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },

  'action.test_ok': {
    en: 'Price API OK ({zone}): {count} quarter-hours received, current price {price}.',
    fr: 'API des prix OK ({zone}) : {count} quarts d’heure reçus, prix actuel {price}.',
    de: 'Preis-API OK ({zone}): {count} Viertelstunden empfangen, aktueller Preis {price}.',
    es: 'API de precios OK ({zone}): {count} cuartos de hora recibidos, precio actual {price}.',
  },
  'action.test_no_current': {
    en: 'Price API OK ({zone}): {count} quarter-hours received, no price for now.',
    fr: 'API des prix OK ({zone}) : {count} quarts d’heure reçus, pas de prix pour l’instant.',
    de: 'Preis-API OK ({zone}): {count} Viertelstunden empfangen, kein aktueller Preis.',
    es: 'API de precios OK ({zone}): {count} cuartos de hora recibidos, sin precio actual.',
  },
  'action.refreshed': {
    en: 'Prices refreshed: {count} quarter-hours known, tomorrow {tomorrow}.',
    fr: 'Prix actualisés : {count} quarts d’heure connus, demain {tomorrow}.',
    de: 'Preise aktualisiert: {count} Viertelstunden bekannt, morgen {tomorrow}.',
    es: 'Precios actualizados: {count} cuartos de hora conocidos, mañana {tomorrow}.',
  },
  'tomorrow.available': {
    en: 'available',
    fr: 'disponible',
    de: 'verfügbar',
    es: 'disponible',
  },
  'tomorrow.pending': {
    en: 'not published yet',
    fr: 'pas encore publié',
    de: 'noch nicht veröffentlicht',
    es: 'aún no publicado',
  },

  'status.init_failed': {
    en: 'Initialization failed, check the integration logs.',
    fr: 'L’initialisation a échoué, consultez les logs de l’intégration.',
    de: 'Initialisierung fehlgeschlagen, prüfen Sie die Logs der Integration.',
    es: 'La inicialización falló, consulte los registros de la integración.',
  },
  'status.api_down': {
    en: 'The price API cannot be reached: {error}',
    fr: 'L’API des prix est injoignable : {error}',
    de: 'Die Preis-API ist nicht erreichbar: {error}',
    es: 'No se puede acceder a la API de precios: {error}',
  },
  'status.calendar_refused': {
    en: 'Gladys refused the {calendar} calendar: another integration already feeds it.',
    fr: 'Gladys a refusé le calendrier {calendar} : une autre intégration l’alimente déjà.',
    de: 'Gladys hat den Kalender {calendar} abgelehnt: eine andere Integration speist ihn bereits.',
    es: 'Gladys rechazó el calendario {calendar}: otra integración ya lo alimenta.',
  },

  'widget.now': { en: 'Now', fr: 'Maintenant', de: 'Jetzt', es: 'Ahora' },
  'widget.next': { en: 'Next', fr: 'Ensuite', de: 'Danach', es: 'Siguiente' },
  'widget.min_today': { en: 'Min today', fr: 'Min du jour', de: 'Min heute', es: 'Mín hoy' },
  'widget.max_today': { en: 'Max today', fr: 'Max du jour', de: 'Max heute', es: 'Máx hoy' },
  'widget.average_today': {
    en: 'Avg today',
    fr: 'Moy. du jour',
    de: 'Ø heute',
    es: 'Media hoy',
  },
  'widget.chart_title': {
    en: 'Day-ahead prices',
    fr: 'Prix day-ahead',
    de: 'Day-Ahead-Preise',
    es: 'Precios day-ahead',
  },
  'widget.series_today': { en: 'Today', fr: 'Aujourd’hui', de: 'Heute', es: 'Hoy' },
  'widget.series_tomorrow': { en: 'Tomorrow', fr: 'Demain', de: 'Morgen', es: 'Mañana' },
  'widget.level': {
    en: 'Price level',
    fr: 'Niveau de prix',
    de: 'Preisniveau',
    es: 'Nivel de precio',
  },
  'widget.zone': { en: 'Bidding zone', fr: 'Zone de prix', de: 'Gebotszone', es: 'Zona de oferta' },
  'widget.tomorrow': { en: 'Tomorrow', fr: 'Demain', de: 'Morgen', es: 'Mañana' },
  'widget.cheapest_2h': {
    en: 'Cheapest 2 h today',
    fr: '2 h les moins chères',
    de: 'Günstigste 2 Std.',
    es: '2 h más baratas',
  },
  'widget.no_data': {
    en: 'No price yet: the integration is downloading the day-ahead prices.',
    fr: 'Pas encore de prix : l’intégration télécharge les prix day-ahead.',
    de: 'Noch keine Preise: die Integration lädt die Day-Ahead-Preise.',
    es: 'Aún no hay precios: la integración está descargando los precios day-ahead.',
  },
  'widget.window_row': {
    en: 'Best {hours} h',
    fr: 'Meilleures {hours} h',
    de: 'Beste {hours} Std.',
    es: 'Mejores {hours} h',
  },
  'widget.window_value': {
    en: '{start}–{end} · {price}',
    fr: '{start}–{end} · {price}',
    de: '{start}–{end} · {price}',
    es: '{start}–{end} · {price}',
  },
  'widget.window_none': {
    en: 'Not enough prices',
    fr: 'Prix insuffisants',
    de: 'Zu wenige Preise',
    es: 'Precios insuficientes',
  },
  'widget.windows_heading': {
    en: 'Cheapest windows, next 24 h',
    fr: 'Créneaux les moins chers, 24 h',
    de: 'Günstigste Zeitfenster, 24 Std.',
    es: 'Franjas más baratas, 24 h',
  },
  'widget.refresh': { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
};

/**
 * Multi-language object of a catalogue entry, variables substituted.
 * @param {string} key - Catalogue key.
 * @param {Record<string, unknown>} [vars] - `{name}` values: plain or multi-language.
 * @returns {{en: string, fr: string, de: string, es: string}}
 */
export function t(key, vars = {}) {
  const entry = MESSAGES[key];
  if (!entry) {
    throw new Error(`Unknown message key: ${key}`);
  }
  const result = {};
  for (const lang of LANGUAGES) {
    result[lang] = entry[lang].replace(/\{(\w+)\}/g, (match, name) => {
      if (!(name in vars)) {
        return match;
      }
      const value = vars[name];
      return String(value !== null && typeof value === 'object' ? value[lang] : value);
    });
  }
  return result;
}

export const hasMessage = (key) => key in MESSAGES;

// Decimal separator per language.
const DECIMAL_COMMA = { en: false, fr: true, de: true, es: true };

/**
 * A price as a multi-language text, in the unit chosen in the config.
 * @param {number} eurPerKwh - Price in EUR/kWh.
 * @param {'kwh'|'mwh'} unit - Display unit.
 */
export function formatPrice(eurPerKwh, unit = 'kwh') {
  const text =
    unit === 'mwh' ? `${(eurPerKwh * 1000).toFixed(2)} €/MWh` : `${eurPerKwh.toFixed(4)} €/kWh`;
  const result = {};
  for (const lang of LANGUAGES) {
    result[lang] = DECIMAL_COMMA[lang] ? text.replace('.', ',') : text;
  }
  return result;
}

/**
 * A price as a number in the display unit, for the value tiles.
 */
export function priceInUnit(eurPerKwh, unit = 'kwh') {
  return unit === 'mwh'
    ? Math.round(eurPerKwh * 100000) / 100
    : Math.round(eurPerKwh * 10000) / 10000;
}

export const unitLabel = (unit) => (unit === 'mwh' ? '€/MWh' : '€/kWh');
