# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

**EPEX Spot**, a Gladys Assistant **external integration**: a Node.js service
(Node 22+, ESM, no build step) running in its own sandboxed Docker container
and talking to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It started from the official JavaScript template
(`GladysAssistant/integration-template-js`).

It downloads the day-ahead electricity prices of a bidding zone from the public
API of energy-charts.info (no account, no key), and exposes them to Gladys as:

- a **device** (current / next price, daily statistics);
- a **tariff calendar** (`spot-<zone>`, 15-minute grid) read by the **energy
  contract templates** of the manifest (Gladys 5.2+);
- **scene triggers** and **scene actions**;
- two **dashboard widgets**.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/service.test.js          # one file
node --test --test-name-pattern "window"  # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three commands before
pushing.

## Architecture

```
index.js                          SDK wiring only: handlers registered before connect()
src/service.js                    PriceService: download schedule, calendar feed, states, scene events
src/prices.js                     price API driver + pure functions (stats, levels, cheapest windows)
src/time.js                       local-day helpers (Intl only), DST-safe
src/zones.js                      bidding zones: API code, calendar key, country, timezone, default VAT
src/devices/spotPrice.js          the spot price device (discovery payload + states)
src/actions.js                    manifest `actions` (Configuration screen buttons)
src/scenes.js                     scene action handlers (manifest `scene_actions`)
src/widgets.js                    dashboard widget handlers (manifest `widgets`)
src/i18n.js                       every user-facing text, en / fr / de / es
src/config.js                     DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
gladys-assistant-integration.json manifest: config_schema, actions, triggers, widgets, energy_contracts
docs/{en,fr,de,es}.md             user documentation, re-hosted by Gladys (en and fr mandatory)
test/                             node --test, against the SDK's fake Gladys and a fake price API
.github/scripts/release.mjs       release helpers (manifest bump, changelog), tested in test/
```

## Rules

- **Keys are forever.** Device and feature external ids (built with
  `gladys.externalIds(type, platformId)`, the platform id being the bidding
  zone), calendar keys (`spot-fr`...), contract template keys
  (`epex-spot-fr`...), scene trigger / action keys, their field and output
  keys, widget keys, price level values and config keys: Gladys, scenes,
  dashboards and contracts store them. Add, never rename. A calendar
  granularity never changes either (15 minutes, the day-ahead product).
- **Calendar keys are global** per Gladys instance and carry no provider
  prefix: a template written for `spot-fr` works whichever integration feeds
  it. A 403 on `publishEnergyCalendar` means another integration owns the key:
  report it, never retry in a loop.
- **Adding a zone** = an entry in `src/zones.js` (with its 4-language label)
  and a regeneration of the manifest calendars, templates and `bidding_zone`
  options, kept in sync by `test/manifest.test.js`. At most 10 calendars and
  20 templates per manifest.
- **Be gentle with the price API**: it is free and rate-limited. One download
  per configured interval (60 min by default), every 15 minutes only while
  tomorrow's prices are awaited, back-off on errors (5 min) and on 429
  (20 min). Tests never touch the network: inject `fetchImpl`.
- **Units**: the calendar always carries the raw spot price in EUR/kWh
  (Gladys applies the contract formula). The device and the widgets show the
  price with the configured markup and VAT (`displayPrice`).
- **The container rootfs is read-only.** Write only under `/data` (the known
  prices, `prices-<zone>.json`). Never log tokens.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading: the Release workflow moves the section.
- **Manifest.** Texts are multi-language objects. The catalog `description`
  holds 10 to 100 characters per language. `energy_contracts` requires
  `gladys_version >= 5.2.0`. The manifest is generated by hand-editing JSON:
  keep it Prettier-formatted (`npm run format`).
- **User-facing text is in four languages**: English, French, German and
  Spanish — manifest texts, `src/i18n.js` messages, zone labels and
  `docs/*.md`, kept in sync. The tests fail on a missing language.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English.
