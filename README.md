# EPEX Spot for Gladys Assistant

External integration for [Gladys Assistant](https://gladysassistant.com)
bringing the **day-ahead electricity prices** (EPEX Spot auction, coupled
European market) into Gladys, **every 15 minutes**: a price device, a spot
calendar for **dynamic electricity contracts**, scene triggers and actions,
and dashboard widgets.

Built from the official
[JavaScript integration template](https://github.com/GladysAssistant/integration-template-js)
with [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

- **Requires Gladys ≥ 5.2.0** (energy contracts, widgets, scene capabilities).
- **Cloud** integration: prices come from the free public API of
  [energy-charts.info](https://www.energy-charts.info) — no account, no key.
- **Languages**: English, French, German, Spanish.
- **Zones**: France, Germany / Luxembourg, Belgium, Netherlands, Austria,
  Switzerland, Spain, Poland, Denmark West (DK1), Finland.

User documentation: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md).

## Features

| Surface              | What                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Device               | current and next quarter-hour price, today min / average / max, tomorrow average                         |
| Energy contracts     | `spot-<zone>` 15-minute price calendars + one dynamic contract template per zone in the Gladys wizard    |
| Scene triggers       | `price_level_changed`, `cheapest_window_started` (1–6 h), `tomorrow_prices_available`                    |
| Scene actions        | `get_current_price`, `find_cheapest_window`, `check_cheap_hours`, `refresh_prices`                       |
| Dashboard widgets    | `spot_price` (tiles, today / tomorrow curve, level), `cheapest_windows` (best 1–4 h windows + refresh)   |
| Configuration screen | zone, download interval, displayed markup and VAT, unit; buttons "Test the price API" and "Download now" |

The contract templates price every quarter-hour as
`(spot × coefficient + margin + grid fees) × kWh + subscription`, VAT
included: the user fills in the values of their offer, Gladys computes the
costs of the meter.

## Project structure

```
index.js                     SDK wiring (no market logic)
src/service.js               download schedule, calendar feed, states, scene events
src/prices.js                price API driver + statistics, levels, cheapest windows
src/time.js                  local-day helpers (DST-safe, Intl only)
src/zones.js                 bidding zones (API code, calendar key, timezone, VAT)
src/devices/spotPrice.js     the spot price device
src/actions.js               Configuration screen buttons
src/scenes.js                scene actions
src/widgets.js               dashboard widgets
src/i18n.js                  user-facing texts (en / fr / de / es)
src/config.js                config defaults + normalization
docs/                        user documentation (4 languages)
test/                        node --test, fake Gladys + fake price API
```

## Run it locally

```bash
npm install
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="epex-spot" \
DATA_DIR=./data LOG_LEVEL=debug \
npm start
```

## Quality checks

```bash
npm run format:check   # Prettier
npm run lint           # ESLint
npm test               # node --test (no network)
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI runs the first three on Node 22 and 24 and builds the Docker image.

## Release

Describe the changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md),
then **Actions → Release → Run workflow** (`patch`, `minor` or `major`): the
workflow bumps the version everywhere, tags, builds the multi-arch image
`ghcr.io/gboulvin/gladys-epex-spot` and publishes the GitHub Release. The
repository carries the `gladys-assistant-integration` topic, so the store
indexer picks up the new version.

## Data and licence

Prices: Bundesnetzagentur | SMARD.de via energy-charts.info, CC BY 4.0 (OMIE
for Spain, private use). EPEX SPOT is a trademark of EPEX SPOT SE; this
project is not affiliated with it.

Code: Apache-2.0.
