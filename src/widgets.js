// -----------------------------------------------------------------------------
// Dashboard widgets (Gladys 5.1+).
//
// Declared in the manifest `widgets` field, produced here as a DECLARATIVE
// content the core renders with its own theme, dark mode and translations:
//
//   - `spot_price`       : the current price (tile colored by its level), the
//                          next one, today's min / max, the price curve of
//                          today (and tomorrow once published) with a "now"
//                          marker, and a status list;
//   - `cheapest_windows` : the cheapest 1, 2, 3 and 4-hour windows of the
//                          next 24 hours, and a refresh button.
//
// The price service nudges the widgets (`requestWidgetRefresh`) at every
// quarter-hour and after every download: the TTL is only a safety net.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { PRICE_LEVELS, displayPrice } from './prices.js';
import { formatPrice, priceInUnit, t, unitLabel } from './i18n.js';
import { localTime, MINUTE_MS } from './time.js';

const logger = createLogger({ name: 'widgets' });

export const SPOT_PRICE_WIDGET = 'spot_price';
export const CHEAPEST_WINDOWS_WIDGET = 'cheapest_windows';

const WIDGET_ACTIONS = { REFRESH: 'refresh' };

export const LEVEL_COLORS = {
  [PRICE_LEVELS.NEGATIVE]: WIDGET_COLORS.INFO,
  [PRICE_LEVELS.VERY_CHEAP]: WIDGET_COLORS.SUCCESS,
  [PRICE_LEVELS.CHEAP]: WIDGET_COLORS.SUCCESS,
  [PRICE_LEVELS.NORMAL]: WIDGET_COLORS.NEUTRAL,
  [PRICE_LEVELS.EXPENSIVE]: WIDGET_COLORS.WARNING,
  [PRICE_LEVELS.VERY_EXPENSIVE]: WIDGET_COLORS.DANGER,
};

const CHEAPEST_WINDOW_HOURS = [1, 2, 3, 4];

function noDataContent() {
  return {
    ttl_seconds: 60,
    components: [{ type: 'text', variant: 'body', text: t('widget.no_data') }],
  };
}

function priceTile(labelKey, price, config, extra = {}) {
  return {
    type: 'value',
    label: t(labelKey),
    value: priceInUnit(displayPrice(price, config), config.display_unit),
    unit: unitLabel(config.display_unit),
    ...extra,
  };
}

function chartPoints(slots, config) {
  return slots.map((slot) => ({
    t: new Date(slot.start).toISOString(),
    v: priceInUnit(displayPrice(slot.price, config), config.display_unit),
  }));
}

export const WIDGETS = {
  [SPOT_PRICE_WIDGET]: {
    async get(service, { settings = {} }) {
      logger.debug(`onWidgetGet <- ${SPOT_PRICE_WIDGET}`);
      const snapshot = service.snapshot();
      const { config } = service;
      if (!snapshot.current) {
        return noDataContent();
      }
      const tz = snapshot.zone.timezone;
      const showTomorrow = settings.show_tomorrow !== false && snapshot.tomorrowComplete;
      const series = [
        { name: t('widget.series_today'), points: chartPoints(snapshot.todaySlots, config) },
      ];
      if (showTomorrow) {
        series.push({
          name: t('widget.series_tomorrow'),
          points: chartPoints(snapshot.tomorrowSlots, config),
        });
      }
      const cheapest = service.findCheapestWindow(2, snapshot.todayFrom, snapshot.tomorrowFrom);
      const components = [
        priceTile('widget.now', snapshot.current.price, config, {
          icon: 'zap',
          color: LEVEL_COLORS[snapshot.level],
        }),
      ];
      if (snapshot.next) {
        components.push(priceTile('widget.next', snapshot.next.price, config, { icon: 'clock' }));
      }
      components.push(
        priceTile('widget.min_today', snapshot.today.min, config, {
          icon: 'trending-down',
          color: WIDGET_COLORS.SUCCESS,
        }),
        priceTile('widget.max_today', snapshot.today.max, config, {
          icon: 'trending-up',
          color: WIDGET_COLORS.DANGER,
        }),
        {
          type: 'chart',
          chart_type: 'stepline',
          title: t('widget.chart_title'),
          unit: unitLabel(config.display_unit),
          series,
          now_marker: true,
        },
        {
          type: 'status',
          items: [
            {
              label: t('widget.level'),
              icon: 'activity',
              value: t(`level.${snapshot.level}`),
              color: LEVEL_COLORS[snapshot.level],
            },
            {
              label: t('widget.average_today'),
              icon: 'bar-chart-2',
              value: formatPrice(displayPrice(snapshot.today.average, config), config.display_unit),
              color: WIDGET_COLORS.NEUTRAL,
            },
            ...(cheapest
              ? [
                  {
                    label: t('widget.cheapest_2h'),
                    icon: 'battery-charging',
                    value: `${localTime(cheapest.start, tz)}–${localTime(cheapest.end, tz)}`,
                    color: WIDGET_COLORS.SUCCESS,
                  },
                ]
              : []),
            {
              label: t('widget.tomorrow'),
              icon: 'calendar',
              value: t(snapshot.tomorrowComplete ? 'tomorrow.available' : 'tomorrow.pending'),
              color: snapshot.tomorrowComplete ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
            },
            {
              label: t('widget.zone'),
              icon: 'map-pin',
              value: snapshot.zone.label,
              color: WIDGET_COLORS.NEUTRAL,
            },
          ],
        },
      );
      return { ttl_seconds: 300, components };
    },
  },

  [CHEAPEST_WINDOWS_WIDGET]: {
    async get(service) {
      logger.debug(`onWidgetGet <- ${CHEAPEST_WINDOWS_WIDGET}`);
      const snapshot = service.snapshot();
      const { config } = service;
      if (!snapshot.current) {
        return noDataContent();
      }
      const tz = snapshot.zone.timezone;
      const from = snapshot.at;
      const to = from + 24 * 60 * MINUTE_MS;
      const items = CHEAPEST_WINDOW_HOURS.map((hours) => {
        const window = service.findCheapestWindow(hours, from, to);
        if (!window) {
          return {
            label: t('widget.window_row', { hours }),
            icon: 'clock',
            value: t('widget.window_none'),
            color: WIDGET_COLORS.NEUTRAL,
          };
        }
        return {
          label: t('widget.window_row', { hours }),
          icon: 'clock',
          value: t('widget.window_value', {
            start: localTime(window.start, tz),
            end: localTime(window.end, tz),
            price: formatPrice(displayPrice(window.average, config), config.display_unit),
          }),
          color: window.start <= snapshot.at ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.PRIMARY,
        };
      });
      return {
        ttl_seconds: 300,
        components: [
          { type: 'text', variant: 'heading', text: t('widget.windows_heading') },
          priceTile('widget.now', snapshot.current.price, config, {
            icon: 'zap',
            color: LEVEL_COLORS[snapshot.level],
          }),
          { type: 'status', items },
          {
            type: 'button',
            label: t('widget.refresh'),
            icon: 'refresh-cw',
            style: 'secondary',
            action: { key: WIDGET_ACTIONS.REFRESH },
          },
        ],
      };
    },

    // Throwing acks the action as failed: the message reaches the user.
    async action(service, { actionKey }) {
      logger.info(`onWidgetAction <- ${CHEAPEST_WINDOWS_WIDGET}.${actionKey}`);
      if (actionKey !== WIDGET_ACTIONS.REFRESH) {
        throw new Error(`Unknown widget action: ${actionKey}`);
      }
      const snapshot = await service.refresh();
      return t('action.refreshed', {
        count: service.slots.length,
        tomorrow: t(snapshot.tomorrowComplete ? 'tomorrow.available' : 'tomorrow.pending'),
      });
    },
  },
};

/**
 * Ask the core to re-pull every widget now (rate-limited core-side to 1 per
 * 10 s per widget, dropped while disconnected).
 */
export function refreshWidgets(gladys) {
  for (const key of Object.keys(WIDGETS)) {
    gladys.requestWidgetRefresh(key);
  }
}
